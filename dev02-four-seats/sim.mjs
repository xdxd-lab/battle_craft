// DEV02 四席固定步模擬。純資料：不碰 DOM、Three.js、Math.random、Date。版本 8 的移動才使用三角函式。
// 同一組設定與指令在任何地方重跑都得到相同狀態；呈現層只讀不寫。
import * as L from '../dev05-layout/layout.mjs';
import { ARENA, ARENA_V8 } from './arena.mjs';
import { KINDS, CORE, unitStats, rosterFor } from './roster.mjs';
import { DRAGOON_TRACK_RANGE_FROM, DRAGOON_RANGE_TRIAL_FROM, stepRoster } from './combat.mjs';
export { DRAGOON_TRACK_RANGE_FROM, DRAGOON_RANGE_TRIAL_FROM, DRAGOON_TRIAL_RANGE, effectiveWeaponRange } from './combat.mjs';
import { UNIFIED_ATTACK_RANGE_FROM } from './combat-reach.mjs';
export { UNIFIED_ATTACK_RANGE_FROM } from './combat-reach.mjs';
import { createGroundOccupancy } from './ground-occupancy.mjs';

import { DEFENSE_VERSION, VISIBILITY_VERSION, DEFENSE_TUNING_VERSION, buyTower } from './defense-tower.mjs';
import { chooseDefense, hasDefenseThreat } from './bot-defense.mjs';
import { SPECIAL_POWER_VERSION, PLAYABLE_JUNCTION_RADIUS, scaleCoins, applySpecialPower } from './special-powers.mjs';

