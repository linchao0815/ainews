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

## 免費方案能做什麼

### 免費額度總表

| 服務 | 免費額度 | 來源 |
|---|---|---|
| 網站 Free plan | CDN、DNS、SSL、DDoS 防護（不限流量） | 官方 |
| Workers | 10 萬 requests/日、每次 10 ms CPU、100 支 Worker、5 個 cron | 官方 |
| Static Assets（Workers 上的靜態檔） | **免費且不限量**，每版本 2 萬個檔 | 官方 |
| Pages | 500 builds/月、單檔 25 MiB、每站 2 萬檔、100 專案 | 官方 |
| KV | 10 萬讀/日、1,000 寫/日、1 GB | 官方 |
| D1（SQLite） | 500 萬 rows 讀/日、10 萬 rows 寫/日、5 GB | 官方 |
| R2 | 10 GB 儲存、100 萬 Class A、1,000 萬 Class B 操作/月，**流出免費** | 官方 |
| Durable Objects（SQLite） | 10 萬 requests/日 | 官方 |
| Queues | 1 萬 operations/日 | 官方 |
| Hyperdrive | 10 萬 queries/日 | 官方 |
| Workers AI | 1 萬 neurons/日 | 官方 |
| Email Routing | 收信無限（寄信需付費方案） | 官方 |
| Tunnel | 不限數量與頻寬 | 第三方 |
| Zero Trust | 50 人內免費（Access、Gateway），log 保留 24 小時 | 第三方 |

### 實際應用情境（全部可在 $0 內完成）

1. **個人網站／部落格／文件站**：Astro、Hugo、Next.js static export 丟上 Workers Static Assets 或 Pages，綁自己的網域，全球 CDN、自動 HTTPS，流量不收費。
2. **自有網域信箱**：Email Routing 把 `me@你的網域` 轉到 Gmail；或轉進 Worker 解析內容（例如收到發票信自動存 R2、關鍵字觸發通知）。
3. **Webhook 接收器／bot 後端**：Telegram／LINE／Discord bot、GitHub webhook，由 Worker 接、KV 或 D1 存狀態。本 repo 的 `telegram_inbox` 收集若改成 webhook 模式，可用 Worker 常駐接收，不必本機輪詢。
4. **小型 API／BFF**：Hono 框架寫 REST API + D1，做個人記帳、書籤、短網址（KV）。每日 10 萬次請求對個人用途很夠。
5. **定時任務**：5 個 cron trigger，適合輕量工作（打 API、檢查網站存活、推播）；注意免費版 cron 也只有 10 ms CPU，重運算要放外部。
6. **圖片／檔案託管**：R2 存圖，流出免費，適合部落格圖床、下載站；比 S3 省在流量費。
7. **把家裡服務安全開到外網**：Tunnel（`cloudflared`）把 NAS、Home Assistant、自架服務開出去不用開 port；再用 Zero Trust Access 加上 Google/GitHub 登入保護。
8. **小型 AI 功能**：Workers AI 每日 1 萬 neurons，做摘要、翻譯、embedding、分類等輕量推論；AI Gateway 可在前面做快取與用量紀錄。
9. **反向代理／邊緣改寫**：在 Worker 裡改 header、A/B 測試、地區導流、替第三方 API 加快取與隱藏金鑰。

### 免費版的主要天花板

- **10 ms CPU／次**最常卡住：JSON 大量處理、圖片轉換、加解密、SSR 大頁面都可能超過。等待 I/O（fetch、DB）不算 CPU，一般 API 通常夠用。
- 每次 request 最多 50 個 subrequest。
- KV 每日只能寫 1,000 次，寫入頻繁的用途改用 D1 或 Durable Objects。
- 寄信、Containers、Browser Rendering 大量使用等需 Workers Paid（$5/月）。

## Workers 深入

### 執行模型

