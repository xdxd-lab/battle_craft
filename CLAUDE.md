# BaattleCraft 交接入口

本儲存庫的目前狀態與未決事項見 [research/STATUS.md](research/STATUS.md)，已確認的購兵與 2v2 方向見 [research/DEVELOPMENT.md](research/DEVELOPMENT.md)。兩次 v2 分支、主線原型及 3D Garden 經驗見[原型經驗與開發建議](research/PROTOTYPE-LESSONS.md)。[README.md](README.md)列出可玩版本與建置方式。[GitHub Issues](https://github.com/xdxd-lab/battle_craft/issues)追蹤後續工作。

- 遊戲顯示名稱為 **BaattleCraft**，儲存庫與檔名使用 `battle_craft`。研究原作時保留來源名稱 `BattleCraft`。
- v5 是目前可玩基準。玩家在場外信標上金幣足夠就會購兵，錢不足時站著等會在存夠後自動購買，持續站著則再次購買。早期各版行為不同，特別是 [v3 原始快照](research/archive/battle_craft-v3-original.html)與目前可玩 v3 的缺錢處理。
- 四人 2v2、戰爭迷霧、飛行兵、正式平衡與多人同步尚未在本遊戲完成。原作 SC1、SC2 重製版與 Web 原型數值應分別標示來源。[研究報告](research/battle_craft-research.md)已整理 SCX 樣本雜湊、Trigger 判讀及取得限制。
- 3D Garden 模型是遊戲素材來源，`3d_garden` 是其他專案和技術試作位置。本專案的工作目錄是此儲存庫。現有模型的來源與條款見 [assets/3dgarden/README.md](assets/3dgarden/README.md)。
- 在根目錄執行 `npm ci`、`npm run build`、`npm test`。建置產生 v3～v5 的單檔 HTML；請核對來源腳本與輸出。GitHub Pages 使用根目錄的 `index.html`。

本機 `research/local-source/` 保留第三方 SCX、完整 Trigger 匯出與私人對話連結，並未隨公開儲存庫分發。接手者可依研究報告中的鏡像連結、樣本雜湊及 scmJS 指令重建公開來源的分析資料。
