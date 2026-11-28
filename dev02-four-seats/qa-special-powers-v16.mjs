import assert from 'node:assert/strict';
import * as S from './sim.mjs';
import { TOWER, towerCost } from './defense-tower.mjs';
import { framesAt, unitStats } from './roster.mjs';
import { deliveryFor, placeFixedShot, placeSeekingShot } from './weapon-delivery.mjs';
import { SPECIAL_POWER_VERSION as V, ECONOMY_SCALE, SPECIAL_POWER_COSTS as PRICE,
  applySpecialPower, inSpecialPowerZone, specialPowerTargets, specialPowerZone } from './special-powers.mjs';

const dim = S.dimFor(V);
const create = (version = V, bots = []) => S.createSim({version,bots,seed:218});
const command = (power, seat = 'N') => ({type:'special',seat,power});
const use = (s, power, seat = 'N') => S.step(s, [command(power,seat)]);
const special = events => events.find(e => e.type === 'special');
const unit = (s, kind, seat, x, z, extra = {}) => {
  const u = {id:++s.serial,kind,seat,team:s.seats[seat].team,x,z,target:null,cd:999,lat:0,foe:0,dx:0,dz:0,
    ...unitStats(kind),...extra};
  s.units.push(u);
  return u;
};
const active = (s,u) => s.units.includes(u);

{
  const before = S.economyFor(V-1), after = S.economyFor(V);
  assert.deepEqual([ECONOMY_SCALE,before.startGold,after.startGold,before.income,after.income],[20,48,960,4.5,90]);
  assert.equal(before.incomeEvery,after.incomeEvery);
  assert.deepEqual(S.padsFor(V),S.padsFor(V-1).map(p => ({...p,cost:p.cost*20})));
  assert.equal(towerCost(V-1),70); assert.equal(towerCost(V),1400);
  assert.deepEqual(S.dimFor(V),S.dimFor(V-1));
  const s = create(), out=[];
  for (let t=1;t<=75;t++) {
    const balance=s.seats.N.gold;
    S.step(s);
    if (s.seats.N.gold!==balance) out.push([t,s.seats.N.gold-balance]);
  }
  assert.deepEqual(out,[[19,90],[38,90],[57,90],[75,90]]);
  const purchase = create(), pad = S.padsFor(V).findIndex(p=>p.kind==='battlecruiser');
  [purchase.seats.N.commander.x,purchase.seats.N.commander.z] = S.padWorld('N',pad,dim);
  const buy = S.step(purchase).find(e=>e.type==='buy');
  assert.deepEqual([buy.cost,buy.count,buy.units.length,purchase.seats.N.nextBuy],[800,3,3,1+S.RULES.purchaseGap]);
  assert.equal(purchase.seats.N.gold,160);
  const n = s.seats.N;
  n.gold=towerCost(V)-1;
  assert(!S.step(s,[{type:'tower',seat:'N'}]).some(e=>e.type==='tower-build'));
  n.gold=towerCost(V);
  assert(S.step(s,[{type:'tower',seat:'N'}]).some(e=>e.type==='tower-build'&&e.cost===1400&&e.hp===TOWER.hp));
  assert.equal(n.spent,1400); assert.equal(n.gold,0);
}

{
  const clear = specialPowerZone('clear',dim), control = specialPowerZone('control',dim);
  const there = (power,x,z) => inSpecialPowerZone(power,dim,x,z);
  assert.equal(clear.halfWidth, dim.laneHalf);
  assert.equal(control.halfWidth, clear.halfWidth);
  assert.equal(clear.reach, dim.coreDistance-dim.corePlatformRadius);
  assert.equal(control.reach, clear.reach*.7);
  for (const sign of [-1,1]) for (const axis of [0,1]) {
    const point=(along,across)=>axis===0 ? [along*sign,across] : [across,along*sign];
    assert(there('clear',...point(clear.reach-1e-4,0)));
    assert(!there('clear',...point(clear.reach,0))); // the home platform's rim
    assert(!there('clear',...point(dim.coreDistance,0)));
    // Lane shoulders extend beyond the centerline before meeting the round rim.
    const shoulder = dim.coreDistance-Math.sqrt(dim.corePlatformRadius**2-clear.halfWidth**2);
    assert(there('clear',...point(shoulder-1e-4,clear.halfWidth)));
    assert(!there('clear',...point(shoulder+1e-4,clear.halfWidth)));
    assert(!there('clear',...point(clear.reach-.5,clear.halfWidth+1e-4)));
    assert(there('control',...point(control.reach,control.halfWidth)));
    assert(!there('control',...point(control.reach+1e-4,0)));
    assert(!there('control',...point(control.reach/2,control.halfWidth+1e-4)));
  }
  assert.equal(control.junctionRadius,S.RULES.junction);
  for (const power of ['clear','control']) {
    assert(there(power,5.7,5.7)); // the playable round junction joins the road strips
    assert(!there(power,6,6)); // outside both the junction and the strips
  }
  assert(!there('control',NaN,0)); assert(!there('toString',0,0));
}