- 不是容器也不是 VM，而是 **V8 isolate**：同一個 process 內多個隔離的 JS 執行環境，啟動以毫秒計，因此幾乎沒有冷啟動（啟動時間上限 1 秒）。
- 部署到 Cloudflare 全球網路，request 在離使用者最近的節點執行。
- **計費看 CPU 時間，不看牆鐘時間**：等待 fetch、DB 回應不計費，HTTP request 的 duration 無上限。這是它比 Lambda 便宜的主因（I/O 密集型工作特別划算）。

### 限制（官方 limits 頁）

| 項目 | Free | Paid（$5/月） |
|---|---|---|
| Requests | 10 萬/日 | 不限（含 1,000 萬/月） |
| CPU 時間／次 | 10 ms | 預設 30 秒，可調到 5 分鐘 |
| 記憶體 | 128 MB | 128 MB |
| Subrequests／次 | 50 | 1 萬（可申請到 1,000 萬） |
| Worker 大小（未壓縮） | 64 MiB | 64 MiB |
| Worker 數量 | 100 | 500 |
| Cron triggers | 5 | 250 |
| Cron CPU | 10 ms | 30 秒（間隔 < 1 小時）／15 分鐘（≥ 1 小時） |
| 環境變數 | 64 | 128 |
| 靜態檔數／版本 | 2 萬 | 10 萬 |

### Paid 計費

- $5/月基本費，含 **1,000 萬 requests + 3,000 萬 CPU ms**。
- 超量：$0.30／百萬 requests、$0.02／百萬 CPU ms。
- 靜態資源請求免費；Worker 間用 Service Binding 互呼叫不另收 request 費；無 egress 費。

### 語言與相容性

- 一級支援：JavaScript、TypeScript、Python、Rust；其他語言可經 WebAssembly（C/C++、Go、Kotlin）。
- Python Workers 用 `uv` + `pywrangler`，支援 FastAPI、Pydantic、LangChain 等套件。
- **Node.js 相容**：compatibility date 在 2026-08-04 之後預設開啟；更早的日期需手動加 `nodejs_compat` flag。支援 Buffer、crypto、stream、http/https、net、fs、AsyncLocalStorage 等；`child_process`、`cluster`、`vm`、`worker_threads` 只是空殼不能用。

### Bindings：Workers 的核心設計

Worker 不用連線字串或 SDK 金鑰，而是在 `wrangler.jsonc` 宣告 binding，執行時從 `env` 直接拿到資源物件：

```jsonc
{
  "name": "my-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-01",
  "assets": { "directory": "./public" },
  "kv_namespaces": [{ "binding": "CACHE", "id": "..." }],
  "d1_databases": [{ "binding": "DB", "database_id": "..." }],
  "r2_buckets": [{ "binding": "FILES", "bucket_name": "files" }],
  "ai": { "binding": "AI" },
  "triggers": { "crons": ["0 * * * *"] }
}
```

```ts
export default {
  async fetch(req: Request, env: Env) {
    const row = await env.DB.prepare("select * from notes where id = ?").bind(1).first();
    return Response.json(row);
  },
  async scheduled(_evt: ScheduledEvent, env: Env) {
    // cron 觸發
  },
  async email(msg: ForwardableEmailMessage, env: Env) {
    // Email Routing 收到信
  },
};
```

一個 Worker 可同時處理 `fetch`（HTTP）、`scheduled`（cron）、`email`（收信）、`queue`（佇列消費）等事件。

### 周邊產品怎麼搭

| 需求 | 用什麼 |
|---|---|
| 快取、設定、讀多寫少 | KV（最終一致） |
| 關聯式資料 | D1（SQLite）；既有 Postgres/MySQL 用 Hyperdrive 加速連線 |
| 強一致狀態、WebSocket、多人協作、每使用者一個 DB | Durable Objects |
| 檔案、圖片、備份 | R2 |
| 背景工作、削峰 | Queues |
| 多步驟長流程（重試、等待數天） | Workflows |
| 跑任意 Linux 程式 | Containers／Sandboxes |
| AI 推論 | Workers AI、AI Gateway |
| AI agent | Agents SDK（官方：Agents 需要 Durable Objects；每個 agent 實例是獨立的 micro-server，有自己的狀態）；起手：`npx create-cloudflare@latest --template cloudflare/agents-starter` |

