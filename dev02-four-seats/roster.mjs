// BC01（模擬版本 3）兵種與傷害規則。純資料與純函式，不碰 DOM、亂數或三角函式。
// 規格與證據：../research/BC01-ROSTER-DAMAGE.md。標「引擎」者沿用原版引擎預設，標「暫定」者尚未定案。

export const EXPANSION_VERSION = 19;
export const FRAME_MS = 42;        // 暫定：以 Fastest 的 42 ms／frame 換算 30 Hz，未驗證
export const framesAt = tick => Math.floor(tick * 1000 / (30 * FRAME_MS));
export const SHIELD_REGEN = 7;     // 引擎：每 frame 回 7/256 點，受擊不中斷
export const BOUNCE_RADIUS = 1.5;  // 暫定：下一跳搜尋半徑
export const CORE = { hp: 900, armor: 'heavy', overtimeDamage: 8 }; // 暫定

// 三種攻擊標籤。B（彈跳）的倍率暫定同 N；E 對輕／中／重本體為 50／75／100%（定案）
export const ATTACKS = {
  N: { name: '普通', mult: { light: 256, medium: 256, heavy: 256 } },
  E: { name: '指向性爆炸', mult: { light: 128, medium: 192, heavy: 256 } },
  B: { name: '彈跳', mult: { light: 256, medium: 256, heavy: 256 } },
};
// 範圍傷害與攻擊類型分開判斷：E 只決定體型倍率，不代表濺射。
// 破壞能 Psionic Shockwave：原版 3／15／30 px 內 100／50／25%（Enemy_Splash）。px 依射程換算 1.62／128，
// 再乘 4 倍密度係數（暫定：本作部隊間距 .95 約為原版步兵間距的 4 倍）。不傷己席，可傷隊友（暫定，依官方說明）；
// 只在攻擊部隊時觸發，攻擊核心不濺射；空地兩層皆受影響（暫定）。
export const SPLASH_SCALE = 1.62 / 128 * 4;
export const SPLASH = { archon: { radii: [3, 15, 30].map(px => px * SPLASH_SCALE), parts: [1, .5, .25], spareSeat: true, spareTeam: false } };
export const ARMORS = { light: '輕', medium: '中', heavy: '重' };

