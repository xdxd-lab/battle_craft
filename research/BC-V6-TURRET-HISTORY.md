# 2009 BattleCraft FastBlack SPEED：額外防禦塔

以下是 [2009 論壇原 SCX 附件](https://www.gamez.com.tw/t/topic/374947/11) 的實際設定，**不是一般《星海爭霸》的預設值，也不是網頁版已決定的平衡數值**。依附檔的 CHK `UNIx` 讀生命、盾、護甲、傷害；以 Brood War `units.dat` 取武器 ID、以 `weapons.dat` 讀傷害類型、射程、冷卻、目標類別。

| 塔（unit ID） | HP／盾／固有護甲 | 攻擊類別、武器 ID | 原地圖每發基礎傷害 | 名義冷卻（引擎 frame） | 名義最大射程 |
|---|---:|---|---:|---:|---:|
| Photon Cannon（162） | 6,000／6,000／60 | 地面 80、空中 81；兩者普通傷害 | 地 600、空 600 | 22 | 224 px，7 格 |
| Spore Colony（144） | 6,000／0／60 | 只對空 52，普通傷害 | 800 | 15 | 224 px，7 格 |
| Sunken Colony（146） | 6,000／0／60 | 只對地 53，爆炸傷害 | 1,200 | 32 | 224 px，7 格 |

- 四個武器槽的最小射程均為 0、傷害 factor＝1、`UNIx` 每級傷害升級＝0、無範圍傷害。重疊的地、空兩個武器 ID 是 Photon Cannon 依目標所選，不能當成同一砲火雙發。實際命中傷害另看盾、護甲、體型；名義冷卻不是牆鐘秒數或逐幀實測。
- Photon Cannon 與 Spore 可偵測隱形／遁地，Sunken 本身不偵測。偵測範圍與視野不同；Blizzard 對這兩種固定塔都列 7 格偵測。原附件 #8 的 Havoc 規則在 `Elapsed Time >= 600` 後變為持續把全圖的盾歸零；因此 Cannon 的 6,000 盾是地圖最大額定值，並非 Havoc 期間的實際持盾。[Blizzard 神民標準表](https://classic.battle.net/scc/protoss/pstats.shtml) · [Blizzard 蟲族標準表](https://classic.battle.net/scc/zerg/zstats.shtml)
- 所有十份已覆核的 SPEED 鏡像，三塔的歸屬預設旗標、生命、盾、護甲和四個武器槽的傷害覆寫完全相同；不代表全部 `UNIx` 均相同。原附件及 [2tzpVkp9](https://scmscx.com/map/2tzpVkp9) 的 4,168-byte `UNIx` 恰好全同。
- [非 SPEED v2.91f](https://scmscx.com/map/7zGY2kzG) 另外：Cannon 5,000 HP／5,000 盾／50 護甲，地空各 100；Spore 和 Sunken 皆 7,500 HP／0 盾／75 護甲，傷害各 1,000；地空類別、名義冷卻／射程仍同武器原始資料。該版購買各 200 礦，另外開啟該席核心（金字塔 Pylon）的無敵不是塔自己無敵，不能移回作原附件設定。
- 複驗來源：[`weapons.dat` fixture](https://raw.githubusercontent.com/poiuyqwert/PyMS/6e325d2e9474716fa2be3aca6479ff7d29dbaab5/PyMS/MPQ/arr/weapons.dat) SHA-256 `80de165015519f9bed46ea8858195c2d2d0120b65b9e55e1c0a50b19135f4b62`；[`units.dat` fixture](https://raw.githubusercontent.com/poiuyqwert/PyMS/6e325d2e9474716fa2be3aca6479ff7d29dbaab5/PyMS/MPQ/arr/units.dat) SHA-256 `da2ee6f116b77329048ec6be9e02721a527fde23d4b05b1b1336e634490abcba`。原 SCX SHA-256 `2c174ba874184625a0e61dd3eea50f5c11ac0918137212206f20de15e922cd29`；原 `UNIx` SHA-256 `13ffee7ca8acb606941abb8e56ebc20d26022938ce5282d7056241d6e477b775`。亦以 [BWAPI WeaponType](https://github.com/bwapi/bwapi/blob/d727fed68558c506163048ea889131d8cbb33915/bwapi/BWAPILIB/Source/WeaponType.cpp) 和 Blizzard 標準表核對武器類別／射程／冷卻。

## 原附件購買／替換規則

- `TRIG` #42–45 Cannon；#46、48–50 Spore；#47、51–53 Sunken。條件：本席至少一名 Terran Civilian 在該種類購買區，礦至少 500。順序：扣本席 500 礦 → 擊殺旗區內本席所有 Civilian → 對本席唯一額外塔區中的 `All Players / Any unit` 執行 Kill Unit At Location → 為本席建立一座選定塔。三款都沒有給無敵的動作。
- 每個席位／種類分別一條 Trigger，皆未 `Preserve`。所以每席每種類只觸發一次，但**不是**「全場只能三選一」；換另一種會先清掉同位置的舊塔，換了也**不會**重新解鎖用過的種類。不可與原圖一開始每席預置的六座 Photon Cannon 混淆；「共用一格」只限購買的額外塔。
- 以下為原圖 CHK 像素座標（左上原點，每格 32 px），是矩形中心，不保證引擎碰撞時實際建塔偏移為零。

| 座位 | 額外塔區 1-based MRGN | 矩形 | 中心 |
|---|---:|---|---|
| 北 P1 | 50 | (1472,32)–(1536,96) | (1504,64) |
| 西 P2 | 52 | (224,1216)–(288,1280) | (256,1248) |
| 南 P3 | 54 | (1472,2432)–(1536,2496) | (1504,2464) |
| 東 P4 | 56 | (2720,1216)–(2784,1280) | (2752,1248) |

Cannon 購買區是 MRGN #62，Spore #53，Sunken #51；不要把買塔旗區當砲台位置。原附件的額外塔結果是「席位固定座標，只留最後買的那一款」，不是逐一在三個座標各建一座。這是靜態解析，未以原版客戶端驗證觸發掃描、生成碰撞、彈道或實際攻擊間隔。
