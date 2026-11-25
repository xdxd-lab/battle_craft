import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';
import * as L from './layout.mjs';

const D = L.DIM;
const $ = id => document.getElementById(id);
const canvas = $('stage');
let seedState = 20261126;
const rnd = () => { seedState = (seedState * 1664525 + 1013904223) >>> 0; return seedState / 4294967296; };

// ---------- 程序貼圖：磨損艙板的顏色、粗糙度、凹凸（原創，無外部圖檔） ----------
function canvasTexture(size, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function plates(g, size, draw) { // 固定的不等分艙板
  const cuts = [0, .25, .5, .75, 1];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const wide = (i + j) % 3 === 0 && i < 3;
    draw(cuts[i] * size, cuts[j] * size, size / 4 * (wide ? 2 : 1), size / 4, i * 7 + j * 13);
    if (wide) i++;
  }
}
function wear(g, size, n, light, dark) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rnd() < .5 ? light : dark;
    const x = rnd() * size, y = rnd() * size, w = 1 + rnd() * 26, h = 1 + rnd() * 2;
    g.fillRect(x, y, rnd() < .5 ? w : h, rnd() < .5 ? h : w);
  }
}
const TEX = {
  color: canvasTexture(512, (g, s) => {
    g.fillStyle = '#c8ccd0'; g.fillRect(0, 0, s, s);
    plates(g, s, (x, y, w, h, k) => { const v = 188 + (k * 37 % 42); g.fillStyle = `rgb(${v},${v + 2},${v + 4})`; g.fillRect(x + 2, y + 2, w - 4, h - 4); });
    for (let i = 0; i < 34; i++) { const x = rnd() * s, y = rnd() * s, r = 12 + rnd() * 56, q = g.createRadialGradient(x, y, 1, x, y, r); q.addColorStop(0, 'rgba(52,44,36,.13)'); q.addColorStop(1, 'rgba(52,44,36,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); }
    wear(g, s, 420, 'rgba(240,244,248,.26)', 'rgba(30,32,36,.24)');
    g.strokeStyle = 'rgba(22,26,30,.75)'; g.lineWidth = 3; plates(g, s, (x, y, w, h) => g.strokeRect(x, y, w, h));
  }),
  rough: canvasTexture(512, (g, s) => {
    g.fillStyle = '#8f8f8f'; g.fillRect(0, 0, s, s);
    plates(g, s, (x, y, w, h, k) => { const v = 112 + (k * 53 % 70); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, w, h); });
    wear(g, s, 700, 'rgba(230,230,230,.35)', 'rgba(60,60,60,.35)');
  }, false),
  bump: canvasTexture(512, (g, s) => {
    g.fillStyle = '#999'; g.fillRect(0, 0, s, s);
    g.strokeStyle = '#333'; g.lineWidth = 5; plates(g, s, (x, y, w, h) => {
      g.strokeRect(x, y, w, h); g.fillStyle = '#ddd';
      for (const [a, b] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]]) { g.beginPath(); g.arc(x + a, y + b, 3.5, 0, 7); g.fill(); }
    });
  }, false),
  hazard: canvasTexture(128, (g, s) => {
    g.fillStyle = '#c9a227'; g.fillRect(0, 0, s, s); g.fillStyle = '#1b1c1e';
    for (let i = -1; i < 3; i++) { g.beginPath(); g.moveTo(i * 64, s); g.lineTo(i * 64 + 32, s); g.lineTo(i * 64 + 96, 0); g.lineTo(i * 64 + 64, 0); g.fill(); }
    wear(g, s, 90, 'rgba(255,255,255,.18)', 'rgba(0,0,0,.3)');
  }),
};
const pbr = (color, metalness, roughness, extra = {}) => new THREE.MeshStandardMaterial({
  color, metalness, roughness, map: TEX.color, roughnessMap: TEX.rough, bumpMap: TEX.bump, bumpScale: 1.2, ...extra });
const glow = (color, k = 1.5) => new THREE.MeshStandardMaterial({ color: 0x11151a, emissive: color, emissiveIntensity: k, roughness: .4 });
const MAT = {
  deck: pbr(0x77838d, .62, .9), dark: pbr(0x3b4248, .6, .9), steel: pbr(0x98a0a6, .75, .75),
  rust: pbr(0x6b4a37, .35, 1), hazard: new THREE.MeshStandardMaterial({ map: TEX.hazard, metalness: .25, roughness: .7 }),
  lamp: glow(0xffd9a0, 1.6), neutral: glow(0xdfe8ee, .9), black: new THREE.MeshStandardMaterial({ color: 0x15181b, metalness: .4, roughness: .7 }),
};
const seatMats = Object.fromEntries(L.SEATS.map(s => [s.id, {
  paint: pbr(s.primary, .25, .85), glow: glow(s.secondary, .85),
  trim: new THREE.MeshStandardMaterial({ color: s.secondary, metalness: .2, roughness: .55 }),
}]));

