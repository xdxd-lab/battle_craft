// 瀏覽器端播放：互動後才建立 AudioContext；音樂、音效分開調整；限制同時聲部與觸發間隔。只讀事件，不影響模擬。
// 背景音樂優先用內嵌的 CC0 循環曲（呼叫端傳入 base64 MP3），解碼失敗或未提供時改用程序合成。
import { RATE, SOUNDS, renderSound, renderMusic } from './audio-synth.mjs';

export const LEVEL_NAMES = ['關', '小', '中', '大'];
const GAIN = [0, .3, .6, 1];
const MIX = { music: .4, sfx: .5 };
export const LIMIT = { total: 6, perKind: 3, gap: .07 }; // 同時聲部、單一兵種聲部、同兵種最短間隔（實際秒數，不隨遊戲倍速）

export const TRIM_LIMIT = 2400; // 解碼後頭尾最多略過的靜音 frame（MP3 編碼器補零），約 50 毫秒
// 找出循環區間：略過頭尾近乎無聲的補零，最多 TRIM_LIMIT；兩聲道取最大值
export function loopRange(channels, limit = TRIM_LIMIT, floor = 1e-4) {
  const n = channels[0].length, loud = i => channels.some(c => Math.abs(c[i]) > floor);
  let a = 0, b = n; while (a < Math.min(limit, n) && !loud(a)) a++; while (b > Math.max(n - limit, a + 1) && !loud(b - 1)) b--;
  return [a, b];
}
export function createAudio(levels, { track = null } = {}) { // levels：{ music, sfx } 0～3，由呼叫端持有與保存
  const Context = window.AudioContext || window.webkitAudioContext;
  const played = Object.fromEntries(Object.keys(SOUNDS).map(k => [k, 0])), last = {}, live = new Set(); // live：發聲中的戰鬥音效
  let context = null, gains = null, buffers = null, paused = false, failed = !Context, peak = 0, dropped = 0, stolen = 0, musicStarted = false;
  const release = voice => { if (live.delete(voice)) voice.gain.disconnect(); };
  // 立刻斷開並停掉：暫停中的 context 不會前進，若只靠 suspend，恢復時會接著播完舊音效
  function stopEffects() { for (const voice of [...live]) { release(voice); voice.source.stop(); } }
  const buffer = data => { const b = context.createBuffer(1, data.length, RATE); b.getChannelData(0).set(data); return b; };
  const quiet = () => paused || document.hidden;
  const wanted = () => !quiet() && (levels.music > 0 || levels.sfx > 0);
  let music = null, musicSource = track ? 'pending' : 'synth', trackBuffer = null; const musicData = () => music ??= renderMusic();
  // 曲檔以離線 context 解碼（不需使用者互動），完成後若已解鎖就開始播放；失敗則退回合成
  function decodeTrack() {
    try {
      const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext, bytes = Uint8Array.from(atob(track), c => c.charCodeAt(0));
      new Offline(2, 1, 44100).decodeAudioData(bytes.buffer).then(b => { trackBuffer = b; musicSource = 'track'; if (context) sync(); }, fail);
    } catch (error) { fail(error); }
  }
  function fail(error) { console.warn('背景音樂曲檔無法解碼，改用合成', error); musicSource = 'synth'; musicData(); if (context) sync(); }
  if (!failed && levels.music) setTimeout(track ? decodeTrack : musicData, 200); // 開場閒置時先準備，避免第一次點擊停頓
  else if (!failed && track) musicSource = 'idle'; // 音樂關閉時不解碼；之後打開再解碼
  function sync() {
    if (!context) return;
    if (quiet() || !levels.sfx || context.state !== 'running') stopEffects(); // 後者：系統中斷後由輸入恢復
    for (const k of ['music', 'sfx']) gains[k].gain.value = GAIN[levels[k]] * MIX[k];
    // state 要等 promise 完成才更新，所以每次都送出目標狀態；resume 完成後若目標已改為靜止再停一次
    if (wanted()) context.resume().then(() => { if (!wanted()) return context.suspend(); }).catch(() => {});
    else context.suspend().catch(() => {});
    if (levels.music && musicSource === 'idle') { musicSource = 'pending'; decodeTrack(); }
    if (levels.music && !musicStarted && musicSource !== 'pending') {
      musicStarted = true;
      const source = context.createBufferSource();
      if (musicSource === 'track') { const [a, b] = loopRange([...Array(trackBuffer.numberOfChannels)].map((_, i) => trackBuffer.getChannelData(i))); source.buffer = trackBuffer; source.loopStart = a / trackBuffer.sampleRate; source.loopEnd = b / trackBuffer.sampleRate; source.loop = true; source.connect(gains.music); source.start(0, source.loopStart); }
      else { source.buffer = buffer(musicData()); source.loop = true; source.connect(gains.music); source.start(); }
    }
  }
  return {
    sync, stopEffects,
    unlock() {
      if (failed || (!levels.music && !levels.sfx)) return;
      if (!context) try {
        context = new Context();
        context.onstatechange = () => { if (context.state !== 'running') stopEffects(); }; // 系統或瀏覽器自行中斷
        gains = Object.fromEntries(['music', 'sfx'].map(k => { const g = context.createGain(); g.connect(context.destination); return [k, g]; }));
        buffers = Object.fromEntries(Object.keys(SOUNDS).map(k => [k, buffer(renderSound(k))]));
      } catch (error) { console.warn('聲音無法啟動', error); failed = true; context = null; return; }
      sync();
    },
    setPaused(value) { if (value !== paused) { paused = value; sync(); } },
    play(kind) {
      // suspend() 完成前 state 仍是 running，所以暫停與隱藏要直接判斷
      if (!context || quiet() || context.state !== 'running' || !levels.sfx || !buffers[kind]) return;
      const now = performance.now() / 1000;
      const voices = [...live], mine = voices.filter(v => v.kind === kind).length;
      if (mine >= LIMIT.perKind || now - (last[kind] ?? -9) < LIMIT.gap) { dropped++; return; }
      if (live.size >= LIMIT.total) { // 滿載：尚未發聲的兵種搶占最擁擠兵種的最舊聲部，避免常見兵種把少見兵種餓死
        const count = k => voices.filter(v => v.kind === k).length, crowded = voices.reduce((m, v) => count(v.kind) > count(m.kind) ? v : m, voices[0]);
        if (mine > 0 || count(crowded.kind) < 2) { dropped++; return; }
        release(crowded); crowded.source.stop(); stolen++;
      }
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffers[kind]; source.playbackRate.value = .94 + (played[kind] % 5) * .03; gain.gain.value = SOUNDS[kind].gain;
      const voice = { kind, source, gain };
      source.connect(gain).connect(gains.sfx); source.onended = () => release(voice);
      last[kind] = now; live.add(voice); played[kind]++; peak = Math.max(peak, live.size); source.start();
    },
    info: () => ({ state: failed ? 'unavailable' : context?.state ?? 'locked', music: gains?.music.gain.value ?? 0, sfx: gains?.sfx.gain.value ?? 0, musicStarted, musicSource, voices: live.size, peak, dropped, stolen, played: { ...played } }),
  };
}
