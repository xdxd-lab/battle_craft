// DEV02 呈現層：讀取模擬狀態、把輸入換成指令。規則都在 sim.mjs。
import * as THREE from 'three';
import * as L from '../dev05-layout/layout.mjs';
import * as W from '../dev05-layout/world.js';
import * as S from './sim.mjs';
import { ARENA, corePos, fitArenaCamera, fitNearCamera } from './arena.mjs';
import * as SF from './surfaces.js';
import { createDossier } from './dossier.js';
import { detailCommander, detailMaterials, triangles } from './detail-models.js';
import { unitModels, FLY_HEIGHT } from './unit-models.js';
import { KINDS, KIND_IDS, ATTACKS, CORE } from './roster.mjs';
import * as HS from './high-scene.js';

const $ = id => document.getElementById(id), canvas = $('stage'), { scene } = W, R = S.RULES;
const hash = new URLSearchParams(location.hash.slice(1));
const SPEEDS = [1, 2, 4], DEFAULT_SPEED = 1;
let state = null, record = null, seat = null, queue = [], mode = 'menu', speed = DEFAULT_SPEED, accumulator = 0, previous = 0, logRows = [];
let renderer, camera, dossier, view = L.parseView('team:A'), angles = L.viewAngles(view), from = null, anim = 1, safe = { l: 0, t: 0, w: 16, h: 9 };

// ---------- 場景物件 ----------
const MAX = 128, CORE_MAX = S.coreMax(S.VERSION), dummy = new THREE.Object3D(), markerGroup = new THREE.Group(), padGroup = new THREE.Group(), fallGroup = new THREE.Group();
scene.add(markerGroup, padGroup, fallGroup);
let squads, commanders, barBack, barFill, shots, puffs, orbs, glaives, shadows;
const inst = (geo, mat, n = MAX) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.count = 0; scene.add(m); return m; };
let bodyTriangles;
const looks = {};
function buildActors() {
  const commander = {
    hull: new THREE.CylinderGeometry(.5, .75, 1.7, 8).translate(0, .95, 0),
    dark: new THREE.CylinderGeometry(.4, .4, .6, 12).translate(0, 2.1, 0),
    lamp: new THREE.BoxGeometry(.6, .16, .3).translate(0, 2.15, .28),
  };
  const build = q => Object.fromEntries(KIND_IDS.map(k => [k, unitModels[q][k]()]));
  looks.std = { ...build('std'), commander }; looks.high = { ...build('high'), commander: detailCommander() };
  squads = {}; commanders = {};
  for (const s of L.SEATS) {
    const M = W.seatMats[s.id];
    squads[s.id] = Object.fromEntries(KIND_IDS.map(k => [k, [['hull', M.paint], ['dark', W.MAT.black], ['lamp', M.glow]].map(([part, m]) => { const x = inst(looks.std[k][part], m); x.castShadow = true; return x; })]));
    const c = new THREE.Group(), add = (g, m, y, z = 0) => { const x = new THREE.Mesh(g, m); x.position.set(0, y, z); x.castShadow = true; c.add(x); return x; };
    add(commander.hull, M.paint, 0); add(commander.dark, W.MAT.steel, 0); add(commander.lamp, M.glow, 0);
    const ring = add(new THREE.TorusGeometry(1, .1, 6, 24), M.glow, .16); ring.rotation.x = Math.PI / 2; ring.castShadow = false;
    scene.add(c); commanders[s.id] = c;
  }
  const flat = color => new THREE.MeshBasicMaterial({ color, toneMapped: false, fog: false, depthTest: false, transparent: true });
  barBack = inst(new THREE.PlaneGeometry(1, 1), flat(0x05080b), 2048); barFill = inst(new THREE.PlaneGeometry(1, 1), flat(0xffffff), 2048);
  barBack.renderOrder = 6; barFill.renderOrder = 7;
  shots = inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), 128); puffs = inst(new THREE.SphereGeometry(.5, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: .7 }), 128);
  shots.live = []; puffs.live = [];
  // 投射物：重騎兵光球與飛螳彈體，位置完全取自模擬狀態
  orbs = inst(new THREE.IcosahedronGeometry(.34, 2), new THREE.MeshBasicMaterial({ toneMapped: false }), 128);
  glaives = inst(new THREE.OctahedronGeometry(.34).scale(1, .35, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), 128);
  shadows = inst(new THREE.CircleGeometry(.55, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x02060a, transparent: true, opacity: .42, depthWrite: false }), 256);
}
const relOf = id => L.relation(view.kind === 'plan' || !seat ? view : { kind: 'seat', id: seat }, id);
const relColor = id => L.RELATIONS[relOf(id)]?.color ?? '#c8d2da';
const relName = id => seat ? { self: '我席', ally: '隊友', enemy: '敵方' }[relOf(id)] : L.TEAMS[L.seatById(id).team].name;
const seatName = id => `${L.seatById(id).name}席`;

