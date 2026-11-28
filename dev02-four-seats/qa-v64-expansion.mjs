import assert from 'node:assert/strict';
import {createSim,step,digest,dimFor,padWorld,padsFor,EXPANSION_VERSION} from './sim.mjs';
import {framesAt,KINDS,unitStats} from './roster.mjs';
import {HALO_OFFSETS,HALO_RELEASE_FRAMES,haloHits,SCARAB_BUILD,WARBRINGER_CAPACITY} from './expansion-weapons.mjs';
import {SEATS} from '../dev05-layout/layout.mjs';

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
const a=createSim({version:19,seed:7}),b=createSim({version:19,seed:7});
run(a,2400);run(b,2400);assert.equal(digest(a),digest(b));assert(a.serial>10);
console.log('v6-4: twelve beacons, all seats purchase, Guardian delayed ground-only, eight Halo missiles/air splash, Scarab flight/ground splash/refill, deterministic seeded match.');
