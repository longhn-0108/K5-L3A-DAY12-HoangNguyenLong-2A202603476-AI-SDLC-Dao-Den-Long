import {
  CHARM_DURATION_TICKS,
  CHARM_RESPAWN_TICKS,
  CHARM_SPEED,
  DASH_COOLDOWN_TICKS,
  DASH_TICKS,
  DRIFTER_CHASE_SPEED,
  DRIFTER_DETECT_RADIUS,
  DRIFTER_DROP_FLEE_TICKS,
  DRIFTER_FLEE_TICKS,
  DRIFTER_IDLE_SPEED,
  DRIFTER_MAX_COUNT,
  DRIFTER_MAX_STEAL,
  DRIFTER_MIN_CARRIED,
  DRIFTER_SPAWN_INTERVAL,
  DRIFTER_STEAL_RADIUS,
  DROPPED_MOTE_TTL_TICKS,
  DT,
  FALL_RESPAWN_TICKS,
  FALL_Y_THRESHOLD,
  GRAVITY,
  INVULN_TICKS,
  JUMP_VELOCITY,
  MOTE_INITIAL_COUNT,
  MOTE_MAX_COUNT,
  MOTE_SPAWN_INTERVAL,
  PULSE_COOLDOWN_TICKS,
  PULSE_ORIGIN_Y_OFFSET,
  PULSE_PUSH_TICKS,
  PULSE_STUN_TICKS,
  SHADE_DETECT_RADIUS,
  SHADE_HEIGHT,
  SHADE_LOSE_RADIUS,
  SHADE_RECOIL_DIST,
  SHADE_RECOIL_TICKS,
  SHADE_SAFE_PUSH_TICKS,
  TICK_RATE,
  TUNING,
  VERTICAL_HIT_TOLERANCE,
  VERTICAL_PICKUP_TOLERANCE,
  dist3D,
  distXZ,
  round3,
} from './tuning.js';
import { SeededPRNG } from './prng.js';
import { getMapConfig, getSupportY, resolveObstacles } from './maps.js';

const EPS = 1e-9;
const WIND_PERIOD_TICKS = 30 * TICK_RATE; // 1800
const WIND_DURATION_TICKS = 5 * TICK_RATE; // 300
const WIND_WARN_TICKS = 2 * TICK_RATE; // 120
const WIND_PUSH_SPEED = 2.0;

export class GameEngine {
  constructor({ seed = 1, night = 1, scenario = null } = {}) {
    this.seed = seed;
    this.night = night;
    this.map = getMapConfig(night);
    this.prng = new SeededPRNG(seed);

    this.tick = 0;
    this.simTick = 0;
    this.state = 'playing'; // 'playing' | 'paused' | 'won' | 'lost'
    this.score = 0;
    this.initialTimeLeftS = this.map.durationS;

    this.randomMotes = true;
    this.randomShades = true;
    this.randomDrifters = this.map.driftersEnabled;
    this.windEnabled = this.map.windEnabled;

    this.nextMoteSeq = 1;
    this.nextShadeSeq = 1;
    this.nextDrifterSeq = 1;

    this.wind = {
      active: false,
      warning: false,
      dirDeg: 0,
      ticksLeft: 0,
    };

    this.player = {
      pos: [...this.map.spawn],
      vel: [0, 0, 0],
      grounded: true,
      flames: TUNING.flames,
      carried: 0,
      invulnTicks: 0,
      dashCdTicks: 0,
      dashTicks: 0,
      dashDir: [0, 1],
      pulseCdTicks: 0,
      charmTicks: 0,
      respawnWaitTicks: 0,
      launchActive: false,
      launchVelXZ: [0, 0],
      facingYaw: 0, // +Z (sin(0)=0, cos(0)=1)
    };

    this.prevButtons = {
      jump: false,
      interact: false,
      pulse: false,
      dash: false,
      pause: false,
    };

    this.lanterns = this.map.lanterns.map((l) => ({
      id: l.id,
      pos: [...l.pos],
      lit: false,
      deposited: 0,
    }));

    this.motes = [];
    this.shades = [];
    this.drifters = [];
    this.charms = this.map.charms.map((c) => ({
      id: c.id,
      pos: [...c.pos],
      available: true,
      respawnTicks: 0,
    }));

    this._applyScenarioOrDefaults(scenario);
  }

  _nextMoteId() {
    const used = new Set(this.motes.map((m) => m.id));
    while (used.has(`M${this.nextMoteSeq}`)) this.nextMoteSeq += 1;
    return `M${this.nextMoteSeq++}`;
  }

  _nextShadeId() {
    const used = new Set(this.shades.map((s) => s.id));
    while (used.has(`S${this.nextShadeSeq}`)) this.nextShadeSeq += 1;
    return `S${this.nextShadeSeq++}`;
  }

  _nextDrifterId() {
    const used = new Set(this.drifters.map((d) => d.id));
    while (used.has(`D${this.nextDrifterSeq}`)) this.nextDrifterSeq += 1;
    return `D${this.nextDrifterSeq++}`;
  }

