# 收錄的第三方技能

`skills/` 裡的技能分兩種：

- **外部技能**：從各自的 repo **原樣複製**過來，內容沒有修改。
- **`pixi-addons`、`xstate-flow`、`card-room-server`、`release-pipeline`**：本專案自己寫的技能。後兩個是 2026-10-07 從 AGENTS.md 拆出來的：
  - `card-room-server`：伺服器訊息、驗證、限流、私密欄位、斷線重連
  - `release-pipeline`：測試掛鉤、主程式大小預算、package-lock、CI、發佈

  拆分的原因是 AGENTS.md 每一輪都會整份載入，當時已經長到 115 行；拆完後剩 57 行，只保留核心規則和技能索引。
- **`card-game-design`**：本專案改寫的技能，內容取自 awesome-gamedev（Apache-2.0）和 Game Studios（MIT）。原作者與修改內容寫在該資料夾的 `NOTICE`。

本專案特有的規則寫在 `../AGENTS.md`。

| 技能 | 來源 | 版本 | 授權 | 收錄範圍 |
|---|---|---|---|---|
| `colyseus` | [colyseus/skill](https://github.com/colyseus/skill) | commit `9e3ce13`（2026-08-27），技能自標 0.18.0 | MIT（`skills/colyseus/LICENSE`） | `SKILL.md`、`references/`、`LICENSE` |
| `pixijs` 系列 | [pixijs/pixijs-skills](https://github.com/pixijs/pixijs-skills) | commit `83760c6`（2026-10-01），從 pixijs v8.22.0 同步 | MIT（`skills/pixijs/LICENSE`） | 26 個子技能中收錄 14 個，清單見下方 |
| `gsap-core`、`gsap-timeline` | [greensock/gsap-skills](https://github.com/greensock/gsap-skills)（GSAP 官方） | commit `aed9cfd`（2026-04-21） | MIT（各資料夾內的 `LICENSE`） | 8 個子技能中收錄 2 個。`gsap-performance` 談的是 CSS 和 DOM 的效能技巧，套到 Pixi 上會誤導，所以不收；`scrolltrigger`、`react`、`frameworks`、`plugins`、`utils` 本專案用不到 |
| `capacitor-app-development` | [capawesome-team/skills](https://github.com/capawesome-team/skills)（Capawesome，第三方） | commit `c58aeb0`（2026-10-05），支援 Capacitor 6～8 | MIT（`skills/capacitor-app-development/LICENSE`） | 整份收錄（主文件加上 18 份參考文件）。內容會推薦 Capawesome 自家的付費服務 |

**本專案自己寫的技能**：`pixi-addons`，涵蓋 @pixi/ui、@pixi/layout、spine-pixi-v8、@pixi/sound，以及 GSAP 用在 Pixi 物件上的寫法。這些套件找不到官方技能，搜到的社群技能也都是為特定專案寫的，所以自己寫。內容以 `node_modules` 裡的型別定義和本專案實測的寫法為準，套件升級時要一起更新。

**本專案自己寫的技能：`xstate-flow`**。內容是 XState v5 的前端流程寫法：v4 舊寫法和 v5 寫法的對照、`snapshot.can()`、`subscribe` 在狀態沒變時也會通知的陷阱，以及新增狀態的步驟。自己寫的原因如下：

- Stately 官方的 `statelyai/skills`（含 `xstate-v5`）**沒有任何授權條款**，不能收錄。
- 有授權的社群版本，有的沒用到 v5 的關鍵 API，有的只適用於原作者自己的專案。

**awesome-gamedev 與 Claude-Code-Game-Studios 的處理方式**（兩者都評估了全部的候選內容）：

| 內容 | 處理方式 |
|---|---|
| awesome-gamedev `prototype-fast`（Apache-2.0，commit `d4b0e35`） | **原樣收錄**，附上原 repo 的 LICENSE 和 NOTICE。它和遊戲引擎無關。裡面提到的 `game-jam`、`steam-publish`、`itch-publish` 這幾個技能沒有收錄 |
| awesome-gamedev `card-game`、`game-feel`、`game-ui-ux`、`audio-design` | **改寫後合併成 `card-game-design`**。原文的程式範例都是 Godot／Unity，而且預設由前端決定遊戲結果，所以只保留適用的觀念 |
| awesome-gamedev `performance-optimization`、`save-systems`、`input-systems` | 不收。只取「先實際量測再優化」「本機存檔的資料不可信」「按鈕要防止連點」這幾個觀念，寫進 card-game-design 或 AGENTS.md |
| Game Studios 的 `rules/network-code`、`ui-code`、`test-standards` | 摘取其中的規則：伺服器權威、限制日誌頻率、UI 不保存遊戲狀態、修 bug 前先看測試失敗、不穩定測試的判斷門檻。這些規則寫進 AGENTS.md 和 card-game-design |
| Game Studios 的 `release-checklist`、`launch-checklist` | **改寫成 `docs/release-checklist.md`**。只保留手機版、建置、資安、商店、上線準備這幾段，並補上本專案特有的項目 |
| Game Studios 的其他 70 個技能、hooks、settings.json | 不收。這些內容依賴它自己的 `project.yaml`、`production/` 目錄和各種 agent 角色；hooks 會在每次寫檔、執行指令、對話開始與結束時自動跑 shell 腳本 |

**評估後沒有收錄的**：
- `statelyai/skills`（Stately 官方）：截至 2026-10-07，repo 沒有 LICENSE 檔，`SKILL.md` 和 README 也沒有寫授權條款。開發者可以自己全域安裝來用，但不要放進本專案。
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
- **xstate-flow 的驗證**：
  - 「`subscribe` 在狀態沒變時也會通知」這件事，用 node 實際跑過。訂閱者收到的狀態依序是 `["a","a","b","b"]`。
  - 照技能的建議，把按鈕判斷改成 `snapshot.can()` 之後，e2e 連跑 3 次，每次 21 項全部通過。
  - 開一個全新的 `claude -p` 對話，請它加一個「確認」步驟。它載入了 `xstate-flow`，所有按鈕都改用 `can()` 判斷。它也正確判斷這只是前端的 UI 步驟，不是新的遊戲階段，所以沒有改動伺服器。

- **card-game-design 的驗證**：
  - 照它的「減少動態效果」規則實作，並遵守 Game Studios 測試規範的「先看失敗」：先加 2 筆 e2e 檢查，在還沒實作時跑一次，**確實失敗了**（21 項通過、2 項失敗）。實作之後連跑 3 次，每次 **23 項全部通過**。
  - 開一個全新的 `claude -p` 對話，請它規劃「改成 52 張牌、同點數比花色、加發牌動畫」。它做到了以下幾點：
    - 載入了 `card-game-design`，第一步就是「先寫測試，看它失敗」。
    - 洗牌只放在伺服器，`.view()` 保持不變。
    - 發牌動畫會依照「減少動態效果」的設定處理。
    - 主動指出新規則下平手的程式碼會變成永遠用不到，並把要不要刪除交給人決定。

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
