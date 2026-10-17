/** Áudio sintetizado com Web Audio API: nenhum arquivo externo, nenhuma trilha ou voz oficial. */
export type SfxName = "ui" | "select" | "summon" | "attack" | "hit" | "heal" | "trap" | "spell" | "win" | "lose" | "error";

export interface AudioConfig { musicOn: boolean; sfxOn: boolean; musicVolume: number; sfxVolume: number }

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private musicStop: (() => void) | null = null;
  private cfg: AudioConfig = { musicOn: false, sfxOn: true, musicVolume: 0.4, sfxVolume: 0.7 };

  get unlocked() { return this.ctx !== null; }

  /** Só deve ser chamado dentro de um gesto do usuário (política de autoplay dos navegadores). */
  unlock() {
    if (this.ctx || typeof window === "undefined") return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    void this.ctx.resume();
    this.apply();
  }

  configure(cfg: AudioConfig) {
    this.cfg = cfg;
    this.apply();
  }

  private apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(this.cfg.musicOn ? this.cfg.musicVolume * 0.35 : 0, t, 0.2);
    this.sfxGain.gain.setTargetAtTime(this.cfg.sfxOn ? this.cfg.sfxVolume * 0.6 : 0, t, 0.05);
    if (this.cfg.musicOn && !this.musicStop) this.startMusic();
    if (!this.cfg.musicOn && this.musicStop) { const s = this.musicStop; this.musicStop = null; window.setTimeout(s, 600); }
  }

  private startMusic() {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.value = 1;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 480;
    filter.connect(out);
    out.connect(this.musicGain);
    const drones = [55, 82.41, 110.0].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = f;
      o.detune.value = i * 4;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.22;
      o.connect(g); g.connect(filter); o.start();
      return o;
    });
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07; lfoGain.gain.value = 180;
    lfo.connect(lfoGain); lfoGain.connect(filter.frequency); lfo.start();

    const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
    const bell = () => {
      const f = scale[Math.floor(Math.random() * scale.length)];
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0008, t + 3.2);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 3.3);
    };
    const timer = window.setInterval(bell, 3800);
    this.musicStop = () => {
      window.clearInterval(timer);
      for (const o of [...drones, lfo]) { try { o.stop(); } catch { /* já parado */ } }
      out.disconnect();
    };
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.5, when = 0, slideTo?: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain = 0.4, from = 3000, to = 200, when = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = "lowpass";
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start(t);
  }

  sfx(name: SfxName) {
    if (!this.ctx || !this.cfg.sfxOn) return;
    switch (name) {
      case "ui": this.tone(660, 0.07, "sine", 0.3); break;
      case "select": this.tone(880, 0.06, "sine", 0.3); this.tone(1175, 0.08, "sine", 0.25, 0.05); break;
      case "summon": this.tone(110, 0.55, "sawtooth", 0.25, 0, 520); this.tone(1046, 0.4, "sine", 0.18, 0.3); this.tone(1568, 0.5, "sine", 0.12, 0.38); break;
      case "attack": this.noise(0.28, 0.45, 5000, 300); this.tone(220, 0.25, "sawtooth", 0.15, 0, 90); break;
      case "hit": this.tone(130, 0.3, "sine", 0.7, 0, 45); this.noise(0.18, 0.35, 1800, 120); break;
      case "heal": [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, "sine", 0.22, i * 0.07)); break;
      case "spell": this.tone(392, 0.5, "triangle", 0.25, 0, 880); this.tone(1318, 0.3, "sine", 0.12, 0.25); break;
      case "trap": this.tone(520, 0.35, "square", 0.14, 0, 130); this.noise(0.2, 0.3, 2500, 200, 0.1); break;
      case "win": [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.5, "triangle", 0.25, i * 0.12)); break;
      case "lose": [392, 349, 311, 233].forEach((f, i) => this.tone(f, 0.55, "triangle", 0.25, i * 0.18)); break;
      case "error": this.tone(150, 0.18, "square", 0.18); break;
    }
  }
}

export const audio = new AudioEngine();
