import * as THREE from 'three';

export const RAIL_Y = 1.8;
const LENGTH = 34;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Panel de lamas verticales de nogal: color + relieve */
function slatTextures() {
  const S = 1024, slats = 8, w = S / slats;
  const rand = rng(7);
  const color = document.createElement('canvas');
  const bump = document.createElement('canvas');
  color.width = color.height = bump.width = bump.height = S;
  const c = color.getContext('2d')!, b = bump.getContext('2d')!;
  b.fillStyle = '#fff';
  b.fillRect(0, 0, S, S);
  for (let i = 0; i < slats; i++) {
    const tone = 0.82 + rand() * 0.36;
    const g = c.createLinearGradient(i * w, 0, (i + 1) * w, 0);
    g.addColorStop(0, `rgb(${52 * tone},${31 * tone},${19 * tone})`);
    g.addColorStop(0.5, `rgb(${70 * tone},${42 * tone},${25 * tone})`);
    g.addColorStop(1, `rgb(${46 * tone},${27 * tone},${16 * tone})`);
    c.fillStyle = g;
    c.fillRect(i * w, 0, w, S);
    // veta
    for (let k = 0; k < 46; k++) {
      const x = i * w + rand() * w, wob = (rand() - 0.5) * 10;
      c.strokeStyle = `rgba(${rand() > 0.5 ? '20,10,5' : '120,78,48'},${0.05 + rand() * 0.12})`;
      c.lineWidth = 0.6 + rand() * 1.6;
      c.beginPath();
      c.moveTo(x, 0);
      c.bezierCurveTo(x + wob, S * 0.33, x - wob, S * 0.66, x, S);
      c.stroke();
    }
    // ranura
    c.fillStyle = '#080503';
    c.fillRect(i * w, 0, 12, S);
    const gg = b.createLinearGradient(i * w, 0, i * w + 22, 0);
    gg.addColorStop(0, '#000');
    gg.addColorStop(0.55, '#000');
    gg.addColorStop(1, '#fff');
    b.fillStyle = gg;
    b.fillRect(i * w, 0, 22, S);
  }
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bump);
  for (const t of [map, bumpMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(LENGTH / 0.9, 1);
  }
  return { map, bumpMap };
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,196,128,1)');
  g.addColorStop(0.25, 'rgba(255,170,100,0.45)');
  g.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildRoom(scene: THREE.Scene, anisotropy: number, lite = false) {
  const room = new THREE.Group();
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    room.add(m);
    return m;
  };

  const { map, bumpMap } = slatTextures();
  map.anisotropy = anisotropy;
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(LENGTH, 3.4),
    new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 2.5, roughness: 0.7, metalness: 0.05, color: 0x6e625a }),
  );
  wall.position.set(0, 1.7, -0.5);
  wall.receiveShadow = true;
  room.add(wall);

  const darkWood = new THREE.MeshStandardMaterial({ color: 0x1b110a, roughness: 0.5, metalness: 0.1 });
  const midWood = new THREE.MeshStandardMaterial({ color: 0x2c1b10, roughness: 0.55 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x4f0b18, roughness: 0.5 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc79a5b, roughness: 0.28, metalness: 1 });

  // altillo + tira LED
  box(LENGTH, 1.6, 0.9, darkWood, 0, 3.0, -0.1);
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(LENGTH, 0.006, 0.03),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.95, 0.5), toneMapped: false }),
  );
  led.position.set(0, 2.194, -0.4);
  room.add(led);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(LENGTH, 1.5),
    new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.position.set(0, 2.2 - 0.75, -0.495);
  room.add(glow);

  // banco
  box(LENGTH, 0.07, 0.95, midWood, 0, 0.52, -0.05);
  box(LENGTH, 0.06, 0.8, leather, 0, 0.585, -0.08);
  box(LENGTH, 0.5, 0.05, darkWood, 0, 0.25, 0.38);
  const stripe = box(LENGTH, 0.012, 0.01, brass, 0, 0.5, 0.41);
  stripe.receiveShadow = false;

  // separadores y soportes de la barra
  for (let x = -LENGTH / 2 + 1; x < LENGTH / 2; x += 1.9) {
    const sep = box(0.03, 1.66, 0.36, midWood, x, 1.38, -0.32);
    sep.castShadow = true;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.39, 10), brass);
    arm.position.set(x, RAIL_Y + 0.195, 0);
    room.add(arm);
  }

  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, LENGTH, 16), brass);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, RAIL_Y, 0);
  rail.castShadow = true;
  room.add(rail);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(LENGTH, 10),
    new THREE.MeshStandardMaterial({ color: 0x0d0907, roughness: 0.35, metalness: 0.2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 3;
  floor.receiveShadow = true;
  room.add(floor);

  // luces
  scene.add(new THREE.HemisphereLight(0xffe9d4, 0x1a0f08, 0.2));
  // luz principal alta y lateral: rasante sobre la tela, para que cada pliegue tenga su sombra
  const key = new THREE.DirectionalLight(0xfff3e4, 3.4);
  key.position.set(3.1, 4.6, 2.6);
  key.target.position.set(0, 1.2, 0);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(lite ? 1024 : 2048);
  const sc = key.shadow.camera;
  sc.left = -4.5; sc.right = 4.5; sc.top = 2.2; sc.bottom = -2.2; sc.near = 1; sc.far = 12;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.009;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  // relleno frío desde el otro lado: recorta la silueta sin aplanar el volumen
  const fill = new THREE.DirectionalLight(0xbfd2ff, 0.55);
  fill.position.set(-3.5, 2.2, 3);
  scene.add(fill);
  const warm = new THREE.PointLight(0xffb070, 2.2, 5, 1.6);
  warm.position.set(0, 2.1, 0.5);
  scene.add(warm);

  // velo que oscurece el vestuario cuando hay una camiseta en primer plano
  const dim = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 20),
    new THREE.MeshBasicMaterial({ color: 0x060403, transparent: true, opacity: 0, depthWrite: false }),
  );
  dim.position.set(0, 1.3, 0.85);
  dim.visible = false;
  scene.add(dim);

  scene.add(room);
  return { dim };
}
