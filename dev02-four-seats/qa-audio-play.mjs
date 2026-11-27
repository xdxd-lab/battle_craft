// 播放行為驗收（純 Node）：以可手動完成 suspend／resume 的假 AudioContext 檢查非同步窗口、暫停、隱藏與恢復。
import assert from 'node:assert/strict';
import { createAudio, MUSIC_FADE } from './audio.js';

const pending = [], sources = [];
const settle = async () => { for (let i = 0; i < 8; i++) { pending.splice(0).forEach(f => f()); await Promise.resolve(); await Promise.resolve(); } };
const node = () => ({ gain: { value: 1, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.ramp = v; } }, connected: false, connect(to) { this.connected = true; this.to = to; return to; }, disconnect() { this.connected = false; } });
let made;
class Context {
  constructor() { made = this; }
  state = 'suspended'; destination = node(); currentTime = 0;
  createGain() { return node(); }
  createBuffer(_, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
  createBufferSource() { const s = { ...node(), started: 0, stopped: 0, loop: false, playbackRate: { value: 1 }, start(when, offset) { this.started++; this.offset = offset; }, stop(when) { this.stopped++; this.stopAt = when; } }; sources.push(s); return s; }
  to(state) { return new Promise(done => pending.push(() => { this.state = state; done(); })); } // state 於稍後才更新
  resume() { return this.to('running'); }
  suspend() { return this.to('suspended'); }
}
let clock = 0;
const fakeTrack = (frames = 44100) => { const ch = [new Float32Array(frames), new Float32Array(frames)]; ch[0].fill(.3, 1000, frames - 500); return { numberOfChannels: 2, sampleRate: 44100, duration: frames / 44100, getChannelData: i => ch[i] }; };
let decodes = 0, decodeResult = () => Promise.resolve(fakeTrack());
class Offline { decodeAudioData(bytes) { decodes++; assert(bytes instanceof ArrayBuffer && bytes.byteLength > 0); return decodeResult(new TextDecoder().decode(bytes)); } }
const T = (id, phase) => ({ id, phase, title: id.toUpperCase(), author: 'test', license: 'CC0', data: btoa(id) });
const TRACKS = [T('o1', 'opening'), T('o2', 'opening'), T('o3', 'opening'), T('b1', 'battle'), T('b2', 'battle')];
globalThis.window = { AudioContext: Context, OfflineAudioContext: Offline };
globalThis.document = { hidden: false };
Object.defineProperty(globalThis, 'performance', { value: { now: () => clock += 100 }, configurable: true });

const rows = [], test = async (name, fn) => { await fn(); rows.push({ 案例: name }); };
const levels = { music: 2, sfx: 2 }, audio = createAudio(levels, { tracks: TRACKS, random: () => 0 });
audio.setPhase('opening'); audio.unlock(); await settle();
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
// 曲目與階段：random 依序取值決定選曲；解碼以假的離線 context 立即完成或失敗
const run = async (lv, seq = [0], opts = {}) => {
  let k = 0; const shown = [], before = sources.length, warn = console.warn; console.warn = () => {};
  const a = createAudio(lv, { tracks: TRACKS, random: () => seq[k++ % seq.length], onTrack: t => shown.push(t?.id ?? null), ...opts }); a.unlock(); await settle();
  const mine = () => sources.slice(before).filter(s => s.loop), restore = () => { console.warn = warn; };
  return { a, mine, shown, restore };
};
await test('開場：隨機選一首開場曲，解碼後播放；略過頭尾補零設循環區間、從循環起點開始；sync 不重啟', async () => {
  const { a, mine, shown, restore } = await run({ music: 2, sfx: 2 }, [.5]); a.setPhase('opening'); await settle(); restore();
  assert.deepEqual([a.info().phase, a.info().track, a.info().musicSource], ['opening', 'o2', 'track']);
  const [m] = mine(); assert.equal(mine().length, 1); assert.equal(m.loopStart, 1000 / 44100); assert.equal(m.loopEnd, (44100 - 500) / 44100); assert.equal(m.offset, m.loopStart);
  a.sync(); a.setPhase('opening'); await settle(); assert.equal(mine().length, 1, '同階段不重啟'); assert.deepEqual(shown, ['o2']);
});
await test('激戰：只切一次、交叉淡入（舊曲排程停止、新曲漸強）；舊曲播完即釋放解碼；再呼叫不換曲', async () => {
  const { a, mine, shown, restore } = await run({ music: 2, sfx: 2 }, [0, .99]); a.setPhase('opening'); await settle();
  const [old] = mine(); a.setPhase('battle'); await settle(); restore();
  assert.deepEqual([a.info().phase, a.info().track], ['battle', 'b2']); assert.equal(mine().length, 2);
  assert.equal(old.stopped, 1); assert.equal(old.stopAt, MUSIC_FADE, '舊曲淡出後停'); assert.equal(mine()[1].to.gain.ramp, 1, '新曲漸強');
  assert.deepEqual(a.info().decoded.sort(), ['b2', 'o1']); old.onended(); assert.deepEqual(a.info().decoded, ['b2'], '淡出完成後釋放舊曲');
  a.setPhase('battle'); await settle(); assert.equal(mine().length, 2); assert.equal(a.info().switches, 2); assert.deepEqual(shown, ['o1', 'b2']);
});
await test('新的一局：重新隨機選開場曲並交叉換曲', async () => {
  const { a, restore } = await run({ music: 2, sfx: 2 }, [0, 0, .7]); a.setPhase('opening'); await settle(); a.setPhase('battle'); await settle();
  a.setPhase('opening', true); await settle(); restore(); assert.deepEqual([a.info().phase, a.info().track], ['opening', 'o3']);
});
await test('解碼失敗：改選同階段其他曲；同階段全壞則不播音樂、不出錯', async () => {
  decodeResult = id => id === 'o1' ? Promise.reject(new Error('壞檔')) : Promise.resolve(fakeTrack());
  let r = await run({ music: 2, sfx: 2 }, [0]); r.a.setPhase('opening'); await settle(); r.restore(); assert.equal(r.a.info().track, 'o2');
  decodeResult = () => Promise.reject(new Error('壞檔'));
  r = await run({ music: 2, sfx: 2 }, [0]); r.a.setPhase('opening'); await settle(); r.restore(); assert.deepEqual([r.a.info().track, r.a.info().musicSource, r.mine().length], [null, 'none', 0]);
  decodeResult = () => Promise.resolve(fakeTrack());
});
await test('開場正播時切激戰、激戰曲全解碼失敗：舊開場曲立即停、不再出聲', async () => {
  decodeResult = () => Promise.resolve(fakeTrack());
  const { a, mine, shown, restore } = await run({ music: 2, sfx: 2 }, [0, 0]); a.setPhase('opening'); await settle();
  assert.equal(a.info().track, 'o1'); const opening = mine()[0];
  decodeResult = id => id.startsWith('b') ? Promise.reject(new Error('壞檔')) : Promise.resolve(fakeTrack());
  a.setPhase('battle'); await settle(); restore();
  assert.deepEqual([a.info().phase, a.info().track, a.info().wanted, a.info().musicSource], ['battle', null, null, 'none']);
  assert.equal(opening.stopped, 1, '舊開場曲停止'); assert.equal(mine().length, 1, '沒有新的音樂來源'); assert.equal(shown.at(-1), null, '曲名列清空');
  decodeResult = () => Promise.resolve(fakeTrack());
});
await test('音樂關閉：不解碼、不播放；播放中關閉立即停止；再打開重新播放同一首', async () => {
  const lv = { music: 0, sfx: 2 }, n = decodes, { a, mine, shown, restore } = await run(lv, [0]); a.setPhase('opening'); await settle();
  assert.equal(decodes, n); assert.equal(a.info().musicSource, 'off'); assert.equal(mine().length, 0);
  lv.music = 2; a.sync(); await settle(); assert.equal(decodes, n + 1); assert.equal(a.info().track, 'o1'); assert.equal(mine().length, 1);
  lv.music = 0; a.sync(); assert.equal(mine()[0].stopped, 1, '關閉立即停'); assert.equal(a.info().track, null);
  lv.music = 1; a.sync(); await settle(); restore(); assert.equal(mine().length, 2); assert.equal(a.info().track, 'o1'); assert.equal(decodes, n + 1, '不重複解碼');
  assert.deepEqual(shown, ['o1', null, 'o1'], '曲名顯示跟著開關');
});
await test('聲部滿載：未發聲的兵種搶占最擁擠兵種的最舊聲部；已在發聲的兵種與平均分配時照舊略過', async () => {
  const a = createAudio({ music: 0, sfx: 2 }); a.unlock(); await settle();
  const start = sources.length, mine = () => sources.slice(start);
  for (const k of ['marine', 'dragoon', 'marine', 'dragoon', 'marine', 'dragoon']) a.play(k);
  assert.equal(a.info().voices, 6); const oldest = mine()[0];
  a.play('mutalisk'); assert.equal(a.info().voices, 6); assert.equal(a.info().stolen, 1); assert.equal(oldest.stopped, 1, '最舊的陸戰隊被停');
  assert.equal(a.info().played.mutalisk, 1);
  const d = a.info().dropped; a.play('mutalisk'); a.play('dragoon'); assert.equal(a.info().dropped, d + 2, '已在發聲的兵種滿載時略過'); assert.equal(a.info().stolen, 1);
  a.play('hydralisk'); a.play('archon'); a.play('wraith'); assert.equal(a.info().voices, 6); assert.equal(a.info().stolen, 4);
  const d2 = a.info().dropped; a.play('marine'); assert.equal(a.info().dropped, d2 + 1, '各兵種僅一聲部時不再搶占'); a.stopEffects();
});
console.table(rows); console.log('audio playback QA: OK');
