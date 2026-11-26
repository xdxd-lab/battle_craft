// DEV02 四席固定步模擬。純資料：不碰 DOM、Three.js、Math.random、Date，也不用三角函式。
// 同一組設定與指令在任何地方重跑都得到相同狀態；呈現層只讀不寫。
import * as L from '../dev05-layout/layout.mjs';
import { ARENA } from './arena.mjs';
import { KINDS, KIND_IDS, CORE, unitStats } from './roster.mjs';
import { stepRoster } from './combat.mjs';

export const HZ = 30;
export const VERSION = 4; // 1、2：單一突擊機；3：BC01 三兵種；4：同 3，可通行道路加寬 10%（舊版保留供重播）
// 以下皆為原型數值。標 v5 者沿用 v5，其餘為本輪暫定。
export const RULES = {
  startGold: 12, incomeEvery: 30, purchaseGap: 15, // v5：12 金起始、每秒 1 金、兩次購買至少 0.5 秒
  coreHp: 120, unitHp: 3, unitSpeed: .078, unitRange: 1.62, unitCooldown: 24, unitDamage: 1, commanderSpeed: .22, // v5（核心血量 v5 為 60）
  padRadius: 1.6,     // v5 為 2.25；DEV05 信標較密
  aggro: 5,           // 平面距離內主動接敵
  spacing: .95,       // 部隊間距
  overtimeAt: 30 * 60 * 8, overtimeEvery: 60, // 8 分鐘起所有核心每 2 秒過載扣 1，保證終局
  coreRadius: 4.6, spawnRadial: ARENA.spawnRadial, laneHalf: 3.6, junction: 8.2, platform: ARENA.platformWalkRadius,
};
// 信標位置以北席本地座標相對購買區中心
const place = pads => pads.map((pad, i) => {
  const [x, z] = ARENA.shopPadPositions[i];
  return { ...pad, x, z };
});
const PADS_V2 = place([
  { cost: 5, count: 1, label: '單兵部署' }, // v5 價格
  { cost: 12, count: 3, label: '編隊部署' },
  { locked: true, label: '未開放' },
  { locked: true, label: '未開放' },
]);
export const PADS = place([...KIND_IDS.map(kind => ({ kind, cost: KINDS[kind].cost, count: KINDS[kind].count, label: KINDS[kind].name })), { locked: true, label: '未開放' }]);
export const padsFor = version => version >= 3 ? PADS : PADS_V2;
export const coreMax = version => version >= 3 ? CORE.hp : RULES.coreHp;
const HOME = { x: .9, z: 0 };
const GEOMETRY = {
  1: { dim: L.DIM, shopBounds: [-4, 5.8, -4.2, 4.2] },
  2: { dim: ARENA, shopBounds: [
    .6 - ARENA.shopWidth / 2, ARENA.shopWidth / 2 - .6,
    .6 - ARENA.shopDepth / 2, ARENA.shopDepth / 2 - .6,
  ] },
};
GEOMETRY[3] = GEOMETRY[2];
GEOMETRY[4] = { ...GEOMETRY[2], dim: { ...ARENA, laneHalf: RULES.laneHalf * 1.1 } };
export const SEAT_IDS = L.SEATS.map(s => s.id);

// 北席本地座標 ⇄ 世界座標（90° 旋轉，浮點無誤差）
function turn([x, z], n) { for (let i = 0; i < n; i++) [x, z] = L.ccw([x, z]); return [x, z]; }
export const toWorld = (seat, x, z, dim = ARENA) => turn([x - dim.shopTangent, z - dim.shopRadial], L.seatIndex(seat));
export function toLocal(seat, x, z, dim = ARENA) { const [a, b] = turn([x, z], (4 - L.seatIndex(seat)) % 4); return [a + dim.shopTangent, b + dim.shopRadial]; }
export const padWorld = (seat, i, dim = ARENA) => toWorld(seat, ...dim.shopPadPositions[i], dim);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function clampShop(seat, x, z, { dim, shopBounds: [x0, x1, z0, z1] }) {
  const [a, b] = toLocal(seat, x, z, dim);
  return toWorld(seat, clamp(a, x0, x1), clamp(b, z0, z1), dim);
}
const dist = (ax, az, bx, bz) => Math.sqrt((ax - bx) * (ax - bx) + (az - bz) * (az - bz));

