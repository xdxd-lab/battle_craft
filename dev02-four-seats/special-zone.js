// Four inactive special-beacon display areas. No simulation/action binding.
import * as THREE from 'three';
import { SEATS } from '../dev05-layout/layout.mjs';
import { FONT, label } from '../dev05-layout/world.js';
import { SPECIAL_BEACONS, SPECIAL_ZONE as Z, specialZoneFor } from './special-zone-layout.mjs';

const solid = (color, roughness=.8) => new THREE.MeshStandardMaterial({ color, roughness, metalness:.25 });
const flat = color => new THREE.MeshBasicMaterial({ color, toneMapped:false });
const noPick = () => {}; // The visual object itself never becomes a command target.

export function buildSpecialZones(dim) {
  const root = new THREE.Group();
  root.name = 'special-zones:preview';
  root.userData.visualOnly = true;
  const mats = {
    base: solid(0x252b34), deck: solid(0x57606a), well: solid(0x202933),
    rim: flat(0x9c865f), muted: flat(0x8695a1),
    accent: SPECIAL_BEACONS.map(b=>flat(b.tint)),
  };
  const box = (w,h,d) => new THREE.BoxGeometry(w,h,d);
  const geos = {
    plinth: box(Z.width,.68,Z.depth), deck: box(Z.width-.10,.17,Z.depth-.10),
    pin: box(.22,.05,.22), rail: box(.085,.035,Z.depth-.55),
    crossRail: box(Z.width-.54,.035,.085),
    pad: new THREE.CylinderGeometry(Z.beaconRadius-.04,Z.beaconRadius+.12,.24,18),
    ring: new THREE.TorusGeometry(Z.beaconRadius,.063,5,24).rotateX(Math.PI/2),
    key: box(.36,.12,.36),
  };
  // The muted border and separate unlit deck distinguish reservations from purchasable pads.
  const board = label(620,204,(g,w,h)=>{
    g.fillStyle='rgba(9,15,21,.96)';g.beginPath();g.roundRect(4,4,w-8,h-8,22);g.fill();
    g.lineWidth=5;g.strokeStyle='#807760';g.stroke();
    g.fillStyle='#c9b997';g.font=`750 33px ${FONT}`;g.fillText('特別信標｜未開放',w/2,39);
    g.fillStyle='#48515b';g.fillRect(26,63,w-52,2);
    for (const [i,b] of SPECIAL_BEACONS.entries()) {
      const x=i ? w*.75 : w*.25;
      g.fillStyle=b.color;g.font=`850 49px ${FONT}`;g.fillText(b.label,x,146);
      g.font=`800 31px ${FONT}`;g.fillText(`0${b.number}`,x,96);
    }
    g.fillStyle='#48515b';g.fillRect(w/2-1,77,2,95);
  });
  board.material.depthTest = true;
  board.renderOrder = 8; // Existing combat badges remain above it.

  const makeMarkerLabel = (n,tint) => label(96,96,(g,w,h)=>{
    g.fillStyle='rgba(15,20,27,.92)';g.beginPath();g.arc(w/2,h/2,w*.46,0,2*Math.PI);g.fill();
    g.strokeStyle=tint;g.lineWidth=4;g.stroke();g.fillStyle=tint;g.font=`800 57px ${FONT}`;
    g.fillText(n,w/2,h/2+2);
  });
  const numbers=SPECIAL_BEACONS.map(b=>{
    const n=makeMarkerLabel(b.number,b.color);n.material.depthTest=true;n.renderOrder=7;return n;
  });

  for (const s of SEATS) {
    const d = specialZoneFor(s.id,dim), g = new THREE.Group();
    g.name = `special-zone:${s.id}`;
    g.userData = { visualOnly:true, seat:s.id };
    g.position.set(d.center[0],0,d.center[1]);g.rotation.y=d.yaw;
    root.add(g);
    const mesh = (geo,mat,x,y,z,rotation=0) => {
      const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.y=rotation;m.raycast=noPick;g.add(m);return m;
    };
    mesh(geos.plinth,mats.base,0,-.21,0);
    mesh(geos.deck,mats.deck,0,Z.deck-.085,0).receiveShadow=true;
    for (const a of [-1,1]) {
      mesh(geos.rail,mats.rim,a*(Z.width/2-.23),Z.deck+.022,0);
      mesh(geos.crossRail,mats.rim,0,Z.deck+.022,a*(Z.depth/2-.23));
      for (const b of [-1,1]) mesh(geos.pin,mats.muted,a*(Z.width/2-.32),Z.deck+.038,b*(Z.depth/2-.32));
    }
    for (const [i,b] of SPECIAL_BEACONS.entries()) {
      mesh(geos.pad,mats.well,b.x,Z.deck+.12,b.z).name=`special-beacon:${s.id}:${b.id}`;
      mesh(geos.ring,mats.accent[i],b.x,Z.deck+.25,b.z);
      mesh(geos.key,mats.accent[i],b.x,Z.deck+.27,b.z,Math.PI/4);
      const number=numbers[i].clone();number.position.set(b.x,Z.deck+.68,b.z);number.scale.set(.59,.59,1);
      number.raycast=noPick;g.add(number);
    }
    const caption=board.clone();caption.name=`special-zone-label:${s.id}`;
    caption.position.set(0,Z.signY,Z.signR);caption.scale.set(Z.signW,Z.signH,1);
    caption.userData = { visualOnly:true, label:'特別信標（未開放）：全場清除、控制單位' };
    caption.raycast=noPick;g.add(caption);
  }
  return root;
}
