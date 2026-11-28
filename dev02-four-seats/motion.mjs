// v6-0: isolated 42 ms motion lab profiles. Only locomotion changes here;
// target selection, attack permissions, separation and walkability stay in combat.mjs.
import * as L from '../dev05-layout/layout.mjs';

export const WORLD_PER_PX = 1.62 / 128; // Existing range scale: 128 source px = 1.62 arena units.
const TAU = 2 * Math.PI;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const turnToward = (from, to, rate) => (from + clamp(angleDiff(to, from), -rate, rate) + TAU) % TAU;
const radians = raw => raw * TAU / 256;
const walk = (stride, turn) => ({ stride, turn: radians(turn) });
const inertia = (top, accel, halt, turn) => ({ max: top / 256, accel: accel / 256, halt: halt / 256, turn: radians(turn) });

// StarEdit flingy.dat inertia; walk loops measured in the independent OpenBW trace/lab.
// Normal Scout stays normal; the lab's separate Artanis variant is not used in this match.
export const MOTION = {
  marine: walk([4], 40),
  dragoon: walk([6, 8, 8, 2, 2, 6, 6, 4], 40),
  mutalisk: inertia(1707, 67, 21745, 40),
  hydralisk: walk([2, 2, 6, 6, 6, 2, 2], 27),
  archon: inertia(1280, 160, 5120, 40),
  wraith: inertia(1707, 67, 21745, 40),
  battlecruiser: inertia(640, 27, 7585, 20),
  scout: inertia(1280, 48, 17067, 30),
  scourge: inertia(1707, 107, 13616, 40),
};

export function brakingDistance(profile, speed) {
  return speed === profile.max ? profile.halt : speed * speed / (2 * profile.accel);
}

// Only called for a whole source frame (0 or 1 per 30 Hz web tick; no fractional walk stride).
// Return the displacement; the caller still applies legacy formation offsets, bounds and phase order.
export function motionDisplacement(u, p, frames) {
  if (!frames) return [0, 0];
  const k = MOTION[u.kind];
  if (!u.motion) {
    const [x, z] = L.seatById(u.seat).dir;
    const face = u.dx || u.dz ? Math.atan2(u.dz, u.dx) : Math.atan2(-z, -x);
    u.motion = { heading: (face + TAU) % TAU, direction: (face + TAU) % TAU, speed: 0, phase: 0 };
  }
  const m = u.motion, dist = Math.hypot(p.mx, p.mz) / WORLD_PER_PX;
  const aim = dist > 0 ? Math.atan2(p.mz, p.mx)
    : p.hit && (u.x !== p.hit.x || u.z !== p.hit.z) ? Math.atan2(p.hit.z - u.z, p.hit.x - u.x) : m.heading;
  m.heading = turnToward(m.heading, aim, k.turn);
  u.dx = Math.cos(m.heading); u.dz = Math.sin(m.heading);

  if (dist === 0) {
    // A walk script stops; inertial profiles coast along their old velocity while their nose can turn.
    m.speed = k.stride ? 0 : Math.max(0, m.speed - k.accel);
    if (k.stride) m.phase = 0;
  } else if (dist <= .75) {
    m.speed = 0; m.phase = 0;
    return [p.mx, p.mz];
  } else if (k.stride) {
    m.direction = m.heading;
    if (Math.abs(angleDiff(aim, m.heading)) >= Math.PI / 4) m.speed = 0;
    else {
      m.speed = k.stride[m.phase];
      m.phase = (m.phase + 1) % k.stride.length;
    }
  } else {
    // Near tight turns or the destination, begin braking just as in the accepted open-space lab.
    m.direction = turnToward(m.direction, aim, k.turn * .5);
    const error = Math.abs(angleDiff(aim, m.direction));
    const closeTurn = dist < 32 && error > .16 && error / (k.turn * .5) * m.speed * 1.5 > dist;
    const brake = dist <= brakingDistance(k, m.speed) || closeTurn;
    m.speed = clamp(m.speed + (brake ? -k.accel : k.accel), 0, k.max);
  }

  if (dist > 0 && m.speed >= dist && Math.abs(angleDiff(aim, m.direction)) < .18) {
    m.speed = 0; m.phase = 0;
    return [p.mx, p.mz];
  }
  const stride = m.speed * WORLD_PER_PX;
  return [Math.cos(m.direction) * stride, Math.sin(m.direction) * stride];
}
