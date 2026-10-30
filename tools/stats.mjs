// Descarga las estadísticas de liga de la plantilla desde Transfermarkt y regenera clubs/<club>/stats.ts.
//
// Uso: npm run stats   (CLUB=madrid npm run stats para otro club; tras cada jornada, y después compilar)
//
// Lee dos páginas públicas: el rendimiento de la plantilla en la competición y la clasificación
// (de ella salen los partidos jugados y los goles encajados por el equipo).
import { readFile, writeFile } from 'node:fs/promises';

const DIR = new URL(`../clubs/${process.env.CLUB || 'huesca'}/`, import.meta.url);
// club y competición en Transfermarkt: clubs/<club>/club.json → stats. Cambiar al empezar otra temporada.
const { club: CLUB, comp: COMP } = JSON.parse(await readFile(new URL('club.json', DIR), 'utf8')).stats;
const BASE = 'https://www.transfermarkt.es';
const SQUAD_URL = `${BASE}/${CLUB.slug}/leistungsdaten/verein/${CLUB.id}/reldata/${COMP.id}%26${COMP.season}/plus/1`;
const TABLE_URL = `${BASE}/${COMP.slug}/tabelle/wettbewerb/${COMP.id}/saison_id/${COMP.season}`;

async function page(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      'Accept-Language': 'es-ES,es;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  return res.text();
}

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const num = (s) => Number.parseInt(String(s).replace(/\D/g, ''), 10) || 0;
const items = (html) => {
  const start = html.indexOf('<table class="items"');
  if (start < 0) throw new Error('Transfermarkt ha cambiado la página: no aparece la tabla');
  return html.slice(html.indexOf('<tbody>', start), html.indexOf('</tbody>', start));
};

/** Dorsal -> fila de la tabla de rendimiento */
function squadRows(html) {
  const rows = new Map();
  for (const row of items(html).split(/<tr class="(?:odd|even)">/).slice(1)) {
    const dorsal = num(row.match(/rn_nummer>([^<]*)/)?.[1] ?? '');
    if (!dorsal) continue; // jugadores del filial sin dorsal del primer equipo
    // tras la ficha del jugador vienen edad, nacionalidad y las columnas de datos; las ocultas son un duplicado
    const cells = [...row.slice(row.indexOf('</table>')).matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)]
      .filter(([, attrs]) => !/class="[^"]*\bhide\b/.test(attrs))
      .map(([, , inner]) => text(inner));
    const [, , conv, pj, goles, asist, ta, dobles, tr, entra, , , min] = cells;
    // sin minutos la fila solo trae «No ha sido alineado esta temporada»
    const played = cells.length > 5;
    rows.set(dorsal, {
      conv: num(conv),
      pj: played ? num(pj) : 0,
      tit: played ? num(pj) - num(entra) : 0,
      min: played ? num(min) : 0,
      goles: played ? num(goles) : 0,
      asist: played ? num(asist) : 0,
      ta: played ? num(ta) : 0,
      tr: played ? num(dobles) + num(tr) : 0,
    });
  }
  return rows;
}

/** Partidos jugados y goles en contra del equipo, de la clasificación */
function team(html) {
  for (const row of items(html).split('<tr').slice(1)) {
    if (!row.includes(`/verein/${CLUB.id}/`)) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(([, inner]) => text(inner));
    const score = cells.find((c) => /^\d+:\d+$/.test(c));
    return { puesto: num(cells[0]), pj: num(cells[3]), contra: num(score.split(':')[1]) };
  }
  throw new Error('El equipo no aparece en la clasificación');
}

const squadSrc = await readFile(new URL('squad.ts', DIR), 'utf8');
const squad = [...squadSrc.matchAll(/\{ dorsal: (\d+),[^}]*?pos: '(\w+)'/g)].map(([, dorsal, pos]) => ({ dorsal: Number(dorsal), pos }));

const [rows, club] = await Promise.all([page(SQUAD_URL).then(squadRows), page(TABLE_URL).then(team)]);
const missing = squad.filter((p) => !rows.has(p.dorsal)).map((p) => p.dorsal);
if (missing.length > squad.length / 2) throw new Error('Faltan casi todos los dorsales: la tabla ha cambiado de formato');

const empty = { conv: 0, pj: 0, tit: 0, min: 0, goles: 0, asist: 0, ta: 0, tr: 0 };
const lines = squad.map(({ dorsal, pos }) => {
  const s = { ...(rows.get(dorsal) ?? empty) };
  // Transfermarkt no da los encajados en esta tabla. Solo se pueden atribuir con certeza al portero
  // que ha jugado todos los minutos del equipo; si se han repartido la portería, no se muestran.
  if (pos === 'POR' && s.min > 0 && s.min === club.pj * 90) s.encajados = club.contra;
  return `  ${dorsal}: ${JSON.stringify(s).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ').replace('{', '{ ').replace('}', ' }')},`;
});

const fecha = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()).replace('.', '');
const out = `// Archivo generado por tools/stats.mjs (npm run stats). No editar a mano.
// Fuente: ${SQUAD_URL}

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

export const STATS_INFO = { competicion: '${COMP.name}', jornada: ${club.pj}, puesto: ${club.puesto}, fecha: '${fecha}', fuente: 'Transfermarkt' };

/** Liga regular, por dorsal */
export const STATS: Record<number, Stats> = {
${lines.join('\n')}
};
`;
await writeFile(new URL('stats.ts', DIR), out);
console.log(`Jornada ${club.pj} · ${squad.length - missing.length}/${squad.length} jugadores${missing.length ? ` (sin fila: ${missing.join(', ')})` : ''}`);
