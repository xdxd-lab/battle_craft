import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from './DRACOLoader.local.js';

const SMALL_LAMP = '__SMALL_LAMP__';
const PORTABLE_LAMP = '__PORTABLE_LAMP__';
const DRACO_JS = '__DRACO_JS__';
const DRACO_WASM = '__DRACO_WASM__';
const $ = (id) => document.getElementById(id);
const canvas = $('battlefield');
const message = $('message');
const qualityButton = $('quality');
const pads = [
  { x: -8.3, z: 14.4, cost: 5, count: 1, label: '單兵部署' },
  { x: 8.3, z: 14.4, cost: 12, count: 3, label: '編隊部署' },
];
const keys = new Set();
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
const palette = {
  cyan: 0x44e7f4, cyanSoft: 0x91f8ff, red: 0xff685d, redSoft: 0xffb6a7,
  gold: 0xffd376, dark: 0x101c2d, steel: 0x26394a,
};
let renderer, scene, camera, commander, padArt = [], baseArt = [], ambientObjects = [];
let quality = 'high', game, accumulator = 0, previous = 0, screenReady = false;

function material(color, metalness = .8, roughness = .32, emissive = 0x000000, intensity = 0) {
  return new THREE.MeshPhysicalMaterial({ color, metalness, roughness, clearcoat: .22, clearcoatRoughness: .25, emissive, emissiveIntensity: intensity });
}
const MAT = {
  hull: material(0x344f66, .86, .29), hullDark: material(0x192d41, .9, .4),
  plate: material(0x4a6478, .84, .33), trim: material(0x607d8e, .78, .24),
  cyan: material(0x68d6e6, .35, .18, palette.cyan, 1.6),
  red: material(0xff8d80, .35, .2, palette.red, 1.6),
  gold: material(0xffdb8b, .4, .22, palette.gold, 1.1),
  guideCyan: material(0x31677b, .55, .36, palette.cyan, .38),
  guideRed: material(0x744652, .55, .36, palette.red, .38),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x6bc8ee, metalness: .24, roughness: .11, transmission: .28, transparent: true, opacity: .7, depthWrite: false, clearcoat: 1 }),
};

