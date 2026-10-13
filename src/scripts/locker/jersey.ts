import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Player } from '../../data/squad';
import kitInfo from '../../data/kit.json';
import { LETTERING, nameAngles } from './lettering';

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
  info: (typeof kitInfo)[KitName];
}

export interface KitAssets {
  kits: Record<KitName, Kit>;
  /** Escudo, para el detalle que lleva el dorsal en su base */
  crest: HTMLImageElement;
  /** Balón de Poly Haven (CC0) */
  balls: THREE.Object3D[];
  /** Botas generadas con Magnific (texto a 3D): una por modelo, pie derecho */
  boots: THREE.Object3D[];
  /** Medidas ya escaladas de la prenda más grande, relativas al pivote (la barra) */
  size: { width: number; bottom: number };
}

const url = (path: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`;

function image(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    img.src = url(src);
  });
}

async function loadKit(name: KitName): Promise<Kit> {
  const [gltf, front, back] = await Promise.all([
    new GLTFLoader().loadAsync(url(`/models/camiseta-${name}.glb`)),
    image(`/kit/${name}-front.webp`),
    image(`/kit/${name}-back.webp`),
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
  return { shirt: geometry('camiseta'), hanger: geometry('percha'), hook: geometry('gancho'), front, back, info: kitInfo[name] };
}

export async function loadKitAssets(): Promise<KitAssets> {
  const loader = new GLTFLoader();
  const model = (name: string) => loader.loadAsync(url(`/models/${name}.glb`)).then((g) => g.scene);
  const [campo, portero, crest, ball, ...boots] = await Promise.all([
    loadKit('campo'),
    loadKit('portero'),
    image('/escudo/sd-huesca.webp'),
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
  return { kits: { campo, portero }, crest, balls, boots, size };
}

const FONT = '"Bebas Neue"';

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
  // se lee algún píxel suelto (base de cada cifra): mejor un lienzo en memoria que ir y volver de la GPU
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
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

  // dorsal, cifra a cifra; cada una lleva un escudo diminuto en su base si ahí hay trazo
  const height = L.numberHeight * s;
  const base = text.top + L.numberCentre * s + height / 2;
  ctx.font = `${height / L.cap}px ${FONT}`;
  ctx.lineWidth = 5 * s;
  const digits = [...(player.estampado ?? String(player.dorsal))];
  const widths = digits.map((d) => ctx.measureText(d).width);
  const gap = L.digitGap * s;
  let x = text.cx - (widths.reduce((a, b) => a + b, 0) + gap * (digits.length - 1)) / 2;
  const ink = new THREE.Color(text.ink).convertLinearToSRGB();
  const centres = digits.map((d, i) => {
    const cx = x + widths[i] / 2;
    ctx.strokeText(d, cx, base);
    ctx.fillText(d, cx, base);
    x += widths[i] + gap;
    return cx;
  });
  const ch = 17 * s, cw = (ch * assets.crest.naturalWidth) / assets.crest.naturalHeight;
  for (const cx of centres) {
    const cy = base - 0.058 * height;
    const px = ctx.getImageData(Math.round(w + (cx - crop.x) * k), Math.round((cy - crop.y) * k), 1, 1).data;
    if (Math.abs(px[0] / 255 - ink.r) < 0.1 && Math.abs(px[1] / 255 - ink.g) < 0.1 && Math.abs(px[2] / 255 - ink.b) < 0.1) {
      ctx.drawImage(assets.crest, cx - cw / 2, cy - ch / 2, cw, ch);
    }
  }

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
