// Simulation 10 weapon delivery only. Raw flingy.dat positions use 1/256 px.
// Direct and homing effects outside this pass continue on their older models.
import { WORLD_PER_PX } from './motion.mjs';
const fixed = (muzzle, speed, accel) => ({ mode:'latched', muzzle, speed, accel, angle:Math.PI/8 });
const WRAITH_GROUND = fixed(45,17067,8533); // Burst Lasers, weapon 16 / flingy 149
const WRAITH_AIR = fixed(20,8533,667);      // Gemini Missiles, weapon 15 / flingy 144
const CRUISER = fixed(75,25600,8533);       // ATS/ATA, weapons 19/20 / flingy 148
const HYDRA = { mode:'atTarget', angle:Math.PI/8 };         // Needle Spines, weapon 38: no traveling damage projectile

export function deliveryFor(version,kind,air) {
  if(version<10) return null;
  if(kind==='hydralisk'||kind==='marine') return HYDRA;
  if(kind==='dragoon') return DRAGOON;
  if(kind==='mutalisk') return GLAIVE;
  if(kind==='scout') return air ? SCOUT_AIR : SCOUT_GROUND;
  if(kind==='archon') return ARCHON;
  if(kind==='scourge') return SCOURGE;
  if(kind==='wraith') return air ? WRAITH_AIR : WRAITH_GROUND;
  if(kind==='battlecruiser') return CRUISER;
  return null;
}
export function placeFixedShot(shot,profile,fromX,fromZ,targetX,targetZ,coreRadius,air) {
  const dx=targetX-fromX,dz=targetZ-fromZ,center=Math.hypot(dx,dz);
  const nx=center?dx/center:0,nz=center?dz/center:0;
  const end=Math.max(0,center-coreRadius);
  const start=Math.min(end,profile.muzzle*WORLD_PER_PX);
  Object.assign(shot,{
    fixedFlight:true, airTarget:air, flightSpeed:0, length:end-start, remaining:end-start,
    x:fromX+nx*start,z:fromZ+nz*start,tx:fromX+nx*end,tz:fromZ+nz*end,
  });
}
export function advanceFixedShot(shot,profile,frames) {
  if(!frames) return false;
  shot.flightSpeed=Math.min(profile.speed,shot.flightSpeed+profile.accel);
  const v=shot.flightSpeed*WORLD_PER_PX/256;
  if(shot.remaining<=v+1e-9){
    shot.x=shot.tx;shot.z=shot.tz;shot.remaining=0;return true;
  }
  const step=v/shot.remaining;
  shot.x+=(shot.tx-shot.x)*step;shot.z+=(shot.tz-shot.z)*step;shot.remaining-=v;
  return false;
}

// units.dat extents are separate from the damage-size label.
const EXTENTS = {
  marine:[8,9,8,10], dragoon:[15,15,16,16], mutalisk:[22,22,21,21],
  hydralisk:[10,10,10,12], archon:[16,16,15,15], wraith:[19,15,18,14],
  battlecruiser:[37,29,37,29], scout:[18,16,17,15], scourge:[12,12,11,11],
};
const box = (u,q=1) => {
  const [l,t,r,b]=EXTENTS[u.kind], k=q*WORLD_PER_PX;
  return [u.x-l*k,u.z-t*k,u.x+r*k,u.z+b*k];
};
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
export function unitGap(a,b) {
  const [l,t,r,d]=box(a),[bl,bt,br,bd]=box(b);
  return Math.hypot(Math.max(0,l-br,bl-r),Math.max(0,t-bd,bt-d));
}
export function hitboxDistance(u,x,z) {
  const [l,t,r,b]=box(u);
  return Math.hypot(x-clamp(x,l,r),z-clamp(z,t,b));
}
export function targetPoint(shooter,target) {
  const [l,t,r,b]=box(target,.5);
  return [clamp(shooter.x,l,r),clamp(shooter.z,t,b)];
}
export const SCOURGE_CONTACT = 3*WORLD_PER_PX;
const ARCHON_RINGS = [3,15,30].map(px=>px*WORLD_PER_PX);
export const shockwaveRing = (u,x,z) => ARCHON_RINGS.findIndex(r=>hitboxDistance(u,x,z)<=r+1e-9);

const seeking = (mode, muzzle,speed,accel,turn, lifetime,offset=0) => ({mode,muzzle,speed,accel,turn:turn*Math.PI/128,lifetime,offset,angle: mode==='bounce'?Math.PI/8:offset?Math.PI/4:Math.PI});
const DRAGOON = seeking('home',0,17067,850,127,255);
const GLAIVE = seeking('bounce',5,8533,667,127,Infinity);
const SCOUT_AIR = seeking('home',5,8533,267,13,30,Math.PI/2);
const ARCHON = {mode:'effect',delay:3,angle:Math.PI/8};
const SCOURGE = {mode:'suicide',delay:5,angle:Math.PI};
const SCOUT_GROUND = {mode:'atTarget',angle:Math.PI/8};

export function placeSeekingShot(shot,profile,u,x,z,coreRadius,side=0){
  const aim=Math.atan2(z-u.z,x-u.x);
  const ox=Math.cos(aim)*profile.muzzle*WORLD_PER_PX, oz=Math.sin(aim)*profile.muzzle*WORLD_PER_PX;
  const d=Math.hypot(x-u.x,z-u.z), r=Math.min(d,coreRadius);
  Object.assign(shot,{ seekingFlight:profile.mode, flightSpeed:0, turns:aim+side*profile.offset, age:0, x:u.x+ox,z:u.z+oz,tx:x-Math.cos(aim)*r,tz:z-Math.sin(aim)*r });
}
export function advanceSeekingShot(shot,profile,frames){
  if(!frames)return false;
  shot.age++;
  const dx=shot.tx-shot.x,dz=shot.tz-shot.z,n=Math.hypot(dx,dz);
  const aimed=Math.atan2(dz,dx);
  const error=Math.atan2(Math.sin(aimed-shot.turns),Math.cos(aimed-shot.turns));
  shot.turns+=clamp(error,-profile.turn,profile.turn);
  shot.flightSpeed=Math.min(profile.speed,shot.flightSpeed+profile.accel);
  const d=shot.flightSpeed*WORLD_PER_PX/256;
  if(n<1e-8||(n<=d&&Math.abs(error)<=profile.turn+.01)) {shot.x=shot.tx;shot.z=shot.tz;return true;}
  if(shot.age>profile.lifetime) return true; // leave visual at its achieved location
  shot.x+=Math.cos(shot.turns)*d;shot.z+=Math.sin(shot.turns)*d;
  return false;
}
export function firstBounceTarget(units,shot,eligible){
  const r=96*WORLD_PER_PX, left=shot.x-r,right=shot.x+r;
  let first=null,least=Infinity;
  for(const u of units){
    if(!eligible(u)) continue;
    const [l,t,rEdge,b]=box(u);
    const entry=l>=left&&l<right ? l : rEdge>=left&&rEdge<right ? rEdge : Infinity;
    if(!Number.isFinite(entry)||t>=shot.z+r||b<shot.z-r) continue;
    if(entry<least||(entry===least&&u.id<first.id)) {least=entry;first=u;}
  }
  return first;
}