function block(parent, w, h, d, mat, x, y, z, shadow = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function disc(parent, radius, height, mat, x, y, z, sides = 64) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function ring(parent, radius, tube, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 64), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
function line(parent, points, mat) {
  const mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color: mat }));
  parent.add(mesh);
  return mesh;
}
function textSprite(value, color = '#d5efff', width = 256) {
  const c = document.createElement('canvas'); c.width = width; c.height = 96;
  const cx = c.getContext('2d');
  cx.fillStyle = 'rgba(7,23,38,.82)'; cx.fillRect(0, 16, width, 62);
  cx.strokeStyle = color; cx.lineWidth = 2; cx.strokeRect(2, 18, width - 4, 58);
  cx.fillStyle = color; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.font = 'bold 34px -apple-system, sans-serif'; cx.fillText(value, width / 2, 48);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(5.1, 1.9, 1);
  return sprite;
}
function makeStars() {
  const positions = [];
  let seed = 721449;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 1000; i++) {
    positions.push((random() - .5) * 220, 36 + random() * 125, (random() - .5) * 240);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xc2e7ff, size: .2, transparent: true, opacity: .68, sizeAttenuation: true }));
  scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 40, 28), material(0x344d70, .18, .9, 0x124782, .3));
  moon.position.set(-46, 31, -78); scene.add(moon);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(13, .2, 8, 100), MAT.cyan);
  rim.position.copy(moon.position); rim.rotation.x = .48; rim.rotation.y = .55; scene.add(rim);
}
function makeSpaceBackdrop() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const cx = c.getContext('2d');
  const fill = cx.createRadialGradient(560, 430, 40, 530, 530, 750);
  fill.addColorStop(0, '#152b4c'); fill.addColorStop(.38, '#0c1e38'); fill.addColorStop(1, '#050a19');
  cx.fillStyle = fill; cx.fillRect(0,0,1024,1024);
  const nebula = cx.createRadialGradient(730,300,10,730,300,330);
  nebula.addColorStop(0,'#493f7b66'); nebula.addColorStop(.7,'#30285624'); nebula.addColorStop(1,'#30285600');
  cx.fillStyle = nebula; cx.fillRect(0,0,1024,1024);
  let seed = 38162;
  const random = () => {seed = (seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<500;i++){
    cx.fillStyle = `rgba(190,226,255,${.12+random()*.55})`;
    const x=random()*1024,y=random()*1024,r=random()<.93?1:2;
    cx.fillRect(x,y,r,r);
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(240,240), new THREE.MeshBasicMaterial({map:tex,fog:false,depthWrite:false}));
  mesh.rotation.x = -Math.PI/2; mesh.position.y = -5; scene.add(mesh);
}
function makeArena() {
  const base = block(scene, 62, .8, 45, MAT.hullDark, 0, -.9, 0, true);
  base.receiveShadow = true;
  block(scene, 60, .15, 43, MAT.hull, 0, -.42, 0);
  // Raised cruciform battlefield, with two inactive arms reserved for future 2v2.
  block(scene, 47, .55, 6.8, MAT.plate, 0, .08, -3.4, true);
  block(scene, 7, .55, 32, MAT.plate, 0, .08, -3.4, true);
  block(scene, 46, .18, 5.5, MAT.hullDark, 0, .45, -3.4);
  block(scene, 5.8, .18, 30.5, MAT.hullDark, 0, .45, -3.4);
  // Reflective metal seams and power conductors.
  for (let x = -21; x <= 21; x += 2.2) {
    block(scene, .075, .03, 5.25, MAT.trim, x, .56, -3.4);
    block(scene, 1.65, .02, .16, x < 0 ? MAT.guideCyan : MAT.guideRed, x, .57, -3.4);
  }
  for (let z = -17; z <= 10; z += 2.2) {
    block(scene, 5.5, .03, .075, MAT.trim, 0, .57, z);
    block(scene, .16, .02, 1.6, MAT.guideCyan, 0, .58, z);
  }
  for (const sign of [-1, 1]) {
    block(scene, 47, .22, .19, sign < 0 ? MAT.guideCyan : MAT.guideRed, 0, .55, -3.4 + sign * 3.35);
    block(scene, .17, .22, 31, sign < 0 ? MAT.guideCyan : MAT.guideRed, sign * 3.43, .55, -3.4);
  }
  // The central junction has a distinct control-ring silhouette.
  disc(scene, 4.3, .62, MAT.hull, 0, .65, -3.4);
  ring(scene, 3.72, .13, MAT.gold, 0, 1.02, -3.4);
  disc(scene, 2.82, .12, MAT.hullDark, 0, 1.04, -3.4);
  ring(scene, 2.26, .09, MAT.cyan, 0, 1.12, -3.4);
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    const x = Math.cos(angle) * 3.15, z = -3.4 + Math.sin(angle) * 3.15;
    disc(scene, .21, .13, MAT.gold, x, 1.07, z, 12);
  }
  // Landing deck and access gantry remain outside the combat lane.
  block(scene, 39, .64, 9.2, MAT.hull, 0, -.05, 14.2, true);
  block(scene, 37.8, .11, 8.1, MAT.plate, 0, .32, 14.2);
  for (let x = -17.5; x <= 17.5; x += 2.5) {
    block(scene, .06, .018, 7.7, MAT.trim, x, .4, 14.2);
  }
  block(scene, 39.5, .27, .28, MAT.guideCyan, 0, .35, 18.75);
  block(scene, 39.5, .27, .28, MAT.guideCyan, 0, .35, 9.65);
  for (const x of [-18, 18]) for (const z of [10.1, 18.1]) {
    block(scene, .5, 2.4, .5, MAT.hullDark, x, 1.1, z, true);
    block(scene, .6, .25, .6, MAT.cyan, x, 2.25, z);
  }
  // Greebles around the stage create density without obstructing units.
  for (let i = 0; i < 18; i++) {
    const x = -25.5 + (i % 9) * 6.4;
    const z = i < 9 ? -18.7 : 4.9;
    const tower = new THREE.Group(); tower.position.set(x, 0, z); scene.add(tower);
    block(tower, 1.3, .7, 1.3, MAT.hullDark, 0, .35, 0, true);
    block(tower, .95, .32, .95, MAT.trim, 0, .83, 0);
    block(tower, .55, 1.1, .55, MAT.hull, 0, 1.52, 0);
    block(tower, .59, .12, .59, i % 2 ? MAT.cyan : MAT.gold, 0, 2.06, 0);
  }
  for (let i = 0; i < 25; i++) {
    const x = -28 + (i % 13) * 4.7;
    const z = i < 13 ? -21.3 : 21.5;
    block(scene, 3.4, .8, 1.6, MAT.hullDark, x, 0, z, true);
    block(scene, 2.2, .08, .1, MAT.guideCyan, x, .46, z);
  }
}
function makeBase(team) {
  const x = team === 0 ? -23.3 : 23.3;
  const color = team === 0 ? MAT.cyan : MAT.red;
  const group = new THREE.Group(); group.position.set(x, .2, -3.4); scene.add(group);
  disc(group, 3.45, .7, MAT.hullDark, 0, .1, 0);
  ring(group, 3.1, .14, color, 0, .49, 0);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const px = Math.cos(a) * 2.5, pz = Math.sin(a) * 2.5;
    block(group, .9, 2.7, .9, MAT.plate, px, 1.9, pz, true);
    block(group, .77, .18, .77, color, px, 3.2, pz);
  }
  disc(group, 1.65, 4.3, MAT.hull, 0, 2.7, 0, 8);
  disc(group, 1.24, 2.7, color, 0, 3, 0, 12);
  disc(group, 1.74, .38, MAT.trim, 0, 5, 0, 8);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.7, 8), MAT.hullDark);
  cap.position.set(0, 5.9, 0); cap.castShadow = true; group.add(cap);
  const light = new THREE.PointLight(team === 0 ? palette.cyan : palette.red, 28, 12, 2);
  light.position.set(0, 4.4, 0); group.add(light);
  const halo = ring(group, 1.67, .065, color, 0, 4.5, 0);
  baseArt[team] = { group, halo, light };
}
function makeBeacon(p, index) {
  const group = new THREE.Group(); group.position.set(p.x, .4, p.z); scene.add(group);
  disc(group, 2.15, .22, MAT.hullDark, 0, .12, 0, 6);
  disc(group, 1.75, .08, MAT.plate, 0, .28, 0, 6);
  const outer = ring(group, 1.8, .1, MAT.gold, 0, .38, 0);
  ring(group, 1.3, .065, MAT.cyan, 0, .43, 0);
  disc(group, .62, .27, MAT.glass, 0, .62, 0, 12);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.45, .8, 3.1, 16, 1, true), new THREE.MeshBasicMaterial({ color: index ? palette.gold : palette.cyan, transparent: true, opacity: .08, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 2.12; group.add(beam);
  const label = textSprite(index ? '3 兵 · 12 金' : '1 兵 · 5 金', index ? '#ffe1a0' : '#a7faff');
  label.position.set(0, 4.7, 0); group.add(label);
  const light = new THREE.PointLight(index ? palette.gold : palette.cyan, 8, 6, 2);
  light.position.y = 1.5; group.add(light);
  padArt.push({ outer, beam, light, group });
}
function makeSoldier(team) {
  const group = new THREE.Group();
  const armor = team === 0 ? material(0x4da5bd, .74, .32) : material(0xb65457, .73, .32);
  const glow = team === 0 ? MAT.cyan : MAT.red;
  disc(group, .42, .12, MAT.hullDark, 0, .13, 0, 10);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.35, .46, .9, 8), armor);
  torso.position.y = .83; torso.castShadow = true; group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.29, 12, 8), MAT.hullDark);
  head.position.y = 1.43; head.castShadow = true; group.add(head);
  block(group, .41, .12, .13, glow, 0, 1.43, .23);
  for (const s of [-1, 1]) {
    block(group, .19, .58, .3, armor, s * .42, .78, 0, true);
    block(group, .23, .4, .31, MAT.hullDark, s * .19, .27, 0, true);
  }
  block(group, .13, .12, .75, MAT.trim, team ? -.54 : .54, .93, .31);
  group.rotation.y = team ? -Math.PI / 2 : Math.PI / 2;
  scene.add(group);
  return group;
}
function makeCommander() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.54, .68, 1.35, 8), MAT.hull);
  body.position.y = 1.06; body.castShadow = true; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.4, 16, 12), MAT.trim);
  head.position.y = 1.97; head.castShadow = true; group.add(head);
  block(group, .57, .16, .16, MAT.gold, 0, 1.98, .33);
  for (const s of [-1, 1]) {
    block(group, .38, .22, .48, MAT.hullDark, s * .64, 1.53, 0);
  }
  ring(group, .85, .07, MAT.gold, 0, .2, 0);
  const beacon = new THREE.PointLight(palette.gold, 10, 6, 2); beacon.position.y = 1.4; group.add(beacon);
  scene.add(group);
  return group;
}
function parseBase64(data) {
  const raw = atob(data); const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}