// ---------- 靜態幾何依材質合批 ----------
const scene = new THREE.Scene();
class Batch {
  constructor(parent = scene) { this.parent = parent; this.map = new Map(); this.base = new THREE.Matrix4(); }
  add(geo, mat, x, y, z, ry = 0, rx = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m.premultiply(this.base));
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(geo); return this;
  }
  box(mat, w, h, d, x, y, z, ry, rx, rz) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv; // 依實際尺寸鋪貼圖
    const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    const k = mat === MAT.hazard ? .6 : 1 / 7;
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) uv.setXY(f * 4 + i, uv.getX(f * 4 + i) * faces[f][0] * k, uv.getY(f * 4 + i) * faces[f][1] * k);
    return this.add(g, mat, x, y, z, ry, rx, rz);
  }
  cyl(mat, r1, r2, h, x, y, z, n = 24, ry = 0, rx = 0, rz = 0) {
    const g = new THREE.CylinderGeometry(r1, r2, h, n), uv = g.attributes.uv, p = g.attributes.position, nn = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) Math.abs(nn.getY(i)) > .9 ? uv.setXY(i, p.getX(i) / 7, p.getZ(i) / 7) : uv.setXY(i, uv.getX(i) * Math.max(1, Math.round((r1 + r2) * .45)), uv.getY(i) * h / 7);
    return this.add(g, mat, x, y, z, ry, rx, rz);
  }
  ring(mat, r, tube, x, y, z, n = 48) { return this.add(new THREE.TorusGeometry(r, tube, 6, n), mat, x, y, z, 0, Math.PI / 2); }
  pipe(mat, r, a, b) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), v = B.clone().sub(A);
    const g = new THREE.CylinderGeometry(r, r, v.length(), 12);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()));
    const c = A.add(B).multiplyScalar(.5); return this.add(g, mat, c.x, c.y, c.z);
  }
  flush() {
    for (const [mat, list] of this.map) {
      const mesh = new THREE.Mesh(mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g)), mat);
      mesh.castShadow = mesh.receiveShadow = true; this.parent.add(mesh); list.forEach(g => g.dispose());
    }
    this.map.clear();
  }
}
const batch = new Batch();

