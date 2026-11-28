// v19 only: target-relative Halo Rockets and the Warbringer's private magazine.
// Evidence and intentional differences from the trigger map: ../research/BC-V6-4-WEAPONS.md.
import { WORLD_PER_PX as PX } from './motion.mjs';
import { pointWeaponGapPx } from './combat-reach.mjs';

export const WARBRINGER_CAPACITY = 10;
export const SCARAB_BUILD = 105; // preview: single-file refill slower than a 60-frame attack
export const HALO_OFFSETS = Object.freeze([
  [-1,-1],[-51,-31],[-7,-12],[36,52],[49,-25],[-40,46],[4,19],[-28,-50],
  [-50,15],[54,13],[-11,53],[-15,9],[19,-50],[17,-8],
].map(pair=>Object.freeze(pair)));
export const HALO_RELEASE_FRAMES = Object.freeze([0,0,10,10,20,20,30,30]);

export function refillScarab(u, frame) {
  u.scarabs ??= WARBRINGER_CAPACITY;
  if (u.scarabs >= WARBRINGER_CAPACITY) { u.scarabDue = null; return; }
  u.scarabDue ??= frame + SCARAB_BUILD;
  if (frame < u.scarabDue) return;
  u.scarabs++;
  u.scarabDue = u.scarabs < WARBRINGER_CAPACITY ? frame+SCARAB_BUILD : null;
}
export function launchScarab(u,frame) {
  if (!u.scarabs) return false;
  u.scarabs--;
  u.scarabDue ??= frame+SCARAB_BUILD;
  return true;
}

export function advanceScarab(s,target,box,frame,clampWalk) {
  if (s.detonate!==undefined) return frame>=s.detonate ? 'explode' : 'fly';
  if (frame>=s.expires || !target) return 'fizzle';
  if (box && pointWeaponGapPx(box,s.x,s.z)<=10) {
    s.detonate=frame+5; // separate contact and blast clocks; grounded effect stays put
    return 'fly';
  }
  const n=Math.hypot(target.x-s.x,target.z-s.z);
  const radius=target.radius??0;
  if(n<=radius+10*PX){s.detonate=frame+5;return 'fly';}
  const step=Math.min(16*PX,n-radius);
  s.tx=target.x;s.tz=target.z;
  const x=s.x+(s.tx-s.x)/n*step,z=s.z+(s.tz-s.z)/n*step;
  [s.x,s.z]=clampWalk(x,z);
  return 'fly';
}

export function advanceHalo(s,target,frame) {
  if (frame<s.releaseFrame) return false;
  if (target) {
    const [ox,oz]=HALO_OFFSETS[s.offset];
    s.tx=target.x+ox*PX;s.tz=target.z+oz*PX;
  }
  s.visible=true;
  const dx=s.tx-s.x,dz=s.tz-s.z,n=Math.hypot(dx,dz),aim=Math.atan2(dz,dx);
  const err=Math.atan2(Math.sin(aim-s.heading),Math.cos(aim-s.heading)), turn=13*Math.PI/128;
  s.heading+=Math.max(-turn,Math.min(turn,err));
  // Slow at the destination when the turn is still tight: a rocket released
  // crosswise at point-blank range must not orbit its landing point.
  const speedLimit=Math.abs(err)>turn ? Math.max(267,n*256/PX*turn*.55) : 8533;
  s.speed=Math.min(8533,s.speed+267,speedLimit);
  const step=s.speed*PX/256;
  if (n<=step || frame>=s.expires) {
    if(n<=step){s.x=s.tx;s.z=s.tz;}
    return true;
  }
  s.x+=Math.cos(s.heading)*step;s.z+=Math.sin(s.heading)*step;
  return false;
}

export const ringDamageDivisor = (gap,rings) => {
  const r=rings.findIndex(n=>gap<=n);
  return r<0 ? 0 : 2**r;
};

// OpenBW chooses the primary if it is <=5 px away; otherwise choose one
// eligible flyer at the impact. The web-seeded selection is replay stable.
export function haloHits(shot,eligible,seed) {
  const primary=eligible.find(o=>o.unit.id===shot.target&&o.gap<=5) ??
    eligible[((Math.imul(shot.id,16807)^Math.imul(seed,48271))>>>0)%eligible.length];
  return [
    ...(primary?[{unit:primary.unit,divisor:1}]:[]),
    ...eligible.filter(o=>o.unit.id!==shot.target).map(o=>({unit:o.unit,divisor:o.gap<=50?2:4})),
  ];
}
