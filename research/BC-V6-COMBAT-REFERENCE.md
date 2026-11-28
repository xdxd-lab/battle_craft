# v6-0 戰鬥資料基準：移動、武器與逐枚命中

2026-11-28（台灣）雲端接手；核對的 GitHub 起點是 `81b704ab00c29481827bcd028e12784be486cbeb`。本文是來源與驗收計畫，不代表 v6-0 已實作。玩家看到的四席現況稱 **v5-9**；既有重播資料格式仍是 7。

## 版本與證據要分欄

| 證據 | 可用來核對 | 不據此斷定 |
| --- | --- | --- |
| [2009 鐵之狂傲 SCMDraft2 教學](https://www.gamez.com.tw/t/topic/374947) | 當時中文玩家稱「十字對衝」；記錄 SPEED 版買 Marine、區域轉送和持續觸發。已取回並驗證教學附件，見下節。 | 未實測的兵種行為與實際收入速率。搜尋詞中的 Flashback 不能取代來源中的實際拼法 FastBlack。 |
| [SCMSCX SPEED 2tzpVkp9](https://scmscx.com/map/2tzpVkp9) 與 [非 SPEED v2.91f 7zGY2kzG](https://scmscx.com/map/7zGY2kzG) | 兩份可重現的 Brood War 地圖，適合比對 Trigger 與 CHK 覆寫。兩份 SCX、CHK、Trigger 匯出均與既有雜湊表相符。 | 兩份同系地圖不能合併為一套數值；兩份鏡像與論壇 RAR 內的 SCX 都不是同一份位元組。 |
| [SC2 重製作者改版紀錄](https://www.curseforge.com/sc2/maps/battlecraft/files/440142) | 2010 到 2012 的改版與 Hyper（收入節奏、單位時間倍率分開改）。[SC2Mapster](https://sc2mapster.wiki.gg/) 可參照編輯器的單位／武器／效果資料拆分；本站本次讀取回 403。 | 不用 SC2 或 Hyper 數值代替 Brood War 舊圖實測。 |
| [BWAPI 單位陣列](https://github.com/bwapi/bwapi/blob/d727fed68558c506163048ea889131d8cbb33915/bwapi/BWAPILIB/Source/UnitType.cpp)／[武器陣列](https://github.com/bwapi/bwapi/blob/d727fed68558c506163048ea889131d8cbb33915/bwapi/BWAPILIB/Source/WeaponType.cpp) | BWAPI 對照的引擎預設資料，含英雄與一般單位的區分。[Blizzard 神民資料](https://classic.battle.net/scc/protoss/pstats.shtml)與[傷害說明](https://classic.battle.net/scc/gs/damage.shtml)可交叉比對。 | 預設值不等於舊圖選區扣款、實際對局數值或已確認的 BaattleCraft 平衡。 |
| [OpenBW 發彈](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L14674-L14701)／[傷害結算](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L13658-L13738) | 獨立引擎在雙彈條件下建立兩個彈體物件，每次命中各自結算；可據此寫待驗的情境。 | 不是 Blizzard 原生引擎逐幀證據，不由程式推估原版發射間隔、落點時間或飛彈速度。 |

[BWAPI 引擎參考 CSV](battle_craft-bwapi-engine-reference.csv) 列出 228 個地圖單位 ID（含英雄、建築及保留列），保留 HP、盾、護甲、最高移速、加速度、停止距離、轉向原始值，以及地／空武器的每 factor 傷害、升級、factor、冷卻和最大射程。空欄代表該欄不適用（沒有武器），不是填 0。這只是完整 ID 覆蓋的**指定欄位參考表**，不包含所有動作腳本、升級後狀態、飛彈或地圖變更。

- 最高移速：px／引擎 frame；武器冷卻：引擎 frame；射程：px。加速度、停止距離和轉向保留 BWAPI 原始整數，不假定可直接套進 Web。遊戲速度模式、引擎 frame、Web 30 Hz tick、畫面 FPS、牆鐘時間是不同概念。
- 例如普通斥候最高速度 `5.0 px/frame`、加速度原始值 `48`，戰鬥巡洋艦最高速度 `2.5 px/frame`、飛螳 `6.67 px/frame`；v5-9 實際部隊移動目前共用 `RULES.unitSpeed = .078`（Web 世界單位／tick），不應直接以 CSV 替換。
- 原始 C++ 留在忽略的研究目錄。以 [提取腳本](tools/extract-bwapi-reference.py)輸入精確提交的兩個檔案（腳本會檢查 SHA-256）可重出 CSV，例如：

```sh
python3 research/tools/extract-bwapi-reference.py UnitType.cpp WeaponType.cpp > research/battle_craft-bwapi-engine-reference.csv
```

## 2009 年論壇實物附件（2026-11-28 查證，台灣時間）

- [2009-09-28 教學原帖第 11 則](https://www.gamez.com.tw/t/topic/374947/11)的 [BattleCraft-Fastblack-SPEED.rar](https://www.gamez.com.tw/uploads/short-url/1XtPBgghg6jzzUR5rNLRAceXrnS.rar)：48,068 bytes。實測 SHA-1 `0dbb7509d3a66c88a603388680e7397be3f5e93c` 與 Discourse 公開短網址推得的值一致；SHA-256 `9e291722078a00efc1edc1a2b57e10df2112846ae49442cf2077a2a6cd00daf7`。這確認是現存教學連結指向的附件，不代表已找到所有歷史版本。
- 壓縮包只有一份 `BattleCraft-Fastblack-SPEED.scx`，47,973 bytes，SHA-256 `2c174ba874184625a0e61dd3eea50f5c11ac0918137212206f20de15e922cd29`。以 scmJS 0.18.0 取出的 CHK SHA-256 為 `c30ae248e68f003bccf10efa0bf2a15ad61995449fd39c62ebfaf2e329cbe16f`，Trigger 純文字匯出 SHA-256 為 `23bcfb659f54da971e68cf0fbde4b33545badea535a4b83b38d9e7601c78e8ea`。
- 與 SPEED 鏡像 `2tzpVkp9` 比對：SCX、CHK、Trigger 都不同。CHK 的 `UNIT` 與 `TRIG` 資料不同；例如 4,500 礦 Armageddon 在論壇版的兩條路線清除適用所有玩家，鏡像版則限非共享勝利同盟的玩家。論壇版亦沒有鏡像版給 P2–P4 持續扣 10 礦的那段觸發。這些是靜態資料差異，尚未在遊戲中量測；不能當成所有 SPEED 版本共用的行為。
- 以論壇附圖或教學為重現目標時，優先用這份確證附件；研究其他版本時保留鏡像版本與雜湊。公開庫只留來源連結、指紋與分析，不放附件或完整匯出。[來源追蹤 #5](https://github.com/xdxd-lab/battle_craft/issues/5)狀態未由此文件變更。

## 神民斥候（Scout）：目前已知、可比與未決

普通斥候（unit 70）和英雄 Artanis（unit 88）要分開。BWAPI 普通斥候為 150 HP／100 盾／0 基礎護甲；對地武器 73 是 8 傷害、30 frame；對空武器 74 是每 factor 14、`damageFactor=2`、22 frame、128 px。另有單位欄位 `maxAirHits=1`；它與武器 factor 不是可隨意相乘或等同飛彈數的欄位。

| 鏡像 | 普通 Scout HP／盾／護甲 | Artanis HP／盾／護甲 | UNIx 武器 74 原始基礎／升級 | UNIx 武器 115 原始基礎／升級 | 300 礦購買 |
| --- | --- | --- | --- | --- | --- |
| SPEED 2tzpVkp9 | 1500／2／0 | 800／0／0 | 350／25 | 90／0 | #34 英雄 Artanis ×12 |
| v2.91f 7zGY2kzG | 1000／0／0 | 2200／0／0 | 140／0 | 308／0 | #38 普通 Scout ×8 |

兩份地圖內的單位旗標均為套用自訂。武器欄是從 [單一 4,168-byte UNIx](https://docs.scmjs.dev/chk/unix/) 依武器 ID 讀到的原值（基礎傷害起點 3648、升級傷害起點 3908，皆為 little-endian u16）；不是已量測的每輪總傷害。不會從 UNIx 找到移速、彈速、冷卻或發射腳本，亦需核對升級、修改觸發及單位匹配。v2.91f 有異常長度的尾端 WAV 段，未影響出現在其前且雜湊相符的 UNIx。

v5-9 現行做法可由 [combat.mjs](../dev02-four-seats/combat.mjs) 和 [qa-roster.mjs](../dev02-four-seats/qa-roster.mjs) 重現：**一個飛行物件、一次到達／impact 事件，同一步呼叫兩次傷害函式**。無盾的本作戰鬥巡洋艦（大型、護甲 3）在該測例由 500 到 478，證明目前是各扣一次 3，不是 28 合併扣一次。獨立覆核的最小重現（種子 1、無電腦、距離 1.2、靶不還手）第 1 個 Web tick 發射 #1，第 6 個 tick 僅一個 impact，傷害 22；未證明原作兩枚的命中先後。兩枚飛彈即使同 frame 發出，也可能因出射位置、轉向和追蹤不同而在不同 frame 命中。

## v6-0 建議先驗收、再實作

1. 封存 v5-9 的幾份實際輸入與格式 7 的逐段摘要、終局與事件序列。需另存逐 tick 的發射／命中追蹤，因目前 replay 摘要涵蓋投射物等狀態，但重播事件清單未保留所有暫態事件。勿向舊狀態新增欄位或改動序列化順序。明定不含 version 的舊輸入紀錄如何處理，不讓它默默套用最新預設版本。
2. 做斥候單次齊射的最小場景：固定移動與射程，分別測護甲 0、護甲 3、部分盾跨到本體、第一枚命中後目標退場、射手退場、同 tick 兩枚的固定順序。需要原版／重製版逐幀錄影或 [BWAPI bullet ID／位置／速度](https://bwapi.github.io/class_b_w_a_p_i_1_1_bullet_interface.html) 才能寫定發射及抵達時序。
3. 用可共用的資料定義，而非大型類別繼承樹：兵種組合移動參數、地空武器；武器定義每輪開火與彈體；各彈體持有目標、追蹤、速度或測量來源，命中再產生逐發結算事件。資料保留來源版本、單位／武器 ID、原始單位、覆寫、信心水準。視覺與規則分開，資料缺口標為待測，不以特效動畫補值。
4. 只在實際變更判定時開新模擬格式；玩家版號 v6-0 不必與重播格式同步。先做一個兵種的雙彈試驗，再評估通用化；運動與攻擊可分開比較並逐步放量。

## 缺口／等待同步

- 已取得論壇 RAR。若取得實際使用的對戰錄影、速度設定或其他本地副本，先對版本而不是重複整理舊圖。不要把 RAR、SCX、完整 CHK/TRIG 匯出、遊戲圖音或私人對話放進公開庫。
- 舊交接提到九兵種 QA3／QA4 的完整報告與解析工具未上 GitHub；目前兩份公開鏡像已獨立重取，但不代表所有本地副本都同步。若有 Scout 實機結論、資料來源或已定稿的速度換算，優先交接其檔名、版本、依據與已驗收案例。
- 材質來源繼續放在 [3D Garden](../assets/3dgarden/README.md)、[Poly Haven](../assets/polyhaven/README.md)；[音樂](../assets/music/README.md)另記來源、署名、授權及處理。新增採用素材才更新清單，本輪沒有把任何歷史參考圖資當作遊戲資產。

地圖來源和解包命令見[原作研究](battle_craft-research.md)，建置與交接流程見[開發交接](DEVELOPMENT.md)。
