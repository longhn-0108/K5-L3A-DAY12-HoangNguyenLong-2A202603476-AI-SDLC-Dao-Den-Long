/**
 * Procedural Web Audio synthesizer (presentation layer only).
 * Zero external audio assets; never affects simulation state.
 */
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  _ensureCtx() {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  _tone(freq, duration, type = 'sine', gainPeak = 0.12, delay = 0) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playPickup(carried = 1) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const freq = scale[(carried - 1) % scale.length];
    this._tone(freq, 0.18, 'sine', 0.1);
  }

  playDeposit() {
    this._tone(440, 0.16, 'triangle', 0.1, 0);
    this._tone(659.25, 0.22, 'sine', 0.1, 0.06);
  }

  playLanternLit() {
    this._tone(523.25, 0.45, 'triangle', 0.12, 0);
    this._tone(659.25, 0.45, 'sine', 0.11, 0.08);
    this._tone(783.99, 0.55, 'sine', 0.12, 0.16);
    this._tone(1046.5, 0.7, 'sine', 0.1, 0.24);
  }

  playPulse() {
    this._tone(392, 0.3, 'sine', 0.14, 0);
    this._tone(784, 0.35, 'triangle', 0.1, 0.05);
  }

  playHit() {
    this._tone(150, 0.26, 'sawtooth', 0.1, 0);
    this._tone(110, 0.3, 'triangle', 0.12, 0.05);
  }

  playWin() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, idx) => this._tone(n, 0.5, 'sine', 0.11, idx * 0.1));
  }

  playLose() {
    const notes = [392, 349.23, 293.66, 220];
    notes.forEach((n, idx) => this._tone(n, 0.45, 'triangle', 0.1, idx * 0.14));
  }
}
