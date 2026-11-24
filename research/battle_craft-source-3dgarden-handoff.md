# 十字對衝／BattleCraft — 原始規則調查與 3DGarden CLI 場景交付規格

> 歷史交接快照。現行專案名稱為 BaattleCraft；樣本解析與來源狀態見[研究報告](battle_craft-research.md)，現行試作見[開發交接](DEVELOPMENT.md)。

**研究日期**：2026-11-24（台灣時間）  
**用途**：供操作 3DGarden MCP 的 CLI／編碼代理閱讀，協助正在進行的《十字對衝》HTML／Web 3D 畫面、場景、模型與材質實驗。  
**新遊戲工作名稱**：**Crossroads Clash — 2v2 Auto-Battle Strategy（十字對衝）**。這是新專案的建議名稱，並非聲稱原圖的官方英文名稱。

> **重要狀態／不要混淆證據**：已定位 2009 年《BattleCraft-Fastblack-SPEED.rar》附件及當年的逐步 Trigger 解說，並取得另一個 FastBlack 地圖版本的公開解析資料；但在本次工具環境中，直接下載 `.rar` 與 `.scx` 二進位檔案失敗，因此**沒有實際解壓、解析 CHK 或逐條逆向 Trigger**。本文件不能當作「已完成原圖反編譯」的報告。請代理以已確認內容建立視覺原型，並把其他內容標註為待驗證。

## 1. 精確識別：哪些是同一系列、哪些不是同一檔

| 來源／版本 | 可核對的事實 | 證據性質 |
|---|---|---|
| **Battlecraft-Fastblack-SPEED**（2009 年台灣玩家教學） | 教學作者將其明確稱為 UMS「十字對衝」；附件名稱 `BattleCraft-Fastblack-SPEED.rar`、46.9 KB；附有 SCMDraft2 截圖及 Marine 購買／攻擊 Trigger 描述 | **A：最貼近要求的直接記錄**；原檔下載未成功 |
| **BattleCraft FB v2.91f.scx**（SCMSCX 索引） | 題名 BattleCraft FastBlack；Space tileset；96×96 tiles；124 個 Location、120 個 Trigger、687 個預置 Unit、0 Doodad、0 Sprite；2 隊玩家群組為 Top/Left、Bottom/Right；檔案約 41 KB | **B：另一個可確認的 FastBlack 版本**；**不可推定**與 SPEED 版 Trigger 完全一致 |
| **BattleCraft**（星海爭霸 II 重製版） | SC2 重製者表示源自 SC1、作者署名 Spikes10012；推薦 1v1 或 2v2；買兵後自動進攻敵方生命水晶、收入自動增長 | **B：續作／重製版的公開設計參考**，非 SC1 SPEED 原檔 |
| **SC2 BattleCraft Hyper Mode**（2011 年改版紀錄） | v2.5.11 紀錄高速模式每 2/3 秒發放資源；v2.5.14 紀錄 Hyper Mode 的單位 timescale = 1.5（移動、攻擊、冷卻等速度提高） | **B：SC2 版本實際改版歷史**；不能直接當成 SC1 SPEED 的數值 |

**原圖下載與研究參考**：

- 2009 年中文教學及附件頁：https://www.gamez.com.tw/t/topic/374947
- 2009 年教學所列原始附件（連結存在，但本次無法取得位元組）：https://www.gamez.com.tw/uploads/short-url/1XtPBgghg6jzzUR5rNLRAceXrnS.rar
- SC1 FastBlack 另一版本及靜態檔案分析：https://scmscx.com/map/7zGY2kzG
- SC2 BattleCraft 地圖製作者說明：https://www.curseforge.com/sc2/maps/battlecraft
- SC2 BattleCraft 版本變更：https://www.curseforge.com/sc2/maps/battlecraft/files/440142
- 3DGarden MCP 官方使用說明：https://www.3dgarden.app/tools/mcp
- 3DGarden 模型收藏：https://www.3dgarden.app/collections

