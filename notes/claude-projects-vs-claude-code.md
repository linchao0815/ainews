# Claude Code「新 Projects」與 Claude Code CLI 的定位與互補

研究日期：2026-09-23
來源等級：`已查證`（官方文件 + 三家媒體報導，連結見文末）

## 一、結論

2026-09-17 發布的「新 Projects」是 **Claude Code 的功能**，不是舊版 claude.ai 聊天 Projects 的升級。

- 它是一個常駐對話 + **協調者（coordinator）**，把丟進去的工作拆成多條 **thread**。
- 每條 thread 就是一個完整的 Claude Code **雲端 session**，各自 clone repo、在自己的 branch 上做事、開 PR、回報。
- 定位：**協調層**，幫你啟動、追蹤、彙整多個 Claude Code session。
- Claude Code CLI / IDE 仍是**執行層**：在你本機實際動手寫程式、用本機工具與環境。

## 二、核心機制

| 元件 | 說明 |
|---|---|
| 協調者對話 | 貼 bug、stack trace、任務清單進去，Claude 決定開新 thread 或轉給既有 thread；簡單問題直接回答 |
| Thread | 一個雲端 Claude Code session，獨立 context window，自己 clone repo 與 branch，需要時開 PR 並自動盯 CI／review comment（auto-fix 強制開啟） |
| Project instructions | 每條新 thread 的開場簡報，上限 16,000 字，放在 Project settings > Memory |
| Project memory | Claude 自己寫的筆記（需求、決策、踩過的坑），`MEMORY.md` 索引 + 檔案；每條 thread 啟動時讀索引。與本機 auto memory 分開 |
| Repo／檔案 | 每 thread 都 clone 專案 repo；上傳檔案掛在 `/mnt/project-files`；每個 repo 的 `CLAUDE.md` 與 skills 照常載入 |
| Overview 面板 | 看所有 thread 狀態（進行中、待審 PR、等你回答、Landing、Resolved）；另有 Library（產出檔）、Pull requests、Routines（排程）三個分頁 |
| Context 管理 | 不用自己管：thread 自動 compact，協調者只看近期訊息 + 近期 thread + project memory，可以長期跑 |
| 模型／effort | Thread 與協調者分開設定。新專案預設 thread = Opus high、協調者 = Opus low |
| 專案生命週期 | Pause（全部停）、Archive（隱藏 + 停 thread）、Delete（不可逆，GitHub 上的 branch／PR 不受影響） |

## 三、現況與限制（2026-09-23）

- **公開 beta，只有 Pro / Max**。先開給用過雲端 session、且沒有舊版 chat / Cowork Projects 的帳號。Team／Enterprise 尚未開放，可排 waitlist。
- **入口**：claude.ai/code、桌面 App 的 Code 分頁、iOS / Android App。**終端機 CLI 不能建立或加入 project**；Bedrock、Google Agent Platform、Microsoft Foundry 也不支援。
- **Thread 只能在 Anthropic 雲端 sandbox 跑**：碰不到本機 DB、模擬器、VPN 內 API。Anthropic 說本機執行「很快會來」。
- **只支援 github.com**，不含 GitHub Enterprise Server、GitLab、Bitbucket；需安裝 Claude GitHub App 並有 push 權限。
- **額度消耗快**：每 thread 是完整 session；每天上限 200 條新 thread；閒置 thread 在 PR 有 CI 失敗或留言時會醒來繼續耗額度。撞到限制時 thread 會自動等額度重置後繼續。
- Sandbox 在 turn 之間會暫停，若無法恢復會從新 clone 繼續，**未 commit 的變更可能丟失**，長任務要叫它隨時 commit + push。
- 舊版 claude.ai 聊天 Projects 與 Cowork 維持現狀，新體驗先在 Code 上線，之後擴到 chat 與 Cowork（兩者將合併為單一介面）。

## 四、與 Claude Code 及其他平行功能的定位比較

