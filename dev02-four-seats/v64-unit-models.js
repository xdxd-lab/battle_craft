// Original v6-4 art. +z faces forward; y=0 is the deck/ground origin.
// Each tier has exactly three material/instance groups; artwork is not a hitbox.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';
import { armor, oct, hex } from './detail-models.js';

const group = parts => {
  const input=parts.map(g=>g.index?g.toNonIndexed():g), joined=mergeGeometries(input);
  for(const geom of new Set([...parts,...input]))geom.dispose();
  return joined;
};
const finish=parts=>Object.fromEntries(Object.entries(parts).map(([k,v])=>[k,group(v)]));
const box=(w,h,d,x,y,z)=>new THREE.BoxGeometry(w,h,d).translate(x,y,z);
const oval=(n,x,y,z,w,h,d)=>new THREE.SphereGeometry(1,n,Math.max(4,Math.ceil(n/2))).scale(w,h,d).translate(x,y,z);
const gem=(x,y,z,w,h,d)=>new THREE.OctahedronGeometry(1).scale(w,h,d).translate(x,y,z);
const nozzle=(n,x,y,z,r,d)=>new THREE.CylinderGeometry(r*.86,r,d,n).rotateX(Math.PI/2).translate(x,y,z);
const ring=(n,x,y,z,r,t)=>new THREE.TorusGeometry(r,t,4,n).translate(x,y,z);
const points=pts=>pts.map(p=>new THREE.Vector3(...p));

// Longitudinal, closed ribbed shells: [z, centerY, halfWidth, halfHeight].
function shell(slices,sides,x=0) {
  const position=[],uv=[],indices=[];
  for(let i=0;i<slices.length;i++){
    const [z,y,w,h]=slices[i];
    for(let j=0;j<=sides;j++){
      const a=j*Math.PI*2/sides, k=i*(sides+1)+j;
      position.push(x+Math.sin(a)*w,y+Math.cos(a)*h,z);
      uv.push(j/sides,i/(slices.length-1));
      if(i&&j){const p=k-sides-1;indices.push(p-1,k,p,p-1,k-1,k);}
    }
  }
  for(let j=1;j<sides-1;j++){const e=(slices.length-1)*(sides+1);indices.push(0,j,j+1,e,e+j+1,e+j);}
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(position,3));
  geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geom.setIndex(indices); geom.computeVertexNormals();
  // UV wrap duplicates a vertex; share its averaged normal so a rounded shell
  // doesn't show an accidental hairline along the dorsal center.
  const ns=geom.attributes.normal, a=new THREE.Vector3(), b=new THREE.Vector3();
  for(let i=0;i<slices.length;i++){
    const j=i*(sides+1);
    a.fromBufferAttribute(ns,j).add(b.fromBufferAttribute(ns,j+sides)).normalize();
    ns.setXYZ(j,a.x,a.y,a.z);ns.setXYZ(j+sides,a.x,a.y,a.z);
  }
  return geom;
}
function hook(control,radii,n,radial) {
  const curve=new THREE.CatmullRomCurve3(points(control));
  const frames=curve.computeFrenetFrames(n,false),position=[],uv=[],indices=[];
  for(let i=0;i<=n;i++){
    const t=i/n, rIdx=Math.min(radii.length-2,Math.floor(t*(radii.length-1)));
    const r=THREE.MathUtils.lerp(radii[rIdx],radii[rIdx+1],t*(radii.length-1)-rIdx),c=curve.getPointAt(t);
    for(let j=0;j<=radial;j++){
      const a=j*Math.PI*2/radial, k=i*(radial+1)+j;
      const v=c.clone().addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r*.72);
      position.push(v.x,v.y,v.z);uv.push(j/radial,t);
      if(i&&j){const p=k-radial-1;indices.push(p-1,p,k,p-1,k,k-1);}
    }
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(position,3));
  geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geom.setIndex(indices); geom.computeVertexNormals(); return geom;
}

