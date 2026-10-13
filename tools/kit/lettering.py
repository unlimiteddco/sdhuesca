"""Serigrafía: prepara las cifras del dorsal y la tipografía del nombre.

Uso: python tools/kit/lettering.py

  cifras  tools/kit/src/dorsal/N.svg -> public/kit/dorsal.json
          Son los dibujos que usa la vista previa de la tienda oficial: cada cifra trae su
          borde y el escudo a una tinta dentro del trazo. El visor los pinta con los colores
          de cada equipación (tinta y borde).
  nombre  Archivo (SIL OFL) condensada al máximo y con el grosor ajustado a la letra oficial
          -> src/assets/fonts/archivo-dorsal.woff2 (web), src/assets/og/ArchivoDorsal.ttf y
          src/assets/og/dorsal-advances.json (tarjetas de compartir)
"""
import json
import re
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
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
        svg = (HERE / "src" / "dorsal" / f"{n}.svg").read_text()
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
    out = dict(crest="".join(short(d) for d in crest), digits={})
    for n, g in raw.items():
        b = box([attr(p, "d") for p in g["paths"][2:]])
        cx, cy = centre(b)
        print(n, "escudo", round(b[2] - b[0], 1), "x", round(b[3] - b[1], 1), "en", round(cx, 1), round(cy, 1))
        out["digits"][str(n)] = dict(
            w=g["width"], h=g["height"], edge=short(attr(g["paths"][0], "d")), ink=short(attr(g["paths"][1], "d")),
            crest=[round(cx - cx0, 1), round(cy - cy0, 1)],
        )
    path = ROOT / "public" / "kit" / "dorsal.json"
    path.write_text(json.dumps(out, separators=(",", ":")))
    print("cifras", path.stat().st_size // 1024, "KB")


def font():
    src = ROOT / "node_modules" / "@fontsource-variable" / "archivo" / "files" / "archivo-latin-wdth-normal.woff2"
    # ancho 62 (el mínimo) y grosor 765: mismo ancho medio y mismo grueso de asta que la letra oficial
    f = instancer.instantiateVariableFont(TTFont(src), {"wdth": 62, "wght": 765})
    for rec in f["name"].names:
        if rec.nameID in (1, 4, 16):
            rec.string = "Archivo Dorsal"
        elif rec.nameID == 6:
            rec.string = "ArchivoDorsal"
        elif rec.nameID in (2, 17):
            rec.string = "Regular"
    f["OS/2"].usWeightClass = 400
    f.flavor = None
    f.save(ROOT / "src" / "assets" / "og" / "ArchivoDorsal.ttf")
    f.flavor = "woff2"
    f.save(ROOT / "src" / "assets" / "fonts" / "archivo-dorsal.woff2")
    cmap, hmtx, upm = f.getBestCmap(), f["hmtx"], f["head"].unitsPerEm
    adv = {chr(c): round(hmtx[g][0] / upm, 4) for c, g in cmap.items() if 32 <= c < 0x250}
    (ROOT / "src" / "assets" / "og" / "dorsal-advances.json").write_text(json.dumps(adv, ensure_ascii=False, separators=(",", ":")))
    print("letra: mayúsculas", f["OS/2"].sCapHeight / upm, "· glifos", len(adv))


if __name__ == "__main__":
    digits()
    font()
