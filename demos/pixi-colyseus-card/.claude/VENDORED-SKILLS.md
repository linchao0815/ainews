# 收錄的第三方技能

`skills/` 裡的技能是從官方 repo **原樣複製**過來的，沒有修改內容。本專案特有的規則寫在 `../AGENTS.md`。

| 技能 | 來源 | 版本 | 授權 | 收錄範圍 |
|---|---|---|---|---|
| `colyseus` | [colyseus/skill](https://github.com/colyseus/skill) | commit `9e3ce13`（2026-08-27），技能自標 0.18.0 | MIT（`skills/colyseus/LICENSE`） | `SKILL.md`、`references/`、`LICENSE` |
| `pixijs` 系列 | [pixijs/pixijs-skills](https://github.com/pixijs/pixijs-skills) | commit `83760c6`（2026-10-01），從 pixijs v8.22.0 同步 | MIT（`skills/pixijs/LICENSE`） | 26 個子技能中收錄 14 個，清單見下方 |

收錄的 PixiJS 技能：`pixijs`（總入口）、`pixijs-application`、`pixijs-assets`、`pixijs-scene-core-concepts`、`pixijs-scene-container`、`pixijs-scene-sprite`、`pixijs-scene-graphics`、`pixijs-scene-text`、`pixijs-events`、`pixijs-ticker`、`pixijs-performance`、`pixijs-migration-v8`、`pixijs-scene-particle-container`、`pixijs-filters`。

沒收錄的 PixiJS 技能是本專案用不到的：mesh、gif、dom-container、html-source、custom-rendering、blend-modes、accessibility、environments、math、color、core-concepts、create。總入口連到這些技能時會找不到檔案，這時它會依自己的備援規則，改查 `pixijs.download` 的 llms.txt。

## 收錄前做過的檢查（2026-10-07）

- **Colyseus 技能**：`SKILL.md` 全文和 README 都讀過。兩個技能包的所有 `.md` 檔都用關鍵字掃描過，包括 `curl | sh`、「ignore previous」、金鑰、`rm -rf` 等，沒有發現可疑內容。外部連結都指向官方網域（`docs.colyseus.io`、`pixijs.download`）、`example.com` 示範網址，或 MDN 等公開文件。
- 兩個技能包都**沒有任何腳本檔和 hook**。
- **套用驗證**：依照 Colyseus 技能，把專案改成 0.18 推薦的寫法（`Callbacks.get`、`messages = {...}`、`SchemaType`）之後，`npm run test:e2e` 連跑 3 次，正式版再跑 1 次，每次 21 項全部通過。
- **啟用驗證**：在本目錄開一個全新的 `claude -p` 對話，請它寫 Colyseus 程式但不指定寫法。它自己載入了 `colyseus` 技能，寫出 `callbacks.listen(...)` 和 `messages` 的新寫法，也照 AGENTS.md 加上階段檢查和 REJECT 記錄。

## 更新方式

```powershell
git clone --depth 1 https://github.com/colyseus/skill $env:TEMP\colyseus-skill
git clone --depth 1 https://github.com/pixijs/pixijs-skills $env:TEMP\pixijs-skills
# 1. 跟目前的 skills/ 比對差異，讀過新增或修改的內容
# 2. 覆蓋 skills/ 底下對應的資料夾（PixiJS 只覆蓋上面那 14 個）
# 3. 更新本檔的 commit 編號
# 4. 跑 npm run test:e2e，確認全部通過
```

官方另有一鍵安裝指令：`npx skills add colyseus/skill`、`npx skills add https://github.com/pixijs/pixijs-skills`。但這兩個指令會裝進全部的子技能，而且不會在 repo 裡固定版本，所以本專案改用上面的手動方式。
