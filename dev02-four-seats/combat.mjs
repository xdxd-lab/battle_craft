// 版本 3 的部隊步進：索敵、移動、投射物、彈跳與回盾。傷害順序固定：先抵達的投射物（依編號），再即時攻擊（依射手編號）。
import * as L from '../dev05-layout/layout.mjs';
import { motionDisplacement, WORLD_PER_PX } from './motion.mjs';
import { attackReady, noteAttackFired } from './combat-phases.mjs';
import { airPair, airDisperse, clampAir } from './air-spacing.mjs';
import { createGroundOccupancy } from './ground-occupancy.mjs';
import { KINDS, CORE, PLATE, BOUNCE_RADIUS, SHIELD_REGEN, framesAt, canTarget, applyDamage, weaponOf } from './roster.mjs';

const dist = (ax, az, bx, bz) => Math.sqrt((ax - bx) * (ax - bx) + (az - bz) * (az - bz));
export const armorOf = u => u.armor ?? KINDS[u.kind].armor;

// 範圍傷害：以主目標位置為圓心，依部隊編號順序結算；主目標已吃整發不重複
function splash(units, center, h, spec, killer, plateOf) {
  const { radii, parts, spareSeat, spareTeam } = spec.splash;
  for (const o of units) {
    if (o === center || o.hp <= 0 || (spareSeat && o.seat === h.seat) || (spareTeam && o.team === h.team) || !canTarget(spec, KINDS[o.kind].air)) continue;
    const d = dist(center.x, center.z, o.x, o.z), ring = radii.findIndex(r => d <= r);
    if (ring < 0) continue;
    const body = { hp: o.hp, sh: o.sh, armor: armorOf(o) };
    applyDamage(body, spec.damage * parts[ring], spec.attack, 1, plateOf(o)); o.hp = body.hp; o.sh = body.sh;
    if (o.hp <= 0 && o.team !== h.team) killer.set(o.id, h.seat); // 誤傷隊友致死：計入該席損失，不算施放者擊殺
  }
}

