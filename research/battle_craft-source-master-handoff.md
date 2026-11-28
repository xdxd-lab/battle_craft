# BattleCraft／十字對衝：跨 AI 研究與 3D 開發總交接文件

> 歷史交接快照。現行專案名稱為 BaattleCraft；樣本解析與來源狀態見[研究報告](battle_craft-research.md)，現行試作見[開發交接](DEVELOPMENT.md)。

**版本：** 1.0  
**整理日期：** 2026-11-24（Asia/Taipei）  
**交接對象：** Claude Code、Codex、其他 CLI／自主程式代理、3DGarden MCP 代理  
**用途：** 了解原始遊戲、盤點可用數據與 3D 資產、延續 Web 3D 畫面和材質實驗。  
**本文件是彙整與研究規格，不是聲稱已完整解碼原始地圖。**

## 0. 給接手 AI 的第一段話（請先讀）

這是玩家開發的《星海爭霸 1》UMS 地圖「十字對衝」的研究與 Web 遊戲重製。搜尋名以 **BattleCraft／BattleCraft FastBlack／Battlecraft-Fastblack-SPEED** 為主。新 Web 遊戲可暫稱 **Crossroads Clash — 2v2 Auto-Battle Strategy**；這個英文名稱是新專案的建議名稱，不是原地圖官方名稱。請先檢查現有遊戲原始碼，不要從零重寫，不要改動既有購兵、戰鬥、資金、網路同步和勝負邏輯；目前優先任務是**可合法使用的 3D 模型／材質、四臂戰場可讀性和效能**，同時持續追查原圖數值。報告中必須區分「SC1 Speed 原圖」「SC1 FastBlack 其他版本」「SC2 BattleCraft 重製版」「自行提議的 Web 原型值」。

### 可信度標記

- **V：本次已直接核對網站／官方文件**（2026-11-24）；不代表已下載二進位內容。
- **P：先前的研究報告／頁面索引記錄**；本次未重新直接檢查底層檔案，使用時需複驗。
- **R：衍生版本或普通 StarCraft 的參考資料**；不得直接套成 SC1 SPEED 的數值。
- **U：未驗證／未知**；不能編造精確值。
- **D：新 Web 遊戲設計建議**；不是歷史事實。

## 1. 使用者要求與重製邊界（D）

- **四名玩家**，各位於十字形道路四端，構成 **2v2** 對抗。
- **不玩一般 RTS 建築建造流程**。玩家以購兵介面／信標購買成群單位；部隊生出後自動行軍、交火，最後攻擊敵方核心。原地圖其他版本可能提供防禦或特殊能力，但不要因此擅自加入玩家蓋建築操作。
- 正在研製 HTML／Web 3D 場景；這一輪主要探索 **3DGarden、GLB 模型、場景設計、材質與動畫品質**。優先保持既有遊戲功能、改動可回退。
- 希望回憶中的 **SPEED** 版有更快出兵及收入，但該具體倍率仍待從原始 SC1 Trigger 確認。

## 2. 版本與原作資料：切勿混為一談