let compactPadLabels = false;
function buildPads() {
  W.clear(padGroup);
  if (!seat) return;
  S.PADS.forEach((p, i) => {
    const [x, z] = S.padWorld(seat, i);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R.padRadius, .09, 6, 32), new THREE.MeshBasicMaterial({ color: p.locked ? 0x6a747c : 0xffe9a8, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.set(x, .42, z); ring.userData.pad = i; padGroup.add(ring);
    const t = W.label(compactPadLabels ? 108 : 300, 108, (g, w, h) => {
      g.fillStyle = 'rgba(7,11,15,.84)'; g.beginPath(); g.roundRect(3, 3, w - 6, h - 6, 14); g.fill(); g.lineWidth = 5; g.strokeStyle = p.locked ? '#6a747c' : '#ffe9a8'; g.stroke();
      const lines = compactPadLabels ? [p.locked ? '—' : String(i + 1)]
        : p.locked ? ['未開放'] : [`${i + 1}｜${p.label}`, `${p.cost} 金`];
      g.fillStyle = p.locked ? '#9eabb4' : '#fff';
      g.font = `800 ${compactPadLabels ? 76 : 42}px ${W.FONT}`;
      lines.forEach((line, n) => g.fillText(line, w / 2, h / 2 + 2 + (n - (lines.length - 1) / 2) * 46));
    });
    t.position.set(x, 3.4, z);
    if (compactPadLabels) t.scale.set(2.65, 2.55, 1);
    else t.scale.set(p.locked ? 2.9 : 4.6, p.locked ? 1.05 : 1.66, 1);
    padGroup.add(t);
  });
}
function markFallen(id) {
  const [x, z] = corePos(id);
  const t = W.label(300, 120, (g, w, h) => { g.fillStyle = 'rgba(40,6,10,.92)'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd0d0'; g.font = `800 64px ${W.FONT}`; g.fillText('✕ 失守', w / 2, h / 2 + 3); });
  t.position.set(x, 6, z); t.scale.set(7, 2.8, 1); fallGroup.add(t);
}

// ---------- 鏡頭 ----------
let fittedView, fittedSafe, overview = false;
const markerProjection = new THREE.Vector3(), markerTop = new THREE.Vector3();
function keepMarkersReadable() {
  const { clientWidth: w, clientHeight: h } = canvas;
  const left = $('bar').getBoundingClientRect(), right = $('panel').getBoundingClientRect();
  const margin = 8;
  for (const marker of markerGroup.children) {
    marker.position.copy(marker.userData.anchor);
    markerProjection.copy(marker.position).project(camera);
    if (Math.abs(markerProjection.x) > 1 || Math.abs(markerProjection.z) > 1) continue;
    markerTop.copy(camera.up).applyQuaternion(camera.quaternion).multiplyScalar(marker.scale.y / 2).add(marker.position).project(camera);
    const halfH = (markerTop.y - markerProjection.y) * h / 2;
    const halfW = halfH * marker.scale.x / marker.scale.y;
    let x = (markerProjection.x + 1) * w / 2;
    const y = Math.max(halfH + 10, (1 - markerProjection.y) * h / 2);
    if (marker.scale.y === L.MARKER_SIZE.h) {
      // Move the label inward along the same horizontal line when a HUD column hides it.
      const overlap = box => y + halfH > box.top && y - halfH < box.bottom;
      if (overlap(left)) x = Math.max(x, left.right + halfW + margin);
      if (overlap(right)) x = Math.min(x, right.left - halfW - margin);
      x = THREE.MathUtils.clamp(x, halfW + margin, w - halfW - margin);
    }
    markerProjection.set(x * 2 / w - 1, 1 - y * 2 / h, markerProjection.z);
    marker.position.copy(markerProjection.unproject(camera));
  }
}
function setView(v, jump) {
  if (!jump) { from = { ...angles }; anim = 0; } else { anim = 1; from = null; }
  view = v;
  if (renderer) {
    W.buildMarkers(markerGroup, seat ? { kind: 'seat', id: seat } : v, seat, ARENA);
    for (const marker of markerGroup.children) marker.userData.anchor = marker.position.clone();
  }
  $('view').textContent = v.kind === 'seat' ? '隊伍視角' : seat ? '個人視角' : v.id === 'A' ? '乙隊視角' : '甲隊視角';
}
function nextView() {
  if (!seat) return setView(L.parseView(view.id === 'A' ? 'team:B' : 'team:A'));
  setView(L.parseView(view.kind === 'seat' ? `team:${L.seatById(seat).team}` : `seat:${seat}`));
}
function pose() {
  if (anim === 1 && fittedView === view && fittedSafe === safe) return;
  fittedView = anim === 1 ? view : null; fittedSafe = safe;
  const to = L.viewAngles(view), k = anim * anim * (3 - 2 * anim);
  if (from && anim < 1) { const turn = Math.atan2(Math.sin(to.az - from.az), Math.cos(to.az - from.az)); angles = { az: from.az + turn * k, el: from.el + (to.el - from.el) * k }; } else angles = to;
  W.poseCamera(camera, angles, safe, overview ? fitArenaCamera : (a, aspect) => fitNearCamera(a, aspect, seat)); camera.updateMatrixWorld();
  $('needle').style.transform = `rotate(${W.northAngle(camera)}rad)`; camera.updateMatrixWorld();
  keepMarkersReadable();
}
function setFraming(full) {
  overview = full;
  fittedView = null;
  $('framing').textContent = full ? '切近景' : '切全景';
}
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
  const compact = h <= 560;
  if (compact !== compactPadLabels) { compactPadLabels = compact; buildPads(); }
  const portrait = h > w, bar = $('bar').getBoundingClientRect(), panel = $('panel').getBoundingClientRect(), open = $('panel').open && w >= 1100 && !compact, bottom = portrait ? 120 : h > 560 ? 108 : 48;
  let l = portrait ? 0 : bar.right + 8, r = portrait || !open ? 0 : w - panel.left + 8; const t = portrait ? bar.bottom + 8 : 0;
  if (!portrait && w - 2 * Math.max(l, r) > h * 1.25) l = r = Math.max(l, r);
  safe = { l, t, w: Math.max(80, w - l - r), h: Math.max(80, h - t - bottom) };
  renderer.setPixelRatio(pixelRatio()); renderer.setSize(w, h, false);
  // Shift the whole projection so the floor, markers, and input ray stay aligned.
  const drop = Math.round(h * (compact ? .018 : .026));
  camera.aspect = safe.w / safe.h; camera.fov = L.FOV;
  camera.setViewOffset(safe.w, safe.h, -safe.l, -safe.t - drop, w, h);
  safe = { ...safe, t: safe.t + drop };
}

// ---------- 輸入 → 指令（每個模擬步取最後一個） ----------
function command(c) { if (mode === 'play' && seat && state.seats[seat].alive) queue = [{ seat, ...c }]; }
const keys = new Set(), KEY = { w: [0, 1], arrowup: [0, 1], s: [0, -1], arrowdown: [0, -1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
function sendKeys() { // 螢幕方向依目前鏡頭換成世界方向
  let x = 0, y = 0; for (const k of keys) { x += KEY[k][0]; y += KEY[k][1]; }
  const { right, forward } = L.basisOf(L.viewAngles(view)), n = Math.hypot(forward[0], forward[2]) || 1, q = v => Math.round(v * 1000) / 1000;
  const dx = q(right[0] * x + forward[0] / n * y), dz = q(right[2] * x + forward[2] / n * y);
  command({ type: 'dir', x: dx, z: dz });
}
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.1), hit = new THREE.Vector3();
const pointer = new THREE.Vector2(), probe = new THREE.Mesh(), instance = new THREE.Matrix4(), bounds = new THREE.Sphere(), picks = [];
let mouse = null, hoverAt = 0;
function pointRay(e) {
  const b = canvas.getBoundingClientRect();
  pointer.set((e.clientX - b.left) / b.width * 2 - 1, 1 - (e.clientY - b.top) / b.height * 2);
  ray.setFromCamera(pointer, camera);
}
function unitAt(e) {
  pointRay(e);
  let best = Infinity, kind = null;
  function check(mesh, matrix, name) {
    probe.geometry = mesh.geometry; probe.material = mesh.material; probe.matrixWorld.copy(matrix);
    picks.length = 0;
    probe.raycast(ray, picks);
    for (const hit of picks) if (hit.distance < best) { best = hit.distance; kind = name; }
  }
  for (const id of S.SEAT_IDS) {
    const c = commanders[id];
    if (c.visible) {
      bounds.center.copy(c.position).y += 1.12; bounds.radius = 1.55;
      if (ray.ray.intersectsSphere(bounds)) for (const mesh of c.children.slice(0, 3)) check(mesh, mesh.matrixWorld, 'commander');
    }
    for (const k of KIND_IDS) {
      const meshes = squads[id][k];
      for (let i = 0; i < meshes[0].count; i++) {
        meshes[0].getMatrixAt(i, instance);
        bounds.center.setFromMatrixPosition(instance).y += k === 'dragoon' ? .9 : .58; bounds.radius = k === 'marine' ? 1.3 : 1.8;
        if (ray.ray.intersectsSphere(bounds)) for (const mesh of meshes) check(mesh, instance, k);
      }
    }
  }
  return kind;
}
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') { mouse = e; hoverAt = 0; }
});
canvas.addEventListener('pointerleave', () => { mouse = null; dossier?.hover(null); });
canvas.addEventListener('pointerdown', e => {
  if (!e.isPrimary || e.button !== 0) return;
  canvas.focus();
  if (!state || mode === 'menu') return;
  if (!display.engineering) {
    const kind = unitAt(e);
    if (kind) { dossier.select(kind); return; }
  }
  if (!seat || mode !== 'play') return;
  pointRay(e);
  if (!ray.ray.intersectPlane(plane, hit)) return;
  const [x, z] = S.toLocal(seat, hit.x, hit.z);
  if (Math.abs(x) > ARENA.shopWidth / 2 || Math.abs(z) > ARENA.shopDepth / 2) return say('只能在自己的購買區移動。', 'info');
  command({ type: 'goal', x: hit.x, z: hit.z });
});
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === ' ' && mode !== 'menu' && !document.activeElement?.closest('button, summary')) { e.preventDefault(); return pause(); }
  if (mode !== 'play' || document.activeElement?.closest('#panel')) return;
  if (KEY[k]) { e.preventDefault(); if (!e.repeat && !keys.has(k)) { keys.add(k); sendKeys(); } }
  else if (k === 'v' && !e.repeat) nextView();
  else if (!e.repeat && S.PADS[+k - 1] && !S.PADS[+k - 1].locked) gotoPad(+k - 1);
});
addEventListener('keyup', e => { if (keys.delete(e.key.toLowerCase())) sendKeys(); });
function releaseInput(discardPending) {
  keys.clear();
  queue = discardPending ? [] : queue.filter(c => c.type !== 'dir');
  // 方向歸零進入輸入紀錄，且不取消已生效的點擊目的地。
  if (seat && state.seats[seat].dir) queue.push({ seat, type: 'dir', x: 0, z: 0 });
}
function loseFocus() {
  if (mode !== 'play' && mode !== 'paused') return;
  mouse = null; dossier?.hover(null);
  releaseInput(true);
  if (mode === 'play' && display.engineering) pause();
}
addEventListener('blur', loseFocus);

