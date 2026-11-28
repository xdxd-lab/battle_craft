// BC01 兵種（模擬版本 3 起）、版本 4 道路寬、版本 5 經濟與版本 6 六兵種、版本 7 九兵種、版本 8 經濟與部署驗收：傷害、護盾、投射物、彈跳、購兵與完整終局。純 Node，可重跑。
import assert from 'node:assert/strict';
import * as L from '../dev05-layout/layout.mjs';
import * as S from './sim.mjs';
import { KINDS, CORE, PLATE, ROSTER, SPLASH, applyDamage, canTarget, framesAt, unitStats, weaponOf } from './roster.mjs';
import { ARENA, corePos } from './arena.mjs';

const rows = [], test = (name, fn) => rows.push({ 案例: name, 摘要: fn() ?? '' });
const none = (version = 6) => S.createSim({ bots: [], version }); // 兵種機制案例預設鎖在版本 6（無護甲）；版本 7 案例明寫
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
    if (!canTarget(KINDS[a], KINDS[b].air)) { assert.equal(a, 'scourge'); continue; } // 只有自殺蟲不打地面
    const st = none(); unit(st, 'N', a, 0, -.5); const t = unit(st, 'S', b, 0, .5, idle); run(st, 12); assert(t.hp < KINDS[b].hp, `${a} → ${b}`);
  }
  assert.deepEqual([canTarget({ targets: ['ground'] }, true), canTarget({ targets: ['ground'] }, false)], [false, true]);
  const st = none(), air = unit(st, 'N', 'mutalisk', 0, 0, idle), ground = unit(st, 'N', 'marine', 0, 0, idle); S.step(st); assert(Math.abs(air.x - ground.x) < 1e-9 && Math.abs(air.z - ground.z) < 1e-9, '空地不互推');
});
test('同 tick 多發打同一目標：只陣亡一次、擊殺不重複', () => {
  const st = none(); unit(st, 'N', 'marine', -.5, -.5); unit(st, 'W', 'marine', .5, -.5); unit(st, 'S', 'marine', 0, .5, { ...idle, hp: 4 });
  const log = S.step(st); assert.equal(log.filter(e => e.type === 'death').length, 1); assert.equal(st.seats.N.kills + st.seats.W.kills, 1);
});
test('核心：六兵種可攻擊，視為重裝甲', () => {
  for (const kind of Object.keys(KINDS).filter(k => canTarget(KINDS[k], false))) { const st = none(), [x, z] = corePos('S'), d = L.seatById('S').dir, r = S.RULES.coreRadius + KINDS[kind].range - .05; const a = unit(st, 'N', kind, x - d[0] * r, z - d[1] * r, { target: 'S' }); S.step(st); a.cd = 1e9; run(st, 20); assert.equal(CORE.hp - st.seats.S.hp, KINDS[kind].damage, kind); }
});
test('四席信標：版本 5 三兵種＋未開放、版本 6 六兵種、版本 7 九兵種；扣款、兵種與數值正確；每次一隻', () => [5, 6, 7].map(version => {
  for (const id of S.SEAT_IDS) S.padsFor(version).forEach((p, i) => {
    const st = S.createSim({ version, bots: [] }), [x, z] = S.padWorld(id, i, S.dimFor(version)); Object.assign(st.seats[id].commander, { x, z }); st.seats[id].gold = 50;
    const buy = S.step(st).find(e => e.type === 'buy');
    if (p.locked) return assert(!buy);
    assert.deepEqual([buy.kind, st.seats[id].gold, st.units.length], [p.kind, 50 - p.cost, p.count]); assert.equal(st.units[0].sh, KINDS[p.kind].shield);
    if (version >= 6) assert.equal(p.count, 1);
  });
  assert.equal(S.padsFor(version).length, { 5: 4, 6: 6, 7: 9 }[version]);
  return `v${version} ` + S.padsFor(version).filter(p => !p.locked).map(p => `${p.label} ${p.cost}金`).join('、');
}).join('；'));
for (const [V, digest6] of [[6, 'c037ba37 6207bb5a'], [7, 'f358976c 172c0740']]) test(`版本 ${V} 全電腦 60 局：皆終局、帳目相符、${ROSTER[V].length} 兵種都有購買與陣亡；固定摘要`, () => {
  const win = {}, bought = {}, died = {}, secs = [];
  for (let seed = 1; seed <= 60; seed++) {
    const st = S.createSim({ seed, version: V });
    while (st.mode === 'play') {
      for (const e of S.step(st)) { if (e.type === 'buy') bought[e.kind] = (bought[e.kind] || 0) + e.count; if (e.type === 'death') died[e.kind] = (died[e.kind] || 0) + 1; }
      if (st.tick % 30 === 0) { for (const id of S.SEAT_IDS) assert.equal(st.units.filter(u => u.seat === id).length, st.seats[id].deployed - st.seats[id].lost); for (const u of st.units) assert(u.hp > 0 && u.sh >= 0 && u.sh <= KINDS[u.kind].shield); for (const id of S.SEAT_IDS) for (const k of Object.keys(KINDS)) assert(st.units.filter(u => u.seat === id && u.kind === k).length < 128, '繪製上限'); }
      assert(st.tick < 30 * 60 * 13);
    }
    win[st.winner] = (win[st.winner] || 0) + 1; secs.push(st.tick / 30);
  }
  for (const k of ROSTER[V]) assert(bought[k] > 0 && died[k] > 0, k);
  const rec = { version: V, seed: 20261126, bots: ['N', 'W', 'S', 'E'], commands: [] }, a = S.replay(rec); assert.equal(S.replay(rec).final, a.final);
  if (!process.env.UPDATE) assert.equal(`${a.final} ${a.events}`, digest6);
  secs.sort((a, b) => a - b); return `勝場 ${JSON.stringify(win)}；${secs[0].toFixed(0)}／${secs[30].toFixed(0)}／${secs[59].toFixed(0)} 秒；購買 ${JSON.stringify(bought)}；${a.final} ${a.events}`;
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
    const st = S.createSim({ version: 4, seed });
    while (st.mode === 'play') { assert(st.tick < 30 * 60 * 13); S.step(st); for (const u of st.units) { const ax = Math.abs(u.x), az = Math.abs(u.z), core = S.SEAT_IDS.some(id => { const [cx, cz] = corePos(id); return Math.hypot(u.x - cx, u.z - cz) <= R.platform + 1e-9; });
      assert(core || Math.hypot(u.x, u.z) <= R.junction + 1e-9 || Math.min(ax, az) <= half + 1e-9, `${seed} ${u.x},${u.z}`); if (!core && Math.max(ax, az) > R.junction) widest = Math.max(widest, Math.min(ax, az)); } }
    wins[st.winner] = (wins[st.winner] || 0) + 1;
  }
  assert(widest > 3.6, `加寬部分應有部隊使用 ${widest}`);
  const rec = { version: 4, seed: 20261126, bots: ['N', 'W', 'S', 'E'], commands: [] }, a = S.replay(rec); assert.equal(S.replay(rec).final, a.final);
  if (!process.env.UPDATE) assert.equal(`${a.final} ${a.events}`, '5a70a7ff d6d987b7');
  return `勝場 ${JSON.stringify(wins)}；最寬 ${widest.toFixed(2)}；${a.final} ${a.events}`;
});
test('版本 5 經濟：48 金起、每秒 2 金、陸戰隊 7.5；舊版維持 12／每秒 1／5', () => {
  assert.equal(S.VERSION, 10); assert.deepEqual(S.ECONOMY, { startGold: 48, incomeEvery: 15, costs: { marine: 7.5 } });
  for (const [version, start, perSecond, costs] of [[1, 12, 1, [5, 12]], [2, 12, 1, [5, 12]], [3, 12, 1, [5, 12, 14]], [4, 12, 1, [5, 12, 14]], [5, 48, 2, [7.5, 12, 14]], [6, 48, 2, [7.5, 12, 14, 9, 28, 17]], [7, 48, 6, [7.5, 12, 14, 9, 28, 17, 40, 24, 6]]]) {
    const st = S.createSim({ version, bots: [] }); assert(S.SEAT_IDS.every(id => st.seats[id].gold === start), `v${version}`);
    run(st, 14); assert.equal(st.seats.N.gold, start); run(st, 1); assert.equal(st.seats.N.gold, version >= 7 ? start + 3 : version >= 5 ? start + 1 : start, `v${version} 每次收入`); run(st, 285); assert.equal(st.seats.N.gold, start + perSecond * 10);
    assert.deepEqual(S.padsFor(version).filter(p => !p.locked).map(p => p.cost), costs, `v${version}`);
  }
});
test('版本 8 每次 4.5 金：30 Hz 上每 75 步恰四次，舊核心不變', () => {
  const st = none(8), { N, W } = st.seats;
  assert.deepEqual(S.SEAT_IDS.map(id => [st.seats[id].gold, st.seats[id].hp]), Array(4).fill([48, 2700]));
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(S.coreMax), [120, 120, 900, 900, 900, 900, 900, 2700]);
  W.alive = false;
  const first = [];
  for (let tick = 1; tick <= 7500; tick++) {
    const previous = N.gold;
    S.step(st);
    assert.equal(N.gold, 48 + 4.5 * Math.floor(tick * 4 / 75), `tick ${tick}`);
    if (tick <= 150 && N.gold !== previous) first.push(tick);
  }
  assert.deepEqual(first, [19, 38, 57, 75, 94, 113, 132, 150]);
  assert.equal(N.gold, 1848);
  assert.equal(W.gold, 48, '失守席不領收入');
});
test('版本 8 戰鬥巡洋艦：單筆 40 金生出 3 艘；發錢的同一步可成交；舊版仍 1 艘', () => {
  const legacyPads = S.padsFor(7), pads = S.padsFor(8), i = pads.findIndex(p => p.kind === 'battlecruiser');
  assert(i >= 0); assert.deepEqual(legacyPads.filter((_, j) => i !== j), pads.filter((_, j) => i !== j));
  for (const [version, startGold, tick, count] of [[7, 37, 15, 1], [8, 35.5, 19, 3]]) {
    const st = none(version), [x, z] = S.padWorld('S', i, S.dimFor(version));
    const s = st.seats.S;
    Object.assign(s.commander, { x, z }); s.gold = startGold;
    const pre = run(st, tick - 1);
    assert(pre.some(e => e.type === 'wait' && e.cost === 40));
    assert(!pre.some(e => e.type === 'buy')); assert.equal(s.gold, startGold);
    const buys = S.step(st).filter(e => e.type === 'buy');
    assert.equal(buys.length, 1);
    const [buy] = buys;
    assert.deepEqual([buy.tick, buy.cost, buy.count, buy.gold, s.buys, s.spent, s.deployed], [tick, 40, count, 0, 1, 40, count]);
    assert.deepEqual(st.units.map(u => [u.id, u.kind, u.hp]), buy.units.map(id => [id, 'battlecruiser', KINDS.battlecruiser.hp]));
    assert.equal(new Set(buy.units).size, count);
    assert(!S.step(st).some(e => e.type === 'buy'));
  }
});
test('半金門檻：7 金不能買、湊到 7.5 以上才成交，餘額保留半金', () => {
  const at = gold => { const st = none(), [x, z] = S.padWorld('S', 0, S.dimFor(6)); Object.assign(st.seats.S.commander, { x, z }); st.seats.S.gold = gold; return st; };
  const short = at(7), e = S.step(short); assert(e.some(v => v.type === 'wait' && v.cost === 7.5) && !e.some(v => v.type === 'buy')); assert.equal(short.seats.S.gold, 7);
  const [buy] = until(short, 'buy'); assert.deepEqual([buy.tick, buy.cost, buy.gold], [15, 7.5, .5]);
  const exact = at(7.5); assert.equal(S.step(exact).find(v => v.type === 'buy').gold, 0);
  const half = at(6.5); assert.equal(until(half, 'buy')[0].gold, 0);
});
test('版本 5 全電腦 60 局：終局、金幣帳逐秒相符、各席單一兵種不超過繪製上限；固定摘要', () => {
  let peak = 0, longest = 0; const wins = {};
  for (let seed = 1; seed <= 60; seed++) {
    const st = S.createSim({ version: 5, seed }), earned = Object.fromEntries(S.SEAT_IDS.map(id => [id, 48]));
    while (st.mode === 'play') {
      assert(st.tick < 30 * 60 * 13); const alive = S.SEAT_IDS.filter(id => st.seats[id].alive); S.step(st); if (st.tick % 15 === 0) for (const id of alive) earned[id]++;
      if (st.tick % 15 === 0) for (const id of S.SEAT_IDS) { const s = st.seats[id]; assert.equal(s.gold + s.spent, earned[id]); assert(s.gold >= 0 && Number.isInteger(s.gold * 2)); for (const kind of Object.keys(KINDS)) peak = Math.max(peak, st.units.filter(u => u.seat === id && u.kind === kind).length); }
    }
    wins[st.winner] = (wins[st.winner] || 0) + 1; longest = Math.max(longest, st.tick);
  }
  assert(peak < 128, `繪製上限 ${peak}`);
  const rec = { version: 5, seed: 20261126, bots: ['N', 'W', 'S', 'E'], commands: [] }, a = S.replay(rec); assert.equal(S.replay(rec).final, a.final);
  if (!process.env.UPDATE) assert.equal(`${a.final} ${a.events}`, '2007c247 46e76872');
  return `勝場 ${JSON.stringify(wins)}；最長 ${(longest / 30).toFixed(0)} 秒；單席單兵種峰值 ${peak}；${a.final} ${a.events}`;
});
const near = (st, seat, kind, x, z, more) => unit(st, seat, kind, x, z, { ...idle, ...more });
test('版本 6 三新兵種：BWAPI 原版 hp／盾／傷害／冷卻／射程 px 與層別', () => {
  const px = v => Math.round(v * 1.62 / 128 * 1e9) / 1e9;
  for (const [k, hp, sh, armor, attack, damage, cooldown, range, air] of [['hydralisk', 80, 0, 'medium', 'E', 10, 15, 128, false], ['archon', 10, 350, 'heavy', 'N', 30, 20, 64, false], ['wraith', 120, 0, 'heavy', 'N', 8, 30, 160, true]])
    assert.deepEqual([KINDS[k].hp, KINDS[k].shield, KINDS[k].armor, KINDS[k].attack, KINDS[k].damage, KINDS[k].cooldown, KINDS[k].range, KINDS[k].air], [hp, sh, armor, attack, damage, cooldown, px(range), air], k);
  assert.deepEqual(Object.values(weaponOf('wraith', true)).length && ['attack', 'damage', 'cooldown', 'range'].map(f => weaponOf('wraith', true)[f]), ['E', 20, 22, px(160)]);
  for (const k of ['marine', 'dragoon', 'mutalisk', 'hydralisk', 'archon']) assert.equal(weaponOf(k, true), KINDS[k], k);
  assert.deepEqual(ROSTER[3], ['marine', 'dragoon', 'mutalisk']);
  return '刺蛇 80／E10、破壞能 10＋350／N30 濺射、死靈式戰機 120／對地 N8、對空 E20';
});
test('刺蛇 E 依體型 50／75／100%；E 不濺射', () => {
  const out = ['marine', 'hydralisk', 'dragoon'].map(kind => {
    const st = none(), a = unit(st, 'N', 'hydralisk', 0, 0), t = near(st, 'S', kind, 1, 0, { sh: 0 }), side = near(st, 'S', 'marine', 1.2, 0);
    a.cd = 0; until(st, 'impact'); return [KINDS[kind].hp - t.hp, side.hp];
  });
  assert.deepEqual(out, [[5, 40], [7.5, 40], [10, 40]]);
  const st = none(); unit(st, 'N', 'dragoon', 0, 0); const t = near(st, 'S', 'marine', 1, 0), side = near(st, 'S', 'marine', 1.1, 0); until(st, 'impact');
  assert.deepEqual([t.hp, side.hp], [30, 40]);
  return '輕 5／中 7.5／重 10；鄰兵 0';
});
test('死靈式戰機：對地即時 N 8、對空投射物 E 20（打輕甲 10），冷卻依武器', () => {
  const g = none(), a = unit(g, 'N', 'wraith', 0, 0), m = near(g, 'S', 'marine', 1.5, 0); const e = S.step(g);
  assert(e.some(v => v.type === 'shot') && !e.some(v => v.type === 'launch')); assert.deepEqual([m.hp, a.cd], [32, 30]);
  const f = none(), b = unit(f, 'N', 'wraith', 0, 0), mu = near(f, 'S', 'mutalisk', 1.5, 0); assert(S.step(f).some(v => v.type === 'launch')); assert.equal(b.cd, 22);
  until(f, 'impact'); assert.equal(mu.hp, 110);
  const h = none(); unit(h, 'N', 'hydralisk', 0, 0); const w = near(h, 'S', 'wraith', 1.5, 0); until(h, 'impact'); assert.equal(w.hp, 110);
  return '對地 8、對空 10、刺蛇打死靈式戰機 10';
});
test('破壞能：主目標整發，濺射 100／50／25% 依距離；不傷己席，可傷隊友；盾先扣不套體型', () => {
  const [r0, r1, r2] = SPLASH.archon.radii, st = none(), a = unit(st, 'N', 'archon', 0, 0);
  const t = near(st, 'S', 'dragoon', .8, 0, { sh: 0 }), inner = near(st, 'E', 'marine', .8, r0 - .01), mid = near(st, 'S', 'marine', .8 + r1 - .01, 0), outer = near(st, 'E', 'marine', .8, -(r2 - .01));
  const far = near(st, 'S', 'marine', .8 + r2 + .05, 0), own = near(st, 'N', 'marine', .8, .3), mate = near(st, 'W', 'marine', .8, -.3), air = near(st, 'S', 'mutalisk', .8, .3 - .01);
  const e = S.step(st); assert(e.some(v => v.type === 'shot'));
  assert.deepEqual([t.hp, inner.hp, mid.hp, outer.hp, far.hp, own.hp, mate.hp, air.hp], [70, 10, 25, 32.5, 40, 40, 25, 105]);
  const z = none(); unit(z, 'N', 'hydralisk', 0, 0); const ar = near(z, 'S', 'archon', 1, 0); until(z, 'impact'); assert.deepEqual([ar.hp, ar.sh], [10, 340]);
  const k = none(); unit(k, 'N', 'archon', 0, 0); near(k, 'S', 'dragoon', .8, 0, { sh: 0 }); near(k, 'W', 'marine', .8, .3, { hp: 5 }); near(k, 'E', 'marine', .8, -.3, { hp: 5 });
  const deaths = S.step(k).filter(v => v.type === 'death'); assert.deepEqual(deaths.map(d => [d.seat, d.by]), [['W', []], ['E', ['N']]]); assert.deepEqual([k.seats.N.kills, k.seats.W.lost, k.seats.E.lost], [1, 1, 1]);
  return `半徑 ${SPLASH.archon.radii.map(r => r.toFixed(3)).join('／')}；隊友受 50%、己席 0`;
});
for (const [V, P] of [[6, S.SIX_PAD_POSITIONS], [7, S.NINE_PAD_POSITIONS]]) test(`版本 ${V} 購買區：${P.length} 信標互不重疊、不出購買區、指揮官可走到、開場不在信標上`, () => {
  const r = S.padRadiusFor(V), D = S.dimFor(V); assert.equal(r, V >= 7 ? 1.35 : 1.6);
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) assert(Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]) > 2 * r, `${i}-${j}`);
  assert(P.every(([x, z]) => Math.abs(x) + r < ARENA.shopWidth / 2 && Math.abs(z) + r < ARENA.shopDepth / 2), '信標圈在購買區內');
  for (const id of S.SEAT_IDS) {
    const st = S.createSim({ bots: [], version: V }), c = st.seats[id].commander;
    assert(P.every((_, i) => { const [x, z] = S.padWorld(id, i, D); return Math.hypot(x - c.x, z - c.z) > r; }));
    P.forEach((_, i) => { const [x, z] = S.padWorld(id, i, D); S.step(st, [{ seat: id, type: 'goal', x, z }]); for (let n = 0; n < 120 && st.seats[id].pad !== i; n++) S.step(st); assert.equal(st.seats[id].pad, i, `${id} ${i}`); });
  }
});
test('版本 7 三新兵種：BWAPI 原版 hp／盾／護甲／傷害／冷卻／射程 px 與層別；每次一隻', () => {
  const px = v => Math.round(v * 1.62 / 128 * 1e9) / 1e9;
  for (const [k, hp, sh, plate, armor, attack, damage, cooldown, range, targets] of [['battlecruiser', 500, 0, 3, 'heavy', 'N', 25, 30, 192, ['ground', 'air']], ['scout', 150, 100, 0, 'heavy', 'N', 8, 30, 128, ['ground', 'air']], ['scourge', 25, 0, 0, 'light', 'N', 110, 0, null, ['air']]])
    assert.deepEqual([KINDS[k].hp, KINDS[k].shield, PLATE[k], KINDS[k].armor, KINDS[k].attack, KINDS[k].damage, KINDS[k].cooldown, range === null ? null : KINDS[k].range, KINDS[k].targets, KINDS[k].air, KINDS[k].count], [hp, sh, plate, armor, attack, damage, cooldown, range === null ? null : px(range), targets, true, 1], k);
  assert.deepEqual(['attack', 'damage', 'hits', 'cooldown', 'range'].map(f => weaponOf('scout', true)[f]), ['E', 14, 2, 22, px(128)]);
  assert.deepEqual(PLATE, { marine: 0, dragoon: 1, mutalisk: 0, hydralisk: 0, archon: 0, wraith: 0, battlecruiser: 3, scout: 0, scourge: 0 });
  assert.deepEqual(ROSTER[7].slice(6), ['battlecruiser', 'scout', 'scourge']);
});
test('基礎護甲：版本 7 才生效；先扣盾、再扣護甲、再乘體型，下限 0.5', () => {
  const hpAfter = (version, kind, target, more) => { const st = none(version); unit(st, 'N', kind, 0, 0); const t = near(st, 'S', target, 1.5, 0, more); for (let i = 0; i < 40 && t.hp === KINDS[target].hp; i++) S.step(st); return KINDS[target].hp - t.hp; };
  assert.deepEqual([hpAfter(6, 'marine', 'battlecruiser'), hpAfter(7, 'marine', 'battlecruiser')], [6, 3], '陸戰隊 6 打護甲 3');
  assert.deepEqual([hpAfter(6, 'hydralisk', 'dragoon', { sh: 0 }), hpAfter(7, 'hydralisk', 'dragoon', { sh: 0 })], [10, 9], '刺蛇 E10 打重騎兵本體（護甲 1）');
  const t = { hp: 500, sh: 0, armor: 'light' }; applyDamage(t, 2, 'N', 1, 3); assert.equal(t.hp, 499.5, '扣到 0 仍有 0.5');
  const u = { hp: 500, sh: 4, armor: 'heavy' }; applyDamage(u, 10, 'N', 1, 3); assert.deepEqual([u.sh, u.hp], [0, 497], '盾吸收 4、剩 6 扣護甲 3');
  return '陸戰隊→戰鬥巡洋艦 6→3；刺蛇→重騎兵 10→9';
});
test('斥候：對地即時 N 8；對空投射物 E 14×2（打輕甲 7＋7），冷卻依武器', () => {
  const g = none(7), a = unit(g, 'N', 'scout', 0, 0), m = near(g, 'S', 'marine', 1.2, 0); const e = S.step(g);
  assert(e.some(v => v.type === 'shot') && !e.some(v => v.type === 'launch')); assert.deepEqual([m.hp, a.cd], [32, 30]);
  const f = none(7), b = unit(f, 'N', 'scout', 0, 0), mu = near(f, 'S', 'mutalisk', 1.2, 0); assert(S.step(f).some(v => v.type === 'launch')); assert.equal(b.cd, 22);
  const [hit] = until(f, 'impact'); assert.deepEqual([mu.hp, hit.body], [106, 14]);
  const w = none(7); unit(w, 'N', 'scout', 0, 0); const bc = near(w, 'S', 'battlecruiser', 1.2, 0); until(w, 'impact'); assert.equal(bc.hp, 500 - 2 * (14 - 3), '兩發各自扣護甲 3');
  return '打陸戰隊 8、打飛螳 14、打戰鬥巡洋艦 22';
});
test('自殺蟲：只打空中、接觸自爆（自己陣亡、不算對方擊殺、攻擊者得擊殺）；不攻擊核心與地面', () => {
  const st = none(7), sc = unit(st, 'N', 'scourge', 0, 0), w = near(st, 'S', 'wraith', 1.2, 0), m = near(st, 'S', 'marine', .3, .3);
  const log = run(st, 40); const boom = log.find(e => e.type === 'death' && e.kind === 'scourge');
  assert(boom && boom.boom === 1 && boom.by.length === 0, JSON.stringify(boom)); assert.deepEqual([w.hp, m.hp, st.seats.N.lost, st.seats.S.kills], [10, 40, 1, 0]);
  const k = none(7); unit(k, 'N', 'scourge', 0, 0); near(k, 'S', 'mutalisk', .4, 0, { hp: 100 }); const d = run(k, 5).filter(e => e.type === 'death').map(e => [e.kind, e.by]); assert.deepEqual(d, [['scourge', []], ['mutalisk', ['N']]]); assert.deepEqual([k.seats.N.kills, k.seats.N.lost], [1, 1]);
  const c = none(7), [x, z] = corePos('S'), dir = L.seatById('S').dir, r = S.RULES.coreRadius + .2, s2 = unit(c, 'N', 'scourge', x - dir[0] * r, z - dir[1] * r, { target: 'S' }); run(c, 60);
  assert.deepEqual([c.seats.S.hp, s2.hp], [CORE.hp, 25], '核心不受傷、自殺蟲待命');
  return '打死靈式戰機 110（剩 10）、殘血飛螳擊殺計自殺蟲席';
});
test('玩家全程不動也會終局', () => S.SEAT_IDS.map(id => { const st = S.createSim({ seed: 5, bots: S.SEAT_IDS.filter(x => x !== id) }); run(st, S.HZ * 60 * 30); assert.equal(st.mode, 'end'); return (st.tick / 30).toFixed(0); }).join('、') + ' 秒');
console.table(rows); console.log('BC01 roster QA: OK');