| 版本 | 來源 | 已知／限制 | 級別 |
|---|---|---|---|
| SC1 `BattleCraft-Fastblack-SPEED.rar` | 2009 年中文 UMS 觸發器教學 https://www.gamez.com.tw/t/topic/374947；先前記錄附件 https://www.gamez.com.tw/uploads/short-url/1XtPBgghg6jzzUR5rNLRAceXrnS.rar | 先前研究記錄該文提供「十字對衝」示例及 46.9 KB RAR。**RAR 本體尚未實際下載／解壓／解析**；本次網頁直接存取有 502。 | P/U |
| SC1 `BattleCraft FB v2.91f.scx` | https://scmscx.com/map/7zGY2kzG | SCMSCX 頁面存在；由於網站靠 JavaScript 呈現，當前文字擷取不能獨立驗證其所有統計；先前研究記錄 Space 96×96、124 Locations、120 Triggers、687 事先配置單位。這是**不同 FastBlack 版本**，不是 SPEED 本體。 | V（頁存在）／P（數值） |
| SC2 `BattleCraft` | https://www.curseforge.com/sc2/maps/battlecraft | 作者頁明述「由 SC1 作品重製」，原作者署名 `Spikes10012`；建議 1v1 或 2v2；買「兵團」、兵團自動攻向敵方 Life Crystal；金錢自然增加，擊殺促進收入／瓦斯。 | V，但屬 R |
| SC2 `BattleCraft` changelog | https://www.curseforge.com/sc2/maps/battlecraft/files/440142 | 2011-10-11 v2.5.11 Hyper Mode 礦物與 terrazine 每 2/3 秒給一次；2011-10-21 v2.5.14 unit timescale 1.5。**不可當作 SC1 SPEED 參數**。 | V，但屬 R |
| SC2 作者 Unit Stat Spreadsheet | 從 CurseForge 頁面「Unit Stat Spreadsheet」跳轉；先前記錄 URL https://docs.google.com/spreadsheets/d/1yffV3wtjpGJiqRcktuNPU8TQUSFzTbt-xSIklNTUXZ8/edit | 作者網頁確認有此入口，但試算表實際內容及權限本次未讀取。 | V（入口）／U（內容） |

### SC1 中文教學所描述的購兵與自動攻擊骨架（P，待原檔複驗）

教學中的 Marine 範例：擁有至少 **150 礦物**，將購兵控制單位移入標成 `Marine` 的 Location → 建立 **12 名 Marine**，扣除 **150 礦物**，透過 Preserve Trigger 重複作用 → 搬運到 `p1 unit` 出兵區 → 進入 `auto attack-vertical`／`auto attack-horizontal` 區域的單位，向 `p3 base` 敵方基地執行 Attack；示例命令流程有約 **1.5 秒 Wait**。**這是教學範例而非解析了全部 120 個 Trigger**，不能推論所有購兵價格、兵種或全域 Tick 週期。

**開發架構建議（D）：** 購買判定 → 扣款與兵團生成 → 派遣至出兵點 → 道路位置／敵方目標判定 → 自動交戰 → 基地生命／結束條件。將戰場導航、邏輯狀態與 3D 顯示分離。

## 3. 先前網站索引記錄的 FastBlack 單位名稱（P，需 Trigger 複驗）

下表的金額是**自訂名稱中顯示的文字**，目前未從 SCX 的實際扣款 Trigger 證實，且不代表單兵價格或 SPEED 版價格。

| 原 StarCraft 物件 | FastBlack 自訂名稱 | 顯示文字 |
|---|---|---|
| Marine | Universal Soldier | $150 |
| 鬼子（Ghost） | Elite Sniper | $150 |
| Zealot | Heroic Paladin | $150 |
| Dragoon | Foreboding Colossus | $200 |
| Archon | Mystic Titan | $300 |
| Goliath | Herculean Defender | $300 |
| 掠奪者（Reaver） | Merciless Subjugator | $300 |
| Battlecruiser | Nuclear Deathship | $500 |
| 特殊項 | Super Zergling | $1,000 |
| 特殊項 | Construct Stronghold | $600 |
| 特殊項 | Erect Blockade | $2,000 |
| 特殊項 | Everlasting Elixir | $2,500 |
| 特殊項 | Control Enemy Units | $8,000 |

**禁止混淆：** `Marine $150` 不等於一名 Marine 價值 150；已知教學範例是「150 買 12 名」。特殊項可能是購買控制物件或技能，不能把底層 Unit ID 的 StarCraft 物件名稱當成畫面中真實生成的單位。

## 4. 3D／貼圖素材清單、授權與取用策略

