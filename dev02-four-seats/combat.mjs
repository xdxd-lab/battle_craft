// 版本 3 的部隊步進：索敵、移動、投射物、彈跳與回盾。傷害順序固定：先抵達的投射物（依編號），再即時攻擊（依射手編號）。
import * as L from '../dev05-layout/layout.mjs';
import { KINDS, CORE, BOUNCE_RADIUS, SHIELD_REGEN, framesAt, canTarget, applyDamage } from './roster.mjs';

const dist = (ax, az, bx, bz) => Math.sqrt((ax - bx) * (ax - bx) + (az - bz) * (az - bz));
export const armorOf = u => u.armor ?? KINDS[u.kind].armor;

export function stepRoster(state, emit, dim, { RULES: R, waypoint, clampWalk }) {
  const units = state.units, alive = new Map(units.map(u => [u.id, u])), frames = framesAt(state.tick) - framesAt(state.tick - 1);
  for (const u of units) {
    const max = KINDS[u.kind].shield;
    if (u.sh < max) u.sh = Math.min(max, u.sh + SHIELD_REGEN * frames / 256);
    u.cd = Math.max(0, u.cd - frames);
  }
  // 第一階段：全部依同一份位置決定目標與移動
  const plan = units.map(u => {
    const spec = KINDS[u.kind];
    let foe = null, best = Infinity;
    for (const o of units) { if (o.team === u.team || !canTarget(spec, KINDS[o.kind].air)) continue; const d = dist(u.x, u.z, o.x, o.z); if (d < best || (d === best && o.id < foe.id)) { best = d; foe = o; } }
    if (best > R.aggro) foe = null;
    const p = { mx: 0, mz: 0, sx: 0, sz: 0, hit: null, core: null };
    u.foe = foe ? foe.id : 0;
    if (foe && best <= spec.range) p.hit = foe;
    else if (foe) { p.mx = foe.x - u.x; p.mz = foe.z - u.z; }
    else if (u.target) {
      const [cx, cz] = L.corePos(u.target, dim);
      if (dist(u.x, u.z, cx, cz) <= R.coreRadius + spec.range) p.core = u.target;
      else { const [wx, wz] = waypoint(u, dim); p.mx = wx - u.x; p.mz = wz - u.z; }
    }
    for (const o of units) { // 隊形分離只在同一高度層
      if (o === u || KINDS[o.kind].air !== spec.air) continue; const d = dist(u.x, u.z, o.x, o.z);
      if (d >= R.spacing) continue;
      if (d < 1e-6) { const q = u.id < o.id ? 1 : -1, [ox, oz] = L.ccw(L.seatById(u.seat).dir); p.sx += ox * q; p.sz += oz * q; }
      else { const k = (R.spacing - d) / R.spacing / d; p.sx += (u.x - o.x) * k; p.sz += (u.z - o.z) * k; }
    }
    return p;
  });
  // 第二階段：飛行中的投射物前進
  const arrived = [], flying = [];
  for (const s of state.shots) {
    const foe = s.core ? null : alive.get(s.target);
    if (foe) { s.tx = foe.x; s.tz = foe.z; }
    const speed = KINDS[s.kind].projectile, d = dist(s.x, s.z, s.tx, s.tz), left = d - (s.core ? R.coreRadius : 0);
    if (left <= speed) {
      if (d > 0 && left > 0) { s.x += (s.tx - s.x) / d * left; s.z += (s.tz - s.z) / d * left; }
      arrived.push(s);
    } else { s.x += (s.tx - s.x) / d * speed; s.z += (s.tz - s.z) / d * speed; flying.push(s); }
  }
  state.shots = flying;
  // 第三階段：開火
  const instant = [];
  units.forEach((u, i) => {
    const p = plan[i], spec = KINDS[u.kind];
    if ((!p.hit && !p.core) || u.cd) return;
    u.cd = spec.cooldown;
    const [x, z] = p.core ? L.corePos(p.core, dim) : [p.hit.x, p.hit.z];
    if (spec.projectile) {
      const shot = { id: ++state.shotSerial, kind: u.kind, seat: u.seat, team: u.team, from: u.id, x: u.x, z: u.z, tx: x, tz: z, target: p.core ? 0 : p.hit.id, core: p.core, hop: 0, prev: null };
      state.shots.push(shot); emit('launch', u.seat, { from: u.id, shot: shot.id, kind: u.kind }, true);
    } else {
      instant.push({ from: u.id, kind: u.kind, seat: u.seat, target: p.core ? 0 : p.hit.id, core: p.core, hop: 0 });
      emit('shot', u.seat, { from: u.id, x, z, ...(p.core ? { core: p.core } : { to: p.hit.id }) }, true);
    }
  });
  // 第四階段：依固定順序結算傷害
  const coreDamage = {}, killer = new Map();
  for (const h of [...arrived, ...instant.sort((a, b) => a.from - b.from)]) {
    const spec = KINDS[h.kind], divisor = 3 ** h.hop;
    let dealt = null;
    if (h.core) {
      if (state.seats[h.core].alive) { const body = { hp: 0, sh: 0, armor: CORE.armor }; dealt = applyDamage(body, spec.damage, spec.attack, divisor); coreDamage[h.core] = (coreDamage[h.core] || 0) + dealt.body; }
    } else {
      const t = alive.get(h.target);
      if (t && t.hp > 0) {
        const body = { hp: t.hp, sh: t.sh, armor: armorOf(t) };
        dealt = applyDamage(body, spec.damage, spec.attack, divisor); t.hp = body.hp; t.sh = body.sh;
        if (t.hp <= 0) killer.set(t.id, h.seat);
      }
    }
    if (h.id) emit(dealt ? 'impact' : 'fizzle', h.seat, { shot: h.id, kind: h.kind, hop: h.hop, x: h.x, z: h.z, target: h.core || h.target, ...(dealt ?? {}) }, true);
  }
  // 第五階段：彈跳。射手仍存活才續彈；排除本跳與上一跳目標，取最近者，同距取小編號
  for (const s of arrived) {
    const spec = KINDS[s.kind], owner = alive.get(s.from);
    if (s.hop >= spec.bounces || !owner || owner.hp <= 0) continue;
    const here = s.core || s.target;
    let next = null, best = Infinity;
    for (const o of units) {
      if (o.team === s.team || o.hp <= 0 || o.id === here || o.id === s.prev || !canTarget(spec, KINDS[o.kind].air)) continue;
      const d = dist(s.x, s.z, o.x, o.z);
      if (d <= BOUNCE_RADIUS && (d < best || (d === best && o.id < next.target))) { best = d; next = { target: o.id, core: null, tx: o.x, tz: o.z }; }
    }
    if (!next) for (const c of L.SEATS) {
      const v = state.seats[c.id];
      if (!v.alive || v.team === s.team || c.id === here || c.id === s.prev) continue;
      const [cx, cz] = L.corePos(c.id, dim), d = dist(s.x, s.z, cx, cz) - R.coreRadius;
      if (d <= BOUNCE_RADIUS && d < best) { best = d; next = { target: 0, core: c.id, tx: cx, tz: cz }; }
    }
    if (next) state.shots.push({ ...s, ...next, id: ++state.shotSerial, hop: s.hop + 1, prev: here });
  }
  // 第六階段：移動一起套用，移除陣亡者
  units.forEach((u, i) => {
    const p = plan[i];
    let x = u.x, z = u.z; const n = dist(p.mx, p.mz, 0, 0);
    if (n > 0) { const k = Math.min(R.unitSpeed, n) / n; x += p.mx * k; z += p.mz * k; u.dx = p.mx / n; u.dz = p.mz / n; }
    else if (p.hit) { const d = dist(p.hit.x, p.hit.z, u.x, u.z) || 1; u.dx = (p.hit.x - u.x) / d; u.dz = (p.hit.z - u.z) / d; }
    const m = dist(p.sx, p.sz, 0, 0);
    if (m > 0) { const k = Math.min(.05, m * .05) / m; x += p.sx * k; z += p.sz * k; }
    p.to = clampWalk(x, z, dim);
  });
  units.forEach((u, i) => { [u.x, u.z] = plan[i].to; });
  state.units = units.filter(u => {
    if (u.hp > 0) return true;
    const by = killer.get(u.id);
    state.seats[u.seat].lost++; if (by) state.seats[by].kills++;
    emit('death', u.seat, { unit: u.id, kind: u.kind, x: u.x, z: u.z, by: by ? [by] : [] }); return false;
  });
  return coreDamage;
}