// ---------- 一席（以北席本地座標建模：核心在 -z，逆時鐘側為 -x） ----------
function buildSeat(s) {
  const M = seatMats[s.id], R = D.coreDistance, W = D.laneWidth, J = D.junctionRadius;
  batch.base.makeRotationY(L.seatYaw(s.id));
  const b = batch;
  // 道路
  const z0 = -(R - D.corePlatformRadius + 1), z1 = -(J - 1), len = z1 - z0, zc = (z0 + z1) / 2;
  b.box(MAT.deck, W, 1.2, len, 0, -.6, zc);
  for (const q of [-1, 1]) {
    b.box(MAT.dark, .9, 1.1, len, q * (W / 2 + .45), -.2, zc);
    for (let z = z0 + 1.2; z < z1 - .4; z += 2.4) b.box(M.paint, 1, .32, 1.5, q * (W / 2 + .45), .42, z);
    b.box(MAT.steel, .5, 1.7, len, q * (W / 2 - .6), -2, zc);
    for (let z = z0 + 2; z < z1; z += 6) {
      b.box(M.glow, .22, .16, .9, q * (W / 2 + .45), .66, z);
      b.cyl(MAT.dark, .16, .2, 2.2, q * (W / 2 + 1.15), .9, z, 8); b.box(MAT.lamp, .34, .22, .34, q * (W / 2 + 1.15), 2.05, z);
    }
  }
  for (let z = z0 + 1.5; z < z1; z += 2.6) b.box(MAT.steel, W, .5, .35, 0, -2.9, z);
  for (const z of [-14, -20]) { b.box(MAT.dark, 3.4, 13, 2.2, 0, -8.5, z); b.box(MAT.rust, 5.6, .8, 3, 0, -3.4, z); b.box(MAT.steel, 4.4, .5, 2.9, 0, -8, z); }
  for (let z = z0 + 2.2; z < z1 - 1; z += 3.2) for (const q of [-1, 1]) b.box(M.trim, 1.5, .03, .3, q * .48, .02, z, q * .72); // 指向中央
  for (const q of [-1, 1]) b.box(M.trim, .16, .03, len - 1, q * (W / 2 - .7), .02, zc);
  // 出兵門
  for (const q of [-1, 1]) { b.box(MAT.dark, 1.5, 3.6, 1.8, q * (W / 2 + .8), 1.6, -22); b.box(M.paint, 1.62, .9, 1.9, q * (W / 2 + .8), 2.7, -22); }
  b.box(MAT.steel, W + 3, .5, .9, 0, 3.6, -22); b.box(M.glow, W - .6, .16, .16, 0, 3.3, -21.5);

  // 核心：反應爐塔（原創造型）
  const cr = D.corePlatformRadius;
  b.cyl(MAT.deck, cr, cr + .6, 1.6, 0, -.6, -R, 8, Math.PI / 8); b.cyl(MAT.dark, cr - 1, 2.5, 9, 0, -6, -R, 8, Math.PI / 8);
  b.ring(M.glow, cr - .7, .12, 0, .24, -R);
  b.cyl(MAT.dark, 4.1, 4.6, .9, 0, .6, -R, 16); b.cyl(M.paint, 3.4, 4, 1, 0, 1.5, -R, 16);
  b.cyl(MAT.steel, 1.9, 2.2, 5, 0, 3.8, -R, 20); b.cyl(M.glow, 2.06, 2.06, .5, 0, 3.4, -R, 20); b.cyl(M.glow, 2.02, 2.02, .4, 0, 4.7, -R, 20);
  b.cyl(MAT.dark, 2.7, 2.1, .8, 0, 6.2, -R, 16); b.cyl(M.paint, 1.5, 2.6, .9, 0, 7, -R, 16);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + Math.PI / 6, x = Math.cos(a) * 3.8, z = -R + Math.sin(a) * 3.8;
    b.box(M.paint, 1.5, 4, .9, x, 2.6, z, -a, 0, .26); b.box(MAT.steel, .5, 4.6, 1.05, x * 1.04, 2.5, -R + (z + R) * 1.04, -a, 0, .26);
  }
  // 席位識別桿：北 1、西 2、南 3、東 4，不靠顏色也能辨認
  const n = L.seatIndex(s.id) + 1;
  for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * .8; b.cyl(MAT.steel, .12, .16, 2.2, x, 8.4, -R, 8); b.box(M.glow, .34, .34, .34, x, 9.6, -R); }
  // 隊伍徽記鋪在核心平台前緣：甲隊雙橫條、乙隊雙箭頭
  for (const k of [0, 1]) {
    if (L.TEAMS[s.team].emblem === 'bars') b.box(M.trim, 3.2, .05, .45, 0, .24, -R + 5.1 + k * .85);
    else for (const q of [-1, 1]) b.box(M.trim, 1.9, .05, .4, q * .72, .24, -R + 5.1 + k * .95, q * .6);
  }

  // 場外購買區
  const sx = -D.shopTangent, sz = -D.shopRadial, w = D.shopWidth, d = D.shopDepth;
  b.box(MAT.deck, w, 1.1, d, sx, -.45, sz); b.box(MAT.dark, w - 1.5, 2.2, d - 1.5, sx, -2, sz);
  b.box(MAT.dark, 2.6, 13, 2.6, sx, -9, sz); b.box(MAT.rust, 6, .7, 4, sx, -3.4, sz);
  for (const q of [-1, 1]) {
    b.box(M.paint, w + .3, .5, .4, sx, .3, sz + q * d / 2); b.box(M.paint, .4, .5, d + .3, sx + q * w / 2, .3, sz);
    for (let i = -3; i <= 3; i++) b.box(MAT.steel, .12, .9, .12, sx + i * 2.2, .9, sz + q * (d / 2 - .1));
    b.box(MAT.steel, w - .4, .1, .1, sx, 1.35, sz + q * (d / 2 - .1));
  }
  for (const i of [-1, 1]) for (const k of [-1, 1]) {
    const x = sx + i * 3.3 + .9, z = sz + k * 2.4;
    b.cyl(MAT.dark, D.padRadius + .25, D.padRadius + .4, .24, x, .22, z, 6); b.cyl(MAT.steel, D.padRadius - .25, D.padRadius - .25, .1, x, .38, z, 6);
    b.ring(M.glow, D.padRadius, .11, x, .38, z, 6); b.cyl(M.glow, .3, .3, .3, x, .5, z, 12);
  }
  for (const k of [-1, 1]) { b.cyl(MAT.steel, .95, .95, 2.4, sx - 5.6, 1.3, sz + k * 3.2, 18); b.cyl(M.paint, 1, 1, .5, sx - 5.6, 1.6, sz + k * 3.2, 18); b.cyl(MAT.dark, .5, .95, .4, sx - 5.6, 2.7, sz + k * 3.2, 18); }
  b.box(M.paint, 1.7, 1.5, 2.8, sx - 5.6, .85, sz); b.box(MAT.dark, 1.8, .2, 2.9, sx - 5.6, 1.6, sz);
  b.box(MAT.dark, .6, 4, .6, sx + w / 2 - .7, 2, sz - d / 2 + .8); b.box(M.glow, .9, .5, .9, sx + w / 2 - .7, 4, sz - d / 2 + .8);
  // 歸屬管線：購買區 → 自己的核心平台（不可通行）
  for (const k of [-.5, .5]) b.pipe(k < 0 ? M.paint : MAT.steel, .28, [sx + w / 2 - .5, -.5, sz - 2.6 + k], [-cr + .8, -.5, -R + 2 + k]);
  // 指揮官示意
  b.cyl(M.paint, .42, .62, 1.3, sx + .9, .95, sz, 8); b.cyl(MAT.steel, .34, .34, .5, sx + .9, 1.85, sz, 12); b.box(M.glow, .5, .14, .3, sx + .9, 1.9, sz + .22); b.ring(M.glow, .85, .08, sx + .9, .16, sz, 24);

  // 與逆時鐘鄰席之間的內角：隊友為聯管橋架，敵方為防爆牆
  const next = L.nextCcw(s.id), mate = next.team === s.team;
  const a = [-(W / 2 + .9), -14.5], e = [-14.5, -(W / 2 + .9)], mx = (a[0] + e[0]) / 2, mz = (a[1] + e[1]) / 2;
  if (mate) {
    const N = seatMats[next.id];
    const m = [mx, 0, mz];
    b.pipe(M.paint, .42, [a[0], -.4, a[1]], [m[0], -.4, m[2]]); b.pipe(N.paint, .42, [m[0], -.4, m[2]], [e[0], -.4, e[1]]);
    b.pipe(MAT.steel, .3, [a[0] - .9, -.9, a[1] - .9], [e[0] - .9, -.9, e[1] - .9]);
    b.cyl(MAT.dark, 1.7, 2.1, 14, mx, -7.3, mz, 8); b.cyl(MAT.deck, 2.3, 2.3, .5, mx, -.1, mz, 8);
    b.cyl(MAT.steel, .9, 1.2, 1.4, mx, .8, mz, 8);
    b.box(M.glow, .8, .9, .4, mx + .3, 1.9, mz - .3, Math.PI / 4); b.box(N.glow, .8, .9, .4, mx - .3, 1.9, mz + .3, Math.PI / 4);
  } else {
    b.box(MAT.dark, 1.6, 14, 1.6, mx, -8.2, mz);
    b.box(MAT.dark, 6, 2.2, 1, mx, .1, mz, Math.PI / 4); b.box(MAT.hazard, 6.1, .8, 1.1, mx, 1, mz, Math.PI / 4);
  }
  batch.base.identity();
}

