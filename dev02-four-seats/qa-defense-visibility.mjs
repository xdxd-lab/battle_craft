import assert from 'node:assert/strict';
import * as S from './sim.mjs';
import { SEATS,corePos,ccw } from '../dev05-layout/layout.mjs';
import { createGroundTerrain, groundExtents, groundOverlap, movementExtents } from './ground-occupancy.mjs';
import { DEFENSE_VERSION, VISIBILITY_VERSION, TOWER, towerPosition } from './defense-tower.mjs';

const old=S.dimFor(DEFENSE_VERSION), dim=S.dimFor(VISIBILITY_VERSION);
const terrain=createGroundTerrain(dim,S.RULES);
assert.equal(dim.laneWidth,old.laneWidth);
assert.equal(movementExtents('dragoon',old).reduce((a,b)=>a+b,0),groundExtents('dragoon').reduce((a,b)=>a+b,0));
const width=([l,,r])=>l+r;
assert.equal(width(groundExtents('dragoon')),.405);
assert(Math.abs(width(movementExtents('dragoon',dim))-.89)<1e-9);
for(const kind of ['marine','hydralisk','archon'])assert.deepEqual(movementExtents(kind,dim),groundExtents(kind));
for(const {id,dir} of SEATS){
 const [x,z]=towerPosition(id,dim), [cx,cz]=corePos(id,dim), [ox,oz]=towerPosition(id,old);
 const f=-(dir[0]*(x-ox)+dir[1]*(z-oz)), side=ccw(dir);
 assert(Math.abs(f-1.3)<1e-9);
 assert(Math.abs(side[0]*(x-ox)+side[1]*(z-oz)-1.25)<1e-9);
 assert(Math.hypot(x-cx,z-cz)-TOWER.hitRadius>S.RULES.coreRadius);
 assert(Math.min(Math.abs(x),Math.abs(z))+.83<dim.laneHalf);
 const s=S.createSim({version:VISIBILITY_VERSION,bots:[]});s.seats[id].gold=100;
 assert(S.step(s,[{seat:id,type:'tower'}]).some(e=>e.type==='tower-build'&&e.x===x&&e.z===z));
 assert.equal(s.seats[id].tower.hp,180);
}
// Stress setup only; regular test candidates retain the deployed one-per-purchase.
const padIndex=S.padsFor(VISIBILITY_VERSION).findIndex(p=>p.kind==='dragoon');
const p=S.padsFor(VISIBILITY_VERSION)[padIndex],count=p.count;p.count=12;
try {
 const s=S.createSim({version:VISIBILITY_VERSION,bots:[]});
 const [x,z]=S.padWorld('N',padIndex,dim);
 Object.assign(s.seats.N.commander,{x,z});s.seats.N.gold=200;
 let waves=0, min=Infinity;
 for(let tick=1;tick<=92;tick++){
  const events=S.step(s);
  if(events.some(e=>e.type==='buy'))waves++;
  for(let i=0;i<s.units.length;i++){
   const a=s.units[i];assert(terrain.fits(a.kind,a.x,a.z));
   for(let j=0;j<i;j++){
    const b=s.units[j];assert(!groundOverlap(a,b,dim));
    min=Math.min(min,Math.max(Math.abs(a.x-b.x),Math.abs(a.z-b.z)));
   }
  }
 }
 assert(waves>=4);
 assert(min>=.89-1e-8);
 console.log('Sim 12 prototype wave stress:',waves,'batches; minimum Chebyshev centre separation',min.toFixed(3));
} finally{p.count=count;}
console.log('Movement clearance, legacy DAT hitbox, fixed four tower slots and old economy verified.');