// Guardian: a high domed carapace and bowed external limbs convey floating
// crustacean, not another flapping Mutalisk. Low jaws frame the spore chamber.
function guardian(high) {
  const n=high?14:9,h=high?8:5;
  const shellProfile=[[-1.13,.56,.13,.12],[-.92,.73,.55,.34],[-.49,.84,.87,.52],[.06,.84,.95,.6],[.56,.71,.64,.43],[.85,.59,.28,.23],[.98,.52,.15,.12]];
  const hull=[shell(shellProfile,n)];
  const dark=[oval(n,0,.42,-.14,.65,.31,.8),oval(h,0,.42,.83,.35,.19,.34),oval(h,0,.33,1.06,.23,.16,.19)];
  const lamp=[oval(h,0,.31,1.20,.115,.087,.076)];
  for(const s of [-1,1]){
    hull.push(hook([[s*.68,.8,-.63],[s*1.03,.54,-.59],[s*1.13,.42,-.06],[s*.98,.4,.46],[s*.66,.46,.73]],[.21,.20,.13,.045],high?10:6,h));
    dark.push(hook([[s*.50,.46,.53],[s*.69,.28,.84],[s*.53,.18,1.13],[s*.32,.25,1.47]],[.165,.14,.09,.006],high?9:6,h));
    dark.push(hook([[s*.72,.45,-.2],[s*.83,.25,-.1],[s*.69,.12,.22],[s*.42,.16,.36]],[.14,.13,.082,.012],high?9:5,h));
    hull.push(oval(h,s*.23,.61,.86,.18,.13,.16));
    lamp.push(oval(h,s*.26,.615,.982,.075,.053,.045));
    for(const j of high?[3,2,1,4]:[2,3]){
      const [z,y,w,d]=shellProfile[j];
      const ridge=[1.4,.99,.56,.25].map(a=>[s*Math.sin(a)*(w+.012),y+Math.cos(a)*(d+.012),z-.014*Math.sin(a)]);
      dark.push(hook(ridge,[.017,.021,.021,.005],high?7:5,5));
    }
  }
  return finish({hull,dark,lamp});
}

// Valkyrie: broad wing pods, squared armored bow, twin engines and vertical
// bridge. Empty-looking launcher apertures are geometry, not a texture.
function valkyrie(high) {
  const n=high?12:7;
  const hull=[armor(oct,0,.26,.02,.89,1.71,.43,.075),armor(hex,0,.65,-.32,.61,.68,.29,.055)];
  const dark=[armor(oct,0,.15,-.12,.75,1.52,.17,.03), armor(hex,0,.767,.54,.23,.84,.025,.011)];
  const lamp=[box(.43,.078,.05,0,.796,-.063),box(.051,.023,.24,0,.809,.56)];
  for(const s of [-1,1]){
    hull.push(armor(oct,s*.92,.24,.07,.89,1.28,.31,.051), armor(hex,s*.93,.58,-.18,.53,.94,.12,.029));
    dark.push(box(.54,.37,.17,s*.92,.425,1.043),nozzle(n,s*.67,.395,-1.02,.20,.42),nozzle(n,s*1.06,.395,-1.02,.18,.37));
    lamp.push(box(.22,.105,.028,s*.67,.395,-1.232),box(.20,.098,.028,s*1.06,.395,-1.208));
    for(const x of [.783,1.055])for(const y of [.354,.506]){
      dark.push(nozzle(n,s*x,y,1.144,.088,.17));
      lamp.push(ring(n,s*x,y,1.23,.065,.015));
    }
    lamp.push(box(.12,.039,.11,s*1.55,.52,.2));
    if(high){
      hull.push(armor(hex,s*.50,.45,-.84,.30,.66,.12,.035));
      dark.push(box(.2,.061,.43,s*.92,.72,-.24),box(.066,.31,.24,s*1.27,.64,-.55));
      for(const z of [-.41,-.24,-.07])lamp.push(box(.16,.022,.042,s*.92,.757,z));
    }
  }
  return finish({hull,dark,lamp});
}

