import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CLUB } from '../../club';
import type { Player } from '../../data/players';
import { createClothMaterial, type ClothUniforms } from './cloth';
import { createFabricNormal, createKitTexture, kitOf, SHIRT_SCALE, type KitAssets } from './jersey';
import { addBenchProps, createTag } from './props';
import { buildRoom, RAIL_Y } from './room';

/**
 * Vídeo vertical de la convocatoria: el vestuario con la barra vacía y las perchas de los convocados
 * llegando una a una, por bloques (porteros, defensas… o titulares y banquillo). Los rótulos se pintan
 * en un lienzo 2D encima de la escena, así el mismo lienzo sirve de vista previa y de fotograma del vídeo.
 */

export interface Match {
  rival: string;
  jornada: string;
  fecha: string;
  campo: string;
  /** true: jugamos en casa (el club va primero en el rótulo) */
  casa: boolean;
}

export interface Section {
  label: string;
  players: Player[];
}

// ritmo, en segundos
const INTRO = 2.8;
const SECTION = 1.15;
const PER = 0.95;
const ARRIVE = 0.62;
const OUTRO = 4.8;
/** metros que recorre cada percha por la barra hasta su hueco */
const SLIDE = 1.5;

const SPACING = 0.125;
const GROUP_GAP = 0.46;
const YAW_REST = 1.2;
const FOV = 36;
const CAM_Z = 2.95;
const LOOK_Y = 1.35;
// texturas: la camiseta que llega en grande, nítida; las de la barra, ligeras
const LOW = 0.6, HIGH = 1.5;

interface Item {
  player: Player;
  pivot: THREE.Group;
  turn: THREE.Group;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  lowRes: THREE.Texture;
  hiRes?: THREE.Texture;
  cloth: ClothUniforms;
  phase: number;
  /** segundo del vídeo en que entra en la barra */
  at: number;
  restX: number;
  x: number;
  z: number;
  yaw: number;
  scale: number;
  swing: number;
  swingVel: number;
  prevX: number;
  prevVel: number;
  lagYaw: number;
  lagYawVel: number;
  lagSwing: number;
  lagSwingVel: number;
}

type Beat = { t: number; end: number } & (
  | { kind: 'section'; section: Section; first: Item }
  | { kind: 'player'; item: Item; n: number }
  | { kind: 'outro' }
);

const damp = (v: number, target: number, k: number, dt: number) => v + (target - v) * (1 - Math.exp(-k * dt));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);
const easeOut = (u: number) => 1 - (1 - u) ** 3;

