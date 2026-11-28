import assert from 'node:assert/strict';
import * as S from './sim.mjs';
import { KINDS, unitStats, framesAt } from './roster.mjs';
import { airPair, airDisperse, AIR_SPACING } from './air-spacing.mjs';
import { attackPose } from './combat-phases.mjs';

function unit(s, seat, kind, x,z, extra={}) {
  const u={ id:++s.serial, seat,team:s.seats[seat].team, x,z,cd:0,lat:0,target:null,foe:0,dx: seat==='N'?1:-1,dz:0,...unitStats(kind), ...extra };
  s.units.push(u);return u;
}
const same=(a,b)=>assert(Math.abs(a-b)<1e-9);
assert.equal(S.dimFor(9), S.dimFor(8));
assert.equal(S.dimFor(9).laneWidth,10.6);
assert.equal(S.dimFor(9).laneHalf*2,9.5);
{
  const s=S.createSim({version:9,bots:[]});
  const a=unit(s,'N','mutalisk',0,0),b=unit(s,'N','mutalisk',0,0);
  const before=airPair(a,b);const reverse=airPair(b,a);same(before[0],-reverse[0]);same(before[1],-reverse[1]);
  for(let i=0;i<24;i++)S.step(s);
  const split=Math.hypot(a.x-b.x,a.z-b.z);
  assert(split>.15&&split<1,'gentle idle separation: '+split);
  assert(Math.abs(a.x+b.x)<1e-7&&Math.abs(a.z+b.z)<1e-7);
}
{
  const channels=[{id:1,x:0,z:0}, {id:1,x:0,z:0,fight:{fired:4}}, {id:1,x:0,z:0,fight:{fired:3}}];
  const intent={sx:1,sz:0,mx:0,mz:0};
  const idle=airDisperse(channels[0],intent,1,4)[0];
  const release=airDisperse(channels[1],{...intent,hit:{x:0,z:1},hitRange:1},1,4)[0];
  const recovery=airDisperse(channels[2],{...intent,hit:{x:0,z:1},hitRange:1},1,4)[0];
  assert(idle>recovery&&recovery>release&&release>0&&idle<=AIR_SPACING.drift);
  const drift=airDisperse({id:3,x:1,z:0},{...intent,hit:{x:0,z:0},hitRange:1},1,4);
  assert(Math.hypot(1+drift[0],drift[1])<=1);
}
{
  const s=S.createSim({version:9,bots:[]});
  const dragoon=unit(s,'N','dragoon',0,0), wall=unit(s,'S','battlecruiser',1.1,0,{cd:1000});
  let release=0,impact=0,windup=0;
  for(let i=0;i<55;i++){
    const events=S.step(s);
    if(dragoon.fight?.at>=0&&!windup) { windup=dragoon.fight.at; assert.equal(wall.hp,500); }
    if(events.some(e=>e.type==='launch'&&e.from===dragoon.id)&&!release) {
      release=framesAt(s.tick);assert.equal(wall.hp,500);assert(attackPose(dragoon,release)>0);
    }
    if(wall.hp<500){impact=framesAt(s.tick);break;}
  }
  assert.equal(release-windup,7,'Dragoon first windup in source clock');
  assert(impact>release,'a launched projectile must fly before impact');
}
{
  const s=S.createSim({version:9,bots:[]});
  const m=unit(s,'N','marine',0,0),t=unit(s,'S','battlecruiser',1.1,0,{cd:1000});
  for(let i=0;i<5&&!m.fight?.target;i++)S.step(s);
  assert.equal(m.fight.target,t.id);
  t.x=6;for(let i=0;i<15;i++)S.step(s);
  assert.equal(m.fight.target,null);assert.equal(t.hp,KINDS.battlecruiser.hp);
}
{
  const run = drift => {
    const s=S.createSim({version:9,bots:[]});
    const a=unit(s,'N','scout',0,0), b=unit(s,'S','battlecruiser',1.2,0,{cd:1000});
    const launch=[],impact=[];
    for(let i=0;i<20;i++){
      if(launch.length) b.z+=drift;
      for(const e of S.step(s)){
        if(e.type==='launch'&&e.from===a.id)launch.push(e);
        if(e.type==='impact'&&e.kind==='scout')impact.push(e);
      }
    }
    assert.equal(launch.length,2); assert.equal(launch[0].tick,launch[1].tick);
    assert.equal(launch[0].salvo,launch[1].salvo); assert.notEqual(launch[0].shot,launch[1].shot);
    assert.deepEqual(impact.map(e=>e.body),[11,11]); assert.equal(b.hp,478);
    assert(impact.every(e=>e.tick>launch[0].tick));
    return impact.map(e=>e.tick);
  };
  assert.deepEqual(run(0),[7,7]);
  assert.deepEqual(run(.09),[7,8]);
}
console.log('Candidate v9: gradual symmetric air separation, diminished attack drift, preserved lock range, first-shot wind-up, flight, cancellation and independent Scout hits passed.');
