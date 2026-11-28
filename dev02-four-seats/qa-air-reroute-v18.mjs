import assert from 'node:assert/strict';
import * as S from './sim.mjs';
import { corePos } from '../dev05-layout/layout.mjs';
import { unitStats } from './roster.mjs';
import { effectiveWeaponRange } from './combat-reach.mjs';
import { AIR_REROUTE_FROM as V, hasAirShortcut } from './air-reroute.mjs';

const dim=S.dimFor(V), [ex,ez]=corePos('E',dim);
const add=(s,kind,x,z,{seat='N',target='S',...overrides}={})=>{
  const u={id:++s.serial,seat,team:s.seats[seat].team,x,z,cd:0,target,lat:0,foe:0,dx:1,dz:0,
    ...unitStats(kind),...overrides};
  s.units.push(u); return u;
};
const gapE=u=>Math.hypot(u.x-ex,u.z-ez);
const dead=(s,id)=>Object.assign(s.seats[id],{alive:false,hp:0});
const eastEnvelopes=kind=>S.RULES.coreRadius+effectiveWeaponRange(V,kind,false);
const firstTrack=(v)=>{
  const s=S.createSim({version:v,bots:[]});
  const air=add(s,'battlecruiser',0,26.8), ground=add(s,'dragoon',0,23.7);
  // Hit actually arrives this step: check the normal fall/reroute state change
  // rather than manually flipping a passed-in shortcut flag.
  s.seats.S.hp=1;
  s.shots.push({id:++s.shotSerial,kind:air.kind,seat:air.seat,team:air.team,from:air.id,target:0,core:'S',
    hop:0,effect:true,x:0,z:dim.coreDistance,due:0});
  const e=S.step(s);
  assert(e.some(v=>v.type==='fall'&&v.seat==='S'));
  assert(e.some(v=>v.type==='reroute'&&v.seat==='N'&&v.to==='E'&&v.count===2));
  assert.equal(air.target,'E'); assert.equal(ground.target,'E');
  assert.equal(hasAirShortcut(s,air),v>=V);assert(!hasAirShortcut(s,ground));
  const start=gapE(air); let firstHit, firstPosition, leftLanes=false, stepsOutside=0;
  const outside=u=>Math.abs(u.x)>dim.laneHalf&&Math.abs(u.z)>dim.laneHalf&&Math.hypot(u.x,u.z)>S.RULES.junction
    && S.SEAT_IDS.every(id=>{const [x,z]=corePos(id,dim);return Math.hypot(u.x-x,u.z-z)>dim.platformWalkRadius;});
  for(let i=0;i<3600&&!firstHit;i++){
    const steps=S.step(s);
    leftLanes||=outside(ground);
    stepsOutside+=Number(outside(air));
    firstHit=steps.find(v=>v.type==='impact'&&v.seat==='N'&&v.target==='E'&&v.kind==='battlecruiser');
    if(firstHit)firstPosition=gapE(air);
  }
  assert(firstHit&&s.seats.E.hp<2700); assert(!leftLanes,'ground never leaves existing road/platform');
  assert(firstPosition<=eastEnvelopes(air.kind)&&firstPosition>=S.RULES.coreRadius-.02);
  return {tick:firstHit.tick,firstPosition,stepsOutside,start};
};
// Before a core fall, air and ground follow the exact v17 movement and hit
// behavior. Ignore only the version marker, not position, kinematics or events.
function initialPath(version) {
  const s=S.createSim({version,bots:[]}), log=[];
  add(s,'wraith', .8,-22); add(s,'dragoon',-1.8,-22);
  for(let i=0;i<520;i++)log.push(...S.step(s));
  return {units:s.units,log};
}
assert.deepEqual(initialPath(V),initialPath(V-1));
const past=firstTrack(V-1), changed=firstTrack(V);
assert(changed.stepsOutside>250&&past.stepsOutside<10,'only v18 air takes the diagonal');
assert(changed.tick<past.tick*.83,'air actually reaches the next front earlier');
console.log('Post-fall BC path (pre-v18 / v18):',past,changed);

{
  const s=S.createSim({version:V,bots:[]}), u=add(s,'wraith',0,0);
  assert(!hasAirShortcut(s,u),'the original route is not a shortcut');
  dead(s,'S');u.target='W';assert(!hasAirShortcut(s,u),'never shortcut to a friendly core');
  u.target='E';assert(hasAirShortcut(s,u),'newly spawned air also crosses after the opposing base falls');
  dead(s,'E');assert(!hasAirShortcut(s,u),'target must still be live');
}

{
  const s=S.createSim({version:V,bots:[]}); dead(s,'S');
  const u=add(s,'battlecruiser',0,27,{target:'E'}), t=add(s,'wraith',13.1,17.7,{seat:'E',target:null,cd:1e6,hp:12});
  let mid, finished;
  for(let i=0;i<2200&&!finished;i++){
    const events=S.step(s);
    mid??=events.find(e=>e.type==='impact'&&e.target===t.id);
    finished??=events.find(e=>e.type==='impact'&&e.target==='E'&&e.kind===u.kind);
  }
  assert(mid&&mid.x>9&&mid.z>9,'units meet and shoot outside either lane');
  assert(finished&&mid.tick<finished.tick,'air resumes and attacks the remaining core after winning the encounter');
  assert.equal(u.target,'E','combat never overwrites the alternate destination');
  console.log('Off-road engagement and resumed core attack:',mid.tick,finished.tick);
}

{
  const s=S.createSim({version:V,bots:[]}); dead(s,'S');
  const u=add(s,'scourge',25,12,{target:'E'});
  let attempted=false;
  for(let i=0;i<530;i++)attempted||=S.step(s).some(e=>e.type==='launch'&&e.from===u.id);
  assert(gapE(u)>S.RULES.coreRadius&&gapE(u)<=dim.platformWalkRadius+.02,'air-only unit loiters outside the enemy core');
  assert.equal(s.seats.E.hp,2700); assert(!attempted);
}

{
  const s=S.createSim({version:V,bots:[]}); dead(s,'S');
  const fleet=Array.from({length:5},()=>add(s,'battlecruiser',ex-6.65,.3,{target:'E'}));
  let firstHit=0,tally=0,min=Infinity;
  for(let i=0;i<280;i++){
    const events=S.step(s);
    for(const e of events)if(e.type==='impact'&&e.target==='E'){firstHit||=e.tick;tally++;}
    if(firstHit&&i>30)min=Math.min(min,...fleet.map(gapE));
  }
  const spread=Math.max(...fleet.flatMap(a=>fleet.map(b=>Math.hypot(a.x-b.x,a.z-b.z))));
  assert(tally>=20,'fleet keeps firing rather than breaking stance due to spacing');
  assert(spread>.13&&spread<1.5,'soft flock visibly spreads without rejecting co-location');
  assert(min>S.RULES.coreRadius&&fleet.every(u=>gapE(u)<=eastEnvelopes(u.kind)+1e-9));
  console.log('Core siege: shots',tally,'fleet spread',spread.toFixed(3),'closest center',min.toFixed(3));
}
console.log('v18 alternate air route: fall, ground unchanged, off-road engagement and resumption, real stand-off and bounded attacking formation.');
