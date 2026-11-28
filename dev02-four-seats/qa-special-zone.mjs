// Inactive platform layout and conservative camera fit, without building the browser scene.
import assert from 'node:assert/strict';
import * as L from '../dev05-layout/layout.mjs';
import { ARENA_V8 as DIM, fitArenaCamera, fitNearCamera } from './arena.mjs';
import { SPECIAL_BEACONS, SPECIAL_ZONE as Z, specialZoneFor, specialZoneBounds, fitSpecialZoneCamera } from './special-zone-layout.mjs';

const eq=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const rect=points=>[0,1].map(i=>[Math.min(...points.map(p=>p[i])),Math.max(...points.map(p=>p[i]))]);
const rectOverlap=(a,b)=>a.every(([lo,hi],i)=> lo<b[i][1] && b[i][0]<hi);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const expected={N:[1,0],E:[0,1],S:[-1,0],W:[0,-1]};
assert.deepEqual(SPECIAL_BEACONS.map(b=>b.label),['全場清除','控制單位']);
const zones=L.SEATS.map(s=>specialZoneFor(s.id,DIM));
for(const s of zones) {
  assert.deepEqual(s.clockwise,expected[s.id]);
  const [cx,cz]=L.corePos(s.id,DIM), [sx,sz]=s.center;
  eq(dot([sx-cx,sz-cz],s.radial),Z.outward);
  for (const c of s.corners) {
    const v=[c[0]-cx,c[1]-cz];
    assert.ok(dot(v,s.clockwise)>DIM.corePlatformRadius,'clear the core platform, not just its centre');
    assert.ok(Math.abs(c[0])>DIM.laneWidth/2 && Math.abs(c[1])>DIM.laneWidth/2,'neither shot-lane arm crosses support deck');
  }
  for (const other of L.SEATS) {
    assert.ok(!rectOverlap(rect(s.corners),rect(L.shopCorners(other.id,DIM))),`special ${s.id} vs shop ${other.id}`);
    assert.ok(Math.min(...s.corners.map(c=>Math.hypot(c[0]-L.corePos(other.id,DIM)[0],c[1]-L.corePos(other.id,DIM)[1])))>DIM.corePlatformRadius);
  }
  for (const other of zones) if(other.id!==s.id) assert.ok(!rectOverlap(rect(s.corners),rect(other.corners)));
  const [a,b]=s.ringPositions;
  assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])>2*Z.beaconRadius);
  const world=(x,z)=>[sx+x*Math.cos(s.yaw)+z*Math.sin(s.yaw),sz-x*Math.sin(s.yaw)+z*Math.cos(s.yaw)];
  for(const p of [[.7,.9],[-2,4]]) { const a=world(...p), b=s.world(...p); eq(a[0],b[0]);eq(a[1],b[1]); }
}
const labelPoints=(cam,zone)=>[-1,1].flatMap(a=>[-1,1].map(b=>zone.sign.map((v,j)=>v+a*cam.right[j]*Z.signW/2+b*cam.up[j]*Z.signH/2)));
let cases=0, maxDistanceFactor=1;
for(const [w,h] of [[275,445],[590,233],[950,580],[1130,675]]) {
  const aspect=w/h;
  for(const s of zones) {
    for(const v of [`seat:${s.id}`,`team:${L.seatById(s.id).team}`,'plan']) {
      const angles=L.viewAngles(L.parseView(v));
      for(const overview of [false,true]) {
        const base=overview?fitArenaCamera(angles,aspect):fitNearCamera(angles,aspect,s.id);
        const cam=fitSpecialZoneCamera(base,angles,aspect,DIM,{seat:s.id,overview});
        const visible=overview?zones:[s];
        const pos=visible.flatMap(g=>labelPoints(cam,g));
        const original=overview?L.frameOf(angles,DIM):[[0,0,0],...L.shopCorners(s.id,DIM).flatMap(([x,z])=>[[x,0,z],[x,4.8,z]])];
        const points=[...original,...specialZoneBounds(DIM,overview?null:s.id),...pos];
        for(const p of points) { const [x,y]=L.project(cam,aspect,p); assert.ok(Math.abs(x)<=.971 && Math.abs(y)<=.971,`${v} ${w}x${h} ${x},${y}`); }
        maxDistanceFactor=Math.max(maxDistanceFactor,cam.distance/base.distance);
        cases++;
      }
    }
  }
}
assert.ok(maxDistanceFactor<1.25,'special platform must not substantially zoom out the battle');
console.log(`Special-beacon layout: 4 clockwise decks, 8 inactive positions; ${cases} desktop/phone frusta, largest camera expansion ×${maxDistanceFactor.toFixed(3)}.`);
