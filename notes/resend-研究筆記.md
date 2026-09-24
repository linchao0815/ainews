# Resend 研究筆記

> 查證日期：2026-09-24。數字以官方頁面為準；第三方評測標明出處。

## 一句話定位

面向開發者的 Email API 平台（交易信＋行銷信＋收信），主打 DX：乾淨的 REST API、React Email 寫模板、多語言 SDK。創辦人 Zeno Rocha。2026 年目標是變成「all-in-one email platform」，並積極往 AI agent 生態卡位。

## 產品組成

| 模組 | 內容 |
|---|---|
| 交易信 API | 單封／batch（每次最多 100 封）、排程、webhook 事件 |
| 行銷信 | Contacts、Segments、Broadcasts、Automations（自動化流程） |
| 收信（Inbound） | 2025-11 上線；MX 指到 Resend 或用 `*.resend.app` 位址 → `email.received` webhook → Received Emails API 取內文與附件，可同 thread 回覆 |
| 模板 | React Email（自家開源專案），可用 React 元件寫信 |
| 基礎設施 | 網域驗證（SPF/DKIM/DMARC）、API key 輪替、Email Metrics API、Link Checker、SSO |
| SDK | Node.js、Python、PHP、Ruby、Go、Java、Laravel、Rust、.NET；另有 CLI |

## AI / Agent 相關（本次研究重點）

- **官方 MCP server**：遠端 `https://mcp.resend.com/mcp`（Streamable HTTP，OAuth 瀏覽器登入；無頭環境可改用 API key 當 Bearer token）。也可自架：npm 套件 `resend-mcp`（stdio / HTTP）。工具範圍幾乎涵蓋全部 API：寄信、收信、模板、contacts、broadcasts、automations、domains、webhooks、request logs 等。
- **支援客戶端**：官方文件列 15+ 個，含 Claude（web/desktop/Code）、Cursor、Codex、GitHub Copilot、Gemini CLI、Devin、Zed、Warp、OpenCode、Antigravity 等。
- **Claude Code 外掛**：`claude plugin install resend@claude-plugins-official`；另有遵循 Agent Plugins 標準的 Resend Skills（含 Agent Email Inbox skill：寄件者 allowlist、內容過濾、沙箱處理，防 prompt injection）。
- **Inboxes（Beta）**：僅遠端 MCP 提供的收件匣管理功能。
- **整合**：可從 Stripe Projects CLI 直接開通 Resend；Vercel v0 整合；Cursor Marketplace 上架。
- **限制**（競品 AgentMail 的比較文，立場偏頗但點出的結構差異屬實）：Resend 收信是網域層級 catch-all + webhook，沒有「每個 agent 一個 inbox」的 per-address provisioning API／thread 物件；若要大量 agent 各自有信箱身分，AgentMail 這類專門服務較合適。

## 價格（官方 pricing 頁）

**交易信**

| 方案 | 月費 | 月額度 | 超量 |
|---|---|---|---|
| Free | $0 | 3,000（每日上限 100） | — |
| Pro | $20 / $35 | 5 萬 / 10 萬 | $0.90 / 千封 |
| Scale | $90 起 ~ $1,150 | 10 萬 ~ 250 萬 | $0.90 → $0.46 / 千封 |
| Enterprise | 洽談 | — | — |

- 網域數：Free 3、Pro 10、Scale 1,000；Free 資料保留 30 天。
- 加購：Dedicated IP $30/月（限 Scale 以上）、SSO $150/月、+100 網域 $20/月。
- **行銷信**另計：Free 1,000 contacts；Pro Marketing $40–$650（5,000–150,000 contacts）。

## 公司狀況

- 2024-12 a16z 領投 1,800 萬美元 A 輪。
- 官方 2025 年回顧（1M users 部落格）：2025-12 達 100 萬用戶（上線約 30 個月）、營收成長 5 倍、團隊 12 → 28 人、npm 週下載 189k → 1.4M、收購 Briefer 與 Mergent。
- 第三方稱 2025 營收約 2,500 萬美元——**未見官方數字，推測，勿引用**。
- 客戶：Warner Bros、Gumroad、Raycast；稱 YC W25 批次 59% 使用。
- 2026 路線圖：自動化與 AI 功能、API 延遲降低（先從 Batch）、亞太時區支援 SLA、建銷售團隊、企業功能、資安計畫擴充。

