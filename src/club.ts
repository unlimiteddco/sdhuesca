// El club de esta compilación (CLUB=… al compilar; por defecto, huesca). Todo lo que cambia de un
// club a otro sale de aquí: textos, colores, serigrafía, tienda y plantilla.
import club from '@club/club.json';
import { SQUAD } from '@club/squad';
import { STATS, STATS_INFO } from '@club/stats';

export type Club = typeof club;
export const CLUB = club;
export const SEASON = club.season;
export { SQUAD, STATS, STATS_INFO };

/** Rellena las marcas {season}, {name}… de los textos del club */
export const fill = (text: string, vars: Record<string, string | number> = {}) =>
  text.replace(/\{(\w+)\}/g, (_, k) => String({ season: club.season, ...vars }[k] ?? ''));