const nextRandom = v => { v ^= v << 13; v ^= v >>> 17; v ^= v << 5; return v >>> 0; };

// 32 位元整數雜湊：種子與席位的每個位元都影響結果，不會超出浮點精度
function mix(seed, i) { let h = Math.imul(seed ^ Math.imul(i + 1, 0x9e3779b9), 0x85ebca6b); h = Math.imul(h ^ h >>> 15, 0xc2b2ae35); return (h ^ h >>> 16) >>> 0 || 1; }

// bots：由電腦控制的席位；其餘席位只聽 commands
export function createSim({ seed = 1, bots = SEAT_IDS, version = VERSION } = {}) {
  if (!Object.hasOwn(GEOMETRY, version)) throw new RangeError(`不支援的模擬版本：${version}`);
  const { dim } = GEOMETRY[version];
  const state = { version, seed: seed >>> 0, tick: 0, mode: 'play', winner: null, serial: 0, units: [], seats: {}, bots: {} };
  for (const s of L.SEATS) {
    const [x, z] = toWorld(s.id, HOME.x, HOME.z, dim);
    state.seats[s.id] = { id: s.id, team: s.team, alive: true, gold: RULES.startGold, hp: coreMax(version), commander: { x, z, dx: 0, dz: 0 }, goal: null, dir: null, pad: -1, nextBuy: 0, waiting: false, buys: 0, spent: 0, deployed: 0, lost: 0, kills: 0 };
  }
  if (version >= 3) Object.assign(state, { shots: [], shotSerial: 0 });
  SEAT_IDS.forEach((id, i) => { if (bots.includes(id)) state.bots[id] = { rng: mix(state.seed, i), pad: -1, until: 0, left: 0, seen: 0 }; });
  return state;
}

// ---------- 指令 ----------
// { seat, type: 'goal', x, z } | { seat, type: 'dir', x, z } | { seat, type: 'stop' }：只能移動指揮官
function apply(state, c, geometry) {
  const s = state.seats[c?.seat];
  if (!s || !s.alive) return;
  if (c.type === 'stop') { s.goal = s.dir = null; return; }
  if (!Number.isFinite(c.x) || !Number.isFinite(c.z)) return;
  if (c.type === 'goal') { const [x, z] = clampShop(s.id, c.x, c.z, geometry); s.goal = { x, z }; s.dir = null; }
  if (c.type === 'dir') { const n = dist(c.x, c.z, 0, 0); s.dir = n ? { x: c.x / n, z: c.z / n } : null; if (n) s.goal = null; } // 放開方向鍵不取消點擊目標
}

// 電腦只決定走向哪座信標，購兵走同一套規則；只看自己的資料
function botCommands(state, dim) {
  const out = [];
  for (const id of SEAT_IDS) {
    const b = state.bots[id], s = state.seats[id];
    if (!b || !s.alive) continue;
    const roll = n => { b.rng = nextRandom(b.rng); return b.rng % n; };
    if (state.tick === 1) { b.until = 60 + roll(60); continue; }
    if (b.pad >= 0) {
      if (s.buys - b.seen < b.left) continue;
      b.pad = -1; b.until = state.tick + roll(60);
      const [x, z] = toWorld(id, HOME.x, HOME.z, dim); out.push({ seat: id, type: 'goal', x, z });
    } else if (state.tick >= b.until) {
      if (state.version >= 3) { const n = roll(100); b.pad = n < 45 ? 0 : n < 73 ? 1 : 2; b.left = b.pad ? 1 : 1 + roll(3); }
      else { b.pad = roll(100) < 35 ? 0 : 1; b.left = b.pad ? 1 + roll(2) : 1 + roll(3); }
      b.seen = s.buys;
      const [x, z] = padWorld(id, b.pad, dim); out.push({ seat: id, type: 'goal', x, z });
    }
  }
  return out;
}

