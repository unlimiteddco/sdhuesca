// @ts-check
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// Un mismo código, una web por club: CLUB=madrid npm run build. Todo lo propio del club (datos,
// fotos, modelos, colores, textos) vive en clubs/<club>/.
const CLUB = process.env.CLUB || 'huesca';
const dir = resolve('clubs', CLUB);
const club = JSON.parse(readFileSync(resolve(dir, 'club.json'), 'utf8'));

// Modelos y texturas no llevan hash en el nombre: se les añade ?v=<huella de su contenido> para
// que, al regenerarlos, nadie se quede con una mezcla de modelo nuevo y textura vieja en caché.
const assets = createHash('sha1');
for (const sub of ['models', 'kit']) {
  const base = resolve(dir, 'public', sub);
  for (const name of readdirSync(base).sort()) {
    const file = resolve(base, name);
    if (statSync(file).isFile()) assets.update(name).update(readFileSync(file));
  }
}

// https://astro.build/config
export default defineConfig({
  // dominio público: de él salen las URL canónicas, el sitemap y las imágenes al compartir
  site: club.site,
  publicDir: resolve(dir, 'public'),
  vite: {
    plugins: [tailwindcss()],
    resolve: { alias: { '@club': dir } },
    define: { __ASSETS__: JSON.stringify(assets.digest('hex').slice(0, 10)) },
  },
});
