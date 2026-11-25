import * as THREE from 'three';
import * as L from './layout.mjs';
import * as W from './world.js';

const { scene, seatMats, MAT, FONT, label } = W, D = L.DIM;
const $ = id => document.getElementById(id);
const canvas = $('stage');

// ---------- 比例示意部隊：履帶無人機（原創），不參與判定 ----------
const squads = [];
function buildSquads() {
  const { hull, dark, lamp } = W.droneGeometries();
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

const markerGroup = new THREE.Group(), dimGroup = new THREE.Group(); scene.add(markerGroup, dimGroup);
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
let renderer, camera, view = L.parseView('team:A'), from = null, angles = L.viewAngles(view), anim = 1, dims = false, cvd = 'none', still = matchMedia('(prefers-reduced-motion: reduce)').matches, time = 2, prev = 0, dirty = true;
function applyPose() {
  const to = L.viewAngles(view), k = anim * anim * (3 - 2 * anim);
  if (from && anim < 1) {
    const turn = Math.atan2(Math.sin(to.az - from.az), Math.cos(to.az - from.az));
    angles = { az: from.az + turn * k, el: from.el + (to.el - from.el) * k };
  } else angles = to;
  W.poseCamera(camera, angles, safe);
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
function updateCompass() { $('needle').style.transform = `rotate(${W.northAngle(camera)}rad)`; }
function start3d() {
  ({ renderer, camera } = W.createWorld(canvas)); buildSquads(); buildDims();
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
  view = v; dirty = true; if (renderer) W.buildMarkers(markerGroup, v); plan2d();
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', b.dataset.view === L.viewKey(v));
  const names = { team: () => `隊伍基準：${L.TEAMS[v.id].name}（${L.seatsOf(v.id).map(s => s.name).join('＋')}）在畫面下方`, seat: () => { const ally = L.seatsOf(L.seatById(v.id).team).find(s => s.id !== v.id); return `個人基準：${L.seatById(v.id).name}席固定在下方中央，購買區在右下，隊友${ally.name}席在${L.nextCcw(v.id).id === ally.id ? '右' : '左'}側`; }, plan: () => '北向俯視：北在上、東在右，校對座標用，不分敵我' };
  $('status').textContent = document.body.classList.contains('no3d') ? '此裝置無法啟用 3D，以北向俯視圖呈現' : names[v.kind]();
}
function writeHash() { const s = `#view=${L.viewKey(view)}${dims ? '&dims=1' : ''}${still ? '&still=1' : ''}${cvd !== 'none' ? `&cvd=${cvd}` : ''}`; try { history.replaceState(null, '', s); } catch { /* file:// 限制時略過 */ } }
function readHash(jump) {
  const h = new URLSearchParams(location.hash.slice(1)); dims = h.get('dims') === '1'; if (h.get('still') === '1') still = true;
  $('dims').setAttribute('aria-pressed', dims); $('still').setAttribute('aria-pressed', still);
  setCvd(h.get('cvd'));
  if (h.get('panel') === '0') $('panel').removeAttribute('open'); setView(L.parseView(h.get('view')) || view, jump);
}
$('teams').innerHTML = Object.values(L.TEAMS).map(t => `<button data-view="team:${t.id}">${t.name}</button>`).join('');
$('seats').innerHTML = L.SEATS.map(s => `<button data-view="seat:${s.id}"><i style="background:${s.primary};border-color:${s.secondary}"></i>${s.name}</button>`).join('');
$('colors').innerHTML = L.SEATS.map(s => `<tr><th>${s.name}</th><td><i style="background:${s.primary}"></i>${s.primaryName}<code>${s.primary}</code></td><td><i style="background:${s.secondary}"></i>${s.secondaryName}<code>${s.secondary}</code></td><td>${L.TEAMS[s.team].name}<code>${L.TEAMS[s.team].family}</code></td></tr>`).join('');
$('sizes').innerHTML = [['戰場中心→核心', D.coreDistance], ['路寬', D.laneWidth], ['交會區直徑', D.junctionRadius * 2], ['核心平台直徑', D.corePlatformRadius * 2], ['購買區', `${D.shopWidth} × ${D.shopDepth}`], ['購買區離路淨距', L.shopClearance()], ['每席信標（示意）', D.padCount]].map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('');
document.addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) { setView(L.parseView(b.dataset.view), still); writeHash(); } });
$('dims').onclick = () => { dims = !dims; $('dims').setAttribute('aria-pressed', dims); dirty = true; writeHash(); };
// 色覺模擬：只影響預覽顯示
$('cvd').innerHTML = Object.entries(L.CVD).map(([k, c]) => `<option value="${k}">色覺：${c.name}</option>`).join('');
$('filters').innerHTML = Object.entries(L.CVD).map(([k, c]) => `<filter id="cvd-${k}" color-interpolation-filters="linearRGB"><feColorMatrix values="${c.m.map(r => [...r, 0, 0].join(' ')).join(' ')} 0 0 0 1 0"/></filter>`).join('');
function setCvd(k) { cvd = L.CVD[k] ? k : 'none'; $('cvd').value = cvd; for (const o of [canvas, $('plan'), $('bar'), $('panel')]) o.style.filter = cvd === 'none' ? '' : `url(#cvd-${cvd})`; }
$('cvd').onchange = e => { setCvd(e.target.value); writeHash(); };
$('still').onclick = () => { still = !still; $('still').setAttribute('aria-pressed', still); dirty = true; writeHash(); };
addEventListener('hashchange', () => readHash(still));
if (innerHeight < 560 || innerWidth < 900) $('panel').removeAttribute('open');
try { start3d(); } catch (err) { console.error(err); renderer = camera = null; document.body.classList.add('no3d'); document.body.prepend($('plan')); }
readHash(true);
// 供自動核對：實際鏡頭下所有取景點的 NDC 極值與繪製統計
window.__dev05 = { info: () => ({ view: L.viewKey(view), calls: renderer?.info.render.calls, triangles: renderer?.info.render.triangles }), safeBox: () => { // 取景點在實際鏡頭下的像素範圍，對照安全區
    applyPose(); camera.updateMatrixWorld(); const W = canvas.clientWidth, H = canvas.clientHeight, b = [1e9, 1e9, -1e9, -1e9];
    for (const p of L.framePoints(view)) { const v = new THREE.Vector3(...p).project(camera), x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H; b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    return { inside: b[0] >= safe.l && b[1] >= safe.t && b[2] <= safe.l + safe.w && b[3] <= safe.t + safe.h, box: b.map(Math.round), safe: [safe.l, safe.t, safe.l + safe.w, safe.t + safe.h].map(Math.round), size: [W, H], roof: Object.fromEntries(L.SEATS.map(s => { const [x, z] = L.corePos(s.id), v = new THREE.Vector3(x, 7.2, z).project(camera); return [s.id, [Math.round((v.x + 1) / 2 * W), Math.round((1 - v.y) / 2 * H)]]; })) };
  } };
if (/[#&]qa=1/.test(location.hash)) setTimeout(() => console.log('DEV05QA ' + JSON.stringify({ ...window.__dev05.info(), ...window.__dev05.safeBox() })), 1500);