// ---------- 購兵（v5 recruit／checkBeacon 改成以席位為參數） ----------
export function targetOf(state, seat) { // 對側核心；失守後改為另一個仍在的敵方核心
  const opp = L.opposite(seat).id;
  if (state.seats[opp].alive) return opp;
  return SEAT_IDS.find(id => state.seats[id].team !== state.seats[seat].team && state.seats[id].alive) ?? null;
}
function recruit(state, s, p, emit, dim) {
  if (s.gold < p.cost) return false;
  s.gold -= p.cost; s.spent += p.cost; s.buys++;
  const ids = [], target = targetOf(state, s.id), index = L.seatIndex(s.id);
  for (let i = 0; i < p.count; i++) {
    const id = ++state.serial, lat = (s.deployed % 5 - 2) * 1.25; s.deployed++;
    const [x, z] = turn([lat, -dim.spawnRadial - i * .4], index);
    state.units.push({ id, seat: s.id, team: s.team, x, z, hp: RULES.unitHp, cd: 0, lat, target, foe: 0, dx: 0, dz: 0, ...(p.kind ? unitStats(p.kind) : {}) });
    ids.push(id);
  }
  emit('buy', s.id, { cost: p.cost, count: p.count, gold: s.gold, label: p.label, units: ids, ...(p.kind ? { kind: p.kind } : {}) });
  return true;
}
function padAt(s, PADS, dim) {
  for (let i = 0; i < PADS.length; i++) { if (PADS[i].locked) continue; const [x, z] = padWorld(s.id, i, dim); if (dist(x, z, s.commander.x, s.commander.z) <= RULES.padRadius) return i; }
  return -1;
}
function checkBeacon(state, s, emit, dim) {
  const PADS = padsFor(state.version), i = padAt(s, PADS, dim);
  if (i !== s.pad) {
    if (s.pad >= 0) emit('leave', s.id, { label: PADS[s.pad].label });
    s.pad = i; s.nextBuy = state.tick; s.waiting = false;
    if (i >= 0) emit('enter', s.id, { label: PADS[i].label });
  }
  if (i < 0) return;
  const p = PADS[i];
  if (s.gold < p.cost) { if (!s.waiting) { s.waiting = true; emit('wait', s.id, { cost: p.cost, gold: s.gold }); } return; }
  if (state.tick < s.nextBuy) return;
  if (recruit(state, s, p, emit, dim)) { s.nextBuy = state.tick + RULES.purchaseGap; s.waiting = false; }
}
function moveCommander(s, geometry) {
  const c = s.commander; let dx = 0, dz = 0, len = 1, step = RULES.commanderSpeed;
  if (s.dir) { dx = s.dir.x; dz = s.dir.z; }
  else if (s.goal) { dx = s.goal.x - c.x; dz = s.goal.z - c.z; len = dist(dx, dz, 0, 0); if (len <= step) { c.x = s.goal.x; c.z = s.goal.z; s.goal = null; return; } }
  else return;
  [c.x, c.z] = clampShop(s.id, c.x + dx / len * step, c.z + dz / len * step, geometry);
  c.dx = dx / len; c.dz = dz / len;
}

