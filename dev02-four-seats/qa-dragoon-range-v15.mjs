import assert from 'node:assert/strict';
import * as S from './sim.mjs';
import { unitGap } from './weapon-delivery.mjs';
import { KINDS, framesAt, unitStats } from './roster.mjs';
import { movementExtents } from './ground-occupancy.mjs';
import { TOWER } from './defense-tower.mjs';

const v=S.DRAGOON_RANGE_TRIAL_FROM, range=S.DRAGOON_TRIAL_RANGE, dim=S.dimFor(v);
const width = movementExtents('dragoon',dim).filter((_,i)=>i%2===0).reduce((a,b)=>a+b,0);
const close=(actual,want)=>assert(Math.abs(actual-want)<1e-8,`${actual} ≠ ${want}`);
close(width,1.068); close(range,3*width); assert.equal(v,15);
assert.equal(S.dimFor(v),S.dimFor(14));
for(const air of [false,true]){
  assert.equal(S.effectiveWeaponRange(13,'dragoon',air),1.62);
  assert.equal(S.effectiveWeaponRange(14,'dragoon',air),1.62);
  assert.equal(S.effectiveWeaponRange(v,'dragoon',air),3.204);
  assert.equal(S.effectiveWeaponRange(v,'battlecruiser',air),2.43);
}
const add = (s,seat,kind,x,z,cd=100000,target=null) => {
  const u={id:++s.serial,seat,team:s.seats[seat].team,x,z,cd,target,lat:0,foe:0,dx:0,dz:1,...unitStats(kind)};
  s.units.push(u); return u;
};
const pinGap=(a,b,gap)=>{
  const span=10-unitGap(a,{...b,x:a.x,z:a.z+10});
  b.x=a.x; b.z=a.z+span+gap;
};
const launchesBy = (events,u) => events.filter(e=>e.type==='launch'&&e.from===u.id);

for(const kind of ['hydralisk','battlecruiser']){
  const measure=(version,gap,adjacent=false)=>{
    const s=S.createSim({version,bots:[]}), a=add(s,'N','dragoon',0,0,0), t=add(s,'S',kind,0,0);
    if(adjacent)add(s,'W','dragoon',0,1.075);
    let first=null, hit=null;
    for(let i=0;i<35&&!hit;i++){
      if(!adjacent){a.x=0;a.z=0;}
      pinGap(a,t,gap); close(unitGap(a,t),gap);
      const events=S.step(s);
      const shot=launchesBy(events,a)[0];
      if(shot){
        first??=shot;
        assert(s.shots.find(q=>q.id===shot.shot)?.target===t.id);
        if(adjacent){assert.equal(a.x,0); assert.equal(a.z,0);}
      }
      hit=events.find(e=>e.type==='impact'&&e.shot===first?.shot);
    }
    return {first,hit};
  };
  assert.equal(measure(14,width*2.5,true).first,null);
  const across=measure(v,width*2.5,true);
  assert(across.first&&across.hit&&across.hit.tick>across.first.tick,'2.5 movement widths with adjacent friend: hold, release, then orb damage');
  const at=measure(v,range);
  assert(at.first&&at.hit,'edge inclusively admits its exact trial threshold');
  assert.equal(measure(v,range+1e-5).first,null,'never fire beyond trial edge even during windup grace');
}

{
  const s=S.createSim({version:v,bots:[]}); const a=add(s,'N','dragoon',0,0,0), b=add(s,'S','battlecruiser',0,0);
  pinGap(a,b,range-.03);
  for(let i=0;i<5&&!a.fight?.target;i++)S.step(s);
  assert.equal(a.fight.target,b.id);
  const due=a.fight.due, frame=framesAt(s.tick);
  while(framesAt(s.tick)<frame+3){pinGap(a,b,range+.08);assert.equal(launchesBy(S.step(s),a).length,0);}
  assert.equal(a.z,0); assert.equal(a.fight.target,b.id); assert.equal(a.fight.due,due+3);
}

for(const structure of ['core','tower']){
  const aim=(version)=>{
    const s=S.createSim({version,bots:[]}), isTower=structure==='tower';
    const z=dim.coreDistance-(isTower?6:0), radius=isTower?TOWER.hitRadius:S.RULES.coreRadius;
    if(isTower)s.seats.S.tower={x:0,z,hp:TOWER.hp,next:1000};
    const a=add(s,'N','dragoon',0,z-radius-2.67,0,'S');
    for(let i=0;i<15;i++){
      a.x=0;a.z=z-radius-2.67;
      const shot=launchesBy(S.step(s),a)[0];
      if(shot)return s.shots.find(q=>q.id===shot.shot);
    }
    return null;
  };
  assert.equal(aim(14),null);
  const shot=aim(v);
  assert(shot&&shot.core==='S'&&Boolean(shot.tower)===(structure==='tower'),'structure radius convention is unchanged and receives trial reach');
}

{
  const run=(version)=>{
    const s=S.createSim({version,bots:[]}); add(s,'N','battlecruiser',0,0,0); add(s,'S','marine',0,2.25);
    const events=[];
    for(let i=0;i<120;i++)events.push(...S.step(s));
    assert(events.some(e=>e.type==='launch'&&e.kind==='battlecruiser'));
    assert(events.some(e=>e.type==='impact'&&e.kind==='battlecruiser'));
    const {version:_,...state}=s;
    return {state,events};
  };
  assert.deepEqual(run(v),run(14),'BC timing, tracking, range and damage remain byte-for-byte identical without Dragoons');
}

{
  const run=(version)=>{
    const commands=Object.entries({N:1,W:1,S:6,E:6}).map(([seat,pad])=>{
      const [x,z]=S.padWorld(seat,pad,dim); return {tick:1,seat,type:'goal',x,z};
    });
    const s=S.createSim({version,seed:20261128,bots:[]});
    const count={dragoon:{launches:0,impacts:0},battlecruiser:{launches:0,impacts:0}};
    for(let i=0;i<1250;i++)for(const e of S.step(s,i===0?commands:[])){
      const c=count[e.kind];if(!c)continue;
      if(e.type==='launch'){c.launches++;c.first??=e.tick;}
      if(e.type==='impact'){c.impacts++;c.firstHit??=e.tick;}
    }
    return count;
  };
  const old=run(14), trial=run(v);
  assert(trial.dragoon.first<old.dragoon.first&&trial.dragoon.impacts>old.dragoon.impacts);
  assert(trial.battlecruiser.impacts>0);
  console.log('Stock four-seat 2v2 at t1250:', { old,trial });
}
console.log('Dragoon trial v15: 3× movement width; tested both layers, strict boundary, hold, structures, existing BC combat and stock waves.');
