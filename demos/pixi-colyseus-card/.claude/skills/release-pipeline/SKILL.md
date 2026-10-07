---
name: release-pipeline
description: "本專案的打包、套件、CI 與發佈規則：測試掛鉤 window.__demo 只在開發與 e2e 建置啟用（test:bundle 檢查）、主程式大小預算 750 KB、build:e2e 打包版測試、package-lock 必須用新版 npm 產生、npm audit 必須為 0、GitHub Actions workflow、push 後監看 CI 直到結束、上架前填 docs/release-checklist.md。新增或升級套件、改 vite 或打包設定、新增測試掛鉤或測試指令、改 CI、push、準備發佈或上架之前使用。"
---

# 打包、CI 與發佈

## 1. 測試掛鉤不能出現在正式版

- `window.__demo` 只在兩種建置裡存在：`vite` 開發模式（`import.meta.env.DEV`），以及 `vite build --mode e2e`（`npm run build:e2e`）。一般的 `npm run build` 會把整段程式碼移除。
- **新增測試掛鉤時，要寫在 `client/main.ts` 裡同一個 `if (import.meta.env.DEV || import.meta.env.MODE === "e2e")` 底下。**
- 這組掛鉤是 e2e 測試讀取遊戲狀態的唯一管道。目前有：`name` `sessionId` `machine` `transitions` `errors` `state` `cards` `buttonCenter` `spine` `soundExists` `counters` `rawSend` `connection` `leave` `ui`。改動既有欄位時，要在同一次修改裡一起更新 `tests/`。
- `npm run test:bundle` 會用正式模式建置到 `dist-prod/`，再掃描打包結果。只要出現 `__demo` 或 `rawSend` 就判定失敗。

## 2. 主程式大小預算：750 KB

- 同樣由 `npm run test:bundle` 檢查，對象是 `index.html` 第一個載入的 JS 檔。
  - 原本是 956 KB，改成延後載入 `@pixi/sound` 之後是 723 KB。
- **新增大型套件之前**，先確認它能不能用 `import()` 延後載入。目前延後載入的寫法參考 `loadExtras()`。
- **Spine 不能延後載入**，原因見 `pixi-addons` 技能。只要套件在 import 時就會註冊渲染器擴充（renderer pipe、batcher），一律要在 `app.init()` 之前用靜態 import 載入。
- 預算只有在「延後載入確實不可行」時才能調整，而且要把原因寫進 `tests/check-bundle.mjs` 的註解。不可以為了通過檢查，悄悄把數字改大。

## 3. 套件與 package-lock

- **`package-lock.json` 要用新版 npm 產生**：
  ```
  npx npm@latest install <套件>
  npx npm@latest install --package-lock-only
  ```
  原因：CI 用的是 Node 24 最新版附帶的 npm，它會檢查「選用依賴底下的同伴依賴」。本專案的依賴鏈是 `@pixi/layout` → 選用依賴 `@pixi/react` → 同伴依賴 `react`。用 npm 11.6.2 產生的 lock 會漏掉 `react`，CI 上的 `npm ci` 就會報 `Missing: react@19.3.0 from lock file` 而失敗。這個問題已經在 CI 實際發生過。
- **push 之前**，在一個乾淨的目錄跑 `npx npm@latest ci`，確認安裝成功。
- `npm audit --omit=dev` 結果必須是 0（CI 也會檢查）。出現漏洞時，先查是哪個依賴鏈帶進來的，優先改成更精簡的套件組合（先例：`colyseus` 換成 `@colyseus/core`，見 `card-room-server` 技能）。不要照 `npm audit fix --force` 的建議降版。

## 4. 打包版的 e2e

改到打包設定、資源載入或延後載入的程式時，除了開發版 e2e，還要測打包版：

```
npm run build:e2e
npm run preview                                        # 背景執行，port 4173
BASE=http://localhost:4173 npm run test:e2e
BASE=http://localhost:4173 npm run test:layout
npm run test:bundle
```

完成條件：以上全部印出 PASS／ALL PASS。

## 5. CI（GitHub Actions）

- workflow 在 repo 根目錄：`.github/workflows/pixi-colyseus-card-ci.yml`。只要改到 `demos/pixi-colyseus-card/**` 就會觸發。
- 執行步驟：`npm ci` → `npm audit --omit=dev` → `npm run assets` → `test:bundle` → `build:e2e` 加上啟動伺服器 → `test:e2e` → `test:layout`。`logs/` 一律上傳成 artifact，保留 7 天。
- 新增測試指令時，要同時把它加進這個 workflow。
- actions 一律用目前最新的主版本（2026-10 是 `@v7`）。改版本之前，先用 `gh api repos/<action>/git/ref/tags/<tag>` 確認這個 tag 真的存在。
- **push 之後，一定要監看 CI 直到跑完**：
  1. 用 `gh run list --workflow pixi-colyseus-card-ci.yml --limit 3` 找出這次的 run。
  2. 在背景執行 `gh run watch <id> --exit-status`。
  3. 跑完後回報結果，而且要看測試數字（ALL PASS、通過幾項），不能只看結論是 success。
  4. 失敗時，用 `gh run view <id> --log-failed` 查原因。修好、重新 push 之後，新的 run 也要照樣監看。

  **不可以看到 in_progress 就結束這一輪。**
- **`gh run watch` 回傳非 0，不一定代表 CI 失敗。** 連 GitHub API 逾時的時候（log 會出現 `dial tcp … connectex`），watch 也會用 exit 1 直接結束，但 CI 其實還在跑（2026-10-07 實際發生過）。遇到這種情況，處理方式如下：
  1. 先用 `gh run view <id> --json status,conclusion` 確認 CI 的實際狀態。
  2. 如果還在跑，改用下面這個會自動重試的迴圈，每 20 秒查一次，直到 CI 跑完：
     ```bash
     for i in $(seq 1 60); do
       s=$(gh run view <id> --json status,conclusion --jq '"\(.status) \(.conclusion)"' 2>/dev/null)
       case "$s" in "completed "*) echo "$s"; break;; esac   # 查詢失敗時 s 為空，下一輪會自動重試
       sleep 20
     done
     ```

## 6. 發佈與上架

- 上架前要逐項填寫 `docs/release-checklist.md`。每一項只能是「通過」「不通過」或「未評估」，沒有檢查的項目不能算通過。
- Spine 範例素材受 Spine 授權約束，不收進版本庫（已列在 `.gitignore`），需要時用 `npm run assets` 下載。商業專案要另外購買 Spine 授權。
- Android 要打包成 APK，需要 Java 和 Android SDK。目前驗證過的範圍只到 `npx cap add android` 和 `npx cap sync android`。
