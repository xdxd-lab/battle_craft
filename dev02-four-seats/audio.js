// 瀏覽器端播放：互動後才建立 AudioContext；音樂、音效分開調整；限制同時聲部與觸發間隔。只讀事件，不影響模擬。
// 背景音樂：內嵌曲檔（呼叫端傳入 base64 MP3），分開場／激戰兩階段，各階段隨機選一首；換曲交叉淡入。音樂關閉時不解碼、不播放。
import { RATE, SOUNDS, renderSound } from './audio-synth.mjs';

export const LEVEL_NAMES = ['關', '小', '中', '大'];
const GAIN = [0, .3, .6, 1];
const MIX = { music: .8, sfx: .4 }; // 2026-11-27 依遊戲內實錄調整：原 .4／.5 時音樂「中」比音效低約 7 dB，被蓋過
export const MUSIC_FADE = 1.5; // 換曲交叉淡入秒數
export const LIMIT = { total: 6, perKind: 3, gap: .07 }; // 同時聲部、單一兵種聲部、同兵種最短間隔（實際秒數，不隨遊戲倍速）

export const TRIM_LIMIT = 2400; // 解碼後頭尾最多略過的靜音 frame（MP3 編碼器補零），約 50 毫秒
// 找出循環區間：略過頭尾近乎無聲的補零，最多 TRIM_LIMIT；兩聲道取最大值
export function loopRange(channels, limit = TRIM_LIMIT, floor = 1e-4) {
  const n = channels[0].length, loud = i => channels.some(c => Math.abs(c[i]) > floor);
  let a = 0, b = n; while (a < Math.min(limit, n) && !loud(a)) a++; while (b > Math.max(n - limit, a + 1) && !loud(b - 1)) b--;
  return [a, b];
}
export function createAudio(levels, { tracks = [], random = Math.random, onTrack = () => {} } = {}) { // levels：{ music, sfx } 0～3，由呼叫端持有與保存
  const Context = window.AudioContext || window.webkitAudioContext;
  const played = Object.fromEntries(Object.keys(SOUNDS).map(k => [k, 0])), last = {}, live = new Set(); // live：發聲中的戰鬥音效
  let context = null, gains = null, buffers = null, paused = false, failed = !Context, peak = 0, dropped = 0, stolen = 0, musicStarted = false;
  const release = voice => { if (live.delete(voice)) voice.gain.disconnect(); };
  // 立刻斷開並停掉：暫停中的 context 不會前進，若只靠 suspend，恢復時會接著播完舊音效
  function stopEffects() { for (const voice of [...live]) { release(voice); voice.source.stop(); } }
  const buffer = data => { const b = context.createBuffer(1, data.length, RATE); b.getChannelData(0).set(data); return b; };
  const quiet = () => paused || document.hidden;
  const wanted = () => !quiet() && (levels.music > 0 || levels.sfx > 0);
  // 音樂：want＝本階段選中的曲；current＝正在播的曲。只保留 want 與 current 的解碼結果，換曲完成即釋放
  let phase = null, want = null, current = null, switches = 0; const decoded = new Map(), decoding = new Set(), broken = new Set();
  const pick = p => { const list = tracks.filter(t => t.phase === p && !broken.has(t.id)); return list.length ? list[Math.floor(random() * list.length)] : null; };
  function load(t) { // 曲檔以離線 context 解碼（不需使用者互動）；完成後若已解鎖就開始播放
    if (decoded.has(t.id) || decoding.has(t.id)) return;
    decoding.add(t.id);
    const fail = error => { decoding.delete(t.id); broken.add(t.id); console.warn(`背景音樂 ${t.title} 無法解碼，改選同階段其他曲`, error); if (want === t) { want = pick(phase); if (want && levels.music) load(want); } musicChanged(); sync(); }; // sync：同階段全壞時 want 為 null，要停掉仍在播的上一階段曲
    try {
      const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const decode = buffer => new Offline(2, 1, 44100).decodeAudioData(buffer);
      const done = b => { decoding.delete(t.id); if (t === want || t === current?.track) decoded.set(t.id, b); sync(); };
      if (t.load) t.load().then(decode).then(done, fail);
      else decode(Uint8Array.from(atob(t.data), c => c.charCodeAt(0)).buffer).then(done, fail);
    } catch (error) { fail(error); }
  }
  const at = () => context.currentTime;
  function fadeOut(m) { // 淡出後停掉並釋放（不是 want 才釋放解碼結果）
    m.gain.gain.setValueAtTime(m.gain.gain.value, at()); m.gain.gain.linearRampToValueAtTime(0, at() + MUSIC_FADE);
    m.source.stop(at() + MUSIC_FADE); m.source.onended = () => { m.gain.disconnect(); if (m.track !== want && m.track !== current?.track) decoded.delete(m.track.id); };
  }
  function syncMusic() {
    if (!levels.music || !want) { if (current) { current.source.onended = null; current.source.stop(); current.gain.disconnect(); current = null; musicChanged(); } return; } // 關閉音樂：立即停，不出聲
    if (current?.track === want) return;
    const b = decoded.get(want.id); if (!b) { load(want); return; }
    const [a, e] = loopRange([...Array(b.numberOfChannels)].map((_, i) => b.getChannelData(i)));
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = b; source.loop = true; source.loopStart = a / b.sampleRate; source.loopEnd = e / b.sampleRate; source.connect(gain).connect(gains.music);
    const first = !current; gain.gain.setValueAtTime(first ? 1 : 0, at()); if (!first) { gain.gain.linearRampToValueAtTime(1, at() + MUSIC_FADE); fadeOut(current); }
    source.start(0, source.loopStart); current = { track: want, source, gain }; musicStarted = true; switches++; musicChanged();
  }
  function musicChanged() { onTrack(current && levels.music ? current.track : null); }
  // 進入階段：同階段重呼叫不換曲；repick（新的一局）時重新隨機
  function setPhase(p, repick = false) {
    if (p === phase && !repick) return;
    phase = p; const next = pick(p); if (want && want !== current?.track && want !== next) decoded.delete(want.id); want = next;
    if (want && levels.music) load(want); sync();
  }
  function sync() {
    if (!context) return;
    if (quiet() || !levels.sfx || context.state !== 'running') stopEffects(); // 後者：系統中斷後由輸入恢復
    for (const k of ['music', 'sfx']) gains[k].gain.value = GAIN[levels[k]] * MIX[k];
    // state 要等 promise 完成才更新，所以每次都送出目標狀態；resume 完成後若目標已改為靜止再停一次
    if (wanted()) context.resume().then(() => { if (!wanted()) return context.suspend(); }).catch(() => {});
    else context.suspend().catch(() => {});
    syncMusic();
  }
  return {
    sync, stopEffects, setPhase,
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
    info: () => ({ state: failed ? 'unavailable' : context?.state ?? 'locked', music: gains?.music.gain.value ?? 0, sfx: gains?.sfx.gain.value ?? 0, musicStarted, musicSource: !levels.music ? 'off' : current ? 'track' : want ? 'pending' : 'none', phase, track: current?.track.id ?? null, wanted: want?.id ?? null, decoded: [...decoded.keys()], switches, voices: live.size, peak, dropped, stolen, played: { ...played } }),
  };
}
