export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const ISLAND_RADIUS = 35;
export const PLAYABLE_RADIUS = 34.5;
export const JUMP_VELOCITY = 6.5;
export const GRAVITY = 18;
export const SHADE_HEIGHT = 1.0;

export const TUNING = {
  player_speed: 7,
  carry_capacity: 10,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.8,
  interact_radius: 3,
  pulse_cost: 2,
  pulse_radius: 7,
  night1_duration_s: 240,
  flames: 3,
  invuln_s: 2,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 6,
  pulse_cooldown_s: 4,
  safe_radius: 6,
  shade_speed: 2.8,
  shade_hit_radius: 1.2,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 25,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

export function round3(value) {
  const r = Math.round(value * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

export function distXZ(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}
