# AGENTS.md：pixi-colyseus-card

兩人「比大小」卡牌遊戲，是技術驗證用的最小範例。
- 前端：PixiJS 8，用 Capacitor 包成 App。
- 伺服器：Colyseus 0.18。

執行指令看 `package.json` 的 scripts，人工操作步驟看 `README.md`。

## 架構規則：伺服器說了算

- **發牌、判定勝負、計分只寫在 `server/CardRoom.ts`。**
- **前端只做兩件事**：把 `room.state` 畫出來，以及用 `room.send()` 送出玩家的意圖。目前唯一的意圖是 `ready`。
- **私密資料的寫法**：在 schema 欄位加上 `.view()`，再到 `onJoin` 裡呼叫 `client.view.add(該玩家)`。這樣資料只會傳給擁有者，其他人的瀏覽器裡根本收不到。
- **新增訊息類型時**：加在 `CardRoom` 的 `messages = {...}` 裡（0.18 的宣告式寫法）。處理函式先檢查兩件事——目前是哪個遊戲階段（`state.phase`），以及送訊息的是誰（用 `client` 參數判斷，不採信訊息內容裡附帶的 sessionId）。不合法的請求，用 `log("REJECT ...")` 記下來後直接 return。
- **伺服器端從 `@colyseus/core` 和 `@colyseus/ws-transport` import**，不使用 `colyseus` 這個整合套件。整合套件會把 `@colyseus/auth` → `grant` → `elliptic`／`uuid` 一起裝進來，這幾個都有 npm audit 回報的漏洞，而本專案根本用不到登入功能。`colyseus` 技能的範例寫的是 `from "colyseus"`，照抄時要改成 `@colyseus/core`。
- **Schema 一律用 builder 語法**（`schema({...})`、`t.number()`），型別用 `SchemaType<typeof X>`。不使用裝飾器，所以 TypeScript 不需要另外設定。
- **前端監聽狀態用 `Callbacks.get(room)`**，例如 `callbacks.listen("phase", fn)`、`callbacks.onAdd("players", fn)`。
- **拒絕請求時，一律呼叫 `logReject(sessionId, 原因, 訊息)`**，不要直接用 `log("REJECT ...")`。`logReject` 會限制記錄頻率：同一位玩家、同一種原因，5 秒內只寫一行，被略過的次數會附在下一行裡。這是為了避免有人狂送作弊訊息把日誌灌爆。實測連送 50 筆，日誌只多 1 行。
- **有內容的訊息，要用 `validate(zod 格式, 處理函式)` 檢查格式**，寫法參考 `set_card`。格式不符的訊息不會進到處理函式，Colyseus 會直接把送出的玩家踢出房間，斷線代碼是 `4002`（WITH_ERROR）。正常的前端不可能送出格式錯誤的訊息，所以這樣處理是合理的。沒有內容的訊息（例如 `ready`）不需要驗證。
- **斷線重連要分清楚兩種情況**：玩家只是暫時斷線，在 `onDrop` 裡處理（呼叫 `allowReconnection`）；玩家真的離開了，才在 `onLeave` 裡把他移除。寫法見 `colyseus` 技能。

## 開發流程

1. **補素材**：如果 `public/assets/` 不存在，先執行 `npm run assets`。這一步需要 Python。完成條件：`public/assets/spine/` 底下有 3 個檔案，`public/assets/reveal.wav` 也存在。
2. **啟動服務**：在背景啟動 `npm run server`（port 2567）和 `npm run dev`（port 5173）。完成條件：`curl` 兩個 port 都有回應。如果 port 已經被占用，那是上一輪測試留下的程序，先把它結束掉。
3. **實作改動。**
4. **補測試**：新增的每一條規則或功能，都要在 `tests/e2e.mjs` 加一筆 `check(...)`。作弊情境用 `window.__demo.rawSend()` 模擬。
5. **執行 `npm run test:e2e`**。完成條件：最後一行印出 `ALL PASS`。如果改動影響畫面，還要看 `logs/e2e/*.png` 截圖確認。
6. **測正式版（改到打包或資源載入時才需要）**：執行 `npm run build`，在背景執行 `npm run preview`（port 4173），再設定 `BASE=http://localhost:4173` 跑一次 `npm run test:e2e`。完成條件：`ALL PASS`。
7. **收尾**：把 2567、5173、4173 三個 port 上的程序全部結束。

## 測試紀律

- **修 bug 時，先寫一個能重現 bug 的 `check(...)`，親眼看到它失敗，再去修程式。** 新增功能也照這個順序，先寫檢查項目再實作。沒看過失敗的測試，可能根本沒有在檢查你以為它在檢查的東西。
- **不穩定的測試**（同樣的程式，有時過、有時不過）：
  - 先用至少 3 次重跑判斷它多常失敗，只跑 1、2 次的結果一律算「疑似」。
  - 失敗率超過 25%，立刻處理；5～25% 要調查原因；1～5% 先持續觀察。
  - 常見原因有三種：等待時機不對（應該等狀態符合，而不是固定睡幾秒）、上一輪測試留下的程序或房間、一個瀏覽器頁面太早離開導致其他頁面的狀態被改掉。
  - 修好之前可以先暫停這個測試，但不能刪掉它。
- **沒有檢查過的項目，就照實回報「未評估」**，不要說成通過。例如沒有實際的手機可以測，就寫「未在實機驗證」。

## 測試掛鉤 `window.__demo`

`tests/e2e.mjs` 完全靠 `client/main.ts` 裡的 `window.__demo` 來讀取遊戲狀態，包括：`machine()`、`state()`、`cards()`、`buttonCenter()`、`spine()`、`counters()`、`rawSend()`。

