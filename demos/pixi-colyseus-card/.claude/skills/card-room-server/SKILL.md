---
name: card-room-server
description: "本專案 Colyseus 伺服器（server/CardRoom.ts）的寫法規則：新增或修改訊息、驗證格式（validate + zod）、拒絕與日誌限流（logReject）、私密欄位（.view() + StateView）、斷線重連（onDrop／onReconnect／onLeave，保留 20 秒）、伺服器端 import 來源（@colyseus/core），以及前端如何同步狀態（Callbacks.get、room.onDrop）。修改 server/ 之下任何檔案、新增遊戲訊息或階段、處理斷線或重連之前使用。Colyseus API 本身以官方 colyseus 技能為準，本技能只寫本專案的規則與實測結果。"
---

# CardRoom 伺服器規則（Colyseus 0.18）

API 的用法看官方 `colyseus` 技能，這裡只寫**本專案自己的規則**，以及實際跑過才知道的行為。官方技能和本技能衝突時，以本技能為準，因為這裡的內容都實測過。

## 0. 共用工具在 `kit/`（直接呼叫，不要在遊戲裡重寫）

下列機制已經抽成可組合的函式，所有遊戲都要用同一份。這裡**不用繼承**：Colyseus 只會讀最終的 `this.messages`，子類別一宣告就會把父類別的整份蓋掉（`@colyseus/core` 的 `Room.mjs` 約第 302 行）。

| 需求 | 函式 | 檔案 |
|---|---|---|
| 啟動伺服器（`PORT` 環境變數、WebSocketTransport） | `startServer({ 房間名: defineRoom(X) })` | `kit/server/start.ts` |
| 被拒絕時記錄，並限制記錄頻率（每個房間各自一份） | `private logReject = createRejectLogger(log)`；在 `onLeave` 呼叫 `this.logReject.forget(id)` | `kit/server/rejectLog.ts` |
| 斷線時保留座位（自動排除 4002） | 在 `onDrop` 裡呼叫 `holdSeatOnDrop(this, client, code, { seconds, onHold, log, label })`；秒數用 `reconnectSeconds()` | `kit/server/reconnection.ts` |
| 前端加入房間，或接回原本的座位 | `joinOrResume(client, { gameId, roomName, joinOptions })` | `kit/client/session.ts` |
| 決定前端連到哪個伺服器 | `resolveServerUrl()` | `kit/client/serverUrl.ts` |
| 安全區域與縮放 | `createSafeAreaProbe()`、`fitToSafeArea(holder, design, safe)`、`orientationOf(w, h)` | `kit/client/fit.ts` |
| e2e 測試的共用設施 | `createHarness({ outDir })`：`openPlayer`、`waitFor`、`clickAt`、`setOffline`、`spawnServer`、`countServerLog`、`finish` | `kit/test/harness.mjs` |

## 1. Import 來源

- 伺服器端從 `@colyseus/core` 和 `@colyseus/ws-transport` import，並在 `defineServer` 明確指定 `transport: new WebSocketTransport()`。
- **不要用 `colyseus` 這個整合套件**：它會連帶裝進 `@colyseus/auth` → `grant` → `elliptic`／`uuid`，這幾個都會被 `npm audit` 報出漏洞（實測共 16 項），而本專案不用登入功能。改用 core 之後是 0 項。
- 官方技能的範例寫 `from "colyseus"`，照抄時要改成 `@colyseus/core`。
- `npm audit` 建議的修法是降回 colyseus 0.15，**不要照做**。

## 2. 新增或修改訊息的步驟

1. 寫在 `CardRoom` 的 `messages = { ... }` 裡，這是 0.18 的宣告式寫法。
2. **訊息有內容的話，用 `validate(zod 格式, 處理函式)` 包起來**，寫法參考 `set_card: validate(z.number().int(), …)`。
   - 格式不符的訊息根本進不到處理函式。Colyseus 會直接把送出者斷線，關閉代碼是 `CloseCode.WITH_ERROR`（4002）。
   - 正常的前端不可能送出格式錯的訊息，所以把對方踢掉是合理的。
   - 沒有內容的訊息（例如 `ready`）不需要 validate。
