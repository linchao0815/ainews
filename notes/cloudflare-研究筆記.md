# Cloudflare 研究筆記

> 查證日期：2026-09-24。`dash.cloudflare.com` 是需登入的管理後台，本筆記研究的是後台背後的平台與服務。官方來源與第三方來源分開標示。

## 一句話定位

全球 CDN／DNS／資安網路起家，現在同時是「開發者雲」（Workers 無伺服器運算＋儲存＋AI）與「agent 雲」（2026 Agents Week 主軸）。後台 dash.cloudflare.com 是所有服務的統一入口，2026 起內建 dashboard agent「Agent Lee」。

## 服務版圖

| 類別 | 主要產品 |
|---|---|
| 網站／網路 | DNS、CDN、WAF、DDoS、Bot Management、Registrar（原價轉售網域） |
| Zero Trust（Cloudflare One） | Access、Gateway、Tunnel、CASB、Mesh（2026 新） |
| 運算 | Workers、Durable Objects、Workflows、Containers、Sandboxes（2026-04 GA） |
| 儲存 | R2（S3 相容、無流出費）、KV、D1（SQLite）、Hyperdrive、Queues；PlanetScale Postgres/MySQL 整合 |
| AI | Workers AI、AI Gateway、AI Search、Agents SDK（Project Think）、Agent Memory、Browser Run |
| Email | Email Routing（收信，GA）、Email Sending（寄信，beta） |

## 價格

**網站方案（每個 zone＝每個網域計價）**——第三方整理，未在官方頁取得明確數字：

| Free | Pro | Business | Enterprise |
|---|---|---|---|
| $0 | $25/月 | $250/月（2025 年底由 $200 調漲） | 洽談 |

Pro 起有 20 條 WAF custom rules、Super Bot Fight Mode、OWASP 規則集（官方 Pro 頁）。

**開發者平台（官方 pricing 頁，用量計費）**

| 服務 | 免費額度 | 超量 |
|---|---|---|
| Workers | 10 萬 requests/日 | $0.30／百萬 requests |
| Durable Objects | 10 萬 requests/日 | $0.15／百萬 |
| R2 | 10 GB-月 | $0.015/GB-月（無 egress 費） |
| KV | 1 GB | $0.50/GB-月 |
| D1 | 5 GB | $0.75/GB-月 |
| Workers AI | 1 萬 neurons/日 | $0.011／千 neurons |
| Browser Rendering | 10 分鐘/日 | $0.09/小時 |

Workers Paid 方案 $5/月是多數進階功能（含寄信）的門檻。

## Email Service：與 Resend 直接競爭

- 2025 年 private beta，**2026-04-16 Email Sending 進入 public beta**（Agents Week 發表）；官方文件目前仍標「Email Sending Beta」。Email Routing（收信）已 GA。
- **價格**：需 Workers Paid（$5/月）；含 3,000 封/月，之後 **$0.35／千封**；收信無限；寄給帳號內已驗證地址免費。被 API 拒絕（含 suppression list）的不計費。
- **介面**：Workers binding、REST API、SMTP（`smtps://smtp.mx.cloudflare.net:465`，API token 認證）。
- **定位**：官方主打「讓 agent 原生收發信」——收信進 Worker 處理、再回信，比 Resend 的 webhook 模型更整合。

| | Cloudflare Email Sending | Resend |
|---|---|---|
| 狀態 | beta | GA |
| 10 萬封/月成本 | $5 + 97k × $0.35/千 ≈ **$39** | Pro **$35** |
| 100 萬封/月成本 | $5 + 997k × $0.35/千 ≈ **$354** | Scale **$650** |
| 收信 | Email Routing → Worker，免費無限 | Inbound webhook |
| 行銷信／contacts／broadcast | 無 | 有 |
| 模板／DX | 無 React Email 類工具 | React Email、多語言 SDK |
| 適合 | 已在 Workers 上、量大、只要交易信 | 要完整 email 產品、行銷信、快速上手 |

結論：量大且已用 Workers → Cloudflare 便宜近一半；但 beta、無行銷功能，送達率口碑尚待累積（第三方評論認為這是「披著 agent 外衣的送達率賭注」）。

