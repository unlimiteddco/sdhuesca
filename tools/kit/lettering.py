"""Serigrafía: prepara las cifras del dorsal y la tipografía del nombre de un club.

Uso: python tools/kit/lettering.py [--club <club>]   (configuración: clubs/<club>/club.json → lettering)

  cifras  Los dibujos de la vista previa de la tienda oficial, en clubs/<club>/fotos/dorsal/:
          N.svg  trazados con borde y escudo a una tinta; el visor los pinta con los colores de
                 cada equipación -> public/kit/dorsal.json
          <kit>/N.png  imágenes ya coloreadas, una serie por equipación -> public/kit/dorsal/<kit>/N.png
                 y su índice public/kit/dorsal.json
  nombre  Una o varias fuentes libres (OFL) fijadas en el ancho y el grosor que igualan la letra
          oficial -> fonts/*.woff2 (web), og/*.ttf y sus avances og/*.json (tarjetas de compartir)
"""
import json
import re
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
CLUB = sys.argv[sys.argv.index("--club") + 1] if "--club" in sys.argv else "huesca"
DIR = ROOT / "clubs" / CLUB
CFG = json.loads((DIR / "club.json").read_text())["lettering"]
NUM = re.compile(r"-?\d*\.?\d+(?:e-?\d+)?")


def points(d):
    """Puntos por los que pasa un trazado (órdenes absolutas M L C H V), para medir su caja."""
    out, x, y = [], 0.0, 0.0
    for cmd, args in re.findall(r"([MLCHVZ])([^MLCHVZ]*)", d):
        v = [float(n) for n in NUM.findall(args)]
        if cmd == "H":
            for n in v:
                x = n
                out.append((x, y))
        elif cmd == "V":
            for n in v:
                y = n
                out.append((x, y))
        else:
            for i in range(0, len(v) - 1, 2):
                x, y = v[i], v[i + 1]
                out.append((x, y))
    return out


def box(paths):
    pts = [p for d in paths for p in points(d)]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def digits():
    raw = {}
    for n in range(10):
        svg = (DIR / "fotos" / "dorsal" / f"{n}.svg").read_text()
        raw[n] = dict(
            width=float(re.search(r'<svg width="([\d.]+)"', svg).group(1)),
            height=float(re.search(r'height="([\d.]+)"', svg).group(1)),
            paths=re.findall(r"<path ([^>]*?)/?>", svg),
        )
    attr = lambda p, name: (re.search(rf'{name}="([^"]*)"', p) or [None, None])[1]  # noqa: E731
    short = lambda d: NUM.sub(lambda m: f"{float(m.group(0)):.1f}".rstrip("0").rstrip("."), d)  # noqa: E731
    # El escudo es el mismo dibujo en todas las cifras, colocado en la base de cada una: se guarda
    # una sola vez (el del 0) y, por cifra, dónde va. El 9 lo trae a línea fina y casi no se ve.
    crest = [attr(p, "d") for p in raw[0]["paths"][2:]]
    centre = lambda b: ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)  # noqa: E731
    cx0, cy0 = centre(box(crest))
    out = dict(kind="svg", crest="".join(short(d) for d in crest), digits={})
    for n, g in raw.items():
        b = box([attr(p, "d") for p in g["paths"][2:]])
        cx, cy = centre(b)
        print(n, "escudo", round(b[2] - b[0], 1), "x", round(b[3] - b[1], 1), "en", round(cx, 1), round(cy, 1))
        out["digits"][str(n)] = dict(
            w=g["width"], h=g["height"], edge=short(attr(g["paths"][0], "d")), ink=short(attr(g["paths"][1], "d")),
            crest=[round(cx - cx0, 1), round(cy - cy0, 1)],
        )
    path = DIR / "public" / "kit" / "dorsal.json"
    path.write_text(json.dumps(out, separators=(",", ":")))
    print("cifras", path.stat().st_size // 1024, "KB")


def png_digits(height=760):
    """Cifras ya coloreadas, una serie por equipación (fotos/dorsal/<kit>/N.png): se reducen a un
    alto de sobra para la textura (se dibujan a unos 420 px de foto) y se guardan en WebP con
    transparencia, que pesa una décima parte que el PNG."""
    from PIL import Image

    index = dict(kind="png", kits={})
    for kit_dir in sorted(p for p in (DIR / "fotos" / "dorsal").iterdir() if p.is_dir()):
        out_dir = DIR / "public" / "kit" / "dorsal" / kit_dir.name
        out_dir.mkdir(parents=True, exist_ok=True)
        digits = {}
        for n in range(10):
            img = Image.open(kit_dir / f"{n}.png").convert("RGBA")
            img = img.resize((round(img.width * height / img.height), height), Image.LANCZOS)
            img.save(out_dir / f"{n}.webp", quality=90, method=6)
            digits[str(n)] = dict(w=img.width, h=img.height, src=f"/kit/dorsal/{kit_dir.name}/{n}.webp")
        index["kits"][kit_dir.name] = dict(digits=digits)
        print("cifras", kit_dir.name, sum((out_dir / f"{n}.webp").stat().st_size for n in range(10)) // 1024, "KB")
    (DIR / "public" / "kit" / "dorsal.json").write_text(json.dumps(index, separators=(",", ":")))


def fonts():
    """Cada letra de serigrafía del club: una fuente libre (OFL) fijada en el ancho y el grosor que
    igualan la oficial."""
    for spec in CFG["fonts"]:
        src = spec["source"]
        f = instancer.instantiateVariableFont(TTFont(ROOT / src["file"]), src["axes"])
        family = spec["family"]
        for rec in f["name"].names:
            if rec.nameID in (1, 4, 16):
                rec.string = family
            elif rec.nameID == 6:
                rec.string = family.replace(" ", "")
            elif rec.nameID in (2, 17):
                rec.string = "Regular"
        f["OS/2"].usWeightClass = 400
        f.flavor = None
        (DIR / spec["file"]).parent.mkdir(parents=True, exist_ok=True)
        f.save(DIR / spec["file"])
        f.flavor = "woff2"
        (DIR / spec["web"]).parent.mkdir(parents=True, exist_ok=True)
        f.save(DIR / spec["web"])
        cmap, hmtx, upm = f.getBestCmap(), f["hmtx"], f["head"].unitsPerEm
        adv = {chr(c): round(hmtx[g][0] / upm, 4) for c, g in cmap.items() if 32 <= c < 0x250}
        (DIR / spec["advances"]).write_text(json.dumps(adv, ensure_ascii=False, separators=(",", ":")))
        print(family, "· mayúsculas", round(f["OS/2"].sCapHeight / upm, 3), "· glifos", len(adv))


if __name__ == "__main__":
    digits() if CFG["numbers"] == "svg" else png_digits()
    fonts()
