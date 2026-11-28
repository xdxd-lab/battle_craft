# BaattleCraft v6-0：九兵種攻擊、SPEED 地圖與 Brood War 的比對

2026-11-28（台灣時間） · Web 基準 `2c00ded26f7834b195d1f15d956e3691213684ce`（v6-0／模擬格式 8）。**原圖** = Trigger、UNIx 位元組；**DAT／腳本** = BWAPI、PyMS 內附的資料；**OpenBW** = 重實作原始碼、另標記實測；**Web** = 現版程式與隔離測例。未在 Blizzard 1.16.1／Remastered 執行原圖逐幀驗證。本報告只記錄證據；候選改動另見 [候選說明](BC-V6-NEXT-COMBAT.md)。

## 1．2009 年附件：普通購兵常生出英雄

從[論壇當年附件](https://www.gamez.com.tw/t/topic/374947/11)的留存 SCX 用 PyMS 的 MPQ parser 獨立重取 CHK，SHA-256 `c30ae248e68f003bccf10efa0bf2a15ad61995449fd39c62ebfaf2e329cbe16f` 與原紀錄一致。論壇版 TRIG 93 條，[SPEED 鏡像](https://scmscx.com/map/2tzpVkp9) 94 條；**下表 16 筆購買 Trigger 各 2,400 bytes 完全相同**，同一個 4,168-byte UNIx 節也完全相同（SHA-256 `13ffee7ca8acb606941abb8e56ebc20d26022938ce5282d7056241d6e477b775`），不代表整圖相同。[非 SPEED v2.91f](https://scmscx.com/map/7zGY2kzG)有 120 條，不可代替論壇附件。數量是 Create Unit 計畫數、非實機成功生成數；價格取 Subtract Minerals，不取留言、位置名或名牌。表列單位的 UNIx 覆寫旗標皆為 0。

| Web 兵種 | 論壇 SPEED 主要購兵（#、礦／計畫數） | SPEED 另有普通型購兵（#、礦／計畫數） | 主要型 HP／盾／基礎護甲 | 主要型 UNIx 武器 ID：地／空每發基礎（升級加值） |
|---|---|---|---|---|
| 陸戰隊 | #9 Raynor Marine ID20，150／12 | #57 Marine，1000／10（位置叫 Guard） | 300／0／0 | 1：50（+0） |
| 重騎兵 | #31 Fenix Dragoon ID78，200／12 | #40 Dragoon，500／12 | 720／0／0 | 67：180（+0） |
| 飛螳 | #30 Kukulza Mutalisk ID55，300／12 | #85 Mutalisk，750／10 | 750／0／0 | 49：125（+0） |
| 刺蛇 | #28 Hunter Killer ID53，175／12 | #38 Hydralisk，500／12 | 500／0／0 | 39：100（+0） |
| 破壞能 | #32 Tassadar/Zeratul Archon ID76，250／12 | #80 Archon，1000／10 | 1250／0／0 | 71：125（+0） |
| 死靈式戰機 | #26 Tom Kazansky ID21，300／12 | #79 Wraith，1000／10 | 720／0／0 | 地 18：180（+0）；空 17：60（+0） |
| 戰鬥巡洋艦 | #55 Hyperion ID28，500／10 | 兩張比對的 SPEED 樣本沒有普通 BC 購買 Trigger | 1400／0／0 | 地 23：175（+3）；空 24：200（+3） |
| 斥候 | #34 Artanis ID88，300／12 | #84 Scout，1000／10（位置卻叫 hero scout） | 800／0／0 | 地 114：60（+0）；空 115：90（+0），DAT factor 2 |
| 自殺蟲 | #86 Scourge ID47，750／35 | 同一筆 | 7500／0／10 | 空 55：2000（+0） |

SPEED 普通 Scout #84：1500 HP／2 盾／0 甲，地 250／空 350、各升級 +25，空武器仍 factor 2。非 SPEED v2.91f #38 買普通 Scout 300／8（1000 HP／0 盾／0 甲，地 50／空 140），另 #106 才買 Artanis 1000／15，空 308；#58 買普通 BC 500／12（2000 HP／0 盾／0 甲，地空 90）。SPEED 普通 BC 有 UNIx 設定，這不表示有購買。論壇版 #8 反覆歸零護盾，與 UNIx 盾上限分開。依[格式](https://docs.scmjs.dev/chk/unix/)，UNIx 武器欄只覆寫武器 ID 的基礎／升級傷害，不帶傷害型、地空旗標、冷卻、飛行、動畫或彈數；表不是任何一輪對局的量測總傷害。

## 2．普通兵種與 Web 差異

N = 普通，E = 指向性爆炸（原版 Explosive，不等於範圍濺射）；數值為無升級普通型「每發傷害／冷卻（引擎 frame）／射程（px）」。[BWAPI 武器表](https://github.com/bwapi/bwapi/blob/d727fed68558c506163048ea889131d8cbb33915/bwapi/BWAPILIB/Source/WeaponType.cpp)、[Blizzard 體型／傷害](https://classic.battle.net/scc/gs/damage.shtml)、[武器 DAT](https://github.com/poiuyqwert/PyMS/blob/6e325d2e9474716fa2be3aca6479ff7d29dbaab5/PyMS/MPQ/arr/weapons.dat)、[OpenBW 飛行行為](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L14225-L14258) 交叉核對。

| 兵種 | 普通 Brood War 武器、傷害／冷卻／射程 | DAT 行為 | Web v6-0 |
|---|---|---|---|
| 陸戰隊 | Gauss Rifle #0：地空 N6／15／128 | 類型 2，目標附近出現命中特效，沒有飛行或濺射 | 單體即時；刺激劑未做。Raynor 的同類武器射程 160，別混入普通型。 |
| 重騎兵 | Phase Disruptor #66：地空 E20／30／128 | 1，追蹤飛行單體，不濺射 | .12 世界單位／Web tick，會追蹤，非原版彈速。Fenix 冷卻 22 frame，普通是 30。 |
| 飛螳 | Glave Wurm #48：地空 N9／30／96 | 7，同一飛行物彈跳，最多 3 個目標，非圓形濺射 | .20／tick；圓形半徑 1.5 優先找最近單位、再找核心，同距取早 ID；見下。 |
| 刺蛇 | Needle Spines #38：地空 E10／15／128 | **2：目標上出現，並非飛行彈**；不濺射 | **Web 有實際飛行物**，.20／tick。Hunter Killer 的預設射程 160。 |
| 破壞能 | Psionic Shockwave #70：地空 N30／20／64 | 2，出現在目標附近；Enemy Splash，3／15／30 px 100／50／25% | 同 tick、中心距離；己席免傷、盟友可傷、地空皆可；環額外放大 4 倍，核心不參與。 |
| 死靈式戰機 | Burst Lasers #16：地 N8／30／160；Gemini #15：空 E20／22／160 | **兩者都是 0，飛向發射時的目的地**，單體，不濺射。OpenBW 類型 0 不逐幀更新飛行座標，正常命中仍引用目標物件；不據此推論移動就能閃躲。 | **地即時、空 .25／tick 並追蹤**，兩者均有歷史差異；隱形未做。 |
| 戰鬥巡洋艦 | ATS／ATA #19／20：地空 N25／30／192 | **0，有雷射飛行物**；不濺射。距離近不保證看得到實際飛行，動畫另核。 | **地空都即時**；大和砲未做。Hyperion #23／24 的預設冷卻 22 frame。 |
| 斥候 | Dual Photon #73：地 N8／30／128；Anti-Matter #74：空 E14×2／22／128 | 地 2 目標出現；空 1，兩枚追蹤單體彈，無濺射 | 地即時；空只有 **一個** .25／tick 飛行物件、一個 impact，卻套兩次盾和甲。 |
| 自殺蟲 | Suicide Scourge #55：僅空 N110／1／3 | 6，接觸自毀，單體，沒有範圍傷，不能打地面 | .5 中心距離，同 tick 直接結算並自己死亡，不算對方擊殺；到敵方核心旁不打核心。 |

以上是普通武器；不能用它來推斷自動對攻是否施放刺激劑、隱形、大和砲，也未採用武器、盾甲升級或原作幻象等規則。Web 見 [roster](https://github.com/xdxd-lab/battle_craft/blob/2c00ded26f7834b195d1f15d956e3691213684ce/dev02-four-seats/roster.mjs#L15-L46) 與 [combat](https://github.com/xdxd-lab/battle_craft/blob/2c00ded26f7834b195d1f15d956e3691213684ce/dev02-four-seats/combat.mjs#L53-L120)。

## 3．三個需要單獨驗收的細節

### 破壞能：命中座標、碰撞盒、同席與盟友要分開

- [Blizzard 官方破壞能指南](https://classic.battle.net/scc/protoss/units/archon.shtml)確認對地對空、同玩家免傷但盟友可受傷，並描述半傷、四分之一傷；[BWAPI 詳表](https://bwapi.github.io/namespace_b_w_a_p_i_1_1_weapon_types.html)與 DAT 確認三環 3／15／30 px。OpenBW [濺射迴圈](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L13774-L13825)依「彈體位置到[目標碰撞盒](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L1626-L1635)」，不是兩中心距離。當前彈體可貼目標近側，不保證在中心；周邊免傷依 owner 而非同盟；程式對被指定為主目標者另有例外，不等於遊戲一定允許指定自己。武器旗標地、空皆可且未設 non-building。通用迴圈不特別補主目標一發，主目標正常位於內圈即全傷。外圈對 burrowed 的排除及 miss 位置變動也是重實作細節，尚未 native 驗證。
- Web [combat 9–20](https://github.com/xdxd-lab/battle_craft/blob/2c00ded26f7834b195d1f15d956e3691213684ce/dev02-four-seats/combat.mjs#L9-L20)先保證主部隊全傷，再以中心做環：.151875／.759375／1.51875 世界單位（為較疏間距另外 ×4）；地空可互相波及，傷害同伴不給自己擊殺。核心無論主、副目標都不觸發濺射，是專案平衡選擇；不能說原版建築都免濺射。
- PyMS 內附動畫腳本 268 有三段 wait 1 才在命中動畫呼叫 damage；這是命中特效內部安排，沒有據此報出未量測的原版總延遲。

### 飛螳：倍率確認，下一跳選擇的官方文字和 OpenBW 有落差

- [Blizzard 飛螳指南](https://classic.battle.net/scc/zerg/units/mutalisk.shtml)解說傷害依序 1／1/3／1/9，以接近的敵人為目標。[OpenBW 目標選擇](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L14300-L14327)實作為當前彈體的軸對齊方形查詢 `square_at(...,96)`，[取第一個合格項](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L15687-L15705)，不是逐個比幾何距離。排除本跳和前一目標，要求可攻擊的敵方，地空可混。原版到底採何種排序，要對照 native 多候選場景。
- [OpenBW 傷害](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L14086-L14100)每跳除 3，使用同一個飛行物。下一個目標存在時先以腳本 264 吃下當跳，再更新目標；找不到便跑終止傷害腳本。源單位移除時[清指標](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L12753-L12756)：已發射的當跳仍可傷害，缺射手指標不能挑下一跳。這是重實作推論，同 frame 死亡到指標清除的精確時序未實測。
- Web 在本步傷害之後才選下一跳；可從已被打死的目標最後位置出現 fizzle 後續跳，射手在本步 HP≤0 就不得續跳，已在飛的當跳仍可命中。Web 優先找單位，再找核心；同距依早 ID，續跳另建 projectile ID。核心是否仍 alive 也取決於本步後段何時扣核心傷害。都不能從 Web 推回原版。

### 斥候：同一次發兩枚，命中可同一幀也可先後

- [Blizzard 斥候指南](https://classic.battle.net/scc/protoss/units/scout.shtml)的普通對空總面值 28，並未描述命中幀數。DAT/BWAPI 至少拆為 #74 每發 14、factor 2；Artanis #115 預設每發 28、factor 2；SPEED 的同一武器 115 覆寫原始每發 90、factor 不變。普通與英雄不要混稱。
- [DAT](https://github.com/poiuyqwert/PyMS/blob/6e325d2e9474716fa2be3aca6479ff7d29dbaab5/PyMS/MPQ/arr/weapons.dat)的 #74／115 共同用 Flingy 154、飛行類型 1、生命欄 30、偏航 64、前偏移 5。[Flingy](https://github.com/poiuyqwert/PyMS/blob/6e325d2e9474716fa2be3aca6479ff7d29dbaab5/PyMS/MPQ/arr/flingy.dat)給 raw top speed 8533／加速267／停止距離136352／轉向13／movement control 1，不是量測常速。對照 Dragoon 的 Flingy159 17067／850／171343／127；Glaive 的 165 8533／667／54582／127；Gemini 的 144 8533／667／54582／40。
- [iscript.bin](https://github.com/poiuyqwert/PyMS/blob/6e325d2e9474716fa2be3aca6479ff7d29dbaab5/PyMS/MPQ/scripts/iscript.bin)內普通與 Artanis 共用 ID161；在對空動畫 wait 1 之後，只出現一次 attackwith 2。 [OpenBW 發射](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L14674-L14701)因此按 bullet_count=2 同一指令兩次建立飛彈，[初始化](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L14400-L14424)對稱取 ±64 內部航向；每枚追蹤後，腳本 ID232 個別呼叫傷害。不能把「兩彈一定前後隔一幀」或「一定同時」寫死。
- **OpenBW 隔離實測（[團隊探針](tools/openbw-air-salvo-probe.cpp)，非 Blizzard native）**：無盾甲3的靜止 BC，普通 Scout 同幀射兩枚、同幀扣 22；Artanis 同幀射兩枚、同幀扣 50。在初距 350 px、首個彈體可見即讓 Wraith 橫移的場景，普通 Scout 兩枚生於 frame 55，分別 frame 71、72 扣 14；Artanis 兩枚生於 frame 46，frame 60、61 各扣 28。移動 BC 的後續齊射也觀察到相鄰 frame 各扣 11 或各扣 25。
- [OpenBW 傷害鏈](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L13658-L13739)每筆獨立套盾甲、扣盾，再扣本體甲、套體型倍率。普通斥候兩發都中大型無盾甲3 = (14−3)×2 = 22，而非 28−3 =25。若盾20、甲3且中途不回盾，第一發只扣 14 盾；第二發扣 6 盾，再扣 5 HP。兩個實體才可表達「第一枚致死、第二枚失效」「各枚 miss」「兩枚間被其他武器打中」。
- **Web v8 實測**：單一 Scout 對無還手的 500 HP／3 甲 BC，中心距 1.2，第 1 tick 一個 launch、第 6 tick 一個 impact，body=22、HP478。相同距離 Wraith 對空第 6／地第 1、刺蛇第 7、重騎兵第 11、飛螳首擊第 7、BC 對空第 1；破壞能距 .7、自殺蟲 .4 都第 1。這只是 Web 定步結果，非原作測時。

## 4．建議與重現路徑

1. **先 Scout，再破壞能、飛螳，其他留待手感確認**。攻擊改判定才開新的模擬版本，現 v1–8 舊紀錄的資料形狀、每步比對及摘要保持不變。
2. **Scout**：case 比較普通、Artanis；測靜止、橫移、零甲／甲3／跨盾、先擊殺對象、射手先死、別的攻擊插隊、兩彈同幀的固定次序。[BWAPI BulletInterface](https://bwapi.github.io/class_b_w_a_p_i_1_1_bullet_interface.html) 可讀 ID、出生、位置、速度；原版分開記 Classic／Remastered、遊戲速度及資料版。
3. **破壞能**：對照不同 hitbox、三環邊界、同席／同盟／敵人、地空互濺、主要目標移動、Pylon 建築；改 Web 核心波及先測平衡。**飛螳**：故意將最近與空間掃描可能首先返回的目標分開，另測出圓未出方、等距、空地、射手／彈著對象提前死亡。
4. **普通兵種與技能拆開**。刺蛇、死靈式戰機、BC 的飛行差異先不偷偷改；用「武器／主目標條件／彈體飛行形態／命中效果／目標過濾」組合，避免把所有差異塞進大型繼承樹。
5. DAT／腳本來源是 [PyMS 固定提交](https://github.com/poiuyqwert/PyMS/tree/6e325d2e9474716fa2be3aca6479ff7d29dbaab5/PyMS/MPQ)，先讀 units、weapons，再依 Flingy → sprites → images 追動畫。四個 SHA-256：units `da2ee6f116b77329048ec6be9e02721a527fde23d4b05b1b1336e634490abcba`、weapons `80de165015519f9bed46ea8858195c2d2d0120b65b9e55e1c0a50b19135f4b62`、flingy `89013fa6d81edad96b68efcfc0bb5342f1c7fa2ef7a0880a71b0169eab13d1ad`、iscript `cd35e04eaa8ea95cbbccc980bfaf4cae236f4b18b620dfb4a765822ec32c1cd0`。不隨報告分發原始資產或完整反組譯。
6. CHK 可依 [TRIG 格式](https://docs.scmjs.dev/chk/trig/)從完整順序自 1 起算，讀各 2400 bytes 的 Create Unit 與 Set Resources / Subtract / Ore；[UNIx](https://docs.scmjs.dev/chk/unix/) 武器傷害與升級加值起點 3648／3908（u16 little-endian）。所有工作在雲端，未讀或改使用者本機。
