"""Paso 1: de las fotos de producto al patrón de cada camiseta.

Para cada kit (campo, portero) lee su foto de pecho y de espalda y genera:
  build/panels-<kit>.json     malla 2D (delantero + espalda + fuelles laterales) con UV
  public/kit/<kit>-*.webp     texturas recortadas, sin fondo y sin sombras de estudio
  src/assets/og/<kit>-*.png   recortes para las imágenes de compartir
  src/data/kit.json           recorte y posición del nombre y el dorsal de cada kit

Uso: python tools/kit/prep.py [kit ...]   (necesita numpy, opencv, scipy, pillow)
Para un kit nuevo: python tools/kit/outline.py <foto> y anotar aquí sus puntos clave.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import distance_transform_edt
from scipy.spatial import Delaunay

from outline import shirt_mask  # módulo local tools/kit/outline.py

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
BUILD = HERE / "build"
SRC = HERE / "src"
SHIRT_HEIGHT = 0.775  # metros, del cuello al bajo de la espalda
EDGE = 0.0085  # metros, tamaño de triángulo
TEX = 2  # px de textura por px de foto

# Puntos clave marcados a ojo sobre cada foto (se ajustan al contorno más cercano).
# Lado A = izquierda de la foto de espalda (brazo izquierdo del jugador).
KEYS = ["neckA", "cuffTopA", "cuffBotA", "hemA", "hemB", "cuffBotB", "cuffTopB", "neckB"]
SEAMS = [("neckA", "cuffTopA"), ("cuffBotA", "hemA"), ("hemB", "cuffBotB"), ("cuffTopB", "neckB")]
OPENINGS = [("cuffTopA", "cuffBotA"), ("hemA", "hemB"), ("cuffBotB", "cuffTopB"), ("neckB", "neckA")]

KITS = {
    # Primera equipación 2026/27, manga corta
    "campo": dict(
        front="front.webp",
        back="back.webp",
        back_pts=[(343, 80), (70, 477), (227, 496), (242, 998), (689, 989), (677, 480), (823, 465), (537, 74)],
        # foto frontal SIN espejar: [neckL, cuffOutL, cuffInL, hemL, hemR, cuffInR, cuffOutR, neckR]
        front_pts=[(348, 91), (104, 471), (247, 479), (220, 1018), (697, 1010), (660, 483), (807, 473), (543, 85)],
        neck=None,  # el escote se detecta solo (interior gris de la espalda)
        cuts=dict(front=[], back=[]),
        crop=dict(x=50, y=45, w=800, h=1035),
        delight=16,
        crest=dict(detail="escudo-detalle.webp", detail_roi=(150, 330, 640, 800), roi=(548, 212, 672, 328)),
        ink="#f7f5ee",
        edge="#0c0c10",
        lining="#1f3f5c",  # color del interior de la prenda (se ve por el cuello)
        text_cx=450,  # la tienda oficial centra la serigrafía en la foto, no en el cuello
    ),
    # Tercera equipación de portero (tienda oficial, 2025/26), manga larga con cuello polo. Es la
    # naranja, el color con el que posan los porteros en las fotos oficiales de la plantilla
    "portero": dict(
        front="portero-naranja/01.jpg",
        back="portero-naranja/02.jpg",
        back_pts=[(333, 120), (64, 1021), (160, 1021), (200, 1039), (727, 1016), (753, 1012), (857, 1008), (583, 122)],
        front_pts=[(330, 129), (56, 1033), (167, 1036), (200, 1035), (703, 1040), (727, 1054), (806, 1051), (584, 114)],
        # escote delantero a mano: solapas del polo, interior visible y pico
        neck=[(330, 129), (353, 100), (368, 85), (375, 88), (375, 108), (375, 150), (377, 181), (416, 194), (452, 206), (499, 190), (545, 176), (550, 150), (552, 128), (551, 106), (552, 88), (560, 89), (572, 100), (584, 114)],
        # las mangas largas caen pegadas al cuerpo: estas líneas las separan
        cuts=dict(
            front=[
                [(213, 455), (217, 470), (221, 490), (224, 520), (225, 540), (220, 558)],
                [(695, 450), (692, 465), (688, 485), (683, 515), (682, 545), (684, 600), (687, 680), (689, 760), (697, 860), (700, 940), (702, 1000), (704, 1040), (705, 1064)],
            ],
            back=[
                [(179, 440), (180, 515), (178, 600), (175, 680), (176, 720), (176, 780), (174, 830)],
                [(702, 438), (700, 465), (701, 500), (698, 545), (699, 580), (702, 620), (705, 665)],
            ],
        ),
        # axilas (arranque de esas líneas): en manga larga la costura lateral tiene dos tramos
        arm=dict(back=[(179, 440), (702, 438)], front=[(213, 455), (695, 450)]),
        crop=dict(x=40, y=30, w=820, h=1061),
        delight=44,  # el zigzag es dibujo, no sombra: solo se aplana lo muy suave
        crest=dict(detail="portero-naranja/04.jpg", detail_roi=(170, 230, 700, 770), roi=(527, 238, 630, 336)),
        ink="#f7f5ee",  # la tienda serigrafía esta camiseta en blanco con borde negro
        edge="#0c0c10",
        lining="#242424",
    ),
}


def arc(contour, i, j):
    """Tramo corto del contorno cerrado entre los índices i y j."""
    n = len(contour)
    fwd = [(i + k) % n for k in range((j - i) % n + 1)]
    bwd = [(i - k) % n for k in range((i - j) % n + 1)]
    return contour[fwd if len(fwd) <= len(bwd) else bwd].astype(np.float64)


def resample(line, n):
    """n+1 puntos equiespaciados a lo largo de la polilínea."""
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(line, axis=0), axis=1))]
    t = np.linspace(0, d[-1], n + 1)
    return np.c_[np.interp(t, d, line[:, 0]), np.interp(t, d, line[:, 1])]


def length(line):
    return np.linalg.norm(np.diff(line, axis=0), axis=1).sum()


def front_neckline(img, left, right):
    """Borde superior del cuello delantero: límite inferior del interior visible de la espalda."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    inner = ((hsv[..., 1] < 95) | (hsv[..., 2] < 62)).astype(np.uint8)
    inner[:, : left[0] + 4] = 0
    inner[:, right[0] - 3 :] = 0
    inner[190:] = 0
    inner = cv2.morphologyEx(inner, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(inner)
    lab = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    region = labels == lab
    xs = np.arange(left[0] + 8, right[0] - 7)
    ys = np.array([np.nonzero(region[:, x])[0].max() if region[:, x].any() else np.nan for x in xs], float)
    ok = ~np.isnan(ys)
    # curva suave anclada en las dos esquinas del cuello
    px = np.r_[left[0], xs[ok], right[0]]
    py = np.r_[left[1], ys[ok], right[1]]
    w = np.r_[50, np.ones(ok.sum()), 50]
    coef = np.polyfit(px, py, 6, w=w)
    x = np.linspace(left[0], right[0], 60)
    return np.c_[x, np.polyval(coef, x)]


def snap(contour, pts):
    return [int(np.argmin(((contour - np.array(p)) ** 2).sum(axis=1))) for p in pts]


def delight(img, mask, sigma):
    """Quita el sombreado de estudio de la foto (pliegues y volumen del maniquí) y deja el color
    liso del tejido: la luz y las sombras las pone después el motor 3D sobre la malla real."""
    f = img.astype(np.float32)
    lum = f @ np.array([0.114, 0.587, 0.299], np.float32)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    fabric = (hsv[..., 1] > 70) & (mask > 0)
    warm = (hsv[..., 0] > 150) | (hsv[..., 0] < 15)
    norm = np.zeros_like(lum)
    for cls in (fabric & warm, fabric & ~warm):  # cada color de tejido tiene su luminancia propia
        if cls.any():
            norm[cls] = lum[cls] / np.median(lum[cls])
    w = fabric.astype(np.float32)
    field = lambda sig: cv2.GaussianBlur(norm * w, (0, 0), sig) / np.maximum(cv2.GaussianBlur(w, (0, 0), sig), 1e-3)  # noqa: E731
    near, far = field(sigma), field(max(60, sigma * 1.6))
    k = np.clip((cv2.GaussianBlur(w, (0, 0), sigma) - 0.55) / 0.35, 0, 1)
    shade = far + (near - far) * k  # bajo los logos se usa el sombreado de alrededor
    shade = np.clip(shade, 0.5, 1.7) ** 0.9
    return np.clip(f / shade[..., None] * 1.06, 0, 255).astype(np.uint8)


def shield(img, roi):
    """Contorno del escudo (su ribete blanco) dentro de una zona de la imagen."""
    x0, y0, x1, y1 = roi
    hsv = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2HSV)
    white = ((hsv[..., 1] < 70) & (hsv[..., 2] > 150)).astype(np.uint8) * 255
    k = max(3, (x1 - x0) // 40) | 1
    white = cv2.morphologyEx(white, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8))
    cnts, _ = cv2.findContours(white, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cnts, key=cv2.contourArea)[:, 0, :] + (x0, y0)
    # tres puntos reconocibles: esquinas superiores y pico inferior
    keys = np.float32([c[np.argmin(c[:, 0] + c[:, 1])], c[np.argmax(c[:, 0] - c[:, 1])], c[np.argmax(c[:, 1])]])
    return c, keys


