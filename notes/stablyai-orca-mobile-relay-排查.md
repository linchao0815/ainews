# Orca Mobile／Orca Relay 配對失敗排查紀錄

- 日期：2026-10-02
- 環境：Windows 11 Pro 10.0.26200、Orca 1.4.218（2026-09-30 發布，當下最新版）
- 目標：用 Orca Mobile 透過 Orca Relay 連回桌機

## 結論

- **Google 登入失敗**是 Orca 已知 bug，還沒修好。改用 GitHub 登入可以成功。
- **Relay 配對失敗**（`relay_control_not_active`）不是網路、防火牆或帳號權限造成的。問題在 Orca 程式自己建立中繼連線的那一步。真正原因要讀 Orca 的內部紀錄才看得到（見文末「下一步」）。
- **現在就能用的替代做法**：選 **LAN**，手機跟電腦連同一個 Wi-Fi 再配對。

## 症狀

### 1. 用 Google 登入

畫面跳出 `Failed to connect profile` / `fetch failed`。

### 2. 改用 GitHub 登入：登入成功，但配對失敗

畫面顯示「Orca Relay：Unavailable」和「Couldn't create a Relay pairing code」。按 Copy diagnostics 複製出來的診斷資料如下：

```json
{
  "kind": "mobile_pairing_relay_failure",
  "preferredConnectionMode": "automatic",
  "failure": {
    "code": "relay_control_not_active",
    "stage": "create_pairing_relay",
    "message": "Relay pairing invite request failed"
  },
  "at": "2026-10-02T08:14:59.718Z"
}
```

## Google 登入失敗：已知 bug

- 瀏覽器那段登入其實**成功了**。失敗的是下一步：Orca 拿登入結果去 `login.onorca.dev/v1/desktop/auth/session` 換通行證。
- Orca 不管失敗原因是什麼，一律只顯示 `fetch failed`，所以從畫面上看不出真正原因。
- 有人回報過一模一樣的情況：Windows 11 + Google 登入，從 1.4.150 版就有，至今還沒修（[#10758](https://github.com/stablyai/orca/issues/10758)）。
- 官方的修正 [PR #10789](https://github.com/stablyai/orca/pull/10789) 到 2026-10-02 還沒合併。而且它只會改善錯誤訊息，不一定能讓登入成功。
- 換瀏覽器也沒用，因為錯誤是在 Orca 程式裡發生的（[#20637](https://github.com/stablyai/orca/issues/20637)）。

## Relay 配對失敗：已排除的原因

| 項目 | 結果 | 驗證方式與證據 |
|---|---|---|
| 公司代理伺服器（proxy） | ❌ 沒有 | `netsh winhttp show proxy` 顯示直接連線；IE 代理設定 `ProxyEnable=0`；也沒有設 `HTTP(S)_PROXY` 環境變數 |
| 登入伺服器連不到 | ❌ 連得到 | `login.onorca.dev` 有回應；憑證是 Google Trust Services 發的正牌憑證，沒被公司攔截替換；Node `fetch` 也成功 |
| 中繼總機伺服器（director）連不到 | ❌ 連得到 | `relay.onorca.dev/v1/regions` → 200（250ms）；`/health` → `{"ok":true}` |
| 中繼伺服器（cell）連不到 | ❌ 連得到 | `c10`／`c13`／`c27.relay.onorca.dev/v1/host/control` 都回 **HTTP 401**（意思是「要先登入」，表示連線有到達伺服器；測試時故意沒帶帳號） |
| 公司網路切斷長時間連線（WebSocket） | ❌ 不會切 | 連到 `wss://echo.websocket.org` 維持 90 秒，每 15 秒傳一次訊息，5 次全部有回應，沒斷線 |
| Windows 防火牆擋 `Orca.exe` | ❌ 沒擋 | 只有兩條 Inbound Allow 規則 |
| 帳號沒有 Relay 權限 | ❌ 有權限 | 解開本機 `account-session.json.enc`，`capabilities.flags["relay.use"] = true`（只讀了權限旗標，沒有輸出登入憑證） |

限制：上面的網路測試是用同一台電腦、同一個網路模擬的，不是 `Orca.exe` 自己去連。假如防毒軟體只針對 Orca 動手，這些測試看不出來，但可能性很低。

## 從原始碼看懂錯誤（stablyai/orca main）

- **「Unavailable」標籤**（`src/renderer/src/components/settings/MobilePairingConnectionOptions.tsx`）：已登入時，只要上一次產生配對碼失敗（`relayMintFailed`），或中繼狀態不是 `standby`，就會顯示這個標籤。它**不代表**這個版本或這個帳號不能用 Relay。
- **`relay_control_not_active`**（`src/main/runtime/relay/desktop-relay-service.ts`、`relay-session-broker.ts`）：產生配對碼前，電腦必須先跟中繼伺服器建好一條一直開著的「控制連線」。找不到這條連線時就丟出這個錯誤。
- **控制連線的建立流程**（`relay-auth-coordinator.ts` 的 `reconcileEpoch`）：
  1. 先檢查 `relayEntitled`，也就是帳號的 `relay.use` 旗標。已確認是 `true`，這關有過。
  2. 再呼叫 `openBroker`：向登入伺服器要中繼專用的通行證，接著向 `relay.onorca.dev/v1/assign` 要分配哪台中繼伺服器，最後連上 `wss://<cell>/v1/host/control`。
  3. 失敗時程式會記下 `console.warn('[relay] broker reconcile failed:', <原因>)`。**但 Windows 正式版不會把這段紀錄存成檔案**，所以從外面讀不到。
- 官方 9 月的內部紀錄（`cloud/docs/relay-reconnect-2026-09-findings.md`）寫到，中繼伺服器那陣子常因資料庫卡住而當機、斷線。所以伺服器端不穩也是可能原因之一。
- 相同錯誤已有人回報，官方都還沒回覆：[#11714](https://github.com/stablyai/orca/issues/11714)、[#20107](https://github.com/stablyai/orca/issues/20107)。

## 下一步：取得真正的失敗原因

⚠️ 如果你是在 Orca 內建的終端機裡操作，關掉 Orca 會讓那個終端機一起中斷。請在 **Orca 外面的 Windows PowerShell** 執行：

1. 把 Orca 完全結束，右下角系統匣的圖示也要按「結束」。
2. 執行：

```powershell
$env:ELECTRON_ENABLE_LOGGING = "1"
& "$env:LOCALAPPDATA\Programs\Orca\Orca.exe" 2>&1 | Select-String "relay"
```

3. 到手機配對頁按 **Retry Relay**，記下 `[relay] broker reconcile failed: ...` 那一行。
4. 拿到原因後，可以到 [#11714](https://github.com/stablyai/orca/issues/11714) 回報。附上上面的診斷資料、版本 1.4.218，以及本文「已排除的原因」那張表。

## 相關連結

- [#10758 Windows Google OAuth fetch failed](https://github.com/stablyai/orca/issues/10758)
- [#20637 Failed to connect profile / Fetch failed](https://github.com/stablyai/orca/issues/20637)
- [#19976 主程式的網路請求不走 proxy 設定](https://github.com/stablyai/orca/issues/19976)
- [#20107 profile fetch failed + Relay unavailable](https://github.com/stablyai/orca/issues/20107)
- [#11714 Relay 配對失敗、LAN 可用](https://github.com/stablyai/orca/issues/11714)