  _isSpawnOccupied(pt) {
    return this.motes.some((m) => distXZ(m.pos, pt) < 0.5 && Math.abs(m.pos[1] - pt[1]) < 1.0);
  }

  _spawnInitialMotes() {
    const pool = [...this.map.moteSpawns];
    // Deterministic Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.prng.next() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const count = Math.min(MOTE_INITIAL_COUNT, pool.length);
    for (let i = 0; i < count; i++) {
      this.motes.push({
        id: this._nextMoteId(),
        pos: [...pool[i]],
        kind: 'random',
        ttlTicks: null,
        pickableFromTick: 0,
      });
    }
  }

  _spawnOneRandomMote() {
    if (this.motes.length >= MOTE_MAX_COUNT) return null;
    const empty = this.map.moteSpawns.filter((pt) => !this._isSpawnOccupied(pt));
    if (empty.length === 0) return null;
    const idx = Math.floor(this.prng.next() * empty.length);
    const mote = {
      id: this._nextMoteId(),
      pos: [...empty[idx]],
      kind: 'random',
      ttlTicks: null,
      pickableFromTick: this.simTick + 1,
    };
    this.motes.push(mote);
    return mote;
  }

  _spawnOneShade(events) {
    if (this.shades.length >= this.map.shadeMax) return null;
    const valid = this.map.shadeSpawns.filter((pt) => {
      if (distXZ(pt, this.player.pos) < 15) return false;
      if (this.lanterns.some((l) => l.lit && distXZ(pt, l.pos) < TUNING.safe_radius)) return false;
      return true;
    });
    if (valid.length === 0) return null;
    const idx = Math.floor(this.prng.next() * valid.length);
    const pt = valid[idx];
    const shade = {
      id: this._nextShadeId(),
      pos: [pt[0], pt[1] + SHADE_HEIGHT, pt[2]],
      groundY: pt[1],
      state: 'spawning',
      stateTicksLeft: 30,
      pushTicksLeft: 0,
      pushDir: [1, 0],
      recoilDir: [1, 0],
      safePushTicks: 0,
      safePushLanternId: null,
      wanderAngle: this.prng.range(0, Math.PI * 2),
      activeFromTick: this.simTick + 1,
    };
    this.shades.push(shade);
    if (events) {
      events.push({ type: 'event', tick: this.tick, name: 'shade_spawned', data: { id: shade.id } });
    }
    return shade;
  }

  _spawnOneDrifter() {
    const activeCount = this.drifters.filter((d) => d.state !== 'removed').length;
    if (activeCount >= DRIFTER_MAX_COUNT) return null;
    const pool = this.map.shadeSpawns;
    const pt = pool[Math.floor(this.prng.next() * pool.length)];
    const drifter = {
      id: this._nextDrifterId(),
      pos: [pt[0], pt[1] + 1.5, pt[2]],
      state: 'idle',
      stolen: 0,
      hasStolen: false,
      stateTicksLeft: 0,
      orbitAngle: this.prng.range(0, Math.PI * 2),
      activeFromTick: this.simTick + 1,
    };
    this.drifters.push(drifter);
    return drifter;
  }

