import assert from 'node:assert/strict';
import * as L from './layout.mjs';

const near = (a, b, e = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < e);
// 1. 席位順序與購買區方向
assert.deepEqual(L.SEATS.map(s => s.name), ['北', '西', '南', '東']);
assert.deepEqual([0, 1, 2, 3].map(i => L.nextCcw(L.SEATS[i].id).name), ['西', '南', '東', '北']);
for (const s of L.SEATS) {
  assert.ok(near(L.ccw(s.dir), L.nextCcw(s.id).dir), `${s.name}席逆時鐘方向`);
  const a = L.seatYaw(s.id); // 與 Three.js rotation.y 同式：本地 (0,-1) 應轉到該席
  assert.ok(near([-Math.sin(a), -Math.cos(a)], s.dir), `${s.name}席旋轉角`);
  const p = L.shopPos(s.id), d = s.dir, t = L.ccw(d);
  assert.ok(p[0] * t[0] + p[1] * t[1] > 0, `${s.name}席購買區在逆時鐘側`);
  assert.ok(p[0] * d[0] + p[1] * d[1] > L.DIM.shopTangent, `${s.name}席購買區靠近自己的臂`);
  for (const [x, z] of L.shopCorners(s.id)) {
    assert.ok(Math.abs(x) > L.DIM.laneWidth / 2 && Math.abs(z) > L.DIM.laneWidth / 2, '購買區在道路之外');
    for (const o of L.SEATS) {
      const c = L.corePos(o.id);
      assert.ok(Math.hypot(x - c[0], z - c[1]) > L.DIM.corePlatformRadius, '購買區不壓核心平台');
    }
  }
}
assert.deepEqual(L.SEATS.map(s => { const [x, z] = L.shopPos(s.id); return (z < 0 ? '北' : '南') + (x < 0 ? '西' : '東'); }), ['北西', '南西', '南東', '北東']);
assert.ok(L.shopClearance() > 0);
// 2. 隊伍：每隊兩席且相鄰，對面是敵方
for (const t of Object.keys(L.TEAMS)) assert.equal(L.seatsOf(t).length, 2);
for (const s of L.SEATS) assert.notEqual(s.team, L.opposite(s.id).team);
// 3. 所有視角×比例完整入鏡
const aspects = { '16:9': 16 / 9, '4:3': 4 / 3, '19.5:9': 19.5 / 9, '直式9:16': 9 / 16 };
const rows = [];
for (const key of L.ALL_VIEWS) for (const [name, asp] of Object.entries(aspects)) {
  const v = L.parseView(key), cam = L.fitCamera(v, asp);
  assert.ok(Math.abs(L.viewBasis(v).up.reduce((s, x, i) => s + x * cam.forward[i], 0)) < 1e-9);
  const m = [0, 0];
  for (const p of L.framePoints(v)) { const q = L.project(cam, asp, p); m[0] = Math.max(m[0], Math.abs(q[0])); m[1] = Math.max(m[1], Math.abs(q[1])); }
  assert.ok(Math.max(...m) <= .9501, `${key} ${name} 出框 ${m}`);
  rows.push({ view: key, aspect: name, maxX: m[0].toFixed(3), maxY: m[1].toFixed(3) });
}
// 4. 個人基準：自己核心與購買區在四席畫面位置相同，且核心置中、在下半部
const at = (key, fn) => { const v = L.parseView(key), cam = L.fitCamera(v, 16 / 9), [x, z] = fn(v); return L.project(cam, 16 / 9, [x, 0, z]); };
const own = ['N', 'W', 'S', 'E'].map(id => at('seat:' + id, () => L.corePos(id)));
const shop = ['N', 'W', 'S', 'E'].map(id => at('seat:' + id, () => L.shopPos(id)));
for (const i of [1, 2, 3]) { assert.ok(near(own[i], own[0])); assert.ok(near(shop[i], shop[0])); }
assert.ok(Math.abs(own[0][0]) < 1e-9 && own[0][1] < 0 && shop[0][0] > 0 && shop[0][1] < 0);
// 5. 隊伍基準：兩席在下半部、左右對稱，兩隊位置相同
const team = t => L.seatsOf(t).map(s => at('team:' + t, () => L.corePos(s.id)));
const A = team('A'), B = team('B');
assert.ok(near(A[0], B[0]) && near(A[1], B[1]));
assert.ok(A.every(p => p[1] < 0) && Math.abs(A[0][0] + A[1][0]) < 1e-9);
// 6. 俯視：北在上、東在右
assert.ok(at('plan', () => L.corePos('N'))[1] > 0 && at('plan', () => L.corePos('E'))[0] > 0);
// 7. 關係
assert.deepEqual(['N', 'W', 'S', 'E'].map(i => L.relation(L.parseView('seat:N'), i)), ['self', 'ally', 'enemy', 'enemy']);
assert.deepEqual(['N', 'W', 'S', 'E'].map(i => L.relation(L.parseView('team:B'), i)), ['enemy', 'enemy', 'own', 'own']);
// 8. 主色在一般、紅色弱、綠色弱視覺（Machado 2009, severity 1）下的 OKLab 距離
const lin = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
const CVD = {
  一般: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  紅色弱: [[.152286, 1.052583, -.204868], [.114503, .786281, .099216], [-.003882, -.048116, 1.051998]],
  綠色弱: [[.367322, .860646, -.227968], [.280085, .672501, .047413], [-.01182, .04294, .968881]],
};
const lab = ([r, g, b]) => {
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
};
const color = {};
for (const [name, M] of Object.entries(CVD)) {
  const labs = L.SEATS.map(s => { const c = lin(s.primary); return lab(M.map(r => Math.max(0, r[0] * c[0] + r[1] * c[1] + r[2] * c[2]))); });
  let min = Infinity, pair;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { const d = Math.hypot(...labs[i].map((v, k) => v - labs[j][k])); if (d < min) { min = d; pair = L.SEATS[i].name + L.SEATS[j].name; } }
  color[name] = `${min.toFixed(3)}（${pair}）`;
  assert.ok(min > .08, `${name} 主色最近距離 ${min} ${pair}`);
}
console.table(rows);
console.log('主色最近 OKLab 距離', color);
console.log('DEV05 layout QA: OK');