## 2. 已有原始教學逐項證實的 SC1 Trigger 流程

2009 年教學作者以 **Player 1（紅色）購買 Marine** 為例：

1. **購買條件**：玩家礦物 `>= 150`，而且購買控制單位（教學稱 `bring me to beacon`）位於命名為 `Marine` 的 Location；可視化 Beacon 只是標記，實際觸發器判斷的是 **Location 內的控制單位**。
2. **觸發效果**：在 `purchased unit` Location 建立 **12 個 Marine**，從玩家扣除 **150 礦物**，保留觸發器（`Preserve Trigger`）。
3. **移交／出兵**：對紅色玩家執行持續觸發，將 `purchased unit` 的單位移動到 `p1 unit` 區域，並保留觸發器。
4. **自動攻擊**：在目標 `p3 base` 的 Pylon 仍存在的條件下，將紅色玩家位於 `auto attack-vertical` 及 `auto attack-horizontal` 的單位，下達 `Attack` 到 `p3 base`（淺綠方基地）的命令；教學示例 Trigger 中有 `Wait 1.5 seconds`，再 Preserve Trigger。
5. **勝負條件**：原始教學能證明它依敵方基地 Pylon 存活狀態下達攻擊，但**單憑目前可讀文章尚不足以確定完整失敗／勝利 Trigger、所有單位編制、所有價格、實際資源發放頻率**。

下列是根據教學整理的**概念性偽碼**，不是從 `.scx` 匯出的原始碼：

```text
when player[RED].minerals >= 150
 and player[RED].purchase_marker inside Location("Marine"):
    create(12, MARINE, owner=RED, at=Location("purchased unit"))
    player[RED].minerals -= 150
    preserve_trigger()

repeatedly:
    move_units(owner=RED, any_unit, from="purchased unit", to="p1 unit")
    preserve_trigger()

while PYLON exists inside Location("p3 base"):
    issue_attack_order(RED_units inside "auto attack-vertical", target="p3 base")
    issue_attack_order(RED_units inside "auto attack-horizontal", target="p3 base")
    wait(1.5_seconds)  # 教學範例之命令迴圈，非證實全圖更新頻率
    preserve_trigger()
```

**設計意義**：採用「購兵控制點／事件 → 產生兵團 → 轉移至出兵區 → 由戰場位置判定路線與攻擊目標」分層架構。絕對不要把原圖當成一般 RTS 的「開採資源、蓋兵營、手動點兵」模式。

## 3. 另一個 SC1 FastBlack 版本的可用場景資訊（非 SPEED 版保證）

SCMSCX 所解析的 `BattleCraft FB v2.91f.scx` 顯示：

- **地圖方格 96 × 96**，**Space／太空地形**。這是 SC1 tileset 規格，**不等於** WebGL 場景的公尺數。若需把它轉成 3D 世界座標，應自主定義 `worldUnitsPerTile`，不能冒充原始單位。
- **Top/Left** 一隊兩位玩家、**Bottom/Right** 另一隊兩位玩家；支持四邊交會、兩隊對抗的構想。原始 SPEED 版的精確路線與基地座標仍待查檔。
- **124 Locations / 120 Triggers** 說明地圖核心是 Location + Trigger 編排，非 AI 自由尋路的開放世界。
- **0 Doodads、0 Sprites** 是這一版本編輯器內容的統計，不代表 Web 3D 不應加入場景裝飾；建議把裝飾放在道路之外、避免影響路線。
- 該版本的單位自訂名稱含價籤：Marine / Universal Soldier `$150`、Ghost / Elite Sniper `$150`、Zealot / Heroic Paladin `$150`、Dragoon / Foreboding Colossus `$200`、Archon / Mystic Titan `$300`、Goliath / Herculean Defender `$300`、Reaver / Merciless Subjugator `$300`、Battlecruiser / Nuclear Deathship `$500`。**這些是另一個版本的標示價格，不表示每次出兵數量或 SPEED 版價格相同。**
- 其角色編制表還有英雄、砲台、障礙與特殊事件；原始 SPEED 版的英雄／特殊能力細節仍不能確定。