  _applyScenarioOrDefaults(scenario) {
    const sc = scenario || {};

    if (sc.random_motes !== undefined) this.randomMotes = sc.random_motes;
    if (sc.random_shades !== undefined) this.randomShades = sc.random_shades;
    if (sc.random_drifters !== undefined) this.randomDrifters = sc.random_drifters;
    if (sc.wind_enabled !== undefined) this.windEnabled = sc.wind_enabled;
    if (sc.time_left_s !== undefined) this.initialTimeLeftS = sc.time_left_s;

    if (sc.player) {
      if (sc.player.pos !== undefined) {
        this.player.pos = [sc.player.pos[0], sc.player.pos[1], sc.player.pos[2]];
        const sup = getSupportY(this.night, this.player.pos[0], this.player.pos[2], this.player.pos[1], 0.1);
        this.player.grounded = sup !== null && Math.abs(this.player.pos[1] - sup) < 0.05;
      }
      if (sc.player.carried !== undefined) this.player.carried = sc.player.carried;
      if (sc.player.flames !== undefined) this.player.flames = sc.player.flames;
      if (sc.player.invuln_ticks !== undefined) this.player.invulnTicks = sc.player.invuln_ticks;
      if (sc.player.dash_cd_ticks !== undefined) this.player.dashCdTicks = sc.player.dash_cd_ticks;
      if (sc.player.pulse_cd_ticks !== undefined) this.player.pulseCdTicks = sc.player.pulse_cd_ticks;
      if (sc.player.charm_ticks !== undefined) this.player.charmTicks = sc.player.charm_ticks;
    }

    if (sc.lanterns) {
      for (const patch of sc.lanterns) {
        const target = this.lanterns.find((l) => l.id === patch.id);
        if (!target) continue;
        if (patch.pos !== undefined) target.pos = [...patch.pos];
        if (patch.deposited !== undefined) target.deposited = patch.deposited;
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
          return { id: this._nextMoteId(), pos: [m[0], m[1], m[2]], kind: 'random', ttlTicks: null, pickableFromTick: 0 };
        }
        return {
          id: m.id || this._nextMoteId(),
          pos: [m.pos[0], m.pos[1], m.pos[2]],
          kind: m.kind || 'random',
          ttlTicks: m.ttl_s !== undefined && m.ttl_s !== null ? Math.round(m.ttl_s * TICK_RATE) : null,
          pickableFromTick: 0,
        };
      });
    } else if (this.randomMotes) {
      this._spawnInitialMotes();
    }

    if (sc.shades !== undefined) {
      const explicitIds = new Set(sc.shades.filter((s) => s.id).map((s) => s.id));
      for (const s of sc.shades) {
        let id = s.id;
        if (!id) {
          while (explicitIds.has(`S${this.nextShadeSeq}`)) this.nextShadeSeq += 1;
          id = `S${this.nextShadeSeq++}`;
          explicitIds.add(id);
        }
        const state = s.state || 'chase';
        const groundY = s.pos[1] >= 1 ? s.pos[1] - SHADE_HEIGHT : s.pos[1];
        this.shades.push({
          id,
          pos: [s.pos[0], s.pos[1], s.pos[2]],
          groundY: Math.max(0, groundY),
          state,
          stateTicksLeft: s.state_ticks_left !== undefined ? s.state_ticks_left : state === 'stunned' ? PULSE_STUN_TICKS : 0,
          pushTicksLeft: 0,
          pushDir: [1, 0],
          recoilDir: [1, 0],
          safePushTicks: 0,
          safePushLanternId: null,
          wanderAngle: 0,
          activeFromTick: 0,
        });
      }
    }

    if (sc.drifters !== undefined) {
      const explicitIds = new Set(sc.drifters.filter((d) => d.id).map((d) => d.id));
      for (const d of sc.drifters) {
        let id = d.id;
        if (!id) {
          while (explicitIds.has(`D${this.nextDrifterSeq}`)) this.nextDrifterSeq += 1;
          id = `D${this.nextDrifterSeq++}`;
          explicitIds.add(id);
        }
        this.drifters.push({
          id,
          pos: [d.pos[0], d.pos[1], d.pos[2]],
          state: d.state || 'idle',
          stolen: d.stolen || 0,
          hasStolen: Boolean(d.stolen && d.stolen > 0),
          stateTicksLeft: d.state === 'flee' ? DRIFTER_FLEE_TICKS : 0,
          orbitAngle: 0,
          activeFromTick: 0,
        });
      }
    }

    if (sc.charms !== undefined) {
      this.charms = sc.charms.map((c, idx) => ({
        id: c.id || `C${idx + 1}`,
        pos: c.pos ? [...c.pos] : [0, 0, 0],
        available: c.available !== undefined ? c.available : true,
        respawnTicks: c.respawn_ticks !== undefined ? c.respawn_ticks : 0,
      }));
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
      night: this.night,
      state: this.state,
      time_left_s: round3(this.getTimeLeftS()),
      score: this.score,
      wind: {
        active: this.wind.active,
        dir_deg: round3(this.wind.dirDeg),
      },
      player: {
        pos: [round3(this.player.pos[0]), round3(this.player.pos[1]), round3(this.player.pos[2])],
        vel: [round3(this.player.vel[0]), round3(this.player.vel[1]), round3(this.player.vel[2])],
        grounded: this.player.grounded,
        flames: this.player.flames,
        carried: this.player.carried,
        invuln: this.player.invulnTicks > 0,
        dash_cd_s: round3(this.player.dashCdTicks / TICK_RATE),
        pulse_cd_s: round3(this.player.pulseCdTicks / TICK_RATE),
        charm_s: round3(this.player.charmTicks / TICK_RATE),
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
        kind: m.kind,
        ttl_s: m.ttlTicks === null ? null : round3(m.ttlTicks / TICK_RATE),
      })),
      drifters: this.drifters.map((d) => ({
        id: d.id,
        pos: [round3(d.pos[0]), round3(d.pos[1]), round3(d.pos[2])],
        state: d.state,
        stolen: d.stolen,
      })),
      charms: this.charms.map((c) => ({
        id: c.id,
        available: c.available,
        respawn_s: round3(c.respawnTicks / TICK_RATE),
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
   * Executes 1 fixed tick (1/60s) following the mandatory 12-step order of TICKET-02.
   */
  step(input = {}) {
    if (this.state === 'won' || this.state === 'lost') {
      return [];
    }

    this.tick += 1;
    const currentTick = this.tick;
    const events = [];
    const emit = (name, data) => {
      events.push({ type: 'event', tick: currentTick, name, data });
    };

    // STEP 1: Read input & handle pause FIRST
    const pauseDown = Boolean(input.pause);
    const pausePressed = pauseDown && !this.prevButtons.pause;
    this.prevButtons.pause = pauseDown;

    if (pausePressed) {
      if (this.state === 'playing') {
        this.state = 'paused';
        emit('paused', {});
        return events;
      } else if (this.state === 'paused') {
        this.state = 'playing';
        emit('resumed', {});
      }
    }

    if (this.state === 'paused') {
      // Frozen: tick increments, sim_tick and all timers remain frozen
      return events;
    }

    // Active simulation tick
    this.simTick += 1;

    const move = input.move || [0, 0];
    const camYawDeg = input.cam_yaw_deg || 0;
    const jumpDown = Boolean(input.jump);
    const interactDown = Boolean(input.interact);
    const pulseDown = Boolean(input.pulse);
    const dashDown = Boolean(input.dash);

    const jumpPressed = jumpDown && !this.prevButtons.jump;
    const interactPressed = interactDown && !this.prevButtons.interact;
    const pulsePressed = pulseDown && !this.prevButtons.pulse;
    const dashPressed = dashDown && !this.prevButtons.dash;

    this.prevButtons.jump = jumpDown;
    this.prevButtons.interact = interactDown;
    this.prevButtons.pulse = pulseDown;
    this.prevButtons.dash = dashDown;

    // STEP 2: Decrement counters (time is derived from simTick; decrement all other timers)
    const p = this.player;
    if (p.dashCdTicks > 0) p.dashCdTicks -= 1;
    if (p.pulseCdTicks > 0) p.pulseCdTicks -= 1;
    if (p.invulnTicks > 0) p.invulnTicks -= 1;
    if (p.charmTicks > 0) p.charmTicks -= 1;

    // Dropped motes TTL
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      if (m.ttlTicks !== null) {
        m.ttlTicks -= 1;
        if (m.ttlTicks <= 0) {
          this.motes.splice(i, 1);
        }
      }
    }

    // Charm respawn timers
    for (const c of this.charms) {
      if (!c.available && c.respawnTicks > 0) {
        c.respawnTicks -= 1;
        if (c.respawnTicks <= 0) {
          c.available = true;
          c.respawnTicks = 0;
        }
      }
    }

    // Shade state timers
    for (const s of this.shades) {
      if (s.stateTicksLeft > 0) {
        s.stateTicksLeft -= 1;
        if (s.stateTicksLeft <= 0) {
          if (s.state === 'spawning' || s.state === 'stunned' || s.state === 'recoil') {
            s.state = 'wander';
            s.pushTicksLeft = 0;
          }
        }
      }
    }

    // Drifter flee timers
    for (const d of this.drifters) {
      if (d.state === 'flee' && d.stateTicksLeft > 0) {
        d.stateTicksLeft -= 1;
        if (d.stateTicksLeft <= 0) {
          d.state = 'removed';
        }
      }
    }

    // Night 3 Wind schedule
    if (this.windEnabled) {
      const cycle = this.simTick % WIND_PERIOD_TICKS;
      if (this.simTick >= WIND_PERIOD_TICKS - WIND_WARN_TICKS && cycle === WIND_PERIOD_TICKS - WIND_WARN_TICKS) {
        this.wind.dirDeg = round3(this.prng.range(0, 360));
        this.wind.warning = true;
      }
      if (this.simTick >= WIND_PERIOD_TICKS && cycle === 0) {
        this.wind.active = true;
        this.wind.warning = false;
        this.wind.ticksLeft = WIND_DURATION_TICKS;
      } else if (this.wind.active) {
        this.wind.ticksLeft -= 1;
        if (this.wind.ticksLeft <= 0) {
          this.wind.active = false;
          this.wind.ticksLeft = 0;
        }
      }
    } else {
      this.wind.active = false;
      this.wind.warning = false;
    }

    // STEP 3: Move Mây (jump, dash, jump pads, wind) then check fall
    const isRespawning = p.respawnWaitTicks > 0;
    if (isRespawning) {
      p.respawnWaitTicks -= 1;
      p.vel = [0, 0, 0];
      if (p.respawnWaitTicks <= 0) {
        p.pos = [...this.map.spawn];
        p.vel = [0, 0, 0];
        p.grounded = true;
        p.invulnTicks = INVULN_TICKS;
        p.launchActive = false;
        p.dashTicks = 0;
      }
    } else {
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
        p.facingYaw = Math.atan2(wx, wz);
      }

      // Dash trigger (14 m/s for 12 ticks, 90-tick cooldown from start; 0 cd with Wind Charm)
      if (dashPressed && p.dashTicks <= 0 && (p.charmTicks > 0 || p.dashCdTicks <= 0)) {
        p.dashTicks = DASH_TICKS;
        p.dashCdTicks = p.charmTicks > 0 ? 0 : DASH_COOLDOWN_TICKS;
        p.launchActive = false;
        if (mag > EPS) {
          p.dashDir = [wx / mag, wz / mag];
        } else {
          p.dashDir = [Math.sin(p.facingYaw), Math.cos(p.facingYaw)];
        }
        emit('dash', {});
      }

      // Jump (only when grounded)
      if (jumpPressed && p.grounded && p.dashTicks <= 0) {
        p.vel[1] = JUMP_VELOCITY;
        p.grounded = false;
      }

      // Compute horizontal velocity
      let vx = 0;
      let vz = 0;
      if (p.dashTicks > 0) {
        vx = p.dashDir[0] * TUNING.dash_speed;
        vz = p.dashDir[1] * TUNING.dash_speed;
        p.vel[1] = 0; // Dash maintains altitude in air
        p.dashTicks -= 1;
      } else if (p.launchActive) {
        vx = p.launchVelXZ[0];
        vz = p.launchVelXZ[1];
      } else {
        const moveSpeed = p.charmTicks > 0 ? CHARM_SPEED : TUNING.player_speed;
        vx = wx * moveSpeed;
        vz = wz * moveSpeed;
      }

      // Apply Night 3 wind push
      if (this.wind.active) {
        const wrad = (this.wind.dirDeg * Math.PI) / 180;
        vx += Math.cos(wrad) * WIND_PUSH_SPEED;
        vz += Math.sin(wrad) * WIND_PUSH_SPEED;
      }

      p.vel[0] = vx;
      p.vel[2] = vz;

      // Integrate horizontal + resolve obstacles
      const oldX = p.pos[0];
      const oldZ = p.pos[2];
      const nextX = oldX + vx * DT;
      const nextZ = oldZ + vz * DT;
      const resolved = resolveObstacles(this.night, oldX, oldZ, nextX, nextZ, p.pos[1]);
      p.pos[0] = resolved.x;
      p.pos[2] = resolved.z;

      // Integrate vertical (gravity unless dashing)
      const isDashingThisTick = p.dashTicks > 0 || (dashPressed && p.dashTicks === DASH_TICKS - 1);
      if (!isDashingThisTick) {
        const support = getSupportY(this.night, p.pos[0], p.pos[2], p.pos[1], 0.65);
        if (p.grounded && support !== null && p.vel[1] <= 0) {
          p.pos[1] = support;
          p.vel[1] = 0;
        } else {
          p.grounded = false;
          p.pos[1] += p.vel[1] * DT;
          p.vel[1] -= GRAVITY * DT;
          const landSupport = getSupportY(this.night, p.pos[0], p.pos[2], p.pos[1] + Math.abs(p.vel[1] * DT) + 0.2, 0.3);
          if (landSupport !== null && p.pos[1] <= landSupport && p.vel[1] <= 0) {
            p.pos[1] = landSupport;
            p.vel[1] = 0;
            p.grounded = true;
            p.launchActive = false;
          }
        }
      }

      // Check Jump Pads
      for (const pad of this.map.jumpPads) {
        if (distXZ(p.pos, pad.pos) <= pad.radius + EPS && Math.abs(p.pos[1] - pad.pos[1]) <= 0.6) {
          let dx;
          let dz;
          if (pad.target) {
            dx = pad.target[0] - pad.pos[0];
            dz = pad.target[2] - pad.pos[2];
          } else {
            dx = pad.dir[0];
            dz = pad.dir[1];
          }
          const len = Math.hypot(dx, dz) || 1;
          p.launchActive = true;
          p.launchVelXZ = [(dx / len) * pad.horizSpeed, (dz / len) * pad.horizSpeed];
          p.vel[0] = p.launchVelXZ[0];
          p.vel[1] = pad.vy;
          p.vel[2] = p.launchVelXZ[1];
          p.grounded = false;
          p.dashTicks = 0;
          break;
        }
      }

      // Fall check (Y < -10): ignores invuln, happens once
      if (TUNING.fall_enabled && p.pos[1] < FALL_Y_THRESHOLD) {
        p.flames = Math.max(0, p.flames - 1);
        const lost = p.carried;
        p.carried = 0;
        p.launchActive = false;
        p.dashTicks = 0;
        emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
        if (p.flames > 0) {
          p.respawnWaitTicks = FALL_RESPAWN_TICKS;
        }
      }
    }

    const canInteract = p.respawnWaitTicks === 0 && p.flames > 0;

    // STEP 4: Pick up motes & charms
    if (canInteract) {
      if (p.carried < TUNING.carry_capacity && this.motes.length > 0) {
        const candidates = [];
        for (const m of this.motes) {
          if (m.pickableFromTick > this.simTick) continue;
          const d = distXZ(p.pos, m.pos);
          if (d <= TUNING.pickup_radius + EPS && Math.abs(p.pos[1] - m.pos[1]) <= VERTICAL_PICKUP_TOLERANCE + EPS) {
            candidates.push({ mote: m, dist: d });
          }
        }
        if (candidates.length > 0) {
          candidates.sort((a, b) => a.dist - b.dist || a.mote.id.localeCompare(b.mote.id));
          const pickedIds = new Set();
          for (const c of candidates) {
            if (p.carried >= TUNING.carry_capacity) break;
            pickedIds.add(c.mote.id);
            p.carried += 1;
            emit('mote_picked', { carried: p.carried });
          }
          this.motes = this.motes.filter((m) => !pickedIds.has(m.id));
        }
      }

      for (const c of this.charms) {
        if (!c.available) continue;
        if (distXZ(p.pos, c.pos) <= TUNING.pickup_radius + EPS && Math.abs(p.pos[1] - c.pos[1]) <= VERTICAL_PICKUP_TOLERANCE + EPS) {
          c.available = false;
          c.respawnTicks = CHARM_RESPAWN_TICKS;
          p.charmTicks = CHARM_DURATION_TICKS;
          p.dashCdTicks = 0;
          emit('charm_picked', { charm_id: c.id, charm_ticks: CHARM_DURATION_TICKS });
        }
      }
    }

    // STEP 5: Interact with lanterns
    if (canInteract && interactPressed && p.carried > 0) {
      let bestLantern = null;
      let bestDist = Infinity;
      for (const l of this.lanterns) {
        if (l.lit) continue;
        const d = distXZ(p.pos, l.pos);
        if (d <= TUNING.interact_radius + EPS && Math.abs(p.pos[1] - l.pos[1]) <= 2.0) {
          if (d < bestDist - EPS || (Math.abs(d - bestDist) <= EPS && bestLantern && l.id < bestLantern.id)) {
            bestDist = d;
            bestLantern = l;
          }
        }
      }
      if (bestLantern) {
        const needed = Math.max(0, TUNING.lantern_cost - bestLantern.deposited);
        const amount = Math.min(p.carried, needed);
        if (amount > 0) {
          p.carried -= amount;
          bestLantern.deposited += amount;
          this.score += amount * TUNING.score.per_mote;
          emit('deposit', { lantern_id: bestLantern.id, amount, deposited: bestLantern.deposited });

          if (bestLantern.deposited >= TUNING.lantern_cost) {
            bestLantern.lit = true;
            this.score += TUNING.score.per_lantern;
            emit('lantern_lit', { lantern_id: bestLantern.id });
            // Any shade currently inside safe_radius is pushed out over <= 30 ticks (no damage during push)
            for (const s of this.shades) {
              if (distXZ(s.pos, bestLantern.pos) < TUNING.safe_radius) {
                s.safePushTicks = SHADE_SAFE_PUSH_TICKS;
                s.safePushLanternId = bestLantern.id;
              }
            }
          }
        }
      }
    }

    // STEP 6: Update safe zones
    for (const s of this.shades) {
      if (s.safePushTicks > 0) {
        const l = this.lanterns.find((x) => x.id === s.safePushLanternId);
        if (l) {
          const lx = s.pos[0] - l.pos[0];
          const lz = s.pos[2] - l.pos[2];
          const ld = Math.hypot(lx, lz);
          if (ld < TUNING.safe_radius) {
            const rem = TUNING.safe_radius - ld;
            const stepOut = rem / s.safePushTicks;
            const ux = ld > EPS ? lx / ld : 1;
            const uz = ld > EPS ? lz / ld : 0;
            s.pos[0] += ux * stepOut;
            s.pos[2] += uz * stepOut;
          }
        }
        s.safePushTicks -= 1;
        if (s.safePushTicks <= 0) s.safePushLanternId = null;
      }
    }

    // STEP 7: Pulse (Tỏa Sáng)
    if (canInteract && pulsePressed && p.pulseCdTicks <= 0 && p.carried >= TUNING.pulse_cost) {
      p.carried -= TUNING.pulse_cost;
      p.pulseCdTicks = PULSE_COOLDOWN_TICKS;
      const origin = [p.pos[0], p.pos[1] + PULSE_ORIGIN_Y_OFFSET, p.pos[2]];
      const stunnedIds = [];

      for (const s of this.shades) {
        if (s.activeFromTick > this.simTick || s.state === 'spawning') continue;
        if (dist3D(origin, s.pos) <= TUNING.pulse_radius + EPS) {
          s.state = 'stunned';
          s.stateTicksLeft = PULSE_STUN_TICKS;
          s.pushTicksLeft = PULSE_PUSH_TICKS;
          let dx = s.pos[0] - p.pos[0];
          let dz = s.pos[2] - p.pos[2];
          const len = Math.hypot(dx, dz);
          s.pushDir = len > EPS ? [dx / len, dz / len] : [1, 0];
          stunnedIds.push(s.id);
          this.score += TUNING.score.per_stun;
        }
      }

      for (const d of this.drifters) {
        if (d.activeFromTick > this.simTick || d.state === 'removed') continue;
        if (dist3D(origin, d.pos) <= TUNING.pulse_radius + EPS) {
          if (d.state === 'chase') {
            d.state = 'flee';
            d.stateTicksLeft = DRIFTER_FLEE_TICKS;
          } else if (d.state === 'flee' && d.stolen > 0) {
            const amt = d.stolen;
            d.stolen = 0;
            d.stateTicksLeft = DRIFTER_DROP_FLEE_TICKS;
            for (let i = 0; i < amt; i++) {
              const sup = getSupportY(this.night, d.pos[0], d.pos[2], 100, 0);
              const gy = sup !== null ? sup : 0;
              this.motes.push({
                id: this._nextMoteId(),
                pos: [d.pos[0], gy, d.pos[2]],
                kind: 'dropped',
                ttlTicks: DROPPED_MOTE_TTL_TICKS,
                pickableFromTick: this.simTick + 1,
              });
            }
            emit('drifter_drop', { drifter_id: d.id, amount: amt });
          }
        }
      }

      emit('pulse', { stunned_ids: stunnedIds });
    }

    // STEP 8: Move Shades & Drifters
    for (const s of this.shades) {
      if (s.activeFromTick > this.simTick || s.state === 'spawning') continue;

      if (s.state === 'stunned') {
        if (s.pushTicksLeft > 0) {
          const stepPush = TUNING.pulse_push_m / PULSE_PUSH_TICKS;
          const nx = s.pos[0] + s.pushDir[0] * stepPush;
          const nz = s.pos[2] + s.pushDir[1] * stepPush;
          const res = resolveObstacles(this.night, s.pos[0], s.pos[2], nx, nz, s.groundY);
          const sup = getSupportY(this.night, res.x, res.z, s.groundY, 0.65);
          if (!res.hitObstacle && sup !== null) {
            s.pos[0] = res.x;
            s.pos[2] = res.z;
            s.groundY = sup;
            s.pos[1] = sup + SHADE_HEIGHT;
          } else {
            s.pushTicksLeft = 0;
          }
          if (s.pushTicksLeft > 0) s.pushTicksLeft -= 1;
        }
      } else if (s.state === 'recoil') {
        const stepRec = SHADE_RECOIL_DIST / SHADE_RECOIL_TICKS;
        const nx = s.pos[0] + s.recoilDir[0] * stepRec;
        const nz = s.pos[2] + s.recoilDir[1] * stepRec;
        const sup = getSupportY(this.night, nx, nz, s.groundY, 0.65);
        if (sup !== null) {
          s.pos[0] = nx;
          s.pos[2] = nz;
          s.groundY = sup;
          s.pos[1] = sup + SHADE_HEIGHT;
        }
      } else {
        const dPlayer = distXZ(s.pos, p.pos);
        if (s.state === 'wander' && canInteract && dPlayer <= SHADE_DETECT_RADIUS + EPS) {
          s.state = 'chase';
        } else if (s.state === 'chase' && (!canInteract || dPlayer > SHADE_LOSE_RADIUS)) {
          s.state = 'wander';
        }

        let targetDx = 0;
        let targetDz = 0;
        let speed = this.map.shadeSpeed;
        if (s.state === 'chase') {
          targetDx = p.pos[0] - s.pos[0];
          targetDz = p.pos[2] - s.pos[2];
        } else {
          s.wanderAngle += 0.02;
          targetDx = Math.cos(s.wanderAngle);
          targetDz = Math.sin(s.wanderAngle);
          speed = this.map.shadeSpeed * 0.4;
        }

        const len = Math.hypot(targetDx, targetDz);
        if (len > EPS) {
          const stepDist = s.state === 'chase' ? Math.min(len, speed * DT) : speed * DT;
          let nx = s.pos[0] + (targetDx / len) * stepDist;
          let nz = s.pos[2] + (targetDz / len) * stepDist;

          // Block outside shades at safe_radius edge of lit lanterns
          if (s.safePushTicks === 0) {
            for (const l of this.lanterns) {
              if (!l.lit) continue;
              const lx = nx - l.pos[0];
              const lz = nz - l.pos[2];
              const ld = Math.hypot(lx, lz);
              if (ld < TUNING.safe_radius) {
                const ux = ld > EPS ? lx / ld : 1;
                const uz = ld > EPS ? lz / ld : 0;
                nx = l.pos[0] + ux * TUNING.safe_radius;
                nz = l.pos[2] + uz * TUNING.safe_radius;
              }
            }
          }

          const res = resolveObstacles(this.night, s.pos[0], s.pos[2], nx, nz, s.groundY);
          const sup = getSupportY(this.night, res.x, res.z, s.groundY, 0.8);
          if (sup !== null) {
            s.pos[0] = res.x;
            s.pos[2] = res.z;
            s.groundY = sup;
            s.pos[1] = sup + SHADE_HEIGHT;
          }
        }
      }
    }

    for (const d of this.drifters) {
      if (d.activeFromTick > this.simTick || d.state === 'removed') continue;
      if (d.state === 'idle') {
        if (canInteract && !d.hasStolen && p.carried >= DRIFTER_MIN_CARRIED && distXZ(d.pos, p.pos) <= DRIFTER_DETECT_RADIUS + EPS) {
          d.state = 'chase';
        } else {
          d.orbitAngle += 0.03;
          d.pos[0] += Math.cos(d.orbitAngle) * DRIFTER_IDLE_SPEED * DT;
          d.pos[2] += Math.sin(d.orbitAngle) * DRIFTER_IDLE_SPEED * DT;
        }
      } else if (d.state === 'chase') {
        if (!canInteract || p.carried < DRIFTER_MIN_CARRIED || distXZ(d.pos, p.pos) > DRIFTER_DETECT_RADIUS + EPS) {
          d.state = 'idle';
        } else {
          const dx = p.pos[0] - d.pos[0];
          const dz = p.pos[2] - d.pos[2];
          const len = Math.hypot(dx, dz);
          if (len > EPS) {
            const stepDist = Math.min(len, DRIFTER_CHASE_SPEED * DT);
            d.pos[0] += (dx / len) * stepDist;
            d.pos[2] += (dz / len) * stepDist;
          }
        }
      } else if (d.state === 'flee') {
        let dx = d.pos[0] - p.pos[0];
        let dz = d.pos[2] - p.pos[2];
        const len = Math.hypot(dx, dz);
        if (len > EPS) {
          dx /= len;
          dz /= len;
        } else {
          dx = 1;
          dz = 0;
        }
        d.pos[0] += dx * DRIFTER_CHASE_SPEED * DT;
        d.pos[2] += dz * DRIFTER_CHASE_SPEED * DT;
      }
    }

    // STEP 9: Collisions — Drifters steal FIRST, then Shades hit (sorted by ascending id)
    if (canInteract) {
      const sortedDrifters = [...this.drifters].sort((a, b) => a.id.localeCompare(b.id));
      for (const d of sortedDrifters) {
        if (d.activeFromTick > this.simTick || d.state !== 'chase' || d.hasStolen) continue;
        if (distXZ(d.pos, p.pos) <= DRIFTER_STEAL_RADIUS + EPS) {
          const amount = Math.min(DRIFTER_MAX_STEAL, p.carried);
          p.carried -= amount;
          d.stolen = amount;
          d.hasStolen = true;
          d.state = 'flee';
          d.stateTicksLeft = DRIFTER_FLEE_TICKS;
          emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
        }
      }

      if (p.invulnTicks <= 0) {
        const sortedShades = [...this.shades].sort((a, b) => a.id.localeCompare(b.id));
        for (const s of sortedShades) {
          if (s.activeFromTick > this.simTick) continue;
          if (s.state !== 'chase' && s.state !== 'wander') continue;
          if (s.safePushTicks > 0) continue;

          if (distXZ(p.pos, s.pos) <= TUNING.shade_hit_radius + EPS && Math.abs(p.pos[1] - s.groundY) <= VERTICAL_HIT_TOLERANCE + EPS) {
            p.flames = Math.max(0, p.flames - 1);
            const dropped = Math.floor(p.carried * TUNING.hit_drop_ratio);
            p.carried -= dropped;
            p.invulnTicks = INVULN_TICKS;

            // Spawn dropped motes in 1.5–2.5 m ring around Mây
            for (let i = 0; i < dropped; i++) {
              const angle = this.prng.range(0, Math.PI * 2);
              const radius = this.prng.range(1.5, 2.5);
              let mx = p.pos[0] + Math.cos(angle) * radius;
              let mz = p.pos[2] + Math.sin(angle) * radius;
              let sup = getSupportY(this.night, mx, mz, p.pos[1] + 1, 0.5);
              if (sup === null) {
                mx = p.pos[0];
                mz = p.pos[2];
                sup = Math.max(0, p.pos[1]);
              }
              this.motes.push({
                id: this._nextMoteId(),
                pos: [mx, sup, mz],
                kind: 'dropped',
                ttlTicks: DROPPED_MOTE_TTL_TICKS,
                pickableFromTick: this.simTick + 1,
              });
            }

            // Hitting shade recoils 2m over 60 ticks
            let rx = s.pos[0] - p.pos[0];
            let rz = s.pos[2] - p.pos[2];
            const rlen = Math.hypot(rx, rz);
            s.recoilDir = rlen > EPS ? [rx / rlen, rz / rlen] : [1, 0];
            s.state = 'recoil';
            s.stateTicksLeft = SHADE_RECOIL_TICKS;

            emit('player_hit', { by: 'shade', flames: p.flames, dropped });
            break; // Max 1 flame lost per tick
          }
        }
      }
    }

    // STEP 10: Scheduled spawns (only interactable from next tick)
    if (this.randomMotes && this.simTick % MOTE_SPAWN_INTERVAL === 0) {
      this._spawnOneRandomMote();
    }
    if (this.randomShades) {
      if (this.simTick === 300) {
        this._spawnOneShade(events);
        this._spawnOneShade(events);
      } else if (this.simTick > 300 && (this.simTick - 300) % this.map.shadeIntervalTicks === 0) {
        this._spawnOneShade(events);
      }
    }
    if (this.randomDrifters && this.simTick % DRIFTER_SPAWN_INTERVAL === 0) {
      this._spawnOneDrifter();
    }

    // STEP 11: Win / Loss evaluation (strict priority: no_flames -> all_lit -> dawn)
    const timeLeft = this.getTimeLeftS();
    if (p.flames <= 0) {
      this.state = 'lost';
      emit('game_over', { result: 'lost', reason: 'no_flames' });
    } else if (this.lanterns.every((l) => l.lit)) {
      this.score +=
        Math.floor(timeLeft) * TUNING.score.per_second_left +
        p.flames * TUNING.score.per_flame_left;
      this.state = 'won';
      emit('game_over', { result: 'won', reason: 'all_lit' });
    } else if (timeLeft <= EPS) {
      this.state = 'lost';
      emit('game_over', { result: 'lost', reason: 'dawn' });
    }

    return events;
  }
}
