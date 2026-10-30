import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CLUB } from '../../club';
import type { Player } from '../../data/players';

const T = CLUB.room.tag;

const BENCH_TOP = 0.615;

function texture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  // las tapas del cilindro traen el UV girado un cuarto de vuelta: se endereza aquí
  t.center.set(0.5, 0.5);
  t.rotation = Math.PI / 2;
  return t;
}

// ------------------------------------------------------------ chapa del gancho

const tagGeometry = new THREE.CylinderGeometry(0.023, 0.023, 0.0026, 36).rotateX(Math.PI / 2);
const linkGeometry = new THREE.TorusGeometry(0.0065, 0.0011, 6, 18);
const brassEdge = new THREE.MeshStandardMaterial({ color: T.edge, roughness: 0.35, metalness: 1 });

/** Chapa de latón con el dorsal, colgada del gancho de cada percha. La del capitán es amarilla con una C. */
export function createTag(player: Player): THREE.Group {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(62, 52, 8, 80, 80, 86);
  const [light, dark] = player.capitan ? T.captain : T.face;
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 160, 160);
  ctx.strokeStyle = 'rgba(40,24,6,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(80, 80, 66, 0, Math.PI * 2);
  ctx.stroke();
  const label = player.capitan ? 'C' : String(player.dorsal);
  ctx.font = `${label.length > 1 ? 78 : 92}px Anton`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // grabado: sombra clara debajo y relleno oscuro
  ctx.fillStyle = 'rgba(255,240,200,0.5)';
  ctx.fillText(label, 80, 113);
  ctx.fillStyle = player.capitan ? T.captainInk : T.ink;
  ctx.fillText(label, 80, 111);

  const face = new THREE.MeshStandardMaterial({ map: texture(c), roughness: player.capitan ? 0.3 : 0.42, metalness: player.capitan ? 0.2 : 0.9 });
  const disc = new THREE.Mesh(tagGeometry, [brassEdge, face, face]);
  disc.castShadow = true;
  const link = new THREE.Mesh(linkGeometry, brassEdge);
  link.position.y = 0.0245;
  link.rotation.y = Math.PI / 2;
  const tag = new THREE.Group();
  tag.add(disc, link);
  tag.position.set(0.004, -0.066, 0.011);
  tag.rotation.z = ((player.dorsal * 37) % 11) * 0.02 - 0.1;
  return tag;
}

// --------------------------------------------------------------------- banco

/**
 * Atrezo sobre el banco: balones (modelo de Poly Haven, CC0), botas (generadas con Magnific)
 * y toallas dobladas. Es fijo: no se mueve con la barra.
 */
export function addBenchProps(scene: THREE.Scene, balls: THREE.Object3D[], boots: THREE.Object3D[]) {
  const props = new THREE.Group();
  const towelGeo = new RoundedBoxGeometry(0.34, 0.042, 0.25, 4, 0.019);
  const towelMat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 1 });
  const [white, blue, red] = CLUB.room.towels.map(towelMat);

  const ball = (model: THREE.Object3D, x: number, z: number, spin: number) => {
    const m = model.clone();
    m.traverse((o) => {
      o.castShadow = o.receiveShadow = true;
    });
    // el modelo viene apoyado en y=0: se gira alrededor de su centro para que no se repitan iguales
    const turn = new THREE.Group();
    m.position.y = -0.11;
    turn.add(m);
    turn.rotation.set(spin, spin * 2.3, spin * 0.7);
    turn.position.set(x, BENCH_TOP + 0.11, z);
    props.add(turn);
  };
  // un par: la bota del modelo (pie derecho) y su espejo, dejadas con descuido una junto a otra
  const pair = (model: THREE.Object3D, x: number, turn: number) => {
    const group = new THREE.Group();
    for (const [side, dx, rot] of [[1, 0, 0.1], [-1, 0.04, -0.28]] as const) {
      const boot = model.clone();
      boot.traverse((o) => {
        o.castShadow = o.receiveShadow = true;
      });
      boot.scale.z = side;
      boot.position.set(dx, 0, side * 0.07);
      boot.rotation.y = rot;
      group.add(boot);
    }
    group.position.set(x, BENCH_TOP, 0.12);
    group.rotation.y = turn;
    props.add(group);
  };
  const towels = (x: number, colors: THREE.Material[]) => {
    colors.forEach((mat, i) => {
      const m = new THREE.Mesh(towelGeo, mat);
      m.position.set(x + (i % 2 ? 0.008 : -0.006), BENCH_TOP + 0.021 + i * 0.043, 0.06);
      m.rotation.y = (i - 1) * 0.07;
      m.castShadow = m.receiveShadow = true;
      props.add(m);
    });
  };

  const [clean] = balls;
  const [black, whiteBoot] = boots;
  towels(-3.55, [white, red, white]);
  pair(whiteBoot, -2.9, 0.35);
  ball(clean, -2.2, 0.02, 0.4);
  pair(black, -1.45, -0.2);
  towels(-0.42, [white, blue, white]);
  pair(whiteBoot, 0.5, 0.25);
  ball(clean, 1.52, 0.06, 1.7);
  ball(clean, 1.76, -0.12, 3.1);
  pair(black, 2.45, -0.4);
  towels(3.45, [blue, white, red]);
  ball(clean, 4.3, 0.0, 2.6);
  scene.add(props);
}
