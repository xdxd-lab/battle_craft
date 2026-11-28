# 網頁模擬 18：三款同槽防禦塔

2026-11-29。基線 v6-2／模擬 17。這是沿用 2009 SPEED 的三種職能和原價，**不是照搬原圖的生命與傷害**。原附件的雜湊、十份鏡像對照、購買觸發和固定位置見 [原圖考據](BC-V6-TURRET-HISTORY.md)。

| 塔（unit ID） | 合法目標／傷害類型 | 原 SPEED：HP／盾／甲，傷害 | 模擬 18：HP／盾／甲，傷害 | 武器冷卻（來源幀） | 外框左／上／右／下（原作 px） |
|---|---|---|---|---:|---|
| 光子砲臺 Photon Cannon（162） | 地空單體，普通；地 80、空 81 | 6,000／6,000／60，600 | 300／300／3，60 | 22 | 20／16／20／16 |
| 孢子殖體 Spore Colony（144） | 對空單體，普通；52 | 6,000／0／60，800 | 300／0／3，80 | 15 | 24／24／23／23 |
| 沉沒殖體 Sunken Colony（146） | 對地單體，爆炸；53 | 6,000／0／60，1,200 | 300／0／3，120 | 32 | 24／24／23／23 |

- 每次 **500 礦**。每席只留原網頁塔位置上的一座。換款或重買同款都重新付費，換新品並補滿其初始生命／護盾；餘額不夠則不扣款、不換塔。原圖各款每席只能觸發一次，與本輪可重複付費的要求不同。此輪未加 NPC 自動建塔、隱形偵測、電力中斷、菌毯或 Havoc 全圖歸盾。
- 耐久與甲用原圖的 1/20，傷害用 1/10，保留原圖不同塔的工作分工、傷害比例與強力單擊。舊網頁原型是 180 HP、1 甲、55 普通傷害的通用塔，價格 1,400。新塔調到 300 HP、3 甲，光子塔有另計的 300 盾，傷害不跟原礦額擴大而直接乘二十。以目前單位為例，孢子對無盾戰巡（500 HP、3 甲）每發 77、需七發；沉沒打輕甲陸戰隊是 60，一發可擊破；打重甲且無盾的重騎兵是每發 119。盾依現有模型每來源幀回 7/256（約 0.65／秒），有盾時擋原始傷害，剩餘份額才進護甲及類型結算。這是初始 Web 平衡，不是原圖結論。
- 三塔合法射程均 **224 px／7 格，即此 Web 比例的 2.835 世界單位**，以 OpenBW 的兩外框最短整數距離判定。兵打建成的新塔也用同一公式、各兵版本 17 的地面射程。塔不射主城或其他塔、不濺射、不打盟友，不改九兵移動佔位或原本主城的圓形範圍。
- 每座新塔是獨立的塔物件，自己的在途舊彈仍可能命中原敵兵；已飛向舊塔的彈不會扣到新塔。塔彈留原敵兵 ID，不會因飛過別人而改擊，也不會打變成己方的敵兵；若已死亡就未命中。

## 逐幀可重跑證據

三塔外框、各武器 ID、四個武器槽和彈體移動參數，直接從 StarEdit 的 units.dat、weapons.dat、flingy.dat 按 [固定 OpenBW 讀表](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/data_loading.h#L1440-L1660) 解析。這些 [Blizzard 神民表](https://classic.battle.net/scc/protoss/pstats.shtml)／[蟲族表](https://classic.battle.net/scc/zerg/zstats.shtml) 是一般對戰資料，而非 SPEED 的覆寫。引擎 [發射與出現點](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L14420-L14555) 與 [追蹤循環](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L14222-L14315) 分別對應依原目標追蹤或目標處效果。

| 固定 OpenBW 探針（不是暴雪執行檔的逐幀輸出） | 原作中心距 | 出現 → 首次扣 HP | 將目標沿 Y 移 300 px |
|---|---:|---|---|
| Photon 80 → Marine | 175 px | 7 → 16 | 未測 |
| Photon 81 → Battlecruiser | 210 px | 7 → 17 | 改追並於 21 命中 |
| Spore 52 → Battlecruiser | 210 px | 1 → 13 | 改追並於 17 命中 |
| Sunken 53 → Marine | 225 px | 11 → 16 | 效果留舊點，原目標於 16 扣血 |

Photon 與 Spore 保留各自 DAT 的加速、上限、轉向與壽命；Sunken 無飛行物體，以出現後五個來源幀結算。Web 以首次取得目標後 6／0／10 幀起手，連續合法目標沿用名義冷卻。探針的後續兩發間隔受原作動畫與命令週期影響，並非每一發都精確等於 DAT 冷卻；沒有聲稱 Web 重現完整 IScript 動畫、隨機落空或鎖定優先序。

用已驗證的 StarEdit 本機資料與[探針程式](weapon-delivery-probes/openbw-attack-flight-probe.cpp)重跑（不分發 Blizzard 素材）：

```sh
c++ -O0 -std=c++17 -I/path/to/pinned-openbw research/weapon-delivery-probes/openbw-attack-flight-probe.cpp -o /tmp/bc-flight
cd /path/to/motion-lab-fixture
/tmp/bc-flight 162 12 210 teleport
/tmp/bc-flight 144 12 210 teleport
/tmp/bc-flight 146 0 225 teleport
```

Web 規則測試：`node dev02-four-seats/qa-defense-variants-v18.mjs`。含購買不足、付費替換（包含同款和被毀後）、三塔地空、224/225 px 邊界、兩種追蹤和定點出現、盾、在途彈與確定性重播。
