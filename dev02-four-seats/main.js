// DEV02 呈現層：讀取模擬狀態、把輸入換成指令。規則都在 sim.mjs。
import * as THREE from 'three';
import * as L from '../dev05-layout/layout.mjs';
import * as W from '../dev05-layout/world.js';
import * as S from './sim.mjs';

const $ = id => document.getElementById(id), canvas = $('stage'), { scene } = W, R = S.RULES;
const hash = new URLSearchParams(location.hash.slice(1));
const SPEEDS = [1, 2, 4];
let state = null, record = null, seat = null, queue = [], mode = 'menu', speed = 0, accumulator = 0, previous = 0, logRows = [];
let renderer, camera, view = L.parseView('team:A'), angles = L.viewAngles(view), from = null, anim = 1, safe = { l: 0, t: 0, w: 16, h: 9 };

// ---------- 場景物件 ----------
const MAX = 256, dummy = new THREE.Object3D(), markerGroup = new THREE.Group(), padGroup = new THREE.Group(), fallGroup = new THREE.Group();
scene.add(markerGroup, padGroup, fallGroup);
let squads, commanders, barBack, barFill, shots, puffs;
const inst = (geo, mat, n = MAX) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.count = 0; scene.add(m); return m; };
function buildActors() {
  const geo = W.droneGeometries(); squads = {}; commanders = {};
  for (const s of L.SEATS) {
    const M = W.seatMats[s.id];
    squads[s.id] = [[geo.hull, M.paint], [geo.dark, W.MAT.black], [geo.lamp, M.glow]].map(([g, m]) => { const x = inst(g, m); x.castShadow = true; return x; });
    const c = new THREE.Group(), add = (g, m, y, z = 0) => { const x = new THREE.Mesh(g, m); x.position.set(0, y, z); x.castShadow = true; c.add(x); return x; };
    add(new THREE.CylinderGeometry(.5, .75, 1.7, 8), M.paint, .95); add(new THREE.CylinderGeometry(.4, .4, .6, 12), W.MAT.steel, 2.1); add(new THREE.BoxGeometry(.6, .16, .3), M.glow, 2.15, .28);
    const ring = add(new THREE.TorusGeometry(1, .1, 6, 24), M.glow, .16); ring.rotation.x = Math.PI / 2; ring.castShadow = false;
    scene.add(c); commanders[s.id] = c;
  }
  const flat = color => new THREE.MeshBasicMaterial({ color, toneMapped: false, fog: false, depthTest: false, transparent: true });
  barBack = inst(new THREE.PlaneGeometry(1, 1), flat(0x05080b), MAX * 4 + 4); barFill = inst(new THREE.PlaneGeometry(1, 1), flat(0xffffff), MAX * 4 + 4);
  barBack.renderOrder = 6; barFill.renderOrder = 7;
  shots = inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), 128); puffs = inst(new THREE.SphereGeometry(.5, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: .7 }), 128);
  shots.live = []; puffs.live = [];
}
const relOf = id => L.relation(view.kind === 'plan' || !seat ? view : { kind: 'seat', id: seat }, id);
const relColor = id => L.RELATIONS[relOf(id)]?.color ?? '#c8d2da';
const relName = id => seat ? { self: '我席', ally: '隊友', enemy: '敵方' }[relOf(id)] : L.TEAMS[L.seatById(id).team].name;
const seatName = id => `${L.seatById(id).name}席`;

