// BC01 兵種（模擬版本 3 起）與版本 4 道路寬驗收：傷害、護盾、投射物、彈跳、購兵與完整終局。純 Node，可重跑。
import assert from 'node:assert/strict';
import * as L from '../dev05-layout/layout.mjs';
import * as S from './sim.mjs';
import { KINDS, CORE, applyDamage, canTarget, framesAt, unitStats } from './roster.mjs';
import { ARENA, corePos } from './arena.mjs';

const rows = [], test = (name, fn) => rows.push({ 案例: name, 摘要: fn() ?? '' });
const none = () => S.createSim({ bots: [] });
const unit = (st, seat, kind, x, z, more = {}) => { const u = { id: ++st.serial, seat, team: L.seatById(seat).team, x, z, cd: 0, lat: 0, target: S.targetOf(st, seat), foe: 0, dx: 0, dz: 0, ...unitStats(kind), ...more }; st.units.push(u); st.seats[seat].deployed++; return u; };
const idle = { cd: 1e9 }; // 不開火的靶
const run = (st, n, each) => { const log = []; for (let i = 0; i < n && st.mode === 'play'; i++) { const e = S.step(st); log.push(...e); each?.(e); } return log; };
const until = (st, type, max = 80) => { for (let i = 0; i < max; i++) { const e = S.step(st).filter(v => v.type === type); if (e.length) return e; } assert.fail(`沒有事件 ${type}`); };
const hit = (armor, sh, damage, attack = 'E', divisor = 1) => { const t = { hp: 500, sh, armor }, d = applyDamage(t, damage, attack, divisor); return [d.shield, d.body, t.sh, 500 - t.hp]; };