async function addGardenModels() {
  const draco = new DRACOLoader();
  draco._loadLibrary = (file) => Promise.resolve(file.endsWith('.wasm') ? parseBase64(DRACO_WASM) : atob(DRACO_JS));
  draco.setWorkerLimit(1);
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  const parse = data => new Promise((resolve, reject) => loader.parse(parseBase64(data), '', resolve, reject));
  const results = await Promise.allSettled([parse(SMALL_LAMP), parse(PORTABLE_LAMP)]);
  let count = 0;
  function place(gltf, x, z, height, rot = 0) {
    const model = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(new THREE.Vector3(box.getCenter(new THREE.Vector3()).x, box.min.y, box.getCenter(new THREE.Vector3()).z));
    const wrap = new THREE.Group(); wrap.add(model);
    wrap.scale.setScalar(height / Math.max(size.y, .01));
    wrap.rotation.y = rot; wrap.position.set(x, .48, z);
    wrap.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(wrap); count++;
  }
  if (results[0].status === 'fulfilled') {
    for (const x of [-15, -5, 5, 15]) place(results[0].value, x, 18.1, 3.4, Math.PI);
  }
  if (results[1].status === 'fulfilled') {
    for (const x of [-19, -11, 11, 19]) place(results[1].value, x, 10.1, 2.5, x < 0 ? .2 : -.2);
  }
  $('scene-state').textContent = count ? `3D Garden 寫實燈具 × ${count}` : '3D Garden 模型未載入；程序場景正常';
  if (!count) console.warn('3D Garden models failed to load', results);
}

