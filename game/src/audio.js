// Lanternfall — all sound, synthesised in code. One file, one job: it
// owns the WebAudio graph, so the game only calls play(name) and never
// touches an audio node. Zero audio files, zero network requests.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.padNodes = null;
    this.muted = false;
    this.enabled = true;
  }

  // Browsers only let audio start after a gesture; call from the first
  // key or click. Safe to call repeatedly; safe to never call (silent).
  ensure() {
    if (!this.enabled || this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startPad();
    } catch (err) {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  // A quiet two-oscillator night pad with a slow breathing gain.
  startPad() {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = 110;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 164.81;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    o1.start();
    o2.start();
    lfo.start();
    this.padNodes = { o1, o2, lfo, gain };
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, vol, filterFreq, slideTo) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq || 1200, t);
    if (slideTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  play(name, arg) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'flare':
        this.noise(0.22, 0.25, 900, 220);
        this.tone(520, 0.18, 'sine', 0.16, 180);
        break;
      case 'hit':
        this.tone(190, 0.07, 'square', 0.08, 120);
        break;
      case 'kill':
        this.tone(320, 0.12, 'triangle', 0.14, 90);
        this.noise(0.1, 0.1, 2000, 700);
        break;
      case 'gem': {
        const step = Math.min(arg || 0, 12);
        this.tone(660 + step * 40, 0.09, 'sine', 0.12, 990 + step * 40);
        break;
      }
      case 'hurt':
        this.tone(140, 0.25, 'sawtooth', 0.22, 55);
        this.noise(0.18, 0.18, 300, 90);
        break;
      case 'dash':
        this.noise(0.18, 0.2, 1600, 300);
        break;
      case 'levelup':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          setTimeout(() => this.tone(f, 0.22, 'triangle', 0.16), i * 70);
        });
        break;
      case 'pick':
        this.tone(880, 0.12, 'sine', 0.14, 1320);
        break;
      case 'boss':
        this.tone(65, 0.8, 'sawtooth', 0.25, 40);
        this.noise(0.6, 0.16, 180, 60);
        break;
      case 'victory':
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
          setTimeout(() => this.tone(f, 0.35, 'triangle', 0.15), i * 110);
        });
        break;
      case 'defeat':
        [392, 311.13, 233.08, 155.56].forEach((f, i) => {
          setTimeout(() => this.tone(f, 0.4, 'triangle', 0.14), i * 140);
        });
        break;
      case 'beam':
        this.noise(0.16, 0.16, 2400, 500);
        this.tone(1180, 0.14, 'sine', 0.1, 320);
        break;
      case 'spark':
        this.tone(1400, 0.08, 'square', 0.08, 500);
        break;
      default:
        break;
    }
  }
}