// hp／shield／damage／cooldown（frame）：引擎預設。射程比例依引擎 128／128／96 px。
// range 單位換算、projectile（每 tick 距離）、cost、count：暫定。
export const KINDS = {
  marine: { name: '陸戰隊', source: 'Marine', armor: 'light', attack: 'N', hp: 40, shield: 0, damage: 6, cooldown: 15, range: 1.62, air: false, targets: ['ground', 'air'], projectile: 0, bounces: 0, cost: 5, count: 1 },
  dragoon: { name: '重騎兵', source: 'Dragoon', armor: 'heavy', attack: 'E', hp: 100, shield: 80, damage: 20, cooldown: 30, range: 1.62, air: false, targets: ['ground', 'air'], projectile: .12, bounces: 0, cost: 12, count: 1 },
  mutalisk: { name: '飛螳', source: 'Mutalisk', armor: 'light', attack: 'B', hp: 120, shield: 0, damage: 9, cooldown: 30, range: 1.215, air: true, targets: ['ground', 'air'], projectile: .2, bounces: 2, cost: 14, count: 1 },
  // 以下三種自模擬版本 6 起開放。hp／shield／damage／cooldown／射程 px 取 BWAPI 原版預設；cost、projectile、濺射半徑換算為暫定。
  hydralisk: { name: '刺蛇', source: 'Hydralisk', armor: 'medium', attack: 'E', hp: 80, shield: 0, damage: 10, cooldown: 15, range: 1.62, air: false, targets: ['ground', 'air'], projectile: .2, bounces: 0, cost: 9, count: 1 },
  archon: { name: '破壞能', source: 'Archon', armor: 'heavy', attack: 'N', hp: 10, shield: 350, damage: 30, cooldown: 20, range: .81, air: false, hover: true, targets: ['ground', 'air'], projectile: 0, bounces: 0, cost: 28, count: 1, splash: SPLASH.archon },
  // 死靈式戰機對地 Burst Lasers（N，即時）、對空 Gemini Missiles（E，投射物）；隱形未實作
  wraith: { name: '死靈式戰機', source: 'Wraith', armor: 'heavy', attack: 'N', hp: 120, shield: 0, damage: 8, cooldown: 30, range: 2.025, air: true, targets: ['ground', 'air'], projectile: 0, bounces: 0, cost: 17, count: 1,
    vsAir: { attack: 'E', damage: 20, cooldown: 22, range: 2.025, projectile: .25 } },
  // 以下三種自模擬版本 7 起開放。hp／shield／plate／damage／cooldown／射程 px 取 BWAPI 原版預設；cost、projectile、自殺蟲接觸距離為暫定。見 ../research/BC-NINE-UNITS.md
  // 戰鬥巡洋艦 ATS／ASS Laser Battery：對地對空同為 N 25、冷卻 30、192 px，即時；Yamato 未實作
  battlecruiser: { name: '戰鬥巡洋艦', source: 'Battlecruiser', armor: 'heavy', attack: 'N', hp: 500, shield: 0, damage: 25, cooldown: 30, range: 2.43, air: true, targets: ['ground', 'air'], projectile: 0, bounces: 0, cost: 40, count: 1 },
  // 斥候對地 Dual Photon Blasters（N 8、冷卻 30、即時）；對空 Anti-Matter Missiles（E 14×2 發、冷卻 22、投射物）
  scout: { name: '斥候', source: 'Scout', armor: 'heavy', attack: 'N', hp: 150, shield: 100, damage: 8, cooldown: 30, range: 1.62, air: true, targets: ['ground', 'air'], projectile: 0, bounces: 0, cost: 24, count: 1,
    vsAir: { attack: 'E', damage: 14, hits: 2, cooldown: 22, range: 1.62, projectile: .25 } },
  // 自殺蟲 Suicide Scourge：只打空中，N 110，接觸即自爆（自己陣亡、不算對方擊殺）；原版一次孵化 2 隻，本作每次 1 隻（暫定）
  scourge: { name: '自殺蟲', source: 'Scourge', armor: 'light', attack: 'N', hp: 25, shield: 0, damage: 110, cooldown: 0, range: .5, air: true, targets: ['air'], projectile: 0, bounces: 0, cost: 6, count: 1, suicide: true },
  // 試玩數值和現有九兵種同尺度，原地圖的自訂傷害與每批數量不直接搬入。
  guardian: {name:'守護者',source:'Guardian',armor:'heavy',attack:'N',hp:150,shield:0,damage:20,cooldown:30,range:3.24,air:true,targets:['ground'],projectile:.2,bounces:0,cost:50,count:1},
  valkyrie: {name:'女武神',source:'Valkyrie',armor:'heavy',attack:'E',hp:200,shield:0,damage:6,cooldown:64,range:2.43,air:true,targets:['air'],projectile:.2,bounces:0,cost:32.5,count:1},
  warbringer: {name:'掠奪者 ★',source:'Warbringer (Reaver)',armor:'heavy',attack:'N',hp:200,shield:400,damage:100,cooldown:60,range:3.24,air:false,targets:['ground'],projectile:.2,bounces:0,cost:30,count:1},
};
// 基礎護甲（BWAPI defaultArmor），只在模擬版本 7 起生效；版本 3–6 不扣護甲以保持重播
export const PLATE = { marine: 0, dragoon: 1, mutalisk: 0, hydralisk: 0, archon: 0, wraith: 0, battlecruiser: 3, scout: 0, scourge: 0, guardian: 2, valkyrie: 2, warbringer: 3 };
export const KIND_IDS = Object.keys(KINDS);
export const canTarget = (spec, air) => spec.targets.includes(air ? 'air' : 'ground');
// 依目標所在高度層選武器；沒有 vsAir 的兵種一律用本體數值（版本 3–5 行為不變）
const AIR_WEAPON = {};
export const weaponOf = (kind, air) => {
  const spec = KINDS[kind];
  if (!air || !spec.vsAir) return spec;
  return AIR_WEAPON[kind] ??= { ...spec, ...spec.vsAir };
};
// 各模擬版本開放的兵種（購兵區順序）
export const ROSTER = { 3: ['marine', 'dragoon', 'mutalisk'], 6: ['marine', 'dragoon', 'mutalisk', 'hydralisk', 'archon', 'wraith'] };
ROSTER[7] = [...ROSTER[6], 'battlecruiser', 'scout', 'scourge'];
ROSTER[EXPANSION_VERSION] = [...ROSTER[7], 'guardian', 'valkyrie', 'warbringer'];
export const rosterFor = version => version >= EXPANSION_VERSION ? ROSTER[EXPANSION_VERSION] : version >= 7 ? ROSTER[7] : version >= 6 ? ROSTER[6] : ROSTER[3];

// 一發傷害，依原版引擎順序；內部全用 1/256 定點整數。target 的 hp、sh 是 1/256 的整數倍。
// 彈跳除數 → 整發下限 0.5 → 盾 ≥ 1 才吸收原始傷害 → 剩餘扣基礎護甲 plate（版本 7 起）→ 乘本體倍率（捨去）→ 完全沒扣到盾時本體下限 0.5
export function applyDamage(target, damage, attack, divisor = 1, plate = 0) {
  let raw = Math.max(128, Math.floor(damage * 256 / divisor)), shield = 0;
  const sh = Math.round((target.sh || 0) * 256);
  if (sh >= 256) { shield = Math.min(raw, sh); raw -= shield; target.sh = (sh - shield) / 256; }
  if (plate && raw > 0) raw = Math.max(0, raw - plate * 256);
  let body = Math.floor(raw * ATTACKS[attack].mult[target.armor] / 256);
  if (!shield && body < 128) body = 128;
  target.hp -= body / 256;
  return { shield: shield / 256, body: body / 256 };
}

export const unitStats = kind => ({ kind, hp: KINDS[kind].hp, sh: KINDS[kind].shield });
