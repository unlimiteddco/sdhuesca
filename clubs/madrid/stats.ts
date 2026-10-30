// Archivo generado por tools/stats.mjs (npm run stats). No editar a mano.
// Fuente: https://www.transfermarkt.es/real-madrid/leistungsdaten/verein/418/reldata/ES1%262026/plus/1

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

export const STATS_INFO = { competicion: 'LaLiga', jornada: 10, puesto: 3, fecha: '30 oct 2026', fuente: 'Transfermarkt' };

/** Liga regular, por dorsal */
export const STATS: Record<number, Stats> = {
  1: { conv: 9, pj: 9, tit: 9, min: 810, goles: 0, asist: 0, ta: 0, tr: 0 },
  13: { conv: 10, pj: 1, tit: 1, min: 90, goles: 0, asist: 0, ta: 0, tr: 0 },
  2: { conv: 3, pj: 0, tit: 0, min: 0, goles: 0, asist: 0, ta: 0, tr: 0 },
  3: { conv: 2, pj: 1, tit: 0, min: 5, goles: 0, asist: 0, ta: 0, tr: 0 },
  4: { conv: 9, pj: 8, tit: 8, min: 682, goles: 0, asist: 0, ta: 1, tr: 1 },
  12: { conv: 10, pj: 6, tit: 3, min: 266, goles: 0, asist: 1, ta: 0, tr: 0 },
  16: { conv: 10, pj: 9, tit: 9, min: 810, goles: 0, asist: 0, ta: 4, tr: 0 },
  17: { conv: 10, pj: 10, tit: 6, min: 655, goles: 0, asist: 0, ta: 2, tr: 0 },
  18: { conv: 10, pj: 5, tit: 4, min: 246, goles: 1, asist: 1, ta: 1, tr: 0 },
  22: { conv: 10, pj: 4, tit: 3, min: 306, goles: 1, asist: 0, ta: 1, tr: 0 },
  23: { conv: 0, pj: 0, tit: 0, min: 0, goles: 0, asist: 0, ta: 0, tr: 0 },
  24: { conv: 10, pj: 8, tit: 5, min: 447, goles: 0, asist: 0, ta: 1, tr: 0 },
  5: { conv: 10, pj: 10, tit: 9, min: 778, goles: 3, asist: 4, ta: 2, tr: 0 },
  6: { conv: 10, pj: 9, tit: 2, min: 275, goles: 0, asist: 1, ta: 2, tr: 0 },
  8: { conv: 10, pj: 10, tit: 10, min: 801, goles: 0, asist: 2, ta: 0, tr: 0 },
  14: { conv: 6, pj: 6, tit: 5, min: 448, goles: 0, asist: 1, ta: 2, tr: 0 },
  15: { conv: 10, pj: 10, tit: 8, min: 594, goles: 2, asist: 3, ta: 1, tr: 0 },
  20: { conv: 10, pj: 8, tit: 4, min: 383, goles: 0, asist: 1, ta: 0, tr: 0 },
  27: { conv: 6, pj: 0, tit: 0, min: 0, goles: 0, asist: 0, ta: 0, tr: 0 },
  7: { conv: 8, pj: 8, tit: 7, min: 585, goles: 1, asist: 3, ta: 2, tr: 1 },
  9: { conv: 6, pj: 2, tit: 1, min: 74, goles: 0, asist: 0, ta: 0, tr: 0 },
  10: { conv: 10, pj: 10, tit: 10, min: 895, goles: 11, asist: 2, ta: 2, tr: 0 },
  11: { conv: 0, pj: 0, tit: 0, min: 0, goles: 0, asist: 0, ta: 0, tr: 0 },
  19: { conv: 10, pj: 6, tit: 0, min: 31, goles: 2, asist: 0, ta: 0, tr: 0 },
  21: { conv: 10, pj: 4, tit: 1, min: 119, goles: 0, asist: 0, ta: 0, tr: 0 },
  25: { conv: 10, pj: 10, tit: 5, min: 547, goles: 2, asist: 2, ta: 1, tr: 0 },
};