def sharpen_crest(tex, photo, cfg, crop):
    """Sustituye el escudo borroso de la foto general por el de la foto de detalle, mucho más nítido."""
    detail = cv2.imread(str(SRC / cfg["detail"]))
    outline, src = shield(detail, cfg["detail_roi"])
    _, dst = shield(photo, cfg["roi"])
    to_tex = (dst - (crop["x"], crop["y"])) * TEX
    M = cv2.getAffineTransform(src, to_tex.astype(np.float32))
    size = (tex.shape[1], tex.shape[0])
    shrink = np.sqrt(abs(np.linalg.det(M[:, :2])))
    soft = cv2.GaussianBlur(detail, (0, 0), max(0.01, 0.45 / shrink))
    warped = cv2.warpAffine(soft, M, size, flags=cv2.INTER_LINEAR)
    m = np.zeros(detail.shape[:2], np.uint8)
    cv2.drawContours(m, [outline.reshape(-1, 1, 2)], -1, 255, -1)
    m = cv2.GaussianBlur(cv2.warpAffine(m, M, size), (0, 0), 0.8).astype(np.float32)[..., None] / 255
    return (tex * (1 - m) + warped * m).astype(np.uint8)


def build(kit, cfg):
    back_img = cv2.imread(str(SRC / cfg["back"]))
    front_img = cv2.imread(str(SRC / cfg["front"]))
    H, W = back_img.shape[:2]
    back_mask, back_c = shirt_mask(back_img, cfg["cuts"]["back"])
    front_mask, front_c = shirt_mask(front_img, cfg["cuts"]["front"])
    crop = cfg["crop"]

    keys, b_pts, f_pts = list(KEYS), list(cfg["back_pts"]), list(cfg["front_pts"])
    # foto frontal: su izquierda es el lado B (se mira al jugador de frente)
    f_order = ["neckB", "cuffTopB", "cuffBotB", "hemB", "hemA", "cuffBotA", "cuffTopA", "neckA"]
    seams = SEAMS
    order = ["neckA>cuffTopA", "cuffTopA>cuffBotA", "cuffBotA>hemA", "hemA>hemB", "hemB>cuffBotB", "cuffBotB>cuffTopB", "cuffTopB>neckB", "neckB>neckA"]
    sides = [["cuffBotA>hemA"], ["hemB>cuffBotB"]]
    if cfg.get("arm"):
        # con axila marcada, el costado se empareja en dos tramos (bajo la manga y cuerpo): si no,
        # delantero y espalda se descuadran y la textura se retuerce
        keys += ["armA", "armB"]
        b_pts += cfg["arm"]["back"]
        f_pts += cfg["arm"]["front"]
        f_order += ["armB", "armA"]
        seams = [("neckA", "cuffTopA"), ("cuffBotA", "armA"), ("armA", "hemA"), ("hemB", "armB"), ("armB", "cuffBotB"), ("cuffTopB", "neckB")]
        order = ["neckA>cuffTopA", "cuffTopA>cuffBotA", "cuffBotA>armA", "armA>hemA", "hemA>hemB", "hemB>armB", "armB>cuffBotB", "cuffBotB>cuffTopB", "cuffTopB>neckB", "neckB>neckA"]
        sides = [["cuffBotA>armA", "armA>hemA"], ["hemB>armB", "armB>cuffBotB"]]
    bi = dict(zip(keys, snap(back_c, b_pts)))
    fi = dict(zip(f_order, snap(front_c, f_pts)))

    neck_f = (
        np.array(cfg["neck"], float)
        if cfg["neck"]
        else front_neckline(front_img, front_c[fi["neckB"]], front_c[fi["neckA"]])
    )
    neck_f[0], neck_f[-1] = front_c[fi["neckB"]], front_c[fi["neckA"]]

    # el frontal se trabaja espejado para compartir sistema de referencia con la espalda
    mirror = lambda p: np.c_[W - 1 - p[:, 0], p[:, 1]]  # noqa: E731
    f_land = mirror(np.array([front_c[fi[k]] for k in keys], float))
    b_land = np.array([back_c[bi[k]] for k in keys], float)
    M, _ = cv2.estimateAffinePartial2D(f_land.astype(np.float32), b_land.astype(np.float32), method=cv2.LMEDS)
    align = lambda p: mirror(p) @ M[:, :2].T + M[:, 2]  # noqa: E731  foto frontal -> marco común

    def segs(contour, idx, pairs, tf=lambda p: p):
        return {a + ">" + b: tf(arc(contour, idx[a], idx[b])) for a, b in pairs}

    b_seam, f_seam_px = segs(back_c, bi, seams), segs(front_c, fi, seams)
    top = back_c[:, 1].min()
    px_per_m = (back_c[:, 1].max() - top) / SHIRT_HEIGHT
    h = EDGE * px_per_m

    # costuras: media de ambos contornos, remuestreadas con el mismo número de puntos
    seam, ctrl_b, ctrl_f_px, ctrl_avg = {}, [], [], []
    for key in b_seam:
        fa = align(f_seam_px[key])
        n = max(2, round((length(b_seam[key]) + length(fa)) / 2 / h))
        rb, rf_px = resample(b_seam[key], n), resample(f_seam_px[key], n)
        seam[key] = (rb + align(rf_px)) / 2
        # el tramo bajo la manga corre pegado al costado del cuerpo: como punto de control de la
        # deformación haría que dos líneas casi superpuestas tirasen en sentidos distintos
        if "cuffBot" in key and "arm" in key:
            continue
        ctrl_b.append(rb)
        ctrl_f_px.append(rf_px)
        ctrl_avg.append(seam[key])
    avg = np.vstack(ctrl_avg)
    ctrl_b, ctrl_f_px = np.vstack(ctrl_b), np.vstack(ctrl_f_px)
    _, uniq = np.unique(avg.round(1), axis=0, return_index=True)
    tps = lambda src, dst: RBFInterpolator(src[uniq], dst[uniq], kernel="thin_plate_spline", smoothing=2.0)  # noqa: E731
    warp_b, warp_f = tps(ctrl_b, avg), tps(align(ctrl_f_px), avg)
    unwarp_b, unwarp_f = tps(avg, ctrl_b), tps(avg, ctrl_f_px)  # marco común -> píxel de cada foto

    b_open = segs(back_c, bi, OPENINGS, warp_b)
    f_open = segs(front_c, fi, OPENINGS, lambda p: warp_f(align(p)))
    f_open["neckB>neckA"] = warp_f(align(neck_f))

    # polígono de cada panel recorriendo: hombroA, puñoA, costadoA, bajo, costadoB, puñoB, hombroB, cuello
    verts, key_of = [], {}

    def vid(p, key=None):
        if key in key_of:
            return key_of[key]
        verts.append(p)
        if key is not None:
            key_of[key] = len(verts) - 1
        return len(verts) - 1

    # los hombros se cosen directamente (vértices compartidos); los costados se unen con un fuelle
    rk = lambda p: (round(float(p[0]), 2), round(float(p[1]), 2))  # noqa: E731
    shoulder = {rk(p) for key in ("neckA>cuffTopA", "cuffTopB>neckB") for p in seam[key]}

    panels = {}
    for name, opening, unwarp in (("back", b_open, unwarp_b), ("front", f_open, unwarp_f)):
        loop, loop_ids, neck_ids = [], [], []
        for key in order:
            if key in seam:
                pts = seam[key]
            else:
                o = opening[key]
                # cada abertura se recorre en el sentido del polígono: si llega al revés, al anclar sus
                # extremos cruzaría el hueco de lado a lado (dos tiras de tela atravesando el cuello)
                if np.linalg.norm(o[0] - seam[order[order.index(key) - 1]][-1]) > np.linalg.norm(o[-1] - seam[order[order.index(key) - 1]][-1]):
                    o = o[::-1].copy()
                o[0], o[-1] = seam[order[order.index(key) - 1]][-1], seam[order[(order.index(key) + 1) % len(order)]][0]
                pts = resample(o, max(2, round(length(o) / h)))
            for p in pts[:-1]:
                loop.append(p)
                loop_ids.append(vid(p, rk(p) if rk(p) in shoulder else (name, rk(p))))
                if key == "neckB>neckA":
                    neck_ids.append(loop_ids[-1])
        loop = np.array(loop)
        poly = loop.astype(np.float32).reshape(-1, 1, 2)
        x0, y0 = loop.min(axis=0)
        x1, y1 = loop.max(axis=0)
        grid = []
        for r, y in enumerate(np.arange(y0, y1, h * 0.866)):
            for x in np.arange(x0 + (h / 2 if r % 2 else 0), x1, h):
                if cv2.pointPolygonTest(poly, (float(x), float(y)), True) > h * 0.55:
                    grid.append((x, y))
        grid = np.array(grid)
        ids = np.array(loop_ids + [vid(p) for p in grid])
        pts = np.vstack([loop, grid])
        tris = []
        for t in Delaunay(pts).simplices:
            c = pts[t].mean(axis=0)
            if cv2.pointPolygonTest(poly, (float(c[0]), float(c[1])), False) > 0:
                tris.append(t)
        tris = np.array(tris)
        photo = unwarp(pts)  # píxel en la foto original de este panel
        panels[name] = dict(ids=ids, tris=tris, photo=photo, neck=neck_ids)
        print(kit, name, "verts", len(pts), "tris", len(tris))

    # fuelle lateral: una tira entre delantero y espalda a lo largo de cada costado. En el patrón
    # ocupa el mismo sitio que la costura; su anchura real la pone la simulación (eje de profundidad).
    ROWS = 6
    photo_uv = lambda px, side: np.c_[0.5 * side + 0.5 * (px[:, 0] - crop["x"]) / crop["w"], 1 - (px[:, 1] - crop["y"]) / crop["h"]]  # noqa: E731
    gusset = dict(faces=[], uvs=[], t={}, seams=[])
    for side in sides:
        pts = np.vstack([seam[k][(1 if i else 0) :] for i, k in enumerate(side)])
        # textura: la franja lisa del costado en la foto de espalda, estirada a lo ancho del fuelle
        edge_px = unwarp_b(pts)
        inward = np.sign(W / 2 - edge_px[:, 0].mean())
        uv = [photo_uv(edge_px + [inward * (5 + 24 * (1 - r / ROWS)), 0], 1) for r in range(ROWS + 1)]
        grid = []
        for p in pts:
            row = [key_of[("front", rk(p))]] + [vid(p) for _ in range(ROWS - 1)] + [key_of[("back", rk(p))]]
            for r, i in enumerate(row):
                gusset["t"][i] = r / ROWS
            grid.append(row)
        gusset["seams"].append([row[0] for row in grid])
        for i in range(len(pts) - 1):
            for r in range(ROWS):
                quad = [(i, r), (i + 1, r), (i + 1, r + 1), (i, r + 1)]
                for tri in ((0, 1, 2), (0, 2, 3)):
                    gusset["faces"].append([grid[quad[c][0]][quad[c][1]] for c in tri])
                    gusset["uvs"].append([uv[quad[c][1]][quad[c][0]].round(5).tolist() for c in tri])

    verts = np.array(verts)
    cx = (verts[:, 0].min() + verts[:, 0].max()) / 2
    xy = np.c_[(verts[:, 0] - cx) / px_per_m, -(verts[:, 1] - top) / px_per_m]

    out = dict(verts=xy.round(5).tolist(), panels={})
    for side, name in enumerate(("front", "back")):
        p = panels[name]
        uv = photo_uv(p["photo"], side)
        out["panels"][name] = dict(
            faces=p["ids"][p["tris"]].tolist(),
            uvs=uv[p["tris"]].round(5).tolist(),
            ids=p["ids"].tolist(),
            neck=p["neck"],
        )
    out["gusset"] = dict(faces=gusset["faces"], uvs=gusset["uvs"], ids=list(gusset["t"]), t=list(gusset["t"].values()), seams=gusset["seams"])
    (BUILD / f"panels-{kit}.json").write_text(json.dumps(out))

    # ---------------------------------------------------------------- texturas
    def texture(img, mask):
        img = delight(img, mask, cfg["delight"])
        # el color del tejido se extiende hacia fuera del contorno. Se toma de bien dentro y sin
        # píxeles sueltos: el borde de la foto está mezclado con el fondo blanco, y una costura que
        # cayera ahí salía moteada de blanco
        inside = cv2.erode(mask, np.ones((13, 13), np.uint8)) > 0
        _, (iy, ix) = distance_transform_edt(~inside, return_indices=True)
        bled = np.where(inside[..., None], img, cv2.medianBlur(img, 9)[iy, ix])
        c = crop
        cut = bled[c["y"] : c["y"] + c["h"], c["x"] : c["x"] + c["w"]]
        big = cv2.resize(cut, (c["w"] * TEX, c["h"] * TEX), interpolation=cv2.INTER_LANCZOS4)
        blur = cv2.GaussianBlur(big, (0, 0), 1.6)
        return cv2.addWeighted(big, 1.45, blur, -0.45, 0)

    def cutout(img, mask):
        """Foto original recortada con transparencia, para las tarjetas de compartir."""
        a = cv2.GaussianBlur(cv2.erode(mask, np.ones((3, 3), np.uint8)), (0, 0), 0.8)
        rgba = np.dstack([img, a])[crop["y"] : crop["y"] + crop["h"], crop["x"] : crop["x"] + crop["w"]]
        return cv2.resize(rgba, (round(600 * crop["w"] / crop["h"]), 600), interpolation=cv2.INTER_AREA)

    kit_dir = ROOT / "public" / "kit"
    og_dir = ROOT / "src" / "assets" / "og"
    kit_dir.mkdir(parents=True, exist_ok=True)
    og_dir.mkdir(parents=True, exist_ok=True)
    for name, img, mask in (("front", front_img, front_mask), ("back", back_img, back_mask)):
        tex = texture(img, mask)
        if name == "front" and cfg.get("crest"):
            tex = sharpen_crest(tex, img, cfg["crest"], crop)
        cv2.imwrite(str(kit_dir / f"{kit}-{name}.webp"), tex, [cv2.IMWRITE_WEBP_QUALITY, 90])
        cv2.imwrite(str(og_dir / f"{kit}-{name}.png"), cutout(img, mask))
        cv2.imwrite(str(BUILD / f"tex-{kit}-{name}.jpg"), cv2.resize(tex, (1024, 1024), interpolation=cv2.INTER_AREA))
    # atlas pecho|espalda para las vistas previas de Blender
    halves = [cv2.imread(str(BUILD / f"tex-{kit}-{n}.jpg")) for n in ("front", "back")]
    cv2.imwrite(str(BUILD / f"atlas-{kit}.jpg"), np.hstack(halves), [cv2.IMWRITE_JPEG_QUALITY, 90])

    # comprobación visual del patrón
    dbg = np.full((H, W, 3), 255, np.uint8)
    for name, col in (("back", (180, 60, 20)), ("front", (20, 60, 200))):
        p = panels[name]
        for t in p["tris"]:
            cv2.polylines(dbg, [verts[p["ids"][t]].astype(np.int32).reshape(-1, 1, 2)], True, col, 1, cv2.LINE_AA)
    cv2.imwrite(str(BUILD / f"pattern-{kit}.png"), dbg)

    # dónde se estampan nombre y dorsal: centrados en el cuello, a una distancia fija de su borde
    return dict(
        crop=crop,
        lining=cfg["lining"],
        text=dict(cx=cfg.get("text_cx", round(float(b_land[0, 0] + b_land[7, 0]) / 2, 1)), top=int(top), ppm=round(float(px_per_m), 1), ink=cfg["ink"], edge=cfg["edge"]),
    )


if __name__ == "__main__":
    BUILD.mkdir(exist_ok=True)
    info_path = ROOT / "src" / "data" / "kit.json"
    info = json.loads(info_path.read_text()) if info_path.exists() else {}
    info = {k: v for k, v in info.items() if k in KITS}
    for kit in sys.argv[1:] or KITS:
        info[kit] = build(kit, KITS[kit])
    info_path.write_text(json.dumps(info, indent=2) + "\n")