// Warbringer: asymmetric arched segment train, twin guard vanes, broad golden
// scarab cup and a distinctive elevated crest. Do not model live ammo count here.
function warbringer(high) {
  const n=high?13:8;
  const hull=[], dark=[shell([[-1.54,.27,.36,.20],[-1.20,.31,.66,.28],[-.55,.33,.81,.31],[.28,.31,.79,.285],[1.06,.32,.63,.24],[1.38,.29,.38,.18]],n)], lamp=[];
  for(const [z,w,y,h] of [[-1.20,.51,.63,.39],[-.70,.76,.77,.48],[-.12,.86,.81,.51],[.47,.73,.70,.43],[.97,.54,.55,.32]]){
    hull.push(shell([[z-.31,y-.01,w*.66,h*.73],[z-.15,y,w*.95,h],[z+.095,y-.035,w,h*.95],[z+.23,y-.15,w*.79,h*.70]],n));
    for(const s of [-1,1]){
      dark.push(armor(hex,s*w*.83,.28,z,.27,.37,.17,.029));
      lamp.push(gem(s*w*.91,.49,z+.05,.047,.036,.086));
      if(high)hull.push(shell([[z-.26,.70,w*.14,.12],[z-.11,.79,w*.24,.13],[z+.22,.64,w*.22,.081]],6,s*w*.71));
    }
  }
  const fin=[[0,-.55],[.34,-.38],[.53,.34],[.30,.69],[.03,.40],[-.18,-.28]];
  for(const s of [-1,1]){
    const shape=s===1?fin:fin.map(([x,z])=>[-x,z]).reverse();
    hull.push(armor(shape,s*.38,.34,1.12,.63,.70,.23,.045));
    dark.push(box(.11,.13,.88,s*.53,.15,.49));
  }
  hull.push(armor(hex,0,1.19,-.20,.43,.59,.11,.05));
  dark.push(nozzle(n,0,.45,1.38,.23,.19));
  lamp.push(gem(0,1.34,-.145,.122,.155,.205),ring(n,0,.45,1.479,.148,.032),oval(n,0,.45,1.478,.115,.119,.041));
  return finish({hull,dark,lamp});
}

export const v64UnitModels={
  std:{guardian:()=>guardian(false),valkyrie:()=>valkyrie(false),warbringer:()=>warbringer(false)},
  high:{guardian:()=>guardian(true),valkyrie:()=>valkyrie(true),warbringer:()=>warbringer(true)},
};

const palette = {
  guardian: { hull:[0xa57157,.31], dark:[0x442831,.14], lamp:[0xffb253,.13], roughness:.67, metalness:.02 },
  valkyrie: { hull:[0x9cbbc4,.56], dark:[0x202d3e,.12], lamp:[0xd0f7ff,.38], roughness:.49, metalness:.44 },
  warbringer: { hull:[0xe4b35e,.26], dark:[0x374153,.20], lamp:[0x93ffe3,.42], roughness:.42, metalness:.37 },
};
const materials = new Map();
export function v64UnitMaterials(kind,teamColor='#2d73cb') {
  const p=palette[kind]; if(!p)return null;
  const key=kind+':'+teamColor;
  if(!materials.has(key)){
    const team=new THREE.Color(teamColor), blend=([tone,f])=>new THREE.Color(tone).lerp(team,f);
    const surface=name=>new THREE.MeshStandardMaterial({color:blend(p[name]),roughness:p.roughness,metalness:p.metalness});
    materials.set(key,{hull:surface('hull'),dark:surface('dark'),lamp:new THREE.MeshBasicMaterial({color:blend(p.lamp),toneMapped:false})});
  }
  return materials.get(key);
}
