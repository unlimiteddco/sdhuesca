/**
 * Geometría de la serigrafía (nombre en arco + dorsal), compartida por el visor 3D y por las
 * tarjetas de compartir. Reproduce la vista previa de la tienda oficial, para que lo que se ve
 * aquí coincida con lo que se compra allí. Medidas en píxeles de la foto de espalda del kit de
 * campo (900 px de ancho), contadas desde el borde superior del cuello.
 */
export const LETTERING = {
  /** tamaño de letra del nombre: 90 px en la tienda; aquí algo más para igualar el alto de mayúsculas */
  nameSize: 92,
  /** radio del arco y altura de su centro */
  radius: 180,
  arcCentre: 361.5,
  /** alto del dorsal y altura de su centro */
  numberHeight: 225,
  numberCentre: 463,
  /** separación entre las dos cifras */
  digitGap: 3,
  /** alto de las mayúsculas de la letra del nombre («Archivo Dorsal») respecto al cuerpo */
  cap: 0.686,
  /** alto, en unidades del dibujo, de una cifra de trazo recto (1, 7); las redondas sobresalen un poco */
  digitUnits: 708,
};

/** Dibujos de las cifras (public/kit/dorsal.json): los de la tienda oficial, con el escudo a una tinta en la base */
export interface DigitArt {
  /** escudo, el mismo en todas las cifras */
  crest: string;
  digits: Record<string, { w: number; h: number; edge: string; ink: string; crest: [number, number] }>;
}

/** Trazados SVG de una cifra con los colores de la equipación: borde, relleno y escudo en el color del borde */
export const digitPaths = (art: DigitArt, digit: string, ink: string, edge: string) => {
  const g = art.digits[digit];
  return `<path fill="${edge}" d="${g.edge}"/><path fill="${ink}" d="${g.ink}"/><path fill="${edge}" transform="translate(${g.crest[0]} ${g.crest[1]})" d="${art.crest}"/>`;
};

/** Caja de cada cifra del dorsal (x, y, ancho, alto) centrada en `cx`, `cy`, para un alto de cifra recta `height` */
export function digitBoxes(art: DigitArt, digits: string[], cx: number, cy: number, height: number, gap: number) {
  const k = height / LETTERING.digitUnits;
  const total = digits.reduce((sum, d) => sum + art.digits[d].w * k, 0) + gap * (digits.length - 1);
  let x = cx - total / 2;
  return digits.map((d) => {
    const { w, h } = art.digits[d];
    const box = { x, y: cy - (h * k) / 2, w: w * k, h: h * k };
    x += w * k + gap;
    return box;
  });
}

/** Ángulo (rad) que le toca a cada letra según su anchura: los nombres largos abren más el arco */
export function nameAngles(widths: number[]) {
  const n = widths.length;
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  const spread = n > 10 ? 1 + (n - 5) * 0.34 : n > 4 ? 1 + (n - 4) * 0.35 : 1;
  let perUnit = ((48 * Math.PI) / 180 / total) * spread;
  if (total * perUnit < 0.35) perUnit = 0.35 / total;
  // los nombres del primer equipo pueden pasar de 10 letras: que el arco no dé la vuelta
  if (total * perUnit > 2.5) perUnit = 2.5 / total;
  let angle = (-total * perUnit) / 2;
  return widths.map((w) => {
    const centre = angle + (w * perUnit) / 2;
    angle += w * perUnit;
    return centre;
  });
}

/** Normaliza lo que escribe el aficionado a lo que admite la tienda: 10 caracteres y 2 cifras */
export const cleanName = (text: string) =>
  text
    .toUpperCase()
    .replace(/[^A-ZÁÉÍÓÚÜÑÇ0-9 .'-]/g, '')
    .slice(0, 10);
export const cleanNumber = (text: string) => text.replace(/\D/g, '').slice(0, 2);
