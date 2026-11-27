// 播放行為驗收（純 Node）：以可手動完成 suspend／resume 的假 AudioContext 檢查非同步窗口、暫停、隱藏與恢復。
import assert from 'node:assert/strict';
import { createAudio } from './audio.js';

const pending = [], sources = [];
const settle = async () => { for (let i = 0; i < 8; i++) { pending.splice(0).forEach(f => f()); await Promise.resolve(); await Promise.resolve(); } };
const node = () => ({ gain: { value: 1 }, connected: false, connect(to) { this.connected = true; this.to = to; return to; }, disconnect() { this.connected = false; } });
let made;
class Context {
  constructor() { made = this; }
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
const interrupt = () => { made.state = 'interrupted'; made.onstatechange(); };
const silenced = old => { assert(stoppedAll(old), '舊來源應已停'); assert(old.every(s => !s.to.connected), '舊音效增益應已斷開'); assert.equal(audio.info().voices, 0); assert.equal(music()[0].stopped, 0); };
await test('系統中斷：事件一到就清掉舊音效（不靠任何輸入），之後輸入恢復不續播', async () => {
  fire(); const old = effects().slice(-3); assert.equal(audio.info().voices, 3); interrupt(); silenced(old); // 必須在 unlock 之前成立
  const count = sources.length; fire(); assert.equal(sources.length, count, '中斷中不啟動');
  audio.unlock(); await settle(); assert.equal(audio.info().state, 'running'); silenced(old); assert.equal(sources.length, count);
});
await test('系統自行恢復（沒有輸入、不呼叫 unlock／sync）：舊音效不續播，新音效照常', async () => {
  fire(); const old = effects().slice(-3); assert.equal(audio.info().voices, 3); interrupt(); silenced(old);
  const count = sources.length; made.state = 'running'; made.onstatechange(); await Promise.resolve();
  silenced(old); assert.equal(sources.length, count); assert(old.every(s => s.started === 1));
  fire(); assert.equal(sources.length, count + 3); const next = effects().slice(-3); assert(next.every(s => s.stopped === 0)); made.onstatechange(); assert.equal(audio.info().voices, 3, 'running 事件不清新音效'); audio.stopEffects();
});
await test('漏掉中斷事件時，輸入恢復前的 sync 仍清掉舊音效', async () => {
  fire(); const old = effects().slice(-3); made.state = 'interrupted'; audio.unlock(); await settle(); assert.equal(audio.info().state, 'running'); silenced(old);
});
// 曲檔：以假的離線 context 控制解碼成功或失敗；開場 200 毫秒後才解碼
const wait = ms => new Promise(done => setTimeout(done, ms));
const fakeTrack = (frames = 44100) => { const ch = [new Float32Array(frames), new Float32Array(frames)]; ch[0].fill(.3, 1000, frames - 500); return { numberOfChannels: 2, sampleRate: 44100, duration: frames / 44100, getChannelData: i => ch[i] }; };
let decodes = 0, decodeResult;
window.OfflineAudioContext = class { decodeAudioData(bytes) { decodes++; assert(bytes instanceof ArrayBuffer && bytes.byteLength > 0); return decodeResult(); } };
const fresh = async (lv, ok) => {
  decodeResult = ok ? () => Promise.resolve(fakeTrack()) : () => Promise.reject(new Error('壞檔')); const warn = console.warn; console.warn = () => {};
  const before = sources.length, a = createAudio(lv, { track: btoa('ID3fake') }); a.unlock(); await settle(); await wait(250); await settle(); console.warn = warn;
  return { a, mine: () => sources.slice(before).filter(s => s.loop) };
};
await test('曲檔解碼成功：播放曲檔、略過頭尾補零設循環區間、從循環起點開始、只有一條', async () => {
  const n = decodes, { a, mine } = await fresh({ music: 2, sfx: 2 }, true); assert.equal(decodes, n + 1); assert.equal(a.info().musicSource, 'track'); assert(a.info().musicStarted);
  const [m] = mine(); assert.equal(mine().length, 1); assert.equal(m.loopStart, 1000 / 44100); assert.equal(m.loopEnd, (44100 - 500) / 44100); assert.equal(m.started, 1);
  a.sync(); await settle(); assert.equal(mine().length, 1, 'sync 不重啟');
});
await test('曲檔解碼失敗：退回合成音樂，仍只有一條', async () => {
  const { a, mine } = await fresh({ music: 2, sfx: 2 }, false); assert.equal(a.info().musicSource, 'synth'); assert.equal(mine().length, 1); assert(a.info().musicStarted);
});
await test('音樂關閉時不解碼；打開後才解碼並播放', async () => {
  const lv = { music: 0, sfx: 2 }, n = decodes, { a, mine } = await fresh(lv, true); assert.equal(decodes, n); assert.equal(a.info().musicSource, 'idle'); assert.equal(mine().length, 0);
  lv.music = 2; a.sync(); await settle(); assert.equal(decodes, n + 1); assert.equal(a.info().musicSource, 'track'); assert.equal(mine().length, 1);
});
console.table(rows); console.log('audio playback QA: OK');
