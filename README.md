![BaattleCraft 原創科幻十字戰場概念橫幅](assets/branding/baattlecraft-banner.png)

**最新版本：[v6-1 線上遊玩](https://xdxd-lab.github.io/battle_craft/dev02-four-seats/battle_craft-v6-1.html)** · [改動與驗證](research/BC-V6-1-RELEASE.md) · [v6-0](dev02-four-seats/battle_craft-v6-0.html) · [v5-9](dev02-four-seats/battle_craft-dev02.html)

[守城試驗：NPC、砲塔與三種兵外觀](research/BC-V6-DEFENSE-LAB.md)。暫存試驗：[特殊信標與九兵種售價試算](research/BC-V6-PRICING-COMPARISON.md)。
# BaattleCraft｜十字對衝

[在 GitHub Pages 遊玩](https://xdxd-lab.github.io/battle_craft/) · [目前狀態與待辦](research/STATUS.md) · [開放議題](https://github.com/xdxd-lab/battle_craft/issues) · [開發交接](research/DEVELOPMENT.md) · [原作歷史、SCX Trigger 與素材調查](research/battle_craft-research.md)

BaattleCraft 目前有六個單機試作。長期方向是四人 2v2、場外購兵與部隊沿十字路線自動交戰；四人連線和戰爭迷霧尚待開發。

橫幅是原創場景概念圖，供儲存庫展示及後續美術方向討論；遊戲內畫面以各版試作為準。

## 版本紀錄

| 版本 | 本輪主要變更 |
| --- | --- |
| [v1](v1/battle_craft-v1.html) | 2D 單機，以按鍵購兵，部隊沿中央道路進軍。 |
| [v2](v2/battle_craft-v2.html) | 信標移到戰區外，站著等到金幣足夠會購買；每次停留只買一次。 |
| [v3](v3/battle_craft-v3.html) | [3D Garden 裝飾試作](v3/README.md)，含紙板樹、木桶與 2D 回退。此版可站著等金幣買一次；[最初快照](research/archive/battle_craft-v3-original.html)須重新踏入。 |
| [v4](v4/battle_craft-v4.html) | [傾斜 3D 星際戰場](v4/README.md)，加入寫實燈具與畫質切換。每次停留只買一次。 |
| [v5](v5/battle_craft-v5.html) | [提高俯角、持續自動購兵、血條與分色事件紀錄](v5/README.md)。建議從此版試玩。 |
| [v5-2](v5-2/battle_craft-v5-2.html) | 保留歷史 HTML 快照。 |
| [四席 2v2](dev02-four-seats/battle_craft-dev02.html) | [單人加三電腦，陸戰隊、重騎兵、飛螳、刺蛇、破壞能、死靈式戰機、戰鬥巡洋艦、斥候、自殺蟲](dev02-four-seats/README.md)；[九兵種與九信標](research/BC-NINE-UNITS.md)、[六兵種與六信標](research/BC-SIX-UNITS.md)、[傷害規則與暫定值](research/BC01-ROSTER-DAMAGE.md)、[受損外觀與道路依據](research/BC-SURFACE-HUD.md)、[經濟與聲音](research/BC-AUDIO-ROSTER.md)。 |

各版 HTML 可下載後雙擊離線遊玩。3D 版本需要支援 WebGL 的瀏覽器。

## 本機建置

需要 Node.js、npm 與 Python 3。從儲存庫根目錄執行：

```sh
npm ci
npm run build
npm test
```

建置會重新產生 v3、v4、v5 的獨立 HTML。測試檢查 v5 信標持續購兵規則。v1、v2 和 v5-2 是歷史快照，直接開啟 HTML 即可。

## 資料來源與素材授權

- [SC1 SPEED／FastBlack 與 SC2 歷史版本、外部資源與現況](research/battle_craft-research.md)
- [原主工作區歷史文件快照（2026-11-28）](research/archive/local-workspace-20261128/README.md)
- [跨 AI 研究交接快照](research/battle_craft-source-master-handoff.md) · [3D Garden 開發指南快照](research/battle_craft-source-3dgarden-handoff.md)
- [3D Garden 模型及個別來源](assets/3dgarden/README.md) · [3D Garden 授權](https://www.3dgarden.app/licence)
- [Three.js MIT 授權](vendor/THREE-LICENSE.txt) · [Draco Apache 2.0 授權](vendor/addons/draco/LICENSE.txt)
