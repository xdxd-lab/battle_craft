import assert from 'node:assert/strict';
import * as S from './sim.mjs';
import { WORLD_PER_PX } from './motion.mjs';
import { framesAt, unitStats, SHIELD_REGEN } from './roster.mjs';
import { DAT_EXTENTS } from './combat-reach.mjs';
import {
  TOWER, TOWER_VARIANTS as VARIANTS, TOWER_VARIANTS_VERSION as V, towerCost, towerSpec, towerWeaponBox, hitTower,
} from './defense-tower.mjs';

const create=(version=V,bots=[])=>S.createSim({version,bots,seed:9228});
const cmd=(kind,seat='N')=>({type:'tower',seat,kind});
const builds=e=>e.filter(x=>x.type==='tower-build');
function place(s,kind,seat,x,z,extra={}){
  const u={id:++s.serial,kind,seat,team:s.seats[seat].team,x,z,target:null,cd:9999,lat:0,foe:0,dx:0,dz:0,...unitStats(kind),...extra};
  s.units.push(u);return u;
}
function until(s,rule,limit=200){
  for(let i=0;i<limit;i++){
    const e=S.step(s).find(rule);
    if(e)return e;
  }
  return null;
}

{
  const s=create(), n=s.seats.N;
  assert.deepEqual(S.economyFor(V),S.economyFor(V-1));
  assert.deepEqual(S.padsFor(V),S.padsFor(V-1));
  assert.equal(towerCost(V-1),1400);assert.equal(towerSpec(V-1),TOWER);
  assert.deepEqual(Object.keys(VARIANTS),['photon','spore','sunken']);
  for(const kind of Object.keys(VARIANTS))assert.equal(towerCost(V,kind),500);
  assert.equal(towerSpec(V,'__proto__'),null);
  assert.deepEqual(builds(S.step(s,[cmd('fake'),cmd('toString'),cmd(undefined)])),[]);
  assert.equal(n.gold,960);
  const [first]=builds(S.step(s,[cmd('photon')]));
  assert.deepEqual([first.hp,first.sh,first.cost,first.replaced,first.towerId],[300,300,500,null,1]);
  const position=[n.tower.x,n.tower.z], old=n.tower;
  assert.deepEqual(builds(S.step(s,[cmd('spore')])),[]);
  assert.equal(n.gold,460);assert.equal(n.tower,old);
  n.gold=500;
  const [second]=builds(S.step(s,[cmd('spore'),cmd('sunken')]));
  assert.deepEqual([second.kind,second.sh,second.replaced,second.towerId],['spore',0,'photon',2]);
  assert.deepEqual([n.tower.x,n.tower.z],position);
  assert.deepEqual([n.gold,n.spent,n.buys,n.deployed],[0,1000,0,0]);
  n.gold=500;n.tower.hp=7;
  const [third]=builds(S.step(s,[cmd('spore')]));
  assert.deepEqual([third.kind,third.hp,third.replaced,third.towerId],['spore',300,'spore',3]);
  n.gold=500;n.tower.hp=0;
  assert.equal(builds(S.step(s,[cmd('sunken')]))[0].towerId,4);
  assert.equal(n.tower.kind,'sunken');
  n.alive=false;n.gold=1000;
  assert.deepEqual(builds(S.step(s,[cmd('photon')])),[]);assert.equal(n.gold,1000);
}

for(const [kind,legal,illegal] of [['photon',['battlecruiser','marine'],[]],['spore',['battlecruiser'],['marine']],['sunken',['marine'],['battlecruiser']]]){
  for(const k of [...legal,...illegal]){
    const s=create();S.step(s,[cmd(kind)]);const t=s.seats.N.tower;
    const ally=place(s,k,'W',t.x,t.z+.02);
    const target=place(s,k,'S',t.x,t.z+2,{hp:600});
    const fire=until(s,e=>e.type==='tower-fire');
    if(illegal.includes(k)){assert.equal(fire,null,kind);assert.equal(target.hp,600);continue;}
    assert.equal(fire.to,target.id);assert.equal(fire.kind,kind);assert.equal(target.hp,600);
    const hit=until(s,e=>e.type==='tower-impact'&&e.shot===fire.shot);
    assert.equal(hit.to,target.id);
    const expected=kind==='spore'?77:kind==='sunken'?60:k==='battlecruiser'?57:60;
    assert.equal(hit.body,expected);assert.equal(target.hp,600-expected);
    assert.equal(ally.hp,unitStats(k).hp);
  }
}

for(const [kind,k] of [['photon','battlecruiser'],['spore','battlecruiser'],['sunken','marine']]){
  for(const extra of [0,1]){
    const s=create();S.step(s,[cmd(kind)]);const t=s.seats.N.tower;
    const b=towerWeaponBox(t), x=(b.r+VARIANTS[kind].rangePx+DAT_EXTENTS[k][0]+extra)*WORLD_PER_PX;
    const target=place(s,k,'S',x,t.z);
    const fire=until(s,e=>e.type==='tower-fire',30);
    assert.equal(fire?.to,extra?undefined:target.id,kind+' '+extra);
  }
}