function buildJunction() {
  const J = D.junctionRadius, b = batch;
  b.cyl(MAT.deck, J, J + .4, 1.2, 0, -.6, 0, 8, Math.PI / 8); b.cyl(MAT.dark, J - 1.5, 4, 12, 0, -7, 0, 8, Math.PI / 8);
  b.ring(MAT.steel, 5.6, .14, 0, .02, 0, 64); b.ring(MAT.neutral, 4.9, .07, 0, .04, 0, 64);
  b.cyl(MAT.dark, 2.6, 2.6, .06, 0, .02, 0, 32); b.ring(MAT.neutral, 2.6, .07, 0, .05, 0, 48);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, x = Math.cos(a) * 7.4, z = Math.sin(a) * 7.4;
    b.box(MAT.dark, 1.7, 1.2, 1.7, x, .5, z, -a); b.box(MAT.steel, 1, 2.6, 1, x, 1.7, z, -a); b.box(MAT.neutral, .6, .3, 1.1, x, 2.7, z, -a); b.box(MAT.hazard, 1.8, .35, 1.8, x, 1, z, -a);
  }
}

function buildSurroundings() {
  const tex = canvasTexture(1024, (g, s) => {
    g.fillStyle = '#0c1116'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 240; i++) { const v = 14 + rnd() * 20; g.fillStyle = `rgb(${v},${v + 4},${v + 8})`; g.fillRect(rnd() * s, rnd() * s, 10 + rnd() * 90, 10 + rnd() * 70); }
    g.strokeStyle = '#262d33'; g.lineWidth = 5; for (let i = 0; i < 12; i++) { const p = rnd() * s; g.beginPath(); rnd() < .5 ? (g.moveTo(p, 0), g.lineTo(p, s)) : (g.moveTo(0, p), g.lineTo(s, p)); g.stroke(); }
    for (let i = 0; i < 420; i++) { g.fillStyle = rnd() < .8 ? 'rgba(255,190,120,.55)' : 'rgba(170,210,255,.5)'; g.fillRect(rnd() * s, rnd() * s, 2, 2); }
  });
  tex.repeat.set(3, 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: .32, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -15; floor.receiveShadow = true; scene.add(floor);
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshBasicMaterial({ color: 0x1b2a35, transparent: true, opacity: .5, depthWrite: false }));
  haze.rotation.x = -Math.PI / 2; haze.position.y = -7.6; scene.add(haze);
  // 低於戰場的廠區，只作背景層次
  let placed = 0;
  while (placed < 90) {
    const x = (rnd() - .5) * 170, z = (rnd() - .5) * 170, r = Math.hypot(x, z);
    if (r < 13 || (Math.abs(x) < 9 && Math.abs(z) < 42) || (Math.abs(z) < 9 && Math.abs(x) < 42)) continue;
    const h = 2 + rnd() * 5;
    if (rnd() < .4) { const q = 1.6 + rnd() * 2.6; batch.cyl(MAT.dark, q, q, h, x, -15 + h / 2, z, 18); batch.ring(MAT.rust, q, .14, x, -15 + h, z, 24); }
    else { batch.box(rnd() < .25 ? MAT.rust : MAT.dark, 3 + rnd() * 6, h, 3 + rnd() * 6, x, -15 + h / 2, z); if (rnd() < .5) batch.box(MAT.lamp, .5, .3, .5, x, -15 + h + .2, z); }
    placed++;
  }
}

