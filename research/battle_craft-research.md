# BaattleCraft｜十字對衝歷史、地圖實證與素材調查

專案及檔名用 `battle_craft`，遊戲英文顯示名稱用 `BaattleCraft`。歷史資料仍用來源原名 `BattleCraft`。研究日期為 2026-11-25（台灣）。

## SC1 教學與原始附件

[鐵之狂傲教學](https://www.gamez.com.tw/t/topic/374947)的搜尋快取保有 2009-09-28 的 SCMDraft2 操作紀錄，可獨立交叉核對 150 礦、12 名 Marine、購入區轉送、兩條道路的攻擊指令，以及下令後等待 1.5 秒的範例。教學的外觀是踩信標，實際檢查的是框在信標上的 Location。教學頁和 [RAR 直連](https://www.gamez.com.tw/uploads/short-url/1XtPBgghg6jzzUR5rNLRAceXrnS.rar)的即時請求回傳 HTTP 502。Wayback 的精確 URL 索引未列出可下載的成功存檔。本次未取得有效 RAR，無法做與論壇附件的逐位元組認證。

## 實際 SCX／CHK 解析

用 [scmJS 0.18.0](https://docs.scmjs.dev/cli/looking-inside-a-map/)下載了 10 個 SPEED 檔與一個較舊的 FastBlack 檔。三個鏡像在索引中的檔名都是 `BattleCraft-Fastblack-SPEED.scx`。已對這三個及舊版列出 MPQ 內容、取出並核對 `staredit/scenario.chk`、匯出 TRIG、地圖資訊和 Location。所有編號均是 scmJS 遊戲 Trigger 匯出順序，從 1 起算，含空列，不含任務簡報。這是靜態剖析。

| 樣本 | 核實內容 |
| --- | --- |
| [2tzpVkp9](https://scmscx.com/map/2tzpVkp9) | 47,872 bytes。96×96 Space Platform，4 個人類欄位，82 個具名／已用 Location（scmJS 統計），475 個預置單位、94 個 Trigger。作為下文比較基準。 |
| [GcqBVh2H](https://scmscx.com/map/GcqBVh2H) | 47,878 bytes。原始 TRIG section 和文字匯出與基準版相同，整個 SCX、CHK 和預置 UNIT 資料的雜湊有差異。 |
| [y5Dd5fbV](https://scmscx.com/map/y5Dd5fbV) | 49,540 bytes。第 94 條換成 P1 一次設為 30,000 礦，基準版 P2–P4 的反覆扣款消失。另有 CHK 的單位設定／預置單位差異。 |
| [FastBlack v2.91f](https://scmscx.com/map/7zGY2kzG) | 42,190 bytes、120 個 Trigger，含一次性加 3,000 礦、另一條持續加 42 礦，以及中路優勢給錢的規則。保留為版本對照。 |

其他 SPEED 鏡像包括 [8sGp67zf](https://scmscx.com/map/8sGp67zf)、[d37t25T3](https://scmscx.com/map/d37t25T3)、[zRDTRs23](https://scmscx.com/map/zRDTRs23)（三者文字匯出一致，有 P1 的一次性資源規則），[fqzfY9cz](https://scmscx.com/map/fqzfY9cz)、[96c594jR](https://scmscx.com/map/96c594jR)（另含大額資源觸發），[5ykDqVDV](https://scmscx.com/map/5ykDqVDV)（另有砲台數量控制核心無敵），以及 [yrDYVGj7](https://scmscx.com/map/yrDYVGj7)（+75 改 +350，移除基準版第 94 條）。這些分歧會改變經濟或勝負，選版本時須比對 Trigger。

[樣本雜湊](battle_craft-scx-checksums.csv) · [購買生成項目表](battle_craft-speed-purchases.csv) · [15 組地空兵種、護甲與顯示名稱比對](BATTLECRAFT-UNIT-REFERENCE.md)。完整 Trigger 匯出保存在本機研究副本。可依上表鏡像、樣本雜湊與 scmJS 版本重做。

| 玩法 | SPEED 基準版的實證 |
| --- | --- |
| 買兵 | #9 一名己方 Civilian 站在 Marine 區、至少 150 礦，生成 12 名 `Jim Raynor (Marine)` 至 Purchased Units，扣 150 並保留 Trigger。角色可留在區內，後續掃描只要資源夠便能再買。#22–41 多為同樣的 12 人購買機制。#18–21 分別將生成區的單位移往四方出兵區。 |
| 兵種差異 | #27／#28 以 100／175 礦購買 12 名對應 Zergling／Hydralisk 英雄單位。#54 花 1,000 生成 20 名 Zergling。#86 花 750 生成 35 名 Scourge。#42–53 是一次性的 500 礦防禦設施。表中金額取扣款動作，部分註解的標價與實際扣款不同。 |
| 路線 | #10–17 對橫、直兩個區內的己方單位發出攻擊命令，之後有 `Wait(1500)`。依坐標 P1 北、P2 西、P3 南、P4 東。首選對面核心，失守後切換為另一位敵人。P1→P3／P4，P2→P4／P3，P3→P1／P2，P4→P2／P1。部分 #60–67 含停用的條件／命令，應以 #10–17 判讀。 |
| 經濟 | #59 持續觸發 +35 礦，#93 等待 10 後 +75，#94 對 P2–P4 持續 −10。這些是分開的動作；實際頻率受 Brood War 掃描和等待互動影響。#6 是擊殺排行榜，靜態匯出中未找到基準版的擊殺加礦或全員固定起始礦設定。預置有 40 個礦區以及工人，實際採礦影響尚未測。 |
| 勝負與後期 | #2 檢查非同盟勝利玩家的 Pylon 為零時勝利，#3 檢查自己的 Pylon 為零時敗北。#7–8 在 Elapsed Time 600 後提示並持續把護盾降為零。地圖另有空域限制與特殊能力。 |

SCX 證據讓經濟假說比原交接稿更具體，但無法證明哪個同名樣本是 2009 年 RAR 內的那一份，或給出牆鐘每秒速率。要判定「比某版本快多少」，需要選定同系對照版並在相同遊戲速度下量測。

## SC2 重製版改版紀錄

### 歷史畫面與介面

- SC1 SPEED 基準鏡像與 FastBlack v2.91f 的 CHK 都使用 96×96 Space Platform。SPEED 的 `COLR` 前四席索引依序為 `0,1,2,3`，v2.91f 為 `0,1,8,4`。這是兩份地圖內的索引紀錄，對局實際配色也取決於遊戲版本與顯示設定。原論壇 RAR 直連本輪重試仍回 502，Wayback Availability API 亦未回傳該短網址的存檔。[SPEED 鏡像](https://scmscx.com/map/2tzpVkp9) · [FastBlack v2.91f](https://scmscx.com/map/7zGY2kzG) · [論壇附件](https://www.gamez.com.tw/uploads/short-url/1XtPBgghg6jzzUR5rNLRAceXrnS.rar)
- 重製作者的圖庫保留一張標為 `sc1bw_bca0.1` 的地圖鳥瞰圖，可看到深色底、淺色平台輪廓、深色行軍帶與成組的信標。該圖的版本標籤不同，畫面也只有地圖，無法據此核對 SPEED 的對局 HUD。[作者圖庫](https://www.curseforge.com/sc2/maps/battlecraft) · [SC1 BCA 鳥瞰](https://media.forgecdn.net/attachments/154/780/bca.jpg)
- SC2 作者實機圖可見深色金屬網板戰場、左下小地圖、右上計分或投票版面、下方單位與指令資訊。v2.3.5 畫面保留 Score、Income 與按玩家著色的列，購買提示同時顯示價格、用途和攻擊目標。較早的圖可讀到 Life Crystal、Buy Zerg Units 和 Leaderboard；作者說明另列礦物、瓦斯及購兵快捷鍵。這些是 SC2 重製版的介面證據。[SC2 v2.3.5 實機圖](https://media.forgecdn.net/attachments/154/782/bc_2.3.5_igp.jpg) · [較早期 SC2 實機圖](https://media.forgecdn.net/attachments/154/768/bc012.jpg)
- BaattleCraft 可借用其資訊優先順序。戰場上優先辨認戰線、隊伍、席位與場外購買區，購兵資訊凸顯兵種職責、價格、每批數量及對地／對空能力。套用本專案的半寫實材質與原創介面。四個購買區的逆時鐘位置及雙鏡頭基準屬本輪 Web 設計。

[重製者專頁](https://www.curseforge.com/sc2/maps/battlecraft)將來源指向 SC1，署名原作者 Spikes10012。SPEED 鏡像內另列 Blacklabel 及修改者 Milbauer、Lights-Out，兩份署名描述的是不同版本的來源。SC2 專頁描述 1v1／2v2、成隊購買、自動向敵方生命水晶進攻，以及自動收入和擊殺對經濟的影響。

| 版本 | 值得帶走的設計課題 |
| --- | --- |
| v0.2 至 v1.0，2010 | 從早期修正走到調整隊伍開局位置、點狀出兵，並把自動攻擊改為只重新命令閒置單位。適合當作減少行軍命令干擾的候選做法。 |
| v2.0–v2.3 | 收入和人口等升級、進攻計時與冷卻、英雄及防禦，後來加入統計、評分並重整 Trigger。說明核心玩法能逐步擴充。 |
| v2.4 | 擴大兵種與英雄，部分同名單位更換底層模型。研究數據時應記版本，不能靠名稱推定。 |
| v2.5，2011-07-01 | 加入 Hyper、多回合投票、獨立的特殊單位購買，英雄資源改為 terrazine。鏡頭縮放和購兵位置也一起調整。 |
| v2.5.3–v2.5.10 | 反覆調整收入、分數、斷線、資源交易、防禦與英雄等，並加入觀戰。可參考同隊資源可視性與離場處理。 |
| v2.5.11，2011-10-11 | Hyper 的礦物與 terrazine 改每 2/3 秒發放一次。 |
| v2.5.14，2011-10-21 | Hyper 單位時間倍率設為 1.5，影響攻擊、移動、冷卻和動畫等。經濟與部隊時間尺度是兩項可分開量測的調整。 |
| v2.5.15–v2.5.16，2012 | 修正資源和複製異常，以及升級 Arcade 相容性和當機問題。 |

完整版本來源涵蓋 2010-05-07 的 v0.2 至 2012-08-01 的 v2.5.16，頁面上傳日期與內文最後更新不同。以上皆為 SC2 的逐版更動。[重製者改版紀錄](https://www.curseforge.com/sc2/maps/battlecraft/files/440142)

## 資源 Survey 與目前判斷

| 網頁 | 可用之處 |
| --- | --- |
| [鐵之狂傲地圖製作教學](https://www.gamez.com.tw/t/topic/374947)・[原 RAR](https://www.gamez.com.tw/uploads/short-url/1XtPBgghg6jzzUR5rNLRAceXrnS.rar) | 最接近使用者記憶的中文原始證據。搜尋快取可交叉核對，附件即時 502。 |
| [SCMSCX FastBlack v2.91f](https://scmscx.com/map/7zGY2kzG)・[同名 SPEED 基準鏡像](https://scmscx.com/map/2tzpVkp9) | SC1 的地圖檔與索引。已拿到真實位元組。用 ID 和雜湊識別版本。 |
| [SC2 BattleCraft](https://www.curseforge.com/sc2/maps/battlecraft)・[Changelog](https://www.curseforge.com/sc2/maps/battlecraft/files/440142) | 重製者的玩法、署名、版本與平衡設計。適合借鏡可讀性與節奏。 |
| [SC2 作者單位試算表](https://docs.google.com/spreadsheets/d/1yffV3wtjpGJiqRcktuNPU8TQUSFzTbt-xSIklNTUXZ8/edit) | 找到作者入口，未能讀取內容。無法承諾欄位或資料完整性。 |
| [Brood War Map Database](https://github.com/un1maginative/bwmapdb) | 可繼續查同系地圖，尚無證據證明收錄論壇的 RAR。 |
| [scmJS 編輯器](https://scmjs.dev/)・[AI 文件](https://docs.scmjs.dev/ai-tools/)・[Core](https://docs.scmjs.dev/core/)・[CLI](https://docs.scmjs.dev/cli/looking-inside-a-map/) | 可重現下載、解包、Trigger 匯出。這次已實際做過。 |
| [Blizzard Protoss 單位](https://classic.battle.net/scc/protoss/pstats.shtml)・[Cheonjang SC1 單位表](https://cheonjang.com/starcraft) | 官方與社群的基礎數值對照，地圖內覆寫與購買數量以 CHK 為準。 |
| [SC2 Asset Explorer](https://asset-explorer.sc2arcade.com/) | 看模型、圖示、地形和原作比例，作美術參考。 |
| [Brood War 圖資](https://github.com/dada78641/bwmapgfx)・[動畫擷取工具](https://github.com/broodwar-live/assets-pipeline) | 觀察原作圖資及動畫結構。素材與擷取工具的授權分開。 |
| [SC2 TLMC 素材](https://github.com/avexyli/StarCraft2-TLMCFriendlyAssets) | 來源標示僅供 SC2 非商用；不適合給本獨立版當發行素材。 |
| [3DGarden](https://www.3dgarden.app/)・[經分類的素材](https://www.3dgarden.app/collections)・[MCP](https://www.3dgarden.app/tools/mcp)・[授權](https://www.3dgarden.app/licence) | 找寫實／半寫實工業燈、箱、護欄等道具，再依實際造型和 GLB 成本挑選。能力與限制以官方文件為準。 |
| [Poly Haven](https://polyhaven.com/)・[CC0](https://polyhaven.com/license) | 優先用於寫實 HDRI、金屬與混凝土 PBR。 |
| [ambientCG](https://ambientcg.com/)・[CC0](https://docs.ambientcg.com/license/) | 選磨損艙板、混凝土與地面材質，適合統一場景。 |
| Quaternius [Modular Sci-Fi Megakit](https://quaternius.com/packs/modularscifimegakit)・[Ultimate Modular Sci-Fi](https://quaternius.com/packs/ultimatemodularscifi.html)・[Ultimate Space Kit](https://quaternius.com/packs/ultimatespacekit.html) | 三頁標示 CC0。用來比較艙體模組、比例及動線，Megakit 有付費／免費內容之分；外觀偏簡化，不列本案主要美術。 |
| [Kenney Sci-Fi RTS](https://kenney.nl/assets/sci-fi-rts) | CC0 的 2D 圖資，適合操作驗證或 UI 參考。 |

## 交接指南取用與 BaattleCraft 方向

已從前一輪研究的建檔紀錄取回並閱讀 [3DGarden 開發指南正文](battle_craft-source-3dgarden-handoff.md)及[跨 AI 主交接正文](battle_craft-source-master-handoff.md)。兩份是交接時的歷史快照，保留原題名與當時判斷。此報告更新了當時「沒有取得地圖位元組」的狀態；來源 ZIP 的其他檔案未從原對話下載。

1. 以現有 v5 為基底做**原創、半寫實工業科幻**。四端固定核心、兩個外側購兵空間概念及中央交戰區都要能從斜俯視畫面辨識。友方購兵意圖與敵方迷霧的可見性另行實測。用寫實金屬艙板、磨損材質和克制的燈帶，讓角色與路線的輪廓清楚。
2. 信標維持踩上後有錢就買，站著繼續等待也能再次購買。設計層拆開購買、兵團、出兵轉移、導航、交戰及勝負。隊伍可先試北西對南東，也應可配置。原地圖幾何、角色造型、貼圖與音效只作研究資料。
3. 核心與兵種用原創外形。3DGarden 先找寫實工業道具，環境 PBR 用 Poly Haven／ambientCG；必要時自行建模。參考版可用低負荷的同風格畫質作對照，採共用材質、合批與較少的陰影，維持半寫實畫風。
4. 將 GLB、燈光與本地特效和判定、導航分離。用同一場景對照幀時間、繪製呼叫、貼圖下載量和可辨識性。SPEED 從收入與部隊速度各自調整、最後才組合，避免同時改動兩項而看不出效果來源。
