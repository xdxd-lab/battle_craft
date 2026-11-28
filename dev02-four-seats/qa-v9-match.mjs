// Whole-match QA with deterministic mix of all four sides and live collision shapes.
import assert from 'node:assert/strict';
import * as S from './sim.mjs';
import { groundExtents, groundOverlap, createGroundTerrain } from './ground-occupancy.mjs';
const version=Number(process.env.BC_SIM_VERSION || 9);
assert([9,10].includes(version));
const terrain=createGroundTerrain(S.dimFor(version),S.RULES);
for(const seed of [1,3,5,11,17,9345]) {
  const m=S.createSim({version,seed});let peak=0,attacks=0;
  while(m.mode==='play'&&m.tick<40000) {
    const events=S.step(m);attacks+=events.filter(e=>e.type==='shot'||e.type==='launch').length;
    if(m.tick%12) continue;
    peak=Math.max(peak,m.units.length);
    const ground=m.units.filter(u=>groundExtents(u.kind));
    for(let i=0;i<ground.length;i++) {
      const a=ground[i];
      assert(terrain.fits(a.kind,a.x,a.z),`outside: seed ${seed}, tick ${m.tick}, id ${a.id}`);
      for(let j=i+1;j<ground.length;j++)
        assert(!groundOverlap(a,ground[j]),`overlap: seed ${seed}, tick ${m.tick}, ids ${a.id} and ${ground[j].id}`);
    }
  }
  assert.equal(m.mode,'end');assert(attacks>400,'battle must actually engage');
  console.log({version,seed,nominalTick:m.tick,winner:m.winner,peak,attacks});
}
