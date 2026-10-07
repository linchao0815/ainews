---
name: xstate-flow
description: "本專案用 XState v5 控制前端遊戲流程（連線中 → 等待 → 選擇 → 等對手 → 開牌）的寫法與陷阱。在新增或修改遊戲階段、流程轉換、按鈕可不可以按的判斷，或在 client/main.ts 的 tableMachine 加入新事件之前使用。也適用於辨識並改正 XState v4 的舊寫法（interpret、cond、Machine()）。"
---

# XState v5：前端遊戲流程

## 分工原則

- **輸贏、發牌、計分都由伺服器決定**（Colyseus 的 `state.phase`）。xstate 只負責「前端現在該顯示什麼、哪個按鈕可以按」，不決定遊戲結果。
- 流程的驅動方式：伺服器的 `phase` 改變時，在 `callbacks.listen("phase", …)` 裡把它換成 xstate 事件送進狀態機（例如 `DEALT`、`REVEALED`、`OPP_LEFT`）。玩家自己的操作也送事件（例如 `READY_SENT`）。
- 想新增一個遊戲階段時，先在伺服器的 `CardRoom` 加上新的 `phase` 值，再到前端狀態機加對應的狀態和事件。只改前端就等於讓前端自己決定遊戲流程，違反「伺服器說了算」的原則。

## 第 1 步：確認版本

讀 `package.json` 的 `xstate` 版本。驗證時是 **5.33.2**。API 以 `node_modules/xstate/dist/declarations/src/` 底下的型別定義為準，主要看 `index.d.ts`、`State.d.ts`、`createActor.d.ts`。

## 第 2 步：用 v5 的寫法

| v4 舊寫法（遇到就改掉） | v5 寫法 |
|---|---|
| `interpret(machine)` | `createActor(machine)`（`interpret` 仍然存在，但已標示 `@deprecated`） |
| `Machine({...})` 或 `createMachine({...}, { actions })` | `setup({ actions, guards, actors }).createMachine({...})` |
| `cond: "isX"` | `guard: "isX"` |
| `service.onTransition(fn)` | `actor.subscribe(fn)` |
| `state.value === "x"` 寫在一堆判斷式裡 | `snapshot.matches("x")` |
| `machine.withConfig(...)` | `machine.provide(...)` |

本專案的標準寫法（見 `client/main.ts`）：

```ts
const tableMachine = setup({}).createMachine({
  id: "table",
  initial: "connecting",
  states: {
    connecting: { on: { JOINED: "waiting" } },
    waiting: { on: { DEALT: "myChoice" } },
    myChoice: { on: { READY_SENT: "waitingOpponent", REVEALED: "revealed", OPP_LEFT: "waiting" } },
    waitingOpponent: { on: { REVEALED: "revealed", OPP_LEFT: "waiting" } },
    revealed: { on: { DEALT: "myChoice", OPP_LEFT: "waiting" } },
  },
});
const actor = createActor(tableMachine);
actor.start();
```

## 第 3 步：注意這三個陷阱

1. **狀態沒有改變時，`subscribe` 也會收到通知。** 送出一個目前狀態不處理的事件時，訂閱者會再收到一份**一模一樣的狀態**。已實測：狀態 a 收到不處理的事件後，訂閱者依序看到 `["a","a","b","b"]`。所以要記錄狀態轉換、觸發音效或動畫時，先和上一次的狀態比對，只在真的改變時才動作（參考 `transitions` 的寫法）。
2. **判斷按鈕能不能按，用 `snapshot.can(event)`**：例如 `button.enabled = actor.getSnapshot().can({ type: "READY_SENT" })`。這比手動列出狀態名稱可靠，新增狀態時不需要回頭改判斷式。另外，`onPress` 處理函式的開頭也要再檢查一次，避免玩家連點兩下而重複送出。
3. **伺服器的 `phase` 一定要轉成事件送進狀態機**，不要直接拿 `phase` 去控制畫面。否則前端畫面和狀態機的狀態會不一致，按鈕可能在錯誤的時機變成可以按。

## 第 4 步：新增事件或狀態的步驟

1. 伺服器端：如果需要新的階段，在 `CardRoom` 加上新的 `phase` 值，並在 `messages` 裡加上對應的檢查（見 `colyseus` 技能和 AGENTS.md）。
2. 狀態機：在每個「應該接受這個事件」的狀態裡，加上 `on: { NEW_EVENT: "target" }`。其他狀態收到這個事件時，會依 xstate 的規則忽略它，這正是我們要的效果。
3. 在 `callbacks.listen("phase", …)` 裡，把新的 phase 對應到這個事件。
4. 在 `render()` 的 `status.text` 對照表裡，補上新狀態要顯示的文字。
5. 在 `tests/e2e.mjs` 修改「xstate 流程轉換正確」那一項的預期序列；如果是新的互動，再補一筆 `check(...)`。

**完成條件**：`npm run test:e2e` 印出 `ALL PASS`，而且「xstate 流程轉換正確」這一項的序列裡，有出現新的狀態。

## 參考

- 官方文件：`https://stately.ai/docs/xstate`。
- Stately 官方另有 `statelyai/skills`（裡面有 `xstate-v5` 技能），但截至 2026-10-07，這個 repo **沒有任何授權條款**，所以不收進本專案。開發者如果想用，可以自己裝在個人電腦上：`npx skills add statelyai/skills`（全域安裝，不進版本記錄）。
