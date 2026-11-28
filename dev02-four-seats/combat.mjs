// 版本 3 的部隊步進：索敵、移動、投射物、彈跳與回盾。傷害順序固定：先抵達的投射物（依編號），再即時攻擊（依射手編號）。
import * as L from '../dev05-layout/layout.mjs';
import { motionDisplacement, WORLD_PER_PX } from './motion.mjs';
import { attackReady, noteAttackFired } from './combat-phases.mjs';
import { airPair, airDisperse, clampAir } from './air-spacing.mjs';
import { hasAirShortcut, approachAirCore } from './air-reroute.mjs';
import { createGroundOccupancy } from './ground-occupancy.mjs';
import { deliveryFor, placeFixedShot, advanceFixedShot, placeSeekingShot, advanceSeekingShot,
  firstBounceTarget, unitGap, shockwaveRing, SCOURGE_CONTACT, targetPoint } from './weapon-delivery.mjs';
import { KINDS, CORE, PLATE, BOUNCE_RADIUS, SHIELD_REGEN, framesAt, canTarget, applyDamage, weaponOf } from './roster.mjs';

import { DEFENSE_VERSION, TOWER_VARIANTS_VERSION, TOWER, towerWeaponBox, regenerateTowerShields, hitTower, fireTowers } from './defense-tower.mjs';
import { SPECIAL_POWER_VERSION } from './special-powers.mjs';

