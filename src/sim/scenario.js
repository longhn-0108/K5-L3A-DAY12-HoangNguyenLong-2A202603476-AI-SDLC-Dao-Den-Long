export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.exitCode = 2;
  }
}

function isVec3(v) {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

function isNonNegInt(v) {
  return Number.isInteger(v) && v >= 0;
}

const VALID_SHADE_STATES = new Set(['spawning', 'wander', 'chase', 'recoil', 'stunned']);
const VALID_DRIFTER_STATES = new Set(['idle', 'chase', 'flee', 'removed']);

export function validateScenario(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('Scenario must be a JSON object');
  }

  if (raw.player !== undefined) {
    if (raw.player === null || typeof raw.player !== 'object' || Array.isArray(raw.player)) {
      throw new ValidationError('scenario.player must be an object');
    }
    if (raw.player.pos !== undefined && !isVec3(raw.player.pos)) {
      throw new ValidationError('scenario.player.pos must be [x, y, z]');
    }
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks']) {
      if (raw.player[k] !== undefined && !isNonNegInt(raw.player[k])) {
        throw new ValidationError(`scenario.player.${k} must be a non-negative integer`);
      }
    }
  }

  for (const b of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) {
    if (raw[b] !== undefined && typeof raw[b] !== 'boolean') {
      throw new ValidationError(`scenario.${b} must be a boolean`);
    }
  }

  if (raw.time_left_s !== undefined && (typeof raw.time_left_s !== 'number' || !Number.isFinite(raw.time_left_s) || raw.time_left_s < 0)) {
    throw new ValidationError('scenario.time_left_s must be a non-negative number');
  }

  if (raw.motes !== undefined) {
    if (!Array.isArray(raw.motes)) throw new ValidationError('scenario.motes must be an array');
    for (let i = 0; i < raw.motes.length; i++) {
      const m = raw.motes[i];
      if (isVec3(m)) continue;
      if (m && typeof m === 'object' && !Array.isArray(m) && isVec3(m.pos)) {
        if (m.id !== undefined && typeof m.id !== 'string') {
          throw new ValidationError(`scenario.motes[${i}].id must be a string`);
        }
        continue;
      }
      throw new ValidationError(`scenario.motes[${i}] must be [x,y,z] or { id?, pos: [x,y,z] }`);
    }
  }

  if (raw.shades !== undefined) {
    if (!Array.isArray(raw.shades)) throw new ValidationError('scenario.shades must be an array');
    for (let i = 0; i < raw.shades.length; i++) {
      const s = raw.shades[i];
      if (!s || typeof s !== 'object' || Array.isArray(s) || !isVec3(s.pos)) {
        throw new ValidationError(`scenario.shades[${i}] must be an object with pos: [x,y,z]`);
      }
      if (s.id !== undefined && typeof s.id !== 'string') {
        throw new ValidationError(`scenario.shades[${i}].id must be a string`);
      }
      if (s.state !== undefined && !VALID_SHADE_STATES.has(s.state)) {
        throw new ValidationError(`scenario.shades[${i}].state invalid: ${s.state}`);
      }
      if (s.state_ticks_left !== undefined && !isNonNegInt(s.state_ticks_left)) {
        throw new ValidationError(`scenario.shades[${i}].state_ticks_left must be non-negative int`);
      }
    }
  }

  if (raw.drifters !== undefined) {
    if (!Array.isArray(raw.drifters)) throw new ValidationError('scenario.drifters must be an array');
    for (let i = 0; i < raw.drifters.length; i++) {
      const d = raw.drifters[i];
      if (!d || typeof d !== 'object' || Array.isArray(d) || !isVec3(d.pos)) {
        throw new ValidationError(`scenario.drifters[${i}] must be an object with pos: [x,y,z]`);
      }
      if (d.state !== undefined && !VALID_DRIFTER_STATES.has(d.state)) {
        throw new ValidationError(`scenario.drifters[${i}].state invalid: ${d.state}`);
      }
    }
  }

  if (raw.charms !== undefined) {
    if (!Array.isArray(raw.charms)) throw new ValidationError('scenario.charms must be an array');
    for (let i = 0; i < raw.charms.length; i++) {
      const c = raw.charms[i];
      if (!c || typeof c !== 'object' || Array.isArray(c)) {
        throw new ValidationError(`scenario.charms[${i}] must be an object`);
      }
      if (c.pos !== undefined && !isVec3(c.pos)) {
        throw new ValidationError(`scenario.charms[${i}].pos must be [x,y,z]`);
      }
    }
  }

  if (raw.lanterns !== undefined) {
    if (!Array.isArray(raw.lanterns)) throw new ValidationError('scenario.lanterns must be an array');
    for (let i = 0; i < raw.lanterns.length; i++) {
      const l = raw.lanterns[i];
      if (!l || typeof l !== 'object' || Array.isArray(l) || typeof l.id !== 'string') {
        throw new ValidationError(`scenario.lanterns[${i}] must be an object with string id`);
      }
      if (l.pos !== undefined && !isVec3(l.pos)) {
        throw new ValidationError(`scenario.lanterns[${i}].pos must be [x,y,z]`);
      }
      if (l.deposited !== undefined && !isNonNegInt(l.deposited)) {
        throw new ValidationError(`scenario.lanterns[${i}].deposited must be a non-negative integer`);
      }
      if (l.lit !== undefined && typeof l.lit !== 'boolean') {
        throw new ValidationError(`scenario.lanterns[${i}].lit must be a boolean`);
      }
    }
  }

  return raw;
}
