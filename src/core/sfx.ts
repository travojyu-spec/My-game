// Простые звуки, синтезированные Web Audio — без файлов и сети.
// Аудио создаётся только после первого касания игрока и приостанавливается
// при сворачивании вкладки.

export type SfxName =
  | 'tap' | 'select' | 'deny' | 'turn' | 'hit' | 'heavy' | 'fire' | 'arrow'
  | 'heal' | 'guard' | 'windup' | 'death' | 'victory' | 'defeat';

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  enabled = true;
  private suspendedByPage = false;

  /** Вызывается из обработчика касания: браузеры разрешают звук только так. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended' && !this.suspendedByPage) void this.ctx.resume();
  }

  pageHidden(): void {
    this.suspendedByPage = true;
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  pageVisible(): void {
    this.suspendedByPage = false;
    // Возобновление произойдёт при следующем касании (unlock) — так требуют браузеры.
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || !this.master || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    switch (name) {
      case 'tap': this.tone(t, 660, 0.04, 'square', 0.12); break;
      case 'select': this.tone(t, 520, 0.05, 'square', 0.12); this.tone(t + 0.05, 780, 0.06, 'square', 0.1); break;
      case 'deny': this.tone(t, 180, 0.12, 'square', 0.12, 140); break;
      case 'turn': this.tone(t, 440, 0.06, 'triangle', 0.18); this.tone(t + 0.07, 660, 0.08, 'triangle', 0.16); break;
      case 'hit': this.burst(t, 0.12, 1800, 0.5); this.tone(t, 140, 0.1, 'square', 0.25, 60); break;
      case 'heavy': this.burst(t, 0.25, 900, 0.7); this.tone(t, 90, 0.25, 'square', 0.35, 40); break;
      case 'fire': this.burst(t, 0.35, 3200, 0.45, 600); this.tone(t, 220, 0.3, 'sawtooth', 0.12, 80); break;
      case 'arrow': this.burst(t, 0.08, 5000, 0.25); this.tone(t, 900, 0.08, 'triangle', 0.1, 400); break;
      case 'heal': [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.07, f, 0.12, 'sine', 0.2)); break;
      case 'guard': this.tone(t, 1200, 0.18, 'triangle', 0.2, 900); this.tone(t, 1800, 0.12, 'sine', 0.1); break;
      case 'windup': this.tone(t, 110, 0.45, 'sawtooth', 0.14, 220); break;
      case 'death': this.tone(t, 330, 0.4, 'square', 0.14, 70); break;
      case 'victory': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(t + i * 0.11, f, 0.16, 'square', 0.12)); break;
      case 'defeat': [392, 330, 262, 196].forEach((f, i) => this.tone(t + i * 0.18, f, 0.26, 'triangle', 0.2)); break;
    }
  }

  private tone(t: number, freq: number, dur: number, type: OscillatorType, vol: number, endFreq?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(t: number, dur: number, cutoff: number, vol: number, endCutoff?: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    if (endCutoff) f.frequency.exponentialRampToValueAtTime(endCutoff, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}

export const sfx = new Sfx();
