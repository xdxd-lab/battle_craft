// Check geometry/material handoff without browser canvas or runtime statistics.
import assert from 'node:assert/strict';
import { register } from 'node:module';
const three = new URL('../vendor/three.module.js', import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export function resolve(s,c,n){return n(s==='three'?${JSON.stringify(three)}:s,c);}`));
const { refreshedModels, refreshedMaterials } = await import('./unit-art-refresh.js');
const T=await import(three);
const pairings={archon:[2.45,3],hydralisk:[1.95,3],mutalisk:[1.75,3.6]};
for(const [kind,[top,width]] of Object.entries(pairings)){
  const mats=refreshedMaterials(kind), oldColorMats=refreshedMaterials(kind,'#d48c22');
  assert.notEqual(oldColorMats,mats);
  assert.equal(mats,refreshedMaterials(kind));
  const A=refreshedModels.std[kind](), B=refreshedModels.high[kind]();
  assert.deepEqual(Object.keys(A),Object.keys(B),`${kind} part keys stable across tiers`);
  assert.equal(Object.keys(A)[0],'hull');
  const count=(geos) => {
    const bounds=new T.Box3();
    let n=0;
    for(const [part,g] of Object.entries(geos)){
      assert.ok(mats[part.split(':')[0]]?.isMaterial);
      const data=g.attributes.position.array;
      assert.ok(data.every(Number.isFinite));
      assert.ok(g.attributes.normal.array.every(Number.isFinite));
      g.computeBoundingBox();bounds.union(g.boundingBox); n+=(g.index?.count??g.attributes.position.count)/3;
      g.dispose();
    }
    assert.ok(bounds.max.y<=top, `${kind} model top ${bounds.max.y} stays below battle health bar ${top}`);
    assert.ok(bounds.max.x-bounds.min.x<=width,`${kind} model fits original battle scale`);
    return n;
  };
  const std=count(A), high=count(B);
  assert.ok(high>std && std<2400 && high<6500);
  if(kind==='mutalisk')for(const s of ['L','R'])for(const part of ['hull','membrane','bone'])assert.ok(A[`${part}:${s}`]);
  if(kind==='archon'){
    assert.equal(mats.hull.transparent,true);assert.equal(mats.hull.depthWrite,false);
    assert.equal(mats.dark.blending,T.AdditiveBlending);
    assert.equal(mats.lamp.transparent,false);
  }
  console.log(`${kind}: ${std} std / ${high} high triangles`);
}
assert.equal(refreshedMaterials('marine'),null);