function resize() {
  if (!renderer) return;
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  const aspect = width / height;
  const halfHeight = Math.max(21, 31 / aspect);
  camera.aspect = aspect;
  camera.fov = 2 * Math.atan(halfHeight / 59) * 180 / Math.PI;
  camera.updateProjectionMatrix();
}
function setQuality(next) {
  quality = next;
  renderer.setPixelRatio(next === 'high' ? Math.min(devicePixelRatio || 1, 2) : 1);
  renderer.shadowMap.enabled = next === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  qualityButton.textContent = next === 'high' ? '畫質：高' : '畫質：省電';
  resize();
}
function createScene() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x060e1c);
  scene.fog = new THREE.FogExp2(0x08162b, .012);
  camera = new THREE.PerspectiveCamera(42, 1.54, .1, 300);
  camera.position.set(0, 29, 51); camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0x9bd5ff, 0x182138, 2.2));
  const key = new THREE.DirectionalLight(0xcce6ff, 3.2);
  key.position.set(-17, 40, 27); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -34; key.shadow.camera.right = 34;
  key.shadow.camera.top = 32; key.shadow.camera.bottom = -32;
  key.shadow.bias = -.001; scene.add(key);
  const fill = new THREE.DirectionalLight(0x586da7, 1.4); fill.position.set(27, 17, -22); scene.add(fill);
  makeSpaceBackdrop(); makeStars(); makeArena(); makeBase(0); makeBase(1);
  pads.forEach(makeBeacon);
  commander = makeCommander();
  setQuality('high');
  new ResizeObserver(resize).observe(canvas);
  screenReady = true;
  addGardenModels().catch(error => { $('scene-state').textContent = '3D Garden 模型未載入；程序場景正常'; console.error(error); });
}

