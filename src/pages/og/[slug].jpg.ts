// Imagen de vista previa para compartir (Open Graph), una por jugador más la general.
// Se generan al compilar: /og/5.jpg, /og/23.jpg… y /og/vestuario.jpg. En JPEG pesan unos 100 KB:
// WhatsApp y otras apps descartan las vistas previas de más de unos cientos de KB.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import sharp from 'sharp';
import advances from '../../assets/og/bebas-advances.json';
import kits from '../../data/kit.json';
import { POSITIONS, SEASON, SQUAD, type Player } from '../../data/squad';
import { LETTERING, nameAngles } from '../../scripts/locker/lettering';

const path = (p: string) => resolve(process.cwd(), p);
const file = (p: string) => readFileSync(path(p));
const png = (p: string) => `data:image/png;base64,${file(p).toString('base64')}`;
const fonts = [
  { name: 'Anton', data: file('node_modules/@fontsource/anton/files/anton-latin-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
  { name: 'Mono', data: file('node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff'), weight: 600 as const, style: 'normal' as const },
];

type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children, ...extra },
});

const HUESO = '#f3eadb', ORO = '#e2b65e', GRANA = '#a5152f';
const SHIRT = { left: 78, top: 30, height: 560 };

/** Nombre en arco y dorsal sobre la foto de espalda: misma geometría que el visor 3D (lettering.ts) */
function lettering(player: Player) {
  const { crop, text } = kits[player.pos === 'POR' ? 'portero' : 'campo'];
  const K = SHIRT.height / crop.h; // px de la tarjeta por px de la foto
  const s = (text.ppm / 1281.3) * K;
  const X = (x: number) => SHIRT.left + (x - crop.x) * K, Y = (y: number) => SHIRT.top + (y - crop.y) * K;
  const adv = (ch: string) => (advances as Record<string, number>)[ch] ?? 0.4;
  const style = `font-family="Bebas Neue" fill="${text.ink}" stroke="${text.edge}" paint-order="stroke" stroke-linejoin="round" text-anchor="middle"`;
  const L = LETTERING, size = L.nameSize * s;
  const letters = [...player.shirt];
  const cx = X(text.cx), cy = Y(text.top) + L.arcCentre * s;
  const name = nameAngles(letters.map((ch) => adv(ch) * size))
    .map(
      (a, i) =>
        `<text ${style} font-size="${size}" stroke-width="${4.4 * s}" transform="translate(${cx} ${cy}) rotate(${(a * 180) / Math.PI}) translate(0 ${-L.radius * s + (L.cap / 2) * size})">${letters[i]}</text>`,
    )
    .join('');
  const height = L.numberHeight * s, font = height / L.cap, gap = L.digitGap * s;
  const digits = [...(player.estampado ?? String(player.dorsal))];
  const widths = digits.map((d) => adv(d) * font);
  let x = cx - (widths.reduce((a, b) => a + b, 0) + gap * (digits.length - 1)) / 2;
  const number = digits
    .map((d, i) => {
      const at = x + widths[i] / 2;
      x += widths[i] + gap;
      return `<text ${style} font-size="${font}" stroke-width="${5 * s}" x="${at}" y="${Y(text.top) + L.numberCentre * s + height / 2}">${d}</text>`;
    })
    .join('');
  return name + number;
}

function card(player?: Player) {
  const kit = player?.pos === 'POR' ? 'portero' : 'campo';
  const { crop } = kits[kit];
  const width = (SHIRT.height * crop.w) / crop.h;
  const title = player ? `${player.nombre} ${player.apellido}` : 'El vestuario en 3D';
  return el(
    'div',
    {
      width: 1200, height: 630, backgroundColor: '#070504', color: HUESO, fontFamily: 'Anton', position: 'relative',
      backgroundImage: 'radial-gradient(circle at 26% 48%, #5a3a22 0%, #1b110a 46%, #070504 78%)',
    },
    [
      el('img', { position: 'absolute', left: SHIRT.left, top: SHIRT.top }, undefined, {
        src: png(`src/assets/og/${kit}-${player ? 'back' : 'front'}.png`), width, height: SHIRT.height,
      }),
      el('div', { position: 'absolute', left: 600, top: 64, width: 540, flexDirection: 'column' }, [
        el('div', { alignItems: 'center' }, [
          el('img', {}, undefined, { src: png('src/assets/og/escudo.png'), width: 69, height: 80 }),
          el('div', { flexDirection: 'column', marginLeft: 20 }, [
            el('img', {}, undefined, { src: `data:image/svg+xml;base64,${file('public/escudo/sdhuesca.svg').toString('base64')}`, width: 232, height: 31 }),
            el('div', { fontFamily: 'Mono', fontSize: 17, letterSpacing: 5, color: ORO, marginTop: 12 }, `PLANTILLA ${SEASON}`),
          ]),
        ]),
        player
          ? el('div', { fontSize: 210, lineHeight: 1, marginTop: 34, color: ORO }, String(player.dorsal))
          : el('div', { fontFamily: 'Mono', fontSize: 20, letterSpacing: 6, color: ORO, marginTop: 96 }, 'PRIMERA FEDERACIÓN'),
        el('div', { fontSize: title.length > 16 ? 62 : 78, lineHeight: 1.02, marginTop: player ? 6 : 18, textTransform: 'uppercase' }, title),
        el(
          'div',
          { fontFamily: 'Mono', fontSize: 20, letterSpacing: 5, color: 'rgba(243,234,219,0.62)', marginTop: 20, textTransform: 'uppercase' },
          player ? `${POSITIONS.find((p) => p.key === player.pos)!.label} · ${player.rol}` : `Las ${SQUAD.length} camisetas, una por jugador`,
        ),
      ]),
      el(
        'div',
        {
          position: 'absolute', left: 0, bottom: 0, width: 1200, height: 44, backgroundColor: GRANA, alignItems: 'center',
          justifyContent: 'center', fontFamily: 'Mono', fontSize: 15, letterSpacing: 6,
        },
        'VESTUARIO 3D · EL ALCORAZ · TRIBUTO NO OFICIAL',
      ),
    ],
  );
}

export const getStaticPaths: GetStaticPaths = () => [
  { params: { slug: 'vestuario' }, props: {} },
  ...SQUAD.map((player) => ({ params: { slug: String(player.dorsal) }, props: { player } })),
];

export const GET: APIRoute = async ({ props }) => {
  const player = props.player as Player | undefined;
  let svg = await satori(card(player) as never, { width: 1200, height: 630, fonts });
  // el estampado va en SVG directo (texto sobre un arco), que satori no sabe hacer
  if (player) svg = svg.replace(/<\/svg>\s*$/, `${lettering(player)}</svg>`);
  const image = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: { fontFiles: [path('src/assets/og/BebasNeue.ttf')], loadSystemFonts: false, defaultFontFamily: 'Bebas Neue' },
  })
    .render()
    .asPng();
  const jpeg = await sharp(image).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
};
