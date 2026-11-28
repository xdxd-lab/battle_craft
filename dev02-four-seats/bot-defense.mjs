// Pure local defense policy. The caller supplies only visible hostile units and own
// shop information; no enemy state (commands, speed, HP, buffs, or gold) is needed.
import { UNIFIED_ATTACK_RANGE_FROM, effectiveWeaponRange, worldGap } from './combat-reach.mjs';
import { MOTION, WORLD_PER_PX } from './motion.mjs';
import { deliveryFor, SCOURGE_CONTACT } from './weapon-delivery.mjs';
import { ATTACKS, FRAME_MS, KINDS, PLATE, canTarget, weaponOf } from './roster.mjs';

export const DEFENSE_RADIUS = 12;
const TICK_PER_FRAME = 30 * FRAME_MS / 1000;
const FIRST_FRAME = { marine: 2, dragoon: 7, hydralisk: 4, archon: 4, mutalisk: 1, wraith: 1, battlecruiser: 1, scout: 1, scourge: 0 };
const SPEED = Object.fromEntries(Object.entries(MOTION).map(([kind, m]) => [
  kind,
  (m.stride ? m.stride.reduce((sum, stride) => sum + stride, 0) / m.stride.length : m.max)
    * WORLD_PER_PX / TICK_PER_FRAME,
]));
const finitePoint = p => Number.isFinite(p?.x) && Number.isFinite(p?.z);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const nominal = kind => KINDS[kind].hp + KINDS[kind].shield;

function firstHitTicks(kind, air, range) {
  const delivery = deliveryFor(10, kind, air);
  let frames = FIRST_FRAME[kind] + (delivery?.delay ?? 0);
  if (delivery?.speed && delivery.accel) {
    // Lower-bound travel estimate; fixed launch and tracker turning are still
    // handled by combat. Give spread launches a short steering allowance.
    let left = Math.max(0, range / WORLD_PER_PX - delivery.muzzle) * 256;
    let speed = 0;
    while (left > 0 && speed < delivery.speed) {
      speed = Math.min(delivery.speed, speed + delivery.accel);
      left -= speed; frames++;
    }
    if (left > 0) frames += Math.ceil(left / delivery.speed);
    if (delivery.offset && range > WORLD_PER_PX) frames += 4;
  }
  return frames * TICK_PER_FRAME;
}

// Estimate a publicly known full-health matchup, not enemy HP or cooldown at this moment.
function volley(weapon, kind) {
  const target = KINDS[kind], hpHit = Math.max(.5, Math.max(0, weapon.damage - PLATE[kind])
    * ATTACKS[weapon.attack].mult[target.armor] / 256);
  const hpShare = target.hp / nominal(kind);
  return (hpShare * hpHit + (1 - hpShare) * weapon.damage) * (weapon.hits ?? 1);
}

function threatensCore(unit, core, radius) {
  return Number.isSafeInteger(unit?.id) && Object.hasOwn(KINDS, unit.kind) && unit.visible !== false
    && finitePoint(unit) && canTarget(KINDS[unit.kind], false) && distance(unit, core) <= radius;
}

// Distinguish peace from an emergency in which the shop has no legal answer.
export function hasDefenseThreat({ core, threats = [], radius = DEFENSE_RADIUS }) {
  return finitePoint(core) && radius > 0 && threats.some(unit => threatensCore(unit, core, radius));
}

function coreThreats(threats, core, coreRadius, radius, version) {
  const ranked = [];
  for (const unit of threats) {
    // Air-only attackers cannot hit the core; do not commit gold to a lone Scourge.
    if (!threatensCore(unit, core, radius)) continue;
    const range = distance(unit, core);
    const weapon = weaponOf(unit.kind, false), eta = Math.max(0, range - coreRadius - (version>=UNIFIED_ATTACK_RANGE_FROM ? effectiveWeaponRange(version,unit.kind) : weapon.range)) / SPEED[unit.kind];
    ranked.push({ unit, eta, range, dps: weapon.damage / Math.max(weapon.cooldown, 1) });
  }
  return ranked.sort((a, b) => a.eta - b.eta || b.dps - a.dps || a.range - b.range || a.unit.id - b.unit.id);
}

function matchup(kind, threat, near) {
  const target = KINDS[threat.kind], self = KINDS[kind];
  if (!canTarget(self, target.air)) return 0;
  const weapon = weaponOf(kind, target.air);
  const retaliation = canTarget(target, self.air) ? weaponOf(threat.kind, self.air) : null;
  const life = retaliation ? nominal(kind) / volley(retaliation, kind) : 12;
  const durability = .7 + .3 * Math.min(1.6, Math.sqrt(life / 3));
  if (self.suicide) {
    // An expendable purchase represents one firing opportunity, not 110 damage/frame.
    // An enemy that can kill it before contact is a worse matchup than a slower/weak one.
    const exposure = retaliation && life <= 1 && retaliation.range > weapon.range ? .16 : 1;
    return Math.min(nominal(threat.kind), volley(weapon, threat.kind)) / 42 * exposure;
  }
  const splashRange = weapon.splash?.radii.at(-1) ?? (weapon.bounces ? 1.5 : 0);
  const neighbors = !splashRange ? 0 : near.filter(o => o.id !== threat.id && distance(o, threat) <= splashRange).length;
  const areaBenefit = 1 + Math.min(2, neighbors) * (weapon.splash ? .40 : .22);
  return volley(weapon, threat.kind) / Math.max(1, weapon.cooldown) * durability * areaBenefit;
}

