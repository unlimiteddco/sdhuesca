// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // dominio público: de él salen las URL canónicas, el sitemap y las imágenes al compartir
  site: 'https://sdhuesca.bellostas.studio',
  vite: {
    plugins: [tailwindcss()]
  }
});