## 風險與事故

- **2024-01 資安事件**（已查證官方報告）：
  - 根因：資料庫 API key 被當成環境變數放在 Resend Dashboard 的 **client 端**，外界拿得到。
  - 時間（UTC）：2023-12-30 攻擊者以外洩 key 取得初始存取；2024-01-07 開始存取資料；01-09 發現異常並從 log 確認；01-10 修補上線並輪替 DB 憑證（停機約 25 分鐘）。
  - 外洩範圍：2023-11-01 以後的資料，影響所有用戶——收/寄件地址、網域、加密後的 API key、log（狀態碼、method）、contacts、Resend 帳號 email。
  - 未外洩：信件內文、未加密的 DKIM 私鑰與 API key、使用者密碼。
  - 善後：移除該環境變數、輪替金鑰、強制 MFA、全組織重設密碼；委託資安公司 Oneleet 調查，並通報執法單位與 GDPR 主管機關。官方表示客戶不需採取行動即可繼續安全寄信。
- **2024-02-21 全面停擺 12 小時**（已查證官方報告）：工程師在本機跑 DB migration 卻指向 production，把 production 所有資料表 drop 掉；第一次還原又選錯備份時間點。05:01–17:05 UTC 完全無法寄信、呼叫 API、登入 dashboard，另有約 5 分鐘資料永久遺失。
- **2025-11-18**：受 Cloudflare 大當機波及，寄信中斷約 3 小時。
- **2026-02-15**：DB 連線耗盡，寄信延遲＋dashboard 無法存取 3 小時 31 分。
- 共用 IP 的送達率：第三方評測普遍認為 Postmark 最佳；所有業者用 warmed 的 dedicated IP 都可達 95%+。

## 與競品比較（第三方評測綜合）

| | 強項 | 適合 |
|---|---|---|
| Resend | DX、React Email、agent/MCP 生態 | 新創、Next.js/Vercel 生態、要讓 AI agent 寄信 |
| Postmark | 送達率、強制分流交易/行銷信 | 送達率要求高的交易信 |
| Amazon SES | 大量時最便宜（2026-07-21 起新帳號改分級方案，不再是單一 $0.10/千封） | 月 50 萬封以上、願意自己處理工程 |
| SendGrid | 老牌、功能全 | 既有企業用戶 |

## 結論

- 小量／原型／AI agent 寄信：Resend 是目前最順手的選擇，免費 3,000 封/月 + 官方 MCP，Claude Code 一行裝外掛即可用。
- 需要「每個 agent 有自己的信箱」：Resend 不是這種模型，看 AgentMail 類服務。
- 大量寄送：成本上 SES 仍占優，Resend Scale 方案 250 萬封 $1,150。
- 可靠性：2024-01 資安事件（client 端外洩 DB key，屬低級錯誤）、2024-02 誤刪 production DB 造成的 12 小時停擺，以及 2026-02 的 3.5 小時中斷值得納入評估；關鍵通知信建議準備備援 provider。

## 來源

- 官網：<https://resend.com/>
- 價格：<https://resend.com/pricing>
- MCP 文件：<https://resend.com/docs/mcp-server>
- Agent Email Inbox skill：<https://resend.com/docs/agent-email-inbox-skill>
- Changelog：<https://resend.com/changelog>
- 1M users 回顧：<https://resend.com/blog/1-million-users>
- 事故報告：<https://resend.com/blog/incident-report-for-november-18-2025>、<https://resend.com/blog/incident-report-for-february-15-2026>
- 2024-01 資安事件官方報告：<https://resend.com/blog/incident-report-for-january-10-2024>（HN 討論：<https://news.ycombinator.com/item?id=38944146>）
- 2024-02-21 事故報告：<https://resend.com/blog/incident-report-for-february-21-2024>
- Crunchbase：<https://www.crunchbase.com/organization/resend>
- 比較評測：<https://www.buildmvpfast.com/blog/resend-vs-ses-vs-postmark-transactional-email-deliverability-saas-2026>、<https://mailtrap.io/blog/transactional-email-services/>
- AgentMail 比較（競品觀點）：<https://www.agentmail.to/blog/agentmail-vs-resend>