/**
 * Return {pad, kind, threatId, exchanges}, or null to allow ordinary deployment.
 * threats contains only visible opponents {id, kind, x, z}. Optional visible:false is ignored.
 * Pad entries use world coordinates and may override path length with own ticksToPad.
 * Pass reachable:false / locked:true for routes/plans that cannot currently use a pad.
 * entry is the own squad spawn estimate; fallback to the core when it is unavailable.
 * heldPad only breaks a close decision, so a substantially better counter can revoke it.
 */
export function chooseDefense({
  core, commander, gold, threats = [], pads = [], radius = DEFENSE_RADIUS, coreRadius = 4.6,
  version = 11, entry = core, commanderSpeed = .22, padRadius = 1.35, heldPad = -1,
}) {
  if (!finitePoint(core) || !finitePoint(commander) || !finitePoint(entry) || !Number.isFinite(gold) || gold <= 0) return null;
  if (!(radius > 0 && commanderSpeed > 0 && padRadius >= 0)) return null;
  const ranked = coreThreats(threats, core, coreRadius, radius, version);
  if (ranked.length === 0) return null;
  const primary = ranked[0], main = primary.unit;
  const urgent = ranked.filter(t => t.eta <= primary.eta + 40).slice(0, 8);
  const nearby = urgent.map(t => t.unit);
  const options = [];
  pads.forEach((p, i) => {
    if (!p || p.locked || p.reachable === false || !finitePoint(p) || !Object.hasOwn(KINDS, p.kind)
        || !(Number.isFinite(p.cost) && p.cost > 0 && p.cost <= gold)
        || !(Number.isSafeInteger(p.count) && p.count > 0)) return;
    const kind = p.kind, me = KINDS[kind], target = KINDS[main.kind];
    if (!canTarget(me, target.air)) return;
    const distanceToPad = Math.max(0, distance(commander, p) - padRadius);
    const walk = Number.isFinite(p.ticksToPad) && p.ticksToPad >= 0 ? p.ticksToPad : distanceToPad / commanderSpeed;
    const weapon = weaponOf(kind, target.air);
    const center = distance(entry, main), boxed = version>=UNIFIED_ATTACK_RANGE_FROM;
    const gap = boxed ? worldGap({kind,x:entry.x,z:entry.z},main) : center;
    const range = boxed ? effectiveWeaponRange(version,kind,target.air) : me.suicide ? SCOURGE_CONTACT : weapon.range;
    const advance = Math.max(0,gap-range);
    // Gap controls when the defender can launch; travel of the launched shot
    // is separately estimated to the target's position (not the gap).
    const intercept = advance / SPEED[kind] + firstHitTicks(kind, target.air, boxed ? Math.max(0,center-advance) : Math.min(gap,range));
    const reaction = walk + intercept;
    const late = Math.max(0, reaction - primary.eta);
    // Per-gold efficiency favors affordable responses over hoarding; formations get
    // credit for extra bodies with diminishing returns rather than assuming all fire.
    const attack = matchup(kind, main, nearby);
    const coverage = urgent.length <= 1 ? attack : urgent.slice(1)
      .reduce((sum, t) => sum + matchup(kind, t.unit, nearby), 0) / (urgent.length - 1);
    const score = (.76 * attack + .24 * coverage)
      * (1 + .68 * Math.sqrt(p.count - 1)) / (p.cost ** .66)
      / (1 + reaction / 120 + late / 28);
    const pad = Number.isSafeInteger(p.index) && p.index >= 0 ? p.index : i;
    options.push({ pad, kind, cost: p.cost, reaction, score });
  });
  if (options.length === 0) return null;
  options.sort((a, b) => b.score - a.score || a.reaction - b.reaction || a.cost - b.cost || a.pad - b.pad);
  const best = options[0], held = options.find(p => p.pad === heldPad);
  const pick = held && held.score >= best.score * .94 && held.reaction <= best.reaction + 8 ? held : best;
  const planned = 1 + (urgent.length >= 3 ? 1 : 0) + (urgent.length >= 6 ? 1 : 0);
  return { pad: pick.pad, kind: pick.kind, threatId: main.id, exchanges: Math.min(planned, Math.floor(gold / pick.cost)) };
}