let backgroundTimer;
function stopBackgroundClock() {
  clearInterval(backgroundTimer);
  backgroundTimer = undefined;
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    stopBackgroundClock();
    previous = 0;
    return;
  }
  loseFocus();
  if (mode !== 'play' || backgroundTimer !== undefined) return;
  // 隱藏分頁常停掉動畫幀。以計時器繼續跑固定步，只補最多一秒，避免頁面解凍時大量追趕。
  let last = performance.now();
  backgroundTimer = setInterval(() => {
    const now = performance.now();
    advance(Math.min(1, (now - last) / 1000));
    last = now;
    if (mode !== 'play') stopBackgroundClock();
  }, 250);
});
function gotoPad(i) { if (!seat) return; const [x, z] = S.padWorld(seat, i); command({ type: 'goal', x, z }); }

// ---------- 事件文字 ----------
const time = tick => { const s = Math.floor(tick / S.HZ); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
function say(text, level) { $('msg').textContent = text; $('msg').dataset.level = level; }
function write(e) {
  const mine = e.seat && e.seat === seat, who = e.seat && seatName(e.seat);
  const text = {
    start: () => ['info', seat ? `對局開始，你是${seatName(seat)}。走到購買區的信標上會自動購兵。` : '觀戰開始，四席皆由電腦控制。'],
    enter: () => mine && ['info', `進入${e.label}信標，停留期間持續自動購兵。`],
    leave: () => mine && ['info', `離開${e.label}信標，停止購兵。`],
    wait: () => mine && ['warn', `金幣不足（需 ${e.cost} 金）；保持站立，存夠會自動購買。`],
    buy: () => ['info', `${who}花 ${e.cost} 金，部署 ${e.count} 名${KINDS[e.kind].name}。${mine ? `剩 ${e.gold} 金。` : ''}`],
    core: () => [e.level === 'critical' ? 'critical' : 'warn', `${who}核心${{ first: '開始受損', half: '剩一半', critical: '危急' }[e.level]}，${Math.ceil(e.hp)}／${CORE_MAX}。`],
    fall: () => ['critical', `${who}核心失守，停止購兵；存活部隊續戰。`],
    reroute: () => ['warn', `${who}的 ${e.count} 名部隊經中央改攻${seatName(e.to)}。`],
    overtime: () => ['critical', `核心過載：所有核心每 2 秒扣 ${CORE.overtimeDamage}。`],
    end: () => ['critical', e.winner === 'draw' ? '平手：兩隊最後核心同一步失守。' : `${L.TEAMS[e.winner].name}獲勝。`],
  }[e.type]?.();
  if (!text) return;
  const [level, body] = text, row = document.createElement('div'); row.className = `log ${level}`;
  const t = document.createElement('time'), n = document.createElement('b'), b = document.createElement('span');
  t.textContent = time(e.tick); n.textContent = e.seat ? relName(e.seat) : '系統'; n.style.color = e.seat ? relColor(e.seat) : '#9eabb4'; b.textContent = body; row.append(t, n, b);
  $('log').prepend(row); while ($('log').children.length > 80) $('log').lastElementChild.remove();
  if (mine || !e.seat || level !== 'info') say(`${time(e.tick)}　${body}`, level);
}

// ---------- 對局 ----------
function start(id, seed = (Date.now() ^ (Math.random() * 2 ** 32)) >>> 0) {
  seat = L.seatById(id) ? id : null;
  record = { version: S.VERSION, seed, bots: S.SEAT_IDS.filter(x => x !== seat), commands: [] };
  state = S.createSim(record); queue = []; keys.clear(); accumulator = 0; mode = 'play'; speed = DEFAULT_SPEED; logRows = [];
  mouse = null; dossier.reset();
  $('log').replaceChildren(); W.clear(fallGroup); shots.live = []; puffs.live = []; prevPos = new Map(); prevShots = new Map();
  buildPads(); setFraming(false); setView(L.parseView(seat ? `seat:${seat}` : 'team:A'), true); shopUi(); $('cover').hidden = true; canvas.focus(); hud();
}
function pause() { if (mode === 'play') {
  mode = 'paused'; releaseInput(false);
  say('已暫停。', 'info'); } else if (mode === 'paused') { mode = 'play'; say('繼續。', 'info'); } accumulator = 0; hud(); }
let prevPos = new Map(), prevShots = new Map();
const heightOf = u => u && KINDS[u.kind].air ? FLY_HEIGHT + .6 : .8;
function tick() {
  const now = queue; queue = [];
  for (const c of now) record.commands.push({ tick: state.tick + 1, ...c });
  prevPos = new Map(state.units.map(u => [u.id, [u.x, u.z]]));
  prevShots = new Map(state.shots.map(s => [s.id, [s.x, s.z]]));
  const before = new Map(state.units.map(u => [u.id, u]));
  for (const e of S.step(state, now)) {
    if (e.type === 'shot') { const u = before.get(e.from); if (u) { shots.live.push({ a: [u.x, heightOf(u), u.z], b: [e.x, e.core ? 2.5 : heightOf(before.get(e.to)), e.z], life: .12, color: L.seatById(e.seat).secondary }); } continue; }
    if (e.type === 'impact') { puffs.live.push({ x: e.x, z: e.z, y: e.kind === 'mutalisk' ? 1.8 : 1.1, size: e.kind === 'dragoon' ? .55 : .3, life: .25, color: L.seatById(e.seat).secondary }); continue; }
    if (e.transient) continue;
    if (e.type === 'death') puffs.live.push({ x: e.x, z: e.z, y: .9, size: 1, life: .4, color: L.seatById(e.seat).primary });
    if (e.type === 'fall') markFallen(e.seat);
    logRows.push(e); write(e);
  }
  while (shots.live.length > 120) shots.live.shift(); while (puffs.live.length > 120) puffs.live.shift();
  if (state.mode === 'end') finish();
}
function finish() {
  mode = 'end'; keys.clear(); record.ticks = state.tick; record.digest = S.digest(state);
  const won = state.winner === 'draw' ? '平手' : !seat ? `${L.TEAMS[state.winner].name}獲勝` : L.seatById(seat).team === state.winner ? '勝利' : '敗北';
  $('card').innerHTML = `<h3 id="result">${won}</h3><p>${time(state.tick)}　種子 ${state.seed}</p><table><tr><th>席位</th><th>核心</th><th>購買</th><th>花費</th><th>部署</th><th>損失</th><th>擊破</th></tr>${L.SEATS.map(s => { const v = state.seats[s.id]; return `<tr><td>${s.name}席（${relName(s.id)}）</td><td>${v.alive ? Math.ceil(v.hp) : '失守'}</td><td>${v.buys}</td><td>${v.spent}</td><td>${v.deployed}</td><td>${v.lost}</td><td>${v.kills}</td></tr>`; }).join('')}</table><div class="row"><button class="go" id="restart">再來一局</button><button id="look">查看戰場</button></div>`;
  $('restart').onclick = menu; $('look').onclick = () => { $('cover').hidden = true; }; $('cover').hidden = false;
}
function menu() {
  mode = 'menu'; $('cover').hidden = false;
  $('card').innerHTML = `<h3>選一席開始</h3><p>甲隊（北＋西）對乙隊（南＋東），其餘席位由電腦控制。走到自己購買區的信標上會自動購兵，錢不夠就站著等，存夠自動買，繼續站著會再買。攻下對方兩座核心即獲勝。三座信標分別購買陸戰隊、重騎兵、飛螳。</p><div id="pick">${L.SEATS.map(s => `<button data-seat="${s.id}"><i style="background:${s.primary};border-color:${s.secondary}"></i><b>${s.name}席</b><small>${L.TEAMS[s.team].name}</small></button>`).join('')}</div><button data-seat="none">觀戰（四席皆電腦）</button><p>點購買區地面、按 1／2／3 或用 WASD／方向鍵移動指揮官；V 切換視角，空白鍵暫停。</p><p><small>場景配件含 3D Garden 模型改造，適用 <a href="https://www.3dgarden.app/licence" target="_blank" rel="noopener" style="color:#99d9f4">3D Garden 授權</a>；地表貼圖來自 Poly Haven（CC0）。</small></p>`;
  for (const b of $('card').querySelectorAll('[data-seat]')) b.onclick = () => start(b.dataset.seat, hash.has('seed') ? +hash.get('seed') >>> 0 : undefined);
}
function shopUi() {
  $('shop').innerHTML = seat ? S.PADS.map((p, i) => p.locked ? '' : `<button data-pad="${i}"><b>${i + 1}　${p.label}</b><small>${p.cost} 金 → ${p.count} 名</small></button>`).join('') : '';
  for (const b of $('shop').querySelectorAll('button')) b.onclick = () => { gotoPad(+b.dataset.pad); canvas.focus(); };
  $('gold-label').textContent = seat ? `${seatName(seat)}金幣` : '金幣'; 
  $('cores').innerHTML = L.SEATS.map(s => `<div class="core" id="core-${s.id}"><b style="background:${s.primary};border-color:${s.secondary}">${s.name}</b><div class="hp" style="color:${relColor(s.id)}"><i></i></div><span style="color:${relColor(s.id)}"></span></div>`).join('');
}
function hud() {
  if (!state) return;
  $('clock').textContent = time(state.tick); $('gold').textContent = seat ? state.seats[seat].gold : '—';
  for (const s of L.SEATS) { const v = state.seats[s.id], e = $('core-' + s.id); e.classList.toggle('down', !v.alive); e.querySelector('i').style.width = `${v.hp / CORE_MAX * 100}%`; e.querySelector('span').textContent = `${relName(s.id)} ${Math.ceil(v.hp)}`; }
  for (const b of $('shop').querySelectorAll('button')) { b.classList.toggle('on', state.seats[seat].pad === +b.dataset.pad); b.disabled = !state.seats[seat].alive || mode === 'end'; }
  $('pause').textContent = mode === 'paused' ? '繼續' : '暫停'; $('pause').disabled = mode === 'end' || mode === 'menu';
  const label = `${SPEEDS[speed] / SPEEDS[DEFAULT_SPEED]}×`;
  $('speed').textContent = label;
  $('speed').setAttribute('aria-label', `遊戲速度 ${label}，切換速度`);
}

// ---------- 顯示設定：只影響呈現，不進模擬與紀錄；保存失敗時照常遊玩 ----------
const DISPLAY_KEY = 'battle_craft.dev02.display';
const display = { bars: true, log: true, surface: 'max', engineering: false, quality: 'high' };
try { const kept = JSON.parse(localStorage.getItem(DISPLAY_KEY) || '{}'); if (!kept.quality) delete kept.surface; Object.assign(display, kept); } catch { /* 無法讀取時用預設值 */ } // 舊版保存的地表不覆蓋高細節預設
if (display.quality !== 'std') display.quality = 'high';
let savedQuality = display.quality;
if (['std', 'high'].includes(hash.get('quality'))) { display.quality = hash.get('quality'); if (display.surface === (display.quality === 'high' ? 'orig' : 'max')) display.surface = display.quality === 'high' ? 'max' : 'orig'; } // 只換掉另一畫質的預設地表，自選的標準／高解析保留
for (const k of ['bars', 'log']) display[k] = display[k] !== false;
display.engineering = display.engineering === true;
if (!SF.TIERS[display.surface]) display.surface = display.quality === 'high' ? 'max' : 'orig';
let savedSurface = display.surface; // 網址 #surface= 只在本次生效，不改寫保存的偏好
if (SF.TIERS[hash.get('surface')]) display.surface = hash.get('surface');
function applyDisplay(save) {
  document.body.classList.toggle('no-bars', !display.bars); document.body.classList.toggle('no-log', !display.log);
  $('opt-engineering').setAttribute('aria-pressed', display.engineering);
  $('opt-bars').setAttribute('aria-pressed', display.bars); $('opt-log').setAttribute('aria-pressed', display.log);
  $('opt-bars').textContent = `血條：${display.bars ? '開' : '關'}`; $('opt-log').textContent = `事件紀錄：${display.log ? '開' : '關'}`;
  $('panel-title').textContent = !display.engineering ? '單位介紹' : display.log ? '戰況紀錄與暫定規則' : '暫定規則';
  const inactive = $(display.engineering ? 'dossier' : 'engineering-panel');
  if (inactive.contains(document.activeElement)) $('panel-title').focus();
  $('engineering-panel').hidden = !display.engineering;
  $('dossier').hidden = display.engineering;
  dossier?.hover(null);
  if (barBack) barBack.visible = barFill.visible = display.bars;
  $('opt-surface').textContent = `地表：${SF.TIERS[display.surface].name}${surfaceBusy ? '…' : ''}`;
  if (save) try { localStorage.setItem(DISPLAY_KEY, JSON.stringify({ ...display, surface: savedSurface, quality: savedQuality })); } catch { /* 無法保存時只在本次生效 */ }
}
// 滑鼠點擊後把焦點還給戰場；鍵盤啟動（detail 為 0）時焦點留在按鈕，可連按切換或 Tab 到下一個
$('opt-bars').onclick = e => { display.bars = !display.bars; applyDisplay(true); if (e.detail) canvas.focus(); };
$('opt-log').onclick = e => { display.log = !display.log; applyDisplay(true); if (e.detail) canvas.focus(); };
$('opt-engineering').onclick = e => { display.engineering = !display.engineering; applyDisplay(true); if (e.detail) canvas.focus(); };
let surfaceBusy = false, surfaceCall = 0;
async function applySurface(save) { // 失敗時回原始材質並提示，不影響對局；連按時只由最後一次收尾
  const my = ++surfaceCall; surfaceBusy = true; applyDisplay(false);
  try { await SF.setSurface(display.surface); } catch { if (my === surfaceCall) { display.surface = 'orig'; say('地表材質載入失敗，已回原始材質。', 'warn'); } }
  if (my !== surfaceCall) return;
  surfaceBusy = false; applyDisplay(save);
}
$('opt-surface').onclick = e => { const k = Object.keys(SF.TIERS); display.surface = savedSurface = k[(k.indexOf(display.surface) + 1) % k.length]; applySurface(true); if (e.detail) canvas.focus(); };
applyDisplay(false);

// ---------- 畫質：模型、場景層、解析度一起切換；只換呈現 ----------
const heroMats = {};
function applyQuality() {
  const high = display.quality === 'high', look = looks[display.quality];
  const count = parts => Object.values(parts).reduce((n, g) => n + triangles(g), 0);
  bodyTriangles = Object.fromEntries([...KIND_IDS, 'commander'].map(k => [k, count(look[k])]));
  for (const s of L.SEATS) {
    const M = W.seatMats[s.id];
    const pick = (paint, dark) => high ? (heroMats[s.id + dark.uuid] ??= detailMaterials(paint, dark)) : [paint, dark];
    const [dh, dd] = pick(M.paint, W.MAT.black), [ch, cd] = pick(M.paint, W.MAT.steel);
    for (const k of KIND_IDS) for (const [i, part, mat] of [[0, 'hull', dh], [1, 'dark', dd], [2, 'lamp', M.glow]]) { squads[s.id][k][i].geometry = look[k][part]; squads[s.id][k][i].material = mat; }
    for (const [i, part, mat] of [[0, 'hull', ch], [1, 'dark', cd], [2, 'lamp', M.glow]]) { const m = commanders[s.id].children[i]; m.geometry = look.commander[part]; m.material = mat; }
  }
  HS.setHighScene(high); dossier?.refresh();
  $('opt-quality').textContent = `畫質：${high ? '高' : '標準'}`; $('opt-quality').setAttribute('aria-pressed', high);
}
// 高細節在低密度螢幕以 1.5 倍超取樣，上限 2
const pixelRatio = () => Math.min(display.quality === 'high' ? Math.max(devicePixelRatio || 1, 1.5) : devicePixelRatio || 1, 2);
$('opt-quality').onclick = e => {
  display.quality = display.quality === 'high' ? 'std' : 'high'; savedQuality = display.quality; display.surface = savedSurface = display.quality === 'high' ? 'max' : 'orig';
  applyQuality(); resize(); applySurface(true); if (e.detail) canvas.focus();
};

// ---------- 繪製 ----------
const color = new THREE.Color();
function draw(dt, k) {
  let bars = 0, shade = 0; const counts = Object.fromEntries(S.SEAT_IDS.map(id => [id, Object.fromEntries(KIND_IDS.map(k => [k, 0]))]));
  const bar = (x, y, z, w, h, f, c) => {
    if (bars >= barBack.instanceMatrix.count) return;
    dummy.quaternion.copy(camera.quaternion); dummy.position.set(x, y, z); dummy.scale.set(w + .16, h + .16, 1); dummy.updateMatrix(); barBack.setMatrixAt(bars, dummy.matrix);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); dummy.position.addScaledVector(right, -w * (1 - f) / 2); dummy.scale.set(Math.max(.001, w * f), h, 1); dummy.updateMatrix(); barFill.setMatrixAt(bars, dummy.matrix); barFill.setColorAt(bars, color.set(c)); bars++;
  };
  for (const u of state?.units ?? []) {
    if (counts[u.seat][u.kind] >= MAX) continue;
    const spec = KINDS[u.kind], lift = spec.air ? FLY_HEIGHT : 0;
    const p = prevPos.get(u.id) ?? [u.x, u.z], x = p[0] + (u.x - p[0]) * k, z = p[1] + (u.z - p[1]) * k, i = counts[u.seat][u.kind]++;
    const home = L.seatById(u.seat).dir, dx = u.dx || u.dz ? u.dx : -home[0], dz = u.dx || u.dz ? u.dz : -home[1];
    if (spec.air && shade < 256) { dummy.position.set(x, .12, z); dummy.quaternion.identity(); dummy.scale.setScalar(1); dummy.updateMatrix(); shadows.setMatrixAt(shade++, dummy.matrix); }
    dummy.position.set(x, .04 + lift, z); dummy.quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(dx, dz)); dummy.scale.setScalar(1); dummy.updateMatrix();
    squads[u.seat][u.kind].forEach(m => m.setMatrixAt(i, dummy.matrix));
    const top = (u.kind === 'dragoon' ? 2.25 : 1.75) + lift; bar(x, top, z, 1.1, .16, u.hp / spec.hp, relColor(u.seat));
    if (spec.shield) bar(x, top + .36, z, 1.1, .13, u.sh / spec.shield, '#6fe8ff');
  }
  for (const s of L.SEATS) {
    for (const kind of KIND_IDS) squads[s.id][kind].forEach(m => { m.count = counts[s.id][kind]; m.instanceMatrix.needsUpdate = true; });
    const v = state?.seats[s.id]; if (!v) { commanders[s.id].visible = false; continue; }
    const c = commanders[s.id], [x, z] = corePos(s.id); c.visible = v.alive; c.position.set(v.commander.x, .1, v.commander.z); if (v.commander.dx || v.commander.dz) c.rotation.y = Math.atan2(v.commander.dx, v.commander.dz);
    bar(x, 10.2, z, 6, .55, v.hp / CORE_MAX, relColor(s.id));
  }
  shadows.count = shade; shadows.instanceMatrix.needsUpdate = true;
  const flying = { dragoon: 0, mutalisk: 0 };
  for (const s of mode === 'end' ? [] : state?.shots ?? []) { // 終局後模擬停止，飛行中的投射物不再畫出
    const mesh = s.kind === 'dragoon' ? orbs : glaives, i = flying[s.kind]; if (i >= 128) continue; flying[s.kind]++;
    const p = prevShots.get(s.id) ?? [s.x, s.z], x = p[0] + (s.x - p[0]) * k, z = p[1] + (s.z - p[1]) * k;
    dummy.position.set(x, s.kind === 'dragoon' ? 1.3 : FLY_HEIGHT + .5, z); dummy.quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, (state.tick + k) * .7); dummy.scale.setScalar(s.hop ? 1 - s.hop * .22 : 1); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(L.seatById(s.seat).secondary));
  }
  for (const [mesh, n] of [[orbs, flying.dragoon], [glaives, flying.mutalisk]]) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
  for (const m of [barBack, barFill]) { m.count = bars; m.instanceMatrix.needsUpdate = true; } if (barFill.instanceColor) barFill.instanceColor.needsUpdate = true;
  const fx = (mesh, place) => { mesh.live = mesh.live.filter(e => (e.life -= dt) > 0); mesh.live.forEach((e, i) => { place(e); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(e.color)); }); mesh.count = mesh.live.length; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; };
  fx(shots, e => { const d = new THREE.Vector3(...e.b).sub(new THREE.Vector3(...e.a)), n = d.length() || 1; dummy.position.set(...e.a).addScaledVector(d, .5); dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.divideScalar(n)); dummy.scale.set(.1, .1, n); });
  fx(puffs, e => { dummy.position.set(e.x, e.y, e.z); dummy.quaternion.identity(); dummy.scale.setScalar((.6 + Math.max(0, .4 - e.life) * 5) * e.size); });
  for (const o of padGroup.children) if (!o.isSprite) o.scale.setScalar(state?.seats[seat]?.pad === o.userData.pad ? 1.12 : 1);
  renderer.render(scene, camera);
}
function advance(dt) {
  if (mode !== 'play') return;
  accumulator += dt * SPEEDS[speed];
  while (accumulator >= 1 / S.HZ && mode === 'play') {
    accumulator -= 1 / S.HZ;
    tick();
  }
  hud();
}

