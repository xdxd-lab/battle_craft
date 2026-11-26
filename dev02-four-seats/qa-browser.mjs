// DEV02：以真實瀏覽器輸入從選席玩到終局，並以 Node 重跑輸入紀錄比對狀態摘要。
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { launch, sleep } from '../tools/browser.mjs';
import * as S from './sim.mjs';
import * as L from '../dev05-layout/layout.mjs';

// 三兵種本體三角面（陸戰隊沿用原突擊機 92／380）
const stdTri = { dragoon: 148, mutalisk: 112 }, highTri = { dragoon: 756, mutalisk: 436 };
const here = path.dirname(fileURLToPath(import.meta.url)), SHOTS = process.env.SHOTS;
const url = pathToFileURL(path.join(here, 'battle_craft-dev02.html')).href;
const browser = await launch({ width: 1600, height: 900 }), rows = [];
const test = async (name, fn) => rows.push({ 案例: name, 摘要: (await fn()) ?? '' });
async function open(seat, { seed = 7, stepped = true, keep = false, quality = 'std', ...size } = {}) {
  const page = await browser.open(`${url}#seed=${seed}&quality=${quality}`, { stepped, ...size });
  await page.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`);
  if (!keep) { await page.eval(`try { localStorage.clear() } catch {}`); await page.reload(); await page.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`); }
  if (stepped) await page.eval('__step(2)');
  await page.clickOn(`[data-seat="${seat}"]`); assert.equal(await page.eval('__dev02.mode()'), 'play');
  if (stepped) { await page.eval("document.getElementById('speed').click(); document.getElementById('speed').click(); __step(2)"); }
  page.snap = () => page.eval('__dev02.snapshot()');
  page.clickWorld = async (x, z, n = 1) => { const [a, b] = await page.eval(`__dev02.screen(${x}, ${z})`); await page.click(a, b, n); };
  page.done = async () => { assert.deepEqual(page.errors, []); await page.close(); };
  return page;
}
const same = async page => { const rec = await page.eval('__dev02.record()'), r = S.replay({ ...rec, ticks: (await page.snap()).tick }); assert.equal(r.final, await page.eval('__dev02.digest()'), 'Node 重跑與瀏覽器不同'); assert.deepEqual(r.log.length, (await page.eval('__dev02.log().length'))); return rec.commands.length; };