function buildPads() {
  W.clear(padGroup);
  if (!seat) return;
  S.PADS.forEach((p, i) => {
    const [x, z] = S.padWorld(seat, i);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R.padRadius, .09, 6, 32), new THREE.MeshBasicMaterial({ color: p.locked ? 0x6a747c : 0xffe9a8, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.set(x, .42, z); ring.userData.pad = i; padGroup.add(ring);
    const t = W.label(300, 108, (g, w, h) => {
      g.fillStyle = 'rgba(7,11,15,.84)'; g.beginPath(); g.roundRect(3, 3, w - 6, h - 6, 14); g.fill(); g.lineWidth = 5; g.strokeStyle = p.locked ? '#6a747c' : '#ffe9a8'; g.stroke();
      g.fillStyle = p.locked ? '#9eabb4' : '#fff'; g.font = `800 42px ${W.FONT}`; g.fillText(p.locked ? '未開放' : `${i + 1}｜${p.cost}金 ×${p.count}`, w / 2, h / 2 + 2);
    });
    t.position.set(x, 3.4, z); t.scale.set(p.locked ? 2.9 : 4.6, p.locked ? 1.05 : 1.66, 1); padGroup.add(t);
  });
}
function markFallen(id) {
  const [x, z] = L.corePos(id);
  const t = W.label(300, 120, (g, w, h) => { g.fillStyle = 'rgba(40,6,10,.92)'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd0d0'; g.font = `800 64px ${W.FONT}`; g.fillText('✕ 失守', w / 2, h / 2 + 3); });
  t.position.set(x, 6, z); t.scale.set(7, 2.8, 1); fallGroup.add(t);
}

// ---------- 鏡頭 ----------
function setView(v, jump) {
  if (!jump) { from = { ...angles }; anim = 0; } else { anim = 1; from = null; }
  view = v; if (renderer) W.buildMarkers(markerGroup, seat ? { kind: 'seat', id: seat } : v, seat);
  $('view').textContent = v.kind === 'seat' ? '隊伍視角' : seat ? '個人視角' : v.id === 'A' ? '乙隊視角' : '甲隊視角';
}
function nextView() {
  if (!seat) return setView(L.parseView(view.id === 'A' ? 'team:B' : 'team:A'));
  setView(L.parseView(view.kind === 'seat' ? `team:${L.seatById(seat).team}` : `seat:${seat}`));
}
function pose() {
  const to = L.viewAngles(view), k = anim * anim * (3 - 2 * anim);
  if (from && anim < 1) { const turn = Math.atan2(Math.sin(to.az - from.az), Math.cos(to.az - from.az)); angles = { az: from.az + turn * k, el: from.el + (to.el - from.el) * k }; } else angles = to;
  W.poseCamera(camera, angles, safe); camera.updateMatrixWorld();
  $('needle').style.transform = `rotate(${W.northAngle(camera)}rad)`; camera.updateMatrixWorld();
}
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
  const portrait = h > w, bar = $('bar').getBoundingClientRect(), panel = $('panel').getBoundingClientRect(), open = $('panel').open, bottom = portrait ? 120 : h > 560 ? 108 : 48;
  let l = portrait ? 0 : bar.right + 8, r = portrait || !open ? 0 : w - panel.left + 8; const t = portrait ? bar.bottom + 8 : 0;
  if (!portrait && w - 2 * Math.max(l, r) > h * 1.25) l = r = Math.max(l, r);
  safe = { l, t, w: Math.max(80, w - l - r), h: Math.max(80, h - t - bottom) };
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
  camera.aspect = safe.w / safe.h; camera.fov = L.FOV; camera.setViewOffset(safe.w, safe.h, -safe.l, -safe.t, w, h);
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
canvas.addEventListener('pointerdown', e => {
  canvas.focus(); if (!seat || mode !== 'play') return;
  const b = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((e.clientX - b.left) / b.width * 2 - 1, 1 - (e.clientY - b.top) / b.height * 2), camera);
  if (!ray.ray.intersectPlane(plane, hit)) return;
  const [x, z] = S.toLocal(seat, hit.x, hit.z);
  if (Math.abs(x) > L.DIM.shopWidth / 2 + 1.5 || Math.abs(z) > L.DIM.shopDepth / 2 + 1.5) return say('只能在自己的購買區移動。', 'info');
  command({ type: 'goal', x: hit.x, z: hit.z });
});
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === ' ' && mode !== 'menu' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); return pause(); }
  if (mode !== 'play') return;
  if (KEY[k]) { e.preventDefault(); if (!keys.has(k)) { keys.add(k); sendKeys(); } }
  else if (k === 'v' && !e.repeat) nextView();
  else if (!e.repeat && S.PADS[+k - 1] && !S.PADS[+k - 1].locked) gotoPad(+k - 1);
});
addEventListener('keyup', e => { if (keys.delete(e.key.toLowerCase())) sendKeys(); });
addEventListener('blur', () => { if (keys.size) { keys.clear(); sendKeys(); } if (mode === 'play') pause(); });
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
    buy: () => ['info', `${who}花 ${e.cost} 金，部署 ${e.count} 台突擊機。${mine ? `剩 ${e.gold} 金。` : ''}`],
    core: () => [e.level === 'critical' ? 'critical' : 'warn', `${who}核心${{ first: '開始受損', half: '剩一半', critical: '危急' }[e.level]}，${e.hp}／${R.coreHp}。`],
    fall: () => ['critical', `${who}核心失守，停止購兵；存活部隊續戰。`],
    reroute: () => ['warn', `${who}的 ${e.count} 台部隊經中央改攻${seatName(e.to)}。`],
    overtime: () => ['critical', '核心過載：所有核心每 2 秒扣 1。'],
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
  record = { version: 1, seed, bots: S.SEAT_IDS.filter(x => x !== seat), commands: [] };
  state = S.createSim(record); queue = []; keys.clear(); accumulator = 0; mode = 'play'; logRows = [];
  $('log').replaceChildren(); W.clear(fallGroup); shots.live = []; puffs.live = []; prevPos = new Map();
  buildPads(); setView(L.parseView(seat ? `seat:${seat}` : 'team:A'), true); shopUi(); $('cover').hidden = true; canvas.focus(); hud();
}
function pause() { if (mode === 'play') {
  // 暫停時放掉所有按鍵：尚未送進模擬的方向指令作廢，已生效的方向歸零；點擊目標保留
  mode = 'paused'; keys.clear(); queue = queue.filter(c => c.type !== 'dir');
  if (seat && state.seats[seat].alive) queue.push({ seat, type: 'dir', x: 0, z: 0 }); // 方向歸零不取消點擊目標
  say('已暫停。', 'info'); } else if (mode === 'paused') { mode = 'play'; say('繼續。', 'info'); } accumulator = 0; hud(); }