| 來源 | 連結 | 用途 | 已知授權／注意 |
|---|---|---|---|
| **3DGarden** | https://www.3dgarden.app/ ; MCP https://www.3dgarden.app/tools/mcp ; 授權 https://www.3dgarden.app/licence | 搜尋 WebGL 適用 GLB 模型、預覽場景、匯入專案 | **V**：2026-10-30 條款允許商用／修改／嵌入遊戲；禁止以模型檔本身收費；檢查模型實際是否存在 |
| **Quaternius Modular Sci-Fi Megakit** | https://quaternius.com/packs/modularscifimegakit | 科幻道路、艙板、牆面、模組場景 | **V**：頁面列 277 models、CC0，**免費和付費／來源包內容須區別** |
| **Quaternius Ultimate Modular Sci-Fi** | https://quaternius.com/packs/ultimatemodularscifi.html | 工業艙室、室內道具 | **V**：46 models、CC0；格式 FBX/OBJ/Blend，可能需自行轉 GLB |
| **Poly Haven** | https://polyhaven.com/ ; https://polyhaven.com/license | PBR 金屬、混凝土、HDRI | **V**：站內資產 CC0 |
| **ambientCG** | https://ambientcg.com/ | PBR 材質 | **P**：先前研究記錄 CC0；下載前再檢查個別條款 |
| **Kenney Sci-Fi RTS** | https://kenney.nl/assets/sci-fi-rts | 2D UI、圖示 | **P**：先前研究記錄 CC0；**不是 3D GLB** |
| **SC2Mapster Asset Explorer** | https://asset-explorer.sc2arcade.com | 研究星海爭霸視覺／模型的造型 | 非再利用授權；僅作參考 |
| **Brood War Map Graphics** | https://github.com/dada78641/bwmapgfx | 研究原版地形與單位 2D 圖像 | Blizzard 著作權；**不要未經授權放到獨立 Web 遊戲** |
| **Brood War 動畫擷取** | https://github.com/broodwar-live/assets-pipeline | 研究動畫與拆圖流程 | 擷取能力≠可轉授權 |
| **SC2 TLMC 素材** | https://github.com/avexyli/StarCraft2-TLMCFriendlyAssets | 星海二代地圖美術參考 | 先前資料指向遊戲內非商用限制；不要視為自由素材 |

**設計原則（D）：** 星海爭霸原作的圖像／模型只用於研究「畫面、比例、節奏」，獨立發佈版使用授權明確的第三方模型或自行製作的科幻造型，避免複製具辨識度的受保護角色與圖示。

## 5. 推薦場景方向（D）

### 地圖結構與玩法保護

```
                         [玩家北：固定基地核心]
                                    │
                               北側道路
                                    │
[玩家西：固定核心] ─────── 中央交戰樞紐 ─────── [玩家東：固定核心]
                                    │
                               南側道路
                                    │
                         [玩家南：固定基地核心]
```

- 這是新 Web 遊戲的**示意圖**，不是從 SCX 提取的精確座標；隊伍配置由現有程式決定。
- 攻擊單位以兵群為單位進場，保留強烈的道路方向辨識與中央交戰焦點。
- 固定基地是勝負目標，不代表增加玩家建造功能。
- 渲染用 GLB 與導引／碰撞形狀分開，避免新模型阻斷路徑。

### 視覺 A/B 測試

- **A 工業科幻（建議主方案）：** 金屬平台、艙板、低強度燈條、簡潔能量核心；以原創美術回應舊 Space tileset 氛圍。
- **B 低多邊形（性能對照）：** 共享材質、鮮明陣營配色、有限陰影，適合大量單位與手機。
- **C 戰術全息（可選）：** 發光網格、路線強調、抽象單位與科技 UI；注意透明 overdraw。

### 資產導入要求

1. 先辨識目前使用 Three.js、Babylon.js 或其他引擎；不假定可以直接插入陌生套件。
2. 搜尋和預覽 `sci-fi floor`、`industrial panel`、`crate`、`robot`、`barrier`、`crystal`、`platform` 等；**搜尋不代表存在**。
3. 每個最終採用的模型記錄：來源 URL、作者、授權、擷取日、實際 slug、座標原點、幾何尺度、頂點／三角面、材質與貼圖、動畫、壓縮方式、檔案 KB。
4. 同場景可替換 A/B 材質與模型，並保持既有 2v2 購兵／戰鬥行為不變。
5. 盡量採 instancing、共用材質、物件池、LOD 或批次等方法減少 draw call；性能數字應實測，不可杜撰。
6. 如沒有合適 GLB，使用程序化 placeholder；在無 MCP／無 API key 時也能執行基本畫面。

