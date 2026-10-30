"""Paso 1: de las fotos de producto al patrón de cada camiseta.

Para cada kit del club (campo, portero) lee su foto de pecho y de espalda y genera:
  build/<club>/panels-<kit>.json      malla 2D (delantero + espalda + fuelles) con UV
  clubs/<club>/public/kit/<kit>-*.webp  texturas recortadas, sin fondo y sin sombras de estudio
  clubs/<club>/og/<kit>-*.png          recortes para las imágenes de compartir
  clubs/<club>/kit.json                recorte y posición del nombre y el dorsal de cada kit

Uso: python tools/kit/prep.py [--club <club>] [kit ...]   (necesita numpy, opencv, scipy, pillow)
Los kits se configuran en clubs/<club>/kits.py. Para uno nuevo: python tools/kit/outline.py <foto>
y anotar allí sus puntos clave.
"""
import importlib.util
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
CLUBS = ROOT / "clubs"
# club de trabajo: --club <club> (por defecto, huesca). Fotos en clubs/<club>/fotos; intermedios en build/<club>
CLUB = sys.argv[sys.argv.index("--club") + 1] if "--club" in sys.argv else "huesca"
BUILD = HERE / "build" / CLUB
SRC = CLUBS / CLUB / "fotos"
SHIRT_HEIGHT = 0.775  # metros, del cuello al bajo de la espalda
EDGE = 0.0085  # metros, tamaño de triángulo
TEX = 2  # px de textura por px de foto

# Puntos clave marcados a ojo sobre cada foto (se ajustan al contorno más cercano).
# Lado A = izquierda de la foto de espalda (brazo izquierdo del jugador).
KEYS = ["neckA", "cuffTopA", "cuffBotA", "hemA", "hemB", "cuffBotB", "cuffTopB", "neckB"]
SEAMS = [("neckA", "cuffTopA"), ("cuffBotA", "hemA"), ("hemB", "cuffBotB"), ("cuffTopB", "neckB")]
OPENINGS = [("cuffTopA", "cuffBotA"), ("hemA", "hemB"), ("cuffBotB", "cuffTopB"), ("neckB", "neckA")]