let prevPos = new Map();
function tick() {
  const now = queue; queue = [];
  for (const c of now) record.commands.push({ tick: state.tick + 1, ...c });
  prevPos = new Map(state.units.map(u => [u.id, [u.x, u.z]]));
  for (const e of S.step(state, now)) {
    if (e.type === 'shot') { const u = state.units.find(v => v.id === e.from), p = u || prevPos.get(e.from); if (p) shots.live.push({ a: u ? [u.x, u.z] : p, b: [e.x, e.z], y: e.core ? 2.5 : .8, life: .12, color: L.seatById(e.seat).secondary }); continue; }
    if (e.type === 'death') puffs.live.push({ x: e.x, z: e.z, life: .4, color: L.seatById(e.seat).primary });
    if (e.type === 'fall') markFallen(e.seat);
    logRows.push(e); write(e);
  }
  while (shots.live.length > 120) shots.live.shift(); while (puffs.live.length > 120) puffs.live.shift();
  if (state.mode === 'end') finish();
}
function finish() {
  mode = 'end'; keys.clear(); record.ticks = state.tick; record.digest = S.digest(state);
  const won = state.winner === 'draw' ? '平手' : !seat ? `${L.TEAMS[state.winner].name}獲勝` : L.seatById(seat).team === state.winner ? '勝利' : '敗北';
  $('card').innerHTML = `<h3 id="result">${won}</h3><p>${time(state.tick)}　種子 ${state.seed}</p><table><tr><th>席位</th><th>核心</th><th>購買</th><th>花費</th><th>部署</th><th>損失</th><th>擊破</th></tr>${L.SEATS.map(s => { const v = state.seats[s.id]; return `<tr><td>${s.name}席（${relName(s.id)}）</td><td>${v.alive ? v.hp : '失守'}</td><td>${v.buys}</td><td>${v.spent}</td><td>${v.deployed}</td><td>${v.lost}</td><td>${v.kills}</td></tr>`; }).join('')}</table><div class="row"><button class="go" id="restart">再來一局</button><button id="look">查看戰場</button></div>`;
  $('restart').onclick = menu; $('look').onclick = () => { $('cover').hidden = true; }; $('cover').hidden = false;
}
function menu() {
  mode = 'menu'; $('cover').hidden = false;
  $('card').innerHTML = `<h3>選一席開始</h3><p>甲隊（北＋西）對乙隊（南＋東），其餘席位由電腦控制。走到自己購買區的信標上會自動購兵，錢不夠就站著等，存夠自動買，繼續站著會再買。攻下對方兩座核心即獲勝。</p><div id="pick">${L.SEATS.map(s => `<button data-seat="${s.id}"><i style="background:${s.primary};border-color:${s.secondary}"></i><b>${s.name}席</b><small>${L.TEAMS[s.team].name}</small></button>`).join('')}</div><button data-seat="none">觀戰（四席皆電腦）</button><p>點購買區地面、按 1／2 或用 WASD／方向鍵移動指揮官；V 切換視角，空白鍵暫停。</p>`;
  for (const b of $('card').querySelectorAll('[data-seat]')) b.onclick = () => start(b.dataset.seat, hash.has('seed') ? +hash.get('seed') >>> 0 : undefined);
}
function shopUi() {
  $('shop').innerHTML = seat ? S.PADS.map((p, i) => p.locked ? '' : `<button data-pad="${i}"><b>${i + 1}　${p.label}</b><small>${p.cost} 金 → ${p.count} 台</small></button>`).join('') : '';
  for (const b of $('shop').querySelectorAll('button')) b.onclick = () => { gotoPad(+b.dataset.pad); canvas.focus(); };
  $('gold-label').textContent = seat ? `${seatName(seat)}金幣` : '金幣'; 
  $('cores').innerHTML = L.SEATS.map(s => `<div class="core" id="core-${s.id}"><b style="background:${s.primary};border-color:${s.secondary}">${s.name}</b><div class="hp" style="color:${relColor(s.id)}"><i></i></div><span style="color:${relColor(s.id)}"></span></div>`).join('');
}
function hud() {
  if (!state) return;
  $('clock').textContent = time(state.tick); $('gold').textContent = seat ? state.seats[seat].gold : '—';
  for (const s of L.SEATS) { const v = state.seats[s.id], e = $('core-' + s.id); e.classList.toggle('down', !v.alive); e.querySelector('i').style.width = `${v.hp / R.coreHp * 100}%`; e.querySelector('span').textContent = `${relName(s.id)} ${v.hp}`; }
  for (const b of $('shop').querySelectorAll('button')) { b.classList.toggle('on', state.seats[seat].pad === +b.dataset.pad); b.disabled = !state.seats[seat].alive || mode === 'end'; }
  $('pause').textContent = mode === 'paused' ? '繼續' : '暫停'; $('pause').disabled = mode === 'end' || mode === 'menu'; $('speed').textContent = `${SPEEDS[speed]}×`;
}

