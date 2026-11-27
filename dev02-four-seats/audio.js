// 瀏覽器端播放：互動後才建立 AudioContext；音樂、音效分開調整；限制同時聲部與觸發間隔。只讀事件，不影響模擬。
import { RATE, SOUNDS, renderSound, renderMusic } from './audio-synth.mjs';

export const LEVEL_NAMES = ['關', '小', '中', '大'];
const GAIN = [0, .3, .6, 1];
const MIX = { music: .4, sfx: .5 };
export const LIMIT = { total: 6, perKind: 3, gap: .07 }; // 同時聲部、單一兵種聲部、同兵種最短間隔（實際秒數，不隨遊戲倍速）

export function createAudio(levels) { // levels：{ music, sfx } 0～3，由呼叫端持有與保存
  const Context = window.AudioContext || window.webkitAudioContext;
  const played = Object.fromEntries(Object.keys(SOUNDS).map(k => [k, 0])), last = {}, live = new Set(); // live：發聲中的戰鬥音效
  let context = null, gains = null, buffers = null, paused = false, failed = !Context, peak = 0, dropped = 0, musicStarted = false;
  const release = voice => { if (live.delete(voice)) voice.gain.disconnect(); };
  // 立刻斷開並停掉：暫停中的 context 不會前進，若只靠 suspend，恢復時會接著播完舊音效
  function stopEffects() { for (const voice of [...live]) { release(voice); voice.source.stop(); } }
  const buffer = data => { const b = context.createBuffer(1, data.length, RATE); b.getChannelData(0).set(data); return b; };
  const quiet = () => paused || document.hidden;
  const wanted = () => !quiet() && (levels.music > 0 || levels.sfx > 0);
  let music = null; const musicData = () => music ??= renderMusic();
  if (!failed && levels.music) setTimeout(musicData, 200); // 開場閒置時先合成，避免第一次點擊停頓
  function sync() {
    if (!context) return;
    if (quiet() || !levels.sfx || context.state !== 'running') stopEffects(); // 後者：系統中斷後由輸入恢復
    for (const k of ['music', 'sfx']) gains[k].gain.value = GAIN[levels[k]] * MIX[k];
    // state 要等 promise 完成才更新，所以每次都送出目標狀態；resume 完成後若目標已改為靜止再停一次
    if (wanted()) context.resume().then(() => { if (!wanted()) return context.suspend(); }).catch(() => {});
    else context.suspend().catch(() => {});
    if (levels.music && !musicStarted) {
      musicStarted = true;
      const source = context.createBufferSource(); source.buffer = buffer(musicData()); source.loop = true; source.connect(gains.music); source.start();
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
      if (live.size >= LIMIT.total || [...live].filter(v => v.kind === kind).length >= LIMIT.perKind || now - (last[kind] ?? -9) < LIMIT.gap) { dropped++; return; }
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffers[kind]; source.playbackRate.value = .94 + (played[kind] % 5) * .03; gain.gain.value = SOUNDS[kind].gain;
      const voice = { kind, source, gain };
      source.connect(gain).connect(gains.sfx); source.onended = () => release(voice);
      last[kind] = now; live.add(voice); played[kind]++; peak = Math.max(peak, live.size); source.start();
    },
    info: () => ({ state: failed ? 'unavailable' : context?.state ?? 'locked', music: gains?.music.gain.value ?? 0, sfx: gains?.sfx.gain.value ?? 0, musicStarted, voices: live.size, peak, dropped, played: { ...played } }),
  };
}
