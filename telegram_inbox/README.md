# Telegram 連結收集箱

`scripts/telegram_collect.py` 把分享進來的連結抓成可讀內文，寫進這個資料夾。由 GitHub Actions（`.github/workflows/telegram-collect.yml`）執行，有三種進料方式：

| 進料方式 | 觸發 | 適用情境 |
| --- | --- | --- |
| **repository_dispatch**（主要） | iPhone 捷徑分享連結時即時 POST 到 GitHub | 連結由 @Chao_notify 等 bot 貼進頻道的情況——Telegram 規定 bot 看不到其他 bot 的訊息，所以必須從源頭送 |
| **Telegram 輪詢** | 每 2 小時排程 | 補抓「人」手動貼進頻道的連結 |
| **匯出檔匯入** | 本機手動執行 | 一次性回補頻道歷史連結 |

## 設定 1：捷徑直送（repository_dispatch）

1. 建立 GitHub fine-grained PAT：Settings → Developer settings → Personal access tokens → Fine-grained → Repository access 只選 `ainews` → Permissions 只開 **Contents: Read and write**。
2. 在原本「傳到 Telegram」的捷徑裡，**多加**一個「取得 URL 內容」動作：
   - URL：`https://api.github.com/repos/linchao0815/ainews/dispatches`
   - 方法：`POST`
   - 標頭：
     - `Authorization`：`Bearer <PAT>`
     - `Accept`：`application/vnd.github+json`
     - `X-GitHub-Api-Version`：`2022-11-28`
   - 請求本文（JSON）：
     - `event_type`（文字）：`collect-url`
     - `client_payload`（字典）：
       - `url`（文字）：捷徑輸入的連結
       - `source`（文字）：`iphone-shortcut`
3. 成功時 GitHub 回 `204 No Content`，幾秒內 Actions 就會跑一次並 commit 結果。

## 設定 2：Telegram 輪詢

1. 把**讀取用** bot 設為頻道管理員（頻道貼文只推給管理員 bot）。不要跟發文用的 bot 共用同一個。
2. 不要對這個 bot 設 webhook（本流程用 `getUpdates`，兩者互斥）。
3. Repo → Settings → Secrets → `TELEGRAM_BOT_TOKEN`。
4. （選用）Variables → `TELEGRAM_ALLOWED_CHAT_IDS`，逗號分隔的 chat id（頻道 id 是 `-100` 開頭）。

## 設定 3：回補歷史連結

1. Telegram Desktop → 開頻道 → ⋮ → Export chat history → 格式選 **JSON**、不勾任何媒體 → 得到 `result.json`。
2. 在 repo 根目錄執行：
   ```bash
   pip install -r scripts/requirements.txt
   python scripts/telegram_collect.py --from-export /path/to/result.json
   git add telegram_inbox && git commit -m "Backfill Telegram history" && git push
   ```
   結果會全部寫進當天的檔案，但每條保留原始貼文時間。

## 輸出檔案

- `YYYY-MM-DD.jsonl`：每條連結一行，含 `url`、`final_url`、`status`、`title`、`text`（最多 6000 字）、`published`、`site`、`chat`（來源）、`posted_at`。日期以台北時間計。
- `YYYY-MM-DD.md`：同日內容的人類可讀版，分三區：已抓取內文（含 300 字摘錄）／需人工確認／抓取失敗。
- `state.json`：Telegram `getUpdates` 的 offset 與已處理 URL 的雜湊。請勿手動編輯。

## 連結分類

| status | 條件 | 處理 |
| --- | --- | --- |
| `ok` | 一般網頁 | 用 trafilatura 抽出主文與標題／日期／站名 |
| `needs_manual_review` | facebook / instagram / threads / x.com | 登入牆或純 JS 渲染，只嘗試讀 og:title / og:description，內文需人工補 |
| `fetch_failed` | 連線錯誤、HTTP 4xx/5xx、抽不到主文 | 記錄錯誤原因 |

`t.me` 等 Telegram 內部連結會略過。去重時忽略 `www.`、http/https、query 參數順序，並剝除 `utm_*`、`fbclid`、`igshid`、Threads 的 `xmt`/`slof` 等追蹤參數。

## 與每日 AI 情報摘要的銜接

每日摘要流程可在選題前先讀當天與前一天的 `telegram_inbox/YYYY-MM-DD.md`，把 `ok` 區的連結視為候選新聞來源、`needs_manual_review` 區列為待確認清單。