// ---------- 繪製 ----------
const color = new THREE.Color();
function draw(dt, k) {
  let bars = 0; const counts = { N: 0, W: 0, S: 0, E: 0 };
  const bar = (x, y, z, w, h, f, c) => {
    if (bars >= barBack.instanceMatrix.count) return;
    dummy.quaternion.copy(camera.quaternion); dummy.position.set(x, y, z); dummy.scale.set(w + .16, h + .16, 1); dummy.updateMatrix(); barBack.setMatrixAt(bars, dummy.matrix);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); dummy.position.addScaledVector(right, -w * (1 - f) / 2); dummy.scale.set(Math.max(.001, w * f), h, 1); dummy.updateMatrix(); barFill.setMatrixAt(bars, dummy.matrix); barFill.setColorAt(bars, color.set(c)); bars++;
  };
  for (const u of state?.units ?? []) {
    if (counts[u.seat] >= MAX) continue;
    const p = prevPos.get(u.id) ?? [u.x, u.z], x = p[0] + (u.x - p[0]) * k, z = p[1] + (u.z - p[1]) * k, i = counts[u.seat]++;
    const home = L.seatById(u.seat).dir, dx = u.dx || u.dz ? u.dx : -home[0], dz = u.dx || u.dz ? u.dz : -home[1];
    dummy.position.set(x, .04, z); dummy.quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(dx, dz)); dummy.scale.setScalar(1); dummy.updateMatrix();
    squads[u.seat].forEach(m => m.setMatrixAt(i, dummy.matrix)); bar(x, 1.75, z, 1.1, .16, u.hp / R.unitHp, relColor(u.seat));
  }
  for (const s of L.SEATS) {
    squads[s.id].forEach(m => { m.count = counts[s.id]; m.instanceMatrix.needsUpdate = true; });
    const v = state?.seats[s.id]; if (!v) { commanders[s.id].visible = false; continue; }
    const c = commanders[s.id], [x, z] = L.corePos(s.id); c.visible = v.alive; c.position.set(v.commander.x, .1, v.commander.z); if (v.commander.dx || v.commander.dz) c.rotation.y = Math.atan2(v.commander.dx, v.commander.dz);
    bar(x, 10.2, z, 6, .55, v.hp / R.coreHp, relColor(s.id));
  }
  for (const m of [barBack, barFill]) { m.count = bars; m.instanceMatrix.needsUpdate = true; } if (barFill.instanceColor) barFill.instanceColor.needsUpdate = true;
  const fx = (mesh, place) => { mesh.live = mesh.live.filter(e => (e.life -= dt) > 0); mesh.live.forEach((e, i) => { place(e); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(e.color)); }); mesh.count = mesh.live.length; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; };
  fx(shots, e => { const dx = e.b[0] - e.a[0], dz = e.b[1] - e.a[1]; dummy.position.set((e.a[0] + e.b[0]) / 2, e.y, (e.a[1] + e.b[1]) / 2); dummy.quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(dx, dz)); dummy.scale.set(.1, .1, Math.hypot(dx, dz)); });
  fx(puffs, e => { dummy.position.set(e.x, .9, e.z); dummy.quaternion.identity(); dummy.scale.setScalar(.6 + (.4 - e.life) * 5); });
  for (const o of padGroup.children) if (!o.isSprite) o.scale.setScalar(state?.seats[seat]?.pad === o.userData.pad ? 1.12 : 1);
  renderer.render(scene, camera);
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.1, (now - previous) / 1000 || 0); previous = now;
  if (mode === 'play') { accumulator += dt * SPEEDS[speed]; while (accumulator >= 1 / S.HZ && mode === 'play') { accumulator -= 1 / S.HZ; tick(); } hud(); }
  if (anim < 1) anim = Math.min(1, anim + dt / .7);
  pose(); draw(dt, mode === 'play' ? Math.min(1, accumulator * S.HZ) : 1);
}

