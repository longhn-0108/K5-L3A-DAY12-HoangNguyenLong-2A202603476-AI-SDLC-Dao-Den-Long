/**
 * Deterministic 32-bit PRNG (Mulberry32).
 * Same seed always produces the exact same sequence across platforms.
 */
export class SeededPRNG {
  constructor(seed) {
    const n = Number(seed) >>> 0;
    this.state = n === 0 ? 0x9e3779b9 : n;
  }

  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }
}
