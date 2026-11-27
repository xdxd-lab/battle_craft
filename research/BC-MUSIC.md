# BC-MUSIC：DEV02 背景音樂

2026-11-27 起，DEV02 的背景音樂預設使用 CC0 曲〈Pulse〉（SRG774，Dark Sci-Fi Audio Pack）。原本的程序合成音樂保留下來，用於解碼失敗時的備援，也可用 `#music=synth` 切回對照。來源、授權原文、雜湊與處理指令見 [assets/music/README.md](../assets/music/README.md)。

## 條件

- 必須是原創或可公開散布的授權，且能內嵌於離線單檔 HTML。不擷取、不模仿暴雪音樂，只參考半寫實工業科幻的氛圍。
- 音樂與音效的音量可分開調整，也可分開關閉，並沿用既有設定。
- 必須能在手機與桌面瀏覽器播放，曲檔要能無縫循環，大小也要合理。

## 候選

OpenGameArt 各列已於 2026-11-27 下載，頁面授權欄已核對，並在本機保存頁面快照。最後三列（Kevin MacLeod、Pixabay、Resistor Anthems）是先前子代理研究的結論，本輪沒有重新核對。取捨依據頁面描述與用途，並非逐曲完整試聽。

| 候選 | 作者 | 授權 | 結果 |
| --- | --- | --- | --- |
| [Dark Sci-Fi Audio Pack](https://opengameart.org/content/dark-sci-fi-audio-pack)〈Pulse〉 | SRG774 | CC0 | **採用** |
| 同包〈Sector〉〈Airy〉〈Urgent〉〈Title〉 | SRG774 | CC0 | 未採用：頁面描述不如 Pulse 符合「低調、連續」；Title 的 Ogg 為 7.9 MB |
| [Space Battle](https://opengameart.org/content/space-battle) | MintoDog | CC0 | 未採用：130 BPM 戰鬥曲，較可能與戰鬥音效爭搶注意 |
| [Ambience Pack 1 – Sci Fi Horror](https://opengameart.org/content/ambience-pack-1-sci-fi-horror) | Joth | CC0 | 未採用：屬恐怖音景合輯 |
| [Bleak Terminal](https://opengameart.org/content/bleak-terminal)、[Menacing Otherworld](https://opengameart.org/content/menacing-otherworld) | Ruskerdax | CC0 | 備選：氣氛相近，可作替代 |
| [Claimed by the Void](https://opengameart.org/content/claimed-by-the-void) | vitalezzz | CC0 | 備選 |
| Kevin MacLeod（incompetech） | Kevin MacLeod | CC BY 4.0 | 未採用：須在遊戲內署名；CC0 已有合適選項 |
| Pixabay 音樂 | 多位 | Pixabay License（非 CC） | 排除：禁止單獨再散布，條款也較難判讀 |
| Resistor Anthems 等合輯 | — | 不明 | 排除：授權無法確認 |

〈Pulse〉的頁面描述為「Low-profile and continuous」，作者也註明整包音樂可循環，並建議加交叉淡入。這首曲子音量低、節奏穩定，放在戰鬥音效下方不會互相干擾。

## 格式與播放

- **MP3 96 kbps 立體聲**：iOS Safari 對 Ogg Vorbis 的支援不可靠，因此改用 MP3。原檔是 320 kbps，壓到 96k 後只剩 830 KB，以 base64 內嵌後約 1.1 MB，HTML 增為 13.19 MB。
- **解碼**：開場 200 ms 後，以 `OfflineAudioContext` 解碼，不需等待使用者操作。解碼完成後，若音訊已解鎖就直接開播。音樂設為「關」時不解碼，之後打開才解碼。
- **記憶體**：解碼後約為 69 秒 × 44.1 kHz × 2 聲道 × 4 B，約 24 MB。低階手機若有壓力，可改為單聲道（減半）或縮短曲長。
- **循環**：製作時已用 2 秒等功率交叉淡入接好頭尾。播放時，`loopRange` 會略過 MP3 編碼器在頭尾補的零，再設 `loopStart`／`loopEnd`。
- **狀態**：`audio.info().musicSource` 會是 `pending`、`track`、`synth` 或 `idle`。

## 測試

- `qa-audio.mjs`：
  - 合成器不載入任何音檔，播放端只有一處解碼，且沒有 fetch、`new Audio` 或外部路徑。
  - 單檔 HTML 內嵌的資料與 `pulse-loop.mp3` 位元相同。
  - `loopRange` 的邊界正確。
- `qa-audio-play.mjs`：
  - 解碼成功時播放曲檔，循環區間與起點正確，且只有一條音軌。
  - 解碼失敗時退回合成音樂。
  - 音樂關閉時不解碼，打開後才解碼並播放。
- `qa-browser.mjs`：在 Chromium 實際解碼內嵌曲檔，`musicSource` 為 `track`。

## 限制

- 尚未經人耳試聽。循環接點只用數值檢查：跳變 .0002，小於相鄰取樣平均差 .001。仍需在 iOS Safari、Android Chrome 與桌面瀏覽器聽一次循環與音量。
- 素材是 2026-05 的新上傳。頁面沒有說明是否以生成式工具製作，也無法確認上傳者擁有完整權利。若要正式發行，建議以 Ruskerdax 的曲目作為替代備案。
