/**
 * Procedural Web Audio synthesizer (presentation layer only).
 * Includes soft night ambient drone + all required SFX for Phase 2.
 */
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.ambientStarted = false;
    this.muted = false;
    this.volume = 0.7;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
    return this.muted;
  }

  _ensureCtx() {
    if (this.muted || this.volume <= 0) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  startAmbient() {
    const ctx = this._ensureCtx();
    if (!ctx || this.ambientStarted) return;
    this.ambientStarted = true;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.035;
    this.ambientGain.connect(this.masterGain);

    for (const freq of [130.81, 196.0, 261.63]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(this.ambientGain);
      osc.start();
    }
  }

  _tone(freq, duration, type = 'sine', gainPeak = 0.14, delay = 0) {
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
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playPickup(carried = 1) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    this._tone(scale[(carried - 1) % scale.length], 0.18, 'sine', 0.12);
  }

  playCharm() {
    this._tone(659.25, 0.25, 'triangle', 0.14, 0);
    this._tone(987.77, 0.3, 'sine', 0.14, 0.08);
    this._tone(1318.5, 0.4, 'sine', 0.12, 0.16);
  }

  playDeposit() {
    this._tone(440, 0.16, 'triangle', 0.12, 0);
    this._tone(659.25, 0.22, 'sine', 0.12, 0.06);
  }

  playLanternLit() {
    this._tone(523.25, 0.45, 'triangle', 0.14, 0);
    this._tone(659.25, 0.45, 'sine', 0.13, 0.08);
    this._tone(783.99, 0.55, 'sine', 0.14, 0.16);
    this._tone(1046.5, 0.7, 'sine', 0.12, 0.24);
  }

  playPulse() {
    this._tone(392, 0.3, 'sine', 0.16, 0);
    this._tone(784, 0.35, 'triangle', 0.12, 0.05);
  }

  playJump() {
    this._tone(330, 0.12, 'sine', 0.1, 0);
    this._tone(495, 0.14, 'sine', 0.08, 0.05);
  }

  playDash() {
    this._tone(620, 0.12, 'triangle', 0.12, 0);
    this._tone(310, 0.15, 'sine', 0.1, 0.04);
  }

  playHit() {
    this._tone(150, 0.26, 'sawtooth', 0.12, 0);
    this._tone(110, 0.3, 'triangle', 0.14, 0.05);
  }

  playShadeSpawn() {
    this._tone(196, 0.35, 'sawtooth', 0.07, 0);
    this._tone(146.83, 0.4, 'sine', 0.08, 0.1);
  }

  playCountdown() {
    this._tone(880, 0.09, 'square', 0.07, 0);
  }

  playWindWarn() {
    this._tone(240, 0.5, 'sine', 0.06, 0);
    this._tone(320, 0.5, 'sine', 0.05, 0.15);
  }

  playWin() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((n, i) => this._tone(n, 0.5, 'sine', 0.13, i * 0.1));
  }

  playLose() {
    [392, 349.23, 293.66, 220].forEach((n, i) => this._tone(n, 0.45, 'triangle', 0.12, i * 0.14));
  }
}
