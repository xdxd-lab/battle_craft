// Real simulation fixture against the live code path, including preserved older replays.
import assert from 'node:assert/strict';
import * as S from './sim.mjs';
import { KINDS, unitStats, framesAt } from './roster.mjs';
const make = (s, seat, kind, x, z, extra={}) => {
  const u={id:++s.serial,seat,team:s.seats[seat].team,kind,x,z,cd:0,target:null,foe:0,dx:seat==='N'?1:-1,dz:0,lat:0,...unitStats(kind),...extra};
  s.units.push(u);return u;
};
const waitFor = (s, f, cap=80) => {
  for(let i=0;i<cap;i++) { const e=S.step(s);if(f(e))return e; }
  assert.fail('event timeout');
};
for(const version of [9,10]) {
  for(const distance of [.75,1.57]){
    const s=S.createSim({version,bots:[]});
    const h=make(s,'N','hydralisk',0,0);
    const target=make(s,'S','battlecruiser',distance,0,{cd:1000});
    const e=waitFor(s,e=>e.some(x=>x.from===h.id && ['shot','launch'].includes(x.type))).find(e=>e.from===h.id&&['shot','launch'].includes(e.type));
    if(version===10){assert.equal(e.type,'shot');assert.equal(e.atTarget,true);assert.equal(target.hp,493);assert.equal(s.shots.length,0);}
    else {assert.equal(e.type,'launch');assert.equal(target.hp,500);assert.equal(s.shots.some(x=>x.kind==='hydralisk'),true);}
  }
}
for(const [kind,targetKind,distance,body,expectedGap] of [
  ['wraith','marine',1.60,8,1],
  ['wraith','battlecruiser',2.0,17,9],
  ['battlecruiser','marine',2.4,25,2],
  ['battlecruiser','wraith',2.4,25,2],
]){
 const s=S.createSim({version:10,bots:[]});
 const shooter=make(s,'N',kind,0,0);const target=make(s,'S',targetKind,distance,0,{cd:1000});const hp=target.hp;
 const e=waitFor(s,e=>e.some(x=>x.from===shooter.id&&x.type==='launch')).find(x=>x.from===shooter.id&&x.type==='launch');
 const shot=s.shots.find(x=>x.id===e.shot);assert(shot?.fixedFlight);
 assert.equal(target.hp,hp);
 const capturedZ=target.z; assert(Math.abs(shot.tz-capturedZ)<1e-8);
 // Move the original recipient laterally; velocity and graphic endpoint must not change.
 // An unrelated unit on the old endpoint is not the damage recipient.
 target.z=1.3;
 const bystander=make(s,'S','scout',distance,0,{cd:1000});
 const i=waitFor(s,e=>e.some(x=>x.shot===shot.id&&x.type==='impact')).find(x=>x.shot===shot.id&&x.type==='impact');
 assert.equal(i.target,target.id);assert.equal(i.body,body);assert(Math.abs(i.z-capturedZ)<1e-8);assert.equal(bystander.sh,100);
 assert.equal(framesAt(i.tick)-framesAt(e.tick),expectedGap,`${kind} → ${targetKind}`);
}
{
 const s=S.createSim({version:10,bots:[]});
 const a=make(s,'N','wraith',0,0); const b=make(s,'S','battlecruiser',1.9,0,{cd:1000});
 const launched=waitFor(s,e=>e.some(x=>x.from===a.id&&x.type==='launch')).find(x=>x.from===a.id&&x.type==='launch');
 b.hp=0;
 const end=waitFor(s,e=>e.some(x=>x.shot===launched.shot&&x.type==='fizzle'));
 assert(end.some(x=>x.target===b.id));
}
for(const kind of ['marine','scout']){
  const s=S.createSim({version:10,bots:[]}),u=make(s,'N',kind,0,0), t=make(s,'S','marine',1.2,0,{cd:1000});
  const events=waitFor(s,es=>es.some(e=>e.type==='shot'&&e.from===u.id));
  assert(events.some(e=>e.from===u.id&&e.atTarget));assert.equal(t.hp,40-KINDS[kind].damage);assert.equal(s.shots.length,0);
}
{
  const s=S.createSim({version:10,bots:[]}),u=make(s,'N','dragoon',0,0),t=make(s,'S','battlecruiser',1.4,0,{cd:1000});
  const fire=waitFor(s,es=>es.some(e=>e.type==='launch'&&e.from===u.id)).find(e=>e.type==='launch'&&e.from===u.id);
  assert(s.shots[0].seekingFlight==='home');
  t.z=.55;
  const hit=waitFor(s,es=>es.some(e=>e.type==='impact'&&e.shot===fire.shot)).find(e=>e.type==='impact'&&e.shot===fire.shot);
  assert.equal(hit.body,17);assert(hit.z>.5);assert(framesAt(hit.tick)>framesAt(fire.tick));
}
{
  const s=S.createSim({version:10,bots:[]}),u=make(s,'N','archon',0,0),t=make(s,'S','wraith',.63,0,{cd:1000});
  const guard=make(s,'N','mutalisk',.75,-.1,{cd:1000});
  const ally=make(s,'W','mutalisk',.75,.12,{cd:1000});
  const start=waitFor(s,es=>es.some(e=>e.type==='launch'&&e.from===u.id)).find(e=>e.type==='launch'&&e.from===u.id);
  assert.equal(t.hp,120);assert.equal(start.effect,'effect');
  const hit=waitFor(s,es=>es.some(e=>e.type==='impact'&&e.shot===start.shot)).find(e=>e.type==='impact'&&e.shot===start.shot);
  assert.equal(framesAt(hit.tick)-framesAt(start.tick),3);assert.equal(t.hp,90);
  assert(ally.hp<120);assert.equal(guard.hp,120);
}
{
  const s=S.createSim({version:10,bots:[]}),u=make(s,'N','scourge',0,0),t=make(s,'S','wraith',.32,0,{cd:1000});
  const ground=make(s,'S','marine',.09,.56,{cd:1000});
  const e=waitFor(s,es=>es.some(e=>e.type==='launch'&&e.from===u.id)).find(e=>e.type==='launch'&&e.from===u.id);
  assert.equal(e.effect,'suicide');assert.equal(t.hp,120);assert(!s.units.some(x=>x.id===u.id));
  const id=e.shot, hit=waitFor(s,es=>es.some(e=>e.type==='impact'&&e.shot===id)).find(e=>e.type==='impact'&&e.shot===id);
  assert.equal(framesAt(hit.tick)-framesAt(e.tick),5);assert.equal(t.hp,10);assert.equal(ground.hp,40);
}
{
  const s=S.createSim({version:10,bots:[]}),u=make(s,'N','mutalisk',0,0);
  make(s,'S','wraith',1,0,{cd:1000});make(s,'S','wraith',.85,.93,{cd:1000});make(s,'S','wraith',1.34,.13,{cd:1000});
  const e=waitFor(s,es=>es.some(e=>e.type==='launch'&&e.from===u.id)).find(e=>e.type==='launch'&&e.from===u.id);
  u.cd=1000;const impacts=[];
  for(let j=0;j<100&&impacts.length<3;j++)impacts.push(...S.step(s).filter(x=>x.type==='impact'&&x.shot===e.shot));
  assert.deepEqual(impacts.map(i=>[i.hop,i.body]),[[0,9],[1,3],[2,1]]);
  assert.deepEqual(impacts.map(i=>i.target),[2,3,4]); // farther left edge before nearer right edge
}
{
  const s=S.createSim({version:10,bots:[]}),u=make(s,'N','scout',0,0),t=make(s,'S','battlecruiser',1.59,0,{cd:1000});
  const e=waitFor(s,es=>es.some(x=>x.type==='launch'&&x.from===u.id)).filter(x=>x.type==='launch'&&x.from===u.id);
  assert.equal(e.length,2); assert.notEqual(e[0].shot,e[1].shot);
  u.cd=1000;const impacts=[];
  for(let j=0;j<55&&impacts.length<2;j++)impacts.push(...S.step(s).filter(x=>x.type==='impact'&&x.kind==='scout'));
  assert.deepEqual(impacts.map(i=>i.body),[11,11]);assert.equal(t.hp,478);
}
assert.equal(KINDS.wraith.name,'死靈式戰機');
assert.equal(S.padsFor(10).find(x=>x.kind==='wraith').label,'死靈式戰機');
assert.equal(S.padsFor(8).find(x=>x.kind==='wraith').label,'死靈戰機');
console.log('Hydralisk target-only impact; Wraith ground/air and BC latched flight, no incidental hits, dead-target fizzle and replay labels passed.');
