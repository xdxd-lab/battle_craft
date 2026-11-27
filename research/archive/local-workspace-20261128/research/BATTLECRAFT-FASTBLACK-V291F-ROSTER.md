# BattleCraft FastBlack v2.91f 兵種設定

本表用已留存的 SC1／Brood War **FastBlack v2.91f** 當作舊版非 SPEED 對照。SCMSCX 的檔案名為 `BattleCraft FB v2.91f.scx`。仍待確認原作者首發檔與中文論壇附件的確切身分。SC2 重製者的單位試算表目前無法回讀，該版數值另待查證。[SCMSCX 鏡像](https://scmscx.com/map/7zGY2kzG) · [SC2 重製者頁面](https://www.curseforge.com/sc2/maps/battlecraft)

[完整 UNIx 單位表 CSV](battle_craft-fastblack-v2.91f-unit-settings.csv) 共 228 個單位 ID，84 個套用地圖覆寫。標記 `engine_default` 的列由引擎取值，留空表示這份 CSV 未擷取引擎預設。原檔在本機 `research/local-source/fastblack-v2.91f.scx`、`fastblack-v2.91f.scenario.chk`、`fastblack-v2.91f.triggers.txt`。SCX SHA-256 為 `d2373a4c588e3a879fda68dd2e8031a33f3a7c740ed94482d4fd6ec0ff9f1cf1`，CHK SHA-256 為 `a51e023fc80864b73595f6251532344f63cdec427b1419487b7c512dfaee72f7`。

## 八個購兵例

| 引擎兵種（ID） | 地圖名稱 | 礦／出兵數 | 生命／盾／基礎護甲 | 地空／體型 | 對地／對空 | Trigger |
|---|---|---:|---:|---|---|---:|
| Marine（0） | Universal Soldier | 150／15 | 400／0／0 | 地面／小 | 普通／普通 | 12 |
| Firebat（32） | Napalm Strider | 150／15 | 650／0／0 | 地面／小 | 震盪濺射／無 | 26 |
| Goliath（3） | Herculean Defender | 300／12 | 750／0／0 | 地面／大 | 普通／爆炸 | 27 |
| Wraith（8） | Silent Apparition | 300／8 | 800／0／0 | 飛行／大 | 普通／爆炸 | 30 |
| Zergling（37） | Vicious Hellspawn | 200／25 | 350／0／0 | 地面／小 | 普通／無 | 31 |
| Hydralisk（38） | Malevolent Reaper | 150／15 | 485／0／0 | 地面／中 | 爆炸／爆炸 | 32 |
| Dragoon（66） | Foreboding Colossus | 200／12 | 700／0／0 | 地面／大 | 爆炸／爆炸 | 35 |
| Archon（68） | Mystic Titan | 300／12 | 1750／0／0 | 地面／大 | 普通濺射／普通濺射 | 36 |

- 價格採該 Trigger 的礦物扣款，出兵數加總該筆的 `Create Unit`，代表計畫生成數。Trigger 編號從 1 起算並保留空項。地圖顯示名稱去除顏色控制碼和表內已另列的價格。
- 生命、盾、基礎護甲和原始名稱來自 CHK 的 `UNIx`／`STR`。檔頭為版本 205。`UNIx` 在 byte 375108（段標頭），有完整 4168 bytes 資料。後方 WAV 宣告長度超出檔案，該異常位於資料段之後。CSV 的礦與瓦斯是單位表欄位；購兵扣款另由 Trigger 決定。[UNIx 欄位格式](https://docs.scmjs.dev/chk/unix/)
- 地空、體型及地空傷害類型採這八個普通兵種的引擎基準。傷害分類不提供地圖的實際單發傷害，後續若需計算，須把武器 ID、地圖傷害覆寫與升級分開核對。[Blizzard 單位體型與傷害](https://classic.battle.net/scc/gs/damage.shtml) · [既有版本對照](BATTLECRAFT-UNIT-REFERENCE.md)