// ---------- 部隊 ----------
function clampWalk(x, z, dim) { // 道路、交會區、核心平台之內；核心本體不可穿越
  const R = RULES, C = dim.coreDistance, half = dim.laneHalf ?? R.laneHalf;
  for (const s of L.SEATS) {
    const cx = s.dir[0] * C, cz = s.dir[1] * C, d = dist(x, z, cx, cz);
    if (d < R.platform) { if (d >= R.coreRadius || !d) return [x, z]; return [cx + (x - cx) / d * R.coreRadius, cz + (z - cz) / d * R.coreRadius]; }
  }
  const r = dist(x, z, 0, 0), ax = Math.abs(x), az = Math.abs(z);
  if (r <= R.junction || (ax <= half && az <= C) || (az <= half && ax <= C)) return [x, z];
  // 出界時取位移最小的合法位置
  const lane = ax < az ? [clamp(x, -half, half), clamp(z, -C, C)] : [clamp(x, -C, C), clamp(z, -half, half)];
  const hub = [x / r * R.junction, z / r * R.junction];
  return dist(x, z, ...hub) < dist(x, z, ...lane) ? hub : lane;
}
function waypoint(u, dim) { // 已在目標核心的軸線走廊就直行，否則先經中央折向
  const [tx, tz] = L.corePos(u.target, dim), [ox, oz] = L.ccw(L.seatById(u.target).dir);
  const off = u.x * ox + u.z * oz;
  if (Math.abs(off) > (dim.laneHalf ?? RULES.laneHalf) + .3) return [0, 0];
  return [tx + ox * u.lat, tz + oz * u.lat];
}
function stepUnits(state, emit, dim) {
  const R = RULES, units = state.units, plan = [], damage = new Map(), by = new Map(), coreDamage = {};
  // 第一階段：全部依同一份位置決定目標與移動
  for (const u of units) {
    let foe = null, best = Infinity;
    for (const o of units) { if (o.team === u.team) continue; const d = dist(u.x, u.z, o.x, o.z); if (d < best || (d === best && o.id < foe.id)) { best = d; foe = o; } }
    if (best > R.aggro) foe = null;
    const p = { mx: 0, mz: 0, hit: null, core: null };
    u.foe = foe ? foe.id : 0;
    if (foe && best <= R.unitRange) p.hit = foe;
    else if (foe) { p.mx = foe.x - u.x; p.mz = foe.z - u.z; }
    else if (u.target) {
      const [cx, cz] = L.corePos(u.target, dim);
      if (dist(u.x, u.z, cx, cz) <= R.coreRadius + R.unitRange) p.core = u.target;
      else { const [wx, wz] = waypoint(u, dim); p.mx = wx - u.x; p.mz = wz - u.z; }
    }
    // 隊形分離
    let sx = 0, sz = 0;
    for (const o of units) {
      if (o === u) continue; const d = dist(u.x, u.z, o.x, o.z);
      if (d >= R.spacing) continue;
      if (d < 1e-6) { const q = u.id < o.id ? 1 : -1, [ox, oz] = L.ccw(L.seatById(u.seat).dir); sx += ox * q; sz += oz * q; } // 完全重疊時以編號左右分開
      else { const k = (R.spacing - d) / R.spacing / d; sx += (u.x - o.x) * k; sz += (u.z - o.z) * k; }
    }
    p.sx = sx; p.sz = sz; plan.push(p);
  }
  // 第二階段：傷害先累計、移動一起套用
  units.forEach((u, i) => {
    const p = plan[i];
    if (u.cd > 0) u.cd--;
    if ((p.hit || p.core) && !u.cd) {
      u.cd = R.unitCooldown;
      if (p.hit) { damage.set(p.hit.id, (damage.get(p.hit.id) || 0) + R.unitDamage); if (!by.has(p.hit.id)) by.set(p.hit.id, []); by.get(p.hit.id).push(u.seat); emit('shot', u.seat, { from: u.id, x: p.hit.x, z: p.hit.z }, true); }
      else { coreDamage[p.core] = (coreDamage[p.core] || 0) + R.unitDamage; const [cx, cz] = L.corePos(p.core, dim); emit('shot', u.seat, { from: u.id, x: cx, z: cz, core: p.core }, true); }
    }
    let x = u.x, z = u.z; const n = dist(p.mx, p.mz, 0, 0);
    if (n > 0) { const k = Math.min(R.unitSpeed, n) / n; x += p.mx * k; z += p.mz * k; u.dx = p.mx / n; u.dz = p.mz / n; }
    else if (p.hit) { const d = dist(p.hit.x, p.hit.z, u.x, u.z) || 1; u.dx = (p.hit.x - u.x) / d; u.dz = (p.hit.z - u.z) / d; }
    const m = dist(p.sx, p.sz, 0, 0);
    if (m > 0) { const k = Math.min(.05, m * .05) / m; x += p.sx * k; z += p.sz * k; }
    p.to = clampWalk(x, z, dim);
  });
  units.forEach((u, i) => { [u.x, u.z] = plan[i].to; });
  state.units = units.filter(u => {
    u.hp -= damage.get(u.id) || 0;
    if (u.hp > 0) return true;
    const killers = [...new Set(by.get(u.id))].sort((a, b) => L.seatIndex(a) - L.seatIndex(b));
    state.seats[u.seat].lost++; for (const k of killers) state.seats[k].kills++;
    emit('death', u.seat, { unit: u.id, x: u.x, z: u.z, by: killers }); return false;
  });
  stepCores(state, coreDamage, emit);
}
function stepCores(state, coreDamage, emit) {
  const fallen = [], overtime = state.tick - RULES.overtimeAt;
  if (overtime === 0) emit('overtime', null, {});
  for (const id of SEAT_IDS) {
    const s = state.seats[id], hit = (coreDamage[id] || 0) + (overtime > 0 && overtime % RULES.overtimeEvery === 0 ? state.version >= 3 ? CORE.overtimeDamage : 1 : 0);
    if (!hit || !s.alive) continue;
    const prev = s.hp; s.hp = Math.max(0, s.hp - hit);
    for (const [at, level] of [[1, 'first'], [.5, 'half'], [.25, 'critical']]) {
      const mark = coreMax(state.version) * at; if (at === 1 ? prev === mark && s.hp < mark : prev > mark && s.hp <= mark) emit('core', id, { level, hp: s.hp });
    }
    if (s.hp === 0) fallen.push(id);
  }
  if (!fallen.length) return;
  // 同一步失守的核心一起生效，再改派、再判終局
  for (const id of fallen) { const s = state.seats[id]; s.alive = false; s.goal = s.dir = null; s.pad = -1; s.waiting = false; emit('fall', id, { gold: s.gold }); }
  const standing = t => SEAT_IDS.some(id => state.seats[id].team === t && state.seats[id].alive);
  const a = standing('A'), b = standing('B');
  if (!a || !b) { state.mode = 'end'; state.winner = a ? 'A' : b ? 'B' : 'draw'; emit('end', null, { winner: state.winner }); return; }
  for (const id of SEAT_IDS) {
    let count = 0; const to = targetOf(state, id);
    for (const u of state.units) if (u.seat === id && fallen.includes(u.target)) { u.target = to; count++; }
    if (count) emit('reroute', id, { to, count });
  }
}

// ---------- 一步 ----------
// 回傳本步事件；shot 為呈現用暫態事件（transient），不列入紀錄
export function step(state, commands = []) {
  if (state.mode !== 'play') return [];
  const events = [], emit = (type, seat, data, transient = false) => events.push({ tick: state.tick, type, seat, team: seat ? state.seats[seat].team : null, ...data, ...(transient ? { transient: true } : {}) });
  state.tick++;
  if (state.tick === 1) emit('start', null, { seed: state.seed });
  const geometry = GEOMETRY[state.version], { dim } = geometry;
  for (const c of commands) apply(state, c, geometry);
  for (const c of botCommands(state, dim)) apply(state, c, geometry);
  const live = SEAT_IDS.map(id => state.seats[id]).filter(s => s.alive);
  live.forEach(s => moveCommander(s, geometry));
  if (state.tick % RULES.incomeEvery === 0) for (const s of live) s.gold++;
  for (const s of live) checkBeacon(state, s, emit, dim);
  if (state.version >= 3) stepCores(state, stepRoster(state, emit, dim, { RULES, waypoint, clampWalk }), emit);
  else stepUnits(state, emit, dim);
  return events;
}

// ---------- 狀態摘要（FNV-1a，供重跑比對） ----------
export function digest(value) {
  const text = JSON.stringify(value); let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
// 依紀錄重跑：record = { seed, bots, commands: [{ tick, seat, type, x, z }], ticks? }
export function replay(record, maxTicks = 30 * 60 * 30) {
  const state = createSim(record), log = [], marks = []; let i = 0;
  const limit = record.ticks ?? maxTicks;
  while (state.mode === 'play' && state.tick < limit) {
    const now = []; while (i < record.commands.length && record.commands[i].tick === state.tick + 1) now.push(record.commands[i++]);
    for (const e of step(state, now)) if (!e.transient) log.push(e);
    if (state.tick % 30 === 0) marks.push(digest(state));
  }
  return { state, log, marks, final: digest(state), events: digest(log) };
}
