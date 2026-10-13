import type { APIRoute } from 'astro';
import { SQUAD } from '../data/squad';

export const GET: APIRoute = ({ site }) => {
  const paths = ['/', '/personaliza/', ...SQUAD.map((p) => `/dorsal/${p.dorsal}/`)];
  const urls = paths.map((path) => `  <url><loc>${new URL(path, site).href}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
