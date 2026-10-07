# AGENTS.md：pixi-colyseus-card

兩人「比大小」卡牌遊戲，是技術驗證用的最小範例。
- 前端：PixiJS 8，用 Capacitor 包成 App。
- 伺服器：Colyseus 0.18。

執行指令看 `package.json` 的 scripts，人工操作步驟看 `README.md`。

## 架構規則：伺服器說了算

- **發牌、判定勝負、計分只寫在 `server/CardRoom.ts`。**
- **前端只做兩件事**：把 `room.state` 畫出來，以及用 `room.send()` 送出玩家的意圖。目前唯一的意圖是 `ready`。
- **私密資料的寫法**：在 schema 欄位加上 `.view()`，再到 `onJoin` 裡呼叫 `client.view.add(該玩家)`。這樣資料只會傳給擁有者，其他人的瀏覽器裡根本收不到。
- **新增訊息類型時**：在 `onMessage` 裡先檢查兩件事——目前是哪個遊戲階段（`state.phase`），以及送訊息的是誰。不合法的請求，用 `log("REJECT ...")` 記下來後直接 return。
- **Schema 一律用 builder 語法**（`schema({...})`、`t.number()`），不使用裝飾器，所以 TypeScript 不需要另外設定。

## 開發流程

1. **補素材**：如果 `public/assets/` 不存在，先執行 `npm run assets`。這一步需要 Python。完成條件：`public/assets/spine/` 底下有 3 個檔案，`public/assets/reveal.wav` 也存在。
2. **啟動服務**：在背景啟動 `npm run server`（port 2567）和 `npm run dev`（port 5173）。完成條件：`curl` 兩個 port 都有回應。如果 port 已經被占用，那是上一輪測試留下的程序，先把它結束掉。
3. **實作改動。**
4. **補測試**：新增的每一條規則或功能，都要在 `tests/e2e.mjs` 加一筆 `check(...)`。作弊情境用 `window.__demo.rawSend()` 模擬。
5. **執行 `npm run test:e2e`**。完成條件：最後一行印出 `ALL PASS`。如果改動影響畫面，還要看 `logs/e2e/*.png` 截圖確認。
6. **測正式版（改到打包或資源載入時才需要）**：執行 `npm run build`，在背景執行 `npm run preview`（port 4173），再設定 `BASE=http://localhost:4173` 跑一次 `npm run test:e2e`。完成條件：`ALL PASS`。
7. **收尾**：把 2567、5173、4173 三個 port 上的程序全部結束。

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

## 背景資料

- **要選用或替換套件之前**：先讀 `跨平台手遊-技術選型與成本-研究筆記.md` 第十一節。這節有各套件的版本、PixiJS v8 相容性和維護狀況，裡面標記 ⚠️ 的套件要避開。
- **評估成本或上架風險時**：讀同一份筆記的第十二～十四節，內容包含 App Store 條款、授權費和各階段費用。
- **改測試範圍或驗證標準之前**：讀同一份筆記第十五節第 5 項，確認之前驗證過什麼、還有什麼沒驗證。
