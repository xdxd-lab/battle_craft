// BC01（模擬版本 3）兵種與傷害規則。純資料與純函式，不碰 DOM、亂數或三角函式。
// 規格與證據：../research/BC01-ROSTER-DAMAGE.md。標「引擎」者沿用原版引擎預設，標「暫定」者尚未定案。

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
export const ARMORS = { light: '輕', medium: '中', heavy: '重' };

// hp／shield／damage／cooldown（frame）：引擎預設。射程比例依引擎 128／128／96 px。
// range 單位換算、projectile（每 tick 距離）、cost、count：暫定。
export const KINDS = {
  marine: { name: '陸戰隊', source: 'Marine', armor: 'light', attack: 'N', hp: 40, shield: 0, damage: 6, cooldown: 15, range: 1.62, air: false, targets: ['ground', 'air'], projectile: 0, bounces: 0, cost: 5, count: 1 },
  dragoon: { name: '重騎兵', source: 'Dragoon', armor: 'heavy', attack: 'E', hp: 100, shield: 80, damage: 20, cooldown: 30, range: 1.62, air: false, targets: ['ground', 'air'], projectile: .12, bounces: 0, cost: 12, count: 1 },
  mutalisk: { name: '飛螳', source: 'Mutalisk', armor: 'light', attack: 'B', hp: 120, shield: 0, damage: 9, cooldown: 30, range: 1.215, air: true, targets: ['ground', 'air'], projectile: .2, bounces: 2, cost: 14, count: 1 },
};
export const KIND_IDS = Object.keys(KINDS);
export const canTarget = (spec, air) => spec.targets.includes(air ? 'air' : 'ground');

// 一發傷害，依原版引擎順序；內部全用 1/256 定點整數。target 的 hp、sh 是 1/256 的整數倍。
// 彈跳除數 → 整發下限 0.5 → 盾 ≥ 1 才吸收原始傷害 → 剩餘乘本體倍率（捨去）→ 完全沒扣到盾時本體下限 0.5
export function applyDamage(target, damage, attack, divisor = 1) {
  let raw = Math.max(128, Math.floor(damage * 256 / divisor)), shield = 0;
  const sh = Math.round((target.sh || 0) * 256);
  if (sh >= 256) { shield = Math.min(raw, sh); raw -= shield; target.sh = (sh - shield) / 256; }
  let body = Math.floor(raw * ATTACKS[attack].mult[target.armor] / 256);
  if (!shield && body < 128) body = 128;
  target.hp -= body / 256;
  return { shield: shield / 256, body: body / 256 };
}

export const unitStats = kind => ({ kind, hp: KINDS[kind].hp, sh: KINDS[kind].shield });