### Pages vs Workers

官方遷移指南沒有明說「新專案一律用 Workers」，但指出 Workers 功能明顯較廣；超過 100 個站時官方則建議改用 Workers Static Assets 或 Workers for Platforms。

- **只有 Workers 有**：cron、Email Workers、Queue consumer、Durable Objects、rate limiting binding、漸進式部署、Workers Logs／Tail Workers、source maps、Vite plugin。
- **只有 Pages 有**：檔案式路由、Pages Plugins、可綁非 Cloudflare 託管的自訂網域。

實務判斷：純靜態網站、要 Git 推送即部署 → Pages 最省事；網站之外還要 API、排程、收信 → 直接用 Workers + Static Assets。

### 開發流程

- `npm create cloudflare@latest` 建立專案，`wrangler dev` 本機模擬（含 KV/D1/R2），`wrangler deploy` 部署。
- 可接 GitHub 自動建置（Workers Builds）。
- Observability：dashboard 內建 logs 與 metrics，另有 Observability MCP 可讓 agent 查 log。

### 什麼時候不適合

- 單次需要 >128 MB 記憶體或長時間重 CPU（影片轉檔、大模型推論）→ Containers 或其他雲。
- 依賴 native Node 模組、`child_process` 的舊程式 → 需改寫或改用 Containers。
- 需要固定出口 IP、長連線到特定地區資料庫且延遲敏感 → 要搭 Hyperdrive 或評估其他方案。

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
- Workers limits：<https://developers.cloudflare.com/workers/platform/limits/>
- Workers pricing：<https://developers.cloudflare.com/workers/platform/pricing/>
- Workers 語言／Node.js 相容：<https://developers.cloudflare.com/workers/languages/>、<https://developers.cloudflare.com/workers/runtime-apis/nodejs/>
- Pages limits／遷移指南：<https://developers.cloudflare.com/pages/platform/limits/>、<https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/>
- R2 pricing：<https://developers.cloudflare.com/r2/pricing/>
- Workers AI pricing：<https://developers.cloudflare.com/workers-ai/platform/pricing/>
- Agents SDK：<https://developers.cloudflare.com/agents/api-reference/agents-api/>
- Email Service：<https://developers.cloudflare.com/email-service/>、價格 <https://developers.cloudflare.com/email-service/platform/pricing/>
- Email Service private beta 公告：<https://blog.cloudflare.com/email-service/>
- Agents Week 2026 總覽：<https://blog.cloudflare.com/agents-week-in-review/>
- MCP servers：<https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/>、<https://github.com/cloudflare/mcp>
- Code Mode：<https://blog.cloudflare.com/code-mode-mcp/>
- 2026-02-20 事故：<https://blog.cloudflare.com/cloudflare-outage-february-20-2026/>
- Code Orange：<https://blog.cloudflare.com/fail-small-resilience-plan/>

第三方：
- Zero Trust 免費 50 人：<https://costbench.com/software/business-vpn/cloudflare-zero-trust/free-plan/>
- Tunnel 免費不限量：<https://bex.co/blog/2026/07/28/cloudflare-tunnel-free-zero-open-ports-ingress>
- InfoQ Code Mode 報導：<https://www.infoq.com/news/2026/04/cloudflare-code-mode-mcp-server/>
- 網站方案價格整理：<https://blog.blazingcdn.com/en-us/cloudflare-pricing-2026-free-pro-business-enterprise-explained>
- Email Service 評論：<https://lord.technology/2026/04/20/cloudflare-email-service-is-a-deliverability-bet-dressed-as-an-agents-launch.html>
- 2025-11 事故報導：<https://cybernews.com/security/cloudflare-outage-ends-ceo-apologizes-releases-post-mortem/>

相關筆記：[Resend 研究筆記](resend-研究筆記.md)
