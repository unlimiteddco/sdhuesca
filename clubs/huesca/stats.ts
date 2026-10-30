// Archivo generado por tools/stats.mjs (npm run stats). No editar a mano.
// Fuente: https://www.transfermarkt.es/sd-huesca/leistungsdaten/verein/5358/reldata/E3G2%262026/plus/1

export interface Stats {
  /** Partidos convocado */
  conv: number;
  /** Partidos jugados */
  pj: number;
  /** Partidos como titular */
  tit: number;
  min: number;
  goles: number;
  asist: number;
  ta: number;
  /** Expulsiones: rojas directas y dobles amarillas */
  tr: number;
  /** Goles encajados (solo el portero que lo ha jugado todo) */
  encajados?: number;
}

export const STATS_INFO = { competicion: 'Primera Federación · Grupo 2', jornada: 9, puesto: 11, fecha: '30 oct 2026', fuente: 'Transfermarkt' };

/** Liga regular, por dorsal */
export const STATS: Record<number, Stats> = {
  1: { conv: 9, pj: 9, tit: 9, min: 810, goles: 0, asist: 0, ta: 0, tr: 0, encajados: 11 },
  13: { conv: 9, pj: 0, tit: 0, min: 0, goles: 0, asist: 0, ta: 0, tr: 0 },
  2: { conv: 8, pj: 4, tit: 2, min: 268, goles: 0, asist: 0, ta: 1, tr: 1 },
  3: { conv: 9, pj: 5, tit: 3, min: 184, goles: 1, asist: 0, ta: 0, tr: 0 },
  4: { conv: 9, pj: 7, tit: 6, min: 541, goles: 1, asist: 0, ta: 0, tr: 0 },
  5: { conv: 1, pj: 1, tit: 1, min: 69, goles: 0, asist: 0, ta: 0, tr: 0 },
  15: { conv: 8, pj: 8, tit: 8, min: 635, goles: 0, asist: 0, ta: 0, tr: 0 },
  16: { conv: 8, pj: 8, tit: 8, min: 720, goles: 0, asist: 0, ta: 1, tr: 1 },
  20: { conv: 8, pj: 0, tit: 0, min: 0, goles: 0, asist: 0, ta: 0, tr: 0 },
  24: { conv: 9, pj: 9, tit: 9, min: 801, goles: 0, asist: 0, ta: 2, tr: 0 },
  6: { conv: 9, pj: 8, tit: 4, min: 414, goles: 0, asist: 1, ta: 1, tr: 0 },
  7: { conv: 5, pj: 5, tit: 3, min: 250, goles: 1, asist: 0, ta: 1, tr: 0 },
  10: { conv: 9, pj: 8, tit: 7, min: 680, goles: 0, asist: 0, ta: 1, tr: 0 },
  11: { conv: 9, pj: 5, tit: 3, min: 257, goles: 2, asist: 2, ta: 0, tr: 0 },
  14: { conv: 8, pj: 6, tit: 2, min: 257, goles: 0, asist: 2, ta: 0, tr: 0 },
  17: { conv: 8, pj: 7, tit: 1, min: 249, goles: 0, asist: 1, ta: 0, tr: 0 },
  21: { conv: 9, pj: 8, tit: 8, min: 533, goles: 0, asist: 0, ta: 1, tr: 0 },
  22: { conv: 9, pj: 7, tit: 5, min: 449, goles: 0, asist: 0, ta: 2, tr: 0 },
  23: { conv: 8, pj: 8, tit: 8, min: 538, goles: 1, asist: 0, ta: 3, tr: 0 },
  8: { conv: 9, pj: 7, tit: 3, min: 314, goles: 2, asist: 2, ta: 1, tr: 0 },
  9: { conv: 9, pj: 7, tit: 4, min: 305, goles: 0, asist: 0, ta: 0, tr: 0 },
  18: { conv: 7, pj: 6, tit: 4, min: 314, goles: 1, asist: 0, ta: 0, tr: 0 },
  19: { conv: 8, pj: 7, tit: 1, min: 257, goles: 2, asist: 0, ta: 0, tr: 0 },
};
