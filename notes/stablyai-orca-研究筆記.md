# Stably Orca 研究筆記

查證日期：2026-09-21
專案：https://github.com/stablyai/orca

## 一、專案是什麼

Orca 是「ADE (Agentic Development Environment)」——多代理艦隊編排器，不是自帶模型服務的工具。標語：「Run any coding agent with your own subscription」。

- 支援任何 CLI 代理：Claude Code、Codex、Gemini、Grok、OpenCode、Cursor 等 20+ 種，可同時平行跑
- 每個代理跑在獨立 git worktree 裡，隔離互不干擾
- 平台：桌面 (macOS/Win/Linux)、手機伴侶 App (iOS/Android)、遠端 SSH worktree
- 授權：MIT，開源
- 附加功能：GitHub/Linear 整合、AI diff 註解、Design Mode（截 UI 元素轉 HTML/CSS）、Computer Use
- 安裝：`brew install --cask stablyai/orca/orca`（macOS）、`yay -S stably-orca-bin`（Arch）

## 二、能否用 Claude / Codex 訂閱帳號

**可以。** Orca 本身不代管 API key，而是呼叫本機安裝的 Claude Code / Codex CLI，沿用使用者自己 `claude login` / `codex login` 的訂閱憑證（Claude Pro/Max、ChatGPT Plus/Pro/Business/Enterprise）。

已上線的帳號管理功能：
- 帳號切換器：可註冊多組 Claude/Codex 帳號，一鍵切換（但見下方第四節限制）
- 用量看板：顯示 5 小時／每日／每週配額百分比、重置時間、80% 預警 chip
- 每帳號獨立隔離：各自的 `CLAUDE_HOME` / `CODEX_HOME` 結構，避免帳號間設定互相污染

Codex CLI/Desktop 本身則是單一 ChatGPT 帳號登入（`codex login`，Plus $20/mo、Pro $100~200/mo 等），無跨帳號切換概念——這是 Orca 加的一層管理。

## 三、Orca vs Codex CLI/Desktop 比較

| 維度 | Orca | Codex CLI / Desktop |
|---|---|---|
| 定位 | 多代理編排殼層 | 單一 OpenAI 官方代理本體 |
| 支援 agent | 20+ 種，可平行跑 | 僅 Codex |
| 隔離方式 | 每 agent 一個 git worktree | 單一工作區 |
| 帳號模型 | 代管多組各家訂閱帳號 | 單一 ChatGPT 帳號 |
| 平台 | 桌面+手機+遠端 SSH | CLI + 桌面 App + IDE 擴充 + web |
| 授權 | MIT 開源 | openai/codex 開源，服務端為 OpenAI |

## 四、額度用完時的切換/交接機制 —— 查證結果（重要更正）

**結論：截至 2026-09-21，Orca 沒有任何已發版的自動切換/交接機制。以下逐項標註查證等級。**

### 4.1 同帳號自動續跑（等待原帳號額度恢復）

- **PR #21036**「auto-resume agents parked on a provider usage limit」
  - 狀態：**已查證為 open，尚未合併**（最後 force-push 於 2026-09-19）
  - 內容：PTY 監看終端輸出偵測「額度用盡」banner 與重置時間，時間到自動選單續跑，避免誤觸付費選項
  - **注意**：此功能尚未上線，不能當作現有能力引用

- **PR #8132**「Auto-resume rate-limited agents」
  - 狀態：**已查證為 closed（未合併）**，2026-09-14 由提交者自行關閉
  - 關閉理由（PR 作者原話，非官方 changelog 確認）：「Claude 現在原生就會做這件事了，希望 Codex 跟進」——**這只是單方陳述，未經 Orca release note 交叉驗證，列為推測級**

### 4.2 跨帳號自動 failover（額度不夠自動換帳號）

- **Issue #20512**：**已查證為 open**，無指派人員、無關聯分支或 PR，**確認尚在討論設計階段，完全未實作**
- 提出但未實作的設計要點：閾值預先切換（建議 90%）、挑配額最充裕帳號、冷卻機制防止來回切換、CLI 無頭模式支援、排除明確鎖定的 pane/worktree
- **關鍵技術障礙**（連到 issue #19900）：目前帳號切換只影響「新產生」的 session，**無法覆蓋已在跑的 session**——這是自動 failover 做不到「原地無縫換帳號」的根本原因

### 4.3 現有唯一手動交接手段

- **Issue #19374**「Continue in New Session」：可手動把長時間跑的 session 搬到新 session，不用重講前情。目前僅桌面版支援，行動版尚無。
- 若真的遇到額度用完，實務上只能：手動開帳號切換器 → 選有額度的帳號 → **重新啟動該份工作**（原 session 無法接續，等於中斷重來）

### 4.4 Release Note 交叉查證

直接查 `github.com/stablyai/orca/releases`（v1.4.198 ~ v1.4.206，2026-09 區間）：**未出現** rate limit / auto-resume / account switch / failover / Continue in New Session 相關字樣，佐證上述功能確實尚未進入正式發布版本。

## 五、方法論教訓（給未來查證用）

第一次回答誤把「PR 存在」當「功能已上線」，未核對 PR 合併狀態與 release note 就下結論。GitHub 上 open PR、closed-未合併 PR、open issue 三者狀態差異很大，**必須逐一開連結確認 merge 狀態**，不能只憑搜尋摘要或 PR 標題判斷功能是否可用。

## 來源連結

- https://github.com/stablyai/orca
- https://github.com/stablyai/orca/blob/main/README.md
- https://github.com/stablyai/orca/issues/20512
- https://github.com/stablyai/orca/pull/21036
- https://github.com/stablyai/orca/pull/8132
- https://github.com/stablyai/orca/issues/19374
- https://github.com/stablyai/orca/releases
- https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan
