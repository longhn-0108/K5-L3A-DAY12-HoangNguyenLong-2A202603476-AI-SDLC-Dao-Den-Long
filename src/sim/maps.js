import { TUNING, round3 } from './tuning.js';

/**
 * Angles measured from +X axis, counter-clockwise when viewed from above (+Y),
 * in standard right-handed XZ plane: x = r * cos(a), z = -r * sin(a) or +r * sin(a)?
 * Note: Looking from +Y down onto XZ where +X is right and +Z is down/south:
 * Standard math CCW from +X towards +Z in screen/top-down or standard polar:
 * Wait: in Night 3, tier 1 is z > 0 with mote angles 20°, 40°, ..., 160° and ramps at 30° and 150°!
 * Since sin(20°..160°) > 0, z = r * sin(deg) puts 20°..160° in z > 0!
 */
function ringPoints(cx, cz, radius, count, startDeg = 0, stepDeg = 360 / count, y = 0) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const rad = ((startDeg + i * stepDeg) * Math.PI) / 180;
    pts.push([round3(cx + radius * Math.cos(rad)), y, round3(cz + radius * Math.sin(rad))]);
  }
  return pts;
}

export function getMapConfig(night) {
  if (night === 1) {
    return {
      night: 1,
      name: 'Đêm 1 — Đảo Bến',
      quote: '“Sương đen đã nuốt lấy ánh đèn đầu bến. Hãy gom đom đóm thắp lại 5 Đèn Lồng Lớn trước bình minh.” — Ông Đăng',
      durationS: TUNING.night1_duration_s,
      spawn: [0, 0, 0],
      lanterns: [
        { id: 'L1', pos: [0, 0, 25] },
        { id: 'L2', pos: [23.8, 0, 7.7] },
        { id: 'L3', pos: [14.7, 0, -20.2] },
        { id: 'L4', pos: [-14.7, 0, -20.2] },
        { id: 'L5', pos: [-23.8, 0, 7.7] },
      ],
      moteSpawns: [
        ...ringPoints(0, 0, 12, 8, 0, 45, 0),
        ...ringPoints(0, 0, 33, 16, 0, 22.5, 0),
      ],
      shadeSpawns: ringPoints(0, 0, 37, 12, 15, 30, 0),
      shadeIntervalTicks: 8 * 60,
      shadeMax: 6,
      shadeSpeed: TUNING.shade_speed,
      driftersEnabled: false,
      windEnabled: false,
      charms: [],
      jumpPads: [],
    };
  }

  if (night === 2) {
    return {
      night: 2,
      name: 'Đêm 2 — Đảo Cau',
      quote: '“Cầu tre mỏng manh nối hai bờ đảo. Coi chừng Gió Lạc cướp ánh sáng, và hãy tận dụng Bùa Gió cùng bục nhảy.” — Ông Đăng',
      durationS: TUNING.night2_duration_s,
      spawn: [0, 0, 0],
      lanterns: [
        { id: 'L1', pos: [0, 0, 20] },
        { id: 'L2', pos: [17, 0, -10] },
        { id: 'L3', pos: [-17, 0, -10] },
        { id: 'L4', pos: [70, 0, 20] },
        { id: 'L5', pos: [87, 0, -10] },
        { id: 'L6', pos: [53, 0, -10] },
      ],
      moteSpawns: [
        ...ringPoints(0, 0, 10, 4, 0, 90, 0),
        ...ringPoints(0, 0, 22, 8, 0, 45, 0),
        ...ringPoints(70, 0, 10, 4, 0, 90, 0),
        ...ringPoints(70, 0, 22, 8, 0, 45, 0),
      ],
      shadeSpawns: [
        ...ringPoints(0, 0, 26, 8, 22.5, 45, 0),
        ...ringPoints(70, 0, 26, 8, 22.5, 45, 0),
      ],
      shadeIntervalTicks: 7 * 60,
      shadeMax: 8,
      shadeSpeed: TUNING.shade_speed,
      driftersEnabled: true,
      windEnabled: false,
      charms: [{ id: 'C1', pos: [35, 0, 0] }],
      jumpPads: [
        { pos: [20, 0, 18], radius: 1.0, vy: 14, horizSpeed: 24, target: [70, 0, 0] },
        { pos: [50, 0, -18], radius: 1.0, vy: 14, horizSpeed: 24, target: [0, 0, 0] },
      ],
    };
  }

  // Night 3 — Đảo Chuông
  return {
    night: 3,
    name: 'Đêm 3 — Đảo Chuông',
    quote: '“Đỉnh tháp chuông nằm trên ba tầng đá giữa gió lốc. Vượt qua đêm cuối này, bình minh sẽ trở lại với Đảo Đèn Lồng.” — Ông Đăng',
    durationS: TUNING.night3_duration_s,
    spawn: [0, 0, 0],
    lanterns: [
      { id: 'L1', pos: [0, 6, 6] },
      { id: 'L2', pos: [18, 3, 10] },
      { id: 'L3', pos: [-18, 3, 10] },
      { id: 'L4', pos: [35, 0, -10] },
      { id: 'L5', pos: [-35, 0, -10] },
      { id: 'L6', pos: [20, 0, -35] },
      { id: 'L7', pos: [-20, 0, -35] },
    ],
    moteSpawns: [
      ...ringPoints(0, 0, 34, 18, 0, 20, 0),
      ...ringPoints(0, 0, 18, 8, 20, 20, 3),
      ...ringPoints(0, 0, 5, 4, 45, 90, 6),
    ],
    shadeSpawns: ringPoints(0, 0, 43, 16, 0, 22.5, 0),
    shadeIntervalTicks: 6 * 60,
    shadeMax: 10,
    shadeSpeed: 4.5,
    driftersEnabled: true,
    windEnabled: true,
    charms: [
      { id: 'C1', pos: [30, 0, 25] },
      { id: 'C2', pos: [-30, 0, 25] },
    ],
    jumpPads: [
      { pos: [0, 3, 13], radius: 1.0, vy: 12, horizSpeed: 8, dir: [0, -1] },
    ],
  };
}

/**
 * Computes ramp height at (x, z) on Night 3 if standing on one of the two 3m-wide radial ramps
 * at 30° and 150°, going from r = 30m (Y = 0) to r = 24m (Y = 3).
 */
function getNight3RampY(x, z) {
  for (const deg of [30, 150]) {
    const rad = (deg * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uz = Math.sin(rad);
    const along = x * ux + z * uz; // radial projection
    const perp = Math.abs(-x * uz + z * ux); // lateral distance from ramp centerline
    if (perp <= 1.5 && along >= 24 && along <= 30) {
      return ((30 - along) / 6) * 3;
    }
  }
  return null;
}

/**
 * Returns the highest walkable surface Y at (x, z) that is <= currentY + stepUp,
 * or null if over the void (sea of clouds).
 */
export function getSupportY(night, x, z, currentY, stepUp = 0.65) {
  if (night === 1) {
    return Math.hypot(x, z) <= 40 ? 0 : null;
  }

  if (night === 2) {
    const inA = Math.hypot(x, z) <= 28;
    const inB = Math.hypot(x - 70, z) <= 28;
    const onBridge = x >= 26 && x <= 44 && z >= -2 && z <= 2;
    return inA || inB || onBridge ? 0 : null;
  }

  // Night 3: 3 tiers + 2 ramps
  const r = Math.hypot(x, z);
  if (r > 45) return null;

  const candidates = [0]; // Tier 0 covers entire r <= 45
  if (r >= 12 && r <= 24 && z > 0) {
    candidates.push(3);
  }
  if (r <= 8) {
    candidates.push(6);
  }
  const rampY = getNight3RampY(x, z);
  if (rampY !== null) {
    candidates.push(rampY);
  }

  let best = null;
  for (const y of candidates) {
    if (y <= currentY + stepUp && (best === null || y > best)) {
      best = y;
    }
  }
  return best;
}

/**
 * Resolves horizontal solid obstacles (Night 3 tier cliff walls & Bell Tower cylinder r=2 at tier 2).
 * Returns { x, z, hitObstacle }.
 */
export function resolveObstacles(night, oldX, oldZ, newX, newZ, y) {
  let x = newX;
  let z = newZ;
  let hitObstacle = false;

  if (night !== 3) {
    return { x, z, hitObstacle };
  }

  // Bell tower cylinder at center of tier 2 (r = 2m, Y in [6, 14])
  if (y >= 5.5 && y < 14.5) {
    const d = Math.hypot(x, z);
    if (d < 2.0) {
      hitObstacle = true;
      if (d > 1e-6) {
        x = (x / d) * 2.0;
        z = (z / d) * 2.0;
      } else {
        x = 2.0;
        z = 0;
      }
    }
  }

  // Tier 2 vertical wall (r <= 8, Y = 6): if player is below tier 2 (y < 5.5), cannot enter r < 8?
  // Wait: Player spawns at (0, 0, 0) on Tier 0! Tier 2 is an elevated disc at Y = 6 above (0,0,0) OR solid pillar?
  // Note: Player spawns at (0,0,0) on Tier 0, so Tier 2 at Y=6 cannot block (0,0,0) at Y=0!
  // Instead, vertical walls prevent walking UP from Tier 0 (y < 2.5) into Tier 1 (r in 12..24, z > 0) unless on ramp!
  const newSupport = getSupportY(3, x, z, y, 0.65);
  const rampAtNew = getNight3RampY(x, z);

  // If moving horizontally into Tier 1 wall while below Tier 1 (y < 2.5) and not on ramp
  const rNew = Math.hypot(x, z);
  const rOld = Math.hypot(oldX, oldZ);
  const wasInTier1Footprint = rOld >= 12 && rOld <= 24 && oldZ > 0;
  const nowInTier1Footprint = rNew >= 12 && rNew <= 24 && z > 0;
  if (y < 2.4 && !wasInTier1Footprint && nowInTier1Footprint && rampAtNew === null) {
    // Allow staying on tier 0 if walking under, OR block cliff wall:
    // Spec: "Mép các tầng là vách đứng (không đi lên được; bước ra thì rơi xuống tầng dưới)."
    // Blocking entry into tier 1 solid cliff from tier 0 (unless on ramp):
    x = oldX;
    z = oldZ;
    hitObstacle = true;
  }

  // Prevent walking up from below Tier 2 (y in [2.5, 5.4]) into Tier 2 disc (r <= 8)
  if (y >= 2.4 && y < 5.4 && rNew < 8 && rOld >= 8) {
    x = oldX;
    z = oldZ;
    hitObstacle = true;
  }

  if (newSupport === null && y >= 0) {
    // Walking off edge into void is allowed (player falls!)
  }

  return { x, z, hitObstacle };
}

export function isPointOnGround(night, x, z) {
  return getSupportY(night, x, z, 100, 0) !== null;
}