| 面向 | 新 Projects（協調層） | Claude Code CLI／IDE（執行層） |
|---|---|---|
| 角色 | 「幕僚長」：分派、追蹤、彙整多條工作 | 實際動手寫、改、跑程式的工程師 |
| 執行位置 | 只在 Anthropic 雲端 sandbox | 本機，可用本機工具、DB、內網 |
| 平行方式 | 每 thread 一個雲端 clone + branch，不需 worktree | 自己開多 session／worktree／agent view／agent teams |
| 脈絡 | project memory + instructions，跨 thread 共用 | `CLAUDE.md`、本機 auto memory、單一 session |
| 產出 | PR、Library 檔案 | 工作樹上的 diff、commit |
| 適合 | 跨 repo 一致性改動、持續餵 bug 的維護區、可離線等結果的長工 | 需要本機環境、緊密互動、探索性開發、debug |

官方明說「平行執行本身不是 Projects 的目的」。差別在**由 Claude 而非你來啟動與追蹤 session**，且每個 session 從同一組 repo／instructions／memory 出發。

其他平行功能的區別：

- **Agent view**：只是追蹤多個本機 session 的畫面，沒有協調者。
- **Worktrees**：讓本機平行 session 各有工作副本；thread 不需要，因為各自在雲端 sandbox clone。
- **Agent teams**：一個 session 為單一任務臨時生的隊員，任務結束就散；project 是長期存在的協調者。
- **Claude Tag（Slack）**：Team／Enterprise 用，頻道內大家共同給工作；project 是個人的。
- **舊版 chat / Cowork Projects**：只是把對話與參考檔案分組，沒有 thread 與協調者。

## 五、實務建議

- 現階段適合當「雲端 PR 工廠」：純靠 GitHub repo + CI 能完成的工作（lint 遷移、依賴升級、補單元測試、多 repo 同步改動）丟給 project；需要本機資源的仍用 CLI。
- 開新專案時先把 Thread model / effort 調低，並要求 Claude 先提案再開 thread、一次只跑幾條，等結果符合預期再放寬。
- 專案級規則寫進 project instructions；單一 repo 的建置指令仍放該 repo 的 `CLAUDE.md`。糾正 thread 後順手叫它「記住」，會進 project memory。
- 本 repo（ainews）的每日／週報產線可考慮做成 project 的 Routine，thread 直接開 PR，只需審 PR。
- 試用前確認：Pro / Max、曾用過 claude.ai/code 雲端 session、沒有舊版 chat Projects；否則排 waitlist。

## 六、雲端花費在哪裡查？chat / Cowork 也算嗎？

來源等級：`已查證`（Claude Code 官方 costs 與 cloud 文件、Claude Help Center）

### 一句話

Pro / Max 是訂閱制，雲端 thread **沒有額外 VM 費用**，全部從同一個訂閱額度池扣。查看位置只有兩個：**claude.ai Settings > Usage**（帳號層級、跨所有介面）與 **Project settings > Usage**（單一 project 內、按 thread 與模型）。

### 額度池是共用的

- claude.ai 官方：「你在所有 Claude 產品介面（claude.ai、Claude Code、Claude Desktop）的使用，都計入同一個使用上限。」Chat、Cowork、本機 Claude Code、雲端 session、Projects thread、Routines 全部一池。
- 兩層限制：5 小時滾動視窗 + 每週上限（跨模型）。Opus 另有模型專屬上限，撞到時換 Sonnet 可以繼續。
- 雲端 session 官方限制條款：「與帳號內所有其他 Claude 與 Claude Code 使用共用速率限制；平行跑多個任務會等比例消耗更多。雲端 VM 沒有另外的運算費用。」
- Team / Enterprise 同理：每個 seat 的額度與 chat、Cowork 共用，依 Standard / Premium 席位而異。

### 查詢位置一覽

