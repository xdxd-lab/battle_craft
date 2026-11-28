import assert from 'node:assert/strict';
import * as S from './sim.mjs';
import * as L from '../dev05-layout/layout.mjs';
import { KINDS, unitStats } from './roster.mjs';
import { DEFENSE_VERSION } from './defense-tower.mjs';

const dim=S.dimFor(DEFENSE_VERSION),[x,z]=L.corePos('N',dim);
const enemy=(state,kind,i)=>{
  const id=++state.serial;
  state.units.push({id,seat:'S',team:state.seats.S.team,kind,x:x+(i-2)*.7,z:z+9,target:'N',
    dx:0,dz:-1,cd:0,lat:0,foe:0,...unitStats(kind)});
};
for(const kind of ['battlecruiser','marine']){
  const s=S.createSim({version:DEFENSE_VERSION,bots:['N']});
  const current=S.padsFor(s.version);
  s.tick=31;s.seats.N.gold=48;
  // Simulate a bot previously walking toward Scourge when the threat appears.
  Object.assign(s.bots.N,{pad:8,left:1,seen:0,until:0});
  for(let i=0;i<4;i++)enemy(s,kind,i);
  const events=[];
  for(let i=0;i<170;i++)events.push(...S.step(s));
  const orders=events.filter(e=>e.type==='npc-defense');
  const first=orders[0], buy=events.find(e=>e.type==='buy'&&e.seat==='N');
  assert(first&&buy&&first.limit>=1&&first.limit<=3);
  assert.equal(buy.kind,first.kind,'the defensive path cannot buy a crossed beacon');
  assert(KINDS[buy.kind].targets.includes(KINDS[kind].air?'air':'ground'));
  if(kind==='marine')assert(orders.every(e=>e.kind!=='scourge'),'do not buy anti-air-only in a ground siege');
  else assert(['scout','hydralisk','scourge','wraith','battlecruiser','archon','dragoon'].includes(buy.kind));
  console.log({enemy:kind,chosen:first.kind,orderTick:first.tick,buyTick:buy.tick,orders:orders.map(x=>x.kind),hp:Math.round(s.seats.N.hp)});
}
const record={version:DEFENSE_VERSION,bots:['N','W','S','E'],seed:5,commands:[],ticks:1500};
const a=S.replay(record),b=S.replay(record);
assert.deepEqual(a.marks,b.marks);assert.equal(a.events,b.events);
console.log('Defense v11 replay determinism passed.',a.events);
