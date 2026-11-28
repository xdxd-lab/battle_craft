import * as THREE from 'three';
import { SEATS } from '../dev05-layout/layout.mjs';
import { towerPosition } from './defense-tower.mjs';

const makeShape=(g,geometry,material,x,y,z)=>{
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(x,y,z);g.add(mesh);return mesh;
};

// Three silhouettes, not just colours: a crystalline ring, spore crown, and
// low hooked roots. Faction palette stays separate from the seat accent.
function variantShapes() {
  const rock=new THREE.MeshStandardMaterial({color:0x452b27,roughness:.87});
  const flesh=new THREE.MeshStandardMaterial({color:0x8f556a,roughness:.62});
  const gold=new THREE.MeshStandardMaterial({color:0xbe975c,metalness:.48,roughness:.37});
  const blue=new THREE.MeshBasicMaterial({color:0xa0ecff,toneMapped:false});
  const lime=new THREE.MeshBasicMaterial({color:0xb6ee83,toneMapped:false});
  const ember=new THREE.MeshBasicMaterial({color:0xf4a090,toneMapped:false});
  const foot=new THREE.CylinderGeometry(.79,.93,.18,9), obelisk=new THREE.OctahedronGeometry(.42);
  const loop=new THREE.TorusGeometry(.44,.075,7,24).rotateX(Math.PI/2);
  const pod=new THREE.SphereGeometry(.33,9,6), trunk=new THREE.CylinderGeometry(.22,.53,1.05,8);
  const fang=new THREE.ConeGeometry(.22,1,8);
  return accent=>{
    const photon=new THREE.Group(),spore=new THREE.Group(),sunken=new THREE.Group();
    for(const g of [photon,spore,sunken])makeShape(g,foot,g===photon?gold:rock,0,.10,0);
    makeShape(photon,trunk,gold,0,.62,0).scale.set(1,.92,1);
    makeShape(photon,loop,accent,0,1.09,0);
    makeShape(photon,obelisk,blue,0,1.49,0).scale.set(.9,1.25,.9);
    makeShape(spore,trunk,flesh,0,.68,0).scale.set(.89,1.08,.89);
    makeShape(spore,pod,lime,0,1.62,0).scale.set(.80,.69,.80);
    makeShape(sunken,pod,flesh,0,.65,0).scale.set(1.7,1.18,1.7);
    makeShape(sunken,fang,ember,0,1.08,0).scale.set(.83,1.18,.83);
    for(let i=0;i<5;i++){
      const angle=i*Math.PI*2/5,x=Math.cos(angle),z=Math.sin(angle);
      makeShape(spore,pod,flesh,x*.42,1.31,z*.42).scale.set(.87,1.25,.87);
      const hook=makeShape(sunken,fang,rock,x*.54,.54,z*.54);
      hook.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP,new THREE.Vector3(x*.6,.8,z*.6));
      makeShape(sunken,pod,accent,x*.55,.26,z*.55).scale.set(.31,.27,.31);
    }
    return {photon,spore,sunken};
  };
}

export function towerModels(dim,{variants=false}={}) {
  const root=new THREE.Group(), by={};
  const lifted=dim.visibleTower;
  const shapes=variants&&variantShapes();
  const base=new THREE.CylinderGeometry(.66,.83,.20,10), mast=new THREE.CylinderGeometry(.36,.54,.66,8);
  const crystal=new THREE.OctahedronGeometry(.38,0), belt=new THREE.TorusGeometry(.48,.055,6,18).rotateX(Math.PI/2);
  const lip=new THREE.TorusGeometry(.7,.055,6,24).rotateX(Math.PI/2);
  const white=new THREE.MeshBasicMaterial({color:0xe9fdff,toneMapped:false});
  const steel=new THREE.MeshStandardMaterial({color:0x687480,metalness:.40,roughness:.57});
  const neutral=new THREE.MeshStandardMaterial({color:0x222a34,metalness:.30,roughness:.72});
  for(const s of SEATS) {
    const g=new THREE.Group();const [x,z]=towerPosition(s.id,dim);g.position.set(x,.08,z);
    const add=(geo,mat,y)=>{const m=new THREE.Mesh(geo,mat);m.position.y=y;g.add(m);return m;};
    const accent=new THREE.MeshBasicMaterial({color:s.primary,toneMapped:false});
    if(shapes){
      const models=shapes(accent);
      g.add(...Object.values(models));g.userData.models=models;
      g.visible=false;by[s.id]=g;root.add(g);continue;
    }
    add(base,neutral,.1);add(mast,steel,.5);add(belt,accent,.64);add(crystal,accent,1.14);
    if(lifted){
      add(lip,white,.20);
      g.children[1].scale.y=1.27;
      g.children[2].position.y=.85;
      g.children[3].position.y=1.46;
      add(crystal,white,1.87).scale.setScalar(.27);
    }
    g.visible=false; by[s.id]=g; root.add(g);
  }
  return {root,by,show(id,kind){
    const models=by[id].userData.models;
    if(!models||by[id].userData.current===kind)return;
    by[id].userData.current=kind;
    for(const [k,m] of Object.entries(models))m.visible=k===kind;
  }};
}