export function stepRoster(state, emit, dim, { RULES: R, waypoint, clampWalk }) {
  const units = state.units, alive = new Map(units.map(u => [u.id, u])), frame = framesAt(state.tick), frames = frame - framesAt(state.tick - 1), experimental = state.version >= 9;
  const plateOf = state.version >= 7 ? u => PLATE[u.kind] : () => 0; // 基礎護甲自版本 7 起生效
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
    const locked = experimental && typeof u.fight?.target === 'number' ? alive.get(u.fight.target) : null;
    if (locked && locked.team !== u.team && canTarget(spec, KINDS[locked.kind].air)) {
      const d = dist(u.x, u.z, locked.x, locked.z);
      if (d <= weaponOf(u.kind, KINDS[locked.kind].air).range) { foe = locked; best = d; }
    }
    const p = { mx: 0, mz: 0, sx: 0, sz: 0, hit: null, core: null };
    u.foe = foe ? foe.id : 0;
    if (foe && best <= weaponOf(u.kind, KINDS[foe.kind].air).range) { p.hit = foe; if (experimental) p.hitRange = weaponOf(u.kind, KINDS[foe.kind].air).range; }
    else if (foe) { p.mx = foe.x - u.x; p.mz = foe.z - u.z; }
    else if (u.target) {
      const [cx, cz] = L.corePos(u.target, dim);
      if (dist(u.x, u.z, cx, cz) <= R.coreRadius + spec.range) { if (canTarget(spec, false)) p.core = u.target; } // 只打空中者（自殺蟲）到核心旁待命
      else { const [wx, wz] = waypoint(u, dim); p.mx = wx - u.x; p.mz = wz - u.z; }
    }
    for (const o of units) { // 隊形分離只在同一高度層
      if (o === u || KINDS[o.kind].air !== spec.air) continue;
      if (experimental) { if (spec.air) { const [x,z] = airPair(u,o); p.sx += x; p.sz += z; } continue; }
      const d = dist(u.x, u.z, o.x, o.z);
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
    const speed = weaponOf(s.kind, !!s.w).projectile, d = dist(s.x, s.z, s.tx, s.tz), left = d - (s.core ? R.coreRadius : 0);
    if (left <= speed) {
      if (d > 0 && left > 0) { s.x += (s.tx - s.x) / d * left; s.z += (s.tz - s.z) / d * left; }
      arrived.push(s);
    } else { s.x += (s.tx - s.x) / d * speed; s.z += (s.tz - s.z) / d * speed; flying.push(s); }
  }
  state.shots = flying;
  // 第三階段：開火
  const instant = [];
  units.forEach((u, i) => {
    const p = plan[i];
    if (!p.hit && !p.core) { if (experimental) attackReady(u,p,frame,frames); return; }
    const vsAir = !p.core && !!KINDS[u.kind].vsAir && KINDS[p.hit.kind].air, spec = weaponOf(u.kind, vsAir);
    const [x, z] = p.core ? L.corePos(p.core, dim) : [p.hit.x, p.hit.z];
    if (experimental) {
      p.attackAngle = Math.atan2(z-u.z,x-u.x);
      p.interval = spec.cooldown;
      if (!attackReady(u,p,frame,frames)) return;
      noteAttackFired(u,p,frame);
    } else if (u.cd) return;
    u.cd = spec.cooldown;
    if (spec.projectile) {
      const split = experimental && u.kind === 'scout' && vsAir;
      const pair = state.shotSerial + 1, heading = Math.atan2(z-u.z,x-u.x);
      // Measured releases occur together with two offset bodies. Each flies and
      // reaches a moving target independently; no made-up fixed second-hit delay.
      for (const side of split ? [-1,1] : [0]) {
        const fore = split ? 8*WORLD_PER_PX : 0, lateral = side*9*WORLD_PER_PX;
        const [sx,sz] = split ? [u.x+Math.cos(heading)*fore-Math.sin(heading)*lateral, u.z+Math.sin(heading)*fore+Math.cos(heading)*lateral] : [u.x,u.z];
        const shot = { id: ++state.shotSerial, kind: u.kind, seat: u.seat, team: u.team, from: u.id, x: sx, z: sz, tx: x, tz: z, target: p.core ? 0 : p.hit.id, core: p.core, hop: 0, prev: null, ...(vsAir ? { w:1 } : {}), ...(split ? { salvo:pair, side, hits:1 } : {}) };
        state.shots.push(shot);
        emit('launch',u.seat,{from:u.id,shot:shot.id,kind:u.kind,...(split ? {salvo:pair,secondary:side===1} : {})},true);
      }
    } else {
      instant.push({ from: u.id, kind: u.kind, seat: u.seat, team: u.team, target: p.core ? 0 : p.hit.id, core: p.core, hop: 0 });
      if (spec.suicide) { u.hp = 0; u.boom = 1; } // 自殺蟲：出手即自爆，同步其他對它的攻擊落空；計入己席損失、不算對方擊殺
      emit('shot', u.seat, { from: u.id, x, z, ...(p.core ? { core: p.core } : { to: p.hit.id }) }, true);
    }
  });
  // 第四階段：依固定順序結算傷害
  const coreDamage = {}, killer = new Map();
  for (const h of [...arrived, ...instant.sort((a, b) => a.from - b.from)]) {
    const spec = weaponOf(h.kind, !!h.w), divisor = 3 ** h.hop;
    let dealt = null;
    if (h.core) {
      if (state.seats[h.core].alive) { const body = { hp: 0, sh: 0, armor: CORE.armor }; dealt = applyDamage(body, spec.damage, spec.attack, divisor); coreDamage[h.core] = (coreDamage[h.core] || 0) + dealt.body; }
    } else {
      const t = alive.get(h.target);
      if (t && t.hp > 0) {
        const body = { hp: t.hp, sh: t.sh, armor: armorOf(t) };
        dealt = applyDamage(body, spec.damage, spec.attack, divisor, plateOf(t));
        for (let k = 1; k < (h.hits ?? spec.hits ?? 1); k++) { const d2 = applyDamage(body, spec.damage, spec.attack, divisor, plateOf(t)); dealt = { shield: dealt.shield + d2.shield, body: dealt.body + d2.body }; } // 斥候對空一次兩發，各自套盾與護甲
        t.hp = body.hp; t.sh = body.sh;
        if (t.hp <= 0) killer.set(t.id, h.seat);
        if (spec.splash) splash(units, t, h, spec, killer, plateOf);
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
  const groundIntents = [];
  units.forEach((u, i) => {
    const p = plan[i], spec = KINDS[u.kind];
    let x = u.x, z = u.z; const n = dist(p.mx, p.mz, 0, 0);
    if (experimental && u.hp <= 0) { p.to = [x,z]; return; }
    if (state.version >= 8) {
      const [vx, vz] = motionDisplacement(u, p, frames);
      x += vx; z += vz;
    } else if (n > 0) { const k = Math.min(R.unitSpeed, n) / n; x += p.mx * k; z += p.mz * k; u.dx = p.mx / n; u.dz = p.mz / n; }
    else if (p.hit) { const d = dist(p.hit.x, p.hit.z, u.x, u.z) || 1; u.dx = (p.hit.x - u.x) / d; u.dz = (p.hit.z - u.z) / d; }
    if (experimental && KINDS[u.kind].air) {
      const [fx,fz] = airDisperse(u,p,frames,frame);
      x += fx; z += fz; p.to = clampAir(x,z,dim);
    } else if (experimental) {
      p.to = [u.x,u.z];
      if (frames) groundIntents.push({
        id: u.id, dx: x-u.x, dz: z-u.z, side: u.motion?.sidestep ?? 0,
        allowSidestep: n > .03 && !p.hit && !p.core, lookAhead: Math.min(.62,n),
      });
      return; // an accepted ground centre must not be overwritten by the centre-only clamp
    } else {
      const m = dist(p.sx, p.sz, 0, 0);
      if (m > 0) { const k = Math.min(.05, m * .05) / m; x += p.sx * k; z += p.sz * k; }
      p.to = clampWalk(x, z, dim);
    }
    // Do not store velocity against a blocked arena edge. Formation offsets still run on
    // all web ticks, and the historical <=7 branch does not gain motion state.
    if (frames && u.motion && (Math.abs(p.to[0] - x) > 1e-8 || Math.abs(p.to[1] - z) > 1e-8)) u.motion.speed = 0;
  });
  const ground = groundIntents.length ? createGroundOccupancy(units,dim,R).resolve(groundIntents,frame) : null;
  units.forEach((u, i) => {
    const q = ground?.get(u.id);
    if (!q) { [u.x, u.z] = plan[i].to; return; }
    u.x = q.x; u.z = q.z;
    if (u.motion) { u.motion.sidestep = q.side; if (q.mode === 'blocked') u.motion.speed = 0; }
  });
  state.units = units.filter(u => {
    if (u.hp > 0) return true;
    const by = killer.get(u.id);
    state.seats[u.seat].lost++; if (by) state.seats[by].kills++;
    emit('death', u.seat, { unit: u.id, kind: u.kind, x: u.x, z: u.z, by: by ? [by] : [], ...(u.boom ? { boom: 1 } : {}) }); return false;
  });
  return coreDamage;
}
