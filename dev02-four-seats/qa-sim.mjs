// DEV02 模擬層驗收：純 Node，可重跑。
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as L from '../dev05-layout/layout.mjs';
import * as S from './sim.mjs';

const R = S.RULES, rows = [];
const test = (name, fn) => rows.push({ 案例: name, 摘要: fn() ?? '' });
const none = () => S.createSim({ bots: [] });
const onPad = (st, id, i) => { const [x, z] = S.padWorld(id, i); Object.assign(st.seats[id].commander, { x, z }); };
const run = (st, n, cmds = {}) => { const log = []; for (let i = 0; i < n && st.mode === 'play'; i++) log.push(...S.step(st, cmds[st.tick + 1] || [])); return log; };
const unit = (st, seat, x, z, more = {}) => { const u = { id: ++st.serial, seat, team: L.seatById(seat).team, x, z, hp: R.unitHp, cd: 0, lat: 0, target: S.targetOf(st, seat), foe: 0, dx: 0, dz: 0, ...more }; st.units.push(u); st.seats[seat].deployed++; return u; };

test('購兵 tick 與 v5 原函式一致', () => {
  const v5 = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL('../v5/qa-exact-functions.cjs', import.meta.url))], { encoding: 'utf8' }));
  for (const id of S.SEAT_IDS) for (const [gold, pad, n, want] of [[12, 0, 360, v5.fiveGold], [0, 1, 730, v5.twelveGold]]) {
    const st = none(); st.seats[id].gold = gold; onPad(st, id, pad);
    const log = []; for (let i = 0; i < n; i++) { log.push(...S.step(st)); st.units = []; }
    assert.deepEqual(log.filter(e => e.type === 'buy').map(e => e.tick + 0), want.map(e => e.tick), `${id} 席 ${pad}`);
  }
  return '四席 × 兩信標';
});
test('到達前不扣款、離開後停止、未開放信標不購兵、錢包互不影響', () => {
  const st = none(), [x, z] = S.padWorld('W', 0), [hx, hz] = [st.seats.W.commander.x, st.seats.W.commander.z];
  const log = []; let entered = 0;
  S.step(st, [{ seat: 'W', type: 'goal', x, z }]);
  while (st.tick < 120) { const e = S.step(st); log.push(...e); if (!entered && e.some(v => v.type === 'enter')) entered = st.tick; if (!entered) assert.equal(st.seats.W.spent, 0); }
  assert.equal(entered, Math.ceil((Math.hypot(x - hx, z - hz) - R.padRadius) / R.commanderSpeed));
  assert.equal(log.find(e => e.type === 'buy').tick, entered);
  run(st, 60, { 121: [{ seat: 'W', type: 'goal', x: hx, z: hz }] }); const n = st.seats.W.buys; st.seats.W.gold += 50; run(st, 200); assert.equal(st.seats.W.buys, n);
  const t = none(); for (const i of [2, 3]) { onPad(t, 'E', i); run(t, 60); assert.equal(t.seats.E.buys, 0); }
  for (const id of ['N', 'S', 'E']) assert.deepEqual([st.seats[id].spent, st.seats[id].gold], [0, 12 + Math.floor(st.tick / 30)]);
});
test('連續與重複移動指令不增加成交；非法指令無效；指揮官不離開購買區', () => {
  const [x, z] = S.padWorld('S', 0), one = none(), many = none(), a = [], b = [];
  for (let i = 0; i < 400; i++) { a.push(...S.step(one, i ? [] : [{ seat: 'S', type: 'goal', x, z }])); b.push(...S.step(many, Array(7).fill({ seat: 'S', type: 'goal', x, z }))); }
  const buys = l => l.filter(e => e.type === 'buy').map(e => [e.tick, e.gold, e.units]); assert.deepEqual(buys(a), buys(b)); assert(buys(a).length >= 4);
  const st = none(), d = S.digest(st.seats);
  S.step(st, [null, {}, { seat: 'Q', type: 'goal', x: 0, z: 0 }, { seat: 'N', type: 'goal', x: NaN, z: 1 }, { seat: 'N', type: 'buy', x: 1, z: 1 }, { seat: 'N', type: 'dir', x: Infinity, z: 0 }]); assert.equal(S.digest(st.seats), d);
  for (const id of S.SEAT_IDS) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = none(); run(q, 120, { 1: [{ seat: id, type: 'dir', x: dx, z: dz }] }); const [lx, lz] = S.toLocal(id, q.seats[id].commander.x, q.seats[id].commander.z); assert(Math.abs(lx) <= 5.8 + 1e-9 && Math.abs(lz) <= 4.2 + 1e-9); }
  const far = none(); run(far, 200, { 1: [{ seat: 'N', type: 'goal', x: 0, z: 0 }] }); assert(far.seats.N.commander.x < -L.DIM.laneWidth / 2);
});
test('同步傷害：互殺同 tick 同亡，與陣列順序無關', () => {
  for (const flip of [0, 1]) {
    const st = none(); unit(st, 'N', 0, -.5, { hp: 1 }); unit(st, 'S', 0, .5, { hp: 1 }); if (flip) st.units.reverse();
    const log = run(st, 1); assert.equal(st.units.length, 0); assert.equal(log.filter(e => e.type === 'death').length, 2);
    assert.deepEqual(['N', 'S'].map(i => [st.seats[i].lost, st.seats[i].kills]), [[1, 1], [1, 1]]);
  }
});
test('兩軸部隊依平面距離接敵', () => {
  const st = none(); unit(st, 'N', 0, -6); unit(st, 'E', 6, 0); const log = run(st, 400);
  assert(log.some(e => e.type === 'shot' && e.seat === 'N') && log.some(e => e.type === 'shot' && e.seat === 'E'));
  assert.equal(st.units.length, 0); // 同時接敵、同規格，同歸於盡
});
test('最後核心同一步失守為平手；同步失守先全部生效', () => {
  const st = none(); st.seats.S.alive = st.seats.W.alive = false; st.seats.N.hp = st.seats.E.hp = 1;
  const core = (id, off) => { const [x, z] = L.corePos(id), d = L.seatById(id).dir; return [x - d[0] * off, z - d[1] * off]; };
  unit(st, 'S', ...core('N', 5.5), { target: 'N' }); unit(st, 'W', ...core('E', 5.5), { target: 'E' });
  const log = run(st, 1); assert.deepEqual([st.mode, st.winner], ['end', 'draw']); assert.equal(log.filter(e => e.type === 'fall').length, 2); assert.equal(log.at(-1).type, 'end');
  const st2 = none(); st2.seats.S.hp = st2.seats.E.hp = 1; unit(st2, 'N', ...core('S', 5.5)); unit(st2, 'W', ...core('E', 5.5)); run(st2, 1); assert.equal(st2.winner, 'A');
  assert.equal(run(st2, 5).length, 0, '終局後不再推進');
});
test('對側失守：經中央改派、路線可重現、失守席停購、存活部隊續戰', () => {
  const go = () => {
    const st = none(); st.seats.S.hp = 1; onPad(st, 'S', 0); st.seats.S.gold = 0;
    const [x, z] = L.corePos('S'); const u = unit(st, 'N', 0, z - 5.5, { hp: 99 }); const s = unit(st, 'S', 3, -15, { hp: 99 }); // 南席存活部隊已在北路
    const log = run(st, 1), path = []; let near = 99;
    assert(log.some(e => e.type === 'fall' && e.seat === 'S') && log.some(e => e.type === 'reroute' && e.seat === 'N' && e.to === 'E'));
    assert.deepEqual([u.target, s.target], ['E', 'N']); const gold = st.seats.S.gold;
    for (let i = 0; i < 2400 && st.seats.E.hp === R.coreHp; i++) { S.step(st); path.push([u.x, u.z]); near = Math.min(near, Math.hypot(u.x, u.z)); }
    assert(near < 4, '應經中央'); assert(st.seats.E.hp < R.coreHp); assert.deepEqual([st.seats.S.gold, st.seats.S.buys], [gold, 0]);
    assert(st.seats.N.hp < R.coreHp, '失守席存活部隊應續戰'); st.seats.N.gold = 5; onPad(st, 'N', 0); S.step(st); assert.equal(st.units.at(-1).target, 'E');
    return S.digest(path);
  };
  assert.equal(go(), go());
});
test('同一輸入重跑一致；中途序列化續跑一致；亂數種子不同則不同', () => {
  for (const seed of [3, 17]) {
    const commands = []; let r = seed * 7919; const next = n => (r = (Math.imul(r, 1103515245) + 12345) >>> 0, r % n);
    for (let t = 1; t < 5000; t += 1 + next(90)) commands.push(next(4) ? { tick: t, seat: 'W', type: 'goal', x: -40 + next(30), z: 5 + next(25) } : { tick: t, seat: 'W', type: 'dir', x: next(3) - 1, z: next(3) - 1 });
    const rec = { seed, bots: ['N', 'S', 'E'], commands }, a = S.replay(rec), b = S.replay(JSON.parse(JSON.stringify(rec)));
    assert.deepEqual(a.marks, b.marks); assert.equal(a.events, b.events); assert.equal(a.state.mode, 'end');
    let st = S.createSim(rec), i = 0; while (st.mode === 'play') { const now = []; while (commands[i]?.tick === st.tick + 1) now.push(commands[i++]); S.step(st, now); if (st.tick % 777 === 0) st = JSON.parse(JSON.stringify(st)); }
    assert.equal(S.digest(st), a.final);
    assert.notEqual(S.replay({ ...rec, seed: seed + 1 }).final, a.final);
  }
});
test('全電腦 60 局：皆有終局；帳目、邊界、部隊數逐步相符；換席不偏袒', () => {
  const score = { A: 0, B: 0, draw: 0 }; let longest = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const st = S.createSim({ seed }), rot = S.createSim({ seed }), k = ['N', 'W', 'S', 'E'];
    k.forEach((id, i) => { rot.bots[id] = JSON.parse(JSON.stringify(S.createSim({ seed }).bots[k[(i + 2) % 4]])); });
    const income = { N: 0, W: 0, S: 0, E: 0 };
    while (st.mode === 'play') {
      const alive = Object.fromEntries(S.SEAT_IDS.map(id => [id, st.seats[id].alive])); S.step(st); S.step(rot);
      for (const id of S.SEAT_IDS) { const s = st.seats[id]; if (alive[id] && st.tick % 30 === 0) income[id]++; assert.equal(s.gold + s.spent, 12 + income[id]); assert(s.gold >= 0); if (st.tick % 15 === 0) assert.equal(st.units.filter(u => u.seat === id).length, s.deployed - s.lost); }
      if (st.tick % 15 === 0) for (const u of st.units) { const ok = Math.min(Math.abs(u.x), Math.abs(u.z)) <= 3.6 + 1e-6 || Math.hypot(u.x, u.z) <= 8.2 + 1e-6 || L.SEATS.some(s => { const [x, z] = L.corePos(s.id); return Math.hypot(u.x - x, u.z - z) <= 6.2 + 1e-6; }); assert(ok, `部隊出界 ${u.x},${u.z}`); assert(u.target && st.seats[u.target].alive || st.mode === 'end'); }
      assert(st.tick < 30 * 60 * 13);
    }
    score[st.winner]++; longest = Math.max(longest, st.tick);
    assert.equal(rot.winner, { A: 'B', B: 'A', draw: 'draw' }[st.winner], `種子 ${seed} 換席後應鏡像`); assert.equal(rot.tick, st.tick);
  }
  return `甲 ${score.A}／乙 ${score.B}／平 ${score.draw}，最長 ${(longest / 30).toFixed(0)} 秒`;
});
test('玩家全程不動也會終局', () => {
  const t = []; for (const id of S.SEAT_IDS) { const st = S.createSim({ seed: 5, bots: S.SEAT_IDS.filter(x => x !== id) }); while (st.mode === 'play') S.step(st); assert.equal(st.seats[id].buys, 0); t.push((st.tick / 30).toFixed(0)); } return `終局 ${t.join('、')} 秒`;
});
test('驗收案例：固定種子 20261126，玩家持南席腳本', () => {
  const pads = [0, 1].map(i => S.padWorld('S', i)), commands = [];
  for (let t = 30; t < 18000; t += 900) { const [x, z] = pads[Math.floor(t / 900) % 2]; commands.push({ tick: t, seat: 'S', type: 'goal', x, z }); }
  const r = S.replay({ seed: 20261126, bots: ['N', 'W', 'E'], commands }); assert.equal(r.state.mode, 'end');
  const expected = process.env.UPDATE ? null : 'd657d338 13dd6894';
  if (expected) assert.equal(`${r.final} ${r.events}`, expected, '模擬規則改變時需有意識地更新');
  return `${r.state.winner} ${(r.state.tick / 30).toFixed(0)} 秒 ${r.final} ${r.events}`;
});
console.table(rows); console.log('DEV02 sim QA: OK');
