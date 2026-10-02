export type Sfx =
  | 'jump'
  | 'timun'
  | 'rambutan'
  | 'ketupat'
  | 'stomp'
  | 'hurt'
  | 'splash'
  | 'checkpoint'
  | 'win'
  | 'gameover'
  | 'click'
  | 'count';

export interface Track {
  bpm: number;
  /** Base frequency of slendro degree 1. */
  base: number;
  /** Balungan (skeleton melody) in slendro notation: 1 2 3 5 6, +10 for the upper octave, 0 = rest. */
  balungan: number[];
}

export const TRACKS = {
  menu: { bpm: 76, base: 262, balungan: [2, 3, 2, 1, 3, 5, 3, 2, 5, 6, 5, 3, 2, 1, 2, 6] },
  sawah: { bpm: 120, base: 294, balungan: [3, 5, 6, 5, 3, 2, 1, 2, 3, 5, 3, 2, 6, 5, 3, 5, 6, 11, 6, 5, 3, 2, 3, 5, 6, 5, 3, 2, 1, 2, 3, 1] },
  kali: { bpm: 108, base: 277, balungan: [5, 6, 5, 3, 5, 6, 11, 6, 3, 2, 3, 5, 6, 5, 3, 2, 1, 2, 3, 2, 5, 3, 2, 1, 2, 3, 5, 6, 5, 3, 2, 1] },
  buaya: { bpm: 112, base: 262, balungan: [2, 1, 2, 3, 5, 3, 2, 1, 6, 5, 6, 1, 2, 3, 2, 0, 3, 5, 6, 5, 3, 5, 3, 2, 1, 2, 3, 5, 2, 3, 2, 1] },
  candi: { bpm: 96, base: 247, balungan: [6, 5, 3, 2, 3, 5, 6, 0, 11, 6, 5, 6, 3, 5, 3, 2, 1, 2, 1, 6, 5, 6, 1, 2, 3, 2, 1, 6, 5, 3, 5, 6] },
} satisfies Record<string, Track>;

export type TrackName = keyof typeof TRACKS;

const SLENDRO_STEP: Record<number, number> = { 1: 0, 2: 1, 3: 2, 5: 3, 6: 4 };

