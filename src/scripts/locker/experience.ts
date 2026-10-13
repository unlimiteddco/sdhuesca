import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Player, Pos } from '../../data/squad';
import { addBenchProps, createTag } from './props';
import { buildRoom, RAIL_Y } from './room';
import { createClothMaterial, type ClothUniforms } from './cloth';
import { createFabricNormal, createKitTexture, kitOf, SHIRT_SCALE, type KitAssets } from './jersey';

const SPACING = 0.125;
const GROUP_GAP = 0.46;
const YAW_REST = 1.2;
const CAM = new THREE.Vector3(0, 1.3, 3.5);
const FOV = 32;
// plano de entrada: la cámara arranca pegada a las camisetas y se retira hasta su sitio
const INTRO_FROM = new THREE.Vector3(1.3, 1.1, 1.5);
const INTRO_LOOK = new THREE.Vector3(0.2, 1.45, 0);
const INTRO_SECONDS = 3.6;
// resolución de las texturas: px de lienzo por px de la foto original
// móviles y tabletas: menos píxeles que mover
const LITE = innerWidth < 820 || matchMedia('(pointer: coarse)').matches;
const LOW = LITE ? 0.5 : 0.64, MID = LITE ? 1 : 1.3, HIGH = LITE ? 1.5 : 2;

interface Item {
  player: Player;
  pivot: THREE.Group;
  turn: THREE.Group;
  /** el gancho gira sobre sí mismo (percha giratoria): en la barra siempre la abraza de través */
  hook: THREE.Mesh;
  hookYaw: number;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  lowRes: THREE.Texture;
  hiRes?: THREE.Texture;
  /** resolución de `hiRes` (px de lienzo por px de foto) */
  hiK: number;
  cloth: ClothUniforms;
  phase: number;
  /** orientación y balanceo que lleva el bajo de la tela, siempre algo por detrás de la percha */
  lagYaw: number;
  lagYawVel: number;
  lagSwing: number;
  lagSwingVel: number;
  active: boolean;
  restX: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  swing: number;
  swingVel: number;
  prevWorldX: number;
  prevVel: number;
}

export interface FrameState {
  groups: { pos: Pos; x: number; y: number; visible: boolean }[];
  caption: { x: number; y: number } | null;
  stage: boolean;
  /** velocidad de la barra en m/s (para el sonido de roce) */
  speed: number;
}

export interface LockerCallbacks {
  onHover(player: Player | null): void;
  onSelect(player: Player | null): void;
  onFrame(state: FrameState): void;
  /** el plano de entrada ha terminado y el visitante ya tiene el control */
  onIntroEnd(): void;
}

const damp = (v: number, target: number, k: number, dt: number) => v + (target - v) * (1 - Math.exp(-k * dt));