| 位置 | 涵蓋範圍 | 顯示內容 | 備註 |
|---|---|---|---|
| claude.ai **Settings > Usage**（`claude.ai/settings/usage`） | 整個帳號，所有介面（chat、Cowork、本機 CLI、雲端 session、Projects） | 5 小時與每週進度條；Usage credits 區塊：啟用開關、餘額、本月花費、每月花費上限 | 唯一能看到跨介面總量的地方。官方文件沒有承諾提供「按產品（chat / Cowork / Code）拆分」的明細 |
| **Project settings > Usage**（在 project 內） | 該 project | token 用量按 thread、按模型拆分，另列協調者對話用掉多少 | 唯一能看到單一 project 內部拆帳的地方 |
| CLI **`/usage`** | 只算「這台機器的本機 session 歷史」 | 訂閱者看到方案進度條；Attribution 依 skill / subagent / plugin / MCP server 拆分；Behavior flags（長 context、cache miss）；Loops 列表；Usage credits 本月花費列 | 明說**不含其他裝置與 claude.ai 的用量**，所以看不到雲端 thread 與 chat / Cowork |
| CLI **`/usage-credits`** | — | 訂閱者：直接開瀏覽器到 Settings > Usage | Team / Enterprise 有帳務權限者開到 Admin settings > Usage |
| CLI **`/insights`** | 本機 session | 使用習慣 HTML 報告，不是額度統計 | 不含雲端與 claude.ai |
| VS Code 擴充 Account & usage | 本機 | 同 `/usage` 的 Attribution 與 flags，Day / Week 切換 | 無 Loops |
| Team / Enterprise **Admin settings > Usage**、`claude.ai/analytics/claude-code` | 整個組織 | 每人每模型估算花費（每日更新、可匯出 CSV）、DAU、session 數、貢獻指標 | 花費報表只在 usage credits 開啟後出現；席位額度內的使用不以美元計 |
| Enterprise Analytics API | 整個組織 | 每人跨介面（含 Claude Code）用量與成本 | 需 Primary Owner 建 `read:analytics` key |

### Usage credits（超額付費）

- 在 Settings > Usage 啟用、設每月上限、預付；按標準 API 價計費。
- 適用範圍（Help Center）：chat 對話、Claude Code 終端機、Research mode、Project 檔案處理。雲端 thread 撞到方案上限時會**自動等額度重置後繼續**，只有你開了 usage credits 才會花錢超額；thread 自己不能替你開。
- 開了 usage credits 之後，一旦開始扣 credits，prompt cache 壽命從 1 小時降為 5 分鐘（超額時的 cache miss 會更貴）。

### 對本機 / 雲端混用者的實務建議

- 想知道「雲端到底吃了多少」：看 **Project settings > Usage**（單 project）與 **Settings > Usage**（總量）的差值推估；本機 `/usage` 對此完全沒幫助。
- 想控制花費：把 Thread model / effort 調低（預設 Opus high 最貴）、叫 Claude 每次只跑幾條 thread、閒置 thread 停止盯 PR（PR 有 CI 失敗或留言時它會醒來扣額度）、超過 1 小時的舊 thread 不要追加訊息（會 cache miss 重讀整段對話），改開新 thread。
- 想避免意外超額：不要開 usage credits，或開了但設每月花費上限。

參考：
- [Manage costs effectively – Claude Code Docs](https://code.claude.com/docs/en/costs)
- [Use Claude Code in the cloud – Limitations](https://code.claude.com/docs/en/claude-code-on-the-web)
- [How do usage and length limits work? – Claude Help Center](https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work)
- [Manage usage credits for paid Claude plans – Claude Help Center](https://support.claude.com/en/articles/12429409-manage-usage-credits-for-paid-claude-plans)
- [View usage analytics for Team and Enterprise plans – Claude Help Center](https://support.claude.com/en/articles/12883420-view-usage-analytics-for-team-and-enterprise-plans)

## 七、參考來源（第一至五節）

- [Let Claude coordinate ongoing work with Projects – Claude Code Docs](https://code.claude.com/docs/en/claude-projects)
- [Run agents in parallel – Claude Code Docs](https://code.claude.com/docs/en/agents)
- [What's new – Claude Code Docs](https://code.claude.com/docs/en/whats-new)
- [VentureBeat: Anthropic launches Claude Code Projects](https://venturebeat.com/orchestration/anthropic-launches-claude-code-projects-an-always-on-conversation-that-remembers-and-delegates-your-long-running-dev-work)
- [Unite.AI: Anthropic Redesigns Claude Code Projects to Coordinate Agent Threads](https://www.unite.ai/anthropic-redesigns-claude-code-projects-to-coordinate-agent-threads/)
- [MindStudio: Claude's Projects Redesign and Co-work Merger](https://www.mindstudio.ai/blog/claude-projects-redesign-cowork-chat-merge)
- [Fastio: Claude Workspace Guide: Projects vs Cowork vs Code](https://fast.io/resources/claude-workspace-guide/)
