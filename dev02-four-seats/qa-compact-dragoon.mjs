import assert from 'node:assert/strict';
import { register } from 'node:module';
const path=new URL('../vendor/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export function resolve(s,c,n){return n(s==='three'?${JSON.stringify(path)}:s,c);}`));
const THREE=await import(path);
const { compactDragoonModels }=await import('./compact-dragoon.js');
const { unitModels }=await import('./unit-models.js');
const { groundExtents, groundOverlap }=await import('./ground-occupancy.mjs');
const bounds=parts=>{
  const box=new THREE.Box3();
  for (const g of Object.values(parts)){ assert.ok(g.attributes.position.array.every(Number.isFinite));g.computeBoundingBox();box.union(g.boundingBox); }
  return box.getSize(new THREE.Vector3());
};
for(const tier of ['std','high']){
  const before=unitModels[tier].dragoon(),after=compactDragoonModels[tier]();
  assert.deepEqual(Object.keys(after),Object.keys(before));
  const a=bounds(before),b=bounds(after);
  assert.ok(b.x>=1.25 && b.x<=1.45 && b.z<=1.50,'reduce main overlap without miniaturizing the unit');
  assert.ok(b.y/a.y>=.87,'preserve approximately original height');
  assert.ok(b.x*b.z/(a.x*a.z)<.4);
  if(tier==='high'){assert.ok(after.hull.attributes.color && after.dark.attributes.color);}
  const feet=new Set(), d=after.dark.attributes.position;
  for(let i=0;i<d.count;i++) if(d.getY(i)<.13 && Math.abs(d.getX(i))>.45)
    feet.add(`${Math.sign(d.getX(i))},${Math.sign(d.getZ(i))}`);
  assert.equal(feet.size,4,'four separately planted foot quadrants');
  console.log(`${tier}: X/Y/Z ${a.toArray().map(v=>v.toFixed(3))} -> ${b.toArray().map(v=>v.toFixed(3))}`);
}
const [l,t,r,b]=groundExtents('dragoon');
assert.ok(Math.abs(l+r-.405)<1e-9 && Math.abs(t+b-.405)<1e-9);
assert.equal(groundOverlap({kind:'dragoon',x:0,z:0},{kind:'dragoon',x:.405,z:0}),false);
