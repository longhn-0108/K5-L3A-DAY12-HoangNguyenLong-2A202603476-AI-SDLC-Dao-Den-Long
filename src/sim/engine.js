import {
  DT,
  GRAVITY,
  JUMP_VELOCITY,
  PLAYABLE_RADIUS,
  SHADE_HEIGHT,
  TICK_RATE,
  TUNING,
  distXZ,
  round3,
} from './tuning.js';
import { SeededPRNG } from './prng.js';

const LANTERN_RING_RADIUS = 22;
const INITIAL_MOTE_COUNT = 20;
const MAX_ACTIVE_MOTES = 22;
const MOTE_RESPAWN_TICKS = 240; // every 4 seconds
const INITIAL_SHADE_COUNT = 2;
const MAX_ACTIVE_SHADES = 5;
const SHADE_SPAWN_TICKS = 2700; // every 45 seconds
const EPS = 1e-9;

function clampToIsland(pos) {
  const d = Math.hypot(pos[0], pos[2]);
  if (d > PLAYABLE_RADIUS) {
    const scale = PLAYABLE_RADIUS / d;
    pos[0] *= scale;
    pos[2] *= scale;
  }
}

export class GameEngine {
  constructor({ seed = 1, night = 1, scenario = null } = {}) {
    this.seed = seed;
    this.night = night;
    this.prng = new SeededPRNG(seed);

    this.tick = 0;
    this.simTick = 0;
    this.state = 'playing'; // 'playing' | 'won' | 'lost'
    this.score = 0;
    this.initialTimeLeftS = TUNING.night1_duration_s;

    this.randomMotes = true;
    this.randomShades = true;

    this.nextMoteSeq = 1;
    this.nextShadeSeq = 1;

    this.player = {
      pos: [0, 0, 0],
      vy: 0,
      flames: TUNING.flames,
      carried: 0,
      invulnTimer: 0,
      pulseCooldown: 0,
      facingYaw: 0,
    };

    this.prevButtons = {
      jump: false,
      interact: false,
      pulse: false,
    };

    // Default 5 lanterns evenly placed on Đảo Bến
    this.lanterns = [];
    for (let i = 0; i < TUNING.lantern_count_night1; i++) {
      const angle = (i * 2 * Math.PI) / TUNING.lantern_count_night1;
      const x = round3(LANTERN_RING_RADIUS * Math.sin(angle));
      const z = round3(LANTERN_RING_RADIUS * Math.cos(angle));
      this.lanterns.push({
        id: `L${i + 1}`,
        pos: [x, 0, z],
        lit: false,
        deposited: 0,
      });
    }

    this.motes = [];
    this.shades = [];

    this._applyScenarioOrDefaults(scenario);
  }

  _nextMoteId() {
    const used = new Set(this.motes.map((m) => m.id));
    while (used.has(`M${this.nextMoteSeq}`)) {
      this.nextMoteSeq += 1;
    }
    return `M${this.nextMoteSeq++}`;
  }

  _nextShadeId() {
    const used = new Set(this.shades.map((s) => s.id));
    while (used.has(`S${this.nextShadeSeq}`)) {
      this.nextShadeSeq += 1;
    }
    return `S${this.nextShadeSeq++}`;
  }

  _spawnRandomMote() {
    for (let attempt = 0; attempt < 25; attempt++) {
      const r = Math.sqrt(this.prng.next()) * (PLAYABLE_RADIUS - 3) + 2;
      const a = this.prng.range(0, Math.PI * 2);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const pos = [x, 0, z];
      const tooCloseToLantern = this.lanterns.some((l) => distXZ(pos, l.pos) < 2.5);
      const tooCloseToPlayer = distXZ(pos, this.player.pos) < TUNING.pickup_radius + 1.5;
      if (!tooCloseToLantern && !tooCloseToPlayer) {
        const mote = { id: this._nextMoteId(), pos };
        this.motes.push(mote);
        return mote;
      }
    }
    const fallback = { id: this._nextMoteId(), pos: [10, 0, 10] };
    this.motes.push(fallback);
    return fallback;
  }

