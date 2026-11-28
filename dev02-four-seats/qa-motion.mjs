// Regression for v6-0's integration only. No tests here for not-yet-enabled collision/fire policies.
import assert from 'node:assert/strict';
import { createSim, digest, replay, step, dimFor, RULES } from './sim.mjs';
import { framesAt, unitStats } from './roster.mjs';
import { MOTION, WORLD_PER_PX, brakingDistance, motionDisplacement } from './motion.mjs';
const close = (a,b) => assert.ok(Math.abs(a-b) < 1e-10,`${a} ≠ ${b}`);
const noMotion = { mx:0,mz:0 };
function fighter(s,seat,kind,x,z,target=null) {
  const u = { id:++s.serial, seat, team:seat==='N'||seat==='W'?1:2, x,z, target, lat:0, foe:0, dx:0,dz:0, cd:0, ...unitStats(kind) };
  s.units.push(u); s.seats[seat].deployed++;
  return u;
}
{
  const expected = { marine:4, dragoon:6, hydralisk:2, archon:160/256, wraith:67/256, mutalisk:67/256, battlecruiser:27/256, scout:48/256, scourge:107/256 };
  for (const [kind, first] of Object.entries(expected)) {
    const u = { kind, seat:'N', dx:1, dz:0 };
    const plan = { mx:100,mz:0 };
    assert.deepEqual(motionDisplacement(u, plan, 0), [0,0]);
    assert.equal(u.motion,undefined);
    close(motionDisplacement(u, plan, 1)[0]/WORLD_PER_PX, first);
    for (let i=0;i<40;i++) motionDisplacement(u,plan,1);
    const prev = u.motion.speed;
    if (!MOTION[kind].stride) {
      close(prev, MOTION[kind].max);
      close(brakingDistance(MOTION[kind],prev),MOTION[kind].halt);
    }
    const firstStop = motionDisplacement(u,noMotion,1);
    if (MOTION[kind].stride) assert.deepEqual(firstStop,[0,0]);
    else close(firstStop[0]/WORLD_PER_PX,prev-MOTION[kind].accel);
    for (let i=0;i<60;i++) motionDisplacement(u,noMotion,1);
    assert.equal(u.motion.speed,0);
  }
}
{
  const u={kind:'scout',seat:'N',dx:1,dz:0};
  for(let i=0;i<40;i++) motionDisplacement(u,{mx:100,mz:0},1);
  const before = u.motion.speed;
  motionDisplacement(u,{mx:-100,mz:0},1);
  close(Math.abs(Math.sin(u.motion.heading)),Math.sin(MOTION.scout.turn));
  close(Math.abs(Math.sin(u.motion.direction)),Math.sin(MOTION.scout.turn*.5));
  motionDisplacement(u,{mx: Math.cos(u.motion.direction)*.05, mz: Math.sin(u.motion.direction)*.05},1);
  assert.ok(u.motion.speed<before,'short final approach starts braking');
}
{
  const s=createSim({version:8,bots:[]});
  const u=fighter(s,'N','marine',0,-10,'S');
  const schedule=[];
  for(let i=1;i<=63;i++) {
    step(s);
    if (framesAt(i)!==framesAt(i-1)) schedule.push(i);
    close(u.z,-10+schedule.length*4*WORLD_PER_PX);
  }
  assert.equal(schedule.length,50);
  assert.equal(dimFor(8).coreDistance>10,true);
}
{
  // Fire on the same opening web tick as before, independently of inertia or facing.
  // Only movement changed; the attack/impact stages and launch id are kept intact.
  for(const version of [7,8]) {
    const s=createSim({version,bots:[]});
    const shooter=fighter(s,'N','scout',0,0);
    const target=fighter(s,'S','battlecruiser',1.2,0); target.cd=1000;
    const launch=step(s).find(e=>e.type==='launch');
    assert.equal(launch?.from,shooter.id); assert.equal(launch?.shot,1);
    assert.equal(s.shots[0].kind,'scout');
    let impact;
    for(let i=0;i<20&&!impact;i++) impact=step(s).find(e=>e.type==='impact');
    assert.equal(impact?.tick,6); assert.equal(impact?.body,22); assert.equal(target.hp,478);
    assert.equal(!!shooter.motion,version===8);
  }
}
{
  // On tick 1 the kinetic clock has not advanced. Existing same-layer formation spacing still acts.
  const s=createSim({version:8,bots:[]});
  const a=fighter(s,'N','dragoon',0,0), b=fighter(s,'N','dragoon',0,0), c=fighter(s,'N','scout',0,0);
  step(s);
  assert.notEqual(a.x,b.x);
  assert.equal(c.x,0); assert.equal(c.z,0);
  assert.equal(a.motion,undefined);
  assert.ok(Math.abs(a.x-b.x)<RULES.spacing);
}
{
  const rec={seed:9345,version:8,commands:[],ticks:2700};
  const a=replay(rec), b=replay(JSON.parse(JSON.stringify(rec)));
  assert.deepEqual([a.marks,a.final,a.events],[b.marks,b.final,b.events]);
  const s=createSim(rec);
  let copy=s;
  for(let i=0;i<2700;i++) { step(copy); if (i%53===0) copy=JSON.parse(JSON.stringify(copy)); }
  assert.equal(digest(copy),a.final);
  assert(a.state.units.some(u=>u.motion));
}
console.log('V6-0 movement: 9 profiles, full source frames, turn/brake/stop, v7/v8 original fire and spacing, deterministic replay');
