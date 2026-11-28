import assert from 'node:assert/strict';
import {createSim,step,digest,dimFor,padWorld,padsFor,EXPANSION_VERSION,LONG_SHOP_VERSION,toLocal,toWorld,padRadiusFor} from './sim.mjs';
import {framesAt,KINDS,unitStats} from './roster.mjs';
import {HALO_OFFSETS,HALO_RELEASE_FRAMES,haloHits,SCARAB_BUILD,WARBRINGER_CAPACITY} from './expansion-weapons.mjs';
import {fitArenaCamera,fitNearCamera} from './arena.mjs';
import {SEATS,viewAngles,parseView,shopCorners,FOV} from '../dev05-layout/layout.mjs';

const make=()=>createSim({version:EXPANSION_VERSION,seed:898,bots:[]});
function unit(st,seat,kind,x,z,extra={}){
 const u={...unitStats(kind),id:++st.serial,seat,team:SEATS.find(q=>q.id===seat).team,x,z,cd:10000,
  target:null,foe:0,dx:seat==='N'?1:-1,dz:0,lat:0,...extra};
 st.units.push(u);return u;
}
const run=(st,n)=>Array.from({length:n},()=>step(st)).flat();
assert.equal(padsFor(18).length,9);
assert.equal(padsFor(19).length,12);
for(const seat of SEATS.map(s=>s.id)) for(let i=9;i<12;i++){
 const st=make(); st.seats[seat].gold=10000;
 const [x,z]=padWorld(seat,i,dimFor(19)); Object.assign(st.seats[seat].commander,{x,z});
 const [buy]=step(st).filter(e=>e.type==='buy');
 assert.equal(buy.kind,padsFor(19)[i].kind);
 if(i===11)assert.equal(st.units[0].scarabs,WARBRINGER_CAPACITY);
}

{
 const st=make(), g=unit(st,'N','guardian',-1.7,0,{cd:0}), a=unit(st,'S','mutalisk',-.2,0),
   m=unit(st,'S','marine',1.7,0,{hp:1000});
 const e=run(st,65), launch=e.find(x=>x.type==='launch'), impact=e.find(x=>x.type==='impact');
 assert(impact.tick>launch.tick); assert.equal(impact.target,m.id); assert.equal(a.hp,KINDS.mutalisk.hp);
 assert.equal(impact.body,20); assert.equal(g.kind,'guardian');
}
{
 const st=make(), v=unit(st,'N','valkyrie',-1,0,{cd:0}),
   a=unit(st,'S','battlecruiser',1.1,0,{hp:1000}), neighbor=unit(st,'S','battlecruiser',1.1,.56,{hp:1000}),
   m=unit(st,'S','marine',1.05,-.35,{hp:1000});
 while(!st.shots.length && st.tick<50)step(st);
 const salvo=st.shots.filter(q=>q.kind==='valkyrie');
 assert.equal(salvo.length,8);
 assert.deepEqual(salvo.map(q=>q.releaseFrame-salvo[0].releaseFrame),HALO_RELEASE_FRAMES);
 assert.equal(HALO_OFFSETS.length,14);
 assert(salvo.every(q=>q.target===a.id));
 v.cd=10000;
 const after=run(st,125);
 assert(a.hp<1000&&neighbor.hp<1000&&m.hp===1000);
 assert.equal(after.filter(e=>e.type==='impact'&&e.kind==='valkyrie').length,8);
 assert(after.filter(e=>e.type==='impact').every(e=>Number.isFinite(e.x)&&Number.isFinite(e.z)));
}
{
 const st=make(), w=unit(st,'N','warbringer',-1.4,0,{cd:0}), a=unit(st,'S','marine',.7,0,{hp:10000}),
   n=unit(st,'S','marine',.7,.42,{hp:10000}), air=unit(st,'S','mutalisk',.7,0);
 while(w.scarabs!==9 && st.tick<60)step(st);
 assert.equal(w.scarabs,9); assert.equal(a.hp,10000); assert(st.shots.some(s=>s.specialFlight==='scarab'));
 const f=framesAt(st.tick); assert.equal(w.scarabDue,f+SCARAB_BUILD);
 const e=run(st,71);
 assert(e.some(q=>q.type==='impact'&&q.kind==='warbringer')); assert(a.hp<10000&&n.hp<10000);
 assert.equal(air.hp,KINDS.mutalisk.hp); assert.equal(w.scarabs,9);
 run(st,2050); assert(w.scarabs<10);
 st.units=[w]; run(st,1550); assert.equal(w.scarabs,10); assert.equal(w.scarabDue,null);
}
{
 const st=make(),v=unit(st,'N','valkyrie',-.25,0,{cd:0}),a=unit(st,'S','battlecruiser',.25,0,{hp:5000});
 while(!st.shots.length&&st.tick<50)step(st);
 v.cd=10000;
 const impacts=run(st,125).filter(q=>q.kind==='valkyrie'&&(q.type==='impact'||q.type==='fizzle'));
 assert.equal(impacts.length,8,'point-blank rockets do not orbit the landing point');
 assert(a.hp<5000);
}
assert.deepEqual(haloHits({target:1,id:22},[{unit:{id:1},gap:4},{unit:{id:2},gap:51}],26).map(h=>[h.unit.id,h.divisor]),[[1,1],[2,4]]);

