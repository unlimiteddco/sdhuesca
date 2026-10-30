import { CLUB } from '../../club';

/**
 * Geometría de la serigrafía (nombre en arco + dorsal), compartida por el visor 3D y por las
 * tarjetas de compartir. Reproduce la vista previa de la tienda oficial, para que lo que se ve
 * aquí coincida con lo que se compra allí. Medidas en píxeles de la foto de espalda del kit de
 * campo (900 px de ancho), contadas desde el borde superior del cuello.
 */
export const LETTERING = CLUB.lettering;
export type Lettering = typeof LETTERING & Record<string, unknown>;

/** Medidas de una equipación: las del club con lo que esa equipación cambie (letra, tamaños…) */
export const letteringFor = (text: { lettering?: object }) => ({ ...LETTERING, ...(text.lettering ?? {}) }) as Lettering;

/** Dibujos de las cifras de una equipación (las series PNG van por equipación; las SVG son comunes) */
export const artFor = (all: DigitArt & { kits?: Record<string, Pick<DigitArt, 'digits'>> }, kit: string): DigitArt =>
  all.kits ? { kind: all.kind, digits: all.kits[kit].digits } : all;

/**
 * Dibujos de las cifras del dorsal (public/kit/dorsal.json), sacados de la vista previa de la
 * tienda oficial. Dos formatos: trazados SVG que se pintan con los colores de cada equipación
 * (con el escudo a una tinta, que se guarda una sola vez), o imágenes PNG ya coloreadas.
 */
export interface DigitArt {
  kind: 'svg' | 'png';
  /** solo SVG: escudo, el mismo en todas las cifras */
  crest?: string;
  digits: Record<string, { w: number; h: number; edge?: string; ink?: string; crest?: [number, number]; src?: string }>;
}

/** Trazados SVG de una cifra con los colores de la equipación: borde, relleno y escudo en el color del borde */
export const digitPaths = (art: DigitArt, digit: string, ink: string, edge: string) => {
  const g = art.digits[digit];
  return `<path fill="${edge}" d="${g.edge}"/><path fill="${ink}" d="${g.ink}"/><path fill="${edge}" transform="translate(${g.crest![0]} ${g.crest![1]})" d="${art.crest}"/>`;
};

/**
 * Dónde va cada letra del nombre (centro de la letra a media altura de mayúsculas) y su giro.
 * En arco (como lo pinta la tienda del Huesca) o recto (Real Madrid). `cx`, `top`: centro de la
 * espalda y borde del cuello; `s`: escala de la foto respecto a la de referencia.
 */
export function namePlacement(widths: number[], cx: number, top: number, s: number, L: Record<string, unknown> = LETTERING) {
  if (L.layout === 'arc') {
    const cy = top + (L.arcCentre as number) * s, r = (L.radius as number) * s;
    return nameAngles(widths).map((a) => ({ x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r, a }));
  }
  const total = widths.reduce((a, b) => a + b, 0);
  let x = cx - total / 2;
  return widths.map((w) => {
    const at = { x: x + w / 2, y: top + (L.nameCentre as number) * s, a: 0 };
    x += w;
    return at;
  });
}

/** Caja de cada cifra del dorsal (x, y, ancho, alto) centrada en `cx`, `cy`, para un alto de cifra recta `height` */
export function digitBoxes(art: DigitArt, digits: string[], cx: number, cy: number, height: number, gap: number, units: number = LETTERING.digitUnits) {
  const k = height / units;
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
    .replace(new RegExp(`[^${LETTERING.allowed}]`, 'g'), '')
    .slice(0, LETTERING.maxName);
export const cleanNumber = (text: string) => text.replace(/\D/g, '').slice(0, LETTERING.maxNumber);
