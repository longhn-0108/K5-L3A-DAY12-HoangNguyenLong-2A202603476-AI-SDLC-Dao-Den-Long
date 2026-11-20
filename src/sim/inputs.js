import { ValidationError } from './scenario.js';

export function validateInputs(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('Inputs file must be a JSON object');
  }
  if (!Array.isArray(raw.frames)) {
    throw new ValidationError('Inputs file must contain a "frames" array');
  }

  let prevTick = -1;
  for (let i = 0; i < raw.frames.length; i++) {
    const f = raw.frames[i];
    if (!f || typeof f !== 'object' || Array.isArray(f)) {
      throw new ValidationError(`inputs.frames[${i}] must be an object`);
    }
    if (!Number.isInteger(f.tick) || f.tick < 0) {
      throw new ValidationError(`inputs.frames[${i}].tick must be a non-negative integer`);
    }
    if (f.tick <= prevTick) {
      throw new ValidationError(`inputs.frames[${i}].tick (${f.tick}) must be strictly increasing (previous: ${prevTick})`);
    }
    prevTick = f.tick;

    if (f.move !== undefined) {
      if (
        !Array.isArray(f.move) ||
        f.move.length !== 2 ||
        !f.move.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= -1 && n <= 1)
      ) {
        throw new ValidationError(`inputs.frames[${i}].move must be [x, z] with each component in [-1, 1]`);
      }
    }
    if (f.cam_yaw_deg !== undefined && (typeof f.cam_yaw_deg !== 'number' || !Number.isFinite(f.cam_yaw_deg))) {
      throw new ValidationError(`inputs.frames[${i}].cam_yaw_deg must be a finite number`);
    }
    for (const key of ['jump', 'interact', 'pulse', 'dash']) {
      if (f[key] !== undefined && typeof f[key] !== 'boolean') {
        throw new ValidationError(`inputs.frames[${i}].${key} must be a boolean`);
      }
    }
  }

  return raw;
}

/**
 * Stateful timeline that applies carry-forward input frames at each tick.
 */
export class InputTimeline {
  constructor(validatedInputs = null) {
    this.frames = validatedInputs ? validatedInputs.frames : [];
    this.cursor = 0;
    this.current = {
      move: [0, 0],
      cam_yaw_deg: 0,
      jump: false,
      interact: false,
      pulse: false,
      dash: false,
    };
  }

  getInputForTick(tick) {
    while (this.cursor < this.frames.length && this.frames[this.cursor].tick <= tick) {
      const f = this.frames[this.cursor];
      if (f.move !== undefined) this.current.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) this.current.cam_yaw_deg = f.cam_yaw_deg;
      if (f.jump !== undefined) this.current.jump = f.jump;
      if (f.interact !== undefined) this.current.interact = f.interact;
      if (f.pulse !== undefined) this.current.pulse = f.pulse;
      if (f.dash !== undefined) this.current.dash = f.dash;
      this.cursor += 1;
    }
    return {
      move: [this.current.move[0], this.current.move[1]],
      cam_yaw_deg: this.current.cam_yaw_deg,
      jump: this.current.jump,
      interact: this.current.interact,
      pulse: this.current.pulse,
      dash: this.current.dash,
    };
  }
}
