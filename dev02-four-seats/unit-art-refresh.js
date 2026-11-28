// Optional art direction for three fighters. Independent of the roster, sim and hit shapes.
// Procedural original meshes: +z faces forward, and paired wings keep the existing hinge.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';
import { WING_HINGE } from './unit-models.js';
import { v64UnitMaterials } from './v64-unit-models.js';

const vec = v => new THREE.Vector3(...v);
const group = geos => mergeGeometries(geos.map(g => {
  if (!g.index) return g;
  const mesh = g.toNonIndexed(); g.dispose(); return mesh;
}));
const egg = (n, x,y,z, sx,sy,sz, rz=0, rx=0) => new THREE.SphereGeometry(1,n,Math.max(4,Math.round(n*.62)))
  .scale(sx,sy,sz).rotateZ(rz).rotateX(rx).translate(x,y,z);
const tube = (pts,n,r,radial) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(vec)),n,r,radial);
const spark = (x,y,z,s=.04) => new THREE.OctahedronGeometry(s).scale(.66,1.5,.7).translate(x,y,z);

function tapered(points,radii,n,sides) {
  const curve = new THREE.CatmullRomCurve3(points.map(vec)), frames=curve.computeFrenetFrames(n,false);
  const position=[],uv=[],indices=[];
  for(let i=0;i<=n;i++){
    const t=i/n,k=Math.min(radii.length-2,Math.floor(t*(radii.length-1))), f=t*(radii.length-1)-k;
    const center=curve.getPointAt(t),r=THREE.MathUtils.lerp(radii[k],radii[k+1],f);
    for(let j=0;j<=sides;j++){
      const a=j/sides*Math.PI*2;
      const p=center.clone().addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r);
      position.push(p.x,p.y,p.z);uv.push(j/sides,t);
      if(i>0&&j>0){const q=i*(sides+1)+j;indices.push(q,q-1,q-sides-2,q-sides-2,q-sides-1,q);}
    }
  }
  const mesh=new THREE.BufferGeometry();
  mesh.setAttribute('position',new THREE.Float32BufferAttribute(position,3));mesh.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));mesh.setIndex(indices);
  mesh.computeVertexNormals(); return mesh;
}
const profiles = (high) => ({ n:high?12:8, rad:high?7:5, small:high?8:6 });
const finish = parts => Object.fromEntries(Object.entries(parts).map(([k,v]) => [k,group(v)]));

function archon(high){
  const {n,small,rad}=profiles(high), tubeN=high?15:9;
  // Low opacity broad aura plus denser humanoid charge, rather than a metal cage.
  const hull=[egg(n,0,1.17,-.05,1.08,1.01,.64),
    egg(n,0,.76,.03,.69,.62,.47,0,.22)];
  const dark=[egg(n,0,1.14,0,.44,.61,.29,0,-.21),egg(n,0,1.72,.12,.255,.315,.205),
    tapered([[0,1.29,-.03],[0,.87,-.03],[-.14,.50,-.14],[.05,.14,.02]],[.35,.31,.18,.006],tubeN,rad)];
  const lamp=[egg(small,0,1.17,.237,.145,.235,.083,0,-.17)];
  const team=[];
  for(const s of [-1,1]){
    dark.push(egg(n,s*.36,1.45,-.018,.25,.232,.26,-s*.31),egg(n,s*.77,.96,.16,.16,.223,.13,s*.68));
    dark.push(tapered([[s*.35,1.51,-.04],[s*.55,1.31,.01],[s*.68,1.00,.09],[s*.77,.94,.26]],[.245,.2,.128,.055],tubeN,rad));
    lamp.push(egg(small,s*.088,1.73,.307,.043,.026,.018,s*.11),spark(s*.772,1.012,.291,.083));
    const paths=[
      [[s*.22,1.83,.21],[s*.36,1.61,.24],[s*.315,1.32,.255],[s*.18,1.06,.27]],
      [[s*.72,.89,.29],[s*.56,.84,.32],[s*.39,.67,.24],[s*.27,.45,.18]],
    ];
    if(high) paths.push([[s*.64,.61,.28],[s*.48,.53,.31],[s*.37,.43,.21],[s*.26,.27,.17]]);
    for(const p of paths) lamp.push(tube(p,high?9:6,.013,rad));
    team.push(tube([[s*.63,1.10,.207],[s*.692,1.08,.308],[s*.733,.99,.325]],high?8:5,.036,rad));
  }
  if(high){
    for(const [x,y,z,k] of [[.86,1.20,-.12,.042],[-.81,.63,.27,.04],[.12,2.14,-.12,.052],[-.18,.26,.22,.039],[.54,.38,.18,.038]])
      lamp.push(spark(x,y,z,k));
  }
  return finish({hull,dark,lamp,team});
}