  _spawnRandomShade() {
    for (let attempt = 0; attempt < 30; attempt++) {
      const r = this.prng.range(18, PLAYABLE_RADIUS - 2);
      const a = this.prng.range(0, Math.PI * 2);
      const pos = [Math.cos(a) * r, SHADE_HEIGHT, Math.sin(a) * r];
      const nearPlayer = distXZ(pos, this.player.pos) < 14;
      const inSafe = this.lanterns.some((l) => l.lit && distXZ(pos, l.pos) < TUNING.safe_radius + 1);
      if (!nearPlayer && !inSafe) {
        const shade = { id: this._nextShadeId(), pos, state: 'chase', stunTimer: 0 };
        this.shades.push(shade);
        return shade;
      }
    }
    const fallback = { id: this._nextShadeId(), pos: [26, SHADE_HEIGHT, 0], state: 'chase', stunTimer: 0 };
    this.shades.push(fallback);
    return fallback;
  }

  _applyScenarioOrDefaults(scenario) {
    const sc = scenario || {};

    if (sc.random_motes !== undefined) this.randomMotes = sc.random_motes;
    if (sc.random_shades !== undefined) this.randomShades = sc.random_shades;
    if (sc.time_left_s !== undefined) this.initialTimeLeftS = sc.time_left_s;

    if (sc.player) {
      if (sc.player.pos !== undefined) {
        this.player.pos = [sc.player.pos[0], sc.player.pos[1], sc.player.pos[2]];
      }
      if (sc.player.carried !== undefined) {
        this.player.carried = sc.player.carried;
      }
      if (sc.player.flames !== undefined) {
        this.player.flames = sc.player.flames;
      }
    }

    if (sc.lanterns) {
      for (const patch of sc.lanterns) {
        const target = this.lanterns.find((l) => l.id === patch.id);
        if (!target) continue;
        if (patch.pos !== undefined) {
          target.pos = [patch.pos[0], patch.pos[1], patch.pos[2]];
        }
        if (patch.deposited !== undefined) {
          target.deposited = patch.deposited;
        }
        if (patch.lit !== undefined) {
          target.lit = patch.lit;
          if (patch.lit && patch.deposited === undefined && target.deposited < TUNING.lantern_cost) {
            target.deposited = TUNING.lantern_cost;
          }
        } else if (target.deposited >= TUNING.lantern_cost) {
          target.lit = true;
        }
      }
    }

    if (sc.motes !== undefined) {
      this.motes = sc.motes.map((m) => {
        if (Array.isArray(m)) {
          return { id: this._nextMoteId(), pos: [m[0], 0, m[2]] };
        }
        return {
          id: m.id || this._nextMoteId(),
          pos: [m.pos[0], 0, m.pos[2]],
        };
      });
    } else if (this.randomMotes) {
      for (let i = 0; i < INITIAL_MOTE_COUNT; i++) {
        this._spawnRandomMote();
      }
    }

    if (sc.shades !== undefined) {
      const explicitIds = new Set(sc.shades.filter((s) => s.id).map((s) => s.id));
      for (const s of sc.shades) {
        let id = s.id;
        if (!id) {
          while (explicitIds.has(`S${this.nextShadeSeq}`)) {
            this.nextShadeSeq += 1;
          }
          id = `S${this.nextShadeSeq++}`;
          explicitIds.add(id);
        }
        this.shades.push({
          id,
          pos: [s.pos[0], s.pos[1], s.pos[2]],
          state: s.state || 'chase',
          stunTimer: 0,
        });
      }
    } else if (this.randomShades) {
      for (let i = 0; i < INITIAL_SHADE_COUNT; i++) {
        this._spawnRandomShade();
      }
    }
  }

  getTimeLeftS() {
    return Math.max(0, this.initialTimeLeftS - this.simTick / TICK_RATE);
  }