3. 處理函式一開始先檢查兩件事：**現在的遊戲階段**（`state.phase`）對不對、**送訊息的人**是誰。
   - 送訊息的人以 `client` 參數為準，**不要相信訊息內容裡夾帶的 sessionId**。
4. 不合法就呼叫 `this.logReject(client.sessionId, 原因代碼, 說明)`，然後 return。這個函式來自 kit 的 `createRejectLogger`。**不要直接寫 `log("REJECT …")`**。
   - `logReject` 會限制記錄頻率：同一個玩家、同一個原因，5 秒內只記一行，後面的會累計成「+N suppressed」附在下一行。
   - 實測連送 50 筆作弊訊息，日誌只多 1 行。
5. 所有規則和計分都只寫在伺服器。前端只負責顯示，以及送出「我想做什麼」。

## 3. 私密資料

- 在欄位加上 `.view()`，例如 `card: t.number().view()`。
- 在 `onJoin` 裡執行 `client.view = new StateView(); client.view.add(該玩家)`，這樣資料只會送給擁有者本人。
- 一律用 schema builder 語法：`schema({...}, "Name")` 搭配 `t.*()`。型別用 `SchemaType<typeof X>`。

## 4. 斷線重連（座位保留 20 秒，已實作）

| 時機 | 處理 |
|---|---|
| `onDrop(client, code)` | **先排除 `code === CloseCode.WITH_ERROR`**（直接 return，不保留座位）。其他情況把 `connected` 設為 false，再呼叫 `allowReconnection(client, RECONNECT_SECONDS)` |
| `onReconnect(client)` | 把 `connected` 設回 true |
| `onLeave(client)` | 玩家確定不會回來了，才在這裡移除，並清掉這個玩家的 `logReject` 計數 |

實測行為，來源是 `@colyseus/core` 的 `Room._onLeave`：

- **只要不是 CONSENTED（4000，玩家主動離開），都會先進 `onDrop`**，包括被 validate 踢掉的 4002，也包括關閉分頁（1001）。這就是第一步要先排除 4002 的原因，否則竄改過的客戶端也會被保留座位。
- `onDrop` 裡有呼叫 `allowReconnection`：座位保留到逾時，逾時後才進 `onLeave`。
- `onDrop` 裡沒有呼叫：馬上進 `onLeave`。
- 斷線期間遊戲照常進行，例如另一位玩家可以照樣開牌。重連後，玩家會拿到完整的最新狀態。

## 5. 前端的同步寫法

- 從 `@colyseus/sdk` import。舊套件 `colyseus.js` 停在 0.16，不要用。
- 監聽狀態用 `Callbacks.get(room)`，例如 `callbacks.listen("phase", fn)`、`callbacks.onAdd("players", fn)`。
  - 官方技能說 `getStateCallbacks` 已經移除，但它在 0.18.5 其實還在，只是不再推薦。本專案一律用 `Callbacks.get`。
- **`joinOrCreate()` 剛回傳時，`room.state.players` 可能還是 undefined**。畫面相關的程式要先檢查再用，參考 `me()`、`opp()` 的寫法。
- 重連由 SDK 自動處理，最多重試 15 次，間隔 0.1～5 秒。`room.onDrop` 和 `room.onReconnect` 只負責顯示提示，不要自己寫重試邏輯。
  - **房間必須已經連線超過 5 秒**（`minUptime`），SDK 才會自動重連。剛加入就斷線的話，不會重連。
- 伺服器的 `phase` 改變時，要轉成 xstate 事件送出，見 `xstate-flow` 技能。

## 6. 測試方式