$('pause').onclick = () => { pause(); canvas.focus(); };
$('speed').onclick = () => { speed = (speed + 1) % SPEEDS.length; hud(); canvas.focus(); };
$('view').onclick = () => { nextView(); canvas.focus(); };
$('again').onclick = () => { if (mode === 'play') pause(); menu(); };
$('save').onclick = () => { if (!record) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ ...record, ticks: state.tick, digest: S.digest(state) })], { type: 'application/json' })); a.download = `battle_craft-dev02-${record.seed}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
$('rules').innerHTML = ['購兵價格、每秒 1 金、0.5 秒間隔沿用 v5；其餘數值皆為原型。', `核心 ${R.coreHp}；突擊機 ${R.unitHp} 血、每 0.8 秒傷害 1。`, '部隊沿原軸攻向對側；平面距離 5 內主動接敵。', '對側核心失守後，存活部隊經中央改攻另一座敵方核心。', '失守席停止購兵，存活部隊續戰。', '兩隊最後核心同一步失守為平手。', '8 分鐘起所有核心每 2 秒過載扣 1。', '迷霧、房間連線、飛行兵未做；四席購買區皆可見。'].map(t => `<li>${t}</li>`).join('');
try {
  ({ renderer, camera } = W.createWorld(canvas, { commander: false })); buildActors();
  const watch = new ResizeObserver(resize); [canvas, $('panel'), $('bar')].forEach(o => watch.observe(o)); $('panel').addEventListener('toggle', resize);
  if (innerHeight < 560 || innerWidth < 1100) $('panel').removeAttribute('open');
  shopUi(); setView(view, true); resize(); menu(); hud(); requestAnimationFrame(frame);
} catch (err) { console.error(err); $('card').innerHTML = '<h3>無法啟動 3D</h3><p>此裝置或瀏覽器無法使用 WebGL，這一版沒有 2D 備援。</p>'; }
// 供自動核對：唯讀快照
window.__dev02 = { snapshot: () => state && JSON.parse(JSON.stringify(state)), record: () => record && JSON.parse(JSON.stringify(record)), log: () => JSON.parse(JSON.stringify(logRows)), digest: () => state && S.digest(state), mode: () => mode, view: () => L.viewKey(view), info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
  screen: (x, z, y = .1) => { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) / 2 * canvas.clientWidth, (1 - v.y) / 2 * canvas.clientHeight]; }, pad: i => S.padWorld(seat, i), inside: () => { pose(); const b = [1e9, 1e9, -1e9, -1e9]; for (const p of L.framePoints(view)) { const [x, y] = window.__dev02.screen(p[0], p[2], p[1]); b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); } return b[0] >= safe.l - 1 && b[1] >= safe.t - 1 && b[2] <= safe.l + safe.w + 1 && b[3] <= safe.t + safe.h + 1; } };
