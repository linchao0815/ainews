# YC Paxel：AI 使用習慣體檢報告與隱私風險

收集 Y Combinator 推出的 Paxel（分析 AI coding 對話紀錄、產出「你是哪種 builder」報告）的資料處理方式、隱私爭議，以及兩個不把資料交給新第三方的替代方案。

- **加入日期**：2026-10-05
- **官網**：https://paxel.ycombinator.com/（2026-06 推出，免費）
- **支援工具**：Claude Code、Codex CLI、Cursor、opencode、Gemini CLI、VS Code Copilot、Antigravity

---

## 一句話版本

Paxel 會讀你本機的 AI coding 對話紀錄並打分數、分類型。官方宣稱原始碼不離開電腦，但**檔案路徑、指令內容、commit 資訊、對話摘錄與摘要都會上傳**，交給 YC 與多家 AI 廠商處理，**沒有離線模式**。**未經主管或資安同意，請勿對公司 repo 執行官方版。**

## 會上傳什麼、留在本機的是什麼

依官方 [Data handling](https://paxel.ycombinator.com/data-handling) 頁面：

| 上傳 | 留在本機 |
|---|---|
| 分數、行為摘要、session 中繼資料（**含檔案路徑**） | 原始碼檔案內容 |
| 每個 session 約 2,000 字的摘要、首則提問前 200 字、工具使用摘要 | 原始對話紀錄（JSONL）全文 |
| 截斷後的指令文字、決策紀錄（已過濾憑證） | 工作目錄快照、`.env` |
| Git：最近約 1,000 筆 commit 的 sha、作者姓名與 email、日期、subject、增刪行數 | 每筆 commit 的 diff |

> ⚠ 摘要與摘錄由對話紀錄產生，**仍可能夾帶 agent 讀過的程式碼片段**。加上 `--no-repo` 只能少送 Git 資料，不能離線。

## 資料會交給誰

| 處理者 | 用途 |
|---|---|
| YC | 接收分數、摘要、session 中繼資料 |
| Anthropic Claude API | 對話文字的行為分析 |
| OpenAI GPT API | 對話文字的行為分析 |
| Microsoft Foundry | 轉送 LLM 請求 |
| Google AI Studio | 程式碼證據與對話摘錄的向量化 |
| Cloudflare | 代理全部流量，傳輸途中可見 LLM 提示與回應明文 |

## 隱私爭議

上線數小時內，資安研究者就指出官方「your code never leaves your machine」的說法與實際上傳內容不符（提示摘錄、git 中繼資料、檔案路徑、工具使用模式都會送到 YC 伺服器）。

## 替代方案

| 方案 | 範圍 | 會不會連網 | 適合用途 |
|---|---|---|---|
| **Claude Code 內建 `/insights`** | 只看 Claude Code 最近 30 天（最多約 50 個 session） | 由 Claude 分析，資料只到原本就在用的 Anthropic，不經新第三方；會花用量額度 | 找出常卡住的地方、建議可開的功能、產生可貼進 CLAUDE.md 的規則 |
| **社群版 [paxel-local](https://github.com/Photobombastic/paxel-local)** | Claude Code、Codex、Cursor、Gemini CLI、opencode、Pi | **不連網**（README 宣稱；使用者已掃原始碼並本機實跑確認） | 想要跟官方類似的類型（archetype）與分數（Execution／Planning／Engineering 各 0–10） |

`/insights` 的報告產生在 `~/.claude/usage-data/report.html`，建議每 2–3 週或專案里程碑後跑一次即可。

## 拿來評估人要小心

- YC 的定位是**申請者自願附上**的額外參考：申請 Startup School Taipei 時可在表單貼上報告代碼，讓審查者看到分數。
- 這類報告量到的主要是**使用習慣與用量**，跟能力只有間接關係。
- 面試時建議只讓候選人**自願附上、當聊天素材**，不要直接拿來評分。

## 觀察與建議

- 公司 repo 一律不要跑官方版；個人專案要跑也先確認路徑、commit email 外流可接受。
- 想改善自己的 AI 使用方式，優先用 `/insights`（產出可直接落地的 CLAUDE.md 規則）；想要跨工具的類型與分數，用 paxel-local。

**參考來源**：
- [Paxel (YC) 官網](https://paxel.ycombinator.com/)
- [Data handling — Paxel](https://paxel.ycombinator.com/data-handling)
- [Paxel Privacy Policy](https://paxel.ycombinator.com/privacy)
- [YC's Paxel Will Tell You What Kind of AI Builder You Are. I Also Checked What It Tells YC - Medium](https://medium.com/dare-to-be-better/ycs-paxel-will-tell-you-what-kind-of-ai-builder-you-are-i-also-checked-what-it-tells-yc-65f7fd3e0af9)
- [YC Paxel Tool: Profile Your AI Coding Habits - explainx.ai](https://explainx.ai/blog/y-combinator-paxel-ai-coding-habits-profiler-builder-reports-2026)
- [GitHub - Photobombastic/paxel-local](https://github.com/Photobombastic/paxel-local)
- [Claude Code /insights: Complete Guide - pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/408/claude-code-insights-workflow-command)