  getSnapshot() {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.state,
      time_left_s: round3(this.getTimeLeftS()),
      score: this.score,
      player: {
        pos: [round3(this.player.pos[0]), round3(this.player.pos[1]), round3(this.player.pos[2])],
        flames: this.player.flames,
        carried: this.player.carried,
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: [round3(l.pos[0]), round3(l.pos[1]), round3(l.pos[2])],
        lit: l.lit,
        deposited: l.deposited,
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: [round3(s.pos[0]), round3(s.pos[1]), round3(s.pos[2])],
        state: s.state,
      })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: [round3(m.pos[0]), round3(m.pos[1]), round3(m.pos[2])],
      })),
    };
  }

  getEndRecord() {
    return {
      type: 'end',
      ticks: this.tick,
      state: this.state,
      score: this.score,
    };
  }

  /**
   * Advances simulation by 1 fixed tick (1/60s).
   * Returns array of event objects emitted during this step.
   */
  step(input = {}) {
    if (this.state !== 'playing') {
      return [];
    }

    this.tick += 1;
    this.simTick += 1;
    const currentTick = this.tick;
    const events = [];

    const emit = (name, data) => {
      events.push({ type: 'event', tick: currentTick, name, data });
    };

    const move = input.move || [0, 0];
    const camYawDeg = input.cam_yaw_deg || 0;
    const jumpDown = Boolean(input.jump);
    const interactDown = Boolean(input.interact);
    const pulseDown = Boolean(input.pulse);

    const jumpPressed = jumpDown && !this.prevButtons.jump;
    const interactPressed = interactDown && !this.prevButtons.interact;
    const pulsePressed = pulseDown && !this.prevButtons.pulse;

    this.prevButtons.jump = jumpDown;
    this.prevButtons.interact = interactDown;
    this.prevButtons.pulse = pulseDown;

    // 1. Update timers
    if (this.player.invulnTimer > 0) {
      this.player.invulnTimer = Math.max(0, this.player.invulnTimer - DT);
    }
    if (this.player.pulseCooldown > 0) {
      this.player.pulseCooldown = Math.max(0, this.player.pulseCooldown - DT);
    }

    // 2. Player movement in XZ plane using contract camera yaw formula
    const theta = (camYawDeg * Math.PI) / 180;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    let wx = move[0] * cosT + move[1] * sinT;
    let wz = -move[0] * sinT + move[1] * cosT;
    const mag = Math.hypot(wx, wz);
    if (mag > 1) {
      wx /= mag;
      wz /= mag;
    }
    if (mag > EPS) {
      this.player.pos[0] += wx * TUNING.player_speed * DT;
      this.player.pos[2] += wz * TUNING.player_speed * DT;
      this.player.facingYaw = Math.atan2(wx, wz);
      clampToIsland(this.player.pos);
    }

    // Vertical jump physics
    if (jumpPressed && this.player.pos[1] <= EPS) {
      this.player.vy = JUMP_VELOCITY;
    }
    if (this.player.pos[1] > 0 || this.player.vy > 0) {
      this.player.pos[1] += this.player.vy * DT;
      this.player.vy -= GRAVITY * DT;
      if (this.player.pos[1] <= 0) {
        this.player.pos[1] = 0;
        this.player.vy = 0;
      }
    }

    // 3. Mote pickup (XZ distance <= pickup_radius)
    if (this.player.carried < TUNING.carry_capacity && this.motes.length > 0) {
      const candidates = [];
      for (let i = 0; i < this.motes.length; i++) {
        const d = distXZ(this.player.pos, this.motes[i].pos);
        if (d <= TUNING.pickup_radius + EPS) {
          candidates.push({ mote: this.motes[i], dist: d });
        }
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.dist - b.dist || a.mote.id.localeCompare(b.mote.id));
        const pickedIds = new Set();
        for (const c of candidates) {
          if (this.player.carried >= TUNING.carry_capacity) break;
          pickedIds.add(c.mote.id);
          this.player.carried += 1;
          this.score += TUNING.score.per_mote;
          emit('mote_picked', { carried: this.player.carried });
        }
        this.motes = this.motes.filter((m) => !pickedIds.has(m.id));
      }
    }

    // 4. Interact: deposit light into nearest unlit lantern within interact_radius
    if (interactPressed && this.player.carried > 0) {
      let bestLantern = null;
      let bestDist = Infinity;
      for (const l of this.lanterns) {
        if (l.lit) continue;
        const d = distXZ(this.player.pos, l.pos);
        if (d <= TUNING.interact_radius + EPS && d < bestDist) {
          bestDist = d;
          bestLantern = l;
        }
      }
      if (bestLantern) {
        const needed = Math.max(0, TUNING.lantern_cost - bestLantern.deposited);
        const amount = Math.min(this.player.carried, needed);
        if (amount > 0) {
          this.player.carried -= amount;
          bestLantern.deposited += amount;
          emit('deposit', {
            lantern_id: bestLantern.id,
            amount,
            deposited: bestLantern.deposited,
          });
          if (bestLantern.deposited >= TUNING.lantern_cost) {
            bestLantern.lit = true;
            this.score += TUNING.score.per_lantern;
            emit('lantern_lit', { lantern_id: bestLantern.id });

            if (this.lanterns.every((l) => l.lit)) {
              const timeLeft = this.getTimeLeftS();
              this.score +=
                Math.floor(timeLeft) * TUNING.score.per_second_left +
                this.player.flames * TUNING.score.per_flame_left;
              this.state = 'won';
              emit('game_over', { result: 'won', reason: 'all_lit' });
              return events;
            }
          }
        }
      }
    }

    // 5. Pulse: spend light to stun & push nearby shades
    if (pulsePressed && this.player.pulseCooldown <= EPS && this.player.carried >= TUNING.pulse_cost) {
      this.player.carried -= TUNING.pulse_cost;
      this.player.pulseCooldown = TUNING.pulse_cooldown_s;
      const stunnedIds = [];
      for (const s of this.shades) {
        const d = distXZ(this.player.pos, s.pos);
        if (d <= TUNING.pulse_radius + EPS) {
          s.state = 'stunned';
          s.stunTimer = TUNING.pulse_stun_s;
          let dx = s.pos[0] - this.player.pos[0];
          let dz = s.pos[2] - this.player.pos[2];
          const len = Math.hypot(dx, dz);
          if (len > EPS) {
            dx /= len;
            dz /= len;
          } else {
            dx = 1;
            dz = 0;
          }
          s.pos[0] += dx * TUNING.pulse_push_m;
          s.pos[2] += dz * TUNING.pulse_push_m;
          clampToIsland(s.pos);
          stunnedIds.push(s.id);
          this.score += TUNING.score.per_stun;
        }
      }
      emit('pulse', { stunned_ids: stunnedIds });
    }

    // 6. Shades AI + safe_radius + hit detection
    for (const s of this.shades) {
      if (s.state === 'stunned') {
        s.stunTimer -= DT;
        if (s.stunTimer <= EPS) {
          s.stunTimer = 0;
          s.state = 'chase';
        }
      } else {
        const dx = this.player.pos[0] - s.pos[0];
        const dz = this.player.pos[2] - s.pos[2];
        const dist = Math.hypot(dx, dz);
        if (dist > EPS) {
          const stepDist = Math.min(dist, TUNING.shade_speed * DT);
          s.pos[0] += (dx / dist) * stepDist;
          s.pos[2] += (dz / dist) * stepDist;
        }

        // Enforce safe_radius around all lit lanterns
        for (const l of this.lanterns) {
          if (!l.lit) continue;
          const lx = s.pos[0] - l.pos[0];
          const lz = s.pos[2] - l.pos[2];
          const ld = Math.hypot(lx, lz);
          if (ld < TUNING.safe_radius) {
            if (ld > EPS) {
              s.pos[0] = l.pos[0] + (lx / ld) * TUNING.safe_radius;
              s.pos[2] = l.pos[2] + (lz / ld) * TUNING.safe_radius;
            } else {
              s.pos[0] = l.pos[0] + TUNING.safe_radius;
            }
          }
        }
        clampToIsland(s.pos);
      }

      // Hit check against player
      if (s.state !== 'stunned' && this.player.invulnTimer <= EPS) {
        const dHit = distXZ(this.player.pos, s.pos);
        if (dHit <= TUNING.shade_hit_radius + EPS) {
          this.player.flames = Math.max(0, this.player.flames - 1);
          const dropped = Math.floor(this.player.carried * TUNING.hit_drop_ratio);
          this.player.carried -= dropped;
          this.player.invulnTimer = TUNING.invuln_s;
          emit('player_hit', {
            by: 'shade',
            flames: this.player.flames,
            dropped,
          });
          if (this.player.flames <= 0) {
            this.state = 'lost';
            emit('game_over', { result: 'lost', reason: 'no_flames' });
            return events;
          }
        }
      }
    }

    // 7. Runtime spawning (only when enabled)
    if (this.randomMotes && this.simTick % MOTE_RESPAWN_TICKS === 0 && this.motes.length < MAX_ACTIVE_MOTES) {
      this._spawnRandomMote();
    }
    if (this.randomShades && this.simTick % SHADE_SPAWN_TICKS === 0 && this.shades.length < MAX_ACTIVE_SHADES) {
      const spawned = this._spawnRandomShade();
      emit('shade_spawned', { id: spawned.id });
    }

    // 8. Dawn timeout check
    if (this.getTimeLeftS() <= EPS && this.state === 'playing') {
      this.state = 'lost';
      emit('game_over', { result: 'lost', reason: 'dawn' });
    }

    return events;
  }
}
