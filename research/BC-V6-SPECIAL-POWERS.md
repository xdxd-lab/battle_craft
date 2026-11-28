# 歷史 BattleCraft 特殊信標：以條件、扣款與動作為準

2026-11-28（台灣時間） · 拆分原圖、鏡像、非 SPEED；對應 Web 模擬 10 候選。

Web 候選只在每座核心的俯視順時鐘側新增獨立展區，保留「全場清除」「控制單位」兩個未開放信標。不連購買、扣款、指令或技能，不把原圖礦價換成 Web 金價。

這是對三份地圖的**靜態資料查證**，不是實機操作。以 CHK 的 TRIG（每筆 2,400 bytes，以下編號從 1 起）、MRGN（以下另標資料內 1-based location ID）、STR、UNIx、UNIT 分開交叉核對。三份地圖所有有效 `Set Resources / Subtract` 的貨幣 ID 均為 0（ore／礦）；沒有把美元符號當另一種貨幣，亦無瓦斯扣款。原附件 93 條 Trigger；同名鏡像 94 條，前 93 個二進位 Trigger 中**唯一不同的是 #1 Armageddon**；STR／MRGN 位元相同，鏡像另多 #94。非 SPEED 有 120 個完整 TRIG 記錄，末尾 WAV chunk 長度異常不影響此段解碼。

| 購買／觸發 | 2009 論壇原附件 | SPEED 鏡像 2tzpVkp9 | 非 SPEED FastBlack v2.91f |
|---|---|---|---|
| Armageddon | **4,500 礦** #1。恰好一隻買家的 Terran Civilian 在旗點；先移出該小區內買家的 Men，再扣款。十字自動攻擊區（MRGN 24、25）直接殺 **All Players** 的 Men：己、盟、敵皆中；另全圖殺 **Foes** 的 Tom Kazansky／Kukulza（飛螳）／Artanis 三個英雄型。並非全部地圖、所有單位或護甲傷害。Preserve；下次再踏入才又可觸發。 | **4,500 礦** #1。相同選擇者、返程及全地圖三型英雄條件，唯十字區目標改成 **Non Allied Victory Players**，不再是 All Players。 | **4,000 礦** #2。恰好一隻買家的 Devouring One 在旗點，殺買家在該區的 Men 並在返程點補一隻選擇者；十字區（MRGN 56、58）直接殺 Non Allied Victory Players 的 Men，無 SPEED 的全圖三英雄附加規則。Preserve。 |
| Mind Control／奪兵 | **6,000 礦** #88。恰好一隻買家的 Dark Templar 在 Poo mine layer；把 **Foes** 在 MRGN 79–82 四個區內的 Men 改歸買家，不複製、不觸及己／盟，也不等於全圖。把旗區內買家 Men 移往 MC BACK，Preserve。註解 `All Seein Eye-$800` 是舊名，非價格；STR #251 的自訂名稱 $6000 和實扣一致，但名字暗示的全圖範圍不成立。 | 同原附件 #88。 | **8,000 礦** #109。恰好一隻買家的 Devouring One；殺自己在旗點的 Men 並補回選擇者，將兩條十字區 MRGN 56、58 內 **Non Allied Victory Players** 的 Men 轉給買家。Preserve；正式地圖描述與 UNIx 標 $8000，一些舊／停用文字是 $6000。 |
| 回滿建築 HP／盾 | **5,000 礦** #92。恰好一隻自己 Dark Templar 在 Supa Ghost；只將**買家自己的 Buildings** 在 MRGN 79、80 內生命、護盾設為 100%。不指定 Allies、不重建塔、不給無敵、不把選擇者移走。Preserve，若留在旗點又有 5,000 礦，下一次可執行 Trigger 循環可能再扣；沒有等待與冷卻動作，未量牆鐘。註解 $1000，鄰近單位名稱寫 $6k、還宣稱盟友，兩者都不等於實際動作。 | 同原附件 #92。 | **2,500 礦**，Everlasting Elixir／Max HP #110、113、114、115，各席一條。恰好一隻自己的 Devouring One，殺自己在旗區的 Men 並補選擇者。所有區域 MRGN 64 的**買家＋Allies** 建築先回滿 HP／盾；再移除 14 個己預設隊防禦點上的 All Players 的 Any unit，於固定座標各建 7 座給該隊兩席（14 座，含建塔間兩個 `Wait(500)`）；最後使買家的 Pylon 無敵，盟友無敵未見本動作。Preserve。地圖描述舊寫 $3000；UNIx 顯示名及付款均 $2500。既有 Pylon 只補而未新建，不是重生核心。 |
| 個別防禦三種：Photon Cannon／Spore Colony／Sunken Colony | **各 500 礦** #42–53；至少一隻買家 Civilian 在各旗點，扣款並殺其 Civilians，殺本席單一 Extra 區內所有玩家所有單位，建立一座買家所選塔。每人每類各限一次，三類搶同一個地點，不能假設同時保有三種。沒有 Preserve、沒有無敵動作。 | 同原附件 #42–53。 | **各 200 礦** #46–57；至少一隻買家 Devouring One、殺旗點該選擇者、移除固定位置所有玩家單位、建一座並使買家指定區的 Pylon 無敵。僅 Cannon 另有 `Wait(500)`。各席各類仍**未 Preserve**。#119 可再補一隻防禦選擇者，不會重啟已用掉的單次 Trigger。地圖現行描述 $200，STR 中舊描述 $600。 |

