// @ts-check
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// Modelos y texturas no llevan hash en el nombre: se les añade ?v=<huella de su contenido> para
// que, al regenerarlos, nadie se quede con una mezcla de modelo nuevo y textura vieja en caché.
const assets = createHash('sha1');
for (const dir of ['public/models', 'public/kit']) {
  for (const name of readdirSync(dir).sort()) assets.update(name).update(readFileSync(`${dir}/${name}`));
}

// https://astro.build/config
export default defineConfig({
  // dominio público: de él salen las URL canónicas, el sitemap y las imágenes al compartir
  site: 'https://sdhuesca.bellostas.studio',
  vite: {
    plugins: [tailwindcss()],
    define: { __ASSETS__: JSON.stringify(assets.digest('hex').slice(0, 10)) },
  },
});
