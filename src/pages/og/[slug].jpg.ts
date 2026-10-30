// Imagen de vista previa para compartir (Open Graph), una por jugador más la general.
// Se generan al compilar: /og/5.jpg, /og/23.jpg… y /og/vestuario.jpg. En JPEG pesan unos 100 KB:
// WhatsApp y otras apps descartan las vistas previas de más de unos cientos de KB.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import sharp from 'sharp';
import kits from '@club/kit.json';
import { CLUB, SEASON, SQUAD } from '../../club';
import { POSITIONS, type Player } from '../../data/players';
import { LETTERING, artFor, digitBoxes, digitPaths, letteringFor, namePlacement, type DigitArt } from '../../scripts/locker/lettering';

const path = (p: string) => resolve(process.cwd(), p);
/** carpeta del club de esta compilación */
const club = (p: string) => path(`clubs/${process.env.CLUB || 'huesca'}/${p}`);
const file = (p: string) => readFileSync(path(p));
const allArt: DigitArt = JSON.parse(readFileSync(club('public/kit/dorsal.json')).toString());
/** avances de cada letra de serigrafía, por familia */
const advances: Record<string, Record<string, number>> = Object.fromEntries(
  LETTERING.fonts.map((f) => [f.family, JSON.parse(readFileSync(club(f.advances)).toString())]),
);
const clubPng = (p: string) => `data:image/png;base64,${readFileSync(club(p)).toString('base64')}`;
/** cifras en imagen (WebP en la web): resvg las quiere en PNG */
const pngDigits: Record<string, string> = {};
if (allArt.kind === 'png') {
  const sets = (allArt as DigitArt & { kits: Record<string, Pick<DigitArt, 'digits'>> }).kits;
  for (const { digits } of Object.values(sets)) {
    for (const { src } of Object.values(digits)) {
      pngDigits[src!] = `data:image/png;base64,${(await sharp(club(`public${src}`)).png().toBuffer()).toString('base64')}`;
    }
  }
}
const fonts = [
  { name: 'Anton', data: file('node_modules/@fontsource/anton/files/anton-latin-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
  { name: 'Mono', data: file('node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff'), weight: 600 as const, style: 'normal' as const },
];

type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children, ...extra },
});

const OG = CLUB.og;
const SHIRT = { left: 78, top: 30, height: 560 };

/** Nombre (en arco o recto) y dorsal sobre la foto de espalda: misma geometría que el visor 3D (lettering.ts) */
function lettering(player: Player) {
  const kitName = player.pos === 'POR' ? 'portero' : 'campo';
  const { crop, text } = kits[kitName];
  const L = letteringFor(text), art = artFor(allArt, kitName);
  const K = SHIRT.height / crop.h; // px de la tarjeta por px de la foto
  const s = (text.ppm / L.refPpm) * K;
  const X = (x: number) => SHIRT.left + (x - crop.x) * K, Y = (y: number) => SHIRT.top + (y - crop.y) * K;
  const adv = (ch: string) => advances[L.font][ch] ?? 0.4;
  const style = `font-family="${L.font}" fill="${text.ink}" stroke="${L.nameStroke ? text.edge : 'none'}" paint-order="stroke" stroke-linejoin="round" text-anchor="middle"`;
  const size = L.nameSize * s;
  const letters = [...player.shirt];
  const cx = X(text.cx);
  const name = namePlacement(letters.map((ch) => adv(ch) * size), cx, Y(text.top), s, L)
    .map(
      ({ x, y, a }, i) =>
        `<text ${style} font-size="${size}" stroke-width="${L.nameStroke * s}" transform="translate(${x} ${y}) rotate(${(a * 180) / Math.PI}) translate(0 ${(L.cap / 2) * size})">${letters[i]}</text>`,
    )
    .join('');
  const digits = [...(player.estampado ?? String(player.dorsal))];
  const number = digitBoxes(art, digits, cx, Y(text.top) + L.numberCentre * s, L.numberHeight * s, L.digitGap * s, L.digitUnits)
    .map((box, i) => {
      const { w, h, src } = art.digits[digits[i]];
      if (art.kind === 'png') return `<image x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" href="${pngDigits[src!]}"/>`;
      return `<svg x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" viewBox="0 0 ${w} ${h}">${digitPaths(art, digits[i], text.ink, text.edge)}</svg>`;
    })
    .join('');
  return name + number;
}

function card(player?: Player) {
  const kit = player?.pos === 'POR' ? 'portero' : 'campo';
  const { crop } = kits[kit];
  const width = (SHIRT.height * crop.w) / crop.h;
  const title = player ? `${player.nombre} ${player.apellido}` : 'El vestuario en 3D';
  const [g0, g1, g2] = OG.glow;
  return el(
    'div',
    {
      width: 1200, height: 630, backgroundColor: g2, color: OG.text, fontFamily: 'Anton', position: 'relative',
      backgroundImage: `radial-gradient(circle at 26% 48%, ${g0} 0%, ${g1} 46%, ${g2} 78%)`,
    },
    [
      el('img', { position: 'absolute', left: SHIRT.left, top: SHIRT.top }, undefined, {
        src: clubPng(`og/${kit}-${player ? 'back' : 'front'}.png`), width, height: SHIRT.height,
      }),
      el('div', { position: 'absolute', left: 600, top: 64, width: 540, flexDirection: 'column' }, [
        el('div', { alignItems: 'center' }, [
          el('img', {}, undefined, { src: clubPng('og/escudo.png'), width: Math.round((80 * CLUB.crest.width) / CLUB.crest.height), height: 80 }),
          el('div', { flexDirection: 'column', marginLeft: 20 }, [
            el('img', {}, undefined, {
              src: `data:image/svg+xml;base64,${readFileSync(club(`public${CLUB.wordmark.src}`)).toString('base64')}`,
              width: OG.wordmarkWidth, height: Math.round((OG.wordmarkWidth * CLUB.wordmark.height) / CLUB.wordmark.width),
            }),
            el('div', { fontFamily: 'Mono', fontSize: 17, letterSpacing: 5, color: OG.gold, marginTop: 12 }, `PLANTILLA ${SEASON}`),
          ]),
        ]),
        player
          ? el('div', { fontSize: 210, lineHeight: 1, marginTop: 34, color: OG.gold }, String(player.dorsal))
          : el('div', { fontFamily: 'Mono', fontSize: 20, letterSpacing: 6, color: OG.gold, marginTop: 96, textTransform: 'uppercase' }, CLUB.competition),
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
          position: 'absolute', left: 0, bottom: 0, width: 1200, height: 44, backgroundColor: OG.band, alignItems: 'center',
          justifyContent: 'center', fontFamily: 'Mono', fontSize: 15, letterSpacing: 6,
        },
        OG.footer.toUpperCase(),
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
  // el estampado va en SVG directo (letras giradas, cifras), que satori no sabe hacer
  if (player) svg = svg.replace(/<\/svg>\s*$/, `${lettering(player)}</svg>`);
  const image = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: { fontFiles: LETTERING.fonts.map((f) => club(f.file)), loadSystemFonts: false, defaultFontFamily: LETTERING.font },
  })
    .render()
    .asPng();
  const jpeg = await sharp(image).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
};
