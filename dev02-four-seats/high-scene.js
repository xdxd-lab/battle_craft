// 高細節場景層：甲板嵌板與倒角、場外前中遠景、3D Garden 改造配件。只加呈現物件，不碰模擬，整層可隱藏回到標準。
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from './DRACOLoader.local.js';
import * as L from '../dev05-layout/layout.mjs';
import * as W from '../dev05-layout/world.js';
import { ARENA_V8 as D, corePos } from './arena.mjs';
import PROPS from './prop-data.generated.js';

let seed = 5;
const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
export const group = new THREE.Group(); group.name = 'high-detail';
const buckets = new Map(), base = new THREE.Matrix4();
function add(geo, mat, x, y, z, ry = 0) {
  geo.applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z).premultiply(base));
  if (!buckets.has(mat)) buckets.set(mat, []);
  buckets.get(mat).push(geo.index ? geo.toNonIndexed() : geo);
}
// 倒角板：頂面比底面內縮，邊緣在光下形成亮線
function slab(w, h, d, bevel = .08) {
  const g = new THREE.BoxGeometry(w, h, d), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) - Math.sign(p.getX(i)) * bevel); p.setZ(i, p.getZ(i) - Math.sign(p.getZ(i)) * bevel); }
  g.computeVertexNormals(); return g;
}
const std = (color, metalness, roughness) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
const M = { frame: std(0x59646d, .85, .38), groove: std(0x161b20, .5, .6), bolt: std(0xaab3ba, .9, .3), girder: std(0x3a4a57, .7, .5), far: std(0x222e39, .45, .72),
  warm: new THREE.MeshBasicMaterial({ color: 0xb98a55 }), cool: new THREE.MeshBasicMaterial({ color: 0x4f7690 }) };

