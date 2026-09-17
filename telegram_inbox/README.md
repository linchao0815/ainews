# Telegram 連結收集箱

`scripts/telegram_collect.py` 由 GitHub Actions（`.github/workflows/telegram-collect.yml`）每 2 小時執行一次：
讀取 Telegram bot 所在聊天／頻道的新訊息，取出其中的連結，抓取可讀內文，結果寫進這個資料夾。

## 一次性設定

1. **Bot 權限**：在頻道中把 bot 設為管理員（頻道貼文只有管理員 bot 才收得到）。若是群組，需在 @BotFather 用 `/setprivacy` 關閉隱私模式，或同樣設為管理員。
2. **不要對這個 bot 設 webhook**：本流程用 `getUpdates` 輪詢；若 bot 另有 webhook，Telegram 會回 409，需先呼叫 `deleteWebhook`。
3. **GitHub Secret**：Repo → Settings → Secrets and variables → Actions → New repository secret，名稱 `TELEGRAM_BOT_TOKEN`，值為 @BotFather 給的 token。
4. **（選用）限制來源聊天**：同頁 Variables 分頁新增 `TELEGRAM_ALLOWED_CHAT_IDS`，填逗號分隔的 chat id（頻道 id 通常是 `-100` 開頭）。不設則收集 bot 看得到的所有聊天。
5. 設定完成後，到 Actions → Telegram link collector → Run workflow 手動跑第一次確認。

## 輸出檔案

- `YYYY-MM-DD.jsonl`：每條連結一行，含 `url`、`final_url`、`status`、`title`、`text`（最多 6000 字）、`published`、`site`、`chat`、`posted_at`。日期以台北時間計。
- `YYYY-MM-DD.md`：同日內容的人類可讀版，分三區：已抓取內文（含 300 字摘錄）／需人工確認／抓取失敗。
- `state.json`：`getUpdates` 的 offset 與已處理 URL 的雜湊，避免重複收集。請勿手動編輯。

## 連結分類

| status | 條件 | 處理 |
| --- | --- | --- |
| `ok` | 一般網頁 | 用 trafilatura 抽出主文與標題／日期／站名 |
| `needs_manual_review` | facebook / instagram / threads / x.com | 這些平台有登入牆或純 JS 渲染，只嘗試讀 og:title / og:description，內文需人工補 |
| `fetch_failed` | 連線錯誤、HTTP 4xx/5xx、抽不到主文 | 記錄錯誤原因 |

`t.me` 等 Telegram 內部連結會直接略過；URL 會去除 `utm_*`、`fbclid`、`igshid` 等追蹤參數後再比對是否重複。

## 與每日 AI 情報摘要的銜接

每日摘要流程可在選題前先讀當天與前一天的 `telegram_inbox/YYYY-MM-DD.md`，把 `ok` 區的連結視為候選新聞來源、`needs_manual_review` 區列為待確認清單。