/** Slendro divides the octave into five nearly equal steps (~240 cents). */
function slendro(base: number, note: number): number {
  const octave = Math.floor(note / 10);
  const step = SLENDRO_STEP[note % 10] ?? 0;
  return base * 2 ** (octave + step / 5);
}

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private track: Track | null = null;
  private trackName: TrackName | null = null;
  private beat = 0;
  private nextBeatTime = 0;
  private timer: number | undefined;
  musicOn = true;
  sfxOn = true;

  /** Browsers only allow audio after a user gesture, so this is called from input handlers. */
  unlock(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 0.5 : 0;
      this.sfxBus.connect(master);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
      this.musicBus.connect(master);
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      if (this.trackName) this.music(this.trackName, true);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Silences everything while the tab is hidden; background timers are throttled anyway. */
  setSuspended(suspended: boolean): void {
    if (!this.ctx) return;
    if (suspended) void this.ctx.suspend();
    else {
      void this.ctx.resume();
      this.nextBeatTime = this.ctx.currentTime + 0.1;
    }
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.05);
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05);
  }

  // ---------------------------------------------------------------- music

  music(name: TrackName, force = false): void {
    if (this.trackName === name && !force) return;
    this.trackName = name;
    this.track = TRACKS[name];
    if (!this.ctx) return;
    this.beat = 0;
    this.nextBeatTime = this.ctx.currentTime + 0.1;
    if (this.timer === undefined) this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic(): void {
    this.trackName = null;
    this.track = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.track) return;
    const t = this.track;
    const spb = 60 / t.bpm;
    while (this.nextBeatTime < ctx.currentTime + 0.15) {
      const time = this.nextBeatTime;
      const len = t.balungan.length;
      const i = this.beat % len;
      const note = t.balungan[i];
      const next = t.balungan[(i + 1) % len] || note;
      if (note) {
        // Saron plays the balungan, bonang elaborates on the off-beats an octave up.
        this.metal(slendro(t.base, note), time, 0.9, 0.22);
        this.metal(slendro(t.base, note + 10), time + spb / 2, 0.35, 0.07);
        this.metal(slendro(t.base, next + 10), time + spb * 0.75, 0.3, 0.05);
      }
      if (i % 4 === 3 && note) this.metal(slendro(t.base, note) / 2, time, 1.6, 0.16); // kenong
      if (i % 8 === 5) this.metal(slendro(t.base, 5) / 2, time, 1.2, 0.1); // kempul
      if (i === len - 1) this.gong(time);
      // Kendang: deep "dhung" on strong beats, crisp "tak" in between.
      if (i % 4 === 0) this.drum(time, true);
      if (i % 2 === 1) this.drum(time + spb / 2, false);
      this.beat++;
      this.nextBeatTime += spb;
    }
  }

  /** Bronze-like tone: fundamental plus inharmonic partials with fast decay. */
  private metal(freq: number, t: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    for (const [ratio, amp] of [[1, 1], [2.76, 0.3], [5.4, 0.08]] as const) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * ratio;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * amp, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / ratio);
      osc.connect(g).connect(this.musicBus);
      osc.start(t);
      osc.stop(t + dur);
    }
  }

  private gong(t: number): void {
    const ctx = this.ctx!;
    // Two slightly detuned sines give the gong its slow "wave" (ombak).
    for (const [f, v] of [[64, 0.35], [65.3, 0.3], [128.5, 0.08]]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
      osc.connect(g).connect(this.musicBus);
      osc.start(t);
      osc.stop(t + 4.6);
    }
  }

  private drum(t: number, low: boolean): void {
    const ctx = this.ctx!;
    if (low) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.18);
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(g).connect(this.musicBus);
      osc.start(t);
      osc.stop(t + 0.3);
    } else {
      this.noise(t, 0.05, 0.12, 2200, this.musicBus);
    }
  }

  // ---------------------------------------------------------------- sfx

  play(name: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'jump':
        this.tone(t, 'square', 280, 560, 0.12, 0.12);
        break;
      case 'timun':
        this.tone(t, 'triangle', 988, 988, 0.06, 0.25);
        this.tone(t + 0.06, 'triangle', 1480, 1480, 0.12, 0.25);
        break;
      case 'rambutan':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(t + i * 0.05, 'triangle', f, f, 0.1, 0.25));
        break;
      case 'ketupat':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(t + i * 0.07, 'square', f, f, 0.1, 0.12));
        break;
      case 'stomp':
        this.tone(t, 'square', 220, 70, 0.12, 0.2);
        this.noise(t, 0.08, 0.2, 900, this.sfxBus);
        break;
      case 'hurt':
        this.tone(t, 'square', 440, 110, 0.45, 0.18);
        break;
      case 'splash':
        this.noise(t, 0.4, 0.35, 700, this.sfxBus);
        this.tone(t, 'sine', 300, 90, 0.3, 0.15);
        break;
      case 'checkpoint': {
        const base = 392;
        [1, 3, 5, 11].forEach((n, i) => this.tone(t + i * 0.09, 'sine', slendro(base, n), slendro(base, n), 0.5, 0.25));
        break;
      }
      case 'win': {
        const base = 330;
        [1, 2, 3, 5, 6, 11, 6, 11].forEach((n, i) => this.tone(t + i * 0.11, 'triangle', slendro(base, n), slendro(base, n), 0.35, 0.22));
        break;
      }
      case 'gameover':
        [5, 3, 2, 1].forEach((n, i) => this.tone(t + i * 0.22, 'triangle', slendro(220, n), slendro(220, n), 0.4, 0.22));
        break;
      case 'count':
        // Hollow wooden "tok", like a kentongan.
        this.tone(t, 'sine', 900, 620, 0.09, 0.3);
        this.noise(t, 0.03, 0.15, 1400, this.sfxBus);
        break;
      case 'click':
        this.tone(t, 'square', 660, 660, 0.04, 0.08);
        break;
    }
  }

  private tone(t: number, type: OscillatorType, from: number, to: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(t: number, dur: number, vol: number, freq: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur);
  }
}