def load_kits(club):
    """Equipaciones del club: clubs/<club>/kits.py define KITS (fotos, puntos clave, retoques)."""
    spec = importlib.util.spec_from_file_location(f"kits_{club}", CLUBS / club / "kits.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.KITS




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
    liso del tejido: la luz y las sombras las pone después el motor 3D sobre la malla real.
    Con sigma 0 no se toca: fotos de luz plana, o tejidos sin color (blanco, negro) en los que
    la luminancia no distingue sombra de tela."""
    if not sigma:
        return img
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
    back_mask, back_c = shirt_mask(back_img, cfg["cuts"]["back"], cfg.get("close", 9))
    front_mask, front_c = shirt_mask(front_img, cfg["cuts"]["front"], cfg.get("close", 9))
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
    top_cfg = cfg.get("sleeve_top")

    def sleeve_seam(key):
        """Tramo de la costura del hombro que recorre la manga: puntos del puño hacia dentro y su
        distancia al puño. El último es el primer punto que sigue cosido (donde acaba la franja)."""
        pts = seam[key] if key.startswith("cuffTop") else seam[key][::-1]
        d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
        n = int(np.searchsorted(d, top_cfg["length"] * px_per_m)) if top_cfg else 0
        return pts[: n + 1], d[: n + 1]

    shoulder = set()
    for key in ("neckA>cuffTopA", "cuffTopB>neckB"):
        open_part = {rk(p) for p in sleeve_seam(key)[0][:-1]} if top_cfg else set()
        shoulder |= {rk(p) for p in seam[key]} - open_part

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

    # franja superior de cada manga: va del borde del delantero al de la espalda y se estrecha
    # hasta desaparecer donde el hombro vuelve a ir cosido. Su textura ocupa una esquina libre de
    # la foto delantera (el hueco bajo cada manga, fuera de la silueta): a la izquierda la de la
    # manga A y a la derecha la de la B.
    tops, top_rects = [], {}
    if top_cfg:
        ROWS_TOP = 10
        rw, pad = top_cfg["width"] * px_per_m, 60
        for name, key in (("A", "neckA>cuffTopA"), ("B", "cuffTopB>neckB")):
            pts, d = sleeve_seam(key)
            where = top_cfg.get("rects", {}).get(name)
            rect = dict(x=where[0], y=where[1], w=rw, h=float(d[-1])) if where else dict(x=pad if name == "A" else W - pad - rw, y=525.0, w=rw, h=float(d[-1]))
            top_rects[name] = rect
            # misma ley de ancho que la separación de los paneles en la simulación
            taper = np.clip((d[-1] - d) / (0.07 * px_per_m), 0, 1)
            taper = taper * taper * (3 - 2 * taper)
            grid = []
            for i, p in enumerate(pts):
                if i == len(pts) - 1:
                    row = [key_of[rk(p)]] * (ROWS_TOP + 1)
                else:
                    row = [key_of[("front", rk(p))]] + [vid(p) for _ in range(ROWS_TOP - 1)] + [key_of[("back", rk(p))]]
                    for r, i_v in enumerate(row):
                        gusset["t"][i_v] = r / ROWS_TOP
                grid.append(row)
            uv = lambda i, r: photo_uv(np.array([[rect["x"] + rw * (0.5 + (r / ROWS_TOP - 0.5) * taper[i]), rect["y"] + d[-1] - d[i]]]), 0)[0]  # noqa: E731
            for i in range(len(pts) - 1):
                for r in range(ROWS_TOP):
                    quad = [(i, r), (i + 1, r), (i + 1, r + 1), (i, r + 1)]
                    for tri in ((0, 1, 2), (0, 2, 3)):
                        gusset["faces"].append([grid[quad[c][0]][quad[c][1]] for c in tri])
                        gusset["uvs"].append([uv(*quad[c]).round(5).tolist() for c in tri])
            tops.append([row[0] for row in grid])

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
    if top_cfg:
        to_m = lambda p: [round(float((p[0] - cx) / px_per_m), 5), round(float(-(p[1] - top) / px_per_m), 5)]  # noqa: E731
        out["sleeve_tops"] = dict(seams=tops, width=top_cfg["width"])
        # línea completa de hombros (la percha la sigue aunque parte ya no vaya cosida)
        out["shoulder_line"] = [to_m(p) for key in ("neckA>cuffTopA", "cuffTopB>neckB") for p in seam[key]]
    (BUILD / f"panels-{kit}.json").write_text(json.dumps(out))

    # ---------------------------------------------------------------- texturas
    def texture(img, mask, exclude=None):
        img = delight(img, mask, cfg["delight"])
        # el color del tejido se extiende hacia fuera del contorno. Se toma de bien dentro y sin
        # píxeles sueltos: el borde de la foto está mezclado con el fondo blanco, y una costura que
        # cayera ahí salía moteada de blanco
        inside = cv2.erode(mask, np.ones((13, 13), np.uint8)) > 0
        # las rendijas de fondo que la silueta engloba (entre la manga y el cuerpo, en la axila)
        # tampoco son tela: sin esto la axila salía con una cuña blanca
        bg = float(np.median(np.r_[img[0].min(axis=1), img[-1].min(axis=1), img[:, 0].min(axis=1), img[:, -1].min(axis=1)]))
        n, labels = cv2.connectedComponents((img.min(axis=2) >= max(236, bg - 6)).astype(np.uint8))
        border = np.unique(np.r_[labels[0], labels[-1], labels[:, 0], labels[:, -1]])
        inside &= cv2.dilate(np.isin(labels, border[border > 0]).astype(np.uint8), np.ones((7, 7), np.uint8)) == 0
        if exclude is not None:
            inside &= ~exclude
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

    mask_of = lambda img: front_mask if img is front_img else back_mask  # noqa: E731

    def sleeve_logos():
        """(manga, distancia al puño en m, tamaño en m) de cada logo de la cara exterior de las mangas."""
        if "synth" in top_cfg:
            return [(side, lg["at"], lg["size"]) for side, lg in top_cfg["synth"]["logos"].items()]
        pc = top_cfg["patch"]
        return [("B", pc["at"], pc["size"])]

    def patch_remains(img, unwarp):
        """Los logos de la cara exterior de la manga asoman de canto en el borde de las fotos de frente
        y de espalda. Con la franja ya van enteros: esos restos se tapan con la tela de al lado."""
        odd = np.zeros(img.shape[:2], bool)
        for side, at, size in sleeve_logos():
            pts, d = sleeve_seam("neckA>cuffTopA" if side == "A" else "cuffTopB>neckB")
            keep = np.abs(d - at * px_per_m) < (size / 2 + 0.02) * px_per_m
            zone = np.zeros(img.shape[:2], np.uint8)
            cv2.polylines(zone, [unwarp(pts[keep]).astype(np.int32).reshape(-1, 1, 2)], False, 255, 90)
            inside = (zone > 0) & (mask_of(img) > 0)
            # lo que no es tela: lejos del color dominante de la zona
            fabric = np.median(img[inside].reshape(-1, 3), axis=0)
            odd |= inside & (np.abs(img.astype(int) - fabric).sum(axis=2) > 70)
        return cv2.dilate(odd.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0

    def synth_strip(tex, name, target, tw, th, t):
        """Franja compuesta: la tela de la manga, las tres rayas que bajan del hombro y el logo."""
        sy = top_cfg["synth"]
        strip = np.empty((th, tw, 3), np.float32)
        strip[:] = target
        rng = np.random.default_rng(7)
        strip += cv2.GaussianBlur(rng.normal(0, 3.0, (th, tw)).astype(np.float32), (0, 0), 1.2)[..., None]
        logo_cfg = sy["logos"][name]
        st = sy["stripes"]
        # las rayas arrancan encima del logo de esa manga
        start = max(st["start"], logo_cfg["at"] + logo_cfg["size"] / 2 + 0.012)
        sw, gap = st["width"] * px_per_m * TEX, st["gap"] * px_per_m * TEX
        total = 3 * sw + 2 * gap
        rows = t > start * px_per_m
        for k in range(3):
            x0 = tw / 2 - total / 2 + k * (sw + gap)
            cols = np.arange(tw)
            cover = np.clip(np.minimum(cols + 1 - x0, x0 + sw - cols), 0, 1)  # borde suave de 1 px
            strip[rows] = strip[rows] * (1 - cover[None, :, None]) + np.array(st["color"], np.float32) * cover[None, :, None]
        logo = cv2.imread(str(SRC / logo_cfg["photo"]), cv2.IMREAD_UNCHANGED)
        h = round(logo_cfg["size"] * px_per_m * TEX)
        w = round(h * logo.shape[1] / logo.shape[0])
        logo = cv2.resize(logo, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32)
        if name == "B":  # en esa manga el delantero (columna 0) queda a la derecha de quien la mira
            logo = logo[:, ::-1]
        y0, x0 = round((t[0] - logo_cfg["at"] * px_per_m) * TEX - h / 2), round(tw / 2 - w / 2)
        a = logo[..., 3:] / 255
        area = strip[y0 : y0 + h, x0 : x0 + w]
        area[:] = area * (1 - a) + logo[..., :3] * a
        return np.clip(strip, 0, 255)

    def paste_tops(tex):
        """Pinta las dos franjas en su hueco de la textura delantera."""
        pts, d = sleeve_seam("neckA>cuffTopA")
        tw, th = round(top_rects["A"]["w"] * TEX), round(d[-1] * TEX)
        # fila 0 = donde acaba la franja (hombro); última fila = puño. Columna 0 = lado del delantero
        t = d[-1] - (np.arange(th) + 0.5) / TEX
        # tono de referencia: la tela de la propia manga junto a la costura, sin contar los logos
        inward = np.sign(W / 2 - pts[:, 0].mean())
        near = np.vstack([pts[:-1] + [inward * k, 4] for k in (14, 20, 26, 32)])
        at = ((unwarp_f(near) - (crop["x"], crop["y"])) * TEX).astype(int)
        seen = np.array([tex[y, x] for x, y in at if 0 <= y < tex.shape[0] and 0 <= x < tex.shape[1]]).astype(np.float32)
        target = np.median(seen[np.abs(seen - np.median(seen, axis=0)).sum(axis=1) < 60], axis=0)
        if "synth" in top_cfg:
            return place_tops(tex, {name: synth_strip(tex, name, target, tw, th, t) for name in ("A", "B")})
        side = cv2.imread(str(SRC / top_cfg["side"]))
        u = ((np.arange(tw) + 0.5) / tw - 0.5) * 2 * top_cfg["band"]
        mx = (top_cfg["centre"] + u)[None, :].repeat(th, 0).astype(np.float32)
        my = (top_cfg["cuff"] - t)[:, None].repeat(tw, 1).astype(np.float32)
        strip = cv2.remap(side, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
        # se iguala a la tela de la manga en la textura (ya sin el sombreado de estudio)
        gray = cv2.GaussianBlur(strip.mean(axis=2), (0, 0), 18 * TEX)
        strip *= (np.median(gray) / gray)[..., None]
        strip = np.clip(strip * (target / np.median(strip.reshape(-1, 3), axis=0)), 0, 255)
        print("franja de manga: tono", target.round(), "desde", np.median(strip.reshape(-1, 3), axis=0).round())

        # parche: su elipse en el primer plano pasa a círculo. Va reflejado porque en esa manga el
        # delantero (columna 0) queda a la derecha de quien la mira.
        pc = top_cfg["patch"]
        photo = cv2.imread(str(SRC / pc["photo"]))
        size = round(pc["size"] * px_per_m * TEX)
        g = (np.arange(size) + 0.5) / size * 2 - 1
        gx, gy = np.meshgrid(g, g)
        patch = cv2.remap(photo, (pc["centre"][0] - gx * pc["radius"][0]).astype(np.float32), (pc["centre"][1] + gy * pc["radius"][1]).astype(np.float32), cv2.INTER_AREA)
        alpha = np.clip((0.985 - np.hypot(gx, gy)) * size / 3, 0, 1)[..., None]
        with_patch = strip.copy()
        y0, x0 = round((d[-1] - pc["at"] * px_per_m) * TEX - size / 2), round(tw / 2 - size / 2)
        area = with_patch[y0 : y0 + size, x0 : x0 + size]
        area[:] = area * (1 - alpha) + patch * alpha

        return place_tops(tex, {"A": strip, "B": with_patch})

    def place_tops(tex, strips):
        m = 8  # margen repetido alrededor: que el filtrado de la textura no traiga colores de fuera
        for name, img in strips.items():
            r = top_rects[name]
            assert not cv2.dilate(front_mask, np.ones((25, 25), np.uint8))[int(r["y"]) : int(r["y"] + r["h"]), int(r["x"]) : int(r["x"] + r["w"])].any(), "la franja pisa la camiseta"
            x, y = round((r["x"] - crop["x"]) * TEX), round((r["y"] - crop["y"]) * TEX)
            block = cv2.copyMakeBorder(img.astype(np.uint8), m, m, m, m, cv2.BORDER_REPLICATE)
            tex[y - m : y - m + block.shape[0], x - m : x - m + block.shape[1]] = block
        return tex

    kit_dir = CLUBS / CLUB / "public" / "kit"
    og_dir = CLUBS / CLUB / "og"
    kit_dir.mkdir(parents=True, exist_ok=True)
    og_dir.mkdir(parents=True, exist_ok=True)
    for name, img, mask in (("front", front_img, front_mask), ("back", back_img, back_mask)):
        tex = texture(img, mask, patch_remains(img, unwarp_f if name == "front" else unwarp_b) if top_cfg else None)
        if name == "front" and cfg.get("crest"):
            tex = sharpen_crest(tex, img, cfg["crest"], crop)
        if name == "front" and top_cfg:
            tex = paste_tops(tex)
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
        text=dict(
            cx=cfg.get("text_cx", round(float(b_land[0, 0] + b_land[7, 0]) / 2, 1)), top=int(top), ppm=round(float(px_per_m), 1), ink=cfg["ink"], edge=cfg["edge"],
            **({"lettering": cfg["lettering"]} if "lettering" in cfg else {}),
        ),
    )


if __name__ == "__main__":
    BUILD.mkdir(parents=True, exist_ok=True)
    KITS = load_kits(CLUB)
    info_path = CLUBS / CLUB / "kit.json"
    info = json.loads(info_path.read_text()) if info_path.exists() else {}
    info = {k: v for k, v in info.items() if k in KITS}
    wanted = [a for a in sys.argv[1:] if a in KITS]
    for kit in wanted or KITS:
        info[kit] = build(kit, KITS[kit])
    info_path.write_text(json.dumps(info, indent=2) + "\n")