test('定案例題：100 點 E 打 40 盾', () => {
  assert.deepEqual(hit('light', 40, 100), [40, 30, 0, 30]);
  assert.deepEqual(hit('medium', 40, 100), [40, 45, 0, 45]);
  assert.deepEqual(hit('heavy', 40, 100), [40, 60, 0, 60]);
  assert.deepEqual(hit('light', 150, 100), [100, 0, 50, 0]);
  return '輕 30／中 45／重 60';
});
test('E 對本體 50／75／100%；N 與彈跳皆 100%', () => {
  assert.deepEqual(['light', 'medium', 'heavy'].map(a => hit(a, 0, 20)[1]), [10, 15, 20]);
  for (const k of ['N', 'B']) assert.deepEqual(['light', 'medium', 'heavy'].map(a => hit(a, 0, 20, k)[1]), [20, 20, 20]);
});
test('盾不足 1 點不吸收；滿 1 點才吸收', () => {
  assert.deepEqual(hit('light', 255 / 256, 20), [0, 10, 255 / 256, 10]);
  assert.deepEqual(hit('light', 1, 20), [1, 9.5, 0, 9.5]);
});
test('1/256 捨去與 0.5 點下限', () => {
  assert.equal(hit('light', 0, 9, 'E', 7)[1], Math.floor(Math.floor(9 * 256 / 7) / 2) / 256);
  assert.equal(hit('light', 0, 1, 'E', 9)[1], .5);          // 整發下限後本體再補到下限
  assert.equal(hit('light', 1, 1.5, 'E')[1], .25);          // 扣到盾時本體不補
  assert.equal(hit('heavy', 0, 1, 'N', 9)[1], .5);
});
test('回盾：每 frame 7/256、交戰中不中斷、不超過上限', () => {
  const st = none(), d = unit(st, 'N', 'dragoon', 0, 0, { sh: 0, ...idle });
  run(st, 30); assert.equal(d.sh, 7 * framesAt(30) / 256);
  const war = none(), w = unit(war, 'N', 'dragoon', 0, 0, { sh: 10, ...idle }); unit(war, 'S', 'marine', 0, 1.2);
  S.step(war); assert.deepEqual([w.sh, w.hp], [4, 100]); S.step(war); assert.equal(w.sh, 4 + 7 / 256);
  const full = none(), f = unit(full, 'N', 'dragoon', 0, 0, { sh: 79.99609375, ...idle }); run(full, 5); assert.equal(f.sh, 80);
  return `30 tick = ${framesAt(30)} frame`;
});
test('光球：延遲命中，抵達前血量不變', () => {
  const st = none(), a = unit(st, 'N', 'dragoon', 0, -.75), t = unit(st, 'S', 'marine', 0, .75, idle);
  assert(S.step(st).some(e => e.type === 'launch')); a.cd = 1e9; assert.equal(st.shots.length, 1);
  const k = Math.ceil(1.5 / KINDS.dragoon.projectile);
  for (let i = 1; i < k; i++) { S.step(st); assert.equal(t.hp, 40); }
  assert(S.step(st).some(e => e.type === 'impact')); assert.equal(t.hp, 30);
  return `${k} tick（${(k / S.HZ).toFixed(2)} 秒）`;
});
test('目標飛行中死亡：無傷害、不改追、不傷旁邊單位', () => {
  const st = none(), a = unit(st, 'N', 'dragoon', 0, -.75), t = unit(st, 'S', 'marine', 0, .75, idle), other = unit(st, 'S', 'marine', 1.2, .75, idle);
  a.foe = 0; S.step(st); a.cd = 1e9; assert.equal(st.shots[0].target, t.id); st.units = st.units.filter(u => u !== t);
  const log = run(st, 20); assert(log.some(e => e.type === 'fizzle') && !log.some(e => e.type === 'impact')); assert.equal(other.hp, 40); assert.equal(st.shots.length, 0);
});
test('射手飛行中死亡：仍命中，擊殺歸原席', () => {
  const st = none(), a = unit(st, 'N', 'dragoon', 0, -.75), t = unit(st, 'S', 'marine', 0, .75, { ...idle, hp: 5 });
  S.step(st); st.units = st.units.filter(u => u !== a); const [death] = until(st, 'death'); assert.equal(death.unit, t.id); assert.equal(st.seats.N.kills, 1);
});
const cluster = (extra = {}) => {
  const st = none(), a = unit(st, 'N', 'mutalisk', 0, -.9);
  const t = [[0, 0], [.98, -.2], [1, -1.2]].slice(0, extra.count ?? 3).map(([x, z]) => unit(st, 'S', 'marine', x, z, idle));
  S.step(st); a.cd = 1e9; return { st, a, t };
};
test('彈跳：最多再跳兩次，傷害 9／3／1，三目標互異且依序抵達', () => {
  const { st, t } = cluster(), log = run(st, 30).filter(e => e.type === 'impact');
  assert.deepEqual(log.map(e => [e.hop, e.target, e.body]), [[0, t[0].id, 9], [1, t[1].id, 3], [2, t[2].id, 1]]);
  assert(log[0].tick < log[1].tick && log[1].tick < log[2].tick); assert.equal(st.shots.length, 0);
  assert.deepEqual(t.map(u => u.hp), [31, 37, 39]);
});
test('彈跳：只有一或兩個目標時不回彈；不打友軍；半徑外不選', () => {
  for (const count of [1, 2]) { const { st } = cluster({ count }); assert.equal(run(st, 30).filter(e => e.type === 'impact').length, count); }
  const st = none(), a = unit(st, 'N', 'mutalisk', 0, -1), t = unit(st, 'S', 'marine', 0, 0, idle), friend = unit(st, 'W', 'marine', .96, 0, idle), far = unit(st, 'S', 'marine', -1.55, .1, idle);
  S.step(st); a.cd = 1e9; assert.equal(st.shots[0].target, t.id); assert.equal(run(st, 8).filter(e => e.type === 'impact').length, 1); assert.deepEqual([friend.hp, far.hp], [40, 40]);
});
test('彈跳：同距取小編號', () => {
  const st = none(), a = unit(st, 'N', 'mutalisk', 0, -1), t = unit(st, 'S', 'marine', 0, 0, idle), first = unit(st, 'S', 'marine', 1, -.2, idle), second = unit(st, 'S', 'marine', -1, -.2, idle);
  S.step(st); a.cd = 1e9; assert.equal(st.shots[0].target, t.id); st.units.reverse();
  const log = run(st, 12).filter(e => e.type === 'impact'); assert.equal(log[1].target, first.id); assert(second.id > first.id);
});
test('彈跳：中間一跳目標死亡仍續跳；射手死亡後不續彈', () => {
  const { st, t } = cluster(); const log = []; until(st, 'impact'); st.units = st.units.filter(u => u !== t[1]); log.push(...run(st, 30));
  assert.deepEqual(log.filter(e => /impact|fizzle/.test(e.type)).map(e => [e.type, e.hop]), [['fizzle', 1], ['impact', 2]]); assert.equal(t[2].hp, 39);
  const c = cluster(); c.st.units = c.st.units.filter(u => u !== c.a); assert.equal(run(c.st, 30).filter(e => e.type === 'impact').length, 1);
});
test('合法目標：三兵種可打地面與空中；僅對地規格會濾掉空中', () => {
  for (const a of Object.keys(KINDS)) for (const b of ['marine', 'mutalisk']) {
    const st = none(); unit(st, 'N', a, 0, -.5); const t = unit(st, 'S', b, 0, .5, idle); run(st, 12); assert(t.hp < KINDS[b].hp, `${a} → ${b}`);
  }
  assert.deepEqual([canTarget({ targets: ['ground'] }, true), canTarget({ targets: ['ground'] }, false)], [false, true]);
  const st = none(), air = unit(st, 'N', 'mutalisk', 0, 0, idle), ground = unit(st, 'N', 'marine', 0, 0, idle); S.step(st); assert(Math.abs(air.x - ground.x) < 1e-9 && Math.abs(air.z - ground.z) < 1e-9, '空地不互推');
});
test('同 tick 多發打同一目標：只陣亡一次、擊殺不重複', () => {
  const st = none(); unit(st, 'N', 'marine', -.5, -.5); unit(st, 'W', 'marine', .5, -.5); unit(st, 'S', 'marine', 0, .5, { ...idle, hp: 4 });
  const log = S.step(st); assert.equal(log.filter(e => e.type === 'death').length, 1); assert.equal(st.seats.N.kills + st.seats.W.kills, 1);
});
test('核心：三兵種可攻擊，視為重裝甲', () => {
  for (const kind of Object.keys(KINDS)) { const st = none(), [x, z] = corePos('S'), d = L.seatById('S').dir; const a = unit(st, 'N', kind, x - d[0] * 5.5, z - d[1] * 5.5, { target: 'S' }); S.step(st); a.cd = 1e9; run(st, 20); assert.equal(CORE.hp - st.seats.S.hp, KINDS[kind].damage, kind); }
});
test('四席三信標：扣款、兵種與數值正確；第四座未開放', () => {
  for (const id of S.SEAT_IDS) S.PADS.forEach((p, i) => {
    const st = none(), [x, z] = S.padWorld(id, i); Object.assign(st.seats[id].commander, { x, z }); st.seats[id].gold = 30;
    const buy = S.step(st).find(e => e.type === 'buy');
    if (p.locked) return assert(!buy);
    assert.deepEqual([buy.kind, st.seats[id].gold, st.units.length], [p.kind, 30 - p.cost, p.count]); assert.equal(st.units[0].sh, KINDS[p.kind].shield);
  });
  return S.PADS.filter(p => !p.locked).map(p => `${p.label} ${p.cost}金×${p.count}`).join('、');
});
test('全電腦 60 局：皆終局、帳目相符、三兵種都有購買與陣亡', () => {
  const win = {}, bought = {}, died = {}, secs = [];
  for (let seed = 1; seed <= 60; seed++) {
    const st = S.createSim({ seed });
    while (st.mode === 'play') {
      for (const e of S.step(st)) { if (e.type === 'buy') bought[e.kind] = (bought[e.kind] || 0) + e.count; if (e.type === 'death') died[e.kind] = (died[e.kind] || 0) + 1; }
      if (st.tick % 30 === 0) { for (const id of S.SEAT_IDS) assert.equal(st.units.filter(u => u.seat === id).length, st.seats[id].deployed - st.seats[id].lost); for (const u of st.units) assert(u.hp > 0 && u.sh >= 0 && u.sh <= KINDS[u.kind].shield); }
      assert(st.tick < 30 * 60 * 13);
    }
    win[st.winner] = (win[st.winner] || 0) + 1; secs.push(st.tick / 30);
  }
  for (const k of Object.keys(KINDS)) assert(bought[k] > 0 && died[k] > 0, k);
  secs.sort((a, b) => a - b); return `勝場 ${JSON.stringify(win)}；${secs[0].toFixed(0)}／${secs[30].toFixed(0)}／${secs[59].toFixed(0)} 秒；購買 ${JSON.stringify(bought)}`;
});
test('可重現完整終局：固定種子加玩家指令，重跑與中途序列化一致', () => {
  const commands = []; for (let t = 30, i = 0; t < 9000; t += 450, i++) { const [x, z] = S.padWorld('S', i % 3); commands.push({ tick: t, seat: 'S', type: 'goal', x, z }); }
  const rec = { version: 3, seed: 20261126, bots: ['N', 'W', 'E'], commands }, a = S.replay(rec), b = S.replay(JSON.parse(JSON.stringify(rec)));
  assert.equal(a.state.mode, 'end'); assert.deepEqual(a.marks, b.marks); assert.equal(a.events, b.events);
  let st = S.createSim(rec), i = 0, midair = 0; while (st.mode === 'play') { const now = []; while (commands[i]?.tick === st.tick + 1) now.push(commands[i++]); S.step(st, now); if (st.tick % 97 === 0) { midair += st.shots.length; st = JSON.parse(JSON.stringify(st)); } }
  assert.equal(S.digest(st), a.final); assert(midair > 0, '序列化應涵蓋飛行中的投射物');
  if (!process.env.UPDATE) assert.equal(`${a.final} ${a.events}`, 'b2b76a9e 8a855c0b');
  return `${a.state.winner} ${(a.state.tick / 30).toFixed(0)} 秒 ${a.final} ${a.events}`;
});
test('飛行與地面：飛螳在空中、重騎兵在地面，兩者皆可攻空與地', () => {
  assert.deepEqual([KINDS.mutalisk.air, KINDS.dragoon.air, KINDS.marine.air], [true, false, false]);
  for (const k of ['mutalisk', 'dragoon']) assert.deepEqual([...KINDS[k].targets].sort(), ['air', 'ground']);
});
test('版本 4 道路可通行寬加 10%（視覺同步）；版本 3 維持原寬', () => {
  assert(Math.abs(ARENA.laneWidth / L.DIM.laneWidth - 1.1) < 1e-12 && L.shopClearance(ARENA) > 0);
  return [[3, 3.6], [4, 3.96]].map(([version, half]) => {
    for (const kind of ['dragoon', 'mutalisk']) for (const [x, z] of [[9, -25], [-9, -25], [25, 9], [-25, -9]]) {
      const st = S.createSim({ version, bots: [] }), u = unit(st, 'N', kind, x, z, idle); S.step(st);
      assert(Math.abs(Math.min(Math.abs(u.x), Math.abs(u.z)) - half) < 1e-9, `v${version} ${kind} ${u.x},${u.z}`);
    }
    return `v${version} ±${half}`;
  }).join('、');
});
test('版本 4 全電腦 60 局：皆終局，部隊不出道路、交會區與核心平台', () => {
  const wins = {}, R = S.RULES, half = 3.96; let widest = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const st = S.createSim({ seed }); assert.equal(st.version, 4);
    while (st.mode === 'play') { assert(st.tick < 30 * 60 * 13); S.step(st); for (const u of st.units) { const ax = Math.abs(u.x), az = Math.abs(u.z), core = S.SEAT_IDS.some(id => { const [cx, cz] = corePos(id); return Math.hypot(u.x - cx, u.z - cz) <= R.platform + 1e-9; });
      assert(core || Math.hypot(u.x, u.z) <= R.junction + 1e-9 || Math.min(ax, az) <= half + 1e-9, `${seed} ${u.x},${u.z}`); if (!core && Math.max(ax, az) > R.junction) widest = Math.max(widest, Math.min(ax, az)); } }
    wins[st.winner] = (wins[st.winner] || 0) + 1;
  }
  assert(widest > 3.6, `加寬部分應有部隊使用 ${widest}`);
  const rec = { version: 4, seed: 20261126, bots: ['N', 'W', 'S', 'E'], commands: [] }, a = S.replay(rec); assert.equal(S.replay(rec).final, a.final);
  if (!process.env.UPDATE) assert.equal(`${a.final} ${a.events}`, '5a70a7ff d6d987b7');
  return `勝場 ${JSON.stringify(wins)}；最寬 ${widest.toFixed(2)}；${a.final} ${a.events}`;
});
test('玩家全程不動也會終局', () => S.SEAT_IDS.map(id => { const st = S.createSim({ seed: 5, bots: S.SEAT_IDS.filter(x => x !== id) }); run(st, 30 * 60 * 13); assert.equal(st.mode, 'end'); return (st.tick / 30).toFixed(0); }).join('、') + ' 秒');
console.table(rows); console.log('BC01 roster QA: OK');