## 6. 3DGarden MCP（官方核對的接法）

官方文件：https://www.3dgarden.app/tools/mcp 

```bash
# Codex：先安全設定 GARDEN_KEY，勿將金鑰提交 Git
codex mcp add 3dgarden --url https://www.3dgarden.app/mcp --bearer-token-env-var GARDEN_KEY

# Claude Code：官方示例；請自行安全保管 token
claude mcp add --transport http 3dgarden https://www.3dgarden.app/mcp \
  --header "Authorization: Bearer YOUR_KEY"
```

該 MCP 的官方工具包含 `whoami`、`search_models`、`get_model`、`find_matching`、`preview_scene`、`get_collection`、`download_model`。`preview_scene` 可呈現最多 12 個模型；`download_model` 回傳的 GLB URL 有效約 15 分鐘。**尚未在本次交接流程用真實 key 下載任何模型**。

## 7. SC1 地圖解析：官方確認的 scmJS 命令

文件：https://docs.scmjs.dev/cli/getting-started/ 、https://docs.scmjs.dev/cli/looking-inside-a-map/。此工具需可存取外網；npm 安裝需 Node.js 22.12+。

```bash
npm install -g @scm-js/cli
scmjs about
mkdir -p maps analysis
scmjs map fetch --id 7zGY2kzG --out maps/
# 請先列出實際下載檔名，不要假定完全等於網頁顯示名稱
find maps -maxdepth 1 -type f -print
# 以實際存在的檔案路徑取代 /path/to/ACTUAL.scx
SCX='/path/to/ACTUAL.scx'
scmjs map info "$SCX" --json > analysis/map-info.json
scmjs map dump "$SCX" --json > analysis/map-dump.json
scmjs map dump "$SCX" > analysis/map-dump.txt
scmjs map triggers export "$SCX" > analysis/triggers.txt
scmjs map check "$SCX" > analysis/map-check.txt
scmjs map find Marine "$SCX" > analysis/marine-hits.txt || true
```

上列是**文件支援而非本次已執行成功**的命令。若提供其他 RAR，先在隔離目錄檢查附檔名、雜湊、解壓成員路徑與可疑執行檔，再解壓；不要執行不明程式。`map preview` 若需 Blizzard 地形圖像，可能需要合法安裝的遊戲圖資。

### 交付結構化數據（建議由下一個 AI 生成）

- `units.csv`: `source_map,base_unit_id,custom_name,display_price,hp,shields,armor,ground_damage,air_damage,weapon_cooldown,range,speed,source_evidence,verification_status`
- `purchases.csv`: `source_map,trigger_number,buy_location,resource_cost,spawn_unit,spawn_count,spawn_location,conditions,source_evidence,verification_status`
- `economy.csv`: `source_map,trigger_number,starting_money,income_amount,income_interval,kill_reward,speed_mode_effect,source_evidence,verification_status`
- `orders.csv`: `source_map,trigger_number,owner,source_location,order_type,destination_location,reissue_interval,source_evidence,verification_status`
- `assets.csv`: `asset_name,source_url,provider,licence,download_date,file_path,format,triangles,draw_calls,texture_size,verification_status`

**資料要求：** `source_map` 保留真正檔名與 SHA256；一切值有 `verification_status`；沒有查到就 `unknown`／空白，不可填入 SC2 或通用 StarCraft 值。

## 8. 建議工作順序／驗收

### Track A — 素材與畫面（用戶當前優先）
1. 讀取現有 Web 專案，記錄當前入口、引擎、攝影機、移動與戰鬥更新迴圈。
2. 3DGarden 實際搜 10–20 個候選物件，預覽後挑 3–8 個；若不足，取 Quaternius／Poly Haven 或程序化備援。
3. 做 A/B 場景風格切換。保留四端基地、路線、中央交火；不引入建築操作；以無 GUI／無模型備援確保可啟動。
4. 交付截圖／視角影片（依工具實際可行）、資產來源表、fps/draw calls/三角面、修改檔案清單、回滾方式。