export class LockerRoom {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 40);
  private rail = new THREE.Group();
  private items: Item[] = [];
  private dim: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private time = 0;
  private last = performance.now();
  private raycaster = new THREE.Raycaster();
  private anisotropy: number;

  private filter: Pos | null = null;
  private hover: Item | null = null;
  private selected: Item | null = null;
  private groups: { pos: Pos; minX: number; maxX: number }[] = [];
  private bounds = { min: 0, max: 0 };

  private scroll = 0;
  private scrollTarget = 0;
  private scrollVel = 0;
  private userYaw = 0;
  private yawVel = 0;
  private stageSince = 0;

  private pointer = { x: 0, y: 0, inside: false, down: false, moved: 0, startX: 0, startY: 0, lastX: 0, lastT: 0, touch: false };
  private dragging = false;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private raf = 0;
  private tmp = new THREE.Vector3();
  private clothTime = { value: 0 };
  private parallax = { x: 0, y: 0 };
  /** camisetas con textura nítida cargada (la abierta y las últimas señaladas) */
  private sharp: Item[] = [];
  private sharpTimer = 0;
  private custom!: Item;
  private touch = matchMedia('(hover: none)').matches;
  private intro = 0; // 0..1
  private introSpeed = 1 / INTRO_SECONDS;
  private introDone = false;
  private railSpeed = 0;

  constructor(private canvas: HTMLCanvasElement, players: Player[], private assets: KitAssets, private cb: LockerCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, LITE ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    this.scene.background = new THREE.Color(0x070504);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.18;
    pmrem.dispose();

    this.camera.position.copy(CAM);
    this.dim = buildRoom(this.scene, this.anisotropy, LITE).dim as typeof this.dim;
    addBenchProps(this.scene, assets.balls, assets.boots);
    this.scene.add(this.rail);

    const fabric = createFabricNormal();
    const metal = new THREE.MeshStandardMaterial({ color: 0xd8d2c8, roughness: 0.25, metalness: 1 });
    const wood = new THREE.MeshPhysicalMaterial({ color: 0x9a6a3a, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.35 });

    const add = (player: Player, i: number, onRail = true) => {
      const lowRes = createKitTexture(player, assets, LOW, this.anisotropy);
      const phase = (i * 2.399) % 6.283;
      const lining = assets.kits[kitOf(player)].info.lining;
      const { material, depth, uniforms } = createClothMaterial(lowRes, fabric, this.clothTime, phase, lining);
      uniforms.uAmp.value = this.reduced ? 0 : 0.009;
      const kit = assets.kits[kitOf(player)];
      const mesh = new THREE.Mesh(kit.shirt, material);
      mesh.customDepthMaterial = depth;
      const hanger = new THREE.Mesh(kit.hanger, wood);
      const hook = new THREE.Mesh(kit.hook, metal);
      mesh.castShadow = mesh.receiveShadow = hanger.receiveShadow = hook.castShadow = true;
      hook.scale.setScalar(SHIRT_SCALE);
      hook.rotation.y = Math.PI / 2;
      const turn = new THREE.Group();
      turn.scale.setScalar(SHIRT_SCALE);
      turn.add(mesh, hanger);
      const pivot = new THREE.Group();
      pivot.position.y = RAIL_Y;
      pivot.add(turn, hook);
      if (onRail) {
        const tag = createTag(player);
        tag.scale.setScalar(SHIRT_SCALE);
        tag.position.multiplyScalar(SHIRT_SCALE);
        pivot.add(tag);
      }
      this.rail.add(pivot);
      const start = 0;
      const item: Item = {
        player, pivot, turn, hook, hookYaw: Math.PI / 2, mesh, lowRes, hiK: 0, cloth: uniforms, phase, active: onRail, restX: 0,
        // arrancan meciéndose, como si alguien acabara de pasar la mano por la barra
        x: start, y: 0, z: 0, yaw: YAW_REST, scale: 1, swing: this.reduced ? 0 : 0.2 * Math.sin(i * 1.3 + 0.6), swingVel: 0, prevWorldX: start, prevVel: 0,
        lagYaw: YAW_REST, lagYawVel: 0, lagSwing: 0, lagSwingVel: 0,
      };
      this.items.push(item);
      return item;
    };
    players.forEach((player, i) => add(player, i));
    // la camiseta del personalizador: no cuelga de la barra, solo aparece en primer plano
    this.custom = add({ ...players[players.length - 1], id: 'custom', shirt: 'TU NOMBRE', dorsal: 12, pos: 'DEL', capitan: false }, players.length, false);
    this.custom.scale = 0.0001;

    this.layout();
    for (const it of this.items) { it.x += it.restX; it.prevWorldX = it.x; }
    this.scroll = this.scrollTarget = this.bounds.min;

    if (this.reduced) this.intro = 1;
    this.bind();
    this.resize();
    // los topes dependen del tamaño real del lienzo: la barra arranca en su extremo izquierdo
    this.scroll = this.scrollTarget = this.bounds.min;
    this.raf = requestAnimationFrame(this.tick);
  }

  /** Acorta el plano de entrada (cualquier clic o tecla durante la intro) */
  skipIntro() {
    if (!this.introDone) this.introSpeed = Math.max(this.introSpeed, 2.2);
  }

  get ready() {
    return this.introDone;
  }

  // ------------------------------------------------------------- API pública

  setFilter(pos: Pos | null) {
    this.filter = pos;
    for (const it of this.items) it.active = it !== this.custom && (!pos || it.player.pos === pos);
    this.layout();
    this.scrollTarget = this.bounds.min;
    this.scrollVel = 0;
    this.setHover(null);
  }

  select(id: string | null) {
    const next = id ? this.items.find((i) => i.player.id === id && (i.active || i === this.custom)) ?? null : null;
    if (next === this.selected) return;
    this.selected = next;
    this.userYaw = 0;
    this.yawVel = 0;
    if (next) {
      this.sharpen(next, HIGH);
      this.stageSince = this.time;
      // deja el hueco de la percha centrado para cuando vuelva
      if (next !== this.custom) this.scrollTarget = THREE.MathUtils.clamp(next.restX, this.bounds.min, this.bounds.max);
      this.scrollVel = 0;
      this.setHover(null);
    }
    this.canvas.style.cursor = next ? 'grab' : '';
    this.cb.onSelect(next?.player ?? null);
  }

  step(dir: 1 | -1) {
    const list = this.items.filter((i) => i.active);
    if (!list.length) return;
    const from = this.selected ?? this.hover;
    const i = from ? list.indexOf(from) : dir > 0 ? -1 : 0;
    const next = list[(i + dir + list.length) % list.length];
    if (this.selected) this.select(next.player.id);
    else {
      this.setHover(next);
      this.scrollTarget = THREE.MathUtils.clamp(next.restX, this.bounds.min, this.bounds.max);
    }
  }

  /** Cambia el nombre y el dorsal de la camiseta del personalizador y la vuelve a estampar */
  setCustom(name: string, number: string) {
    const it = this.custom;
    it.player.shirt = name;
    it.player.estampado = number;
    it.lowRes.dispose();
    it.lowRes = createKitTexture(it.player, this.assets, LOW, this.anisotropy);
    if (it.hiRes) {
      it.hiRes.dispose();
      it.hiRes = createKitTexture(it.player, this.assets, it.hiK, this.anisotropy);
    }
    it.mesh.material.map = it.hiRes ?? it.lowRes;
  }

  /** Percha que queda en el centro de la pantalla (en táctil hace de «cursor») */
  private centred(): Item | null {
    const x = -this.rail.position.x;
    let best: Item | null = null, bd = Infinity;
    for (const it of this.items) {
      const d = Math.abs(it.restX - x);
      if (it.active && d < bd) { bd = d; best = it; }
    }
    return best;
  }

  openHovered() {
    if (this.hover) this.select(this.hover.player.id);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
  }

  // ------------------------------------------------------------------ layout

  /** tan(fov/2) vertical; en pantallas estrechas se abre para que quepan varias perchas */
  private tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

  private viewHalf(dist = CAM.z) {
    return this.tanHalf * dist * this.camera.aspect;
  }

  private layout() {
    const visible = this.items.filter((i) => i.active);
    let x = 0;
    let prev: Pos | null = null;
    for (const it of visible) {
      if (prev && it.player.pos !== prev) x += GROUP_GAP;
      it.restX = x;
      x += SPACING;
      prev = it.player.pos;
    }
    const shift = visible.length ? (visible[0].restX + visible[visible.length - 1].restX) / 2 : 0;
    this.groups = [];
    for (const it of visible) {
      it.restX -= shift;
      const g = this.groups.find((g) => g.pos === it.player.pos);
      if (g) g.maxX = it.restX;
      else this.groups.push({ pos: it.player.pos, minX: it.restX, maxX: it.restX });
    }
    this.updateBounds();
  }

  private updateBounds() {
    const visible = this.items.filter((i) => i.active);
    if (!visible.length) { this.bounds = { min: 0, max: 0 }; return; }
    const pad = 0.55, half = this.viewHalf();
    const min = visible[0].restX - pad + half, max = visible[visible.length - 1].restX + pad - half;
    this.bounds = min < max ? { min, max } : { min: 0, max: 0 };
  }

  /** Hueco libre de la pantalla (0..1) donde se muestra la camiseta abierta; lo fija la interfaz */
  stageRect = { x0: 0.02, y0: 0.12, x1: 0.55, y1: 0.88 };

  /** Pose en primer plano: la camiseta se encaja en `stageRect` */
  private stagePose(out: THREE.Vector3) {
    const d = 2.1, r = this.stageRect;
    const vh = 2 * d * this.tanHalf, vw = vh * this.camera.aspect;
    const height = 0.03 - this.assets.size.bottom, width = this.assets.size.width + 0.04;
    const scale = Math.max(0.2, Math.min(1.25, ((r.y1 - r.y0) * vh * 0.9) / height, ((r.x1 - r.x0) * vw * 0.9) / width));
    out.set(((r.x0 + r.x1) / 2 - 0.5) * vw, CAM.y + (0.5 - (r.y0 + r.y1) / 2) * vh + (height / 2 - 0.03) * scale, CAM.z - d);
    return { pos: out, scale };
  }

  // ------------------------------------------------------------- interacción

  private bind() {
    const c = this.canvas;
    new ResizeObserver(() => this.resize()).observe(c);

    c.addEventListener('pointerdown', (e) => {
      if (!this.introDone) return this.skipIntro();
      c.setPointerCapture(e.pointerId);
      const p = this.pointer;
      Object.assign(p, { down: true, moved: 0, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastT: performance.now(), touch: e.pointerType !== 'mouse', inside: true });
      this.setPointer(e);
      this.scrollVel = 0;
      this.yawVel = 0;
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.pointer;
      p.inside = true;
      this.setPointer(e);
      if (!p.down) return;
      const dx = e.clientX - p.lastX, now = performance.now(), dt = Math.max(1, now - p.lastT) / 1000;
      p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.startX, e.clientY - p.startY));
      if (p.moved > 6 && !this.dragging) {
        this.dragging = true;
        c.style.cursor = 'grabbing';
        this.setHover(null);
      }
      if (this.dragging) {
        if (this.selected) {
          const d = dx * 0.011;
          this.userYaw += d;
          this.yawVel = d / dt;
        } else {
          const unit = (2 * this.viewHalf()) / c.clientWidth;
          this.scrollTarget -= dx * unit;
          this.scrollVel = (-dx * unit) / dt;
        }
      }
      p.lastX = e.clientX;
      p.lastT = now;
    });
    const up = (e: PointerEvent) => {
      const p = this.pointer;
      if (!p.down) return;
      p.down = false;
      const wasDrag = this.dragging;
      this.dragging = false;
      c.style.cursor = this.selected ? 'grab' : '';
      if (performance.now() - p.lastT > 80) { this.scrollVel = 0; this.yawVel = 0; }
      if (wasDrag || e.type === 'pointercancel') return;
      if (this.selected) {
        // clic sobre la camiseta = darle la vuelta; fuera = volver al vestuario
        this.raycaster.setFromCamera(new THREE.Vector2(p.x, p.y), this.camera);
        if (this.raycaster.intersectObject(this.selected.mesh).length) {
          this.userYaw = Math.round(this.userYaw / Math.PI + 1) * Math.PI;
        } else this.select(null);
      } else {
        const target = this.pick();
        if (target) this.select(target.player.id);
      }
      if (p.touch) p.inside = false;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => { this.pointer.inside = false; });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.introDone) return this.skipIntro();
      if (this.selected) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      this.scrollTarget += d * 0.0016;
    }, { passive: false });
  }

  private setPointer(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  /** Percha más cercana al puntero, usando los huecos en reposo (estable, sin parpadeos) */
  private pick(): Item | null {
    this.raycaster.setFromCamera(new THREE.Vector2(this.pointer.x, this.pointer.y), this.camera);
    const { origin, direction } = this.raycaster.ray;
    if (Math.abs(direction.z) < 1e-5) return null;
    const t = (0.1 - origin.z) / direction.z;
    const wx = origin.x + direction.x * t, wy = origin.y + direction.y * t;
    if (wy > RAIL_Y + 0.06 || wy < RAIL_Y + this.assets.size.bottom - 0.1) return null;
    const lx = wx - this.rail.position.x;
    let best: Item | null = null, bd = 0.17;
    for (const it of this.items) {
      if (!it.active) continue;
      const d = Math.abs(it.restX - lx);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  /** Cambia la textura de una camiseta por una versión nítida; solo se conservan las tres últimas */
  private sharpen(it: Item, k: number) {
    if (it.hiK < k) {
      it.hiRes?.dispose();
      it.hiRes = createKitTexture(it.player, this.assets, k, this.anisotropy);
      it.hiK = k;
      it.mesh.material.map = it.hiRes;
    }
    this.sharp = [it, ...this.sharp.filter((s) => s !== it)];
    for (const old of this.sharp.splice(3)) {
      if (old === this.selected) { this.sharp.push(old); continue; }
      old.mesh.material.map = old.lowRes;
      old.hiRes?.dispose();
      old.hiRes = undefined;
      old.hiK = 0;
    }
  }

  private setHover(it: Item | null) {
    if (it === this.hover) return;
    this.hover = it;
    clearTimeout(this.sharpTimer);
    // si el cursor se queda sobre una camiseta, se le sube la resolución
    if (it) this.sharpTimer = window.setTimeout(() => this.hover === it && this.sharpen(it, MID), 140);
    if (!this.selected) this.canvas.style.cursor = it ? 'pointer' : '';
    this.cb.onHover(it?.player ?? null);
  }

  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.tanHalf = Math.max(Math.tan(THREE.MathUtils.degToRad(FOV / 2)), 0.6 / (CAM.z * this.camera.aspect));
    this.camera.fov = THREE.MathUtils.radToDeg(Math.atan(this.tanHalf)) * 2;
    this.camera.updateProjectionMatrix();
    this.updateBounds();
    // setSize vacía el lienzo: se repinta ya para que no parpadee en negro
    this.renderer.render(this.scene, this.camera);
  }

  // ------------------------------------------------------------------- bucle

  private tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 1 / 20) || 1 / 60;
    this.last = now;
    const time = (this.time += dt);
    this.clothTime.value = time;
    const p = this.pointer;

    // desplazamiento de la barra con inercia y tope elástico
    if (!this.dragging && !this.selected) {
      this.scrollTarget += this.scrollVel * dt;
      this.scrollVel *= Math.exp(-3.2 * dt);
    }
    const { min, max } = this.bounds;
    const over = this.scrollTarget < min ? this.scrollTarget - min : this.scrollTarget > max ? this.scrollTarget - max : 0;
    if (over && !this.dragging) {
      this.scrollTarget -= over * (1 - Math.exp(-9 * dt));
      this.scrollVel *= 0.8;
    }
    this.scroll = damp(this.scroll, this.scrollTarget - over * 0.6 * +this.dragging, 9, dt);
    this.railSpeed = damp(this.railSpeed, (-this.scroll - this.rail.position.x) / dt, 14, dt);
    this.rail.position.x = -this.scroll;

    // cámara: plano de entrada y, después, un ligero paralaje con el cursor
    if (!this.introDone) {
      this.intro = Math.min(1, this.intro + dt * this.introSpeed);
      if (this.intro >= 1) {
        this.introDone = true;
        this.cb.onIntroEnd();
      }
    }
    const e = this.intro < 0.5 ? 4 * this.intro ** 3 : 1 - (-2 * this.intro + 2) ** 3 / 2;
    const par = this.selected || this.reduced || !this.introDone ? 0 : 1;
    this.parallax.x = damp(this.parallax.x, p.inside ? p.x * 0.07 * par : 0, 3, dt);
    this.parallax.y = damp(this.parallax.y, p.inside ? p.y * 0.035 * par : 0, 3, dt);
    this.camera.position.set(
      THREE.MathUtils.lerp(INTRO_FROM.x, this.parallax.x, e),
      THREE.MathUtils.lerp(INTRO_FROM.y, CAM.y + this.parallax.y, e),
      THREE.MathUtils.lerp(INTRO_FROM.z, CAM.z, e),
    );
    this.camera.lookAt(
      THREE.MathUtils.lerp(INTRO_LOOK.x, this.parallax.x * 0.4, e),
      THREE.MathUtils.lerp(INTRO_LOOK.y, CAM.y, e),
      0,
    );
    this.camera.updateMatrixWorld();

    if (!this.introDone) this.setHover(null);
    else if (!this.selected && !this.dragging && p.inside && !p.touch) this.setHover(this.pick());
    else if (this.touch && !this.selected && !this.kbd) {
      // sin cursor: la camiseta del centro se gira sola al pasar, y la barra se asienta sobre ella
      const c = this.centred();
      this.setHover(c);
      if (c && !this.dragging && Math.abs(this.scrollVel) < 0.25) {
        this.scrollTarget = damp(this.scrollTarget, THREE.MathUtils.clamp(c.restX, this.bounds.min, this.bounds.max), 5, dt);
      }
    }
    else if (!p.inside && !this.selected && !p.touch && this.hover && !this.kbd) this.setHover(null);

    // camiseta en primer plano
    if (this.selected) {
      if (!this.dragging) {
        this.userYaw += this.yawVel * dt;
        this.yawVel *= Math.exp(-2.6 * dt);
      }
    }
    const stage = this.stagePose(this.tmp);
    const sway = this.reduced ? 0 : Math.sin((time - this.stageSince) * 0.7) * 0.16;

    const visible = this.items.filter((i) => i.active);
    const hi = this.hover && !this.selected ? visible.indexOf(this.hover) : -1;

    for (const it of this.items) {
      let tx = it.restX, ty = 0, tz = 0, yaw = YAW_REST, sc = it.active ? 1 : 0.0001, k = 7;
      if (it === this.selected) {
        tx = stage.pos.x - this.rail.position.x;
        ty = stage.pos.y - RAIL_Y;
        tz = stage.pos.z;
        sc = stage.scale;
        yaw = this.userYaw + sway;
        k = 5.5;
      } else if (hi >= 0) {
        const d = visible.indexOf(it) - hi;
        if (d === 0) { tz = 0.34; yaw = 0; sc = 1.07; k = 9; }
        else if (it.active) tx += Math.sign(d) * 0.22 * Math.exp(-(Math.abs(d) - 1) / 7);
      }
      it.x = damp(it.x, tx, k, dt);
      it.y = damp(it.y, ty, k, dt);
      it.z = damp(it.z, tz, k, dt);
      it.yaw = damp(it.yaw, yaw, it === this.selected ? 7 : k, dt);
      it.scale = damp(it.scale, sc, 9, dt);

      // péndulo: la aceleración lateral hace balancear la percha
      const worldX = it.x + this.rail.position.x;
      const vel = (worldX - it.prevWorldX) / dt;
      const acc = THREE.MathUtils.clamp((vel - it.prevVel) / dt, -60, 60);
      it.prevWorldX = worldX;
      it.prevVel = vel;
      if (this.reduced || it === this.selected) {
        it.swing = damp(it.swing, 0, 8, dt);
        it.swingVel = 0;
      } else {
        // una corriente muy leve mantiene las perchas vivas aunque nadie las toque
        const breeze = 0.5 * Math.sin(time * 0.7 + it.phase) + 0.3 * Math.sin(time * 1.31 + it.phase * 2.1);
        it.swingVel += (-34 * it.swing - 3.4 * it.swingVel + acc * 0.085 + breeze) * dt;
        it.swing = THREE.MathUtils.clamp(it.swing + it.swingVel * dt, -0.55, 0.55);
      }

      // la tela sigue a la percha con retraso: el bajo se retuerce al girar y se queda atrás al balancearse
      if (this.reduced) {
        it.lagYaw = it.yaw;
        it.lagSwing = it.swing;
      } else {
        it.lagYawVel += ((it.yaw - it.lagYaw) * 70 - it.lagYawVel * 8) * dt;
        it.lagYaw += it.lagYawVel * dt;
        it.lagSwingVel += ((it.swing - it.lagSwing) * 55 - it.lagSwingVel * 6) * dt;
        it.lagSwing += it.lagSwingVel * dt;
      }
      const bend = THREE.MathUtils.clamp(it.lagSwing - it.swing, -0.35, 0.35) * 0.7;
      it.cloth.uTwist.value = THREE.MathUtils.clamp(it.lagYaw - it.yaw, -0.7, 0.7);
      it.cloth.uBend.value.set(Math.cos(it.yaw) * bend, Math.sin(it.yaw) * bend);

      it.pivot.visible = it.scale > 0.01;
      it.pivot.position.set(it.x, RAIL_Y + it.y, it.z);
      it.pivot.rotation.z = it.swing;
      it.pivot.scale.setScalar(it.scale);
      it.turn.rotation.y = it.yaw;
      // en la barra el gancho queda de través; al descolgar la camiseta se alinea con ella
      it.hookYaw = damp(it.hookYaw, it === this.selected ? it.yaw : Math.PI / 2, 6, dt);
      it.hook.rotation.y = it.hookYaw;
    }

    const dimTo = this.selected ? 0.78 : 0;
    this.dim.material.opacity = damp(this.dim.material.opacity, dimTo, 6, dt);
    this.dim.visible = this.dim.material.opacity > 0.005;

    this.renderer.render(this.scene, this.camera);
    this.cb.onFrame(this.frameState());
  };

  /** true mientras el hover lo controla el teclado */
  kbd = false;

  private project(x: number, y: number, z: number) {
    const v = this.tmp.set(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * this.canvas.clientHeight };
  }

  private frameState(): FrameState {
    const w = this.canvas.clientWidth;
    const groups = this.groups.map((g) => {
      const p = this.project(g.minX + this.rail.position.x - 0.06, RAIL_Y + 0.07, 0);
      const end = this.project(g.maxX + this.rail.position.x + 0.2, RAIL_Y, 0).x;
      // la etiqueta se queda pegada al borde mientras su grupo siga en pantalla
      const x = Math.min(Math.max(p.x, 20), Math.max(end - 150, 20));
      return { pos: g.pos, x, y: p.y, visible: end > 60 && p.x < w - 40 };
    });
    let caption: FrameState['caption'] = null;
    const h = this.hover;
    if (h && !this.selected) {
      caption = this.project(h.x + this.rail.position.x, RAIL_Y + this.assets.size.bottom * h.scale - 0.07, h.z);
    }
    return { groups, caption, stage: !!this.selected, speed: this.selected ? 0 : this.railSpeed };
  }
}
