// Low-poly candidates should remain compatible with the arena's three meshes
// per instanced unit and exact material-group swap between quality tiers.
import assert from 'node:assert/strict';
import { register } from 'node:module';
const three = new URL('../vendor/three.module.js', import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export function resolve(s,c,n){return n(s==='three'?${JSON.stringify(three)}:s,c);}`));
const [{unitModels},{refreshedMaterials},THREE]=await Promise.all([
  import('./unit-models.js'),import('./unit-art-refresh.js'),import(three),
]);
const TESTS={
  guardian:{pick:[.85,1.85],maxHeight:1.50,std:944,high:2152},
  valkyrie:{pick:[.60,1.95],maxHeight:1.05,std:1320,high:2088},
  warbringer:{pick:[.70,1.85],maxHeight:1.55,std:1220,high:1968},
};
for(const [kind,limits] of Object.entries(TESTS)){
  const materials=refreshedMaterials(kind,'#2d73cb');
  assert.equal(materials,refreshedMaterials(kind,'#2d73cb'));
  assert.notEqual(materials.hull.color.getHex(),refreshedMaterials(kind,'#c03f30').hull.color.getHex(),'ownership palettes stay distinct');
  for(const tier of ['std','high']){
    const parts=unitModels[tier][kind]();
    assert.deepEqual(Object.keys(parts),['hull','dark','lamp']);
    assert.deepEqual(Object.keys(materials),Object.keys(parts));
    const bounds=new THREE.Box3();let tris=0,maxDistance=0;
    for(const [part,g] of Object.entries(parts)){
      const {position,normal,uv}=g.attributes;
      assert(!g.index&&position.array.every(Number.isFinite)&&normal.array.every(Number.isFinite));
      assert.equal(position.count,normal.count);assert.equal(position.count,uv.count);
      assert(materials[part].isMaterial&&!materials[part].transparent);
      for(let j=0;j<position.count;j++)maxDistance=Math.max(maxDistance,
        Math.hypot(position.getX(j),position.getY(j)-limits.pick[0],position.getZ(j)));
      g.computeBoundingBox();bounds.union(g.boundingBox);
      tris+=position.count/3;
      g.dispose();
    }
    assert.equal(tris,limits[tier]);
    assert(tris<=2200);
    assert(bounds.max.y<=limits.maxHeight&&bounds.min.y>=0,'model fits its local height');
    assert(maxDistance<=limits.pick[1],`${kind} ${tier} pick radius needs ${maxDistance}`);
    console.log(`${kind} ${tier}: ${tris} tris; pick radius ${maxDistance.toFixed(2)}; model Y ${bounds.max.y.toFixed(2)}`);
  }
}