const dist = (ax, az, bx, bz) => Math.sqrt((ax - bx) * (ax - bx) + (az - bz) * (az - bz));
import { UNIFIED_ATTACK_RANGE_FROM, effectiveWeaponRange, weaponBoxPx, weaponGapPx, rangeInPixels, scanWeaponTargets } from './combat-reach.mjs';
export { DRAGOON_RANGE_TRIAL_FROM, DRAGOON_TRIAL_RANGE, effectiveWeaponRange } from './combat-reach.mjs';
const DRAGOON_EDGE_RANGE_FROM = 13;
export const DRAGOON_TRACK_RANGE_FROM = 14;
const DRAGOON_TRACK_FRAMES = 6, DRAGOON_TRACK_MARGIN = .12; // keep stance, never permission to shoot
const inDragoonRange = (u, o, range, gap = unitGap(u,o)) => gap <= range + 1e-9;
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
  const units = state.units, alive = new Map(units.map(u => [u.id, u])), frame = framesAt(state.tick), frames = frame - framesAt(state.tick - 1), experimental = state.version >= 9, faithful = state.version >= 10;
  const ownershipChanges = state.version >= SPECIAL_POWER_VERSION;
  const variantTowers=state.version>=TOWER_VARIANTS_VERSION;
  const plateOf = state.version >= 7 ? u => PLATE[u.kind] : () => 0; // 基礎護甲自版本 7 起生效
  for (const u of units) {
    const max = KINDS[u.kind].shield;
    if (u.sh < max) u.sh = Math.min(max, u.sh + SHIELD_REGEN * frames / 256);
    u.cd = Math.max(0, u.cd - frames);
  }
  if(variantTowers)regenerateTowerShields(state,frames);
  // Unit positions do not move between intent, wind-up and release. Build one
  // box per live entity rather than quantizing / allocating per target pair.
  const unified = state.version >= UNIFIED_ATTACK_RANGE_FROM;
  const boxes = unified ? new Map(units.map(u=>[u.id,weaponBoxPx(u.kind,u.x,u.z)])) : null;
  const towerBoxes=variantTowers?Object.fromEntries(Object.values(state.seats)
    .filter(s=>s.alive&&s.tower?.hp>0).map(s=>[s.id,towerWeaponBox(s.tower)])):null;
  const aggroPx = unified ? rangeInPixels(R.aggro) : 0;
  // 第一階段：全部依同一份位置決定目標與移動
  const plan = units.map(u => {
    const spec = KINDS[u.kind];
    const edgeRange = state.version >= DRAGOON_EDGE_RANGE_FROM && u.kind === 'dragoon';
    const groundRange = edgeRange ? effectiveWeaponRange(state.version, u.kind) : spec.range;
    const locked = experimental && typeof u.fight?.target === 'number' ? alive.get(u.fight.target) : null;
    let foe = null, best = Infinity, reachable = null, reachableGap = Infinity, reachableCenter = Infinity, inReachByBox = false;
    if (unified) {
      ({foe, inReach:inReachByBox} = scanWeaponTargets(u,units,boxes,aggroPx,locked));
    } else { // Exact pre-v17 lock and selection rules for historical replays.
      for (const o of units) {
        if (o.team === u.team || !canTarget(spec,KINDS[o.kind].air)) continue;
        const d = dist(u.x,u.z,o.x,o.z);
        if (d < best || (d === best && o.id < foe.id)) { best = d; foe = o; }
        if (!edgeRange || d > R.aggro || o.hp <= 0) continue;
        // Movement reserves a separate, larger footprint. Only DAT weapon boxes
        // decide whether to halt and aim, so a crowd cannot force aimless chasing.
        const gap = unitGap(u,o);
        if (inDragoonRange(u,o,groundRange,gap) && (gap < reachableGap || (gap === reachableGap &&
          (d < reachableCenter || (d === reachableCenter && o.id < reachable.id))))) {
          reachable = o; reachableGap = gap; reachableCenter = d;
        }
      }
      if (best > R.aggro) foe = null;
      if (edgeRange && reachable) { foe = reachable; best = reachableCenter; }
      if (locked && locked.team !== u.team && canTarget(spec, KINDS[locked.kind].air)) {
        const d = dist(u.x, u.z, locked.x, locked.z);
        // A still-reachable wind-up is not cancelled just because a different
        // enemy passes in front. Outside true weapon range it cannot release.
        if (edgeRange ? locked.hp > 0 && d <= R.aggro && inDragoonRange(u,locked,groundRange) : d <= weaponOf(u.kind,KINDS[locked.kind].air).range) {
          foe = locked; best = d;
        }
      }
    }
    const stableDragoon = edgeRange && state.version >= DRAGOON_TRACK_RANGE_FROM;
    const p = { mx: 0, mz: 0, sx: 0, sz: 0, hit: null, core: null };
    u.foe = foe ? foe.id : 0;
    const contact=faithful && spec.suicide;
    const inReach=unified ? inReachByBox : foe && (!stableDragoon || foe.hp>0) && (contact ? unitGap(u,foe)<=SCOURGE_CONTACT : edgeRange ? inDragoonRange(u,foe,groundRange) : best<=weaponOf(u.kind,KINDS[foe.kind].air).range);
    if (inReach) {
      p.hit=foe;
      if(experimental && !contact)p.hitRange=edgeRange ? groundRange : weaponOf(u.kind,KINDS[foe.kind].air).range;
      if(unified && p.hitRange!==undefined)p.weaponBoxRange=boxes.get(foe.id);
      if(stableDragoon && frames) {
        const track = u.dragoonTrack ??= { target:foe.id, seen:frame };
        track.target=foe.id; track.seen=frame;
      }
    } else if(stableDragoon && u.dragoonTrack && frame-u.dragoonTrack.seen<=DRAGOON_TRACK_FRAMES) {
      const tracked=alive.get(u.dragoonTrack.target);
      // Wait through a small, brief range excursion rather than requesting a
      // fresh sidestep through the firing line. Keep the original hitbox range
      // for every release and take a genuinely reachable alternative first.
      if(tracked?.hp>0 && tracked.team!==u.team && (unified ? weaponGapPx(boxes.get(u.id),boxes.get(tracked.id))<=rangeInPixels(groundRange+DRAGOON_TRACK_MARGIN) : unitGap(u,tracked)<=groundRange+DRAGOON_TRACK_MARGIN)) {
        p.dragoonHold=tracked.id;
        p.attackAngle=Math.atan2(tracked.z-u.z,tracked.x-u.x);
        u.foe=tracked.id;
      }
    }
    if (!p.hit && p.dragoonHold===undefined && foe) { p.mx = foe.x - u.x; p.mz = foe.z - u.z; }
    else if (!p.hit && p.dragoonHold===undefined && u.target) {
      const [cx, cz] = L.corePos(u.target, dim);
      const tower=state.version>=DEFENSE_VERSION?state.seats[u.target]?.tower:null;
      const airShortcut=hasAirShortcut(state,u);
      // Mobile enemies still take priority. In its firing envelope the turret is a
      // separate target, not a pool of extra core health or a global damage shield.
      const towerRangePx=variantTowers&&tower?.hp>0?rangeInPixels(groundRange):0;
      if(tower?.hp>0&&canTarget(spec,false)&&(variantTowers
        ? towerBoxes[u.target]&&weaponGapPx(boxes.get(u.id),towerBoxes[u.target])<=towerRangePx
        : dist(u.x,u.z,tower.x,tower.z)<=groundRange+TOWER.hitRadius)){
        p.core=u.target;p.tower=true;
        if(variantTowers)p.towerId=tower.id;
        // Dispersion must not take a firing aircraft out of the same real
        // rectangle-based range used to acquire the tower.
        if(airShortcut){
          const box=towerBoxes[u.target];
          p.airStructureRange={allows:(x,z)=>weaponGapPx(weaponBoxPx(u.kind,x,z),box)<=towerRangePx};
        }
      }
      // A mobile engagement above this fallback pauses the route.
      else if(airShortcut)approachAirCore(p,u,cx,cz,dim.platformWalkRadius,R.coreRadius,groundRange);
      else if (dist(u.x, u.z, cx, cz) <= R.coreRadius + groundRange) { if (canTarget(spec, false)) p.core = u.target; } // 只打空中者（自殺蟲）到核心旁待命
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
    if (s.effect) { (frame>=s.due ? arrived : flying).push(s); continue; }
    if (s.seekingFlight) {
      const t=!s.core&&alive.get(s.target);
      if(t){s.tx=t.x;s.tz=t.z;}
      (advanceSeekingShot(s,deliveryFor(state.version,s.kind,!!s.w),frames)?arrived:flying).push(s);
      continue;
    }
    if (s.fixedFlight) {
      (advanceFixedShot(s,deliveryFor(state.version,s.kind,s.airTarget),frames) ? arrived : flying).push(s);
      continue;
    }
    const foe = s.core ? null : alive.get(s.target);
    if (foe) { s.tx = foe.x; s.tz = foe.z; }
    const speed = weaponOf(s.kind, !!s.w).projectile, d = dist(s.x, s.z, s.tx, s.tz), left = d - (s.tower ? TOWER.hitRadius : s.core ? R.coreRadius : 0);
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
    const tower=p.tower?state.seats[p.core].tower:null;
    const [x, z] = tower ? [tower.x,tower.z] : p.core ? L.corePos(p.core, dim) : [p.hit.x, p.hit.z];
    const radius=p.tower?TOWER.hitRadius:p.core?R.coreRadius:0;
    const mark=p.tower?{tower:true,...(variantTowers?{towerId:p.towerId}:{})}:{};
    const delivery = deliveryFor(state.version,u.kind,!p.core && KINDS[p.hit.kind].air);
    if (experimental) {
      p.attackAngle = Math.atan2(z-u.z,x-u.x);
      p.interval = spec.cooldown;
      if(faithful) p.attackArc=delivery?.angle;
      if (!attackReady(u,p,frame,frames,state.version)) return;
      noteAttackFired(u,p,frame);
    } else if (u.cd) return;
    u.cd = spec.cooldown;
    if (delivery?.mode === 'latched') {
      const shot = {id:++state.shotSerial,kind:u.kind,seat:u.seat,team:u.team,from:u.id,target:p.core?0:p.hit.id,core:p.core,...mark,hop:0,prev:null,...(vsAir?{w:1}:{})};
      placeFixedShot(shot,delivery,u.x,u.z,x,z,radius,!p.core&&KINDS[p.hit.kind].air);
      emit('launch',u.seat,{from:u.id,shot:shot.id,kind:u.kind},true);
      // The launch frame already takes the first movement step in the source traces.
      if (advanceFixedShot(shot,delivery,frames)) arrived.push(shot);
      else state.shots.push(shot);
    } else if(delivery?.mode==='home'||delivery?.mode==='bounce'){
      const sideOptions=u.kind==='scout'&&vsAir ? [-1,1] : [0], pair=state.shotSerial+1;
      for(const side of sideOptions){
        const shot={id:++state.shotSerial,kind:u.kind,seat:u.seat,team:u.team,from:u.id,target:p.core?0:p.hit.id,core:p.core,...mark,hop:0,prev:null,...(vsAir?{w:1}:{}),...(side?{salvo:pair,side,hits:1}:{})};
        if (ownershipChanges && delivery.mode === 'bounce') shot.launchTick = state.tick;
        placeSeekingShot(shot,delivery,u,x,z,radius,side);
        emit('launch',u.seat,{from:u.id,shot:shot.id,kind:u.kind,...(side?{salvo:pair,secondary:side===1}:{})},true);
        if(advanceSeekingShot(shot,delivery,frames)) arrived.push(shot);
        else state.shots.push(shot);
      }
    } else if(delivery?.mode==='effect'||delivery?.mode==='suicide'){
      const [ix,iz]=delivery.mode==='suicide' ? [u.x,u.z] : p.core?[x,z]:targetPoint(u,p.hit);
      const shot={id:++state.shotSerial,kind:u.kind,seat:u.seat,team:u.team,from:u.id,target:p.core?0:p.hit.id,core:p.core,...mark,hop:0,effect:delivery.mode,x:ix,z:iz,due:frame+delivery.delay};
      if (ownershipChanges && delivery.mode === 'effect') shot.launchTick = state.tick;
      state.shots.push(shot);
      if(delivery.mode==='suicide'){u.hp=0;u.boom=1;}
      emit('launch',u.seat,{from:u.id,shot:shot.id,kind:u.kind,effect:shot.effect,x:ix,z:iz,target:shot.target},true);
    } else if (spec.projectile && delivery?.mode !== 'atTarget') {
      const split = experimental && u.kind === 'scout' && vsAir;
      const pair = state.shotSerial + 1, heading = Math.atan2(z-u.z,x-u.x);
      // Measured releases occur together with two offset bodies. Each flies and
      // reaches a moving target independently; no made-up fixed second-hit delay.
      for (const side of split ? [-1,1] : [0]) {
        const fore = split ? 8*WORLD_PER_PX : 0, lateral = side*9*WORLD_PER_PX;
        const [sx,sz] = split ? [u.x+Math.cos(heading)*fore-Math.sin(heading)*lateral, u.z+Math.sin(heading)*fore+Math.cos(heading)*lateral] : [u.x,u.z];
        const shot = { id: ++state.shotSerial, kind: u.kind, seat: u.seat, team: u.team, from: u.id, x: sx, z: sz, tx: x, tz: z, target: p.core ? 0 : p.hit.id, core: p.core, ...mark, hop: 0, prev: null, ...(vsAir ? { w:1 } : {}), ...(split ? { salvo:pair, side, hits:1 } : {}) };
        state.shots.push(shot);
        emit('launch',u.seat,{from:u.id,shot:shot.id,kind:u.kind,...(split ? {salvo:pair,secondary:side===1} : {})},true);
      }
    } else {
      instant.push({ from: u.id, kind: u.kind, seat: u.seat, team: u.team, target: p.core ? 0 : p.hit.id, core: p.core, ...mark, hop: 0 });
      if (spec.suicide) { u.hp = 0; u.boom = 1; } // 自殺蟲：出手即自爆，同步其他對它的攻擊落空；計入己席損失、不算對方擊殺
      const [ix,iz]=delivery?.mode==='atTarget'&&!p.core ? targetPoint(u,p.hit) : [x,z];
      emit('shot', u.seat, { from: u.id, x:ix, z:iz, ...(p.core ? { core: p.core, ...mark } : { to: p.hit.id }), ...(delivery?.mode === 'atTarget' ? {atTarget:true} : {}) }, true);
    }
  });
  // 第四階段：依固定順序結算傷害
  const coreDamage = {}, killer = new Map();
  for (const h of [...arrived, ...instant.sort((a, b) => a.from - b.from)]) {
    const spec = weaponOf(h.kind, !!h.w), divisor = 3 ** h.hop;
    let dealt = null;
    if (h.tower) {
      dealt=hitTower(state,h.core,spec.damage,spec.attack,divisor,emit,h.towerId);
    } else if (h.core) {
      if (state.seats[h.core].alive) { const body = { hp: 0, sh: 0, armor: CORE.armor }; dealt = applyDamage(body, spec.damage, spec.attack, divisor); coreDamage[h.core] = (coreDamage[h.core] || 0) + dealt.body; }
    } else if(h.effect==='effect'){
      // The impact point stays put during the 3-frame effect, and the damage test
      // uses geometry, not a mandatory full hit on the original target.
      for(const t of units){
        if(t.hp<=0||t.seat===h.seat||!canTarget(spec,KINDS[t.kind].air))continue;
        // Collateral rules are unchanged except for newly friendly converts
        // since this shockwave was released.
        if (ownershipChanges && t.team === h.team && t.controlledAt > h.launchTick) continue;
        const ring=shockwaveRing(t,h.x,h.z,state.version);
        if(ring<0)continue;
        const body={hp:t.hp,sh:t.sh,armor:armorOf(t)};
        const d=applyDamage(body,spec.damage,spec.attack,2**ring,plateOf(t));t.hp=body.hp;t.sh=body.sh;
        if(t.hp<=0&&t.team!==h.team)killer.set(t.id,h.seat);
        if(t.id===h.target||dealt===null)dealt=d;
      }
    } else {
      const t = alive.get(h.target);
      if (t && t.hp > 0 && (!ownershipChanges || t.team !== h.team)) {
        const body = { hp: t.hp, sh: t.sh, armor: armorOf(t) };
        dealt = applyDamage(body, spec.damage, spec.attack, divisor, plateOf(t));
        for (let k = 1; k < (h.hits ?? spec.hits ?? 1); k++) { const d2 = applyDamage(body, spec.damage, spec.attack, divisor, plateOf(t)); dealt = { shield: dealt.shield + d2.shield, body: dealt.body + d2.body }; } // 斥候對空一次兩發，各自套盾與護甲
        t.hp = body.hp; t.sh = body.sh;
        if (t.hp <= 0) killer.set(t.id, h.seat);
        if (spec.splash) splash(units, t, h, spec, killer, plateOf);
      }
    }
    if (h.id) emit(dealt ? 'impact' : 'fizzle', h.seat, { shot: h.id, kind: h.kind, hop: h.hop, x: h.x, z: h.z, target: h.core || h.target, ...(h.tower?{tower:true}:{}), ...(dealt ?? {}) }, true);
  }
  // 第五階段：彈跳。射手仍存活才續彈；排除本跳與上一跳目標，取最近者，同距取小編號
  for (const s of arrived) {
    const spec = KINDS[s.kind], owner = alive.get(s.from);
    if (s.hop >= spec.bounces || !owner || owner.hp <= 0) continue;
    // A shot keeps its launch-side ownership. No continuation if its source
    // switched sides or the contact has become a friendly fizzle.
    if (ownershipChanges && (owner.seat !== s.seat || owner.controlledAt > s.launchTick ||
      (!s.core && alive.get(s.target)?.team === s.team))) continue;
    const here = s.core || s.target;
    let next = null, best = Infinity;
    if(s.seekingFlight==='bounce'){
      const o=firstBounceTarget(units,s,t=>t.team!==s.team&&t.hp>0&&t.id!==here&&t.id!==s.prev&&canTarget(spec,KINDS[t.kind].air));
      if(o)next={target:o.id,core:null,tx:o.x,tz:o.z};
    }
    if(!s.seekingFlight) for (const o of units) {
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
    if (next) { const {tower, towerId, ...shot}=s; state.shots.push({ ...shot, ...next, id: s.seekingFlight ? s.id : ++state.shotSerial, hop: s.hop + 1, prev: here }); }
  }
  if(state.version>=DEFENSE_VERSION)fireTowers(state,units,killer,emit,boxes,frame,frames);
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
      const [fx,fz] = airDisperse(u,p,frames,frame,x,z);
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