await test('四席：點信標購兵、HUD 與帳目相符、WASD 依鏡頭方向、數字鍵', async () => {
  for (const id of S.SEAT_IDS) {
    const page = await open(id); const [x, z] = S.padWorld(id, 0);
    assert.equal(await page.eval('__dev02.view()'), 'seat:' + id);
    let s = await page.snap(); const h = s.seats[id].commander;
    await page.clickWorld(x, z, 12); let first = 0;
    for (let i = 0; i < 90; i++) { await page.eval('__step(1)'); s = await page.snap(); if (!first && s.seats[id].buys) first = s.tick; if (Math.hypot(s.seats[id].commander.x - x, s.seats[id].commander.z - z) > S.RULES.padRadius) assert.equal(s.seats[id].spent, 0); }
    assert(first > 0); assert.equal(s.seats[id].gold + s.seats[id].spent, 12 + Math.floor(s.tick / 30)); assert.equal(+(await page.eval(`document.getElementById('gold').textContent`)), s.seats[id].gold);
    assert(Math.hypot(s.seats[id].commander.x - h.x, s.seats[id].commander.z - h.z) > 2);
    await page.clickWorld(...S.toWorld(id, .9, 0)); await page.eval('__step(60)');
    const at = async () => { const c = (await page.snap()).seats[id].commander; return page.eval(`__dev02.screen(${c.x}, ${c.z})`); };
    for (const [k, ax, sign] of [['d', 0, 1], ['a', 0, -1], ['w', 1, -1], ['s', 1, 1]]) { const a = await at(); await page.down(k); await page.eval('__step(8)'); await page.up(k); await page.eval('__step(2)'); const b = await at(), d = [b[0] - a[0], b[1] - a[1]]; assert(d[ax] * sign > 5 && Math.abs(d[1 - ax]) < Math.abs(d[ax]), `${id} ${k} 移動 ${d}`); }
    for (const i of [1, 2]) { await page.down(String(i + 1)); await page.up(String(i + 1)); await page.eval('__step(70)'); assert.equal((await page.snap()).seats[id].pad, i); }
    const n = (await page.eval('__dev02.record().commands.length')); await page.clickWorld(0, 0); await page.eval('__step(3)'); assert.equal(await page.eval('__dev02.record().commands.length'), n, '購買區外不應成為指令');
    await same(page); if (SHOTS && id === 'S') await page.shot(path.join(SHOTS, 'seatS.png')); await page.done();
  }
});
await test('從選席玩到終局（單步、真實輸入），重跑摘要一致', async () => {
  const page = await open('S', { seed: 20261126 }); let k = 0, shot = false;
  while (await page.eval('__dev02.mode()') === 'play') { const key = '1213'[k++ % 4]; await page.down(key); await page.up(key); await page.eval('__step(150)'); if (SHOTS && !shot && k === 10) { shot = true; await page.shot(path.join(SHOTS, 'battle-S.png')); await page.down('v'); await page.up('v'); await page.eval('__step(40)'); await page.shot(path.join(SHOTS, 'battle-team.png')); } assert(k < 400); }
  const s = await page.snap(), text = await page.eval(`document.getElementById('result').textContent`);
  assert.equal(text, s.winner === 'draw' ? '平手' : s.winner === 'B' ? '勝利' : '敗北'); const n = await same(page); if (SHOTS) await page.shot(path.join(SHOTS, 'end.png'));
  await page.clickOn('#restart'); await page.clickOn('[data-seat="N"]'); assert.equal(await page.eval("document.getElementById('speed').textContent"), '1×'); await page.eval('__step(20)'); const t = await page.snap(); assert(t.tick > 0 && t.tick < 60 && t.units.length === 0 && t.seats.N.hp === S.coreMax(S.VERSION)); await page.done();
  return `${text}，${(s.tick / 30).toFixed(0)} 秒、${n} 個指令`;
});
await test('暫停、視角、觀戰', async () => {
  const page = await open('E'); await page.eval('__step(60)'); await page.clickOn('#pause'); const a = await page.eval('__dev02.digest()'); await page.eval('__step(90)'); assert.equal(await page.eval('__dev02.digest()'), a);
  await page.clickOn('#pause'); await page.eval('__step(5)'); assert.notEqual(await page.eval('__dev02.digest()'), a);
  await page.clickOn('#view'); assert.equal(await page.eval('__dev02.view()'), 'team:B'); await page.clickOn('#view'); assert.equal(await page.eval('__dev02.view()'), 'seat:E'); await page.done();
  const w = await open('none', { seed: 3 }); for (let i = 0; i < 300 && await w.eval('__dev02.mode()') === 'play'; i++) await w.eval('__step(300)'); assert.equal(await w.eval('__dev02.mode()'), 'end'); await same(w); await w.done();
});
await test('方向鍵按下後、下一 tick 前暫停，暫停中放開：恢復後不移動、不扣款', async () => {
  for (const [via, key] of [['button', 'd'], ['space', 'w'], ['blur', 'a']]) for (const id of S.SEAT_IDS) {
    const page = await open(id); await page.eval('__step(10)');
    const before = await page.snap();
    if (via === 'blur') await page.clickOn('#opt-engineering');
    await page.down(key); // 尚未推進 tick
    if (via === 'button') await page.clickOn('#pause'); else if (via === 'space') { await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 }); } else await page.eval(`dispatchEvent(new Event('blur'))`);
    assert.equal(await page.eval('__dev02.mode()'), 'paused'); await page.eval('__step(30)'); await page.up(key); await page.eval('__step(30)');
    if (via === 'space') { await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 }); } else await page.clickOn('#pause');
    assert.equal(await page.eval('__dev02.mode()'), 'play'); await page.eval('__step(240)');
    const after = await page.snap(), a = before.seats[id], b = after.seats[id];
    assert.deepEqual([b.commander.x, b.commander.z, b.spent, b.buys, b.pad], [a.commander.x, a.commander.z, 0, 0, -1], `${via} ${id} 暫停後自行移動或扣款`);
    assert.equal(b.gold, 12 + Math.floor(after.tick / 30)); await same(page);
    // 正常行為仍在：恢復後再按方向鍵會移動
    await page.down(key); await page.eval('__step(10)'); await page.up(key); await page.eval('__step(2)'); const c = (await page.snap()).seats[id].commander;
    assert(Math.hypot(c.x - b.commander.x, c.z - b.commander.z) > 1, `${via} ${id} 恢復後按鍵應移動`); await page.done();
  }
  return '按鈕、空白鍵、失焦 × 四席';
});
await test('一般模式失焦：丟掉待處理輸入，停止方向移動，保留已生效點擊，維持手動暫停', async () => {
  const page = await open('N');
  const blur = () => page.eval("dispatchEvent(new Event('blur'))");
  const pos = async () => { const { x, z } = (await page.snap()).seats.N.commander; return [x, z]; };
  const initial = await pos();
  assert.equal(await page.eval('__dev02.display().engineering'), false);

  await page.down('d'); await blur(); await page.eval('__step(5)');
  assert.deepEqual(await pos(), initial, '失焦前尚未生效的方向鍵');
  await page.down('d', true); await page.eval('__step(5)');
  assert.deepEqual(await pos(), initial, '等待重新按下方向鍵');
  await page.up('d'); await page.down('d'); await page.eval('__step(5)');
  const moved = await pos(); assert.notDeepEqual(moved, initial);
  const beforeBlur = (await page.snap()).tick;
  await blur(); await page.eval('__step(5)'); await page.up('d');
  assert.deepEqual(await pos(), moved, '停止已生效的方向鍵');
  assert.equal((await page.snap()).tick, beforeBlur + 5);
  assert.equal(await page.eval('__dev02.mode()'), 'play');

  const pad = S.padWorld('N', 0);
  await page.clickWorld(...pad); await blur(); await page.eval('__step(5)');
  assert.deepEqual(await pos(), moved, '丟掉尚未生效的點擊');
  await page.clickWorld(...pad); await page.eval('__step(1)');
  const goal = (await page.snap()).seats.N.goal;
  assert(goal && Math.hypot(goal.x - pad[0], goal.z - pad[1]) < .25);
  await blur(); await page.eval('__step(45)');
  const destination = [goal.x, goal.z];
  assert.deepEqual(await pos(), destination, '保留已生效的點擊');
  assert((await page.snap()).seats.N.buys > 0);

  await page.clickOn('#pause'); const paused = (await page.snap()).tick;
  await blur(); await page.eval("__step(20); dispatchEvent(new Event('focus')); __step(20)");
  assert.equal(await page.eval('__dev02.mode()'), 'paused');
  assert.equal((await page.snap()).tick, paused);
  await page.clickOn('#pause'); await page.down('w'); await page.eval('__step(10)'); await page.up('w'); await page.eval('__step(1)');
  assert.notDeepEqual(await pos(), destination);
  await same(page); await page.done();
  return '合成 blur/focus；真實分頁另驗';
});
await test('工程模式獨立保存，切回焦點仍維持暫停', async () => {
  const page = await open('N');
  await page.clickOn('#opt-engineering');
  const expectOn = () => page.eval(`[__dev02.display().engineering, __dev02.display().bars, __dev02.display().log]`);
  assert.deepEqual(await expectOn(), [true, true, true]);
  await page.reload(); await page.until('!!window.__dev02 && !!document.querySelector("[data-seat]")');
  assert.deepEqual(await expectOn(), [true, true, true]);
  await page.eval('__step(2)'); await page.clickOn('[data-seat="N"]');
  await page.eval("dispatchEvent(new Event('blur')); dispatchEvent(new Event('focus')); __step(20)");
  assert.equal(await page.eval('__dev02.mode()'), 'paused');
  await page.clickOn('#opt-engineering'); assert.deepEqual(await expectOn(), [false, true, true]);
  assert.equal(await page.eval('__dev02.mode()'), 'paused');
  await page.done();
});
await test('顯示設定：血條與事件紀錄獨立切換、重開可見近期事件、跨局與重載保留、保存受限可玩', async () => {
  const D = p => p.eval('__dev02.display()'), hpShown = p => p.eval(`getComputedStyle(document.querySelector('.core .hp')).visibility`), nums = p => p.eval(`[...document.querySelectorAll('.core span')].map(e => e.textContent).join('|')`);
  const page = await open('W'); await page.eval('__step(400)');
  let d = await D(page); assert(d.bars && d.log && d.barsDrawn > 4 && !d.logShown && d.logRows > 3);
  await page.clickOn('#opt-engineering'); d = await D(page); assert(d.logShown); assert.equal(await hpShown(page), 'visible');
  const before = await page.eval('__dev02.digest()');
  await page.clickOn('#opt-bars'); await page.eval('__step(1)'); d = await D(page); assert(!d.bars && d.log && !d.barsDrawn && d.logShown); assert.equal(await hpShown(page), 'hidden'); assert.match(await nums(page), /我席 \d+/);
  await page.clickOn('#opt-log'); d = await D(page); assert(!d.bars && !d.log && !d.logShown); assert.equal(await page.eval(`document.getElementById('panel-title').textContent`), '暫定規則');
  await page.clickOn('#opt-bars'); await page.eval('__step(1)'); d = await D(page); assert(d.bars && !d.log && d.barsDrawn > 4 && !d.logShown, '血條與紀錄應各自獨立');
  await page.clickOn('#opt-engineering');
  const rows = d.logRows, msg = await page.eval(`document.getElementById('msg').textContent`); await page.clickWorld(...S.padWorld('W', 0)); await page.eval('__step(900)');
  assert.notEqual(await page.eval(`document.getElementById('msg').textContent`), msg, '即時提示應保留'); assert(await page.eval('__dev02.log().length') > rows);
  await page.clickOn('#opt-engineering'); await page.clickOn('#opt-log'); d = await D(page); assert(d.log && d.logShown && d.logRows > rows, '重開應看到關閉期間的事件');
  const first = await page.eval(`document.querySelector('#log .log time').textContent`), clock = await page.eval(`document.getElementById('clock').textContent`); assert(first <= clock && first >= '00:20', `最近一列 ${first}`);
  assert.notEqual(await page.eval('__dev02.digest()'), before); await same(page);
  await page.clickOn('#opt-log'); await page.clickOn('#again'); await page.clickOn('[data-seat="N"]'); await page.eval('__step(30)'); d = await D(page); assert(d.bars && !d.log, '重開一局應保留');
  await page.reload(); await page.until(`!!window.__dev02`); d = await D(page); assert(d.bars && !d.log, '重載應保留'); assert.equal(await page.eval(`document.getElementById('opt-log').textContent`), '事件紀錄：關');
  await page.done();
  const locked = await browser.open(`${url}#seed=7`, { stepped: true, prelude: `Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });` });
  await locked.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`); await locked.eval('__step(2)'); await locked.clickOn('[data-seat="E"]');
  d = await D(locked); assert(d.bars && d.log, '保存受限時用預設'); await locked.clickOn('#opt-bars'); await locked.clickOn('#opt-engineering'); await locked.clickOn('#opt-log'); await locked.eval('__step(300)'); d = await D(locked); assert(!d.bars && !d.log);
  assert((await locked.eval('__dev02.snapshot()')).tick >= 300); assert.deepEqual(locked.errors, []); await locked.close();
  return '關閉期間新增事件於重開後可見；localStorage 拋錯仍可玩';
});
await test('鍵盤操作設定：Space／Enter 連續切換、Tab 換開關，焦點留在按鈕且不暫停；點戰場後恢復操作', async () => {
  const page = await open('N'); await page.eval('__step(30)');
  const key = (key, code, vk, text) => page.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) }).then(() => page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk }));
  const space = () => key(' ', 'Space', 32, ' '), enter = () => key('Enter', 'Enter', 13, '\r'), tab = () => key('Tab', 'Tab', 9);
  const state = () => page.eval(`[document.activeElement.id, __dev02.mode(), __dev02.display().bars, __dev02.display().log]`);
  await page.eval(`document.getElementById('again').focus()`); await tab(); assert.deepEqual(await state(), ['opt-bars', 'play', true, true]);
  await space(); await page.eval('__step(1)'); assert.deepEqual(await state(), ['opt-bars', 'play', false, true]);
  await space(); await space(); await page.eval('__step(1)'); assert.deepEqual(await state(), ['opt-bars', 'play', false, true], '連按三次');
  await enter(); await page.eval('__step(1)'); assert.deepEqual(await state(), ['opt-bars', 'play', true, true]);
  await tab(); assert.deepEqual(await state(), ['opt-quality', 'play', true, true]);
  await tab(); assert.deepEqual(await state(), ['opt-surface', 'play', true, true]);
  await tab(); assert.deepEqual(await state(), ['opt-engineering', 'play', true, true]); await space();
  await tab(); assert.deepEqual(await state(), ['panel-title', 'play', true, true]);
  await tab(); assert.deepEqual(await state(), ['opt-log', 'play', true, true]); await space(); await enter(); await space(); await page.eval('__step(1)'); assert.deepEqual(await state(), ['opt-log', 'play', true, false]);
  await page.clickOn('#opt-engineering');
  const t = (await page.snap()).tick; await page.eval('__step(30)'); assert.equal((await page.snap()).tick, t + 30, '對局不應暫停');
  const c = (await page.snap()).seats.N.commander, [x, y] = await page.eval(`__dev02.screen(${c.x}, ${c.z})`); await page.click(x, y);
  assert.equal(await page.eval('document.activeElement.id'), 'stage'); await page.down('d'); await page.eval('__step(10)'); await page.up('d'); await page.eval('__step(2)');
  const m = (await page.snap()).seats.N.commander; assert(Math.hypot(m.x - c.x, m.z - c.z) > 1, '點戰場後方向鍵應移動');
  await space(); assert.equal(await page.eval('__dev02.mode()'), 'paused', '戰場有焦點時 Space 仍暫停'); await space(); assert.equal(await page.eval('__dev02.mode()'), 'play');
  await page.clickOn('#opt-bars'); assert.equal(await page.eval('document.activeElement.id'), 'stage', '滑鼠點擊後焦點回戰場'); await same(page); await page.done();
});
await test('地表材質（標準畫質下）：原始預設、同局切換四級不影響模擬、跨局與重載保留、載入失敗回原始', async () => {
  const page = await open('W'); await page.eval('__step(300)'); const sf = () => page.eval('__dev02.surface()');
  assert.equal((await sf()).active, 'orig'); assert.equal(await page.eval(`document.getElementById('opt-surface').textContent`), '地表：原始');
  const ref = await browser.open(`${url}#seed=7`, { stepped: true }); // 對照組：不切換
  await ref.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`); await ref.eval('__step(2)'); await ref.clickOn('[data-seat="W"]'); await ref.eval("document.getElementById('speed').click(); document.getElementById('speed').click(); __step(2)"); await ref.eval('__step(300)');
  for (const want of ['std', 'hi', 'max', 'orig', 'std']) { await page.clickOn('#opt-surface'); await page.until(`!__dev02.surface().busy`); assert.equal((await sf()).active, want); await page.eval('__step(60)'); await ref.eval('__step(60)'); }
  assert.equal(await page.eval('__dev02.digest()'), await ref.eval('__dev02.digest()'), '切換材質不應影響模擬'); await same(page); await ref.close();
  await page.clickOn('#again'); await page.clickOn('[data-seat="S"]'); await page.eval('__step(5)'); assert.equal((await sf()).active, 'std', '重開一局保留');
  await page.reload(); await page.until(`!!window.__dev02 && !__dev02.surface().busy && __dev02.surface().active === 'std'`); await page.done();
  const broken = await browser.open(`${url}#seed=7&surface=hi`, { stepped: true, prelude: `{ const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(HTMLImageElement.prototype, 'src', { set(v) { d.set.call(this, String(v).startsWith('data:image/jpeg') ? 'data:image/jpeg;base64,AAAA' : v); }, get() { return d.get.call(this); } }); }` });
  await broken.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`); await broken.eval('__step(2)'); await broken.until(`!__dev02.surface().busy`);
  assert.equal((await broken.eval('__dev02.surface()')).active, 'orig', '失敗應回原始'); assert.match(await broken.eval(`document.getElementById('msg').textContent`), /回原始材質/);
  await broken.clickOn('[data-seat="E"]'); await broken.eval('__step(300)'); assert((await broken.eval('__dev02.snapshot()')).tick >= 300);
  assert.deepEqual(broken.errors, []); await broken.close();
  const fast = await open('N'); await fast.eval(`for (let i = 0; i < 6; i++) document.getElementById('opt-surface').click()`); // 連按 6 次：orig→std→hi→max→orig→std→hi
  await fast.until(`!__dev02.surface().busy`); assert.equal((await fast.eval('__dev02.surface()')).active, 'hi');
  assert.equal(await fast.eval(`document.getElementById('opt-surface').textContent`), '地表：高解析');
  await fast.eval(`location.hash = 'seed=7&surface=std'`); await fast.reload(); await fast.until(`!!window.__dev02 && !__dev02.surface().busy && __dev02.surface().active === 'std'`);
  await fast.clickOn('#opt-bars'); assert.equal(JSON.parse(await fast.eval(`localStorage.getItem('battle_craft.dev02.display')`)).surface, 'hi', '網址參數不應改寫保存的偏好'); await fast.done();
  return '同局四次切換後摘要與對照組一致；壞圖時回原始且可玩';
});
await test('畫質：高細節預設、模型與場景層切換、解析度、不改模擬、跨重載保留、素材失敗回退', async () => {
  const page = await browser.open(`${url}#seed=7`, { stepped: true }); const ready = p => p.until(`!!window.__dev02 && !__dev02.surface().busy && __dev02.quality().props.status !== 'loading'`, 60000);
  await ready(page); await page.eval('localStorage.clear()'); await page.reload(); await ready(page); await page.eval('__step(2)'); await page.clickOn('[data-seat="W"]'); await page.eval("document.getElementById('speed').click(); document.getElementById('speed').click(); __step(2)"); await page.eval('__step(600)');
  const q = () => page.eval('__dev02.quality()'), tri = () => page.eval('__dev02.info().bodyTriangles'), sf = () => page.eval('__dev02.surface().active');
  let v = await q(); assert.deepEqual([v.active, v.sceneVisible, v.props.status, v.props.count, v.pixelRatio, await sf()], ['high', true, 'ready', 12, 1.5, 'max']); assert.deepEqual(await tri(), { marine: 380, ...highTri, commander: 372 });
  const ref = await open('W'); await ref.eval('__step(600)');
  for (let i = 0; i < 3; i++) { await page.clickOn('#opt-quality'); await ready(page); await page.eval('__step(60)'); await ref.eval('__step(60)'); }
  v = await q(); assert.deepEqual([v.active, v.sceneVisible, v.pixelRatio, await sf()], ['std', false, 1, 'orig']); assert.deepEqual(await tri(), { marine: 92, ...stdTri, commander: 92 });
  while ((await ref.snap()).tick < (await page.eval('__dev02.snapshot().tick'))) await ref.eval('__step(1)');
  if ((await ref.snap()).tick === (await page.eval('__dev02.snapshot().tick'))) assert.equal(await page.eval('__dev02.digest()'), await ref.eval('__dev02.digest()'), '畫質切換不應影響模擬'); else assert.fail('tick 未對齊');
  await ref.done(); await page.reload(); await ready(page); assert.equal((await q()).active, 'std', '重載保留');
  await page.eval(`localStorage.setItem('battle_craft.dev02.display', JSON.stringify({ bars: true, log: true, surface: 'orig' }))`); await page.reload(); await ready(page); assert.deepEqual([(await q()).active, await sf()], ['high', 'max'], '舊版保存值不覆蓋高細節預設');
  assert.deepEqual(page.errors, []); await page.close();
  const broken = await browser.open(`${url}#seed=7`, { stepped: true, prelude: `localStorage.clear(); { const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(HTMLImageElement.prototype, 'src', { set(v) { d.set.call(this, String(v).startsWith('data:image/jpeg') ? 'data:image/jpeg;base64,AAAA' : v); }, get() { return d.get.call(this); } }); } window.Worker = class { constructor() { throw new Error('blocked'); } };` });
  await broken.until(`!!window.__dev02 && !__dev02.surface().busy && __dev02.quality().props.status !== 'loading'`, 60000); await broken.eval('__step(2)'); await broken.clickOn('[data-seat="N"]'); await broken.eval('__step(300)');
  assert.deepEqual([(await broken.eval('__dev02.surface().active')), (await broken.eval('__dev02.quality().props.status'))], ['orig', 'failed']); assert((await broken.eval('__dev02.snapshot().tick')) >= 300); await broken.close();
  return '預設高細節；三次切換摘要與對照一致；壞圖與配件解碼失敗仍可玩';
});
await test('橫式設定按鈕不遮擋：844×390、1280×720 兩種開關組合', async () => {
  for (const [w, h] of [[844, 390], [1280, 720], [1600, 900]]) for (const flip of [false, true]) {
    const page = await open('S', { w, h }); if (flip) { await page.clickOn('#opt-bars'); await page.clickOn('#opt-engineering'); } await page.eval('__step(200)');
    const box = await page.eval(`(() => { const r = id => document.getElementById(id).getBoundingClientRect(), hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const opts = ['opt-bars', 'opt-log', 'opt-quality', 'opt-surface', 'opt-engineering'].map(r).filter(x => x.width), others = ['shop', 'msg'].map(r).filter(x => x.width);
      return { inView: opts.every(o => o.top >= 0 && o.bottom <= innerHeight && o.left >= 0 && o.right <= innerWidth), overlap: opts.some(o => others.some(x => hit(o, x))), bar: r('bar').bottom, h: innerHeight }; })()`);
    assert(box.inView && !box.overlap, `${w}x${h} ${JSON.stringify(box)}`); await page.clickOn('#framing'); assert(await page.eval('__dev02.inside()'), `${w}x${h} 取景`);
    if (SHOTS && w === 844) await page.shot(path.join(SHOTS, `display-phone-${flip ? 'off' : 'on'}.png`)); await page.done();
  }
});
await test('取景：桌面與橫式手機四席與隊伍視角皆在安全區內', async () => {
  for (const [w, h] of [[1600, 900], [1280, 720], [844, 390]]) for (const id of S.SEAT_IDS) {
    const page = await open(id, { w, h });
    assert.equal(await page.eval('__dev02.framing()'), 'near');
    for (const i of [0, 1, 2]) {
      if (i === 1) { await page.clickOn('#view'); await page.eval('__step(40)'); }
      const pad = S.padWorld(id, i);
      assert(await page.eval(`(() => { const [x,y] = __dev02.screen(${pad[0]}, ${pad[1]}); return document.elementFromPoint(x,y)?.id === 'stage'; })()`), `${w}x${h} ${id}, 近景信標 ${i + 1}`);
      await page.clickWorld(...pad); await page.eval('__step(60)');
      assert.equal((await page.snap()).seats[id].pad, i);
      await page.clickOn('#framing'); await page.eval('__step(1)');
      assert.equal(await page.eval('__dev02.framing()'), 'overview');
      assert(await page.eval('__dev02.inside()'), `${w}x${h} ${id}, 四席全景`);
      await page.clickOn('#framing'); await page.eval('__step(1)');
    }
    if (SHOTS && w === 844 && id === 'W') await page.shot(path.join(SHOTS, 'phone-W.png'));
    await page.done();
  }
});
await test('即時模式 4 倍速：玩家不動至終局，重跑摘要一致', async () => {
  const page = await open('N', { seed: 5, stepped: false }); assert.equal(await page.eval("document.getElementById('speed').textContent"), '1×'); await page.clickOn('#speed'); assert.equal(await page.eval("document.getElementById('speed').textContent"), '2×');
  await page.until(`__dev02.mode() === 'end'`, 90000); assert.equal(await page.eval(`document.getElementById('result').textContent`), '敗北'); await same(page); const s = await page.snap(); await page.done(); return `${(s.tick / 30).toFixed(0)} 秒`;
});
await test('BC01：四席各買三兵種；模型、盾條、飛行中光球與彈體可見；暫停凍結；圖卡三兵種', async () => {
  const page = await open('none', { seed: 11 });
  const seen = { dragoon: false, mutalisk: false }, bought = new Set(); let frozen = false;
  for (let i = 0; i < 4000 && await page.eval('__dev02.mode()') === 'play'; i++) {
    await page.eval('__step(4)');
    const [shots, drawn, units, info] = await page.eval(`[__dev02.mode() === 'end' ? [] : __dev02.snapshot().shots, __dev02.info().projectiles, __dev02.snapshot().units, __dev02.info().drawn]`);
    for (const u of units) bought.add(u.seat + u.kind);
    for (const k of ['marine', 'dragoon', 'mutalisk']) assert.equal(info[k], units.filter(u => u.kind === k).length, `${k} 繪製數`);
    for (const k of ['dragoon', 'mutalisk']) { assert.equal(drawn[k], shots.filter(s => s.kind === k).length, `${k} 投射物`); if (drawn[k]) seen[k] = true; }
    if (!frozen && drawn.dragoon && drawn.mutalisk) {
      frozen = true; if (SHOTS) await page.shot(path.join(SHOTS, 'projectiles.png'));
      await page.clickOn('#pause'); const a = await page.eval('JSON.stringify(__dev02.snapshot().shots)'); await page.eval('__step(40)'); assert.equal(await page.eval('JSON.stringify(__dev02.snapshot().shots)'), a); assert.equal((await page.eval('__dev02.info().projectiles')).dragoon, drawn.dragoon);
      await page.clickOn('#pause'); await page.eval('__step(20)'); assert.notEqual(await page.eval('JSON.stringify(__dev02.snapshot().shots)'), a);
    }
  }
  assert(frozen && seen.dragoon && seen.mutalisk); assert.equal(bought.size, 12, `四席三兵種 ${[...bought]}`); assert.equal(await page.eval('__dev02.mode()'), 'end'); await page.eval('__step(2)'); assert.deepEqual(await page.eval('__dev02.info().projectiles'), { dragoon: 0, mutalisk: 0 }, '終局不留投射物'); await same(page); await page.done();
  // seed 1 觀戰終局時仍有飛行中的投射物
  const left = await open('none', { seed: 1 }); for (let i = 0; i < 300 && await left.eval('__dev02.mode()') === 'play'; i++) await left.eval('__step(300)'); await left.eval('__step(2)'); assert((await left.eval('__dev02.snapshot().shots.length')) > 0); assert.deepEqual(await left.eval('__dev02.info().projectiles'), { dragoon: 0, mutalisk: 0 }); await left.done();
  for (const quality of ['std', 'high']) {
    const card = await open('N', { quality });
    for (const [kind, name, attack] of [['marine', '陸戰隊', '普通'], ['dragoon', '重騎兵', '指向性爆炸'], ['mutalisk', '飛螳', '彈跳']]) {
      await card.clickOn(`[data-profile="${kind}"]`); const text = await card.eval(`document.getElementById('dossier').innerText`); assert(text.includes(name) && text.includes(attack), text);
      if (SHOTS) await card.shot(path.join(SHOTS, `dossier-${quality}-${kind}.png`));
    }
    await card.done();
  }
  for (const [w, h] of [[844, 390], [1600, 900]]) { const p = await open('S', { w, h, quality: 'high', seed: 11 }); await p.eval('__step(30)'); for (let i = 0; i < 22; i++) { await p.down('123'[i % 3]); await p.up('123'[i % 3]); await p.eval('__step(60)'); } if (SHOTS) await p.shot(path.join(SHOTS, `battle-${w}.png`));
    assert(await p.eval(`(() => { const r = e => e.getBoundingClientRect(); return [...document.querySelectorAll('#shop button, #dossier nav button')].filter(b => r(b).width).every(b => r(b).left >= 0 && r(b).right <= innerWidth && r(b).bottom <= innerHeight); })()`), `${w} 按鈕在視窗內`); await p.done(); }
  return '12 組席位×兵種；投射物數與狀態一致';
});
await sleep(50); await browser.close();
console.table(rows); console.log(`DEV02 browser QA: OK (${browser.angle})`);
