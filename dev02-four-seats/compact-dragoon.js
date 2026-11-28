// Optional Dragoon art for the dense-arena preview. It does not define HP, range,
// movement clearance, or collision size. Front is +z, and all four legs stay visible.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';
import { armor, edged, hex, oct } from './detail-models.js';

const group = list => mergeGeometries(list.map(g => {
  if (!g.index) return g; const mesh=g.toNonIndexed();g.dispose();return mesh;
}));
const box=(w,h,d,x,y,z,ry=0) => new THREE.BoxGeometry(w,h,d).rotateY(ry).translate(x,y,z);
const tube=(r1,r2,h,n,x,y,z) => new THREE.CylinderGeometry(r1,r2,h,n).translate(x,y,z);
const up=new THREE.Vector3(0,1,0);
function link(from,to,r1,r2,sides) {
  const p=new THREE.Vector3(...from), q=new THREE.Vector3(...to), dir=q.clone().sub(p);
  const rot=new THREE.Quaternion().setFromUnitVectors(up,dir.clone().normalize());
  return new THREE.CylinderGeometry(r2,r1,dir.length(),sides).applyQuaternion(rot).translate(...p.add(q).multiplyScalar(.5).toArray());
}
function make(high) {
  const hull = high ?
    [armor(oct,0,.94,-.03,.54,.75,.43,.047),armor(hex,0,1.42,-.13,.57,.59,.17,.038)] :
    [tube(.43,.56,.53,8,0,1.17,-.055),tube(.34,.40,.15,8,0,1.48,-.12)];
  const dark=[box(.34,.18,.55,0,1.08,.49),box(.43,.18,.53,0,1.0,-.04)];
  const lamp=[new THREE.IcosahedronGeometry(high?.158:.137,high?1:0).translate(0,1.087,.69)];
  if(high){
    hull.push(armor(hex,0,.98,.56,.39,.36,.135,.021));
    lamp.push(box(.36,.045,.074,0,1.555,.055));
  }
  for(const s of [-1,1]) for(const f of [-1,1]) {
    const hip=[s*.28,1.04,f*.26], knee=[s*.47,.71,f*.39], toe=[s*.57,.105,f*.466];
    dark.push(link(hip,knee,.086,.078,high?7:5),link(knee,toe,.067,.092,high?7:5));
    hull.push(high ? armor(hex,s*.476,.59,f*.392,.24,.33,.14,.023)
      : box(.20,.18,.22,s*.478,.689,f*.396,s*f*.14));
    dark.push(box(.167,.13,.252,toe[0],.065,toe[2],s*f*.10));
    if(high){
      hull.push(tube(.09,.075,.09,8,s*.53,.282,f*.462));
      lamp.push(box(.072,.032,.04,s*.475,.64,f*.44));
    }
  }
  const shape={hull:group(hull),dark:group(dark),lamp:group(lamp)};
  if(high){edged(shape.hull);edged(shape.dark);}
  return shape;
}
export const compactDragoonModels={ std:()=>make(false),high:()=>make(true) };