重構時這些介面要保持相容。如果真的要改，同一個改動裡一併更新測試。

## 已知的坑

- **Spine 4.3 改了函式名稱**：`AnimationState.getCurrent()` 改成 `getTrack()`。寫 Spine API 前，先查 `node_modules/@esotericsoftware/spine-core/dist/*.d.ts` 確認。
- **剛連上伺服器時資料還沒到**：`joinOrCreate()` 剛完成時，`room.state.players` 可能還是 `undefined`，畫面程式要能處理這個狀況（參考 `me()`、`opp()` 的寫法）。
- **xstate 在狀態沒變時也會通知**：事件被忽略時，`actor.subscribe` 照樣會收到通知。記錄狀態轉換時，要先跟上一筆比對，排除重複。
- **`@pixi/layout` 的載入順序**：必須在建立 `Application` 之前 import。
- **粒子特效**：用 PixiJS v8 內建的 `ParticleContainer`。`@pixi/particle-emitter` 只支援 v7 以下。
- **連線套件**：用 `@colyseus/sdk`。舊的 `colyseus.js` 停在 0.16 版。
- **Spine 素材授權**：素材受 Spine 授權條款約束，所以不進版本記錄（已列在 `.gitignore`）。要用時以 `npm run assets` 下載。
- **檔案格式**：文字檔用 UTF-8（不加 BOM）、Windows 換行（CRLF）。這個 repo 有設定 `core.autocrlf=true`。暫時的輸出一律放 `logs/`，這個資料夾不會進版本記錄。

## 專案內的技能（`.claude/skills/`）

這裡收錄的技能，版本都和本專案使用的套件對得上。Claude Code 會自動載入；其他 agent 請在對應任務開始前，直接讀取該技能的 `SKILL.md`。

- **設計或修改遊戲規則、新增牌或牌區、調整翻牌與揭曉的手感、加入音效，或製作手機 UI 之前**：讀 `.claude/skills/card-game-design/SKILL.md`。這份是本專案改寫的版本，涵蓋隱藏資訊、揭曉時序、回饋分級、減少動態效果、觸控尺寸和音效解鎖。
- **要快速試做一個新玩法時**：讀 `prototype-fast`。開始之前先寫好「要回答什麼問題、時間上限、保留或放棄的判斷條件」。原型放在另一個目錄，**不要直接改這個範例**。它提到的 `game-jam`、`steam-publish` 等技能本專案沒有收錄，請忽略。

- **寫或修改 Room、Schema、前端狀態同步、重新連線的程式之前**：讀 `.claude/skills/colyseus/SKILL.md`。這是 Colyseus 官方技能，對應 0.18 版。需要細節時，依它的指引查 `references/` 裡的對應段落。
- **任何 PixiJS v8 的工作**：從 `.claude/skills/pixijs/SKILL.md`（總入口）開始，它會指引你該讀哪個子技能。本專案只收錄了 26 個子技能中的 14 個；入口技能連到的子技能如果不存在，照它自己的備援規則查 `https://pixijs.download/release/docs/llms.txt`。
- **按鈕與 UI 元件、版面排列、Spine 角色、音效，或對 Pixi 物件做 GSAP 動畫之前**：讀 `.claude/skills/pixi-addons/SKILL.md`。這是本專案自己寫的技能，內容以型別定義和實測結果為準。
- **GSAP 動畫**：一般 API 讀 `gsap-core`，串接多段動畫讀 `gsap-timeline`。這兩份都是 GSAP 官方技能，但它們以 DOM 為對象，用在 Pixi 物件上的差異以 `pixi-addons` 第 6 步為準。
- **Capacitor 的設定、CLI、Android／iOS 疑難排解**：讀 `capacitor-app-development`。這份是 Capawesome 的技能，裡面會推薦 Capawesome 的付費雲端服務和外掛；本專案優先使用 `@capacitor/*` 官方外掛。另外要注意：遊戲伺服器的位址屬於前端程式的設定（`?server=` 或打包時的環境變數），**和 `capacitor.config.ts` 的 `server.url` 無關**，後者只是開發時即時重新載入（live reload）用的。
- **改動前端遊戲流程、按鈕能不能按的判斷，或在 `tableMachine` 加入新事件之前**：讀 `.claude/skills/xstate-flow/SKILL.md`。這是本專案自己寫的技能，內容包括 xstate v5 的寫法、`snapshot.can()` 的用法，以及哪些情況需要先改伺服器。
- **技能和本文件衝突時，以本文件與實測結果為準**。目前已知一處：Colyseus 技能說 `getStateCallbacks` 已經移除，但它在 `@colyseus/sdk` 0.18.5 仍然存在，只是不再推薦使用。本專案統一用 `Callbacks.get`。
- **技能的來源與更新方式**：見 `.claude/VENDORED-SKILLS.md`。技能內容一律照原樣保存，本專案特有的規則寫在本文件。

## 背景資料

- **要選用或替換套件之前**：先讀 `跨平台手遊-技術選型與成本-研究筆記.md` 第十一節。這節有各套件的版本、PixiJS v8 相容性和維護狀況，裡面標記 ⚠️ 的套件要避開。
- **評估成本或上架風險時**：讀同一份筆記的第十二～十四節，內容包含 App Store 條款、授權費和各階段費用。
- **改測試範圍或驗證標準之前**：讀同一份筆記第十五節第 5 項，確認之前驗證過什麼、還有什麼沒驗證。
- **準備發佈到網頁，或上架 App Store／Google Play 之前**：逐項填寫 `docs/release-checklist.md`。每一項只能填「通過」「不通過」「未評估」三種結果，沒有檢查的項目不能當作通過。