function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  const dt = previous ? Math.min(.1, (now - previous) / 1000) : 0;
  previous = now;
  advance(dt);
  if (anim < 1) anim = Math.min(1, anim + dt / .7);
  pose(); draw(dt, mode === 'play' ? Math.min(1, accumulator * S.HZ) : 1);
  if (mouse && state && mode !== 'menu' && !display.engineering && now >= hoverAt) {
    const moved = hoverAt === 0;
    hoverAt = now + 75;
    const onStage = document.elementFromPoint(mouse.clientX, mouse.clientY) === canvas;
    const kind = onStage ? unitAt(mouse) : null;
    if (kind && moved) $('panel').open = true;
    dossier.hover(kind);
  }
}

$('pause').onclick = () => { pause(); canvas.focus(); };
$('speed').onclick = () => { speed = (speed + 1) % SPEEDS.length; hud(); canvas.focus(); };
$('view').onclick = () => { nextView(); canvas.focus(); };
$('framing').onclick = e => { setFraming(!overview); if (e.detail) canvas.focus(); };
$('again').onclick = () => { if (mode === 'play') pause(); menu(); };
$('save').onclick = () => { if (!record) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ ...record, ticks: state.tick, digest: S.digest(state) })], { type: 'application/json' })); a.download = `battle_craft-dev02-${record.seed}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
$('rules').innerHTML = ['每秒 1 金、購買間隔 0.5 秒沿用 v5；價格、數量、核心、光球速度與彈跳半徑為暫定。', `核心 ${CORE_MAX}，視為重裝甲。兵種血量、護盾、傷害與冷卻沿用原版引擎預設。`, `攻擊標籤：${Object.values(ATTACKS).map(a => a.name).join('、')}。指向性爆炸對輕／中／重本體 50／75／100%，單體；彈跳倍率暫同普通，跳兩次為 1/3、1/9。`, '護盾先吸收原始傷害且至少 1 點才吸收；回盾每原版 frame 7/256 點（以 42 毫秒換算，未驗證），受擊不中斷。', '部隊沿原軸攻向對側；平面距離 5 內主動接敵。', '對側核心失守後，存活部隊經中央改攻另一座敵方核心。', '失守席停止購兵，存活部隊續戰。', '兩隊最後核心同一步失守為平手。', `8 分鐘起所有核心每 2 秒過載扣 ${CORE.overtimeDamage}；過載不清護盾。`, '迷霧、房間連線未做；四席購買區皆可見。'].map(t => `<li>${t}</li>`).join('');
try {
  ({ renderer, camera } = W.createWorld(canvas, { commander: false, dim: ARENA })); buildActors();
  if (innerHeight < 560 || innerWidth < 1100) $('panel').open = false;
  dossier = createDossier(renderer, $('dossier'), $('panel'), () => display.quality);
  applyDisplay(false); applyQuality();
  if (display.surface !== 'orig') applySurface(false);
  const watch = new ResizeObserver(resize); [canvas, $('panel'), $('bar')].forEach(o => watch.observe(o)); $('panel').addEventListener('toggle', resize);
  shopUi(); setView(view, true); resize(); menu(); hud(); requestAnimationFrame(frame);
} catch (err) { console.error(err); $('card').innerHTML = '<h3>無法啟動 3D</h3><p>此裝置或瀏覽器無法使用 WebGL，這一版沒有 2D 備援。</p>'; }
// 供自動核對：唯讀快照
window.__dev02 = { snapshot: () => state && JSON.parse(JSON.stringify(state)), record: () => record && JSON.parse(JSON.stringify(record)), log: () => JSON.parse(JSON.stringify(logRows)), digest: () => state && S.digest(state), mode: () => mode, surface: () => ({ active: SF.surface(), busy: surfaceBusy, bytes: SF.bytes, textures: renderer.info.memory.textures }), display: () => ({ ...display, barsDrawn: !!barBack?.visible && barBack.count, logShown: !($('engineering-panel').hidden || !$('panel').open || !display.log), logRows: $('log').children.length }), view: () => L.viewKey(view), framing: () => overview ? 'overview' : 'near', quality: () => ({ active: display.quality, pixelRatio: renderer.getPixelRatio(), canvas: [renderer.domElement.width, renderer.domElement.height], props: { ...HS.props }, sceneVisible: HS.group.visible }), info: () => ({ projectiles: { dragoon: orbs.count, mutalisk: glaives.count }, drawn: Object.fromEntries(KIND_IDS.map(k => [k, S.SEAT_IDS.reduce((n, id) => n + squads[id][k][0].count, 0)])), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, bodyTriangles: { ...bodyTriangles } }),
  screen: (x, z, y = .1) => { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) / 2 * canvas.clientWidth, (1 - v.y) / 2 * canvas.clientHeight]; }, pad: i => S.padWorld(seat, i), inside: () => { pose(); const b = [1e9, 1e9, -1e9, -1e9]; for (const p of L.framePoints(view, ARENA)) { const [x, y] = window.__dev02.screen(p[0], p[2], p[1]); b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); } return b[0] >= safe.l - 1 && b[1] >= safe.t - 1 && b[2] <= safe.l + safe.w + 1 && b[3] <= safe.t + safe.h + 1; } };
