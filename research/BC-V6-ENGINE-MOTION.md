# v6-0｜Brood War 移動與接戰：源資料與逐幀實驗

2026-11-28（台灣）。本作基準 v5-9／sim 7；這份是 v6-0 研究，不是遊戲改動。三種證據分開：暴雪資料檔、OpenBW 可重跑行為、Blizzard 原生程式行為（本輪未自行跑原生版）。

## 1. 暴雪資料：移動控制模式必須與四個數值一起讀

[暴雪公開 StarEdit 公告](https://us.forums.blizzard.com/en/starcraft/t/public-staredit-download/457)；官方 CDN 本輪回 503，從 [scmJS 文件所列的轉送](https://docs.scmjs.dev/game-data/getting-the-files/)成功取得同名 zip，SHA-256 `2306b3a82a1c2be7afc2ab2f917d44398ba50462bc47b4af25bc4952b2e17bfa`。mpq 使用 patch_rt 優先，其次 BrooDat，再 StarDat，排除 patch_ed。解析後的 units.dat／flingy.dat 各與固定 [PyMS 測試資料](https://github.com/poiuyqwert/PyMS/tree/6e325d2e9474716fa2be3aca6479ff7d29dbaab5/PyMS/Tests/DAT)逐位元組相同，由獨立覆核再比一次；這不是已確認的 2009 玩家執行檔版本。只保存數據、流程與測試程式於公開庫，不收錄暴雪檔案。

units.dat SHA-256 `da2ee6f116b77329048ec6be9e02721a527fde23d4b05b1b1336e634490abcba`；flingy.dat `89013fa6d81edad96b68efcfc0bb5342f1c7fa2ef7a0880a71b0169eab13d1ad`；iscript.bin `cd35e04eaa8ea95cbbccc980bfaf4cae236f4b18b620dfb4a765822ec32c1cd0`。原始單位 graphics 欄指向 flingy ID；對 209 筆 classic flingy 表依欄讀取 2／4／2／4／1／1／1 bytes（sprite、top、accel、halt、turn、保留、mode）。[格式與解碼](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/data_loading.h#L1629-L1655)。

| 兵種（ID） | Flingy／模式 | DAT 原始 top／accel／halt／turn | 巡航值或腳本估計（px/frame） |
|---|---|---|---|
| 陸戰隊（0） | 78／2 | 1／1／1／40 | 動畫循環平均 4 |
| 重騎兵（66） | 40／2 | 1／1／1／40 | 動畫循環平均 5.25 |
| 飛螳（43） | 11／0 | 1707／67／21745／40 | 6.66797 |
| 刺蛇（38） | 8／2 | 1／1／1／27 | 動畫循環平均 3.71429 |
| 破壞能（68） | 38／0 | 1280／160／5120／40 | 5 |
| 死靈戰機（8） | 80／0 | 1707／67／21745／40 | 6.66797 |
| 戰鬥巡洋艦（12） | 70／0 | 640／27／7585／20 | 2.5 |
| 普通斥候（70）／Artanis（88） | 43／0 | 1280／48／17067／30 | DAT 基礎皆 5；下節實測英雄有效值不同 |
| 自殺蟲（47） | 0／0 | 1707／107／13616／40 | 6.66797 |

論壇版購買對應的英雄 Jim Raynor（20）、Fenix（78）、Kukulza（55）、Hunter Killer（53）、Tassadar/Zeratul（76）、Tom Kazansky（21）、Hyperion（28）、Artanis（88）各指向相同普通型的 Flingy ID；**不代表有效速度等同**。動畫均速取 scmJS 0.18.0 解析 Walking 迴圈，不是每幀瞬時速度；與 BWAPI 的重騎兵 5、刺蛇 3.66、破壞能 4.92 均不混成單一數字。

## 2. 引擎如何用

- mode 0：依條件每 frame 對速度加或減 `accel/256`。距離足時可邊前進邊轉，不是每次轉向都先停；接近航點時還受速度與角差共同影響。煞車門檻在原始滿速且加速度未變時採 `halt/256 px`，其他速度或修改狀態改用 `v²/(2a)` 的定點近似。Stop 對這類單位會在前方先設停點，不是立刻歸零。表值、Stop 實際位移與到點提前減速是三件事。[方程與條件](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L8680-L8747) · [Stop](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L1935-L1959) · [煞車門檻](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L13416-L13425)
- mode 2：Walking 的 `move` 配合動畫 frame 驅動位移；DAT 的 1 不應直接當加速度。mode 1 另有支線，不在本批九種。轉向需區別機身面向與實際速度方向；OpenBW 的非 mode 2 速度方向轉率上限為原值一半，機身面向不是同一上限。[轉向](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L8608-L8678) · [動畫移動命令](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L14962-L14969)
- 接戰用兩道門：何時停止追蹤（可能看武器射程加煞車距離，靶同向前進時有例外），和何時允許開火（武器射程、面向、冷卻等），都不是「中心點一進射程就扣血」。OpenBW 的開火判定沒有適用所有兵種的 speed==0；命令、站定、武器動畫、彈體出生、首次扣血分別記。破壞能地面也有慣性；自殺蟲另有 `follow_ahead_of_unit` 的追擊特例，不能只改速度。[追擊](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L2785-L2829) · [開火](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L2830-L2879)
- 原 2009 SPEED 地圖路線 Trigger #10–17 的 Order(..., attack) 是在路線區域內對部隊下令。OpenBW 按 AttackMove 指向目的地區域中心，能中途接敵再回原令，不等於一直朝核心直走、也不等於每 tick 重選最近敵人。[Order 轉換](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L19260-L19291)

## 3. 已執行：固定版 OpenBW 模擬 50 條軌跡

普通九種加 Artanis，各自從平坦測圖跑 Stop、短距離抵達、巡航轉 90°、轉 180°、AttackUnit。以下是**無障礙測圖、直接注入引擎指令**、每試獨立重新初始化之觀察；未測網路／UI 命令延遲、真人操作或原地圖波次。直線朝東，Stop 與改向在記錄 frame 50 下令。用位置差而非只看速度欄：腳本型與分散位移可能不同。

| 比較 | OpenBW 觀察 |
|---|---|
| 自殺蟲 vs 戰巡 | 巡航 6.668 vs 2.5 px/frame；對齊直線至首次滿速位移為 frame 17 vs 25（相對注入指令的 frame 0）。Stop 後實際再走 59.13 vs 31.89 px，DAT 表是 53.19 vs 29.63 px；不能直接當成停後的實測距離。 |
| 90° 改向 | 第一次角度變動在 frame 52。自殺蟲機頭 +40／速度方向 +20，戰巡 +20／+10；兩者當幀仍在巡航。角度欄以 256 個刻度為一圈。 |
| 重騎兵 | 步行位移非固定，每幀有不同步幅。對靜止地面目標：frame 73 觀測到位置停下且攻擊鎖定、80 第一枚彈體、88 首次扣血；這不是所有站位的固定延遲。 |
| 戰巡開火例外 | 同一類靜止地面靶，frame 127 第一枚彈體可見、這一幀自身仍位移約 0.496 px，frame 129 首次扣血。至少這個 OpenBW 情境不能以「所有單位速度歸零才射」解釋。 |
| 普通斥候／Artanis | 同為基礎 5；實測 OpenBW 普通型最高 5，Artanis 6.668，與其內建速度加成支線一致。[英雄初始化](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L15370-L15412)。不拿 BWAPI 普通速度估值替代原生英雄軌跡。 |

重跑五個重點案例的 CSV 全部逐位元組相同。重騎兵 attack trace SHA-256 `a416ab979be9bbdce63c5ba4f817400faedb67dfff4089fa32fb2a9d913612a6`；自殺蟲 Stop `16390e5dce75336cef3d78061fa79365d1e753743a02766582a35ab9ed28782e`。完整數值及不分發的資料檔保留在雲端研究副本。

### 重現與下一關

1. 在合法取得的來源中備好 patch_rt.mpq、BrooDat.mpq、StarDat.mpq（研究程式讀當前目錄的 StarEdit/ 並依此順序）。使用固定版 OpenBW `4b046d5f65302b10cb0a745f0fecd37ec85b20a8`，不需安裝 UI。以 scmJS 0.18.0 執行 `scmjs map new motion-lab.scx --name badlands --size 64x64 --tileset badlands --players 2`（測圖 SHA-256 `bee65dab73e545d857ad463cbca4a0f2e6986dc8b1cbcf1141b2be39d6801fbd`）。
2. `g++ -std=c++17 -O1 -I/path/to/openbw research/tools/openbw-motion-probe.cpp -o motion-probe`；從含測圖和 StarEdit/ 的工作目錄執行，例 `/path/to/motion-probe 66 attack > dragoon-attack.csv`，情境 `stop`／`turn90`／`turn180`／`arrival`／`attack`。地面靶為 Medic，自殺蟲空中靶為 Science Vessel。資料在每次 next_frame 前採樣，是離散觀察。
3. 原生版下一步：用合法安裝的固定遊戲版和原生 BWAPI 或可逐幀觀察的重播，固定同版地圖、速度、升級、朝向；先同樣的單兵案例，再跑原 SPEED AttackMove 與波次。捕捉命令發出和生效、位置差、速度、機頭、飛彈和目標生命。沒有本輪能用的原生客戶端；StarEdit ZIP 只有編輯器與資料，不等於原生遊戲實測。[AAAI 既有原生運動實測](https://cdn.aaai.org/ojs/12811/12811-52-16328-1-2-20201228.pdf)也把命令延遲、移動與攻擊分開，不能把該研究的常數當本專案預設。

#### 原生版量測注意（2026-11-28，台灣；未執行）

[BWAPI 的延遲補償](https://bwapi.github.io/class_b_w_a_p_i_1_1_game.html)預設會先反映指令的預期結果，不等於引擎已收到或執行。固定原生遊戲與 BWAPI 版本後，關閉量測端的預測（`setLatCom(false)` 並以 `isLatComEnabled()` 確認）；分開記錄邏輯幀、送出指令的幀、當時回報的剩餘延遲，以及初次觀測到的 order／移動目標轉換。不靠減去固定延遲來推定生效幀；Stop 或同一 order 內的變化需連同目標、位置與速度序列判讀。OpenBW 探針是直接設內部命令且在 next_frame 前抽樣，不拿兩邊原始列號直接相減。

比較兩套引擎的位移曲線時，對齊可觀測的指令生效點；研究家門口攔截時另保留從發令到停住、首彈與首次扣血的完整時間。每幀同時記位置差、速度向量、面向、來源／目標彈體 ID、目標血與盾；保持雙方和彈體可見，不能把彈體從 API 消失當成已命中。先重跑自殺蟲、戰巡的 Stop／90°，再量重騎兵首次開火。這是原生驗證計畫，不是原生結果。