const d18=dimFor(18),d19=dimFor(19),d20=dimFor(LONG_SHOP_VERSION);
assert.equal(d20.shopDepth,19.8);assert.equal(d20.shopWidth,d18.shopWidth);
assert.equal(d20.shopTangent,d18.shopTangent);assert.equal(d19.shopDepth,15);
assert(Math.abs((d20.shopRadial-d20.shopDepth/2)-(d18.shopRadial-d18.shopDepth/2))<1e-8);
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const inside = (fit,x,y,z,aspect)=>{
 const p=[x,y,z].map((v,i)=>v-fit.position[i]);
 const t=dot(p,fit.forward)*Math.tan(FOV*Math.PI/360);
 return Math.abs(dot(p,fit.right))<=t*aspect && Math.abs(dot(p,fit.up))<=t;
};
for(const {id:seat} of SEATS){
 for(let i=0;i<9;i++)assert.deepEqual(padWorld(seat,i,d20).map(x=>Math.round(x*100)),padWorld(seat,i,d18).map(x=>Math.round(x*100)));
 for(const aspect of [390/844,844/390,1280/800]){
  const angle=viewAngles(parseView('seat:'+seat));
  const overview=fitArenaCamera(angle,aspect,d20),near=fitNearCamera(angle,aspect,seat,{includeCore:true,dim:d20});
  assert(shopCorners(seat,d20).every(([x,z])=>inside(near,x,4,z,aspect)));
  assert(SEATS.every(({id})=>shopCorners(id,d20).every(([x,z])=>inside(overview,x,4,z,aspect))));
 }
 for(let i=9;i<12;i++){
  const st=createSim({version:LONG_SHOP_VERSION,bots:[]}),own=st.seats[seat];
  own.gold=2000;
  const command={seat,type:'shop',index:i}, events=[...step(st,[command])];
  for(let t=0;t<110&&!events.some(e=>e.type==='buy');t++)events.push(...step(st));
  assert.deepEqual(events.filter(e=>e.type==='buy').map(e=>e.kind),[padsFor(LONG_SHOP_VERSION)[i].kind]);
  step(st,[command]);assert.equal(own.shopChoice,-1);
  assert(!run(st,80).some(e=>e.type==='buy'));
  const [x,z]=toLocal(seat,own.commander.x,own.commander.z,d20);
  assert(d20.shopPadPositions.every(([a,b])=>Math.hypot(x-a,z-b)>padRadiusFor(LONG_SHOP_VERSION)));
  const edge=toWorld(seat,1.5,-9,d20);step(st,[{seat,type:'goal',x:edge[0],z:edge[1]}]);run(st,50);
  assert(Math.hypot(own.commander.x-edge[0],own.commander.z-edge[1])<1e-8);
 }
}
assert.equal(KINDS.valkyrie.attack,'E');
for(const [armor,damage] of [['light',3],['medium',4.5],['heavy',6]]){
 const st=createSim({version:LONG_SHOP_VERSION,bots:[]});
 const v=unit(st,'N','valkyrie',-1,0,{cd:0});
 unit(st,'S','mutalisk',1.1,0,{hp:1000,armor});
 while(!st.shots.length&&st.tick<50)step(st);
 const first=st.shots[0].id;v.cd=10000;
 assert.equal(run(st,125).find(e=>e.type==='impact'&&e.shot===first)?.body,damage);
}
console.log('v20: same nine coordinates, extended axial deck, 12 exact player purchases/cancellations, touch destination geometry, 3 camera aspects, and 50/75/100% Halo damage.');

const a=createSim({version:19,seed:7}),b=createSim({version:19,seed:7});
run(a,2400);run(b,2400);assert.equal(digest(a),digest(b));assert(a.serial>10);
console.log('v6-4: twelve beacons, all seats purchase, Guardian delayed ground-only, eight Halo missiles/air splash, Scarab flight/ground splash/refill, deterministic seeded match.');