## 4. SPEED 的「速度」代表什麼：已知與未解

- **已知**：2009 年原始教學的檔名確實帶有 `SPEED`。
- **已知，但只屬於 SC2**：2011 年 SC2 Hyper Mode 改版紀錄支持「資源發放頻率提升」及「單位戰鬥節奏加快」確實是該系列採用過的設計。
- **未驗證**：SC1 `Battlecraft-Fastblack-SPEED` 是否提高金錢增長、採購重複速度、兵團生出倍率、單位行走／攻速，或同時提高這些數值。**不要**把 SC2 Hyper Mode 的 1.5 倍或 2/3 秒直接套入 SC1 原圖。

視覺原型可以實作可切換的 `normal`／`speed` 測試**預設值**，但要明確標示為專案新設定，而非歷史復原：

```json
{
  "note": "Illustrative prototype parameters, NOT extracted from the original map",
  "normal": {"incomeIntervalSec": 1.0, "incomePerTick": 10, "spawnEffectSpeed": 1.0},
  "speed": {"incomeIntervalSec": 0.67, "incomePerTick": 10, "spawnEffectSpeed": 1.5},
  "verifiedExample": {"unit": "marine", "bundleCount": 12, "bundleCostMinerals": 150}
}
```

其中 `normal` 與 `speed` **全部是暫定展示參數**；只有最後 `verifiedExample` 是 2009 年教學確定展示的範例。動畫展示速度亦不應直接改變尚未定案的網路遊戲同步邏輯。

## 5. 給 3DGarden CLI／MCP 的工作定義（優先處理視覺，不重寫遊戲）

### 5.1 設計目標與視角

將《Crossroads Clash》做成 **可清楚辨識四個玩家基地與十字戰線的俯視／斜俯視 3D RTS 戰場**。突出「兩隊對衝」「大批自動行軍」「中間交火」「少量決策、高頻出兵」，而不是基地經營。優先順序：**戰場辨識性 > 單位辨識性 > 效能 > 裝飾華麗度**。

- 四名玩家在十字道路四端，向中心交戰；以 **N/E/S/W** 作為**新原型的建模座標**，不是宣稱已恢復 SC1 原始座標。
- 暫用團隊 `{N,W}` 對 `{S,E}` 畫面範本（基於另一版本的 Top/Left vs Bottom/Right），但保留從現有遊戲邏輯讀取隊伍的能力；不要把這個範本硬寫進正式邏輯。
- 中央十字交會處是持續交火焦點。走廊寬度與視距依現有角色密度調整，必須能看清楚兵群前後關係。
- 每個端點有**固定、可破壞的基地核心（life crystal / pylon 對應概念）**，可用原創能量核心造型；這不是玩家自行建造的建築物。
- 購兵操作可以用現有 UI 或場上的信標區域做呈現，但**沒有一般 RTS 的玩家建造建築流程**。
- 任何裝飾品、路障、玻璃、邊框不可遮住購兵區、戰場路線、單位及生命值指示。

### 5.2 場景區域與場景圖（示意，非原圖精確幾何）

```text
                 [North Player Core]
                         │
                 Northern Lane
                         │
[West Core] ─────── CENTRAL CLASH ─────── [East Core]
                         │
                 Southern Lane
                         │
                 [South Player Core]

Behind each core: spawn staging space / purchase UI indication
Beyond lanes: non-colliding props / decorative outer environment
```

請把 **遊戲碰撞與路徑導航** 跟 GLB 的裝飾網格分離：