export class CallUp {
  private ctx: CanvasRenderingContext2D;
  private gl = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 9 / 16, 0.1, 40);
  private rail = new THREE.Group();
  private anisotropy: number;
  private fabric = createFabricNormal();
  private metal = new THREE.MeshStandardMaterial({ color: CLUB.room.rail, roughness: 0.25, metalness: 1 });
  private wood = new THREE.MeshPhysicalMaterial({ color: CLUB.room.hanger, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.35 });
  private clothTime = { value: 0 };
  private items: Item[] = [];
  private beats: Beat[] = [];
  private match!: Match;
  private crest = new Image();
  private t = 0;
  private camX = 0;
  private look = new THREE.Vector3();
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  duration = 0;

  constructor(readonly canvas: HTMLCanvasElement, private assets: KitAssets) {
    this.ctx = canvas.getContext('2d')!;
    // se copia al lienzo 2D justo después de pintar: hay que conservar el búfer
    this.renderer = new THREE.WebGLRenderer({ canvas: this.gl, antialias: true, preserveDrawingBuffer: true });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    this.scene.background = new THREE.Color(CLUB.room.background);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.18;
    pmrem.dispose();
    buildRoom(this.scene, this.anisotropy);
    addBenchProps(this.scene, assets.balls, assets.boots);
    this.scene.add(this.rail);
    this.crest.src = `${import.meta.env.BASE_URL.replace(/\/$/, '')}${CLUB.crest.src}`;
  }

  /** Cambia la lista de convocados o el partido; el vídeo vuelve a empezar */
  setPlan(sections: Section[], match: Match) {
    this.match = match;
    for (const it of this.items) {
      this.rail.remove(it.pivot);
      it.lowRes.dispose();
      it.hiRes?.dispose();
      it.mesh.material.dispose();
    }
    this.items = [];
    this.beats = [];

    let x = 0, t = INTRO, n = 0;
    for (const section of sections.filter((s) => s.players.length)) {
      if (this.items.length) x += GROUP_GAP;
      const first = this.items.length;
      for (const player of section.players) {
        const it = this.add(player, x, t + SECTION + (this.items.length - first) * PER);
        x += SPACING;
        this.items.push(it);
      }
      this.beats.push({ t, end: t + SECTION, kind: 'section', section, first: this.items[first] });
      t += SECTION;
      for (const item of this.items.slice(first)) {
        this.beats.push({ t, end: t + PER, kind: 'player', item, n: ++n });
        t += PER;
      }
    }
    this.beats.push({ t, end: t + OUTRO, kind: 'outro' });
    this.duration = t + OUTRO;
    // la fila queda centrada en el vestuario (y dentro de la sombra de la luz principal)
    const shift = this.items.length ? (this.items[0].restX + this.items[this.items.length - 1].restX) / 2 : 0;
    for (const it of this.items) it.restX -= shift;
    this.restart();
  }

  private add(player: Player, restX: number, at: number): Item {
    const kit = this.assets.kits[kitOf(player)];
    const lowRes = createKitTexture(player, this.assets, LOW, this.anisotropy);
    const phase = (this.items.length * 2.399) % 6.283;
    const { material, depth, uniforms } = createClothMaterial(lowRes, this.fabric, this.clothTime, phase, kit.info.lining);
    uniforms.uAmp.value = 0.009;
    const mesh = new THREE.Mesh(kit.shirt, material);
    mesh.customDepthMaterial = depth;
    const hanger = new THREE.Mesh(kit.hanger, this.wood);
    const hook = new THREE.Mesh(kit.hook, this.metal);
    mesh.castShadow = mesh.receiveShadow = hanger.receiveShadow = hook.castShadow = true;
    hook.scale.setScalar(SHIRT_SCALE);
    hook.rotation.y = Math.PI / 2;
    const turn = new THREE.Group();
    turn.scale.setScalar(SHIRT_SCALE);
    turn.add(mesh, hanger);
    const tag = createTag(player);
    tag.scale.setScalar(SHIRT_SCALE);
    tag.position.multiplyScalar(SHIRT_SCALE);
    const pivot = new THREE.Group();
    pivot.add(turn, hook, tag);
    pivot.visible = false;
    this.rail.add(pivot);
    return {
      player, pivot, turn, mesh, lowRes, cloth: uniforms, phase, at, restX,
      x: 0, z: 0, yaw: 0, scale: 1, swing: 0, swingVel: 0, prevX: 0, prevVel: 0, lagYaw: 0, lagYawVel: 0, lagSwing: 0, lagSwingVel: 0,
    };
  }

  /** Tamaño del fotograma en píxeles (9:16) */
  setSize(width: number, height: number) {
    this.canvas.width = this.gl.width = width;
    this.canvas.height = this.gl.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  restart() {
    this.t = 0;
    this.camX = this.items[0]?.restX ?? 0;
    for (const it of this.items) {
      it.pivot.visible = false;
      if (it.hiRes) {
        it.hiRes.dispose();
        it.hiRes = undefined;
        it.mesh.material.map = it.lowRes;
      }
    }
  }

  get time() {
    return this.t;
  }

  private beatAt(t: number) {
    let current: Beat | undefined;
    for (const b of this.beats) if (b.t <= t) current = b;
    return current;
  }

  /** La camiseta que entra (y la siguiente) con textura nítida; el resto, ligera */
  private sharpen(keep: Item[]) {
    for (const it of this.items) {
      if (keep.includes(it)) {
        if (!it.hiRes) it.hiRes = createKitTexture(it.player, this.assets, HIGH, this.anisotropy);
        it.mesh.material.map = it.hiRes;
      } else if (it.hiRes && this.t > it.at + PER * 2) {
        it.mesh.material.map = it.lowRes;
        it.hiRes.dispose();
        it.hiRes = undefined;
      }
    }
  }

  /** Avanza el vídeo `dt` segundos */
  advance(dt: number) {
    const t = (this.t += dt);
    this.clothTime.value = t;
    const beat = this.beatAt(t);
    const featured = beat?.kind === 'player' ? beat.item : null;
    if (featured) {
      const i = this.items.indexOf(featured);
      this.sharpen(this.items.slice(i, i + 2));
    }
    const shown = this.items.filter((it) => t >= it.at);
    const fi = featured ? shown.indexOf(featured) : -1;

    for (const it of this.items) {
      if (t < it.at) {
        it.pivot.visible = false;
        continue;
      }
      if (!it.pivot.visible) {
        // entra por la derecha ya de espaldas, con el nombre a la vista
        Object.assign(it, { x: it.restX + SLIDE, z: 0.32, yaw: 0, scale: 1.06, swing: 0, swingVel: 0, lagYaw: 0, lagYawVel: 0, lagSwing: 0, lagSwingVel: 0 });
        it.prevX = it.x;
        it.prevVel = (-3 * SLIDE) / ARRIVE;
      }
      let tx = it.restX, tz = 0, yaw = YAW_REST, sc = 1;
      if (it === featured) {
        tz = 0.32;
        yaw = 0;
        sc = 1.06;
      } else if (fi >= 0) {
        // las de al lado se apartan para dejarle sitio
        const d = shown.indexOf(it) - fi;
        tx += Math.sign(d) * 0.22 * Math.exp(-(Math.abs(d) - 1) / 7);
      }
      const local = t - it.at;
      it.x = local < ARRIVE ? tx + SLIDE * (1 - easeOut(local / ARRIVE)) : damp(it.x, tx, 6, dt);
      it.z = damp(it.z, tz, 6, dt);
      it.yaw = damp(it.yaw, yaw, 6, dt);
      it.scale = damp(it.scale, sc, 8, dt);

      // péndulo: el frenazo al llegar a su hueco hace balancear la percha (mismo modelo que el vestuario)
      const vel = (it.x - it.prevX) / dt;
      const acc = THREE.MathUtils.clamp((vel - it.prevVel) / dt, -60, 60);
      it.prevX = it.x;
      it.prevVel = vel;
      const breeze = 0.5 * Math.sin(t * 0.7 + it.phase) + 0.3 * Math.sin(t * 1.31 + it.phase * 2.1);
      it.swingVel += (-34 * it.swing - 3.4 * it.swingVel + acc * 0.085 + breeze) * dt;
      it.swing = THREE.MathUtils.clamp(it.swing + it.swingVel * dt, -0.55, 0.55);
      it.lagYawVel += ((it.yaw - it.lagYaw) * 70 - it.lagYawVel * 8) * dt;
      it.lagYaw += it.lagYawVel * dt;
      it.lagSwingVel += ((it.swing - it.lagSwing) * 55 - it.lagSwingVel * 6) * dt;
      it.lagSwing += it.lagSwingVel * dt;
      const bend = THREE.MathUtils.clamp(it.lagSwing - it.swing, -0.35, 0.35) * 0.7;
      it.cloth.uTwist.value = THREE.MathUtils.clamp(it.lagYaw - it.yaw, -0.7, 0.7);
      it.cloth.uBend.value.set(Math.cos(it.yaw) * bend, Math.sin(it.yaw) * bend);

      it.pivot.visible = true;
      it.pivot.position.set(it.x, RAIL_Y, it.z);
      it.pivot.rotation.z = it.swing;
      it.pivot.scale.setScalar(it.scale);
      it.turn.rotation.y = it.yaw;
    }

    // cámara: sigue al hueco de la percha que llega; al final se va al extremo y mira a lo largo de la barra
    const last = this.items[this.items.length - 1];
    const cx = !beat ? this.items[0]?.restX ?? 0 : beat.kind === 'section' ? beat.first.restX : beat.kind === 'player' ? beat.item.restX : last?.restX ?? 0;
    this.camX = damp(this.camX, cx, 2.8, dt);
    const dolly = easeInOut(clamp01(t / INTRO));
    const out = beat?.kind === 'outro' ? easeInOut(clamp01((t - beat.t) / 2.4)) : 0;
    const lx = last?.restX ?? 0;
    this.from.set(this.camX, LOOK_Y, CAM_Z + (1 - dolly) * 0.9);
    // casi a ras de la barra: en vertical el encuadre es estrecho y hay que mirar a lo largo de la fila
    this.to.set(lx + 1.5, 1.42, 0.42);
    this.camera.position.lerpVectors(this.from, this.to, out);
    this.from.set(this.camX, LOOK_Y, 0);
    this.to.set(lx - 2.2, 1.32, -0.12);
    this.look.lerpVectors(this.from, this.to, out);
    this.camera.lookAt(this.look);
    this.camera.updateMatrixWorld();
  }

  /** Pinta el fotograma actual: escena y rótulos */
  draw() {
    this.renderer.render(this.scene, this.camera);
    const { ctx, canvas } = this;
    ctx.drawImage(this.gl, 0, 0);
    this.overlay(ctx, canvas.width, canvas.height);
  }

  // ------------------------------------------------------------------ rótulos

  private overlay(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const u = W / 1080, t = this.t, m = this.match;
    const OG = CLUB.og;
    const beat = this.beatAt(t);
    const home = m.casa ? CLUB.name : m.rival, away = m.casa ? m.rival : CLUB.name;
    const versus = `${home} – ${away}`.toUpperCase();
    const where = [m.fecha, m.campo].filter(Boolean).join(' · ').toUpperCase();
    const jornada = [m.jornada && `Jornada ${m.jornada}`, CLUB.competition].filter(Boolean).join(' · ').toUpperCase();

    ctx.save();
    // viñeta, como en la web
    const v = ctx.createRadialGradient(W / 2, H * 0.45, W * 0.35, W / 2, H * 0.45, H * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);

    const intro = 1 - clamp01((t - (INTRO - 0.7)) / 0.6);
    const outro = beat?.kind === 'outro' ? clamp01((t - beat.t - 1.6) / 0.7) : 0;

    // portada: escudo, título y partido sobre el vestuario en penumbra
    if (intro > 0) {
      ctx.globalAlpha = intro;
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(0, 0, W, H);
      const rise = (1 - easeOut(clamp01(t / 0.9))) * 40 * u;
      this.image(this.crest, W / 2, H * 0.27 + rise, 300 * u, 'center');
      this.text('CONVOCATORIA', W / 2, H * 0.5 + rise, { size: 150 * u, max: W - 120 * u });
      this.text(jornada, W / 2, H * 0.5 + 70 * u + rise, { size: 30 * u, mono: true, color: OG.gold, spacing: 6 * u, max: W - 120 * u });
      this.text(versus, W / 2, H * 0.63 + rise, { size: 78 * u, max: W - 120 * u });
      if (where) this.text(where, W / 2, H * 0.63 + 60 * u + rise, { size: 26 * u, mono: true, spacing: 4 * u, alpha: 0.75, max: W - 120 * u });
    }

    // cabecera fija: escudo, título y partido
    const head = (1 - intro) * (1 - outro);
    if (head > 0) {
      ctx.globalAlpha = head;
      const g = ctx.createLinearGradient(0, 0, 0, 560 * u);
      g.addColorStop(0, 'rgba(0,0,0,0.92)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.62)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, 560 * u);
      this.image(this.crest, 70 * u, 80 * u, 140 * u, 'left');
      const x = 70 * u + (140 * u * CLUB.crest.width) / CLUB.crest.height + 34 * u;
      this.text('CONVOCATORIA', x, 172 * u, { size: 104 * u, align: 'left', max: W - x - 60 * u });
      this.text(jornada, x, 218 * u, { size: 25 * u, mono: true, color: OG.gold, spacing: 5 * u, align: 'left', max: W - x - 60 * u });
      this.text(versus, 70 * u, 316 * u, { size: 56 * u, align: 'left', max: W - 140 * u });
      if (where) this.text(where, 70 * u, 360 * u, { size: 23 * u, mono: true, spacing: 3 * u, alpha: 0.72, align: 'left', max: W - 140 * u });
    }

    // bloque en curso, pegado bajo la cabecera
    const section = [...this.beats].reverse().find((b) => b.kind === 'section' && b.t <= t) as Extract<Beat, { kind: 'section' }> | undefined;
    if (section && head > 0) {
      ctx.globalAlpha = head * clamp01((t - section.t - 0.6) / 0.4);
      ctx.fillStyle = OG.gold;
      ctx.fillRect(70 * u, 428 * u, 46 * u, 3 * u);
      this.text(`${section.section.label} ${section.section.players.length}`.toUpperCase(), 134 * u, 440 * u, {
        size: 26 * u, mono: true, color: OG.gold, spacing: 7 * u, align: 'left',
      });
    }

    // cambio de bloque: el nombre del bloque a toda pantalla
    if (beat?.kind === 'section') {
      const k = t - beat.t, a = clamp01(k / 0.25) * clamp01((SECTION - k) / 0.3);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, H);
      const s = 1 + (1 - easeOut(clamp01(k / 0.6))) * 0.08;
      ctx.save();
      ctx.translate(W / 2, H * 0.55);
      ctx.scale(s, s);
      this.text(beat.section.label.toUpperCase(), 0, 0, { size: 170 * u, color: OG.gold, max: W - 100 * u });
      const n = beat.section.players.length;
      this.text(`${n} ${n === 1 ? 'jugador' : 'jugadores'}`.toUpperCase(), 0, 70 * u, { size: 28 * u, mono: true, spacing: 8 * u, alpha: 0.8 });
      ctx.restore();
    }

    // pie con el jugador que llega
    const total = this.items.length;
    const cap = (H - 640 * u) | 0;
    if (head > 0 || outro > 0) {
      ctx.globalAlpha = 1;
      const g = ctx.createLinearGradient(0, cap, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.72)');
      g.addColorStop(1, 'rgba(0,0,0,0.9)');
      ctx.fillStyle = g;
      ctx.fillRect(0, cap, W, H - cap);
    }
    if (beat?.kind === 'player') {
      const p = beat.item.player, k = t - beat.t;
      const a = clamp01((k - 0.12) / 0.22) * clamp01((beat.end - t) / 0.12);
      const dx = (1 - easeOut(clamp01((k - 0.12) / 0.4))) * -50 * u;
      ctx.globalAlpha = a;
      const num = String(p.dorsal);
      ctx.font = this.font(230 * u);
      const nw = ctx.measureText(num).width;
      this.text(num, 70 * u + dx, H - 196 * u, { size: 230 * u, color: OG.gold, align: 'left' });
      const x = 70 * u + nw + 34 * u + dx, max = W - x - 70 * u;
      this.text(p.nombre.toUpperCase(), x, H - 340 * u, { size: 56 * u, align: 'left', alpha: 0.75, max });
      this.text(`${p.apellido}${p.capitan ? ' (C)' : ''}`.toUpperCase(), x, H - 222 * u, { size: 112 * u, align: 'left', max });
      this.text(p.rol.toUpperCase(), x, H - 172 * u, { size: 24 * u, mono: true, spacing: 4 * u, alpha: 0.7, align: 'left', max });
      ctx.globalAlpha = a * 0.6;
      this.text(`${String(beat.n).padStart(2, '0')}/${String(total).padStart(2, '0')}`, W - 70 * u, H - 380 * u, { size: 24 * u, mono: true, align: 'right', spacing: 3 * u });
    }

    // cierre: recuento, partido y grito del club
    if (outro > 0) {
      ctx.globalAlpha = outro;
      const rise = (1 - easeOut(outro)) * 30 * u;
      this.image(this.crest, W / 2, 120 * u - rise, 200 * u, 'center');
      this.text(`${total} CONVOCADOS`, W / 2, H - 330 * u + rise, { size: 140 * u, max: W - 120 * u });
      this.text(versus, W / 2, H - 250 * u + rise, { size: 46 * u, max: W - 120 * u });
      this.text([where, jornada].filter(Boolean).join(' · '), W / 2, H - 205 * u + rise, { size: 22 * u, mono: true, spacing: 3 * u, alpha: 0.72, max: W - 120 * u });
      this.text(CLUB.callup.cheer.toUpperCase(), W / 2, H - 140 * u + rise, { size: 30 * u, mono: true, color: OG.gold, spacing: 7 * u, max: W - 120 * u });
    }

    // firma
    ctx.globalAlpha = 0.5;
    this.text(`Vestuario 3D · ${new URL(CLUB.site).host}`.toUpperCase(), W / 2, H - 64 * u, { size: 19 * u, mono: true, spacing: 4 * u });
    ctx.restore();
  }

  private font(size: number, mono = false) {
    return mono ? `600 ${size}px "JetBrains Mono"` : `400 ${size}px Anton`;
  }

  private text(
    s: string,
    x: number,
    y: number,
    o: { size: number; mono?: boolean; color?: string; align?: CanvasTextAlign; spacing?: number; alpha?: number; max?: number },
  ) {
    const { ctx } = this;
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.fillStyle = o.color ?? CLUB.og.text;
    ctx.textAlign = o.align ?? 'center';
    ctx.textBaseline = 'alphabetic';
    let size = o.size;
    ctx.font = this.font(size, o.mono);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${o.spacing ?? 0}px`;
    // si no cabe, se encoge
    const w = ctx.measureText(s).width;
    if (o.max && w > o.max) {
      size *= o.max / w;
      ctx.font = this.font(size, o.mono);
    }
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = size * 0.15;
    ctx.fillText(s, x, y);
    ctx.restore();
  }

  private image(img: HTMLImageElement, x: number, y: number, height: number, align: 'left' | 'center') {
    if (!img.complete || !img.naturalWidth) return;
    const w = (height * img.naturalWidth) / img.naturalHeight;
    this.ctx.drawImage(img, align === 'center' ? x - w / 2 : x, y, w, height);
  }
}