// ---------- 比例示意部隊：履帶無人機（原創），不參與判定 ----------
const squads = [];
function buildSquads() {
  const part = (g, x, y, z) => g.toNonIndexed().translate(x, y, z);
  const hull = mergeGeometries([part(new THREE.BoxGeometry(.9, .5, 1.2), 0, .62, 0), part(new THREE.CylinderGeometry(.28, .4, .4, 8), 0, 1.02, -.1)]);
  const dark = mergeGeometries([part(new THREE.BoxGeometry(.32, .5, 1.5), -.6, .32, 0), part(new THREE.BoxGeometry(.32, .5, 1.5), .6, .32, 0), part(new THREE.BoxGeometry(.14, .14, 1), 0, 1.06, .5)]);
  const lamp = part(new THREE.BoxGeometry(.6, .12, .1), 0, .68, .62);
  for (const s of L.SEATS) {
    const g = new THREE.Group(); g.rotation.y = L.seatYaw(s.id); scene.add(g);
    const meshes = [[hull, seatMats[s.id].paint], [dark, MAT.black], [lamp, seatMats[s.id].glow]].map(([geo, mat]) => { const m = new THREE.InstancedMesh(geo, mat, 12); m.castShadow = true; m.frustumCulled = false; g.add(m); return m; });
    squads.push({ meshes });
  }
}
function moveSquads(t) {
  const m = new THREE.Matrix4(), start = -20.5, end = -9.5;
  const head = start + 4 + (t * .9) % (end - start - 4);
  for (const { meshes } of squads) {
    for (let i = 0; i < 12; i++) { m.makeTranslation((i % 4 - 1.5) * 1.7, 0, head - Math.floor(i / 4) * 2); meshes.forEach(x => x.setMatrixAt(i, m)); }
    meshes.forEach(x => { x.instanceMatrix.needsUpdate = true; });
  }
}