function hydralisk(high){
  const {n,small,rad}=profiles(high), path=high?18:12;
  const hull=[
    tapered([[.6,.13,-1.19],[.39,.14,-1.04],[.08,.22,-.81],[-.12,.29,-.45],[0,.39,-.20],[0,.78,.02],[0,1.22,.22]],
      [.009,.13,.23,.32,.39,.35,.24],path,rad),
    egg(n,0,.9,.07,.398,.51,.33,0,.22),
    egg(n,0,1.34,.31,.299,.33,.39,0,.25),egg(n,0,1.49,.33,.412,.31,.353,0,.11),
    egg(n,0,1.42,.61,.21,.16,.23),
  ];
  const dark=[
    egg(n,0,.91,.30,.25,.43,.145,0,.22),
    egg(small,0,1.296,.63,.24,.11,.25),egg(n,0,1.51,.61,.22,.11,.27),
  ];
  const lamp=[],bone=[];
  for(const s of [-1,1]){
    // Shoulder blade and hooked forelimb, with a distinct upper and lower curve.
    hull.push(egg(n,s*.27,1.28,.20,.235,.223,.264,-s*.36),
      tapered([[s*.22,1.40,.28],[s*.375,1.55,.14],[s*.466,1.72,-.11],[s*.40,1.76,-.29]],
        [.18,.158,.096,.004],path,rad));
    dark.push(tapered([[s*.31,1.28,.26],[s*.57,1.09,.47],[s*.65,.96,.63],[s*.55,.88,.80]],[.14,.105,.084,.035],path,rad));
    bone.push(tapered([[s*.65,.96,.63],[s*.63,.88,.84],[s*.50,.93,1.015],[s*.36,1.18,1.14]],[.078,.068,.04,.002],path,rad));
    bone.push(tapered([[s*.38,1.48,.19],[s*.53,1.62,.095],[s*.54,1.72,-.097]],[.077,.046,.002],high?10:6,rad));
    dark.push(egg(small,s*.183,1.47,.625,.100,.055,.124,s*.26));
    lamp.push(egg(small,s*.211,1.471,.698,.059,.020,.059,s*.30));
    for(let i=0;i<(high?3:2);i++) bone.push(tapered(
      [[s*(.125+i*.03),1.33,.79-i*.05],[s*(.13+i*.031),1.261,.81-i*.05]],[.026,.002],high?6:4,rad));
  }
  const crest=[[.28,.28,-.92],[.04,.43,-.68],[-.07,.49,-.42],[0,.75,-.26],[0,1.02,-.14],[0,1.23,-.01],[0,1.58,.05]];
  for(let i=0;i<crest.length;i++){
    if(!high&&i%2===0&&i!==6)continue;
    const [x,y,z]=crest[i], w=.14+i*.009;
    hull.push(egg(small,x,y,z,w,.11,.15,0,-.3));
    bone.push(tapered([[x,y+.035,z],[x,y+.13,z-.085],[x,y+.12+(i/7)*.07,z-.24]],[w*.37,.044,.003],high?9:6,rad));
  }
  for(let i=0;i<(high?4:2);i++){
    const j=high?i:i*2;
    hull.push(egg(small,0,.65+j*.12,.358+j*.015,.246-j*.017,.047,.089,0,.18));
  }
  return finish({hull,dark,lamp,bone});
}

