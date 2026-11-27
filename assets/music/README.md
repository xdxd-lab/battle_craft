# 背景音樂（CC0）

DEV02 的背景音樂由使用者於 2026-11-27 試聽後選定，分「開場」與「激戰」兩個階段。曲目表與觸發條件見 [dev02-four-seats/music-tracks.mjs](../../dev02-four-seats/music-tracks.mjs)，選曲與量測經過見 [research/BC-MUSIC.md](../../research/BC-MUSIC.md)。建置時，`dev02-four-seats/build.py` 會把這裡的 MP3 以 base64 內嵌進單檔 HTML，離線開啟也能播放。

## 曲目、來源與授權

所有原檔都在 2026-11-27 從 OpenGameArt 下載，頁面的授權欄都是 CC0，頁面快照存在本機。

| 檔案 | 階段 | 曲名／作者 | 頁面 | 原檔（下載網址的檔名、位元組、md5） |
| --- | --- | --- | --- | --- |
| airy.mp3 | 開場 | Airy／SRG774 | [Dark Sci-Fi Audio Pack](https://opengameart.org/content/dark-sci-fi-audio-pack) | `airy_0.ogg`，1,117,106 B，`fdeb5ca5f8db6c6454372f4c68177062` |
| pulse.mp3 | 開場 | Pulse／SRG774 | 同上 | `pulse_0.mp3`，2,845,256 B，`40280cdbbd721aa7c2fb76211585250b` |
| urgent.mp3 | 開場 | Urgent／SRG774 | 同上 | `urgent_2.ogg`，828,217 B，`4bca5249ebb7f99b94eabc117bd9b239` |
| space-battle.mp3 | 激戰 | Space Battle／MintoDog | [Space Battle](https://opengameart.org/content/space-battle) | `space_battle_bpm130.mp3`，3,547,547 B，`d578fefc12b1100f3735e710747f7b86` |
| claimed-by-the-void.mp3 | 激戰 | Claimed by the Void（loop 版）／Vitalezzz | [Claimed by the Void](https://opengameart.org/content/claimed-by-the-void) | `claimed_by_the_void_loop.mp3`，7,801,264 B，`568414fb9b936e8eb820a3c31f8c8fb7` |

下載網址的格式為 `https://opengameart.org/sites/default/files/<原檔檔名>`。

- **SRG774 曲包的授權原文**："This asset pack is released under the Creative Commons CC0 Public Domain Dedication."。作者另外說明不強制署名，但歡迎註明。
- **Urgent 與 Airy 用 Ogg 版**：使用者試聽的是 Ogg 版。同頁的 `urgent_0.mp3` 是另一個母帶，整體只有 −43 LUFS，不採用。
- **Vitalezzz**：頁面的 Copyright/Attribution Notice 寫的是 "Vitalezzz - Claimed by the Void"，授權欄為 CC0。
- **使用者選的第六首 Volatile Reaction（Kevin MacLeod，激戰組）目前未內嵌**：Wikimedia Commons 上的副本標示 CC BY 3.0，但 incompetech 本站的逐曲授權頁是 JavaScript 動態載入，讀不到，資料檔也沒有授權欄位。一手來源核實前，不內嵌、也不算可用。

遊戲內曲名列會顯示「曲名 — 作者（CC0）」，作為來源註明。

## 處理

```sh
S=<原檔所在目錄>
node tools/make-music-loop.mjs $S/airy_0.ogg assets/music/airy.mp3 --fade 2
node tools/make-music-loop.mjs $S/pulse_0.mp3 assets/music/pulse.mp3 --fade 2 --compress \
  --dyn "acompressor=threshold=-36dB:ratio=6:attack=20:release=400:makeup=12,dynaudnorm=f=300:g=21:m=40"
node tools/make-music-loop.mjs $S/urgent_2.ogg assets/music/urgent.mp3 --fade 2
node tools/make-music-loop.mjs $S/space_battle_bpm130.mp3 assets/music/space-battle.mp3 --fade 1.846
node tools/make-music-loop.mjs $S/claimed_by_the_void_loop.mp3 assets/music/claimed-by-the-void.mp3 --fade 2
```

處理步驟（ffmpeg 9.0.2）：

1. 解碼成 44.1 kHz 立體聲。只有 Pulse 會先壓縮動態範圍，因為原曲的響度範圍達 15.6 LU，有很長的段落近乎無聲。
2. 依「小喇叭響度」對齊到 −21 LUFS。小喇叭響度是先經 200 Hz 二階高通、再量 EBU R128 的值。筆電與手機喇叭放不出低頻，只看全頻響度的話，低頻重的曲子會「數字夠、聽不到」，例如 03 Menacing Otherworld。
3. 限幅，峰值上限 .84。
4. 循環交叉淡入：把結尾一段以等功率疊回開頭。Space Battle 為 130 BPM，全曲剛好 192 拍，交叉長度取一小節 1.846 秒，讓鼓點對齊。其他曲取 2 秒。
5. 編成 96 kbps 立體聲 MP3。

| 輸出 | 長度 | 位元組 | md5 | 全頻 | 小喇叭 | 小喇叭瞬時 5%／中位 | 接點跳變／平均差 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| airy.mp3 | 62.0 秒 | 744,847 | `7fa02fdaaf922d5def11ca37e012eb3e` | −20.0 | −21.0 | −25.5／−21.1 | .0057／.0035 |
| pulse.mp3 | 69.1 秒 | 830,424 | `a8b20fdca66173246a83a04919a040d3` | −14.4 | −21.0 | −38.6／−21.7 | .0001／.0025 |
| urgent.mp3 | 54.9 秒 | 659,583 | `5f1c2d616f58a9a16a5cfd9b30e1d862` | −14.3 | −21.7 | −25.8／−22.2 | .0030／.0034 |
| space-battle.mp3 | 86.8 秒 | 1,042,016 | `6ecf20146e72675e98aeea58d7179dab` | −16.4 | −21.0 | −23.6／−21.0 | .0078／.0182 |
| claimed-by-the-void.mp3 | 193.0 秒 | 2,317,209 | `c629e68141553d212c0d5fec9b1698c5` | −20.4 | −21.0 | −27.9／−20.9 | .0009／.0073 |

響度單位為 LUFS，瞬時響度每 0.5 秒一個值。Pulse 是心跳節奏，拍與拍之間會掉到 −38 左右，這是曲子本身的特性；壓縮前會低到 −50。

MP3 編碼器會在頭尾補零。播放時，`audio.js` 的 `loopRange` 會略過頭尾最多各 2400 frame 的近乎無聲段，再設定循環區間。

## 限制

- 循環接點、交叉淡入與壓縮後的 Pulse 都只做數值檢查，未經人耳試聽。
- 這些素材都是近一年內上傳的作品，頁面沒有說明是否用生成式工具製作。