export const HZ = 30;
export const VERSION = 10; // 1、2：單一突擊機；3：BC01 三兵種；4：同 3，可通行道路加寬 10%；5：同 4，開場金幣×4、收入×2、陸戰隊售價×1.5；6：同 5，加刺蛇、破壞能、死靈式戰機，每席六座信標；7：同 6，加戰鬥巡洋艦、斥候、自殺蟲，九座信標、每次收入×3、基礎護甲生效；8：戰鬥巡洋艦每次 3 艘、收入 4.5 金／0.625 秒、核心耐久×3；9：佔位、空軍慢慢散開、起手；10：九兵種發射和命中（舊版保留供重播）
// 以下皆為原型數值。標 v5 者沿用 v5，其餘為本輪暫定。
export const RULES = {
  startGold: 12, incomeEvery: 30, purchaseGap: 15, // v5：12 金起始、每秒 1 金、兩次購買至少 0.5 秒
  coreHp: 120, unitHp: 3, unitSpeed: .078, unitRange: 1.62, unitCooldown: 24, unitDamage: 1, commanderSpeed: .22, // v5（核心血量 v5 為 60）
  padRadius: 1.6,     // v5 為 2.25；DEV05 信標較密
  aggro: 5,           // 平面距離內主動接敵
  spacing: .95,       // 部隊間距
  overtimeAt: 30 * 60 * 8, overtimeEvery: 60, // 8 分鐘起所有核心每 2 秒過載扣 1，保證終局
  coreRadius: 4.6, spawnRadial: ARENA.spawnRadial, laneHalf: 3.6, junction: PLAYABLE_JUNCTION_RADIUS, platform: ARENA.platformWalkRadius,
};
// 信標位置以北席本地座標相對購買區中心
const place = (pads, positions = ARENA.shopPadPositions) => pads.map((pad, i) => {
  const [x, z] = positions[i];
  return { ...pad, x, z };
});
const PADS_V2 = place([
  { cost: 5, count: 1, label: '單兵部署' }, // v5 價格
  { cost: 12, count: 3, label: '編隊部署' },
  { locked: true, label: '未開放' },
  { locked: true, label: '未開放' },
]);
// 版本 5 經濟：以版本 3、4 的值乘上倍率。7.5 金不取整；金幣只會是 0.5 的倍數，二進位浮點可精確表示。
export const ECONOMY = { startGold: RULES.startGold * 4, incomeEvery: RULES.incomeEvery / 2, costs: { marine: KINDS.marine.cost * 1.5 } };
const ECONOMY_V7 = { ...ECONOMY, income: 3 }; // 版本 7：每次發放金額×3（間隔、起始金幣不變）
// 版本 8 以舊版 15 步 × 5/4 = 18.75 步為週期，不把每次間隔單獨取整。
const ECONOMY_V8 = { ...ECONOMY_V7, income: ECONOMY_V7.income * 1.5, incomeEvery: ECONOMY_V7.incomeEvery * 1.25 };
// v16 redenominates the ongoing economy; payout cadence and purchase cooldown stay intact.
const ECONOMY_V16 = {
  ...ECONOMY_V8,
  startGold: scaleCoins(SPECIAL_POWER_VERSION, ECONOMY_V8.startGold),
  income: scaleCoins(SPECIAL_POWER_VERSION, ECONOMY_V8.income),
  costs: Object.fromEntries(rosterFor(SPECIAL_POWER_VERSION).map(kind =>
    [kind, scaleCoins(SPECIAL_POWER_VERSION, ECONOMY_V8.costs[kind] ?? KINDS[kind].cost)])),
};
export const economyFor = version => version >= SPECIAL_POWER_VERSION ? ECONOMY_V16 : version >= 8 ? ECONOMY_V8 : version >= 7 ? ECONOMY_V7 : version >= 5 ? ECONOMY : { startGold: RULES.startGold, incomeEvery: RULES.incomeEvery, costs: {} };
export const padRadiusFor = version => version >= 7 ? 1.35 : RULES.padRadius; // 版本 7 三欄放不下 1.6：|x|＋r＜4.5 且欄距 3＞2r
const LEGACY_WRAITH = '死靈戰機'; // 保留 v1–9 歷史重播的事件字串
const rosterPad = (version, kind) => ({ kind, cost: economyFor(version).costs[kind] ?? KINDS[kind].cost, count: version >= 8 && kind === 'battlecruiser' ? 3 : KINDS[kind].count, label: kind === 'wraith' && version < 10 ? LEGACY_WRAITH : KINDS[kind].name });
// 版本 6：購買區 9×15 內兩欄三列，信標中心相距 4.4／4.8（大於兩倍 padRadius），皆在指揮官可走範圍內（暫定）
export const SIX_PAD_POSITIONS = [[2.2, 4.8], [-2.2, 4.8], [2.2, 0], [-2.2, 0], [2.2, -4.8], [-2.2, -4.8]];
// 版本 7：三欄三列，欄 x＝3／0／−3、列 z＝4.8／0／−4.8（由上而下、由左而右），中心相距 3／4.8（暫定）
export const NINE_PAD_POSITIONS = [4.8, 0, -4.8].flatMap(z => [3, 0, -3].map(x => [x, z]));
const rosterPads = version => version >= 7 ? place(rosterFor(version).map(kind => rosterPad(version, kind)), NINE_PAD_POSITIONS)
  : version >= 6 ? place(rosterFor(version).map(kind => rosterPad(version, kind)), SIX_PAD_POSITIONS)
  : place([...rosterFor(version).map(kind => rosterPad(version, kind)), { locked: true, label: '未開放' }]);