{
  const s=create(V,['E']), n=s.seats.N;
  const closerGround=unit(s,'hydralisk','S',0,5), farAir=unit(s,'scout','E',0,26);
  const homeAir=unit(s,'scout','E',dim.coreDistance-1,0), offRoad=unit(s,'wraith','E',15,8);
  const friend=unit(s,'marine','W',-2,11), own=unit(s,'battlecruiser','N',0,-5);
  const alreadyDead=unit(s,'archon','S',7,0,{hp:0});
  const victory=s.seats.S.hp, tower=s.seats.S.tower={x:3,z:dim.coreDistance-6,hp:TOWER.hp,next:99999};
  n.gold=PRICE.clear;
  assert.deepEqual(specialPowerTargets(s,'N','clear',dim).map(u=>u.id),[closerGround.id,farAir.id]);
  assert.deepEqual(specialPowerTargets(s,'N','control',dim).map(u=>u.id),[closerGround.id]);
  // End the fixture's already-dead entry outside the actual combat step.
  s.units=s.units.filter(u=>u!==alreadyDead);
  const events=use(s,'clear');
  assert.deepEqual(special(events),{tick:1,type:'special',seat:'N',team:'A',power:'clear',status:'applied',cost:4500,gold:0,count:2,units:[closerGround.id,farAir.id]});
  assert.deepEqual(events.filter(e=>e.type==='death').map(e=>[e.unit,e.seat,e.by]),[[closerGround.id,'S',['N']],[farAir.id,'E',['N']]]);
  assert.deepEqual([n.spent,n.kills,s.seats.S.lost,s.seats.E.lost],[4500,2,1,1]);
  assert([friend,own,homeAir,offRoad].every(u=>active(s,u)));
  assert.equal(s.seats.S.hp,victory); assert.equal(tower.hp,TOWER.hp);
  n.gold=PRICE.clear;
  const missed=special(use(s,'clear'));
  assert.equal(missed.status,'empty'); assert.equal(n.gold,PRICE.clear);
  const later=unit(s,'wraith','S',-12,0);
  assert.equal(special(use(s,'clear')).status,'applied'); assert(!active(s,later));
}

{
  const s=create(), n=s.seats.N;
  const enemy=unit(s,'dragoon','S',3,8,{hp:73,sh:54,target:'W',foe:819,
    cd:12,motion:{speed:.04,heading:1,direction:1,phase:0},fight:{target:819},dragoonTrack:{target:819,seen:33}});
  const noMoney=special(use(s,'control'));
  assert.equal(noMoney.status,'insufficient'); assert.equal(n.gold,960);
  assert.equal(n.spent,0); assert.equal(enemy.seat,'S');
  n.gold=PRICE.control;
  const snapshot={id:enemy.id,hp:enemy.hp,sh:enemy.sh,cd:enemy.cd,motion:enemy.motion};
  const names=[];
  assert(applySpecialPower(s,'N','control',dim,S.targetOf,(type,seat)=>names.push([type,seat])));
  assert.deepEqual(names,[['special','N']]);
  assert.deepEqual({id:enemy.id,hp:enemy.hp,sh:enemy.sh,cd:enemy.cd,motion:enemy.motion},snapshot);
  assert.deepEqual([enemy.seat,enemy.team,enemy.target,enemy.foe],['N','A','S',0]);
  assert(!enemy.fight&&!enemy.dragoonTrack);
  assert.deepEqual([n.gold,n.spent,n.kills,s.seats.S.lost,n.deployed],[0,6000,0,0,0]);
  n.gold=PRICE.control;
  assert.equal(special(use(s,'control')).status,'empty');
  assert.equal(n.gold,PRICE.control);
  const reinforcement=unit(s,'scout','E',0,-4);
  assert.equal(special(use(s,'control')).status,'applied');
  assert.equal(reinforcement.seat,'N'); assert.equal(n.gold,0);
}

{
  const s=create(V,['W']), n=s.seats.N;
  const enemy=unit(s,'battlecruiser','E',10,1);
  s.seats.W.gold=PRICE.control*2;
  assert.equal(special(use(s,'control','W')),undefined); assert.equal(s.seats.W.gold,PRICE.control*2);
  n.alive=false; n.gold=PRICE.control;
  assert.equal(special(use(s,'control')),undefined); assert.equal(n.gold,PRICE.control);
  n.alive=true;
  assert.equal(special(use(s,'__proto__')),undefined);
  assert.equal(special(use(s,'clear','constructor')),undefined);
  assert.equal(enemy.seat,'E');
}

{
  // At tick 19 the new income is available to this command; it has precedence
  // over automatic beacon purchases during that step.
  const s=create(), n=s.seats.N; s.tick=18; n.gold=PRICE.clear-90;
  const u=unit(s,'wraith','E',0,-8);
  assert.equal(special(use(s,'clear')).status,'applied'); assert.equal(n.gold,0); assert(!active(s,u));
}