// ---------- 朝向鏡頭的標記 ----------
function label(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
  s.renderOrder = 10; return s;
}
const FONT = '"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
function emblem(g, kind, x, y, r) {
  g.beginPath();
  if (kind === 'bars') for (const k of [-.45, .45]) { g.moveTo(x - r, y + k * r); g.lineTo(x + r, y + k * r); }
  else for (const k of [-.5, .4]) { g.moveTo(x - r, y + (k + .4) * r); g.lineTo(x, y + (k - .4) * r); g.lineTo(x + r, y + (k + .4) * r); }
  g.stroke();
}
function relationShape(g, kind, x, y, r) {
  g.beginPath();
  if (kind === 'star') for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  if (kind === 'shield') { g.moveTo(x - r * .8, y - r * .8); g.lineTo(x + r * .8, y - r * .8); g.lineTo(x + r * .8, y + r * .1); g.quadraticCurveTo(x + r * .7, y + r * .7, x, y + r); g.quadraticCurveTo(x - r * .7, y + r * .7, x - r * .8, y + r * .1); }
  if (kind === 'cross') { const t = r * .32, q = r * .95; for (const [a, c] of [[-t, -q], [t, -q], [t, -t], [q, -t], [q, t], [t, t], [t, q], [-t, q], [-t, t], [-q, t], [-q, -t], [-t, -t]]) g.lineTo(x + (a - c) * .707, y + (a + c) * .707); }
  g.closePath(); g.fill();
}
const markerGroup = new THREE.Group(), dimGroup = new THREE.Group(); scene.add(markerGroup, dimGroup);
function clear(group) { for (const o of [...group.children]) { o.material.map?.dispose(); o.material.dispose(); if (!o.isSprite) o.geometry?.dispose(); group.remove(o); } }
function buildMarkers(view) {
  clear(markerGroup);
  for (const s of L.SEATS) {
    const rel = L.relation(view, s.id), R = rel && L.RELATIONS[rel], team = L.TEAMS[s.team];
    const m = label(420, 240, (g, w, h) => {
      g.fillStyle = 'rgba(7,11,15,.86)'; g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, 22); g.fill();
      g.lineWidth = rel === 'self' ? 12 : 6; g.strokeStyle = R ? R.color : '#c8d2da'; if (rel === 'enemy') g.setLineDash([26, 14]); g.stroke(); g.setLineDash([]);
      g.fillStyle = s.primary; g.beginPath(); g.roundRect(32, 32, 112, 112, 16); g.fill();
      g.lineWidth = 9; g.strokeStyle = s.secondary; g.stroke();
      g.fillStyle = '#fff'; g.strokeStyle = '#081018'; g.lineWidth = 8; g.font = `800 78px ${FONT}`; g.strokeText(s.name, 88, 91); g.fillText(s.name, 88, 91);
      g.fillStyle = g.strokeStyle = s.secondary; g.lineWidth = 8; emblem(g, team.emblem, 64, 188, 22);
      g.font = `700 36px ${FONT}`; g.textAlign = 'left'; g.fillText(team.name, 100, 188);
      g.textAlign = 'center';
      g.fillStyle = R ? R.color : '#c8d2da';
      if (R) { relationShape(g, R.shape, 292, 78, 48); g.font = `800 58px ${FONT}`; g.fillText(R.name, 292, 176); }
      else { g.font = `800 46px ${FONT}`; g.fillText('核心', 292, 120); }
    });
    m.position.set(...L.markerPos(s.id)); m.scale.set(L.MARKER_SIZE.w, L.MARKER_SIZE.h, 1); markerGroup.add(m);
    const p = label(330, 84, (g, w, h) => {
      g.fillStyle = 'rgba(7,11,15,.82)'; g.beginPath(); g.roundRect(3, 3, w - 6, h - 6, 14); g.fill(); g.lineWidth = 5; g.strokeStyle = s.secondary; g.stroke();
      g.fillStyle = R ? R.color : '#c8d2da'; if (R) relationShape(g, R.shape, 46, 42, 24);
      g.fillStyle = '#fff'; g.font = `700 40px ${FONT}`; g.fillText(`${s.name}席購買區`, R ? 190 : 165, 43);
    });
    const [u, v] = L.shopPos(s.id); p.position.set(u, 5.6, v); p.scale.set(7.2, 1.83, 1); markerGroup.add(p);
  }
}
function buildDims() {
  const line = new THREE.LineBasicMaterial({ color: 0xffe9a8, depthTest: false, transparent: true });
  const span = (a, b, text) => {
    const pts = [[a, b]], dx = b[0] - a[0], dz = b[1] - a[1], n = Math.hypot(dx, dz), px = -dz / n * .7, pz = dx / n * .7;
    for (const q of [a, b]) pts.push([[q[0] + px, q[1] + pz], [q[0] - px, q[1] - pz]]);
    const o = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts.flat().map(p => new THREE.Vector3(p[0], .6, p[1]))), line.clone()); o.renderOrder = 8; dimGroup.add(o);
    const s = label(330, 76, (g, w, h) => { g.fillStyle = 'rgba(30,24,6,.88)'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffe9a8'; g.font = `800 46px ${FONT}`; g.fillText(text, w / 2, h / 2 + 2); });
    s.position.set((a[0] + b[0]) / 2, .8, (a[1] + b[1]) / 2); s.scale.set(8.6, 1.98, 1); dimGroup.add(s);
  };
  const c = D.coreDistance, hw = D.laneWidth / 2;
  span([0, 0], [0, c], `中心→核心 ${c}`);
  span([-hw, 13], [hw, 13], `路寬 ${D.laneWidth}`);
  span([-D.junctionRadius, 0], [D.junctionRadius, 0], `交會區 Ø${D.junctionRadius * 2}`);
  const [sx, sz] = L.shopPos('S');
  span([sx - D.shopWidth / 2, sz + 6.4], [sx + D.shopWidth / 2, sz + 6.4], `購買區寬 ${D.shopWidth}`);
  span([sx + 8.4, sz - D.shopDepth / 2], [sx + 8.4, sz + D.shopDepth / 2], `深 ${D.shopDepth}`);
  span([hw, 19], [sx - D.shopWidth / 2, 19], `離路 ${L.shopClearance()}`);
  span([-D.corePlatformRadius, c + 8], [D.corePlatformRadius, c + 8], `核心平台 Ø${D.corePlatformRadius * 2}`);
}

