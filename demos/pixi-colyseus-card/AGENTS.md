# AGENTS.md：pixi-colyseus-card

這是一個兩人「比大小」卡牌遊戲，用來做技術驗證的最小範例。前端用 PixiJS 8，再用 Capacitor 包成 App；伺服器用 Colyseus 0.18。
指令請看 `package.json` 的 scripts，人工操作步驟請看 `README.md`。

## 核心規則：伺服器說了算

- **發牌、判定勝負、計分只能寫在 `server/CardRoom.ts`**。前端只負責兩件事：畫出 `room.state`，以及用 `room.send()` 送出玩家想做的動作。
- 對手看不到的資料（手牌等）**根本不送到對方的瀏覽器**，不是只在畫面上藏起來。
- 每一個被拒絕的請求都要記錄，每一條規則都要有 e2e 測試。
- 細節請看 `card-room-server` 技能。

## 開發流程

1. **補素材**：如果 `public/assets/` 不存在，執行 `npm run assets`（需要 Python）。完成條件：`public/assets/spine/` 底下有 3 個檔案，而且有 `public/assets/reveal.wav`。
2. **啟動服務**：在背景執行 `npm run server > logs/server.log`（port 2567）和 `npm run dev`（port 5173）。完成條件：`curl` 兩個 port 都有回應。如果 port 被占用，代表上一輪的程序還在，先把它結束。
3. **先寫測試**：每一條新規則或新功能，都先在 `tests/e2e.mjs` 加一筆 `check(...)`，親眼看到它失敗，再開始實作。
4. **實作**。
5. **執行 `npm run test:e2e`**。完成條件：印出 `ALL PASS`。
   - 改到版面、文字或 UI 時，再跑 `npm run test:layout`，並打開 `logs/e2e/*.png`、`logs/responsive/*.png` 看截圖。數字通過了也要看截圖，因為有些問題只有畫面看得出來。
   - 測試執行中改了 `client/main.ts` 或 `index.html`，Vite 會整頁重新載入，測試會出現「Execution context was destroyed」。這不是程式錯誤，等 2～3 秒重跑即可。
   - 改到打包、套件或資源載入時，照 `release-pipeline` 技能，加跑打包版的 e2e 和 `test:bundle`。
6. **收尾**：把 2567、5173、4173 三個 port 的程序都結束掉。要 push 的話，照 `release-pipeline` 技能，**監看 CI 直到跑完**。

## 測試紀律

- **修 bug 時，先寫一個能重現它的檢查，看它失敗，再修。** 沒看過失敗的測試，不能證明它真的在檢查那件事。
- **不穩定的測試**（有時過、有時不過）：
  - 至少重跑 3 次才能判斷。只跑 1、2 次的結果一律算「疑似」。
  - 失敗率超過 25% 立刻處理，5～25% 要調查，1～5% 先觀察。修好之前可以先暫停這項測試，但不要刪掉。
  - 常見原因：等待時機不對（應該等到狀態符合條件，而不是固定睡幾秒）、上一輪留下的程序或房間、某個頁面太早離開。
- **測試之間要互相隔離**：e2e 結束前，對每個頁面呼叫 `__demo.leave()`（不要等它回應）。如果直接關掉瀏覽器，伺服器會替每個玩家保留座位 20 秒，下一輪的配對就會出錯。
- **沒有檢查過的項目，就照實寫「未評估」**，不要說成通過。例如沒有實體手機可以測，就寫「未在實機驗證」。

## 專案內的技能（`.claude/skills/`）

Claude Code 會自動載入這些技能。其他 agent 請在開始對應的工作之前，先讀該技能的 `SKILL.md`。

| 什麼時候讀 | 技能 |
|---|---|
| 改 `server/`、新增訊息或遊戲階段、處理斷線重連 | `card-room-server`（本專案的規則）＋ `colyseus`（官方 0.18 API） |
| 加套件、改打包或 vite 設定、新增測試掛鉤、改 CI、push、準備發佈 | `release-pipeline` |
| 改遊戲規則、牌或牌區、翻牌或揭曉的手感、音效、手機 UI | `card-game-design` |
| 改前端流程，或判斷按鈕可不可以按 | `xstate-flow` |
| 做按鈕、UI 元件、排版、Spine、音效，或對 Pixi 物件用 GSAP | `pixi-addons` |
| 任何 PixiJS v8 的工作 | `pixijs`（總入口；只收錄了 26 個子技能中的 14 個，缺的部分照它的備援規則查 llms.txt） |
| GSAP 的 API | `gsap-core`、`gsap-timeline`（官方技能是以 DOM 為對象寫的，用在 Pixi 上的差異以 `pixi-addons` 為準） |
| Capacitor 的設定、CLI、Android／iOS 疑難排解 | `capacitor-app-development`（第三方 Capawesome 寫的，會推銷付費服務；本專案優先用 `@capacitor/*` 官方外掛） |
| 要快速試做新玩法 | `prototype-fast`（原型放在另一個目錄，不要直接改這個範例） |

- **規則有衝突時，以本文件和本專案自己寫的技能為準**，因為這些都經過實測。外部技能的內容一律照原樣保留，不修改。
- 技能的來源與更新方式，見 `.claude/VENDORED-SKILLS.md`。

## 其他

- 檔案格式：文字檔用 UTF-8（不加 BOM），換行用 CRLF（repo 設定了 `core.autocrlf=true`）。暫存的輸出放在 `logs/`，這個目錄不會進版本記錄。
- 要選用或替換套件之前，先讀 `跨平台手遊-技術選型與成本-研究筆記.md` 第十一節（各套件的版本、與 v8 的相容性；標了 ⚠️ 的不要用）。評估成本或上架風險時讀第十二到十四節；要改驗證範圍時讀第十五節。