function announce(text) { message.textContent = text; }
function hud() {
  $('gold').textContent = game.gold[0];
  $('friendly-hp').textContent = game.hp[0]; $('enemy-hp').textContent = game.hp[1];
  $('unit-count').textContent = game.units.filter(u => u.team === 0).length;
  $('enemy-count').textContent = game.units.filter(u => u.team === 1).length;
  const seconds = Math.floor(game.tick / 30);
  $('clock').textContent = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  $('start').textContent = ({ ready:'開始對局', play:'暫停', paused:'繼續', end:'對局結束' })[game.mode];
  $('start').disabled = game.mode === 'end';
}
function reset() {
  if (!screenReady) return;
  if (game) for (const u of game.units) scene.remove(u.mesh);
  game = { mode:'ready', tick:0, gold:[12,12], hp:[30,30], units:[], serial:0,
    player:{x:-13,z:8.3}, goal:null, activePad:null, purchased:false,
    nextAI:90, effects:[], displayFlash:0 };
  keys.clear(); accumulator = 0;
  commander.position.set(game.player.x, .48, game.player.z);
  announce('按「開始對局」，前往南側補給平台。'); hud(); render();
}
function toggle() {
  if (!game || game.mode === 'end') return;
  game.mode = game.mode === 'play' ? 'paused' : 'play';
  keys.clear(); accumulator = 0;
  announce(game.mode === 'play' ? '踩上信標自動部署部隊；金幣不足時可站著等待。' : '對局已暫停。');
  hud();
}
function recruit(team, p) {
  if (game.gold[team] < p.cost) return false;
  game.gold[team] -= p.cost;
  for (let i = 0; i < p.count; i++) {
    const id = ++game.serial;
    const z = -3.4 + ((id % 3) - 1) * 1.15;
    const x = team ? 19 - i * .55 : -19 + i * .55;
    const mesh = makeSoldier(team); mesh.position.set(x, .48, z);
    game.units.push({ id, team, x, z, hp:3, cooldown:0, mesh });
  }
  return true;
}
function beaconAt() { return pads.find(p => Math.hypot(p.x-game.player.x, p.z-game.player.z) < 1.78) || null; }
function checkBeacon() {
  const p = beaconAt();
  if (p !== game.activePad) {
    game.activePad = p; game.purchased = false;
    if (p && game.gold[0] < p.cost) announce(`${p.label}需要 ${p.cost} 金；停在信標上，存夠後會自動購買。`);
  }
  if (p && !game.purchased && recruit(0,p)) {
    game.purchased = true;
    announce(`已花 ${p.cost} 金，${p.count} 名突擊兵從我方基地出發。`);
  }
}
function moveCommander() {
  let dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  let dz = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  if (dx || dz) game.goal = null;
  else if (game.goal) { dx = game.goal.x - game.player.x; dz = game.goal.z - game.player.z; }
  const length = Math.hypot(dx,dz);
  if (!length) return;
  const speed = Math.min(.22, length);
  game.player.x = THREE.MathUtils.clamp(game.player.x + dx / length * speed, -27, 27);
  game.player.z = THREE.MathUtils.clamp(game.player.z + dz / length * speed, -19, 20);
  if (game.goal && length < .22) game.goal = null;
  commander.position.set(game.player.x, .48, game.player.z);
  commander.rotation.y = Math.atan2(dx,dz);
}
function effect(x,z,color) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(.17, 8, 6), new THREE.MeshBasicMaterial({ color }));
  mesh.position.set(x, 1.5, z); scene.add(mesh); game.effects.push({ mesh, life:.25 });
}
function update() {
  game.tick++;
  moveCommander();
  if (game.tick % 30 === 0) { game.gold[0]++; game.gold[1]++; }
  checkBeacon();
  if (game.tick >= game.nextAI) {
    recruit(1, game.gold[1] >= 12 ? pads[1] : pads[0]);
    game.nextAI += 180;
  }
  const damage = new Map(); const baseDamage = [0,0];
  for (const u of game.units) {
    u.cooldown = Math.max(0, u.cooldown - 1);
    let target = null, nearest = 1.62;
    for (const other of game.units) {
      if (other.team === u.team || other.hp <= 0) continue;
      const dist = Math.hypot(u.x - other.x, u.z - other.z);
      if (dist < nearest) { nearest = dist; target = other; }
    }
    const enemy = 1 - u.team, baseX = enemy ? 23.3 : -23.3;
    if (!target && Math.abs(u.x - baseX) > 2.35) {
      u.x += u.team ? -.078 : .078;
      u.mesh.position.x = u.x;
      continue;
    }
    if (u.cooldown) continue;
    u.cooldown = 24;
    if (target) damage.set(target.id, (damage.get(target.id) || 0) + 1);
    else baseDamage[enemy]++;
    effect(target ? target.x : baseX, target ? target.z : -3.4, u.team ? palette.red : palette.cyan);
  }
  game.units = game.units.filter(u => {
    u.hp -= damage.get(u.id) || 0;
    if (u.hp > 0) return true;
    scene.remove(u.mesh); effect(u.x, u.z, u.team ? palette.red : palette.cyan);
    return false;
  });
  game.hp = game.hp.map((hp,i) => Math.max(0, hp - baseDamage[i]));
  if (game.hp.includes(0)) {
    game.mode = 'end'; game.goal = null; keys.clear();
    announce(game.hp.every(h => h === 0) ? '平手：雙方基地同時陷落。' : game.hp[1] === 0 ? '勝利：敵方核心已失去能量。' : '敗北：我方核心已失去能量。');
  }
  hud();
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(.1, (now - previous) / 1000 || 0); previous = now;
  if (!screenReady || !game) return;
  if (game.mode === 'play') {
    accumulator += dt;
    while (accumulator >= 1/30 && game.mode === 'play') { update(); accumulator -= 1/30; }
  }
  const t = now / 1000;
  for (let i=0;i<padArt.length;i++) {
    const p = padArt[i], occupied = game.activePad === pads[i];
    p.outer.rotation.z = t * .17 * (i ? -1 : 1);
    p.beam.material.opacity = occupied ? .24 + Math.sin(t*4)*.04 : .07 + Math.sin(t*2+i)*.025;
    p.light.intensity = occupied ? 13 : 7 + Math.sin(t*2+i);
  }
  for (const b of baseArt) { b.halo.rotation.z = t*.16; b.light.intensity = 25 + Math.sin(t*2)*3; }
  for (let i=game.effects.length-1;i>=0;i--) {
    const e = game.effects[i]; e.life -= dt;
    e.mesh.scale.setScalar(Math.max(.1,e.life/.25)*2);
    if (e.life <= 0) { scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose(); game.effects.splice(i,1); }
  }
  render();
}
function render() { if (renderer && scene && camera) renderer.render(scene,camera); }

