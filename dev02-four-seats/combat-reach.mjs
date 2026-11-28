// Combat geometry only. These rectangles never depend on a mesh, camera,
// damage class, flying height, heading or the enlarged ground movement footprint.
import { WORLD_PER_PX } from './motion.mjs';
import { KINDS, canTarget, weaponOf } from './roster.mjs';
export const UNIFIED_ATTACK_RANGE_FROM = 17;
export const DRAGOON_RANGE_TRIAL_FROM = 15;
export const DRAGOON_TRIAL_RANGE = 3.204;
export const SCOURGE_CONTACT_PX = 3;
export const effectiveWeaponRange = (version, kind, air = false) =>
  version >= UNIFIED_ATTACK_RANGE_FROM && kind === 'scourge' ? (air ? SCOURGE_CONTACT_PX * WORLD_PER_PX : 0) :
  version >= DRAGOON_RANGE_TRIAL_FROM && kind === 'dragoon' ? DRAGOON_TRIAL_RANGE : weaponOf(kind, air).range;

// Source units.dat left/up/right/down, in source pixels around the sprite anchor.
// See research/BC-V6-WEAPON-BOXES-17.md for file hash, tested unit IDs and OpenBW lines.
export const DAT_EXTENTS = Object.freeze(Object.fromEntries(Object.entries({
  marine:[8,9,8,10], dragoon:[15,15,16,16], mutalisk:[22,22,21,21],
  hydralisk:[10,10,10,12], archon:[16,16,15,15], wraith:[19,15,18,14],
  battlecruiser:[37,29,37,29], scout:[18,16,17,15], scourge:[12,12,11,11],
  guardian:[22,22,21,21], valkyrie:[24,16,24,20], warbringer:[16,16,15,15],
}).map(([kind, d]) => [kind, Object.freeze(d)])));

// Map our continuous coordinates onto an integer sprite position, as after a
// fixed-point move in BW. The tiny tolerance only cancels conversion roundoff
// when generating an exact source pixel from a JS float, including below zero.
const pixel = world => Math.floor(world / WORLD_PER_PX + 1e-10);
export function weaponBoxPx(kind, x, z) { return weaponBoxFromExtents(DAT_EXTENTS[kind],x,z); }
export function weaponBoxFromExtents([l,t,r,b], x, z) {
  const px = pixel(x), pz = pixel(z);
  // OpenBW unit_sprite_bounding_box uses the OUTER box: +1 at right/bottom.
  return {l:px-l, t:pz-t, r:px+r+1, b:pz+b+1};
}
// OpenBW xy_length(int,int). Perform EACH division as nonnegative integer
// division, not one final rounding of a Euclidean or floating approximation.
export function bwLengthPx(dx, dz) {
  const hi = Math.max(dx,dz), lo = Math.min(dx,dz);
  return Math.floor(hi / 4) < lo
    ? hi - Math.floor(hi/16) + Math.floor(3*lo/8) - Math.floor(hi/64) + Math.floor(3*lo/256)
    : hi;
}
export function weaponGapPx(a,b) {
  return bwLengthPx(Math.max(0, a.l-b.r, b.l-a.r), Math.max(0, a.t-b.b, b.t-a.b));
}
export function pointWeaponGapPx(box,x,z) {
  const px=pixel(x), pz=pixel(z);
  return bwLengthPx(Math.max(0, box.l-px, px-box.r), Math.max(0, box.t-pz, pz-box.b));
}
export const rangeInPixels = range => Math.floor(range / WORLD_PER_PX + 1e-10);
export const worldGap = (a,b) => weaponGapPx(weaponBoxPx(a.kind,a.x,a.z), weaponBoxPx(b.kind,b.x,b.z))*WORLD_PER_PX;

const mobileThresholds = Object.fromEntries(Object.keys(KINDS).map(kind => [kind,
  [false,true].map(air => rangeInPixels(effectiveWeaponRange(UNIFIED_ATTACK_RANGE_FROM,kind,air)))]));
export const reachPx = (kind, air) => mobileThresholds[kind][+air];
export function scanWeaponTargets(u, units, boxes, aggroPx, locked) {
  const spec=KINDS[u.kind], here=boxes.get(u.id);
  // Hold a reachable wind-up. For a new target choose nearest reachable box
  // first (then nearest pursuable box); IDs make equal geometry deterministic.
  // This is the Web targeting policy, not BW's entire order/priority system.
  let active=null, nearest=null, bestGap=Infinity, nearestGap=Infinity;
  for (const o of units) {
    const air=KINDS[o.kind].air;
    if (o.hp<=0 || o.team===u.team || !canTarget(spec,air)) continue;
    const gap=weaponGapPx(here,boxes.get(o.id));
    if (gap>aggroPx) continue;
    if (gap<=reachPx(u.kind,air)) {
      if (o===locked) return {foe:o, inReach:true};
      if (gap<bestGap || (gap===bestGap && o.id<active.id)) {active=o;bestGap=gap;}
    } else if (gap<nearestGap || (gap===nearestGap && o.id<nearest.id)) {nearest=o;nearestGap=gap;}
  }
  return {foe:active??nearest, inReach:active!==null};
}
