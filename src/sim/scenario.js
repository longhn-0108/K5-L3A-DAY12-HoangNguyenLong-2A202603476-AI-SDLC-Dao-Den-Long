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

export function validateScenario(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('Scenario must be a JSON object');
  }

  if (raw.player !== undefined) {
    if (raw.player === null || typeof raw.player !== 'object' || Array.isArray(raw.player)) {
      throw new ValidationError('scenario.player must be an object');
    }
    if (raw.player.pos !== undefined && !isVec3(raw.player.pos)) {
      throw new ValidationError('scenario.player.pos must be a [x, y, z] array of numbers');
    }
    if (raw.player.carried !== undefined && (!Number.isInteger(raw.player.carried) || raw.player.carried < 0)) {
      throw new ValidationError('scenario.player.carried must be a non-negative integer');
    }
    if (raw.player.flames !== undefined && (!Number.isInteger(raw.player.flames) || raw.player.flames < 0)) {
      throw new ValidationError('scenario.player.flames must be a non-negative integer');
    }
  }

  if (raw.random_motes !== undefined && typeof raw.random_motes !== 'boolean') {
    throw new ValidationError('scenario.random_motes must be a boolean');
  }
  if (raw.random_shades !== undefined && typeof raw.random_shades !== 'boolean') {
    throw new ValidationError('scenario.random_shades must be a boolean');
  }

  if (raw.time_left_s !== undefined && (typeof raw.time_left_s !== 'number' || !Number.isFinite(raw.time_left_s) || raw.time_left_s < 0)) {
    throw new ValidationError('scenario.time_left_s must be a non-negative number');
  }

  if (raw.motes !== undefined) {
    if (!Array.isArray(raw.motes)) {
      throw new ValidationError('scenario.motes must be an array');
    }
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
    if (!Array.isArray(raw.shades)) {
      throw new ValidationError('scenario.shades must be an array');
    }
    for (let i = 0; i < raw.shades.length; i++) {
      const s = raw.shades[i];
      if (!s || typeof s !== 'object' || Array.isArray(s) || !isVec3(s.pos)) {
        throw new ValidationError(`scenario.shades[${i}] must be an object with pos: [x,y,z]`);
      }
      if (s.id !== undefined && typeof s.id !== 'string') {
        throw new ValidationError(`scenario.shades[${i}].id must be a string`);
      }
    }
  }

  if (raw.lanterns !== undefined) {
    if (!Array.isArray(raw.lanterns)) {
      throw new ValidationError('scenario.lanterns must be an array');
    }
    for (let i = 0; i < raw.lanterns.length; i++) {
      const l = raw.lanterns[i];
      if (!l || typeof l !== 'object' || Array.isArray(l) || typeof l.id !== 'string') {
        throw new ValidationError(`scenario.lanterns[${i}] must be an object with string id`);
      }
      if (l.pos !== undefined && !isVec3(l.pos)) {
        throw new ValidationError(`scenario.lanterns[${i}].pos must be [x,y,z]`);
      }
      if (l.deposited !== undefined && (!Number.isInteger(l.deposited) || l.deposited < 0)) {
        throw new ValidationError(`scenario.lanterns[${i}].deposited must be a non-negative integer`);
      }
      if (l.lit !== undefined && typeof l.lit !== 'boolean') {
        throw new ValidationError(`scenario.lanterns[${i}].lit must be a boolean`);
      }
    }
  }

  return raw;
}