canvas.addEventListener('pointerdown', e => {
  if (!game || game.mode !== 'play') return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.ray.intersectPlane(groundPlane, hit)) {
    game.goal = { x: THREE.MathUtils.clamp(hit.x,-27,27), z: THREE.MathUtils.clamp(hit.z,-19,20) };
  }
  canvas.focus();
});
window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (!game || game.mode !== 'play') return;
  if (['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(key)) {
    e.preventDefault(); keys.add(key);
  }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); if (game?.mode === 'play') toggle(); });
$('start').onclick = () => { toggle(); canvas.focus(); };
$('reset').onclick = () => { reset(); canvas.focus(); };
qualityButton.onclick = () => setQuality(quality === 'high' ? 'low' : 'high');
$('save').onclick = () => {
  const content = '<!doctype html>\n' + document.documentElement.outerHTML;
  const url = URL.createObjectURL(new Blob([content], {type:'text/html;charset=utf-8'}));
  const link = document.createElement('a'); link.href = url; link.download = 'battle_craft-v4.html'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
};
try { createScene(); reset(); requestAnimationFrame(animate); }
catch (error) { $('scene-state').textContent = '此瀏覽器無法啟動 3D 場景'; announce('3D 場景無法啟動。請使用支援 WebGL 的瀏覽器。'); console.error(error); }
