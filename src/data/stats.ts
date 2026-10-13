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

export const STATS_INFO = { competicion: 'Primera Federación · Grupo 2', jornada: 7, puesto: 9, fecha: '13 oct 2026', fuente: 'Transfermarkt' };

/** Liga regular, por dorsal */
export const STATS: Record<number, Stats> = {
  1: { conv: 7, pj: 7, tit: 7, min: 630, goles: 0, asist: 0, ta: 0, tr: 0, encajados: 9 },
  13: { conv: 7, pj: 0, tit: 0, min: 0, goles: 0, asist: 0, ta: 0, tr: 0 },
  2: { conv: 7, pj: 3, tit: 2, min: 225, goles: 0, asist: 0, ta: 1, tr: 0 },
  3: { conv: 7, pj: 4, tit: 3, min: 163, goles: 1, asist: 0, ta: 0, tr: 0 },
  4: { conv: 7, pj: 5, tit: 4, min: 361, goles: 1, asist: 0, ta: 0, tr: 0 },
  5: { conv: 0, pj: 0, tit: 0, min: 0, goles: 0, asist: 0, ta: 0, tr: 0 },
  15: { conv: 7, pj: 7, tit: 7, min: 630, goles: 0, asist: 0, ta: 0, tr: 0 },
  16: { conv: 6, pj: 6, tit: 6, min: 540, goles: 0, asist: 0, ta: 1, tr: 1 },
  20: { conv: 6, pj: 0, tit: 0, min: 0, goles: 0, asist: 0, ta: 0, tr: 0 },
  24: { conv: 7, pj: 7, tit: 7, min: 621, goles: 0, asist: 0, ta: 1, tr: 0 },
  6: { conv: 7, pj: 6, tit: 2, min: 285, goles: 0, asist: 0, ta: 0, tr: 0 },
  7: { conv: 5, pj: 5, tit: 3, min: 250, goles: 1, asist: 0, ta: 1, tr: 0 },
  10: { conv: 7, pj: 6, tit: 6, min: 540, goles: 0, asist: 0, ta: 1, tr: 0 },
  11: { conv: 7, pj: 4, tit: 3, min: 249, goles: 2, asist: 2, ta: 0, tr: 0 },
  14: { conv: 6, pj: 4, tit: 2, min: 206, goles: 0, asist: 2, ta: 0, tr: 0 },
  17: { conv: 6, pj: 5, tit: 1, min: 183, goles: 0, asist: 0, ta: 0, tr: 0 },
  21: { conv: 7, pj: 6, tit: 6, min: 353, goles: 0, asist: 0, ta: 1, tr: 0 },
  22: { conv: 7, pj: 5, tit: 3, min: 269, goles: 0, asist: 0, ta: 1, tr: 0 },
  23: { conv: 7, pj: 7, tit: 7, min: 506, goles: 1, asist: 0, ta: 3, tr: 0 },
  8: { conv: 7, pj: 5, tit: 1, min: 169, goles: 0, asist: 1, ta: 1, tr: 0 },
  9: { conv: 7, pj: 5, tit: 3, min: 222, goles: 0, asist: 0, ta: 0, tr: 0 },
  18: { conv: 7, pj: 6, tit: 4, min: 314, goles: 1, asist: 0, ta: 0, tr: 0 },
  19: { conv: 6, pj: 5, tit: 0, min: 191, goles: 2, asist: 0, ta: 0, tr: 0 },
};
