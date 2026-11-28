# BattleCraft SC1 兵種與介面字詞

2026-11-26。對照 [SPEED 2tzpVkp9](https://scmscx.com/map/2tzpVkp9) 和 [FastBlack v2.91f](https://scmscx.com/map/7zGY2kzG) 的本機 SCX、CHK 與 Trigger 匯出。所用檔案與[樣本雜湊表](battle_craft-scx-checksums.csv)一致。原論壇附件仍未取得，這兩版結論各適用於各自的鏡像。畫面證據及來源界線見[原作研究](battle_craft-research.md#歷史畫面與介面)。

畫面字詞、實際扣款、生成單位 ID 與引擎攻擊類型應各自核對。現階段可借鏡對地、對空、雙用途、濺射等職責，正式兵種名稱、資產與平衡數值由 BaattleCraft 自行設計。本專案中文稱 Protoss 為「神民」；表內英文單位名、Trigger 字串與外部來源名稱照原文保留。

現行自寫文件使用[兵種中文名稱對照](BC-UNIT-NAMES.md)。2009 論壇原附件後續查證見 [v6-4 候選兵種表](BC-V6-4-UNIT-CANDIDATES.md)。

## 購兵比對：Trigger、顯示名稱、護甲、攻擊方式

表中價格為 Trigger 實際扣除的礦；數量為該 Trigger 所有 Create Unit 動作的合計，代表計畫建立數而非引擎成功生成的實測數。# 為完整匯出順序、從 1 起算（含空 Trigger）。名稱是 CHK `UNIx` 指向 STR 的自訂單位名稱，已移除顏色控制碼。購兵 Location 和 Trigger Comment 各有自己的欄位。護甲取各版 `UNIx` 中實際生成的單位類型之值，不含升級或遊戲狀態。尺寸和地／空攻擊類型由 [Blizzard 官方普通單位表](https://classic.battle.net/scc/gs/damage.shtml)提供的對應普通單位作**參考**：SPEED 的英雄型是否每個尺寸／武器屬性與普通型一致，尚未對照實際 units.dat/weapons.dat，不能當作已驗證的英雄屬性。N 普通、C 震盪、E 爆炸、— 無普通攻擊；濺射、彈數和法術另計。

| 購兵區類型 | SPEED：生成類型／自訂名稱；礦、數、#；護甲 | v2.91f：生成類型／自訂名稱；礦、數、#；護甲 | 普通版官方尺寸；地／空 |
|---|---|---|---|
| Marine | Jim Raynor / Universal Soldier - $175；150、12、#9；0 | Marine / Universal Soldier $150；150、15、#12；0 | 小；N/N |
| 火蝙蝠（Firebat） | Gui Montag / Napalm Strider - $150；150、12、#22；0 | Firebat / Napalm Strider $150；150、15、#26；0 | 小；C＋濺射/— |
| 巨人（Goliath） | ★ Alan Schezar（ID 17）／Ancient Goliath - $300；300、12、#23；0 | 普通 Goliath（ID 3）／Herculean Defender $300；300、12、#27；0 | 大；N/E |
| Wraith | Tom Kazansky / Silent Apparition - $300；300、12、#26；0 | Wraith / Silent Apparition $300；300、8、#30；0 | 大；N/E |
| 異形蟲（Zergling） | ★ Devouring One（ID 54）／Hell Spawn - $100；100、12、#27；0 | 普通 Zergling（ID 37）／Vicious Hellspawn $200；200、25、#31；0 | 小；N/— |
| Hydralisk | Hunter Killer / Acid Demon - $175；175、12、#28；0 | Hydralisk / Malevolent Reaper $150；150、15、#32；0 | 中；E/E |
| Ultralisk | Torrasque / Ultra Behemoth - $200；200、12、#29；0 | Ultralisk / Brutish Behemoth $200；200、12、#33；0 | 大；N/— |
| Mutalisk | Kukulza / Deadstar Dragon - $300；300、12、#30；0 | Mutalisk / Deadstar Dragon $300；300、8、#34；0 | 小；N/N |
| Dragoon | Fenix / Grim Walker - $200；200、12、#31；0 | Dragoon / Foreboding Colossus $200；200、12、#35；0 | 大；E/E |
| Archon | Tassadar/Zeratul / Mystic Titan - $250；250、12、#32；0 | Archon / Mystic Titan $300；300、12、#36；0 | 大；N＋濺射/N＋濺射 |
| Zealot | Fenix / Ultima Paladin - $100；100、12、#33；0 | Zealot / Heroic Paladin $150；150、15、#37；0 | 小；N/— |
| Scout | Artanis / Heaven Sentinal - $300；300、12、#34；0 | Scout / Heaven Sentinel $300；300、8、#38；0 | 大；N/E |
| 特殊 Scourge | Scourge / Suicide Flies-$750；750、35、#86；10 | Scourge / Raging Kamikaze $200；200、20、#104；0 | 小；—/N；接觸自爆 |
| 特殊 私掠者（Corsair） | Corsair / Anti Air Alien-$750；750、10、#77；1 | Corsair / Forsaken Annihilator $1500；1500、35、#101；0 | 中；—/E＋濺射 |
| 特殊 女武神（Valkyrie） | Valkyrie / Anti Air Human-$650；650、10、#78；2 | Valkyrie / Enigmatic Phantom $300；300、9、#102；0 | 大；—/E＋濺射 |

SPEED #81 的 SCV 要求且扣 600、生成 2，但 Comment 寫 `Darkstar-$1500`；#9 生成單位顯示名 $175、要求及扣款均 150。兩者說明不要把 Comment、單位顯示文字或 units.dat 生產成本當實際交易價。SPEED #54 location 名 `Tank`，實際生成 20 隻異形蟲（Zergling）、扣 1000，該單位自訂名 Fast Shit-$1000。v2.91f #29 和 #102 的匯出 location 名為空字串，空名稱不等於無 location；是否可實際觸發要查 MRGN 的 location ID／位置與遊戲測試，不宜直接判無效。

SPEED 一般列生成英雄、S-列常生成普通型；另有其他購兵點可買地圖強化的普通巨人與普通異形蟲，見[原附件的獨立列](BC-V6-4-UNIT-CANDIDATES.md#地面)。v2.91f 一般列生成普通、S-列常生成英雄。對應兵種名字一樣也不能假設數值、技能或武器相同。SPEED 以 Civilian 及 Dark Templar 踩選區；v2.91f 以上例子以 Devouring One 踩選區。SPEED #9、22–41 保留 Trigger；條件精確為一個選擇者，持續站立且資源足夠可重複觸發，不能推算牆鐘頻率。v2.91f 的 5 個生成位置與 SPEED 的集中 Purchased Units 再轉移也不同。

### 後續候選兵種（2026-11-27／28 名稱已確認；遊戲內實作採 BWAPI 原版值，見 [BC-SIX-UNITS](BC-SIX-UNITS.md)、[BC-NINE-UNITS](BC-NINE-UNITS.md)）

| 中文名 | 英文 | v2.91f 礦／計畫數 | v2.91f HP／盾 |
|---|---|---|---|
| 刺蛇 | Hydralisk | 150／15 | 485／0 |
| 破壞能 | Archon | 300／12 | 1750／0 |
| 死靈式戰機 | Wraith | 300／8 | 800／0 |
| 戰鬥巡洋艦 | Battlecruiser | 500／12（#58） | 2000／0 |
| 斥候 | Scout | 300／8（#38） | 1000／0 |
| 自殺蟲 | Scourge | 200／20（#104） | 1000／0 |

2026-11-28 加入戰鬥巡洋艦、斥候、自殺蟲三列（中文名稱已定）。遊戲內採 BWAPI 原版值，SPEED 各版的扣款、英雄型與覆寫見 [BC-NINE-UNITS](BC-NINE-UNITS.md)。SPEED 的戰鬥巡洋艦只賣英雄 Hyperion（#55，500／10），上方主表未列。

來源界線：礦／計畫數取自上表的 v2.91f Trigger 扣款與 Create Unit 合計；HP／盾是 v2.91f CHK `UNIx` 覆寫值，由本機讀取筆記整理（本機專用，未納入儲存庫，也不附地圖檔），與 QA2 初查一致；可從公開的 [SCMSCX 鏡像](https://scmscx.com/map/7zGY2kzG)取得同一地圖自行核對，地圖雜湊見[樣本雜湊表](battle_craft-scx-checksums.csv)。兩者都只代表 [SCMSCX 鏡像](https://scmscx.com/map/7zGY2kzG)這一版地圖，不是原作者首發檔，也不是 Blizzard 普通單位的原版數值；原版數值另以官方資料標示，本節未列。以上皆為對照資料，不是 BaattleCraft 的定案規格；新遊戲的價格、血量、攻擊與素材另行設計。

## UNIx、UNIS 與引擎預設的界線

兩個本機 CHK 均為 VER 205，含一個 4168-byte `UNIx`，本次找到的完整 UNIx 位於 SPEED offset 356479、v2.91f offset 375108；SPEED 檔案正常結束，v2.91f 後續 WAV 長度異常。依 [scmJS UNIx 格式](https://docs.scmjs.dev/chk/unix/)及[載入順序](https://docs.scmjs.dev/chk/how-the-game-loads-a-map/)，Brood War UMS 讀 UNIx；不要因為有 UNIS 就假設會覆蓋該版本 UNIx。每個類型的 flag 為 0 才套用該表對應單位 HP、盾、護甲、名稱等；非零使用既有／引擎值。重複 settings section 依條目合併，非簡單最後整段取代。以上表列類型逐一讀得 flag 均為 0，因此護甲是地圖自訂值，即使數字偶爾與預設相同。

例如一般 Marine 引擎基礎護甲為 0，[Firebat 為 1、Goliath 為 1](https://classic.battle.net/scc/terran/ustats.shtml)，但 v2.91f 的普通 Firebat、Goliath 均覆寫為 0；SPEED 的特殊 Scourge 覆寫為 10，而[普通 Scourge 的官方預設](https://classic.battle.net/scc/zerg/zstats.shtml)為 0。護甲僅是基礎，不含地圖升級與盾甲。UNIx 的武器欄是按武器 ID 的傷害和升級傷害，武器由哪些單位使用、共享及炮塔單位問題需額外解析；它不含單位尺寸或將地空目標及傷害類型一一列出。普通版官方表也非精確英雄 dat。本次未取得及解析該兩版匹配引擎的 units.dat / weapons.dat，未計算實際武器傷害、英雄分類、升級、濺射與觸發交互；地圖的實際傷害仍待驗證。格式參考：[scmJS 欄位](https://docs.scmjs.dev/api/types/)、[BWAPI unit ID 定義](https://github.com/bwapi/bwapi/blob/master/bwapi/include/BWAPI/UnitType.h)、[Blizzard 尺寸與傷害](https://classic.battle.net/scc/gs/damage.shtml)。

### SPEED 英雄武器與護甲升級組

比對 BWAPI 的預設尺寸、武器及升級表。下列七種英雄的尺寸與對地／對空傷害類型均與上表的對應普通兵種一致。七者在 SPEED 的 CHK 基礎護甲均為 0。升級組是另一個欄位，遊戲中實際傷害也受地圖武器覆寫、護盾、升級及觸發影響。

| SPEED 生成單位 | 行進 | 對地攻擊 | 對空攻擊 | 護甲升級組 |
|---|---|---|---|---|
| Jim Raynor Marine | 地面 | Gauss Rifle，普通 | Gauss Rifle，普通 | Terran Infantry Armor |
| Gui Montag | 地面 | Flame Thrower，震盪 | 無 | Terran Infantry Armor |
| Alan Schezar | 地面 | Twin Autocannons，普通 | Hellfire Missile Pack，爆炸 | Terran Vehicle Plating |
| Tom Kazansky | 飛行 | Burst Lasers，普通 | Gemini Missiles，爆炸 | Terran Ship Plating |
| Kukulza Mutalisk | 飛行 | Glave Wurm，普通 | Glave Wurm，普通 | Zerg Flyer Carapace |
| Artanis Scout | 飛行 | Dual Photon Blasters，普通 | Anti-Matter Missiles，爆炸 | Protoss Air Armor |
| Hunter Killer | 地面 | Needle Spines，爆炸 | Needle Spines，爆炸 | Zerg Carapace |

SC1 將小／中／大體型、基礎護甲值和護甲升級組分開。震盪傷害對中／大體型倍率為 50%／25%，爆炸傷害對小／中體型為 50%／75%，普通傷害的體型倍率一致。神民（Protoss）護盾的傷害倍率規則也另行處理。SC2 的輕甲、重甲等屬性及加成要按其版本判讀。[Blizzard 傷害說明](https://classic.battle.net/scc/gs/damage.shtml) · [BWAPI 單位資料](https://github.com/bwapi/bwapi/blob/d727fed68558c506163048ea889131d8cbb33915/bwapi/BWAPILIB/Source/UnitType.cpp) · [BWAPI 武器資料](https://github.com/bwapi/bwapi/blob/d727fed68558c506163048ea889131d8cbb33915/bwapi/BWAPILIB/Source/WeaponType.cpp)

## 介面字詞

- SPEED #6 是擊殺榜 ` <--- Most Kills`，#7 提示 `Havoc Mode Engaged... All Shields Are Gone...`；#8 在 elapsed time 600 之後反覆設盾為零。這是 Trigger 文本及動作，不表示這些字占據永久主 HUD，也不代表 600 是牆鐘秒實測。
- v2.91f #9 是 ` <==Unit Control at Middle` 的區域單位控制榜；#8 Havoc 警告、#10 歸零盾。與 SPEED 的擊殺榜不是同一指標。另有自動現金等 `Display Text Message` 前面帶分號的停用動作，不可當有顯示或收入實測；實際資源規則另看 Trigger。
- 兩個 SC1 樣本都用 Protoss Pylon 作核心存亡判定。直接讀單位 ID 156 的 `UNIx` 名稱索引與 `STR` 字串，SPEED 的自訂顯示名是 **Life Crystal**（字串 77），v2.91f 是 **Crystal Fortress**（字串 145）。SPEED 用來踩一般信標的 Terran Civilian（ID 15）顯示名為 **<Bring Me To Beacon>**（字串 120）。這些是地圖提供的名稱，尚未用遊戲畫面核對顯示位置。[scmJS UNIx 格式](https://docs.scmjs.dev/chk/unix/)
- SC2 重製者也使用 Life Crystal，另外列出 attacker armies、礦物、瓦斯和熱鍵 1–4／W。[SC2 作者頁](https://www.curseforge.com/sc2/maps/battlecraft)

## 後續實證

- 對照與遊戲版本相符的 `units.dat`、`weapons.dat` 和 CHK 的武器欄、升級與觸發，擴大已核對的英雄型範圍並釐清實際傷害。
- 有可辨識版本的 SC1 實機或重播時，核對選取後的單位名稱、榜單位置、生成上限與實際收入節奏。
