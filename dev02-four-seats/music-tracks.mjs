// 背景音樂曲目與階段（使用者選定的六首；author／license 會顯示在曲名列，CC BY 曲目即以此署名；來源、授權與處理見 assets/music/README.md）。
// 開場：對局開始時隨機選一首；激戰：觸發後隨機選一首、全局只切一次，一直播到對局結束。
export const PHASES = ['opening', 'battle'];
export const PHASE_NAMES = { opening: '開場', battle: '激戰' };
export const TRACKS = [
  { id: 'airy', file: 'airy.mp3', phase: 'opening', title: 'Airy', author: 'SRG774', license: 'CC0' }, // 空曠、飄浮的環境聲
  { id: 'pulse', file: 'pulse.mp3', phase: 'opening', title: 'Pulse', author: 'SRG774', license: 'CC0' }, // 低調心跳脈衝（已壓縮動態，避免長段無聲）
  { id: 'urgent', file: 'urgent.mp3', phase: 'opening', title: 'Urgent', author: 'SRG774', license: 'CC0' }, // 推進感脈動，接戰前的鋪陳
  { id: 'space-battle', file: 'space-battle.mp3', phase: 'battle', title: 'Space Battle', author: 'MintoDog', license: 'CC0' }, // 130 BPM 戰鬥主題
  { id: 'claimed-by-the-void', file: 'claimed-by-the-void.mp3', phase: 'battle', title: 'Claimed by the Void', author: 'Vitalezzz', license: 'CC0' }, // 電子樂
  { id: 'volatile-reaction', file: 'volatile-reaction.mp3', phase: 'battle', title: 'Volatile Reaction', author: 'Kevin MacLeod', license: 'CC BY 4.0', credit: '"Volatile Reaction" Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/ ；本遊戲已剪接循環並調整動態與響度', source: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400039', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' }, // 7/4 拍銅管與重擊打；CC BY 4.0 須署名，已做壓縮、響度與循環剪接
];
// 激戰觸發（暫定，可調）：任一座核心第一次受損，或對局進行到 BATTLE_AT_SECONDS 秒，取較早者；每局只切一次
// 選單顯示的音樂來源：CC BY 曲目附完整署名、授權連結與修改說明
export const MUSIC_CREDITS = TRACKS.map(t => t.credit ?? `${t.title} — ${t.author}（${t.license}）`);
// 署名連結（觸控可點）：CC BY 曲目附曲目原站頁與授權條款
export const CREDIT_LINKS = TRACKS.filter(t => t.source).flatMap(t => [{ track: t.id, label: `${t.title} 曲目頁（incompetech）`, href: t.source }, { track: t.id, label: `${t.license} 授權條款`, href: t.licenseUrl }]);
export const BATTLE_AT_SECONDS = 90;
export const battleDue = (state, coreMax, hz) => state.tick >= BATTLE_AT_SECONDS * hz || Object.values(state.seats).some(s => s.hp < coreMax);
