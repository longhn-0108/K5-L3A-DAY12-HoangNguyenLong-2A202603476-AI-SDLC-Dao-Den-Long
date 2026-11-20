export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const JUMP_VELOCITY = 7.0;
export const GRAVITY = 20.0;
export const SHADE_HEIGHT = 1.0;
export const PULSE_ORIGIN_Y_OFFSET = 0.8;
export const PULSE_PUSH_TICKS = 15;
export const PULSE_STUN_TICKS = 120;
export const INVULN_TICKS = 90;
export const DASH_TICKS = 12;
export const DASH_COOLDOWN_TICKS = 90;
export const PULSE_COOLDOWN_TICKS = 180;
export const CHARM_DURATION_TICKS = 600;
export const CHARM_SPEED = 7.2;
export const CHARM_RESPAWN_TICKS = 2700;
export const DROPPED_MOTE_TTL_TICKS = 480;
export const FALL_Y_THRESHOLD = -10;
export const FALL_RESPAWN_TICKS = 60;
export const SHADE_DETECT_RADIUS = 12;
export const SHADE_LOSE_RADIUS = 18;
export const SHADE_RECOIL_TICKS = 60;
export const SHADE_RECOIL_DIST = 2.0;
export const SHADE_SAFE_PUSH_TICKS = 30;
export const SHADE_NIGHT3_SPEED = 4.5;
export const DRIFTER_IDLE_SPEED = 2.0;
export const DRIFTER_CHASE_SPEED = 7.0;
export const DRIFTER_DETECT_RADIUS = 15;
export const DRIFTER_MIN_CARRIED = 5;
export const DRIFTER_STEAL_RADIUS = 1.2;
export const DRIFTER_MAX_STEAL = 3;
export const DRIFTER_FLEE_TICKS = 240;
export const DRIFTER_DROP_FLEE_TICKS = 120;
export const DRIFTER_SPAWN_INTERVAL = 1200;
export const DRIFTER_MAX_COUNT = 2;
export const MOTE_INITIAL_COUNT = 20;
export const MOTE_MAX_COUNT = 30;
export const MOTE_SPAWN_INTERVAL = 240;
export const VERTICAL_PICKUP_TOLERANCE = 1.5;
export const VERTICAL_HIT_TOLERANCE = 1.5;

export const TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 300,
  night2_duration_s: 330,
  night3_duration_s: 360,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: true,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

export function round3(value) {
  if (value === null || value === undefined) return value;
  const r = Math.round(value * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

export function distXZ(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function dist3D(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
