// Golden C++ fixture: research/tools/openbw-weapon-box-probe.cpp at OpenBW 4b046d5.
// No DAT, game or external dependencies required for routine regression runs.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as S from './sim.mjs';
import {WORLD_PER_PX as PX} from './motion.mjs';
import {unitStats, canTarget, KINDS} from './roster.mjs';
import {DAT_EXTENTS, UNIFIED_ATTACK_RANGE_FROM as V, weaponBoxPx, weaponGapPx, pointWeaponGapPx, reachPx, scanWeaponTargets} from './combat-reach.mjs';
import {shockwaveRing} from './weapon-delivery.mjs';
import {airDisperse} from './air-spacing.mjs';
const roster=[['marine',0],['dragoon',66],['mutalisk',43],['hydralisk',38],['archon',68],['wraith',8],['battlecruiser',12],['scout',70],['scourge',47]];
assert.equal(V,17); assert.equal(S.VERSION,10);
assert.equal(S.dimFor(V),S.dimFor(16)); assert.equal(S.economyFor(V),S.economyFor(16)); assert.deepEqual(S.padsFor(V),S.padsFor(16));
const source=createHash('sha256');
for (const [from,i] of roster) for(const [to,j] of roster) {
  for(const x of [-239,-129,-67,0,43,128,244]) for (const z of [-143,-38,0,57,171]) {
    const a=weaponBoxPx(from,0,0), b=weaponBoxPx(to,x*PX,z*PX), gap=weaponGapPx(a,b);
    source.update([i,j,x,z,gap].join(',')+'\n');
    assert.equal(weaponGapPx(b,a),gap);
  }
}
assert.equal(source.digest('hex'),'00470e9db09fb7e8948e11911e46c03593eef58d3ce9aa8920fd6d73478b16d9');
assert.deepEqual(weaponBoxPx('battlecruiser',0,0),{l:-37,t:-29,r:38,b:30});
assert.deepEqual(weaponBoxPx('dragoon',0,0),{l:-15,t:-15,r:17,b:17});
assert.equal(reachPx('dragoon',true),253); // 3.204 web < 254 source pixels.
assert.equal(reachPx('scourge',true),3);
const fake=(kind,seat,id,x,z)=>({kind,id,seat,team:seat==='N'?'A':'B',x,z,cd:100000,target:null,lat:0,foe:0,dx:1,dz:0,...unitStats(kind)});
const scan=(a,units,lock=null)=>scanWeaponTargets(a,units,new Map(units.map(u=>[u.id,weaponBoxPx(u.kind,u.x,u.z)])),395,lock);
// BC vs Marine at the same center (3.700 apart): only the large hull is in reach.
const dragon=fake('dragoon','N',1,0,0),big=fake('battlecruiser','S',2,3.7,0),small=fake('marine','S',3,3.7,0);
assert.equal(weaponGapPx(weaponBoxPx('dragoon',0,0),weaponBoxPx('battlecruiser',3.7,0)),238);
assert.equal(weaponGapPx(weaponBoxPx('dragoon',0,0),weaponBoxPx('marine',3.7,0)),267);
assert.equal(scan(dragon,[dragon,small,big],small).foe,big);
const friendly={...big,team:'A'};assert.equal(scan(dragon,[dragon,small,friendly],friendly).inReach,false);
// Pin a stationary lab fixture to the exact threshold, then one source pixel
// outside. Actual S.step runs target selection, wind-up, launch and damage.
function releasesAt(shooter,target,gap) {
  const s=S.createSim({version:V,bots:[]});
  const u=fake(shooter,'N',++s.serial,0,0), x=(DAT_EXTENTS[shooter][2]+1+DAT_EXTENTS[target][0]+gap)*PX;
  const t=fake(target,'S',++s.serial,x,0);
  u.cd=0; s.units.push(u,t);
  for(let i=0;i<22;i++) {
    u.x=0;u.z=0;t.x=x;t.z=0;
    const events=S.step(s);
    if(events.some(e=>(e.type==='launch'||e.type==='shot') && e.from===u.id))return true;
  }
  return false;
}
let released=0, forbidden=0;
for(const [kind] of roster) for(const [type] of roster){
  const air=KINDS[type].air, allowed=canTarget(KINDS[kind],air), px=reachPx(kind,air);
  if(allowed){
    assert(releasesAt(kind,type,px),kind+' → '+type+' fails exactly at threshold '+px);
    assert(!releasesAt(kind,type,px+1),kind+' → '+type+' out-of-range release');
    released++;
  } else { assert(!releasesAt(kind,type,0),kind+' illegal target '+type); forbidden++; }
}
// Scourge fails on ground even in contact. A running air unit at the outer
// edge of lock may drift tangentially but must never jump a whole hull width.
const fly=fake('scout','N',7,0,0), hull=fake('battlecruiser','S',8,(18+37+128)*PX,0);
const p={hit:hull,hitRange:S.effectiveWeaponRange(V,'scout',true),sx:0,sz:0,weaponBoxRange:weaponBoxPx(hull.kind,hull.x,hull.z)};
assert.deepEqual(airDisperse(fly,p,1,1),[0,0]);
p.sx=-1; p.sz=1;
const drift=airDisperse(fly,p,1,2);
assert(Math.hypot(...drift)<.022);
assert(weaponGapPx(weaponBoxPx(fly.kind,fly.x+drift[0],fly.z+drift[1]),p.weaponBoxRange)<=128);
// Splash point-to-box uses the same integer length, not distance between
// centers or distance to an enlarged movement footprint.
assert.equal(pointWeaponGapPx(weaponBoxPx('marine',0,0),12*PX,0),3);
assert.equal(shockwaveRing(small,small.x+12*PX,small.z,V),0);
assert.equal(shockwaveRing(small,small.x+13*PX,small.z,V),1);
const original=['7c6ef0b5b876fd0b8ef6e41629084600656f7f67e66d027839fdf9b559b8e8df','1c6cf21c5e8b17d50c616f5d0b6fb3b3d596e55e37e4b6e2a0acdac7415ec193','a76422898524409effb44f98d2a3b79a2d3ae42c12fe2f39c7d1d536c836ee11','57eb7bee6aa35066101447eb8f1895734697c85a272b9901db8b668e5aa46e4d','f6e467402936df4f99f65adb2743ce3aa929f35a5c1f0459a71e2703ceed37fc','04eb7ae6c141c3d622ea0d2d0b248e06d9d553d97e11169eb9614b9607d19c69','511e23c06e9d8c002bc3ccc61ac6104b8e3143fb48ce945b97f150889e1139aa','7bc0746bda7309530f7b3999c1e28fac2bab11f6d766dc0afa5667aee115037f','4e22cd61e5e88b3f64ef74a5aee539d0594769887b4d1f1dee6e47f811f46435','12ba294842420b242ed6a21dae5c4bcd9a938306b50f39384edc12511c012800','1f7e9d020dbc1a60e288b544fda1d1e4d0376ea4398f9f1e4707fa878ddaaf18','e11181e8497afb007afaeaa5232c6511517a2fe2ebd2d4637cbcecfb7f7b9db6','ad9c0ad6ab388b4368de8b680a2dd262f444f78fdc71c2ba4e06af023e4668b4','0f59aac7de550957b4359762519799f362f834162969f5d38af64ee98240d2e7','fdf6b7d4d717acd11f674a9522f44bdb35704fa5feb68b92295c7e4bdf38bd5b','c7ce63cee8c0e05d69e6ad500421a8000d2b4cedb302d14df8385dd370b5998c'];
// Fixed hash of the complete event stream including transient fx + final state
// taken from the sim16 branch before any geometry implementation.
for(let v=1;v<=16;v++) {
  const s=S.createSim({version:v,seed:174231});
  const h=createHash('sha256');
  for(let i=0;i<700;i++)h.update(JSON.stringify(S.step(s)));
  h.update(JSON.stringify(s));assert.equal(h.digest('hex'),original[v-1],'historical version '+v);
}
console.log('v17: 2,835 OpenBW unit-distance samples; '+released+' legal weapon pairs at / one pixel outside range; '+forbidden+' forbidden pairs. v1–16 replay hashes preserved.');
