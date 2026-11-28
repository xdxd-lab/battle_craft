import assert from 'node:assert/strict';
import * as S from './sim.mjs';
import { TOWER, DEFENSE_VERSION } from './defense-tower.mjs';
import { unitStats } from './roster.mjs';
const tower={type:'tower',seat:'N'};
const state=(version=DEFENSE_VERSION)=>S.createSim({version,bots:[]});
function place(s,kind,seat,x,z,target='N'){
  const u={id:++s.serial,kind,seat,team:s.seats[seat].team,x,z,target,cd:0,lat:0,foe:0,dx:0,dz:0,...unitStats(kind)};
  s.units.push(u);return u;
}
{
  const s=state(),n=s.seats.N; assert.equal(S.step(s,[tower]).filter(e=>e.type==='tower-build').length,0);
  assert(!n.tower);n.gold=TOWER.cost;
  assert.equal(S.step(s,[tower,tower]).filter(e=>e.type==='tower-build').length,1);
  assert.equal(n.gold,0);assert.equal(n.spent,TOWER.cost);assert.equal(n.buys,0);
  n.gold=1000;n.tower.hp=0;S.step(s,[tower]);assert.equal(n.gold,1000);assert.equal(n.tower.hp,0);
  const old=state(10);old.seats.N.gold=1000;S.step(old,[tower]);assert(!old.seats.N.tower);assert.equal(old.seats.N.gold,1000);
}
{
  const s=state(),n=s.seats.N;n.gold=TOWER.cost;S.step(s,[tower]);const t=n.tower;
  const enemy=place(s,'marine','S',t.x,t.z+2.4);
  const friend=place(s,'marine','W',t.x,t.z+1);
  const es=S.step(s);
  assert(es.some(e=>e.type==='tower-fire'&&e.to===enemy.id));
  assert(es.some(e=>e.type==='death'&&e.unit===enemy.id));assert(friend.hp>0);
  const next=place(s,'scourge','S',t.x+.4,t.z+2.4);const later=[];
  for(let i=0;i<35;i++)later.push(...S.step(s));
  assert(later.some(e=>e.type==='tower-fire'&&e.to===next.id));assert(!s.units.includes(next));
}
{
  const s=state(),n=s.seats.N;n.gold=TOWER.cost;S.step(s,[tower]);const t=n.tower;
  // Make a deterministic return-fire scenario with the tower holding for a reload.
  t.next=9999;
  place(s,'battlecruiser','S',t.x,t.z+1.6);
  place(s,'battlecruiser','S',t.x+.2,t.z+1.6);
  let lost=false;
  for(let i=0;i<240&&!lost;i++){
    const ev=S.step(s);if(ev.some(e=>e.type==='tower-fall'))lost=true;
    assert.equal(n.hp,2700);
  }
  assert(lost&&t.hp===0,'turret must absorb actual adjacent enemy fire before the core');
  for(let i=0;i<100;i++)S.step(s);
  assert(n.hp<2700,'enemies resume firing on the core');
}
console.log('Defense tower: single paid slot, no old-version effect, isolated ground and air targets, diversion, destroyed tower cannot be rebuilt.');
