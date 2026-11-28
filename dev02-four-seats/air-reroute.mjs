// v18 fallback orders. Source map uses AttackMove to the surviving adjacent
// core; the Web ground route stays road-bound, while air can cross empty space.
import { opposite } from '../dev05-layout/layout.mjs';
import { KINDS, canTarget } from './roster.mjs';

export const AIR_REROUTE_FROM = 18;

export function hasAirShortcut(state,u) {
  if (state.version < AIR_REROUTE_FROM || !KINDS[u.kind].air || !u.target) return false;
  const target=state.seats[u.target], initial=opposite(u.seat).id;
  // Derive from already-recorded seat status rather than adding replay state.
  // This also works for fresh recruits after a fall and for controlled units.
  return !state.seats[initial].alive && target?.alive && target.team!==u.team;
}

export function approachAirCore(p,u,cx,cz,platformRadius,coreRadius,range) {
  const canFire=canTarget(KINDS[u.kind],false), outer=coreRadius+range;
  const dx=cx-u.x,dz=cz-u.z,distance=Math.hypot(dx,dz);
  if (canFire && distance<=outer) {
    p.core=u.target;
    p.airStructureRange={x:cx,z:cz,radius:outer};
    return;
  }
  // Inset by a small fraction of weapon reach so the braking destination is
  // inside legal range, not at center. An air-only Scourge instead waits near
  // the platform rim; it never fires at or flies into a core to suicide.
  const standOff=canFire ? outer-Math.min(.18,range*.25) : platformRadius;
  if (distance <= standOff) return;
  const advance = (distance-standOff)/distance;
  p.mx=dx*advance; p.mz=dz*advance;
}
