// 背景音樂曲目與階段（使用者 2026-11-27 選定的六首；來源、授權與處理見 assets/music/README.md）。
// 開場：對局開始時隨機選一首；激戰：觸發後隨機選一首、全局只切一次，一直播到對局結束。
export const PHASES = ['opening', 'battle'];
export const PHASE_NAMES = { opening: '開場', battle: '激戰' };
export const TRACKS = [
  { id: 'airy', file: 'airy.mp3', phase: 'opening', title: 'Airy', author: 'SRG774', license: 'CC0' }, // 空曠、飄浮的環境聲
  { id: 'pulse', file: 'pulse.mp3', phase: 'opening', title: 'Pulse', author: 'SRG774', license: 'CC0' }, // 低調心跳脈衝（已壓縮動態，避免長段無聲）
  { id: 'urgent', file: 'urgent.mp3', phase: 'opening', title: 'Urgent', author: 'SRG774', license: 'CC0' }, // 推進感脈動，接戰前的鋪陳
  { id: 'space-battle', file: 'space-battle.mp3', phase: 'battle', title: 'Space Battle', author: 'MintoDog', license: 'CC0' }, // 130 BPM 戰鬥主題
  { id: 'claimed-by-the-void', file: 'claimed-by-the-void.mp3', phase: 'battle', title: 'Claimed by the Void', author: 'Vitalezzz', license: 'CC0' }, // 電子樂
  // 第六首 08 Volatile Reaction（Kevin MacLeod）：逐曲授權尚未由 incompetech 一手來源核實，暫不內嵌（見 research/BC-MUSIC.md）
];
// 激戰觸發（暫定，可調）：任一座核心第一次受損，或對局進行到 BATTLE_AT_SECONDS 秒，取較早者；每局只切一次
export const BATTLE_AT_SECONDS = 90;
export const battleDue = (state, coreMax, hz) => state.tick >= BATTLE_AT_SECONDS * hz || Object.values(state.seats).some(s => s.hp < coreMax);
