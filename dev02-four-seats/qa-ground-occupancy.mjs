// Pure Node tests for v9 candidate. Production sim v8 still never calls this module.
import assert from 'node:assert/strict';
import { RULES, dimFor } from './sim.mjs';
import { KINDS } from './roster.mjs';
import { WORLD_PER_PX as px } from './motion.mjs';
import { GROUND_DAT_EXTENTS as DAT, groundExtents, groundOverlap, groundGap,
  createGroundTerrain, createGroundOccupancy } from './ground-occupancy.mjs';

const dim=dimFor(8);
const T=createGroundTerrain(dim,RULES);
const at=(id,kind,x,z,seat='N',hp=100)=>({id,kind,x,z,seat,hp});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function checkNoOverlap(units) {
  for (let i=0;i<units.length;i++) for (let j=i+1;j<units.length;j++)
    assert.equal(groundOverlap(units[i],units[j]),false,`overlap ${units[i].id}/${units[j].id}`);
}
{
  assert.deepEqual(DAT,{marine:[8,9,8,10],dragoon:[15,15,16,16],hydralisk:[10,10,10,12],archon:[16,16,15,15]});
  assert.equal(groundExtents('scout'),null);
  for (const [k,b] of Object.entries(DAT)) assert.deepEqual(groundExtents(k),b.map(v=>(v+.5)*px));
  const a=at(1,'dragoon',0,0), b=at(2,'archon',33*px,0);
  assert.equal(groundOverlap(a,b),false,'edge contact is usable');
  near(groundGap(a,b),0);
  b.x -= px/8; assert.equal(groundOverlap(a,b),true);
  b.x = -31*px; assert.equal(groundOverlap(a,b),false,'preserve asymmetric DAT footprint');
  b.x += px/8; assert.equal(groundOverlap(a,b),true);
  const air=at(3,'scout',0,0);
  assert.equal(groundOverlap(a,air),false);
}
{
  assert.equal(dim.laneWidth,10.6,'visible width stays v6-0');
  assert.equal(2*dim.laneHalf,9.5,'walkable centre corridor stays v6-0');
  const boundary=dim.laneHalf-groundExtents('dragoon')[2];
  assert.ok(T.fits('dragoon',boundary,-16));
  assert.equal(T.fits('dragoon',boundary+px*.5,-16),false,'center alone being in lane is insufficient');
  assert.ok(T.fits('dragoon',6,5),'hub connects the north and east arms');
  assert.equal(T.fits('dragoon',7,7),false);
  const z= -dim.coreDistance+RULES.coreRadius+groundExtents('dragoon')[1];
  assert.ok(T.fits('dragoon',0,z),'touch from inner side of core platform');
  assert.equal(T.fits('dragoon',0,z-px*.2),false,'core disk subtracts occupied rectangle, not just center');
  assert.ok(z+dim.coreDistance <= RULES.coreRadius+KINDS.dragoon.range,'physical stop allows core attacks');
  const n=at(1,'dragoon',0,-1), s=at(2,'marine',0,-1-(groundExtents('dragoon')[1]+groundExtents('marine')[3]));
  assert.equal(groundOverlap(n,s),false);
  assert.ok(Math.hypot(n.x-s.x,n.z-s.z) <= KINDS.dragoon.range &&
    Math.hypot(n.x-s.x,n.z-s.z)<=KINDS.marine.range,'mutual contact does not make either target unreachable');
}
{
  const a=at(1,'marine',-1,-1), b=at(2,'dragoon',0,0);
  const G=createGroundOccupancy([a,b],dim,RULES);
  const p=G.resolve([{id:1,dx:2,dz:2,allowSidestep:false}],1).get(1);
  assert.equal(p.mode,'short','a clear endpoint cannot tunnel through a body');
  near(p.x,-.5); near(p.z,-.5);
  assert.deepEqual([a.x,a.z],[-1,-1],'grid does not mutate the caller');
  const behind=at(5,'dragoon',0,-.41), D=createGroundOccupancy([behind,b],dim,RULES);
  const side=D.resolve([{id:5,dx:0,dz:.08,side:1}],0).get(5);
  assert.equal(side.mode,'sidestep');
  assert.ok(side.dx<0 && Math.hypot(side.dx,side.dz)<.081);
  assert.equal(groundOverlap({...behind,...side},b),false);
  const Q=createGroundOccupancy([a,at(3,'scout',0,0),at(4,'marine',0,0,'E',0)],dim,RULES);
  assert.equal(Q.resolve([{id:1,dx:2,dz:2},{id:3,dx:2,dz:2}]).get(1).mode,'straight','air and corpses never block ground');
}
{
  const N=-dim.spawnRadial;
  const old=at(1,'dragoon',0,N), G=createGroundOccupancy([old],dim,RULES);
  const drafts = Array.from({length:12},(_,i)=>at(2+i,'dragoon',0,N));
  const positions=G.reserveWave(drafts);
  assert.equal(positions.length,drafts.length);
  checkNoOverlap([old,...drafts.map((u,i)=>({...u,...positions[i]}))]);
  assert.deepEqual([drafts[0].x,drafts[0].z],[0,N]);
  assert.equal(G.reserveWave([at(35,'marine',0,N-1),at(36,'marine',100,100)]),null);
  assert.deepEqual(G.reserveWave([at(35,'marine',0,N-1)]),[{x:0,z:N-1}],'failed wave leaves neither reserved ID nor a body');
}
function march(input, frames, reverse=false) {
  let units=input.map(u=>({...u}));
  for(let f=0;f<frames;f++){
    const intents=units.flatMap(u=>{
      if(!u.goal)return [];
      const [x,z]=u.goal, dx=x-u.x,dz=z-u.z,d=Math.hypot(dx,dz), step=Math.min(1,6*px/d);
      if(!d)return [];
      return [{id:u.id,dx:dx*step,dz:dz*step,side:u.side,allowSidestep:true,lookAhead:Math.min(.62,d)}];
    });
    const G=createGroundOccupancy(reverse ? [...units].reverse() : units,dim,RULES);
    const move=G.resolve(reverse?intents.reverse():intents,f);
    units=units.map(u=>{
      const p=move.get(u.id);
      return p ? {...u,x:p.x,z:p.z,side:p.side} : u;
    });
    checkNoOverlap(units);
    for(const u of units) assert.ok(T.fits(u.kind,u.x,u.z),`terrain ${u.id}`);
  }
  return units;
}
{
  const rows=[
    {...at(1,'dragoon',0,-11), goal:[0,11]},
    {...at(2,'dragoon',0,11,'S'), goal:[0,-11]},
    {...at(3,'archon',-11,0,'W'), goal:[11,0]},
    {...at(4,'hydralisk',11,0,'E'), goal:[-11,0]},
    at(5,'dragoon',0,0),
  ];
  const a=march(rows,500), b=march(rows,500,true);
  assert.deepEqual(a,b,'same outcomes with queue/insertion order reversed');
  for(const u of a)if(u.goal){near(u.x,u.goal[0]);near(u.z,u.goal[1]);}
}
{
  const wall = Array.from({length:5},(_,i)=>at(i+1,'dragoon',(i-2)*.47,-16));
  const marchers=Array.from({length:12},(_,i)=>({...at(i+20,'dragoon',(i%3-1)*.52,-23-Math.floor(i/3)*.52),goal:[(i%3-1)*.52,-9+Math.floor(i/3)*.53]}));
  const end=march([...wall,...marchers],900);
  for(const u of end)if(u.goal){near(u.x,u.goal[0]);near(u.z,u.goal[1]);}
}
console.log('Ground candidate: DAT box extents, road/hub/core, swept mutual occupancy, atomic wave spawn, lane and junction passing');