// Deliberately sculpt the web on a cambered surface; no flat jet-wing rectangles.
function wingPoint(s,u,t) {
  const [wingX,wingY]=WING_HINGE;
  const sweep = .40 - 1.10*u + .05*Math.sin(Math.PI*u);
  const rootToRim=.81*(1-u)**.67;
  const arc=Math.sin(Math.PI*u);
  const scallop=.085*Math.pow(Math.sin((u*2.7+.09)*Math.PI),2)*arc*t*t;
  return [s*(wingX+1.50*u + .045*Math.sin(Math.PI*t)*arc), wingY+.145*Math.sin(Math.PI*u/2)+.15*Math.sin(Math.PI*t)*arc-.09*t*arc,
    sweep-rootToRim*t+scallop];
}
function membrane(s,high) {
  const X=high?15:9,Y=high?7:4, positions=[],uv=[],faces=[];
  for(let i=0;i<=X;i++)for(let j=0;j<=Y;j++){
    const u=i/X,t=j/Y;
    positions.push(...wingPoint(s,u,t));uv.push(u,t);
    if(i&&j){
      const c=i*(Y+1)+j,l=c-1,k=c-Y-1,b=k-1;
      faces.push(...(s>0?[c,l,b,b,k,c]:[c,b,l,b,c,k]));
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(faces);g.computeVertexNormals();return g;
}
function mutalisk(high){
  const {n,small,rad}=profiles(high),path=high?15:9, out={
    hull:[egg(n,0,.53,-.23,.319,.255,.57,0,.11),egg(n,0,.56,.26,.329,.249,.37),
      egg(n,0,.63,.61,.225,.179,.248),egg(n,0,.63,.80,.153,.117,.155)],
    dark:[egg(n,0,.40,.23,.258,.122,.48),tapered([[0,.51,-.44],[.028,.45,-.74],[.07,.32,-1.00],[.021,.37,-1.29],[-.105,.49,-1.39]],[.192,.143,.105,.059,.004],path,rad)],
    lamp:[],bone:[],
  };
  for(const s of [-1,1]){
    out.dark.push(egg(small,s*.163,.666,.745,.10,.076,.141,s*.08));
    out.lamp.push(egg(small,s*.186,.686,.808,.052,.038,.061,s*.2));
    out.bone.push(tapered([[s*.14,.579,.84],[s*.185,.56,.994],[s*.115,.523,1.14]],[.066,.047,.002],high?11:7,rad));
    out.bone.push(tapered([[s*.16,.716,.511],[s*.168,.807,.468],[s*.16,.805,.363]],[.061,.04,.002],high?9:6,rad));
    for(let j=0;j<(high?4:2);j++){
      const z=-.32-j*(high?.155:.26);
      out.hull.push(egg(small,s*(.20-j*.014),.663-j*.028,z,.09,.105-j*.01,.18-j*.014,-s*.35,.2));
    }
    const tag=s<0?'L':'R';
    const edge=[0,.19,.44,.70,.86,1].map(u=>wingPoint(s,u,0));
    out[`hull:${tag}`]=[tapered(edge,[.132,.104,.077,.058,.038,.003],path,rad)];
    out[`membrane:${tag}`]=[membrane(s,high)];
    const ribs=[];
    for(const [root,tip] of high?[[.06,.25],[.25,.51],[.44,.76],[.70,.89]]:[[.10,.43],[.42,.75]]){
      const f=[0,.35,.68,1].map(t=>wingPoint(s,THREE.MathUtils.lerp(root,tip,t),t));
      ribs.push(tapered(f,[.046,.036,.024,.005],high?8:6,rad));
    }
    ribs.push(tapered([.01,.27,.53,.78,.94,1].map(u=>wingPoint(s,u,1)),[.047,.033,.028,.022,.012,.002],path,rad));
    out[`bone:${tag}`]=ribs;
  }
  return finish(out);
}

export const refreshedModels = {
  std:{ archon:()=>archon(false), hydralisk:()=>hydralisk(false), mutalisk:()=>mutalisk(false) },
  high:{ archon:()=>archon(true), hydralisk:()=>hydralisk(true), mutalisk:()=>mutalisk(true) },
};

// Low-cost Fresnel energy shell, including Three's instanced transforms.
function glowShell(color,opacity,edge,bias,swirl=0) {
  return new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{ tint:{value:new THREE.Color(color)},amount:{value:opacity},edge:{value:edge},bias:{value:bias},swirl:{value:swirl} },
    vertexShader:`
      varying vec3 eye;
      varying vec3 shellNormal;
      varying vec3 localPoint;
      void main() {
        localPoint=position;
        vec4 local=vec4(position,1.0);
        vec3 n=normal;
        #ifdef USE_INSTANCING
          local=instanceMatrix*local;
          n=mat3(instanceMatrix)*n;
        #endif
        vec4 mv=modelViewMatrix*local;
        eye=-mv.xyz;
        shellNormal=normalMatrix*n;
        gl_Position=projectionMatrix*mv;
      }
    `,
    fragmentShader:`
      uniform vec3 tint;
      uniform float amount;
      uniform float edge;
      uniform float bias;
      uniform float swirl;
      varying vec3 eye;
      varying vec3 shellNormal;
      varying vec3 localPoint;
      void main() {
        float f=1.0-max(0.0,dot(normalize(eye),normalize(shellNormal)));
        float alpha=amount*(bias+pow(f,edge)*(1.0-bias));
        // Object-space wisps break up a hard glass-ball outline without adding
        // a texture or a clock-driven shader effect to every squad.
        float strand=0.5+0.5*sin(localPoint.y*22.0+localPoint.z*11.0+
          sin(localPoint.x*7.0+localPoint.y*3.1)*2.0);
        gl_FragColor=vec4(tint,alpha*mix(1.0,0.33+0.67*strand,swirl));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
const materialCache = new Map();
const base = (color,roughness=.59) => new THREE.MeshStandardMaterial({color,roughness,metalness:.035});
const glowing = (color,intensity=.72) => new THREE.MeshStandardMaterial({
  color,emissive:color,emissiveIntensity:intensity,roughness:.53,
});
const solidLight = color => new THREE.MeshBasicMaterial({color,toneMapped:false});
export function refreshedMaterials(kind,seatPrimary='#2d73cb') {
  if(!Object.hasOwn(refreshedModels.std,kind))return v64UnitMaterials(kind,seatPrimary);
  const key=`${kind}:${seatPrimary}`;
  if(!materialCache.has(key)){
    const seat=new THREE.Color(seatPrimary);
    const blend=(tone,w)=>new THREE.Color(tone).lerp(seat,w);
    const m=kind==='archon'?{
      hull:glowShell(0x2ebeff,.34,2.2,.04,.90),
      dark:glowShell(0x9bdfff,.72,1.6,.28),
      lamp:solidLight(0xe9fbff),team:solidLight(blend(0xc5e7f7,.77)),
    }:kind==='hydralisk'?{
      hull:base(blend(0x8a5d59,.32),.58),
      dark:base(blend(0x332021,.18)),
      bone:base(blend(0xe1b790,.13),.55),lamp:glowing(blend(0xf2a648,.25)),
    }:{
      hull:base(blend(0x8e5867,.43),.52),dark:base(blend(0x39202c,.24)),
      bone:base(blend(0xc49c87,.24),.66),lamp:glowing(blend(0xfdc579,.26)),
      membrane:new THREE.MeshStandardMaterial({
        color:blend(0x86537a,.44),emissive:blend(0x6c467b,.44),emissiveIntensity:.16,
        transparent:true,opacity:.83,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,roughness:.77,
      }),
    };
    materialCache.set(key,m);
  }
  return materialCache.get(key);
}