## Agent / MCP 相關

- **Cloudflare API MCP**：`https://mcp.cloudflare.com/mcp`，OAuth。用 **Code Mode** 只暴露 `search()` 與 `execute()` 兩個工具，模型寫 JS 在 V8 isolate 裡呼叫 API——涵蓋 2,500+ endpoint 只需約 1,000 tokens（逐一列工具要 100 萬+ tokens）。支援 MCP 2026-07-28 規格。
- **產品專用 MCP**：docs、bindings、builds、observability、radar、containers、browser、logs、ai-gateway、autorag、auditlogs、dns-analytics、dex、casb、graphql 等（網址皆為 `<name>.mcp.cloudflare.com/mcp`）。
- **cf CLI**：統一 CLI，涵蓋近 3,000 個 API 操作（Agents Week 發表）。
- **Agent Lee**：dashboard 內建 agent，協助排錯與管理。

## Agents Week 2026（2026-04-20 那週）重點

- 運算：Sandboxes GA、Artifacts（Git 相容的版本化儲存）、Durable Object Facets、重寫的 Workflows（5 萬並行）
- 資安：Mesh、Access 的 Managed OAuth（RFC 9728，讓 agent 代使用者認證）、可掃描的 API token、MCP 企業治理參考架構（含 shadow MCP 偵測）
- Agent 工具：Project Think SDK、Voice pipeline（實驗）、Email Service public beta、14+ 模型供應商的統一推論層、Agent Memory、AI Search、Browser Run（Live View、CDP、4 倍並行）
- 上線：cf CLI、Agent Lee、Flagship（feature flag）、PlanetScale 整合、Registrar API（beta）
- Agentic web：Agent Readiness Score、AI 訓練爬蟲重導、FL2（Rust 重寫的代理層）

## 可靠性

- **2025-11-18**：Bot Management 的錯誤設定檔引發 2019 年以來最嚴重中斷，ChatGPT、X、Spotify 等連帶掛掉（Resend 同日也因此停擺約 3 小時）。
- **2026-02-20**：BYOIP 管線變更誤撤回部分客戶的 BGP prefix（官方：非攻擊）。
- 之後官方推出「Code Orange: Fail Small」韌性計畫（更安全的設定推送）。
- 第三方稱 2026-08 有「8 天 13 次事故、R2 不穩」——**未查證，勿引用**。
- 啟示：Cloudflare 是很多服務的共同依賴（單點風險）；Resend 等上層服務也會被牽連，備援規劃要考慮到「不同 provider 其實都在 Cloudflare 後面」。

## 來源

官方：
- Plans／開發者價格：<https://www.cloudflare.com/plans/>、<https://www.cloudflare.com/plans/pro/>
- Email Service：<https://developers.cloudflare.com/email-service/>、價格 <https://developers.cloudflare.com/email-service/platform/pricing/>
- Email Service private beta 公告：<https://blog.cloudflare.com/email-service/>
- Agents Week 2026 總覽：<https://blog.cloudflare.com/agents-week-in-review/>
- MCP servers：<https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/>、<https://github.com/cloudflare/mcp>
- Code Mode：<https://blog.cloudflare.com/code-mode-mcp/>
- 2026-02-20 事故：<https://blog.cloudflare.com/cloudflare-outage-february-20-2026/>
- Code Orange：<https://blog.cloudflare.com/fail-small-resilience-plan/>

第三方：
- InfoQ Code Mode 報導：<https://www.infoq.com/news/2026/04/cloudflare-code-mode-mcp-server/>
- 網站方案價格整理：<https://blog.blazingcdn.com/en-us/cloudflare-pricing-2026-free-pro-business-enterprise-explained>
- Email Service 評論：<https://lord.technology/2026/04/20/cloudflare-email-service-is-a-deliverability-bet-dressed-as-an-agents-launch.html>
- 2025-11 事故報導：<https://cybernews.com/security/cloudflare-outage-ends-ceo-apologizes-releases-post-mortem/>

相關筆記：[Resend 研究筆記](resend-研究筆記.md)