const PADS_V3 = rosterPads(3), PADS_V5 = rosterPads(5), PADS_V6 = rosterPads(6), PADS_V7 = rosterPads(7), PADS_V8 = rosterPads(8), PADS_V10 = rosterPads(10);
const PADS_V16 = rosterPads(SPECIAL_POWER_VERSION);
export const padsFor = version => version >= SPECIAL_POWER_VERSION ? PADS_V16 : version >= 10 ? PADS_V10 : version >= 8 ? PADS_V8 : version >= 7 ? PADS_V7 : version >= 6 ? PADS_V6 : version >= 5 ? PADS_V5 : version >= 3 ? PADS_V3 : PADS_V2;
export const PADS = padsFor(VERSION); // 新對局使用
export const coreMax = version => version >= 8 ? CORE.hp * 3 : version >= 3 ? CORE.hp : RULES.coreHp;
const HOME_V2 = { x: .9, z: 0 }, HOME_V6 = { x: 0, z: 0 }, HOME_V7 = { x: 0, z: 2.4 }; // 版本 6 置中，避開中列信標；版本 7 中央是信標，改站上、中兩列之間
const homeFor = version => version >= 7 ? HOME_V7 : version >= 6 ? HOME_V6 : HOME_V2;
const GEOMETRY = {
  1: { dim: L.DIM, shopBounds: [-4, 5.8, -4.2, 4.2] },
  2: { dim: ARENA, shopBounds: [
    .6 - ARENA.shopWidth / 2, ARENA.shopWidth / 2 - .6,
    .6 - ARENA.shopDepth / 2, ARENA.shopDepth / 2 - .6,
  ] },
};
GEOMETRY[3] = GEOMETRY[2];
GEOMETRY[4] = { ...GEOMETRY[2], dim: { ...ARENA, laneHalf: RULES.laneHalf * 1.1 } };
GEOMETRY[5] = GEOMETRY[4];
GEOMETRY[6] = { ...GEOMETRY[5], dim: { ...GEOMETRY[5].dim, shopPadPositions: SIX_PAD_POSITIONS } };
GEOMETRY[7] = { ...GEOMETRY[5], dim: { ...GEOMETRY[5].dim, shopPadPositions: NINE_PAD_POSITIONS } };
GEOMETRY[8] = { ...GEOMETRY[7], dim: { ...GEOMETRY[7].dim, ...ARENA_V8, shopPadPositions: NINE_PAD_POSITIONS } };
GEOMETRY[9] = GEOMETRY[8]; // development-only combat candidate; NEW MATCH keeps 8 until the candidate is released
GEOMETRY[10] = GEOMETRY[9];
GEOMETRY[DEFENSE_VERSION] = GEOMETRY[10];
GEOMETRY[VISIBILITY_VERSION] = {...GEOMETRY[10],dim:{...GEOMETRY[10].dim,visibleTower:true,dragoonLaneClearance:true}};
GEOMETRY[DEFENSE_TUNING_VERSION] = {...GEOMETRY[VISIBILITY_VERSION],dim:{...GEOMETRY[VISIBILITY_VERSION].dim,dragoonClearanceScale:1.2}};
GEOMETRY[DRAGOON_TRACK_RANGE_FROM] = GEOMETRY[DEFENSE_TUNING_VERSION]; // 保留 v13 佔位，重騎兵加入短暫的瞄準保持
GEOMETRY[DRAGOON_RANGE_TRIAL_FROM] = GEOMETRY[DRAGOON_TRACK_RANGE_FROM]; // 只試射程，移動佔位不變
GEOMETRY[SPECIAL_POWER_VERSION] = GEOMETRY[DRAGOON_RANGE_TRIAL_FROM];
GEOMETRY[UNIFIED_ATTACK_RANGE_FROM] = GEOMETRY[SPECIAL_POWER_VERSION]; // Geometry of the map and movement stays v16.
export const dimFor = version => GEOMETRY[version].dim;
export const DIM = dimFor(VERSION); // 新對局的場地（呈現層用）
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
    const home = homeFor(version), [x, z] = toWorld(s.id, home.x, home.z, dim);
    state.seats[s.id] = { id: s.id, team: s.team, alive: true, gold: economyFor(version).startGold, hp: coreMax(version), commander: { x, z, dx: 0, dz: 0 }, goal: null, dir: null, pad: -1, nextBuy: 0, waiting: false, buys: 0, spent: 0, deployed: 0, lost: 0, kills: 0 };
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
// 版本 6 電腦選信標的累計機率（%，暫定）：陸戰隊 26、重騎兵 16、飛螳 14、刺蛇 20、破壞能 10、死靈式戰機 14
const BOT_V6 = [26, 42, 56, 76, 86, 100];
// 版本 7（暫定）：陸戰隊 18、重騎兵 12、飛螳 10、刺蛇 14、破壞能 8、死靈式戰機 10、戰鬥巡洋艦 6、斥候 10、自殺蟲 12
const BOT_V7 = [18, 30, 40, 54, 62, 72, 78, 88, 100];
function defenseOrder(state, s, b, dim, emit) {
  const now=state.tick;
  if(now>=(b.checkDefense??0)){
    b.checkDefense=now+10; // Check roughly 3 times/sec, not once per combat step.
    const [x,z]=L.corePos(s.id,dim), radius=13;
    const threats=state.units.filter(u=>u.hp>0&&u.team!==s.team&&dist(x,z,u.x,u.z)<=radius)
      .map(({id,kind,x,z})=>({id,kind,x,z}));
    const pads=padsFor(state.version).map((p,index)=>{const [x,z]=padWorld(s.id,index,dim);return {...p,index,x,z};});
    const [ex,ez]=turn([0,-dim.spawnRadial],L.seatIndex(s.id));
    const plan=chooseDefense({version:state.version,core:{x,z},commander:s.commander,gold:s.gold,threats,pads,radius,heldPad:b.pad,
      entry:{x:ex,z:ez},coreRadius:RULES.coreRadius,padRadius:padRadiusFor(state.version),commanderSpeed:RULES.commanderSpeed});
    if(plan && (b.defense || now>=(b.defenseRest??0))){
      if(!b.defense||plan.pad!==b.pad){
        b.defense=true;b.pad=plan.pad;b.seen=s.buys;b.left=plan.exchanges;
        emit('npc-defense',s.id,{kind:plan.kind,threat:plan.threatId,limit:plan.exchanges});
        const p=pads[plan.pad];return {seat:s.id,type:'goal',x:p.x,z:p.z};
      }
    } else if(b.defense || (!plan && hasDefenseThreat({core:{x,z},threats,radius}))) {
      b.defense=false;b.pad=-1;b.defenseRest=b.until=now+10;
      const [x,z]=toWorld(s.id,0,2.4,dim);return {seat:s.id,type:'goal',x,z};
    }
  }
  if(!b.defense)return null;
  if(s.buys-b.seen<b.left)return false;
  b.defense=false;b.pad=-1;b.defenseRest=b.until=now+12;b.checkDefense=b.defenseRest;
  const [x,z]=toWorld(s.id,0,2.4,dim);return {seat:s.id,type:'goal',x,z};
}

