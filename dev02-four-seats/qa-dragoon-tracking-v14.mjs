import assert from 'node:assert/strict';
import * as S from './sim.mjs';
import { unitGap } from './weapon-delivery.mjs';
import { KINDS, framesAt, unitStats } from './roster.mjs';

const range = KINDS.dragoon.range;
const add = (s,seat,kind,x,z,cd=100000) => {
  const u={id:++s.serial,seat,team:s.seats[seat].team,x,z,cd,target:null,lat:0,foe:0,dx:0,dz:1,...unitStats(kind)};
  s.units.push(u); return u;
};

// Two allied seats form an actual-width firing line, and both opposing seats
// supply cruisers. Isolate small edge motion so it is the same in both releases.
function boundary(version) {
  const s=S.createSim({version,bots:[]}), a=add(s,'N','dragoon',0,0,0);
  const ships=[add(s,'S','battlecruiser',0,0),add(s,'E','battlecruiser',.36,0)];
  for(let i=-3;i<=3;i++)add(s,i%2?'N':'W','dragoon',i*1.075,1.075);
  let moved=0, seen=0;
  const launches=[], impacts=[];
  for(let tick=1;tick<=100;tick++){
    const f=framesAt(tick), sway=.03*Math.sin((f+.5)*Math.PI*2/7);
    ships.forEach((u,i)=>{ u.z=2.184+i*.18+sway; });
    const gaps=new Map(ships.map(ship=>[ship.id,unitGap(a,ship)]));
    if([...gaps.values()].some(g=>g<=range))seen++;
    for(const e of S.step(s)){
      if(e.type==='launch'&&e.from===a.id){
        const shot=s.shots.find(q=>q.id===e.shot);
        assert(shot && gaps.get(shot.target)<=range+1e-9,'do not fire outside the physical DAT weapon envelope');
        launches.push(e.tick);
      }
      if(e.type==='impact'&&e.kind==='dragoon'){assert.equal(e.body,17);impacts.push(e.tick);}
    }
    moved=Math.max(moved,Math.hypot(a.x,a.z));
  }
  return { launches,impacts,moved,seen,hash:S.digest(s) };
}
{
  const old=boundary(13), fixed=boundary(14);
  assert(old.seen>=7&&old.moved>2,'control repeatedly enters range, then walks off without firing');
  assert.deepEqual(old.launches,[]); assert.deepEqual(old.impacts,[]);
  assert(fixed.moved<.2,'remain behind the frontline instead of flipping sides');
  assert.equal(fixed.launches[0],22); assert.equal(fixed.impacts.length,2);
  assert(fixed.impacts.every((tick,i)=>tick>fixed.launches[i]),'the orb still flies');
  assert.deepEqual(boundary(14),fixed);
  console.log('edge control',old,'; v14',fixed);
}

{
  const s=S.createSim({version:14,bots:[]}), a=add(s,'N','dragoon',0,0,0), b=add(s,'S','battlecruiser',0,1.84);
  for(let i=0;i<4&&!a.fight?.target;i++)S.step(s);
  const baseFrame=framesAt(s.tick), due=a.fight.due;
  assert.equal(a.fight.target,b.id);
  b.z=2.25; // outside true range but inside the short hold envelope
  assert(unitGap(a,b)>range);
  while(framesAt(s.tick)<baseFrame+3){
    assert(!S.step(s).some(e=>e.type==='launch'&&e.from===a.id));
    assert.equal(a.z,0);
    assert.equal(a.fight.target,b.id);
  }
  assert.equal(a.fight.due,due+3,'only ready frames count towards the original wind-up');
  for(let i=0;i<15;i++)S.step(s);
  assert(a.z>0,'genuine retreat eventually resumes approach; the pause cannot pin the rear row forever');
}

{
  // Full normal-economy purchase wave, with the real four commander goal inputs,
  // arena collisions, weapon phases, and BC bank/batch timing. No hand spawning.
  const version=14, dim=S.dimFor(version);
  const commands=Object.entries({N:1,W:1,S:6,E:6}).map(([seat,pad])=>{
    const [x,z]=S.padWorld(seat,pad,dim); return {tick:1,seat,type:'goal',x,z};
  });
  const s=S.createSim({version,seed:20261128,bots:[]});
  const buyKinds={dragoon:0,battlecruiser:0}, dr={N:{landed:0},W:{landed:0}};
  for(let i=0;i<1250;i++){
    const before=new Map(s.units.map(u=>[u.id,{...u}]));
    for(const e of S.step(s,i===0?commands:[])){
      if(e.type==='buy'&&Object.hasOwn(buyKinds,e.kind))buyKinds[e.kind]+=e.count;
      if(e.kind==='dragoon'&&e.type==='launch'&&dr[e.seat]){
        const from=before.get(e.from), target=s.shots.find(q=>q.id===e.shot)?.target;
        assert(from);
        if(target&&before.has(target))assert(unitGap(from,before.get(target))<=range+1e-9);
        if(Math.hypot(from.x,from.z)<9)dr[e.seat].first??=e.tick;
      }
      if(e.kind==='dragoon'&&e.type==='impact'&&dr[e.seat]&&dr[e.seat].first&&e.tick>dr[e.seat].first)dr[e.seat].landed++;
    }
  }
  assert(buyKinds.dragoon>=20&&buyKinds.battlecruiser>=18,'dense, real four-seat purchase waves');
  assert(dr.N.first<800&&dr.W.first<800&&dr.N.landed>=5&&dr.W.landed>=5,'both frontline squads actually fire and do damage');
  assert.equal(S.replay({version,seed:s.seed,bots:[],commands,ticks:s.tick}).final,S.digest(s));
  console.log('normal four-seat central clash',buyKinds,dr);
}
