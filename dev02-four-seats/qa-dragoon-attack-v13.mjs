// Regression: the movement footprint is intentionally not the weapon hitbox.
import assert from 'node:assert/strict';
import * as S from './sim.mjs';
import { stepRoster } from './combat.mjs';
import { KINDS, framesAt, unitStats } from './roster.mjs';
import { unitGap } from './weapon-delivery.mjs';

const RANGE = KINDS.dragoon.range, IDLE = 10000;
let integrated = false;
try { integrated = !!S.dimFor(13); } catch { /* Test the opt-in combat phase before v13 geometry is integrated. */ }
const dim = integrated ? S.dimFor(13) : { ...S.dimFor(12), dragoonClearanceScale: 1.2 };
if (integrated) assert.equal(dim.dragoonClearanceScale, 1.2, 'test the requested 120% movement reservation');
const make = version => Object.assign(S.createSim({ version: version===13&&!integrated?12:version, bots:[] }), { version });
const move = s => {
  if (s.version!==13 || integrated) return S.step(s);
  s.tick++;
  const events=[];
  stepRoster(s, (type,seat,e)=>events.push({ type,seat,tick:s.tick,...e }), dim,
    { RULES:S.RULES, waypoint:()=>[0,0], clampWalk:(x,z)=>[x,z] });
  return events;
};
function unit(s, seat, kind, x, z, extra={}) {
  const u={ id:++s.serial, seat, team:s.seats[seat].team, x,z,target:null,lat:0,foe:0,dx:0,dz:1,cd:IDLE,
    ...unitStats(kind), ...extra };
  s.units.push(u); return u;
}
const launched=(events,u)=>events.find(e=>e.type==='launch'&&e.from===u.id);
const fireAt=(s,e)=>s.shots.find(q=>q.id===e.shot)?.target;

function crowd(version) {
  const s=make(version), a=unit(s,'N','dragoon',0,0,{cd:0}), b=unit(s,'S','battlecruiser',0,1.84);
  // The depth and width are over v13's 1.068 movement footprint, i.e. begin without overlap.
  for(const x of [-3.36,-2.24,-1.12,0,1.12,2.24,3.36])unit(s,'N','dragoon',x,1.10);
  assert(1.84>RANGE && unitGap(a,b)<RANGE);
  const events=[], positions=[];
  for(let i=0;i<120;i++){events.push(...move(s));positions.push([a.x,a.z]);}
  return { s,a,b,events,positions };
}

{
  const old=crowd(12), current=crowd(13);
  assert.equal(old.b.hp,500);
  assert.equal(launched(old.events,old.a),undefined,'the reported v12 bug is reproducible');
  assert(old.positions.some(([x,z])=>Math.hypot(x,z)>.5));
  assert.equal(S.digest(old.s),'f52cc780','do not change v12 state or replay');
  assert(current.positions.every(([x,z])=>x===0&&z===0),'hold behind friendly units once the target is reachable');
  const shot=launched(current.events,current.a);
  assert(shot && shot.tick===11,'first projectile after seven source wind-up frames, not instant');
  const hit=current.events.find(e=>e.type==='impact'&&e.shot===shot.shot);
  assert(hit && hit.tick>shot.tick && hit.target===current.b.id && hit.body===17,'retain the seeking projectile travel and normal armor');
  assert.equal(current.b.hp,449);
  assert.deepEqual(crowd(13).events,current.events,'same repeated results');
}

{
  const s=make(13), a=unit(s,'N','dragoon',0,0,{cd:0,dx:1,dz:0});
  const close=unit(s,'S','scourge',0,2.01), large=unit(s,'S','battlecruiser',2.08,0);
  assert(unitGap(a,close)>RANGE&&unitGap(a,large)<RANGE,'the smaller target is closer by center but out of hitbox range');
  let shot;
  for(let i=0;i<18&&!shot;i++){shot=launched(move(s),a);assert.equal(a.foe,large.id);}
  assert(shot && fireAt(s,shot)===large.id,'prefer reachable target over closer center');
}

{
  const s=make(13), a=unit(s,'N','dragoon',0,0,{cd:0,dx:-1,dz:0,
    motion:{heading:Math.PI,direction:Math.PI,speed:6,phase:2}}), t=unit(s,'S','battlecruiser',1.9,0);
  let lock, shot; const startHeading=a.motion.heading;
  for(let i=0;i<20&&!shot;i++){
    const e=move(s);
    if(i<=2)assert(!e.some(e=>e.type==='launch'&&e.from===a.id),'bring a moving shooter to a standstill');
    if(a.fight?.target===t.id)lock??=a.fight.at;
    shot=launched(e,a);
  }
  assert(shot && framesAt(shot.tick)-lock===7);
  assert.equal(fireAt(s,shot),t.id);
  assert.equal(a.motion.speed,0);
  assert.notEqual(a.motion.heading,startHeading,'while parked the hull still turns');
  assert.equal(a.x,0); assert.equal(a.z,0);
}

{
  const s=make(13), a=unit(s,'N','dragoon',0,0,{cd:0}), first=unit(s,'S','battlecruiser',0,1.84);
  for(let i=0;i<5&&a.fight?.target!==first.id;i++)move(s);
  assert.equal(a.fight.target,first.id);
  const nearer=unit(s,'S','scourge',1.03,0);
  move(s); assert.equal(a.fight.target,first.id,'retain a live in-range wind-up despite a closer new threat');
  first.z=7; // now truly beyond the weapon envelope
  let shot;
  for(let i=0;i<15&&!shot;i++){shot=launched(move(s),a);assert.equal(a.foe,nearer.id);}
  assert(shot && fireAt(s,shot)===nearer.id,'restart against a reachable enemy after the lock leaves range');
}

{
  const s=make(13), a=unit(s,'N','dragoon',0,0,{cd:0}), t=unit(s,'S','battlecruiser',0,2.36);
  assert(unitGap(a,t)>RANGE);
  let shot;
  for(let i=0;i<30&&!shot;i++){
    const gap=unitGap(a,t);
    shot=launched(move(s),a);
    if(shot)assert(gap<=RANGE+1e-9,'never fire outside the original hitbox envelope');
  }
  assert(a.z>0&&shot,'still advance to engage when the only enemy really is outside range');
}

console.log('Dragoon v13: v12 crowd reproduced; edge range + target priority; stand, turn, wind-up and orb; valid locks retained.');
