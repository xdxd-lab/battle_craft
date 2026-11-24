# BaattleCraft v4｜十字對衝｜星際前線試作

`battle_craft-v4.html` 是單一離線 HTML，內含 Three.js、Draco 解碼器與本輪兩個 3D Garden GLB。雙擊即可在支援 WebGL 的瀏覽器中遊玩，不需登入 3D Garden。

## 本輪內容

- 以傾斜透視攝影機重建整個十字戰場，加入金屬平台、能源導線、中央控制環、雙方基地、補給平台、星空與戰鬥效果。
- 3D Garden 的 `small-lamp-01` 和 `portable-lamp` 為 Realistic 標籤的模型，分別在補給平台與戰區邊緣重複放置，共 8 個實例。兩種 GLB 各只內嵌一次；下載檔中的素材是使用者之前從 3D Garden 取得的檔案。
- 程序建立的金屬、玻璃、燈光與發光物件使用 PBR 材質，作為科幻場景主體。3D Garden 目前沒有適合直接充當星艦、機甲或科幻基地的 Realistic／Semi-realistic 模型，因此未將木製家具或大教堂石材強行置入。
- 保留單機左右軸玩法。金幣不足時，站在信標上等到足夠會自動購買；同一次停留只購買一次，離開後再踏入可再次購買。
- 加入高畫質／省電切換。`file://` 可離線使用。

## 授權與範圍

模型頁：[small-lamp-01](https://www.3dgarden.app/model/small-lamp-01)、[portable-lamp](https://www.3dgarden.app/model/portable-lamp)。[3D Garden Licence](https://www.3dgarden.app/licence)允許將模型放進遊戲及商業作品，不允許單賣模型檔。Three.js 授權見 [Three.js MIT 授權](../vendor/THREE-LICENSE.txt)。

這是單機視覺與玩法原型，不包含四人連線、戰爭迷霧、飛行兵種或正式商業發行所需的效能、跨裝置與平衡驗證。

## 建置

見[專案建置說明](../README.md#本機建置)。
