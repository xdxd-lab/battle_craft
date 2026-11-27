// 播放行為驗收（純 Node）：以可手動完成 suspend／resume 的假 AudioContext 檢查非同步窗口、暫停、隱藏與恢復。
import assert from 'node:assert/strict';
import { createAudio } from './audio.js';

const pending = [], sources = [];
const settle = async () => { for (let i = 0; i < 8; i++) { pending.splice(0).forEach(f => f()); await Promise.resolve(); await Promise.resolve(); } };
const node = () => ({ gain: { value: 1 }, connected: false, connect(to) { this.connected = true; return to; }, disconnect() { this.connected = false; } });
class Context {
  state = 'suspended'; destination = node();
  createGain() { return node(); }
  createBuffer(_, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
  createBufferSource() { const s = { ...node(), started: 0, stopped: 0, loop: false, playbackRate: { value: 1 }, start() { this.started++; }, stop() { this.stopped++; } }; sources.push(s); return s; }
  to(state) { return new Promise(done => pending.push(() => { this.state = state; done(); })); } // state 於稍後才更新
  resume() { return this.to('running'); }
  suspend() { return this.to('suspended'); }
}
let clock = 0;
globalThis.window = { AudioContext: Context };
globalThis.document = { hidden: false };
Object.defineProperty(globalThis, 'performance', { value: { now: () => clock += 100 }, configurable: true });

const rows = [], test = async (name, fn) => { await fn(); rows.push({ 案例: name }); };
const levels = { music: 2, sfx: 2 }, audio = createAudio(levels);
audio.unlock(); await settle();
const music = () => sources.filter(s => s.loop), effects = () => sources.filter(s => !s.loop);
const fire = () => ['marine', 'dragoon', 'mutalisk'].forEach(k => audio.play(k));
const stoppedAll = list => list.every(s => s.stopped === 1);

for (const [name, enter, leave] of [
  ['暫停', () => audio.setPaused(true), () => audio.setPaused(false)],
  ['分頁隱藏', () => { document.hidden = true; audio.sync(); }, () => { document.hidden = false; audio.sync(); }],
]) await test(`${name}：窗口內不新啟動、舊音效立即停掉、恢復不續播、音樂只有一條且不重啟`, async () => {
  fire(); const old = effects().slice(-3); assert.equal(audio.info().voices, 3);
  enter(); assert.equal(audio.info().state, 'running', '尚在 suspend 非同步窗口');
  assert(stoppedAll(old)); assert.equal(audio.info().voices, 0);
  const count = sources.length; fire(); assert.equal(sources.length, count, '窗口內不得啟動'); audio.unlock(); fire(); assert.equal(sources.length, count);
  await settle(); assert.equal(audio.info().state, 'suspended'); fire(); assert.equal(sources.length, count);
  for (const s of old) s.onended(); assert.equal(audio.info().voices, 0, '遲到的 ended 不重複扣');
  leave(); fire(); assert.equal(sources.length, count, 'resume 完成前不播'); await settle();
  assert.equal(audio.info().state, 'running'); assert.equal(sources.length, count); assert(stoppedAll(old));
  assert.deepEqual(music().map(s => [s.started, s.stopped]), [[1, 0]]);
  fire(); assert.equal(sources.length, count + 3); assert.equal(audio.info().voices, 3); audio.stopEffects();
});
await test('隱藏中解除暫停仍靜止；暫停中回到前景仍靜止', async () => {
  audio.setPaused(true); document.hidden = true; audio.sync(); audio.setPaused(false); await settle(); assert.equal(audio.info().state, 'suspended');
  audio.setPaused(true); document.hidden = false; audio.sync(); await settle(); assert.equal(audio.info().state, 'suspended');
  audio.setPaused(false); await settle(); assert.equal(audio.info().state, 'running');
});
await test('快速切換只以最後狀態為準', async () => {
  for (const last of [true, false]) { for (let i = 0; i < 7; i++) audio.setPaused(i % 2 === 0 ? last : !last); await settle(); assert.equal(audio.info().state, last ? 'suspended' : 'running'); }
});
await test('關閉音效即停掉發聲中的音效，音樂不受影響；再開局清空', async () => {
  fire(); const old = effects().slice(-3); levels.sfx = 0; audio.sync(); assert(stoppedAll(old)); assert.equal(audio.info().voices, 0); levels.sfx = 2; audio.sync(); await settle();
  fire(); const next = effects().slice(-3); audio.stopEffects(); assert(stoppedAll(next)); assert.equal(audio.info().voices, 0); assert.equal(music()[0].stopped, 0);
});
console.table(rows); console.log('audio playback QA: OK');
