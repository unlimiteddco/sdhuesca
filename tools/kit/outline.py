"""Silueta de la camiseta en una foto de producto sobre fondo blanco.

Ejecutado directamente dibuja el contorno y las esquinas candidatas de una foto,
para marcar a ojo los puntos clave de un kit nuevo:
    python tools/kit/outline.py tools/kit/src/portero-naranja/01.jpg
"""
import sys
from pathlib import Path

import cv2
import numpy as np


def shirt_mask(img, cuts=()):
    """Máscara y contorno exterior. `cuts` son polilíneas (px) que separan la manga del cuerpo
    allí donde en la foto se tocan y el contorno no las distingue."""
    nonwhite = (img.min(axis=2) < 243).astype(np.uint8) * 255
    nonwhite = cv2.morphologyEx(nonwhite, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    cnts, _ = cv2.findContours(nonwhite, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    mask = np.zeros(img.shape[:2], np.uint8)
    cv2.drawContours(mask, [max(cnts, key=cv2.contourArea)], -1, 255, -1)
    if cuts:
        slit = np.zeros_like(mask)
        for cut in cuts:
            cv2.polylines(slit, [np.array(cut, np.int32).reshape(-1, 1, 2)], False, 255, 5)
        # el hueco blanco entre manga y cuerpo por el que pasa el corte tampoco es prenda: si se
        # quedara dentro de la máscara, el costado saldría con el blanco del fondo
        n, labels = cv2.connectedComponents((img.min(axis=2) >= 232).astype(np.uint8))
        gap = np.isin(labels, np.setdiff1d(np.unique(labels[slit > 0]), [0]))
        mask[cv2.dilate(gap.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0] = 0
        mask[slit > 0] = 0
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    big = max(cnts, key=cv2.contourArea)
    mask[:] = 0
    cv2.drawContours(mask, [big], -1, 255, -1)
    return mask, big[:, 0, :]


if __name__ == "__main__":
    out = Path(__file__).parent / "build"
    for path in sys.argv[1:]:
        img = cv2.imread(path)
        mask, contour = shirt_mask(img)
        poly = cv2.approxPolyDP(contour.reshape(-1, 1, 2), 6, True)[:, 0, :]
        vis = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        cv2.polylines(vis, [contour.reshape(-1, 1, 2) * 2], True, (0, 255, 0), 1)
        for i, (x, y) in enumerate(poly):
            cv2.circle(vis, (x * 2, y * 2), 5, (0, 0, 255), -1)
            cv2.putText(vis, str(i), (x * 2 + 6, y * 2 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 255), 2)
        cv2.imwrite(str(out / f"inspect-{Path(path).stem}.jpg"), vis, [cv2.IMWRITE_JPEG_QUALITY, 80])
        print(path, [(i, int(x), int(y)) for i, (x, y) in enumerate(poly)])
