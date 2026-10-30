// Tipos y demarcaciones comunes a todos los clubes. La plantilla de cada uno está en clubs/<club>/squad.ts.

export type Pos = 'POR' | 'DEF' | 'MED' | 'DEL';

export interface Player {
  id: string;
  dorsal: number;
  /** Dorsal tal cual se estampa, si difiere del número (p. ej. «02» en una camiseta personalizada) */
  estampado?: string;
  /** Texto serigrafiado en la espalda */
  shirt: string;
  nombre: string;
  apellido: string;
  pos: Pos;
  rol: string;
  edad: number;
  pais: string;
  bandera: string;
  procedencia: string;
  contrato: number;
  capitan?: boolean;
}

export const POSITIONS: { key: Pos; label: string; short: string }[] = [
  { key: 'POR', label: 'Porteros', short: 'POR' },
  { key: 'DEF', label: 'Defensas', short: 'DEF' },
  { key: 'MED', label: 'Centrocampistas', short: 'MED' },
  { key: 'DEL', label: 'Delanteros', short: 'DEL' },
];