// ---------- 啟動 ----------
let renderer, camera, env, view = L.parseView('team:A'), from = null, angles = L.viewAngles(view), anim = 1, dims = false, still = matchMedia('(prefers-reduced-motion: reduce)').matches, time = 2, prev = 0, dirty = true;
function buildEnvironment() { // 自製攝影棚環境光，供金屬反射
  const e = new THREE.Scene(); e.background = new THREE.Color(0x1c252d);
  const add = (color, k, w, h, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); e.add(m); };
  add(0xffe6c4, 6, 8, 8, 8, 11, 5); add(0x9fc4e8, 2.4, 14, 10, -13, 7, -6); add(0xffffff, 1.1, 24, 24, 0, 16, 0);
  const p = new THREE.PMREMGenerator(renderer); env = p.fromScene(e, .05).texture; p.dispose();
}
function applyPose() {
  const to = L.viewAngles(view), k = anim * anim * (3 - 2 * anim);
  if (from && anim < 1) {
    const turn = Math.atan2(Math.sin(to.az - from.az), Math.cos(to.az - from.az));
    angles = { az: from.az + turn * k, el: from.el + (to.el - from.el) * k };
  } else angles = to;
  const c = L.fitAngles(angles, safe.w / safe.h);
  const b = new THREE.Matrix4().makeBasis(new THREE.Vector3(...c.right), new THREE.Vector3(...c.up), new THREE.Vector3(...c.forward).negate());
  camera.position.set(...c.position); camera.quaternion.setFromRotationMatrix(b);
}
let safe = { w: 16, h: 9 };
// 畫布滿版，但戰場取景在面板以外的安全區內
function measure(w, h) {
  const portrait = h > w, bar = $('bar').getBoundingClientRect(), panel = $('panel').getBoundingClientRect(), open = $('panel').open;
  const left = portrait ? 0 : bar.right + 8, top = portrait ? bar.bottom + 8 : 0;
  const right = portrait || !open ? 0 : w - panel.left + 8, bottom = portrait ? (open ? h - panel.top + 8 : 96) : (h > 560 ? 44 : 26);
  // 空間足夠時左右對稱，讓自己的核心留在畫面中央
  const side = !portrait && w - 2 * Math.max(left, right) > h * 1.25 ? Math.max(left, right) : null;
  const l = side ?? left, r = side ?? right;
  return { l, t: top, w: Math.max(80, w - l - r), h: Math.max(80, h - top - bottom) };
}
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
  safe = measure(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
  camera.aspect = safe.w / safe.h; camera.fov = L.FOV; camera.setViewOffset(safe.w, safe.h, -safe.l, -safe.t, w, h); dirty = true;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.1, (now - prev) / 1000 || 0); prev = now;
  if (anim < 1) { anim = Math.min(1, anim + dt / .7); dirty = true; }
  if (!still) { time += dt; dirty = true; }
  if (!dirty) return; dirty = false;
  moveSquads(time); applyPose(); updateCompass();
  dimGroup.visible = dims; renderer.render(scene, camera);
}
function updateCompass() {
  const p = new THREE.Vector3(0, 0, -1).transformDirection(camera.matrixWorldInverse.copy(camera.matrixWorld.compose(camera.position, camera.quaternion, camera.scale)).invert());
  $('needle').style.transform = `rotate(${Math.atan2(p.x, p.y)}rad)`;
}
function start3d() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  camera = new THREE.PerspectiveCamera(L.FOV, 1.6, 5, 400);
  scene.background = new THREE.Color(0x0a0f14); scene.fog = new THREE.Fog(0x0a0f14, 150, 290);
  buildEnvironment(); scene.environment = env; scene.environmentIntensity = .75;
  scene.add(new THREE.HemisphereLight(0xbcd4ea, 0x2a221a, .7));
  const key = new THREE.DirectionalLight(0xffe2bd, 2.9); key.position.set(-30, 62, 24); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -56, right: 56, top: 56, bottom: -56, near: 10, far: 150 }); key.shadow.bias = -.0006; key.shadow.normalBias = .04; scene.add(key);
  const rim = new THREE.DirectionalLight(0x86b4e6, .9); rim.position.set(30, 30, -40); scene.add(rim);
  buildJunction(); L.SEATS.forEach(buildSeat); buildSurroundings(); batch.flush(); buildSquads(); buildDims();
  const watch = new ResizeObserver(resize); [canvas, $('panel'), $('bar')].forEach(o => watch.observe(o)); $('panel').addEventListener('toggle', resize); resize(); requestAnimationFrame(frame);
}

