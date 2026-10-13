/**
 * Sonido ambiente del vestuario, sintetizado con Web Audio (sin archivos):
 * tono de sala, roce de las perchas al arrastrar la barra, un clic metálico
 * al señalar una camiseta y el vuelo de la tela al abrir o cerrar una ficha.
 * Apagado por defecto; el navegador solo deja arrancarlo tras un gesto del usuario.
 */
export class Soundscape {
  private ctx?: AudioContext;
  private master?: GainNode;
  private slideGain?: GainNode;
  private noise?: AudioBuffer;
  private lastTick = 0;
  enabled = false;

  /** Enciende o apaga. Encender solo funciona dentro de un gesto (clic, fin de toque, tecla) */
  setEnabled(on: boolean, confirm = false) {
    this.enabled = on;
    if (on) {
      this.unlock();
      // un toque de percha al encender: sin él no se sabe si ha funcionado hasta mover la barra
      if (confirm) void this.ctx!.resume().then(() => this.enabled && this.clink(0.035), () => {});
    }
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.08);
    if (!on) {
      // apagado del todo: el móvil recupera su sesión de audio (la música que hubiera de fondo)
      const ctx = this.ctx;
      setTimeout(() => !this.enabled && void ctx.suspend().catch(() => {}), 400);
      this.session('auto');
    }
  }

  /**
   * Arranca o reanuda el audio. Hay que llamarlo dentro de un gesto; no hace daño repetirlo:
   * el móvil suspende el audio al cambiar de app y solo lo devuelve con otro gesto.
   */
  unlock() {
    this.session('playback');
    if (!this.ctx) this.start();
    if (this.ctx!.state !== 'running') void this.ctx!.resume().catch(() => {});
  }

  /** En iPhone, el audio web por defecto se calla con el interruptor lateral de silencio; como «playback», no */
  private session(type: 'auto' | 'playback') {
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = type;
    } catch {}
  }

  private start() {
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // dos segundos de ruido blanco reutilizable
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // tono de sala: ruido grave, casi imperceptible
    const room = this.loop();
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 170;
    const roomGain = ctx.createGain();
    roomGain.gain.value = 0.11;
    room.connect(low).connect(roomGain).connect(this.master);

    // roce continuo de los ganchos sobre la barra; su volumen sigue a la velocidad
    const slide = this.loop();
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2600;
    band.Q.value = 0.9;
    this.slideGain = ctx.createGain();
    this.slideGain.gain.value = 0;
    slide.connect(band).connect(this.slideGain).connect(this.master);
  }

  private loop() {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise!;
    src.loop = true;
    src.start();
    return src;
  }

  private burst(freq: number, q: number, gain: number, attack: number, decay: number, sweepTo?: number) {
    const ctx = this.ctx!, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise!;
    src.loopStart = Math.random();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay);
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(t, Math.random());
    src.stop(t + attack + decay + 0.05);
  }

  /** Golpecito metálico: unos pocos parciales inarmónicos que se apagan rápido */
  private clink(gain: number, pitch = 1) {
    const ctx = this.ctx!, t = ctx.currentTime;
    for (const [f, a, d] of [[3120, 1, 0.16], [4710, 0.55, 0.11], [6890, 0.3, 0.07]]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = f * pitch * (0.985 + Math.random() * 0.03);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain * a, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(g).connect(this.master!);
      osc.start(t);
      osc.stop(t + d + 0.02);
    }
  }

  /** Al señalar otra camiseta */
  tick() {
    if (!this.enabled || !this.ctx) return;
    const now = performance.now();
    if (now - this.lastTick < 70) return;
    this.lastTick = now;
    this.burst(3400, 1.4, 0.05, 0.004, 0.06);
    this.clink(0.012, 0.9 + Math.random() * 0.25);
  }

  /** Al abrir una ficha: la camiseta sale de la barra */
  open() {
    if (!this.enabled || !this.ctx) return;
    this.clink(0.03);
    this.burst(420, 0.7, 0.16, 0.12, 0.42, 2400);
  }

  /** Al cerrarla: vuelve a su percha */
  close() {
    if (!this.enabled || !this.ctx) return;
    this.burst(2100, 0.7, 0.1, 0.06, 0.34, 380);
    setTimeout(() => this.enabled && this.clink(0.022, 0.82), 330);
  }

  /** Velocidad de la barra en m/s: cada fotograma */
  slide(speed: number) {
    if (!this.ctx || !this.slideGain) return;
    const v = this.enabled ? Math.min(Math.abs(speed), 2.5) : 0;
    this.slideGain.gain.setTargetAtTime(Math.min(0.09, v * 0.05), this.ctx.currentTime, 0.06);
  }
}
