# 背景音樂（CC0）

DEV02 的背景音樂。建置時 `dev02-four-seats/build.py` 會把 `pulse-loop.mp3` 以 base64 內嵌進單檔 HTML，離線開啟也能播放。若解碼失敗，或網址帶 `#music=synth`，就改用 `audio-synth.mjs` 的程序合成音樂。選曲經過見 [research/BC-MUSIC.md](../../research/BC-MUSIC.md)。

## 來源與授權

| 項目 | 內容 |
| --- | --- |
| 作品 | Dark Sci-Fi Audio Pack 中的 `Pulse.mp3`（作者 SRG774，OpenGameArt 上傳日 2026-05-17） |
| 頁面 | https://opengameart.org/content/dark-sci-fi-audio-pack |
| 下載 | https://opengameart.org/sites/default/files/pulse_0.mp3（2026-11-27 取得） |
| 授權 | CC0 1.0 Universal（頁面 License(s) 欄與內文） |
| 原檔 | 2,845,256 B，md5 `40280cdbbd721aa7c2fb76211585250b`，MP3 320 kbps，71.13 秒 |
| 同曲 Ogg（未使用） | `pulse_0.ogg`，831,824 B，md5 `1544925ea367f298cf1832aac12bbed8` |

頁面原文（2026-11-27 擷取）：

> License (CC0 1.0 Universal / Public Domain) This asset pack is released under the Creative Commons CC0 Public Domain Dedication. You can copy, modify, distribute, and perform the work, even for commercial purposes, all without asking permission or providing attribution. Though not required, mentioning SRG774 or linking back to this pack is always highly appreciated.

> Originally created for the game Ball Logic

> Pulse.mp3 – Rhythmic, extraterrestrial alien pulse heartbeat. Low-profile and continuous.

CC0 不要求署名。作者表示感謝註明，因此本檔與 BC-MUSIC 記下作者與網址，也供追溯。原檔與頁面快照只存在本機，沒有放進儲存庫。

## 處理

```sh
node tools/make-music-loop.mjs pulse_0.mp3 assets/music/pulse-loop.mp3 2
```

處理步驟如下（需本機 ffmpeg，製作時版本為 9.0.2）：

1. 解碼為 44.1 kHz 立體聲浮點。
2. 去掉最後 2 秒，並以等功率交叉淡入把這段疊到開頭。循環時，結尾會直接接回原曲的下一個取樣。
3. 峰值正規化到 .8，與合成音樂相同。原檔峰值 .223，增益 3.589。
4. 以 libmp3lame 編碼為 96 kbps 立體聲。

工具輸出：`{"seconds":69.131,"crossfade":2,"sourcePeak":0.223,"gain":3.589,"seamStep":0.0002,"typicalStep":0.001}`。接點跳變 .0002，小於相鄰取樣的平均差 .001。

| 輸出 | 位元組 | md5 | 長度 |
| --- | --- | --- | --- |
| `pulse-loop.mp3` | 830,424 | `3e59933940b591d042bc1cca925df719` | 69.131 秒，44.1 kHz 立體聲 96 kbps |

MP3 編碼器會在頭尾補零。播放時，`audio.js` 的 `loopRange` 最多略過頭尾各 2400 個 frame 的近乎無聲段，再設定 `loopStart`／`loopEnd`，所以補零不會在循環時造成停頓。

## 限制

- 接點只以數值檢查，尚未經人耳在各瀏覽器與手機上試聽。
- 素材是 2026 年 5 月的新上傳。頁面沒有說明是否使用生成式工具製作，無法確認上傳者對作品擁有完整權利。若要公開發行，建議先找替代曲備用。