```text
Scene
├─ Ground / Background
├─ Navigation (invisible road segments + battle regions)
├─ FourLaneMeshes (visuals, no surprise collision)
├─ CenterArena (visual emphasis, no obstructive wall)
├─ BaseCores (4 fixed objectives, team accent)
├─ SpawnEffects (4 places, easily visible)
├─ DecorativeProps (instanced; outside combat walkways)
├─ Units (currently existing game actors; do not replace logic)
├─ VFX (lightweight, pooled)
└─ UIOverlay (money, shop, teams, HP, timer)
```

### 5.3 三種優先嘗試的美術風格

**A. Sci-fi industrial（第一優先，貼近原版 Space tileset）**：深灰金屬／磨損地板、模組化艙板、冷色發光路邊條、四角基地能量核心。利用光色區分隊伍，但地面對比不可吞掉兵種輪廓。

**B. Stylized low-poly（效能對照組）**：單純塊面、低面數、明確大色塊、簡潔陰影，便於大量小兵和手機瀏覽器讀取。

**C. Tactical hologram（介面辨識組）**：暗色底座、網格路線、低透明度的光帶；慎用大面積透明材質，避免排序與過度繪製。

### 5.4 材質規格與建議（均屬新遊戲設計，不是原圖貼圖參數）

| 物件 | 推薦材質方向 | 測試要點 |
|---|---|---|
| 主路面 | 金屬面板或深色石／混凝土 PBR；粗糙度中高 | 地面保持均勻明度，避免搶走士兵視覺 |
| 場外底座 | 暗色礫石或空間艦體板件 | 簡單、不使用複雜碰撞 |
| 基地核心 | 自發光晶體／能量容器，4 色陣營環 | 在戰鬥特效下仍可辨認 HP 與陣營 |
| 兵團單位 | 共享主材質、用小面積顏色強調所屬隊伍 | 優先 InstancedMesh 或合批，不隨士兵數線性增加昂貴 draw call |
| 導引光條 | 低強度 emissive 線條 | 不是實際動態點光源；避免 Bloom 過強 |
| 爆炸與槍口火光 | 短生命週期 sprite／粒子／材質動畫 | 避免大量真實光源與半透明 overdraw |

### 5.5 3DGarden：是模型庫 + MCP，不是自動重建 StarCraft 的工具

官方 MCP 伺服器：`https://www.3dgarden.app/mcp`，需要自己的 API key；模型以 **GLB/glTF** 為主，適合在 Three.js 等環境使用。官方提供 `search_models`、`get_model`、`preview_scene`、`download_model`、`get_collection` 等能力。不可假定一定有科幻士兵／能量核心；缺件時要使用程序化幾何或清楚標記替代品。

Codex CLI 的官方 MCP 設定範例：

```bash
# 先在自己的環境安全設定 GARDEN_KEY，勿把金鑰寫入 Git 倉庫。
codex mcp add 3dgarden --url https://www.3dgarden.app/mcp --bearer-token-env-var GARDEN_KEY
```

推薦搜尋詞（先搜尋、再看實際模型預覽，禁止虛構已存在的 model slug）：`low poly sci fi`, `metal`, `industrial`, `construction`, `concrete`, `barrier`, `bollard`, `crate`, `light`, `energy`, `robot`, `weapon`。可先檢視現有 **Construction**、**Pixel art**、**Weapons** 等 collection，注意這些僅是「可搜尋方向」，不保證符合視覺或尺寸。呼叫 `get_model` 時紀錄幾何實際尺寸、原點、三角形數、draw calls、材質與動畫；用 `preview_scene` 先驗證風格相容，再下載合適素材。

官方資訊記載 3DGarden 使用者可取得網頁優化的 GLB，有些含 Draco 壓縮；若 Three.js 載入需配 `DRACOLoader`。注意文件授權條款，**不要把原版星海爭霸單位、貼圖或音效直接當成可商用的原創素材**。

## 6. CLI 代理工作命令（可以直接整段貼入下一個工作階段）