function fixed(s,from,to) {
  const shot={id:++s.shotSerial,kind:from.kind,seat:from.seat,team:from.team,from:from.id,target:to.id,core:null,hop:0,prev:null};
  placeFixedShot(shot,deliveryFor(V,from.kind,true),from.x,from.z,to.x,to.z,0,true);
  s.shots.push(shot);
  return shot;
}
{
  const s=create(); s.seats.N.gold=PRICE.control;
  const shooter=unit(s,'battlecruiser','W',22,0);
  const capture=unit(s,'wraith','S',20,0), outside=unit(s,'wraith','E',22,2);
  const allyShot=fixed(s,shooter,capture);
  const source=unit(s,'battlecruiser','S',20.2,-1);
  const oldSideShot=fixed(s,source,shooter);
  const filter=()=>s.shots.length>0;
  const events=use(s,'control');
  assert.equal(special(events).status,'applied');
  assert.equal(capture.seat,'N'); assert.equal(source.seat,'N'); assert.equal(outside.seat,'E');
  for(let i=0;i<20 && filter();i++)events.push(...S.step(s));
  assert(!filter());
  const fizz=events.find(e=>e.type==='fizzle'&&e.shot===allyShot.id);
  const hit=events.find(e=>e.type==='impact'&&e.shot===oldSideShot.id);
  assert.equal(fizz?.seat,'W'); assert.equal(capture.hp,120);
  assert.equal(hit?.seat,'S'); assert.equal(shooter.hp,500-22);
}
{
  const s=create(); s.seats.N.gold=PRICE.control;
  const source=unit(s,'mutalisk','S',20,0), first=unit(s,'wraith','W',21.4,0), bounce=unit(s,'wraith','W',21.6,.2);
  const shot={id:++s.shotSerial,kind:source.kind,seat:source.seat,team:source.team,from:source.id,target:first.id,core:null,hop:0,prev:null};
  placeSeekingShot(shot,deliveryFor(V,source.kind,true),source,first.x,first.z,0);
  s.shots.push(shot);
  const events=use(s,'control');
  assert.equal(special(events).status,'applied'); assert.equal(source.team,'A');
  for(let i=0;i<45;i++)events.push(...S.step(s));
  assert.equal(events.filter(e=>e.type==='impact'&&e.shot===shot.id).length,1);
  assert.equal(first.hp,111); assert.equal(bounce.hp,120);
}
{
  // One shockwave already in flight. Newly friendly converts on the same
  // team as its launcher are spared, but existing allied collateral remains.
  const s=create(); s.tick=3; s.seats.N.gold=PRICE.control;
  const source=unit(s,'archon','W',21.5,0);
  const convert=unit(s,'wraith','S',21.13,0);
  const collateral=unit(s,'wraith','N',21.18,0);
  const shot={id:++s.shotSerial,kind:source.kind,seat:source.seat,team:source.team,from:source.id,target:convert.id,core:null,hop:0,
    effect:'effect',x:21.14,z:0,due:framesAt(s.tick+1),launchTick:s.tick};
  s.shots.push(shot);
  const ev=use(s,'control');
  assert.equal(special(ev).status,'applied'); assert.equal(convert.team,'A');
  assert.equal(convert.hp,120);
  assert(collateral.hp<120);
}

{
  // Commands are ordinary deterministic replay input, not callbacks or timers.
  const seed=218, bots=['S','E'], s=S.createSim({version:V,seed,bots});
  const commands=[];
  const log=[]; const marks=[];
  for(let i=0;i<1500;i++){
    const input=[];
    for(const [seat,power] of [['N','clear'],['W','control']]){
      if (!commands.some(c=>c.seat===seat) && s.seats[seat].gold>=PRICE[power] && specialPowerTargets(s,seat,power,dim).length>0){
        const c={tick:s.tick+1,...command(power,seat)};
        commands.push(c); input.push(c);
      }
    }
    log.push(...S.step(s,input).filter(e=>!e.transient));
    if(s.tick%30===0)marks.push(S.digest(s));
  }
  assert.deepEqual(commands.map(c=>c.power),['clear','control']);
  const replay = S.replay({version:V,seed,bots,ticks:s.tick,commands});
  assert.equal(replay.log.filter(e=>e.type==='special'&&e.status==='applied').length,2);
  assert.equal(replay.final,S.digest(s)); assert.equal(replay.events,S.digest(log)); assert.deepEqual(replay.marks,marks);
  const old={version:V-1,seed,bots,ticks:500};
  assert.deepEqual(S.replay({...old,commands}),S.replay({...old,commands:[]}));
}
console.log('Simulation 16: integer economy, unchanged timing and counts, protected homes, paid repeatable commands, ownership-safe impacts, deterministic replays.');
