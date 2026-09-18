# Telegram 連結收集箱

`scripts/telegram_collect.py` 把分享到 Telegram 頻道「AI收集」的連結抓成可讀內文，寫進這個資料夾，供每日 AI 情報摘要選題。由 GitHub Actions（`.github/workflows/telegram-collect.yml`）執行，有三種進料方式：

| 進料方式 | 觸發 | 用途 |
| --- | --- | --- |
| **Telegram 輪詢**（主要） | 每天台北 05:30（摘要 06:00 開跑前）與 17:30（保險） | 收頻道內所有新貼文。頻道貼文一律以「頻道」身分發出，管理員 bot 全部收得到——不論是人貼的還是 @Chao_notify 這類 bot 貼的 |
| repository_dispatch（選用） | 捷徑分享時 POST 到 GitHub | 只有「想秒級進 repo、不想等到下一次輪詢」時才需要；不設定也不影響收集 |
| 匯出檔匯入（一次性） | 手動 | 回補頻道歷史連結，結果已在 `backfill-2026-09-17.*` |

## Telegram 輪詢設定

1. **讀取用 bot 設為頻道管理員**（頻道貼文只推給管理員 bot）。要跟發文用的 bot 分開——bot 收不到自己發出的訊息。
2. 不要對這個 bot 設 webhook（本流程用 `getUpdates`，兩者互斥）。
3. Repo → Settings → Secrets → `TELEGRAM_BOT_TOKEN`。
4. （選用）Variables → `TELEGRAM_ALLOWED_CHAT_IDS`，逗號分隔的 chat id（頻道 id 是 `-100` 開頭，例如 `-1004371102336`）。

排程時間與每日摘要 Routine（UTC 22:00 ＝ 台北 06:00）對齊。Telegram 只保留未領取的 updates 24 小時，所以保留 17:30 那次保險跑，漏一次不會丟一天的資料；腳本會翻頁直到取完（每頁最多 100 筆）。

## 捷徑直送設定（選用）

1. GitHub fine-grained PAT：Repository access 只選 `ainews`，Permissions 只開 **Contents: Read and write**。
2. 捷徑加一個「取得 URL 內容」動作：
   - URL：`https://api.github.com/repos/linchao0815/ainews/dispatches`，方法 `POST`
   - 標頭：`Authorization: Bearer <PAT>`、`Accept: application/vnd.github+json`、`X-GitHub-Api-Version: 2022-11-28`
   - JSON 本文：`event_type` = `collect-url`；`client_payload` = `{ url: 捷徑輸入, source: "iphone-shortcut" }`
3. 成功回 `204`，幾秒內 Actions 跑一次並 commit。

## 回補歷史連結

Telegram Desktop → 頻道 → Export chat history → JSON、不含媒體 → `result.json`，然後二選一：
- 本機：`python scripts/telegram_collect.py --from-export result.json`，commit `telegram_inbox/`
- Actions：把檔案推上分支，Run workflow 時 `export_path` 填檔案路徑，跑完把檔案移掉再合併

結果寫進 `backfill-<執行日>.jsonl/.md`，每條保留原始貼文時間。

## 輸出檔案

- `YYYY-MM-DD.jsonl`：**日期＝連結分享到頻道的台北日期**。每條一行，含 `url`、`final_url`、`status`、`title`、`text`（最多 6000 字）、`published`、`site`、`chat`、`message_id`、`posted_at`、`collected_at`。
- `YYYY-MM-DD.md`：同日內容的人類可讀版，分三區：已抓取內文（含 300 字摘錄）／需人工確認／抓取失敗。
- `state.json`：`getUpdates` 的 offset 與已處理 URL 的雜湊。請勿手動編輯。

## 連結分類

| status | 條件 | 內容 |
| --- | --- | --- |
| `ok` | 一般網頁 | trafilatura 抽出的主文、標題、日期、站名 |
| `needs_manual_review` | facebook / instagram / threads / x.com | 登入牆或純 JS 渲染，只讀 og:title / og:description。**Threads 公開貼文的 og:description 就是貼文正文**，多數情況已足夠判讀；Facebook 常被導到登入頁而無資料 |
| `fetch_failed` | 連線錯誤、HTTP 4xx/5xx、抽不到主文 | 錯誤原因 |

`t.me` 等 Telegram 內部連結會略過。去重時忽略 `www.`、http/https、query 參數順序，並剝除 `utm_*`、`fbclid`、`igshid`、Threads 的 `xmt`/`slof`、Facebook 的 `mibextid`/`rdid`/`share_url` 等追蹤參數。

## 與每日 AI 情報摘要的銜接

摘要 Routine 在選題前讀取 `telegram_inbox/` 最新兩天的 `.md`（需要全文時讀同名 `.jsonl`）：`ok` 的連結直接視為候選來源；`needs_manual_review` 的以 og 描述為線索、經 WebSearch 交叉查證後才納入，並把原貼文連結一併列為來源。
