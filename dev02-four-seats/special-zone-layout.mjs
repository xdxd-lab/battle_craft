// Visual-only candidate, never consumed by sim, commander input or purchase code.
import { ccw, corePos, SEATS, FOV, frameOf, shopCorners } from '../dev05-layout/layout.mjs';

export const SPECIAL_ZONE = Object.freeze({
  width: 5.6, depth: 6.25,
  platformGap: .23, outward: 2.2,
  deck: .21,
  beaconRadius: .71,
  signY: 1.02, signR: -2.22, signW: 6.2, signH: 2.04,
});
export const SPECIAL_BEACONS = Object.freeze([
  Object.freeze({ id: 'clear', label: '全場清除', number: '1', color: '#e8bd82', tint: 0xb99564, x: -1.42, z: .70 }),
  Object.freeze({ id: 'control', label: '控制單位', number: '2', color: '#b8c9e7', tint: 0x879abe, x: 1.42, z: .70 }),
]);

export function specialZoneFor(id, dim) {
  const seat = SEATS.find(s => s.id === id);
  if (!seat) return null;
  const core = corePos(id, dim), radial = seat.dir, [tx,tz] = ccw(radial);
  const clockwise = [-tx || 0,-tz || 0];
  const across = dim.corePlatformRadius + SPECIAL_ZONE.platformGap + SPECIAL_ZONE.width / 2;
  const [dx,dz] = radial, [cx,cz] = clockwise;
  const center = [core[0] + dx * SPECIAL_ZONE.outward + cx * across, core[1] + dz * SPECIAL_ZONE.outward + cz * across];
  // Local +x = clockwise; local +z = toward centre. Same yaw convention as the main scene.
  const world = (x,z) => [center[0] + cx*x - dx*z, center[1] + cz*x - dz*z];
  const ringPositions = SPECIAL_BEACONS.map(({x,z}) => world(x,z));
  const corners = [-1,1].flatMap(a => [-1,1].map(b => world(a*SPECIAL_ZONE.width/2,b*SPECIAL_ZONE.depth/2)));
  const [sx,sz] = world(0,SPECIAL_ZONE.signR);
  return { id, yaw: SEATS.indexOf(seat)*Math.PI/2, center, radial, clockwise, world, corners,
    ringPositions, sign: [sx,SPECIAL_ZONE.signY,sz] };
}
export const specialZoneBounds = (dim, id) => SEATS.filter(s => !id || s.id === id).flatMap(s => {
  const zone = specialZoneFor(s.id,dim);
  return [...zone.corners.map(([x,z]) => [x,SPECIAL_ZONE.deck,z]),zone.sign];
});

const dot = (a,b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
export function fitSpecialZoneCamera(base, angles, aspect, dim, { seat = null, overview = false } = {}) {
  if (!overview && !seat) return base;
  const { forward, up, right } = base, tan = Math.tan(FOV*Math.PI/360)*.97;
  const local = !overview && seat ? seat : null;
  // Preserve the original set of points (or the local shop), the angle, and when
  // possible the scale. Pan only as much as required by the added geometry.
  const pts = local ? [[0,0,0],...shopCorners(local,dim).flatMap(([x,z]) => [[x,0,z],[x,4.8,z]])]
    : frameOf(angles,dim);
  for (const s of SEATS) {
    if (local && s.id!==local) continue;
    const { corners, sign } = specialZoneFor(s.id,dim);
    pts.push(...corners.map(([x,z])=>[x,SPECIAL_ZONE.deck,z]));
    for (const a of [-1,1]) for (const b of [-1,1])
      pts.push(sign.map((v,j)=>v + a*right[j]*SPECIAL_ZONE.signW/2 + b*up[j]*SPECIAL_ZONE.signH/2));
  }
  function constraints(axis, extent) {
    let lo=-Infinity, hi=Infinity;
    for (const p of pts) {
      const q=dot(p,axis), d=extent*dot(p,forward);
      lo=Math.max(lo,q-d); hi=Math.min(hi,q+d);
    }
    return { lo, hi, extent, need:(lo-hi)/(2*extent), prev:dot(base.position,axis) };
  }
  const h=constraints(right,tan*aspect), v=constraints(up,tan);
  const distance=Math.max(base.distance,h.need,v.need);
  const shift=({lo,hi,extent,prev})=>Math.max(lo-extent*distance,Math.min(hi+extent*distance,prev));
  const pan=shift(h), lift=shift(v);
  const position=forward.map((f,j)=>right[j]*pan+up[j]*lift-f*distance);
  return { ...base, distance, position };
}