- 無敵有地圖規則但**不是已證實可獨立購買的全球能力**。v2.91f 的 #81 免費保護 MRGN 72 內自己的 Any unit，#82 清除十字區 Men 的無敵，#90 在指定退回區保護選擇者，#87 若買家擁有的 Cannon、Spore、Sunken 都為 0，地圖中的自家 Pylon 去無敵。SPEED 與原附件沒有有效 `Set Invincibility` TRIG；這不排除 UNIT 預置物件屬性。
- Havoc 不是「地震」也不是付費旗點：三圖 #8（非 SPEED #10）的 `Elapsed Time >= 600` 會反覆把所有玩家所有單位的護盾設為 0；原／鏡像 MRGN 64 Anywhere，非 SPEED 匯出器叫 Location 63，仍是實際 MRGN 64 Anywhere；是遊戲內計時，未換算牆鐘。
- `AOC`、`earthquake`、`clone` 在這三份現存檔的 STR 和有效收費 Trigger 中未定位到，不可替它們填價格或說不存在於其他版本。 `Kill Switch - $5000` 是原／鏡像 STR #73，未在生效的可購買功效中另見。 `Apocalypse Beast` 是武器用途不同的普通購兵名稱：原／鏡像 UNIx 39 對應 #39 500 礦出 12 隻普通 Ultralisk；非 SPEED UNIx 48 對應 #43 500 礦出 9 隻英雄 Torrasque，不是 Armageddon 的另一筆費用。v2.91f `Invulnerable Dreadnought $1500` 與 `Save Air Units $500` 也只是核得 STR／UNIx 名字，未找到該檔對應收費觸發。
- 術語依原 Token：`Men` 是引擎分類（不要因名稱排除飛行兵）；`Buildings` 才是獨立分組。不是安全起見要把 Non Allied Victory Players 都翻成 Foes：OpenBW 在 [bwgame.h 的 trigger_players_pred](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h#L18968-L18985) 將前者做成除自己外非互相盟友條件，後者才是敵對。不把 OpenBW 當原作 Windows 客戶端逐格實測。
- 資料： [2009 鐵之狂傲原討論（第 11 則）](https://www.gamez.com.tw/t/topic/374947/11) · [原 RAR](https://www.gamez.com.tw/uploads/short-url/1XtPBgghg6jzzUR5rNLRAceXrnS.rar) · [同名 SPEED 鏡像](https://scmscx.com/map/2tzpVkp9) · [非 SPEED FastBlack v2.91f](https://scmscx.com/map/7zGY2kzG)。原 SCX SHA-256 `2c174ba874184625a0e61dd3eea50f5c11ac0918137212206f20de15e922cd29`；其他樣本以原研究雜湊表識別。地圖與完整 trigger 匯出只保留在取得目錄，不隨本報告傳播。

## 原作座標（不能直接以網站新版四席順序代換）

- 原圖與 SPEED 鏡像的座標相同：96×96 格，CHK 原點在左上，以下每格 32 原圖像素，角色面向與畫面旋轉不改座標。各席按原圖 IDS 是 P1 北、P2 西、P3 南、P4 東，從北**逆時針**；若以順時針報座序，是北 P1 → 東 P4 → 南 P3 → 西 P2。FORC 也確認北／西同隊，南／東同隊。不能把畫面上的第 2 位直接讀成 P2；網站四席的補給區排法是開發設計，不是原圖特殊旗點座標。
- 原附件／SPEED：Armageddon 啟動矩形 #31 (992,96)–(1088,160)，可見標在 (1040,128)，返回 #42 (960,192)–(1120,224)。清兵十字 #24 (1216,0)–(1792,3072)、#25 (0,928)–(3072,1504)，交會中心在 (1504,1216)，不是地圖的幾何中心 (1536,1536)。三種 Foes 英雄特例使用 #64 Anywhere (0,0)–(3072,3072)。
- 原附件／SPEED：奪兵 #74 (2272,512)–(2464,608) 內的旗標預置在 (2416,576)，效果 / Return 分別是 #79 (1312,0)–(1696,2496)、#80 (224,1088)–(2784,1408)、#81 (1792,448)–(2176,928)、#82 (640,1504)–(1216,2048)，以及返回 #83 (2496,640)–(2624,736)。建築補血／盾 #78 (2880,800)–(2976,864)，旗標 (2928,832)，共用效果 #79／80，沒有返程。
- 原附件／SPEED：非全球、每席共用的額外塔區按北 P1 #50 (1472,32)–(1536,96)、西 P2 #52 (224,1216)–(288,1280)、南 P3 #54 (1472,2432)–(1536,2496)、東 P4 #56 (2720,1216)–(2784,1280)。三種都從西南補給板啟動，原 #62 Cannon (480,2784)–(576,2848)、#53 Spore (480,2880)–(576,2944)、#51 Sunken (480,2688)–(576,2752)。
- 非 SPEED v2.91f：Armageddon #11 (960,96)–(1088,160) → #12 (928,160)–(1120,256)；Mind Control #79 (2336,96)–(2464,160) → #88 (2304,160)–(2496,256)；Elixir #80 (2336,288)–(2464,352) → #89。前兩者的十字 #56 (1248,64)–(1888,3008)、#58 (64,1248)–(3008,1888)，交會中心 (1568,1568)。
- 原附件／SPEED #83 的「Invisomobile」扣 2,000 礦、生成 6 架 Arbiter；v2.91f #108 也是 2,000 礦、分區生成 8 架 Arbiter。這是購買部隊，並未執行全球無敵或全圖隱形，不能把名稱當作另一個被驗證的特殊旗點。