for(const [kind,k] of [['photon','battlecruiser'],['spore','battlecruiser'],['sunken','marine']]){
  const s=create();S.step(s,[cmd(kind)]);const t=s.seats.N.tower;
  place(s,k,'S',t.x,t.z+2.3,{hp:6000});
  const fire1=until(s,e=>e.type==='tower-fire');
  const fire2=until(s,e=>e.type==='tower-fire');
  assert.equal(framesAt(fire1.tick),1+VARIANTS[kind].windup);
  assert.equal(framesAt(fire2.tick)-framesAt(fire1.tick),VARIANTS[kind].period);
}

{
  // Shields are not extra hull: armor applies only to the part left after shield.
  const s=create();S.step(s,[cmd('photon')]);const t=s.seats.N.tower;
  const ev=[];
  let d=hitTower(s,'N',80,'N',1,(...args)=>ev.push(args),t.id);
  assert.deepEqual(d,{shield:80,body:0});assert.deepEqual([t.hp,t.sh],[300,220]);
  const before=framesAt(s.tick);
  for(let i=0;i<15;i++)S.step(s);
  const gained=(framesAt(s.tick)-before)*SHIELD_REGEN/256;
  assert.equal(t.sh,220+gained);
  t.sh=50;
  d=hitTower(s,'N',80,'N',1,(...args)=>ev.push(args),t.id);
  assert.deepEqual(d,{shield:50,body:27});assert.deepEqual([t.hp,t.sh],[273,0]);
  assert.equal(hitTower(s,'N',999,'N',1,(...args)=>ev.push(args),t.id+1),null);
  hitTower(s,'N',999,'N',1,(...args)=>ev.push(args),t.id);
  assert.equal(ev[0][0],'tower-fall');assert.equal(ev[0][2].kind,'photon');assert.equal(t.hp,0);
}

for(const [kind,k] of [['photon','battlecruiser'],['spore','battlecruiser'],['sunken','marine']]){
  const s=create();S.step(s,[cmd(kind)]);const t=s.seats.N.tower;
  const target=place(s,k,'S',t.x,t.z+2.3,{hp:600});
  const fire=until(s,e=>e.type==='tower-fire');
  const shot=s.towerShots.find(x=>x.id===fire.shot);
  const oldX=shot.tx, oldZ=shot.tz;
  target.x+=4;
  t.next=9999;
  const hit=until(s,e=>e.type==='tower-impact'&&e.shot===fire.shot);
  assert(hit&&target.hp<600,kind);assert.equal(hit.to,target.id);
  if(kind==='sunken'){
    assert.deepEqual([hit.x,hit.z],[oldX,oldZ]);assert.equal(framesAt(hit.tick)-framesAt(fire.tick),5);
  }else{
    assert(Math.abs(hit.tx-oldX)>3.9);assert.notEqual(hit.tick,fire.tick);
  }
}
{
  // A paid replacement does not erase its outgoing ammunition, and an
  // attacker already en route to its old body cannot hit the new generation.
  const s=create(); S.step(s,[cmd('photon')]); const n=s.seats.N,t=n.tower;
  const enemy=place(s,'wraith','S',t.x+2.16,t.z,{target:'N',dx:-1,cd:9999});
  const outer=until(s,e=>e.type==='tower-fire');
  n.gold=500;
  S.step(s,[cmd('sunken')]);assert.equal(n.tower.id,2);
  const oldLanding=until(s,e=>e.type==='tower-impact'&&e.shot===outer.shot);
  assert.equal(oldLanding.kind,'photon');assert.equal(oldLanding.towerId,1);assert.equal(enemy.hp,60);

  enemy.cd=0;
  const flight=until(s,e=>e.type==='launch'&&e.kind==='wraith');
  assert(s.shots.find(x=>x.id===flight.shot&&x.towerId===2));
  n.gold=500;
  const replacement=S.step(s,[cmd('spore')]);
  assert.equal(builds(replacement)[0].towerId,3);
  const isFizzle=e=>e.type==='fizzle'&&e.shot===flight.shot;
  const fizzle=replacement.find(isFizzle)??until(s,isFizzle);
  assert(fizzle);assert.equal(n.tower.hp,300);
}
{
  const s=create();S.step(s,[cmd('spore')]);const t=s.seats.N.tower;
  const enemy=place(s,'battlecruiser','S',t.x,t.z+2.3);
  const fire=until(s,e=>e.type==='tower-fire');enemy.team='A';
  const fail=until(s,e=>e.type==='tower-fizzle'&&e.shot===fire.shot);
  assert(fail);assert.equal(enemy.hp,500);
}
{
  const inputs={version:V,bots:['W','S','E'],seed:221,ticks:1220,
    commands:[{tick:1,...cmd('photon')},{tick:48,...cmd('spore')},{tick:300,...cmd('sunken')}]};
  const a=S.replay(inputs),b=S.replay(inputs);
  assert.deepEqual(a,b);
  assert.deepEqual(builds(a.log).map(x=>x.kind),['photon','spore','sunken']);
}
console.log('Tower v18: all targets and DAT borders, three delivery patterns, cooldown ownership, shield regeneration, shared paid slot and replay determinism.');
