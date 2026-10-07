# 收錄的第三方技能

`skills/` 裡的技能分兩種：

- **外部技能**：從各自的 repo **原樣複製**過來，內容沒有修改。
- **`pixi-addons`**：本專案自己寫的技能。

本專案特有的規則寫在 `../AGENTS.md`。

| 技能 | 來源 | 版本 | 授權 | 收錄範圍 |
|---|---|---|---|---|
| `colyseus` | [colyseus/skill](https://github.com/colyseus/skill) | commit `9e3ce13`（2026-08-27），技能自標 0.18.0 | MIT（`skills/colyseus/LICENSE`） | `SKILL.md`、`references/`、`LICENSE` |
| `pixijs` 系列 | [pixijs/pixijs-skills](https://github.com/pixijs/pixijs-skills) | commit `83760c6`（2026-10-01），從 pixijs v8.22.0 同步 | MIT（`skills/pixijs/LICENSE`） | 26 個子技能中收錄 14 個，清單見下方 |
| `gsap-core`、`gsap-timeline` | [greensock/gsap-skills](https://github.com/greensock/gsap-skills)（GSAP 官方） | commit `aed9cfd`（2026-04-21） | MIT（各資料夾內的 `LICENSE`） | 8 個子技能中收錄 2 個。`gsap-performance` 談的是 CSS 和 DOM 的效能技巧，套到 Pixi 上會誤導，所以不收；`scrolltrigger`、`react`、`frameworks`、`plugins`、`utils` 本專案用不到 |
| `capacitor-app-development` | [capawesome-team/skills](https://github.com/capawesome-team/skills)（Capawesome，第三方） | commit `c58aeb0`（2026-10-05），支援 Capacitor 6～8 | MIT（`skills/capacitor-app-development/LICENSE`） | 整份收錄（主文件加上 18 份參考文件）。內容會推薦 Capawesome 自家的付費服務 |

**本專案自己寫的技能**：`pixi-addons`，涵蓋 @pixi/ui、@pixi/layout、spine-pixi-v8、@pixi/sound，以及 GSAP 用在 Pixi 物件上的寫法。這些套件找不到官方技能，搜到的社群技能也都是為特定專案寫的，所以自己寫。內容以 `node_modules` 裡的型別定義和本專案實測的寫法為準，套件升級時要一起更新。

**評估後沒有收錄的**：
- `ionic-team/capacitor-skills`（Capacitor 官方）、`Cap-go/capgo-skills`：兩者都**沒有授權條款**，依法不能複製；而且內容是外掛開發、版本遷移、產生 CI 設定，和本專案無關。
- 社群的 GSAP、@pixi/ui、@pixi/layout、Spine 技能：大多是為特定專案寫的，或沒有授權條款。

收錄的 PixiJS 技能：`pixijs`（總入口）、`pixijs-application`、`pixijs-assets`、`pixijs-scene-core-concepts`、`pixijs-scene-container`、`pixijs-scene-sprite`、`pixijs-scene-graphics`、`pixijs-scene-text`、`pixijs-events`、`pixijs-ticker`、`pixijs-performance`、`pixijs-migration-v8`、`pixijs-scene-particle-container`、`pixijs-filters`。

沒收錄的 PixiJS 技能是本專案用不到的：mesh、gif、dom-container、html-source、custom-rendering、blend-modes、accessibility、environments、math、color、core-concepts、create。總入口連到這些技能時會找不到檔案，這時它會依自己的備援規則，改查 `pixijs.download` 的 llms.txt。

## 收錄前做過的檢查（2026-10-07）

- **Colyseus 技能**：`SKILL.md` 全文和 README 都讀過。兩個技能包的所有 `.md` 檔都用關鍵字掃描過，包括 `curl | sh`、「ignore previous」、金鑰、`rm -rf` 等，沒有發現可疑內容。外部連結都指向官方網域（`docs.colyseus.io`、`pixijs.download`）、`example.com` 示範網址，或 MDN 等公開文件。
- 兩個技能包都**沒有任何腳本檔和 hook**。
- **套用驗證**：依照 Colyseus 技能，把專案改成 0.18 推薦的寫法（`Callbacks.get`、`messages = {...}`、`SchemaType`）之後，`npm run test:e2e` 連跑 3 次，正式版再跑 1 次，每次 21 項全部通過。
- **啟用驗證**：在本目錄開一個全新的 `claude -p` 對話，請它寫 Colyseus 程式但不指定寫法。它自己載入了 `colyseus` 技能，寫出 `callbacks.listen(...)` 和 `messages` 的新寫法，也照 AGENTS.md 加上階段檢查和 REJECT 記錄。
- **第二批技能的啟用驗證**（GSAP、Capacitor、pixi-addons）：另外開 3 個全新對話，各出一道刻意設陷阱的題目：
  - **Spine**：它載入了 `pixi-addons`，寫出 `getTrack(0)`，沒有用舊的 `getCurrent()`。
  - **GSAP 淡出**：它載入了 `pixi-addons` 和 `gsap-core`，改用 `alpha` 淡出，並在 `onComplete` 裡設 `visible = false`，沒有用 `autoAlpha`。它還主動在淡出期間把點擊事件關掉。
  - **Capacitor 連正式伺服器**：它載入了 `capacitor-app-development` 和 `colyseus`。伺服器位址改從打包時的環境變數或網址參數傳入，沒有誤改 `capacitor.config.ts` 的 `server.url`。它也正確判斷：用 `wss://` 連線時，不需要開啟允許明文連線的 `cleartext`。
- 收錄 GSAP 和 Capawesome 之前，所有 `.md` 都用同一份關鍵字清單掃描過，沒有發現可疑內容。也確認這兩包都沒有附帶腳本或 hook。

## 更新方式

```powershell
git clone --depth 1 https://github.com/colyseus/skill $env:TEMP\colyseus-skill
git clone --depth 1 https://github.com/pixijs/pixijs-skills $env:TEMP\pixijs-skills
git clone --depth 1 https://github.com/greensock/gsap-skills $env:TEMP\gsap-skills
git clone --depth 1 https://github.com/capawesome-team/skills $env:TEMP\capawesome-skills
# 1. 跟目前的 skills/ 比對差異，讀過新增或修改的內容
# 2. 覆蓋 skills/ 底下對應的資料夾（PixiJS 只覆蓋上面那 14 個）
# 3. 更新本檔的 commit 編號
# 4. 跑 npm run test:e2e，確認全部通過
```

官方另有一鍵安裝指令：`npx skills add colyseus/skill`、`npx skills add https://github.com/pixijs/pixijs-skills`。但這兩個指令會裝進全部的子技能，而且不會在 repo 裡固定版本，所以本專案改用上面的手動方式。