// ---------- 介面 ----------
function plan2d() { // 由同一份資料產生的北向俯視圖；3D 不可用時也是備援
  const q = D.junctionRadius, hw = D.laneWidth / 2, c = D.coreDistance; let o = '';
  for (const s of L.SEATS) {
    const a = -L.seatIndex(s.id) * 90, [x, z] = L.corePos(s.id), [u, v] = L.shopPos(s.id), rel = L.relation(view, s.id), R = rel && L.RELATIONS[rel];
    o += `<g transform="rotate(${a})"><rect x="${-hw}" y="${-c}" width="${hw * 2}" height="${c - q + 2}" fill="#59636b"/><rect x="${-D.shopTangent - D.shopWidth / 2}" y="${-D.shopRadial - D.shopDepth / 2}" width="${D.shopWidth}" height="${D.shopDepth}" fill="${s.primary}" stroke="${s.secondary}"/></g><circle cx="${x}" cy="${z}" r="${D.corePlatformRadius}" fill="${s.primary}" stroke="${R ? R.color : s.secondary}" stroke-width="${rel === 'self' ? 2.4 : 1.4}" ${rel === 'enemy' ? 'stroke-dasharray="3 2"' : ''}/><text x="${x}" y="${z + 2.6}">${s.name}</text><text class="sm" x="${u}" y="${v + 1.6}">購買</text>`;
  }
  $('plan').innerHTML = `<polygon points="${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const t = Math.PI / 8 + i * Math.PI / 4; return `${Math.cos(t) * q},${Math.sin(t) * q}`; })}" fill="#6b757d"/>${o}`;
}
function setView(v, jump) {
  if (camera && !jump) { from = { ...angles }; anim = 0; } else anim = 1;
  view = v; dirty = true; if (renderer) buildMarkers(v); plan2d();
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', b.dataset.view === L.viewKey(v));
  const names = { team: () => `隊伍基準：${L.TEAMS[v.id].name}（${L.seatsOf(v.id).map(s => s.name).join('＋')}）在畫面下方`, seat: () => { const ally = L.seatsOf(L.seatById(v.id).team).find(s => s.id !== v.id); return `個人基準：${L.seatById(v.id).name}席固定在下方中央，購買區在右下，隊友${ally.name}席在${L.nextCcw(v.id).id === ally.id ? '右' : '左'}側`; }, plan: () => '北向俯視：北在上、東在右，校對座標用，不分敵我' };
  $('status').textContent = names[v.kind]();
}
function writeHash() { const s = `#view=${L.viewKey(view)}${dims ? '&dims=1' : ''}${still ? '&still=1' : ''}`; try { history.replaceState(null, '', s); } catch { /* file:// 限制時略過 */ } }
function readHash(jump) {
  const h = new URLSearchParams(location.hash.slice(1)); dims = h.get('dims') === '1'; if (h.get('still') === '1') still = true;
  $('dims').setAttribute('aria-pressed', dims); $('still').setAttribute('aria-pressed', still);
  if (h.get('panel') === '0') $('panel').removeAttribute('open'); setView(L.parseView(h.get('view')) || view, jump);
}
$('teams').innerHTML = Object.values(L.TEAMS).map(t => `<button data-view="team:${t.id}">${t.name}</button>`).join('');
$('seats').innerHTML = L.SEATS.map(s => `<button data-view="seat:${s.id}"><i style="background:${s.primary};border-color:${s.secondary}"></i>${s.name}</button>`).join('');
$('colors').innerHTML = L.SEATS.map(s => `<tr><th>${s.name}</th><td><i style="background:${s.primary}"></i>${s.primaryName}<code>${s.primary}</code></td><td><i style="background:${s.secondary}"></i>${s.secondaryName}<code>${s.secondary}</code></td><td>${L.TEAMS[s.team].name}</td></tr>`).join('');
$('sizes').innerHTML = [['戰場中心→核心', D.coreDistance], ['路寬', D.laneWidth], ['交會區直徑', D.junctionRadius * 2], ['核心平台直徑', D.corePlatformRadius * 2], ['購買區', `${D.shopWidth} × ${D.shopDepth}`], ['購買區離路淨距', L.shopClearance()], ['每席信標（示意）', D.padCount]].map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('');
document.addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) { setView(L.parseView(b.dataset.view), still); writeHash(); } });
$('dims').onclick = () => { dims = !dims; $('dims').setAttribute('aria-pressed', dims); dirty = true; writeHash(); };
$('still').onclick = () => { still = !still; $('still').setAttribute('aria-pressed', still); dirty = true; writeHash(); };
addEventListener('hashchange', () => readHash(still));
if (innerHeight < 560 || innerWidth < 900) $('panel').removeAttribute('open');
try { start3d(); } catch (err) { console.error(err); renderer = camera = null; document.body.classList.add('no3d'); }
readHash(true);
// 供自動核對：實際鏡頭下所有取景點的 NDC 極值與繪製統計
window.__dev05 = { info: () => ({ view: L.viewKey(view), calls: renderer?.info.render.calls, triangles: renderer?.info.render.triangles }), safeBox: () => { // 取景點在實際鏡頭下的像素範圍，對照安全區
    applyPose(); camera.updateMatrixWorld(); const W = canvas.clientWidth, H = canvas.clientHeight, b = [1e9, 1e9, -1e9, -1e9];
    for (const p of L.framePoints(view)) { const v = new THREE.Vector3(...p).project(camera), x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H; b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    return { inside: b[0] >= safe.l && b[1] >= safe.t && b[2] <= safe.l + safe.w && b[3] <= safe.t + safe.h, box: b.map(Math.round), safe: [safe.l, safe.t, safe.l + safe.w, safe.t + safe.h].map(Math.round), size: [W, H] };
  } };
if (/[#&]qa=1/.test(location.hash)) setTimeout(() => console.log('DEV05QA ' + JSON.stringify({ ...window.__dev05.info(), ...window.__dev05.safeBox() })), 1500);