### Track B — 研究還原（與畫面工作分離）
1. 優先取得並解析 `BattleCraft-Fastblack-SPEED.rar`；若取得失敗，研究 `BattleCraft FB v2.91f.scx`，並**保留版本差異**。
2. 匯出完整 Trigger、Location、單位客製化設定與勝負條件；推導收入、購兵價格和每次兵團數量。
3. 驗證 SC1 SPEED 是否「資金較快」「出兵較快」「單位速度較快」，將答案與具體 Trigger 編號或測試記錄綁定。
4. 試著合法讀取 SC2 作者數值表，放入另一個資料來源分頁或 CSV，不能與 SC1 混在一起。

### 不可做／必要警示
- 不得聲稱已下載、解壓、執行原始 SCX 或下載 GLB，除非有真實檔案、SHA256、分析輸出。
- 不得將其他 BattleCraft 版本或 SC2 Hyper Mode 數值套入 SPEED 版。
- 不得自行捏造作者、版本、模型 slug、素材授權或性能測試數據。
- 不得未確認現有程式邏輯就重寫遊戲；視覺層與戰鬥層必須解耦。
- 不得在程式碼或 Git 提交中洩漏 3DGarden API Key。
- 不得把 Blizzard 受著作權保護的原版角色與素材當成 CC0／通用素材。

## 9. 完整原始連結索引

- 原台灣中文 Trigger 教學：https://www.gamez.com.tw/t/topic/374947
- 教學附件（先前記錄）：https://www.gamez.com.tw/uploads/short-url/1XtPBgghg6jzzUR5rNLRAceXrnS.rar
- SC1 FastBlack 地圖索引：https://scmscx.com/map/7zGY2kzG
- SC2 BattleCraft 作者介紹：https://www.curseforge.com/sc2/maps/battlecraft
- SC2 改版紀錄：https://www.curseforge.com/sc2/maps/battlecraft/files/440142
- 作者 Unit Stat Spreadsheet（待驗證開啟）：https://docs.google.com/spreadsheets/d/1yffV3wtjpGJiqRcktuNPU8TQUSFzTbt-xSIklNTUXZ8/edit
- scmJS CLI：https://docs.scmjs.dev/cli/looking-inside-a-map/
- scmJS 安裝：https://docs.scmjs.dev/cli/getting-started/
- 3DGarden MCP：https://www.3dgarden.app/tools/mcp
- 3DGarden 授權：https://www.3dgarden.app/licence
- Quaternius Sci-Fi：https://quaternius.com/packs/modularscifimegakit
- Quaternius 內裝：https://quaternius.com/packs/ultimatemodularscifi.html
- Poly Haven：https://polyhaven.com/license
- Kenney：https://kenney.nl/assets/sci-fi-rts
- ambientCG：https://ambientcg.com/
- StarCraft 圖資參考：https://github.com/dada78641/bwmapgfx

## 10. 接手 AI 可直接照做的最終指令

> 請將本檔視為專案事實與任務邊界，不要自行補完未確認資料。第一步讀取既有 Crossroads Clash／十字對衝程式碼和資產結構，確認 2v2 自動出兵、資金及戰鬥機制的位置；不要修改遊戲規則。第二步用 3DGarden MCP 的 `whoami`、`search_models`、`get_model`、`preview_scene` 找並評估可以合法放進獨立 Web 遊戲的工業科幻／低面數素材，必要時用 Quaternius CC0 或程序化模型，做一套可切換的 3D 材質與場景實驗；每件素材附來源和授權、GLB 載入測試與 FPS／draw call 結果。第三步（若有網路與 Node 環境）使用 scmJS 下載並分析 SC1 FastBlack 地圖，輸出 `units.csv`、`purchases.csv`、`economy.csv`、`orders.csv`，並以 Trigger 編號佐證；優先追查 SPEED 版來源檔，切勿拿 SC2 Hyper Mode 代替。輸出實際修改項目、可用測試結果、失敗與限制、下一步，保持程式與研究結果可回溯。

---

**附件**：此交接包另含前兩次調查全文，供深度查閱。**交接結果不是已完成程式開發的聲明，也未包含原始 `.scx`、RAR、Blizzard 素材或 3DGarden 已下載 GLB。**
