# RTK：CLI Proxy 節省 AI Coding Agent Token 用量

收集 RTK（Rust Token Killer）如何替 Claude Code 等 coding agent 節省 token 的資料，含官方宣稱與獨立測試結果的落差。

- **加入日期**：2026-09-21
- **專案**：[rtk-ai/rtk](https://github.com/rtk-ai/rtk)（Apache 2.0，單一 Rust 二進位檔，零外部依賴）
- **官網／文件**：https://www.rtk-ai.app

---

## 一句話版本

RTK 是裝在 shell 與 LLM 之間的 CLI proxy，透過攔截並改寫 `git status`、`cargo test`、`ls` 等常見開發指令，在輸出送進 AI agent 的 context 之前先過濾／壓縮／去重，官方宣稱可讓「常見指令輸出」減少 60–90% token，但獨立測試（JetBrains，2026-07）顯示這不等於帳單真的變少，低算力模式下實測反而 **中位數多花 7.6%**。

## 運作機制

1. **攔截**：`rtk init -g` 會在 Claude Code 等 agent 裝一個 `PreToolUse` hook（或對應機制），把 Bash 工具呼叫的指令自動重寫為 RTK 版本，例如 `git status` → `rtk git status`，過程對使用者無感。
2. **壓縮策略**（四種）：
   - **智慧過濾**：移除噪音、註解、樣板輸出
   - **分組聚合**：檔案依目錄分組、錯誤依類型分組
   - **截斷冗餘**：只留相關 context，砍掉重複片段
   - **去重**：重複的 log 行摺疊成一個計數
3. **涵蓋範圍**：僅作用在「經過 Bash 工具呼叫、且有對應 RTK 指令包裝」的輸出；Claude Code 內建的 Read、Grep 等工具不經過這個 hook，不受影響。

## 支援的指令與 agent

- **指令**（100+ 種）：檔案操作（`ls`/`tree`/`cat`/`grep`/`find`/`diff`）、Git（`status`/`diff`/`log`）、測試框架（`cargo test`/`pytest`/`jest`/`go test`，只顯示失敗案例、通過的摺成計數）、建置與 lint（`cargo build/clippy`/`tsc`/`eslint`/`ruff check`）、容器（`docker ps/logs`/`kubectl`）、套件管理（`pip list`/`pnpm list`）、AWS/IaC（`aws` CLI、`pulumi`）等。
- **AI agent**（18 種）：Claude Code（預設）、GitHub Copilot、Cursor、Windsurf、Cline/Roo Code、Hermes、Gemini CLI、Codex、OpenCode 等，各自透過 hooks.json、`.rules` 檔或外掛 API 整合。

## 官方宣稱的節省範例

| 指令 | 原始輸出 | RTK 壓縮後 | 減幅 |
|---|---|---|---|
| `ls -la` | 45 行 | 12 行 | ~73% |
| `cargo test`（失敗案例） | 200+ 行 | ~20 行 | ~90% |
| `git push` | 15 行 | 1 行（`"ok main"`） | ~93% |
| `cargo test`（社群案例） | 155 行 | 3 行 | 98% |
| `git status`（社群案例） | 119 字元 | 28 字元 | 76% |

社群案例：有使用者回報 2 週內 Claude Code session 累計節省約 1000 萬 token（89%）（[Kilo-Org/kilocode Discussion #5848](https://github.com/Kilo-Org/kilocode/discussions/5848)）。

RTK 自帶分析指令 `rtk gain`（含 `--graph` 顯示近 30 天趨勢）與 `rtk discover`（找出尚未套用 RTK 的節省機會），方便使用者自行追蹤。

## 獨立測試的關鍵反駁（JetBrains，2026-07）

[《rtk Claude Code Token Savings: A Skill Trial Benchmark》](https://blog.jetbrains.com/ai/2026/07/rtk-claude-code-token-savings/) 做了對照組實測，結論與官方宣稱有明顯落差：

- **低算力模式（low effort）**：實測帳單 **中位數反而多花 7.6%**；**高算力模式（high effort）**：帳單幾乎沒變化。
- **RTK 自報數字失真**：`rtk gain` 在整趟低算力測試中回報「省下 9,620 萬 token，占接觸內容的 99.8%」，但同一批測試的實際帳單卻是上升的。
- **落差成因**：
  1. RTK 只能攔截約 20% 的工具輸出位元組——Claude Code 內建的 Read／Grep 工具完全繞過這個 hook；
  2. 佔輸入成本大宗的「快取重讀（cached re-reads）」本來就以 1/10 價格計費，RTK 的「省下」計算沒有反映這點；
  3. RTK 把「完整原始輸出」當作對照基準來算「省了多少」，但 Claude Code 本來就會在遠低於這個長度時截斷工具結果——例如一次 `cat` 1.2MB CSV 被記錄「省下 32 萬 token」，但 agent 原本就不會真的收到那 32 萬 token（會被截斷），整趟測試有 190 次這類巨量讀取，平均每次「虛報省下」約 50.6 萬 token。
- **輸出品質**：兩組（有無 RTK）在統計上沒有顯著差異。
- **結論引用**：「工具自報的節省數字，講的是它自己設定的對照基準，不是你真正的帳單。」（A tool's self-reported savings are a claim about its counterfactual, not about your bill.）

## 觀察與建議

- RTK 的壓縮邏輯（過濾通過測試、去重 log、截斷冗餘輸出）方向正確，對「指令輸出本身佔 context 比重高」的場景（例如大型 repo 頻繁跑 `cargo test`/`git diff`）仍有實質幫助。
- 但官方「60–90%」與社群「89%／2 週省千萬 token」等宣稱，多半只反映 **RTK 攔截到、且它認定會被壓縮的那部分位元組**，不等於整體 API 帳單的降幅；獨立測試顯示在低算力模式下實際成本可能不降反升。
- 若評估導入，建議：(1) 用官方 `rtk gain` 數字時保留懷疑，優先看實際 API 帳單前後對比；(2) 留意 Claude Code 的 Read/Grep 等內建工具不受 hook 影響，真正節省空間可能比想像小；(3) 小範圍試跑 1-2 週、直接比對計費 dashboard 上的 token 用量，而非只看工具自身統計。

**參考來源**：
- [GitHub - rtk-ai/rtk](https://github.com/rtk-ai/rtk)
- [rtk-ai/rtk CLAUDE.md](https://github.com/rtk-ai/rtk/blob/develop/CLAUDE.md)
- [rtk Claude Code Token Savings: A Skill Trial Benchmark - JetBrains AI Blog](https://blog.jetbrains.com/ai/2026/07/rtk-claude-code-token-savings/)
- [JetBrains benchmark finds RTK token compression tool shows 7.6% cost increase — Agentic Ready](https://www.getreadyforagents.com/news/claude-code-token-cost-measurement/)
- [rtk Raises Claude Code Costs at Low Effort: JetBrains Benchmark Debunks 60–90% Claim - Tech Times](https://www.techtimes.com/articles/321223/20260721/rtk-raises-claude-code-costs-low-effort-jetbrains-benchmark-debunks-6090-claim.htm)
- [RTK token savings: 89% fewer tokens, no lower bill - samcodeman.com](https://www.samcodeman.com/writing/rtk-token-savings-ai-coding-cost-benchmark)
- [RTK: Cut Your AI Coding Bill by 80% With One CLI Tool - DEV Community](https://dev.to/arshtechpro/how-rtk-reduces-llm-token-usage-for-ai-coding-agents-2kfd)
- [I saved 10M tokens (89%) on my Claude Code sessions with a CLI proxy - Kilo-Org/kilocode Discussion #5848](https://github.com/Kilo-Org/kilocode/discussions/5848)
- [RTK to reduce Claude token consumption - Medium](https://medium.com/@ashwinjosh/rtk-to-reduce-claude-token-consumption-6c90d61c0c2c)
- [RTK AI CLI Proxy Guide: Save Tokens for Codex, Claude Code, and Coding Agents - knightli.com](https://knightli.com/en/2026/05/27/rtk-ai-cli-proxy-token-savings/)