function botCommands(state, dim, emit) {
  const out = [];
  for (const id of SEAT_IDS) {
    const b = state.bots[id], s = state.seats[id];
    if (!b || !s.alive) continue;
    const roll = n => { b.rng = nextRandom(b.rng); return b.rng % n; };
    if (state.tick === 1) { b.until = 60 + roll(60); if(state.version<DEFENSE_VERSION)continue; }
    if(state.version>=DEFENSE_VERSION){
      const order=defenseOrder(state,s,b,dim,emit);
      if(order){out.push(order);continue;}
      if(order===false||state.tick===1)continue;
    }
    if (b.pad >= 0) {
      if (s.buys - b.seen < b.left) continue;
      b.pad = -1; b.until = state.tick + roll(60);
      const home = homeFor(state.version), [x, z] = toWorld(id, home.x, home.z, dim); out.push({ seat: id, type: 'goal', x, z });
    } else if (state.tick >= b.until) {
      if (state.version >= 6) { const n = roll(100); b.pad = (state.version >= 7 ? BOT_V7 : BOT_V6).findIndex(c => n < c); b.left = b.pad ? 1 : 1 + roll(3); }
      else if (state.version >= 3) { const n = roll(100); b.pad = n < 45 ? 0 : n < 73 ? 1 : 2; b.left = b.pad ? 1 : 1 + roll(3); }
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
  const ids = [], target = targetOf(state,s.id), index = L.seatIndex(s.id);
  let spots = null;
  if (state.version >= 9 && !KINDS[p.kind].air) {
    const drafts = Array.from({length:p.count}, (_,i) => {
      // Keep wider Dragoons in ranks toward the road instead of putting the
      // end of a large batch behind the first rank and against the solid core.
      const rank = Math.floor(i/4), width = Math.min(4,p.count-rank*4);
      const draft = dim.dragoonLaneClearance && p.kind==='dragoon' && p.count>1
        ? [(i%4-(width-1)/2)*.98*(dim.dragoonClearanceScale??1),-dim.spawnRadial+rank*.97*(dim.dragoonClearanceScale??1)]
        : [((s.deployed+i)%5-2)*1.25,-dim.spawnRadial-i*.4];
      const [x,z] = turn(draft,index);
      return {id:state.serial+i+1,seat:s.id,kind:p.kind,x,z};
    });
    // Do not spend, increment serials or start the cooldown when the whole wave
    // cannot fit. Since seats are visited in order, earlier successful waves reserve their own space.
    spots = createGroundOccupancy(state.units,dim,RULES).reserveWave(drafts);
    if (!spots) return false;
  }
  s.gold -= p.cost; s.spent += p.cost; s.buys++;
  for (let i = 0; i < p.count; i++) {
    const id = ++state.serial, lat = (s.deployed % 5 - 2) * 1.25; s.deployed++;
    const [x, z] = spots ? [spots[i].x,spots[i].z] : turn([lat, -dim.spawnRadial - i * .4], index);
    state.units.push({ id, seat: s.id, team: s.team, x, z, hp: RULES.unitHp, cd: 0, lat, target, foe: 0, dx: 0, dz: 0, ...(p.kind ? unitStats(p.kind) : {}) });
    ids.push(id);
  }
  emit('buy', s.id, { cost: p.cost, count: p.count, gold: s.gold, label: p.label, units: ids, ...(p.kind ? { kind: p.kind } : {}) });
  return true;
}
function padAt(s, PADS, dim, r) {
  for (let i = 0; i < PADS.length; i++) { if (PADS[i].locked) continue; const [x, z] = padWorld(s.id, i, dim); if (dist(x, z, s.commander.x, s.commander.z) <= r) return i; }
  return -1;
}
function checkBeacon(state, s, emit, dim) {
  const PADS = padsFor(state.version), i = padAt(s, PADS, dim, padRadiusFor(state.version));
  if (i !== s.pad) {
    if (s.pad >= 0) emit('leave', s.id, { label: PADS[s.pad].label });
    s.pad = i; s.nextBuy = state.tick; s.waiting = false;
    if (i >= 0) emit('enter', s.id, { label: PADS[i].label });
  }
  if (i < 0) return;
  // A defensive path may cross another circle. Don't spend the saved gold on a
  // different unit before reaching the chosen defensive pad.
  const bot=state.version>=DEFENSE_VERSION?state.bots[s.id]:null;
  if((bot?.defense&&i!==bot.pad) || bot?.defenseRest>state.tick)return;
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
  for (const c of botCommands(state, dim, emit)) apply(state, c, geometry);
  const live = SEAT_IDS.map(id => state.seats[id]).filter(s => s.alive);
  live.forEach(s => moveCommander(s, geometry));
  const econ = economyFor(state.version);
  // 累計期數每跨一個整數就發放，步號 19／38／57／75 循環，平均精確為 18.75 步。
  const pays = state.version >= 8
    ? Math.floor(state.tick / econ.incomeEvery) > Math.floor((state.tick - 1) / econ.incomeEvery)
    : state.tick % econ.incomeEvery === 0;
  if (pays) for (const s of live) s.gold += econ.income ?? 1;
  if (state.version >= DEFENSE_VERSION) for (const c of commands) {
    if (c?.type === 'tower') buyTower(state,state.seats[c.seat],dim,emit);
    else if (state.version >= SPECIAL_POWER_VERSION && c?.type === 'special')
      applySpecialPower(state,c.seat,c.power,dim,targetOf,emit);
  }
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
