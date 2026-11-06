/**
 * Motor audio — Web Audio API, sunete 100% sintetizate (fără fișiere).
 * AudioContext se creează doar la prima interacțiune a utilizatorului (politica browserelor).
 */
import { startEngine, renderNoiseBuffer, normalizeProfile } from './engineSound.js';

export class AudioEngine {
  constructor({ volume = 0.7, muted = false } = {}) {
    this.ctx = null;
    this.master = null;
    this.volume = volume;
    this.muted = muted;
    this.engine = null;
    this.supported = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
    this._noise = null;
    const unlock = () => { this.ensure(); };
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
  }

  /** Creează/reia contextul. Întoarce contextul sau null dacă nu e posibil. */
  ensure() {
    if (!this.supported) return null;
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 4;
        this.master.connect(comp).connect(this.ctx.destination);
        this._applyGain();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    } catch (err) {
      console.warn('[audio] AudioContext indisponibil:', err);
      this.supported = false;
      return null;
    }
  }

  _applyGain() {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }
  setVolume(v) { this.volume = Math.max(0, Math.min(1, Number(v) || 0)); this._applyGain(); }
  setMuted(m) { this.muted = !!m; this._applyGain(); }

  get noise() {
    if (!this._noise && this.ctx) this._noise = renderNoiseBuffer(this.ctx, 2);
    return this._noise;
  }

  // ---------- primitive ----------
  _ctx() { const c = this.ensure(); return c && this.master ? c : null; }

  _noiseBurst(t, dur, { type = 'bandpass', freq = 2000, q = 1, gain = 0.5 } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.02);
  }

  _tone(t, dur, { freq = 440, type = 'sine', gain = 0.3, endFreq = null, attack = 0.005 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // ---------- efecte ----------
  /** Clichet: serie de clicuri metalice. */
  ratchet(clicks = 7, interval = 0.075) {
    const c = this._ctx(); if (!c) return;
    const t0 = c.currentTime + 0.01;
    for (let i = 0; i < clicks; i++) {
      const t = t0 + i * interval + (Math.random() - 0.5) * 0.01;
      this._noiseBurst(t, 0.025, { type: 'highpass', freq: 3000, q: 0.7, gain: 0.35 });
      this._tone(t, 0.03, { freq: 3300 + Math.random() * 300, type: 'triangle', gain: 0.12 });
    }
  }

  /** Clic de cheie dinamometrică (declanșare la cuplul setat). */
  torqueClick() {
    const c = this._ctx(); if (!c) return;
    const t = c.currentTime + 0.01;
    this._noiseBurst(t, 0.05, { type: 'bandpass', freq: 1800, q: 1.4, gain: 0.9 });
    this._tone(t, 0.08, { freq: 900, type: 'square', gain: 0.08, endFreq: 500 });
    this._noiseBurst(t + 0.045, 0.04, { type: 'bandpass', freq: 2400, q: 1.6, gain: 0.5 });
  }

  /** Zgomot surd de demontare/montare piesă. */
  clunk() {
    const c = this._ctx(); if (!c) return;
    const t = c.currentTime + 0.01;
    this._tone(t, 0.28, { freq: 110, endFreq: 48, type: 'sine', gain: 0.55 });
    this._noiseBurst(t, 0.18, { type: 'lowpass', freq: 500, q: 0.6, gain: 0.5 });
    this._noiseBurst(t + 0.02, 0.06, { type: 'bandpass', freq: 1500, q: 2, gain: 0.15 });
  }

  /** Clic de conector din plastic. */
  plastic() {
    const c = this._ctx(); if (!c) return;
    const t = c.currentTime + 0.01;
    this._noiseBurst(t, 0.015, { type: 'bandpass', freq: 4200, q: 3, gain: 0.6 });
    this._noiseBurst(t + 0.035, 0.012, { type: 'bandpass', freq: 5200, q: 3, gain: 0.45 });
  }

  /** Bâzâit scurt de eroare. */
  error() {
    const c = this._ctx(); if (!c) return;
    const t = c.currentTime + 0.01;
    this._tone(t, 0.14, { freq: 150, type: 'square', gain: 0.12 });
    this._tone(t + 0.17, 0.18, { freq: 120, type: 'square', gain: 0.12 });
  }

  /** Ton de succes. */
  success() {
    const c = this._ctx(); if (!c) return;
    const t = c.currentTime + 0.01;
    this._tone(t, 0.16, { freq: 660, gain: 0.18 });
    this._tone(t + 0.12, 0.28, { freq: 990, gain: 0.16 });
  }

  /** Sunet scurt de „pas încheiat” al lecției. */
  chime() {
    const c = this._ctx(); if (!c) return;
    const t = c.currentTime + 0.01;
    this._tone(t, 0.4, { freq: 1320, gain: 0.08 });
  }

  // ---------- motor ----------
  /**
   * Pornește motorul simulat cu profilul de sunet. Oprește orice sesiune anterioară.
   * @returns {Promise<boolean>} true dacă motorul „a pornit” (nu doar demaror).
   */
  async startEngine(profile = {}, { startable = true, rpm = 800, duration = null } = {}) {
    const c = this._ctx();
    this.stopEngine(0.1);
    if (!c) return startable && !normalizeProfile(profile).noStart;
    try {
      this.engine = startEngine(c, this.master, profile, { rpm, startable, duration, noise: this.noise });
      return await this.engine.started;
    } catch (err) {
      console.error('[audio] Sinteza motorului a eșuat:', err);
      return false;
    }
  }

  stopEngine(fade = 0.4) {
    if (this.engine) { try { this.engine.stop(fade); } catch { /* deja */ } }
    this.engine = null;
  }

  get engineRunning() { return !!this.engine?.running; }
}
