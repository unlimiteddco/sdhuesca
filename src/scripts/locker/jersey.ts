import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Player } from '../../data/squad';
import kitInfo from '../../data/kit.json';
import { LETTERING, digitBoxes, digitPaths, nameAngles, type DigitArt } from './lettering';

/** Escala de los modelos de Blender dentro del vestuario */
export const SHIRT_SCALE = 1.1;

export type KitName = keyof typeof kitInfo;
/** Los porteros visten su propia camiseta (manga larga); el resto, la de juego */
export const kitOf = (player: Player): KitName => (player.pos === 'POR' ? 'portero' : 'campo');

export interface Kit {
  /** Camiseta simulada en Blender; origen en el centro de la barra. UV: mitad izquierda pecho, derecha espalda */
  shirt: THREE.BufferGeometry;
  hanger: THREE.BufferGeometry;
  hook: THREE.BufferGeometry;
  front: HTMLImageElement;
  back: HTMLImageElement;
  /** Cifras del dorsal (0–9) ya pintadas con la tinta y el borde de esta equipación */
  digits: HTMLImageElement[];
  info: (typeof kitInfo)[KitName];
}

export interface KitAssets {
  kits: Record<KitName, Kit>;
  /** Dibujos de las cifras, para volver a pintarlas (tarjetas, pruebas) */
  art: DigitArt;
  /** Balón de Poly Haven (CC0) */
  balls: THREE.Object3D[];
  /** Botas generadas con Magnific (texto a 3D): una por modelo, pie derecho */
  boots: THREE.Object3D[];
  /** Medidas ya escaladas de la prenda más grande, relativas al pivote (la barra) */
  size: { width: number; bottom: number };
}

/** Huella del contenido de modelos y texturas (astro.config.mjs): cambia la URL cuando cambian */
declare const __ASSETS__: string;
const url = (path: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}?v=${__ASSETS__}`;

function image(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    img.src = url(src);
  });
}

/** Una cifra como imagen: el SVG se monta con los colores del kit y se carga desde memoria */
function digitImage(art: DigitArt, digit: string, ink: string, edge: string) {
  const { w, h } = art.digits[digit];
  // al doble de su tamaño: en la textura grande se dibuja a unos 600 px de alto
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="0 0 ${w} ${h}">${digitPaths(art, digit, ink, edge)}</svg>`;
  const src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo pintar la cifra ${digit}`));
    img.src = src;
  });
}

async function loadKit(name: KitName, art: DigitArt): Promise<Kit> {
  const { ink, edge } = kitInfo[name].text;
  const [gltf, front, back, ...digits] = await Promise.all([
    new GLTFLoader().loadAsync(url(`/models/camiseta-${name}.glb`)),
    image(`/kit/${name}-front.webp`),
    image(`/kit/${name}-back.webp`),
    ...[...'0123456789'].map((d) => digitImage(art, d, ink, edge)),
  ]);
  gltf.scene.updateMatrixWorld(true);
  const geometry = (part: string) => {
    let mesh: THREE.Mesh | undefined;
    gltf.scene.traverse((o) => {
      if (!mesh && (o as THREE.Mesh).isMesh && o.name.startsWith(part)) mesh = o as THREE.Mesh;
    });
    if (!mesh) throw new Error(`Falta "${part}" en camiseta-${name}.glb`);
    return mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  };
  return { shirt: geometry('camiseta'), hanger: geometry('percha'), hook: geometry('gancho'), front, back, digits, info: kitInfo[name] };
}

export async function loadKitAssets(): Promise<KitAssets> {
  const loader = new GLTFLoader();
  const model = (name: string) => loader.loadAsync(url(`/models/${name}.glb`)).then((g) => g.scene);
  const art: DigitArt = await fetch(url('/kit/dorsal.json')).then((r) => {
    if (!r.ok) throw new Error('No se pudieron cargar las cifras del dorsal');
    return r.json();
  });
  const [campo, portero, ball, ...boots] = await Promise.all([
    loadKit('campo', art),
    loadKit('portero', art),
    model('balon'),
    model('bota-negra'),
    model('bota-blanca'),
  ]);
  const balls = [ball];
  const size = { width: 0, bottom: 0 };
  for (const kit of [campo, portero]) {
    kit.shirt.computeBoundingBox();
    const box = kit.shirt.boundingBox!;
    size.width = Math.max(size.width, (box.max.x - box.min.x) * SHIRT_SCALE);
    size.bottom = Math.min(size.bottom, box.min.y * SHIRT_SCALE);
  }
  return { kits: { campo, portero }, art, balls, boots, size };
}

// Archivo condensada, ajustada en ancho y grosor a la letra oficial de los nombres (tools/kit/lettering.py)
const FONT = '"Archivo Dorsal"';

/**
 * Atlas de la camiseta de un jugador: las fotos oficiales (pecho | espalda) con su nombre y
 * dorsal estampados en la espalda. `k` = px de lienzo por px de la foto original.
 */
export function createKitTexture(player: Player, assets: KitAssets, k: number, anisotropy: number) {
  const kit = assets.kits[kitOf(player)];
  const { crop, text } = kit.info;
  const w = Math.round(crop.w * k), h = Math.round(crop.h * k);
  const canvas = document.createElement('canvas');
  canvas.width = w * 2;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(kit.front, 0, 0, w, h);
  ctx.drawImage(kit.back, w, 0, w, h);

  // a partir de aquí se dibuja en píxeles de la foto de espalda; `s` adapta las medidas a la escala de cada foto
  const s = text.ppm / 1281.3;
  const L = LETTERING;
  ctx.setTransform(k, 0, 0, k, w - crop.x * k, -crop.y * k);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.fillStyle = text.ink;
  ctx.strokeStyle = text.edge;

  // nombre: cada letra gira alrededor del centro del arco
  const size = L.nameSize * s;
  ctx.font = `${size}px ${FONT}`;
  ctx.lineWidth = 4.4 * s;
  const letters = [...player.shirt];
  const angles = nameAngles(letters.map((ch) => ctx.measureText(ch).width));
  letters.forEach((ch, i) => {
    ctx.save();
    ctx.translate(text.cx, text.top + L.arcCentre * s);
    ctx.rotate(angles[i]);
    ctx.translate(0, -L.radius * s + (L.cap / 2) * size);
    ctx.strokeText(ch, 0, 0);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });

  // dorsal: los dibujos oficiales de cada cifra, con su borde y el escudo a una tinta en la base
  const digits = [...(player.estampado ?? String(player.dorsal))];
  digitBoxes(assets.art, digits, text.cx, text.top + L.numberCentre * s, L.numberHeight * s, L.digitGap * s).forEach((box, i) => {
    ctx.drawImage(kit.digits[+digits[i]], box.x, box.y, box.w, box.h);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false; // convención UV de glTF
  tex.anisotropy = anisotropy;
  return tex;
}

/** Normal map repetible con el punto de malla del tejido técnico */
export function createFabricNormal(): THREE.DataTexture {
  const N = 128, cells = 8;
  const h = (x: number, y: number) => {
    const a = (x / N) * cells * Math.PI * 2, b = (y / N) * cells * Math.PI * 2;
    return 0.5 + 0.5 * Math.cos(a) * Math.cos(b);
  };
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * 2.2, dy = (h(x, y + 1) - h(x, y - 1)) * 2.2;
      const l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
      data[i] = (-dx / l) * 127 + 128;
      data[i + 1] = (-dy / l) * 127 + 128;
      data[i + 2] = (1 / l) * 127 + 128;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(62, 40);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
