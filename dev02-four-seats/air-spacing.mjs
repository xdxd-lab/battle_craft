import { weaponBoxPx, weaponGapPx, rangeInPixels } from './combat-reach.mjs';
// Candidate v9: a bounded, gradual offset, never an occupancy constraint.
// Both allied seats may pass over one another; only soft attraction to space is
// considered. Enemies do not provide a push that could cancel a dive.
export const AIR_SPACING = { radius:.9, drift:.022, ease:.22, idle:1, transit:.57, attack:.06, recovery:.32 };
export function airPair(u,o,radius=AIR_SPACING.radius) {
  if (o.id===u.id||u.team!==o.team) return [0,0];
  const dx=u.x-o.x,dz=u.z-o.z,d=Math.hypot(dx,dz);
  if(d>=radius) return [0,0];
  if(d<1e-7){
    // Coincident allies receive opposite directions, without random/time input.
    const lo=Math.min(u.id,o.id),hi=Math.max(u.id,o.id),a=((Math.imul(lo,2246822519)^Math.imul(hi,3266489917))>>>0)/2**32*(2*Math.PI);
    const sign=u.id<o.id?1:-1;return [sign*Math.cos(a),sign*Math.sin(a)];
  }
  const q=(1-d/radius)**2/d; return [dx*q,dz*q];
}
export function airDisperse(u,p,frames,frame) {
  if(!frames) return [0,0];
  const s=u.airDrift??={x:0,z:0};
  const aim=p.hit || p.core;
  const firing=u.fight?.fired===frame || u.fight?.target!=null;
  const factor=firing?AIR_SPACING.attack:aim?AIR_SPACING.recovery:(p.mx||p.mz)?AIR_SPACING.transit:AIR_SPACING.idle;
  const strength=AIR_SPACING.drift*factor/Math.max(1,Math.hypot(p.sx,p.sz));
  s.x+=(p.sx*strength-s.x)*AIR_SPACING.ease;
  s.z+=(p.sz*strength-s.z)*AIR_SPACING.ease;
  let {x,z}=s;
  // Near an already-locked opposing unit, don't let dispersion alone steal the
  // attack position. It can still push tangentially and the foe can move away.
  if (p.weaponBoxRange) {
    // v17: a legal edge-to-edge attack position may already be outside the
    // old center-radius circle. Never snap the flyer toward the target.
    const limit = rangeInPixels(p.hitRange);
    const allowed = (dx,dz) => weaponGapPx(weaponBoxPx(u.kind,u.x+dx,u.z+dz),p.weaponBoxRange)<=limit;
    if (allowed(x,z)) return [x,z];
    if (x && allowed(x,0)) return [x,0];
    if (z && allowed(0,z)) return [0,z];
    return [0,0];
  }
  if(p.hit && p.hitRange!==undefined && Math.hypot(u.x-p.hit.x+x,u.z-p.hit.z+z)>p.hitRange){
    const ax=u.x-p.hit.x,az=u.z-p.hit.z,n=Math.hypot(ax,az);
    const outward=n>0?(x*ax+z*az)/n:0;
    if(outward>0){x-=outward*ax/n;z-=outward*az/n;}
    if(Math.hypot(ax+x,az+z)>p.hitRange){
      const k=p.hitRange/Math.hypot(ax+x,az+z);x=(ax+x)*k-ax;z=(az+z)*k-az;
    }
  }
  return [x,z];
}
export function clampAir(x,z,dim) {
  const edge=dim.coreDistance+dim.platformWalkRadius;
  return [Math.max(-edge,Math.min(edge,x)),Math.max(-edge,Math.min(edge,z))];
}
