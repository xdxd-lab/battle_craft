import * as THREE from 'three';
import { SEATS } from '../dev05-layout/layout.mjs';
import { towerPosition } from './defense-tower.mjs';

export function towerModels(dim) {
  const root=new THREE.Group(), by={};
  const base=new THREE.CylinderGeometry(.66,.83,.20,10), mast=new THREE.CylinderGeometry(.36,.54,.66,8);
  const crystal=new THREE.OctahedronGeometry(.38,0), belt=new THREE.TorusGeometry(.48,.055,6,18).rotateX(Math.PI/2);
  const steel=new THREE.MeshStandardMaterial({color:0x687480,metalness:.40,roughness:.57});
  const neutral=new THREE.MeshStandardMaterial({color:0x222a34,metalness:.30,roughness:.72});
  for(const s of SEATS) {
    const g=new THREE.Group();const [x,z]=towerPosition(s.id,dim);g.position.set(x,.08,z);
    const add=(geo,mat,y)=>{const m=new THREE.Mesh(geo,mat);m.position.y=y;g.add(m);return m;};
    const accent=new THREE.MeshBasicMaterial({color:s.primary,toneMapped:false});
    add(base,neutral,.1);add(mast,steel,.5);add(belt,accent,.64);add(crystal,accent,1.14);
    g.visible=false; by[s.id]=g; root.add(g);
  }
  return {root,by};
}
