# BaattleCraft v3｜十字對衝

`battle_craft-v3.html` 由 `../v2/battle_craft-v2.html` 製作，保留原檔。雙擊 HTML 可在瀏覽器離線開啟。

## 本輪變更

- 將 3D Garden 的 Cardboard Tree 與 barrel-01 以 GLB 內嵌於單一 HTML。樹放在戰場兩側，木桶放在補給區信標旁，只作裝飾。
- 保留 v2 的玩家對電腦、金幣、信標、出兵與勝負規則。
- 本儲存庫可玩版沿用 v2 購兵規則：金幣不足時可站在信標上等待，存夠後自動購買一次；再次購買需離開再踏入。
- [最初交付的 v3 快照](../research/archive/battle_craft-v3-original.html)採用「踏入當下判定，金幣不足須重新踏入」；兩版行為不同，請依實際檔案區分。
- 無法使用 WebGL 或模型載入失敗時，仍可玩原本的 2D 遊戲。

## 素材與授權

- [Cardboard Tree](https://www.3dgarden.app/model/tree)
- [barrel-01](https://www.3dgarden.app/model/barrel-01)
- [3D Garden Licence](https://www.3dgarden.app/licence)

3D Garden 允許模型用於遊戲與商業作品，也允許將模型隨遊戲提供。不得單獨出售模型檔或將模型打包成付費素材庫。引擎使用專案既有的 Three.js vendor 版本；其授權檔位於 [Three.js MIT 授權](../vendor/THREE-LICENSE.txt)。

## 建置

見[專案建置說明](../README.md#本機建置)。

這是視覺整合試作，尚未把十字地圖改成完整 2v2，也未加入戰爭迷霧與飛行兵種。