function deck() {
  const wide = D.laneWidth, z0 = -(D.coreDistance - D.corePlatformRadius + .6), z1 = -(D.junctionRadius + .2);
  for (const s of L.SEATS) {
    base.makeRotationY(L.seatYaw(s.id));
    for (const q of [-1, 1]) { // 兩側維修槽蓋與線槽，高度低於 0.06，不遮部隊與標線
      for (let z = z0 + 1; z < z1 - .5; z += 2.1) {
        add(slab(.62, .05, 1.7), M.frame, q * (wide / 2 - 1.25), .025, z);
        for (let k = -2; k <= 2; k++) add(new THREE.BoxGeometry(.4, .012, .07), M.groove, q * (wide / 2 - 1.25), .056, z + k * .27);
        for (const dz of [-.74, .74]) for (const dx of [-.22, .22]) add(new THREE.CylinderGeometry(.045, .055, .03, 8), M.bolt, q * (wide / 2 - 1.25) + dx, .062, z + dz);
      }
      for (const off of [.98, 1.18]) add(new THREE.CylinderGeometry(.07, .07, z1 - z0, 8).rotateX(Math.PI / 2), M.girder, q * (wide / 2 + off), -.55, (z0 + z1) / 2);
      for (let z = z0 + .5; z < z1; z += 1.6) add(slab(.5, .22, .3, .06), M.frame, q * (wide / 2 + 1.08), -.55, z);
    }
    for (let z = z0 + 3; z < z1; z += 5.5) add(slab(wide - 3.4, .025, .16, .01), M.groove, 0, .014, z); // 伸縮縫
  }
  base.identity();
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; add(slab(1.15, .045, .34), M.frame, Math.cos(a) * 6.55, .025, Math.sin(a) * 6.55, -a + Math.PI / 2); }
}
// 前景：戰場下方的桁架與管線（y -5～-10）；遠景：更深的平台群與燈點（y -13）
function depth() {
  base.identity();
  for (const s of L.SEATS) {
    base.makeRotationY(L.seatYaw(s.id));
    for (let z = -34; z <= -12; z += 5.5) for (const q of [-1, 1]) {
      add(new THREE.BoxGeometry(.35, 8.5, .35), M.girder, q * 6.4, -6.6, z);
      add(new THREE.BoxGeometry(3.4, .28, .28), M.girder, q * 4.8, -4.4, z);
      add(new THREE.BoxGeometry(.18, .18, 5.9), M.girder, q * 6.4, -9.2, z + 2.7);
      add(new THREE.BoxGeometry(.2, .14, .5), rnd() < .6 ? M.warm : M.cool, q * 6.62, -4.2, z);
    }
    for (const x of [9.5, 10.4]) add(new THREE.CylinderGeometry(.3, .3, 26, 10).rotateX(Math.PI / 2), M.girder, x, -10.2, -24);
  }
  base.identity();
  for (let n = 0; n < 150;) {
    const x = (rnd() - .5) * 190, z = (rnd() - .5) * 190;
    if (Math.hypot(x, z) < 20 || Math.abs(x) < 12 || Math.abs(z) < 12) continue;
    const w = 2 + rnd() * 7, d = 2 + rnd() * 7, h = .5 + rnd() * 1.6; n++;
    add(slab(w, h, d, .35), M.far, x, -14.6 + h / 2, z);
    add(slab(w * .55, .4, d * .55, .12), M.girder, x, -14.4 + h, z);
    for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(.32, .1, .12), rnd() < .75 ? M.warm : M.cool, x - w / 2 + rnd() * w, -14.55 + h, z + d / 2 - .12);
  }
}
function flush() {
  for (const [mat, list] of buckets) { const m = new THREE.Mesh(mergeGeometries(list), mat); m.receiveShadow = true; m.userData.detail = true; group.add(m); list.forEach(g => g.dispose()); }
  buckets.clear();
}
const bytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
export const props = { status: 'idle', count: 0 };
// 3D Garden 改造配件：燈具壓暗黃色外框、低亮度；管架壓扁並換成深色金屬。放在購買區與核心平台外側，不上通道。
async function loadProps() {
  const draco = new DRACOLoader();
  if (PROPS.decoder) draco.setDecoderPath(PROPS.decoder);
  else draco._loadLibrary = file => Promise.resolve(file.endsWith('.wasm') ? bytes(PROPS.wasm) : atob(PROPS.wrapper));
  draco.setWorkerLimit(1);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const parse = k => PROPS.decoder ? loader.loadAsync(PROPS[k]) : new Promise((ok, no) => loader.parse(bytes(PROPS[k]), '', ok, no));
  const [lamp, pipes] = await Promise.all([parse('lamp'), parse('pipes')]);
  lamp.scene.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.setRGB(.5, .56, .62); o.material.metalness = Math.max(o.material.metalness, .35); } });
  pipes.scene.traverse(o => { if (o.isMesh) o.material = M.frame; });
  const place = (src, x, y, z, size, ry, squash = 1) => {
    const model = src.clone(true), box = new THREE.Box3().setFromObject(model), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    model.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
    const wrap = new THREE.Group(); wrap.add(model); const k = size / Math.max(s.x, s.y, s.z); wrap.scale.set(k, k * squash, k); wrap.rotation.y = ry; wrap.position.set(x, y, z);
    wrap.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); group.add(wrap); props.count++;
  };
  for (const s of L.SEATS) {
    const [cx, cz] = corePos(s.id), yaw = L.seatYaw(s.id), [dx, dz] = s.dir, [tx, tz] = L.ccw(s.dir);
    // 核心外緣兩側各一盞燈；核心背後一組低矮管架
    for (const q of [-1, 1]) place(lamp.scene, cx + dx * 2.6 + tx * q * 5.4, .2, cz + dz * 2.6 + tz * q * 5.4, 1.5, yaw + (q > 0 ? .6 : -.6));
    place(pipes.scene, cx - tx * 4.9 - dx * .6, .2, cz - tz * 4.9 - dz * .6, 2.6, yaw + Math.PI / 2, .55);
  }
}
let built = false;
export function setHighScene(on) {
  if (on && !built) {
    built = true; deck(); depth(); flush(); W.scene.add(group); props.status = 'loading';
    loadProps().then(() => { props.status = 'ready'; }).catch(err => { console.warn(err); props.status = 'failed'; });
  }
  group.visible = on;
}
