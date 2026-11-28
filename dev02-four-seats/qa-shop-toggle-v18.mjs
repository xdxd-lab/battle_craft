import assert from 'node:assert/strict';
import { createSim, dimFor, FIELD_CONTROLS_VERSION as version, padRadiusFor, padWorld, replay, SEAT_IDS, step, toLocal } from './sim.mjs';
import { shopRetreatPath } from './shop-retreat.mjs';

const dim=dimFor(version);
const tap=(seat,index)=>({seat,type:'shop',index});
const run=(s,n)=>Array.from({length:n},()=>step(s)).flat();
const bought=events=>events.some(e=>e.type==='buy');
const noPad=(seat,{x,z})=>Array.from({length:9},(_,i)=>padWorld(seat,i,dim))
  .every(([px,pz])=>Math.hypot(x-px,z-pz)>padRadiusFor(version));
for (const seat of SEAT_IDS) for(let index=0;index<9;index++) {
  const s=createSim({version,bots:[]}), own=s.seats[seat], c=own.commander;
  const points=padWorld(seat,index,dim);
  assert(!bought(step(s,[tap(seat,index),tap(seat,index)])), 'rapid two taps cancel before standing on a pad');
  assert.equal(own.shopChoice,-1);
  assert(!bought(run(s,50)));
  assert(noPad(seat,c));

  step(s,[tap(seat,index)]);
  assert.equal(own.shopChoice,index);
  // Already on the scheduled pad, with one more buy due on the cancel step.
  [c.x,c.z]=points;
  step(s);
  assert.equal(own.pad,index);
  own.nextBuy=s.tick+1;
  const before=own.buys;
  assert(!bought(step(s,[tap(seat,index)])), 'cancel blocks a purchase due on the very same step');
  assert.equal(own.pad,-1);
  assert(!bought(run(s,50)));
  assert.equal(own.buys,before);
  assert(noPad(seat,c));
  const [x,z]=toLocal(seat,c.x,c.z,dim);
  assert(Math.abs(Math.abs(x)-1.5)<1e-9 && Math.abs(Math.abs(z)-2.4)<1e-9);

  // A manual click still uses original physical beacon behavior.
  const [px,pz]=padWorld(seat,0,dim);
  step(s,[{seat,type:'goal',x:px,z:pz}]);
  assert.equal(own.shopChoice,null);
  run(s,55);
  assert.equal(own.pad,0);
  assert(own.buys>before);
}

const old=createSim({version:17,bots:[]});
step(old,[tap(SEAT_IDS[0],4)]);
assert(!('shopChoice' in old.seats[SEAT_IDS[0]]),'old replay shape is untouched');
const sample={version,bots:[],seed:55,ticks:120,commands:[
  {tick:1,...tap(SEAT_IDS[0],4)}, {tick:1,...tap(SEAT_IDS[0],4)}, {tick:58,...tap(SEAT_IDS[0],2)},
]};
assert.deepEqual(replay(sample).marks,replay(sample).marks);
const radius=padRadiusFor(version);
for(let i=-39;i<=39;i++)for(let j=-69;j<=69;j++){
  const start=[i/10,j/10];
  let [ax,az]=start;
  const path=shopRetreatPath(start,dim.shopPadPositions,radius);
  assert(Math.abs(path.at(-1)[0])===1.5&&Math.abs(path.at(-1)[1])===2.4);
  path.forEach(([bx,bz],index)=>{
    const dx=bx-ax,dz=bz-az,d=dx*dx+dz*dz;
    for(const [px,pz] of dim.shopPadPositions){
      const x=px-ax,z=pz-az;
      if(!index&&Math.hypot(x,z)<=radius)continue;
      const f=d?Math.max(0,Math.min(1,(x*dx+z*dz)/d)):0;
      assert(Math.hypot(x-dx*f,z-dz*f)>radius,`pad crossing from ${start} through ${ax},${az}`);
    }
    ax=bx;az=bz;
  });
}
console.log('v18 shop buttons: 36 seat/pad combinations, 10,981 routes, same-tick cancel, no outbound purchase, click-to-move and replay.');
