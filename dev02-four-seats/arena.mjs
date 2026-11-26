// DEV02 對局的座標由場景、取景與固定步模擬共用。
import * as L from '../dev05-layout/layout.mjs';

const LANE_SCALE = 1.2;
const CAMERA_SCALE = 1.2;
const platformWalkRadius = 6.2;
// 有效臂長量到核心平台可行走的最外端，核心本身與平台半徑沿用原尺寸。
const coreDistance = (L.DIM.coreDistance + platformWalkRadius) * LANE_SCALE - platformWalkRadius;

export const ARENA = {
  ...L.DIM,
  coreDistance,
  platformWalkRadius,
  spawnRadial: L.DIM.spawnRadial + coreDistance - L.DIM.coreDistance,
  shopWidth: 9,
  shopDepth: 15,
  shopSupplyRadial: 6.35,
  shopLabel: { w: 9.6, h: 2.55, y: L.SHOP_LABEL.y, fontSize: 46 },
  shopTangent: 12,
  shopRadial: 28,
  shopPadPositions: [[2, 3.1], [-2, 3.1], [2, -3.1], [-2, -3.1]],
};
export const corePos = id => L.corePos(id, ARENA);

export function fitArenaCamera(angles, aspect) {
  const reference = L.fitAngles(angles, aspect);
  return L.fitAngles(angles, aspect, .98, ARENA, reference.distance / CAMERA_SCALE);
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function fitNearCamera(angles, aspect, seat) {
  const reference = L.fitAngles(angles, aspect);
  const { forward, up, right } = reference;
  const distance = reference.distance / CAMERA_SCALE;
  const tan = Math.tan(L.FOV * Math.PI / 360) * .96;
  const points = [[0, 0, 0]];
  if (seat) {
    for (const [x, z] of L.shopCorners(seat, ARENA)) points.push([x, 0, z], [x, 4.8, z]);
  }
  // Keep the camera direction and scale fixed. Pan only as far as the
  // player's platform needs to stay in the part of the view clear of HUD.
  function offset(axis, extent, target) {
    let lo = -Infinity, hi = Infinity;
    for (const p of points) {
      const at = dot(p, axis), radius = extent * (distance + dot(p, forward));
      lo = Math.max(lo, at - radius);
      hi = Math.min(hi, at + radius);
    }
    return lo <= hi ? Math.max(lo, Math.min(hi, target)) : null;
  }
  const pan = offset(right, tan * aspect, 0);
  const lift = offset(up, tan, dot(reference.position, up));
  if (pan === null || lift === null) return fitArenaCamera(angles, aspect);
  const position = forward.map((v, i) => right[i] * pan + up[i] * lift - v * distance);
  return { position, forward, up, right, distance };
}