- 作弊情境用 `window.__demo.rawSend(type, payload)` 送出。格式錯誤要測「會被踢掉」：`leaveCode === 4002`，而且對手會回到 waiting。
- 斷線用 Playwright 的 `context.setOffline(true)` 模擬。斷網期間，主控台會出現 WebSocket 連線失敗的訊息，這是正常的，因為 SDK 正在重試，e2e 用 `EXPECTED_ERROR` 把它過濾掉。
- 日誌限流的測試會讀取 `SERVER_LOG`（預設 `logs/server.log`），所以啟動伺服器時，輸出要導向這個檔案。讀不到檔案時，這項測試判為「未評估」，不算通過。
- **座位逾時釋放**由 e2e 測試涵蓋，做法如下：
  - 測試會用 `node --import tsx server/index.ts` 另外啟動一台伺服器，設定 `PORT=2568`、`RECONNECT_SECONDS=2`。
  - 頁面用 `?server=ws://localhost:2568` 連到這台伺服器。
  - 測試先等超過 5 秒（SDK 的 minUptime），才讓玩家斷網，否則這次斷線不會被當成真正的斷線。
  - 預期結果：對手回到 waiting；斷線玩家重新整理後，舊 token 接不回座位，會改成重新加入，拿到新的 sessionId。
- 保留秒數由環境變數 `RECONNECT_SECONDS` 設定，預設 20 秒。伺服器的 port 由 `PORT` 設定，預設 2567。
- 重新整理頁面的情境，用 `pages.A.reload()` 測試。這項測試刻意排在「斷網後自動重連」之後，用來抓下面第 7 節提到的 token 時序問題。

## 7. 重新整理或重開分頁後接回座位（已實作）

SDK 的自動重連，只在原本那個頁面還開著的時候有效。重新整理或重開分頁時，改由 `client/main.ts` 處理：

- 加入或重連之後，把 `room.reconnectionToken` 存進 **`sessionStorage`**，key 是 **`${GAME_ID}:reconnectionToken`**（本遊戲是 `high-card:reconnectionToken`）。
  - **每款遊戲都必須有自己的 GAME_ID**。如果多款遊戲放在同一個網域，又共用同一個 key，就會拿到別款遊戲的 token 去重連。
  - 不用 `localStorage`，是因為 `localStorage` 會被同一個瀏覽器的所有分頁共用。在一個瀏覽器開兩個分頁、分別扮演兩位玩家時，會互相拿到對方的 token，接回對方的座位。
- 頁面啟動時，如果有存著 token，就先呼叫 `client.reconnect(token)`。失敗時（例如超過 20 秒，或伺服器已經重開），就清掉 token，改用 `joinOrCreate` 重新加入。可以從 `__demo.connection().resumed` 判斷這次是不是接回原座位。
- 收到 `onLeave` 時，如果關閉代碼是 CONSENTED（4000）、WITH_ERROR（4002）或 FAILED_TO_RECONNECT（4003），代表已經沒有座位可以接回，就清掉 token。
- **SDK 0.18.5 的時序陷阱（已實測，可在 `@colyseus/sdk/build/Room.mjs` 的 JOIN_ROOM 處理段確認）**：
  - 伺服器每次 join 或 reconnect，都會在 `_onJoin` 裡**換發新的 token**。
  - 但 SDK 是**先觸發 `onReconnect`，之後才更新 `room.reconnectionToken`**。
  - 所以在 `onReconnect` 裡直接讀到的，其實是**已經失效的舊 token**。
  - 實際症狀：先自動重連過一次，再重新整理頁面，伺服器會回報 `reconnection token invalid or expired`，玩家拿到一個新的 sessionId。
  - 解法：在 `onReconnect` 裡改用 `queueMicrotask(() => save(room.reconnectionToken))`，等 SDK 更新完再存；另外在 `pagehide` 事件時再存一次。

## 完成條件

`npm run test:e2e` 印出 `ALL PASS`。新增的每一種訊息都要有測試，至少包含：合法情況、階段不對被拒絕、格式錯誤被踢掉（有 validate 的訊息才需要）。