> 請閱讀本 Markdown，以現有 Crossroads Clash／十字對衝專案原始碼為基礎，只處理 3D 場景、材質、燈光與素材引入。先檢查目前的 Three.js／渲染引擎及地圖程式，不要重寫購兵、資源、戰鬥、房間同步與勝負邏輯。建立可切換 A「Sci-fi industrial」與 B「Stylized low-poly」的場景視覺方案。四邊玩家基地、十字道路與中央交火區必須保持清楚；不加入玩家蓋建築機制。透過 3DGarden MCP `search_models`、`get_model`、`preview_scene` 找適當模型，標明每個模型的名稱、實際 slug、來源、尺寸、面數、貼圖、授權與 URL，確認後再 `download_model`；沒有適合模型就用程序化幾何 placeholder，不能捏造素材庫資源。把渲染模型與路徑／碰撞邏輯分離；大量小兵須採批次化、物件池或 instancing 優化。所有 `SPEED` 模式數值都視為待核實，勿假冒從原始 `.scx` 擷取。提供前後對照截圖、模型清單、載入效能、draw calls、FPS、可回復的程式差異，並在完成後列出對現有遊戲邏輯的零或最小影響。

## 7. 完成條件／驗收規格

1. 同一個畫面下能辨識 **四玩家基地、四臂道路、中央戰鬥交會區**；近看能辨識隊伍與生命值。
2. **沒有額外的玩家建築建造操作**。基地核心為固定目標。
3. 3D 素材有真實來源清單；實際用到的 3DGarden 模型均確認存在、可下載、可載入，沒有無根據的 slug 或授權聲明。
4. 在不影響現有 2v2 自動出兵／戰鬥的前提下，A/B 風格能替換；有未修改遊戲邏輯的佐證（diff 或測試）。
5. 記錄桌面與手機的幀率、render calls、triangles、texture memory／載入時間（實際環境允許多少就量多少，**不捏造效能數字**）。
6. 保留純幾何 fallback 與可回退方案；失去 3DGarden 金鑰時遊戲不應不能啟動。

## 8. 尚待原檔的實證工作

如果日後能取得 RAR 位元組，應**先離線靜態檢查**，再解包 `.scx`，並比對教學中的 `Marine`, `purchased unit`, `p1 unit`, `auto attack-vertical`, `auto attack-horizontal`, `p3 base` 等 Location/Trigger。

```bash
# 當且僅當已取得真實 RAR 檔，且在隔離環境中：
file BattleCraft-Fastblack-SPEED.rar
sha256sum BattleCraft-Fastblack-SPEED.rar
7z l BattleCraft-Fastblack-SPEED.rar
7z x BattleCraft-Fastblack-SPEED.rar -o./battlecraft_extracted
file ./battlecraft_extracted/*
# 用支援 StarCraft MPQ / scenario.chk 的離線工具解出 scenario.chk，
# 分析 DIM、MTXM、MRGN、TRIG、STR、OWNR、SIDE、UNIx 等 CHK sections。
```

原始 `.rar` **不等於**已通過安全檢查；解壓前檢查路徑穿越、意外可執行檔與可疑腳本，避免執行附件中的程序。取得檔案後再抽取並逐條確認：

- 買兵的成本與每次數量（完整兵種表、是否存在英雄與特殊技）
- 每位玩家／每條道路的 Location 座標與實際 Target 規則
- 每隔幾秒產生金錢、擊殺是否加錢、速度模式是否改變收入頻率
- `Preserve Trigger`／`Wait` 的實際執行節奏、是否存在防止重複購買的額外條件
- Pylon／基地被破壞後的獲勝條件、離線或離場玩家處理

**結論**：這份文件已具備足夠的**可考證玩法骨架**與 **3DGarden 場景試作規格**，可直接交給 CLI 做視覺／材質實驗；但**未達成原始 SPEED RAR 的實體解壓與完整逆向**，不能拿它當成完整版原圖規則表。
