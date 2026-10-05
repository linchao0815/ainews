# Spotify Shunt：把粗活分流給便宜模型，節省 Claude Code Token

收集 Spotify 開源的 Claude Code 外掛 Shunt 的設計、實測數字與限制，以及改用 Claude Code 內建 Haiku 自建同類分流的做法。

- **加入日期**：2026-10-05
- **作者**：Spotify 工程師 Dimitri Mazmanov（Spotify Portal 團隊）
- **官方後端**：Spotify Portal for Backstage ＋ AiKA（企業年費方案，需洽業務報價）

---

## 一句話版本

Shunt 用 Claude Code 的 `PreToolUse` hook 攔下「讀大檔、寫樣板程式碼」這類粗活，交給便宜模型在自己的拋棄式 context 裡處理，只把答案回傳給 Claude；Claude 只負責推理。在 Spotify 自家 16.2 萬行 Java monorepo 上，**讀大檔的情境平均省下約 90% token**（82%–94%）。

## 運作機制（三層）

1. **Hooks（強制分流）**：
   - `check-file-size`：攔截超過 350 行（可調）的檔案讀取，改走 bulk-reader
   - `check-bash-read`：擋下用 `cat`、`head` 等指令繞道讀大檔
2. **Scripts**：兩支 bash 包裝程式，分別處理「大量讀取」與「程式碼產生」，送到 Portal 上的 mode 執行。
3. **Skills**：Markdown 說明，教 Claude 什麼時候該主動分流。

官方版的 worker 模型是 Gemini 2.5 Flash（Portal 也支援其他模型）。

## 實測數字

| 項目 | 數字 |
|---|---|
| 測試 repo | 16.2 萬行 Java monorepo |
| 情境 | 4 種，其中 3 種為大量讀取 |
| 大量讀取平均節省 | 約 90%（範圍 82%–94%） |
| 代表案例 | 7,408 行直接給 Claude：75,990 token；先經 worker 摘要：4,148 token |

## 官方承認的限制

- **編輯無法分流**：摘要會遺失行號，改檔仍須主模型親自讀。
- **推理任務仍需頂級模型**；便宜模型曾漏掉主模型抓得到的 bug。
- **網路延遲**：每次分流多 10–30 秒。
- 社群（r/ClaudeAI）質疑這和 Claude Code 內建 Explore agent 把唯讀任務交給較便宜模型的做法差不多。

## 替代方案：後端換成 Haiku 的社群移植版

官方後端綁 Spotify 的付費服務，社群已有多個「同樣三層設計、後端改用 Claude Haiku 4.5」的開源移植，都沿用 Claude Code 既有登入，不需要外部服務。（同仁分享時表示已照此設計自建並在本機使用，細節未經本筆記查證。）

| 專案 | 攔截範圍 | 安裝 | 授權 |
|---|---|---|---|
| [melonkernel/shuntkit](https://github.com/melonkernel/shuntkit) | Read 超過 350 行、`cat`/`less`/`sed` 讀大檔；另有每檔 700 行切片額度 | `uv tool install shuntkit` → `shuntkit install` | Apache-2.0 |
| [mserranolm/haiku-shunt](https://github.com/mserranolm/haiku-shunt) | Read 超過 350 行、`cat`/`head`/`tail`/`less`/`more` | `claude plugin marketplace add mserranolm/haiku-shunt` | Apache-2.0 |
| [init-kaushal/skim](https://github.com/init-kaushal/skim) | 過大的 Read、範圍太廣的 Grep、輸出很吵的 Bash | `go install` ＋ `claude plugin install skim@skim` | MIT |
| [jarvisrchen/claude-shunt](https://github.com/jarvisrchen/claude-shunt) | 大檔讀取與樣板程式碼產生（三層同官方） | 見 README | 見 README |

注意事項（2026-10-05 查詢時）：

- 這些專案都很新，GitHub 星數僅 0–1，**沒有一個公布自己的獨立實測數字**，README 引用的 90% 都是 Spotify 的數據。
- skim 的 README 坦承：主模型是 Opus 時，長檔第一次讀就回本；檔案只略超過門檻時要再讀約 3 次才回本；**主模型本身就是 Haiku 時幾乎沒有好處，甚至虧本**。

## 觀察與建議

- 「90%」是**讀大檔情境的平均值**，不是整體帳單降幅；跟 [RTK 筆記](rtk-token-savings.md) 的教訓一樣，評估時要看實際用量 dashboard，不要只看工具自報。
- 適合大型 repo、常需要「先讀懂一大塊再做決定」的工作；小 repo 或以編輯為主的工作省不了多少。
- 分流會增加延遲，且便宜模型的摘要可能漏細節；關鍵判斷前仍應讓主模型讀原文。

**參考來源**：
- [Spotify reduces Claude Code token usage by 90 percent - Techzine Global](https://www.techzine.eu/news/devops/144093/spotify-reduces-claude-code-token-usage-by-90-percent/)
- [Spotify's Claude Code Router Cut Tokens 90% - Tenten](https://developer.tenten.co/spotify-portal-claude-code-shunt-token-routing)
- [Spotify Portal/Shunt: 90% Claude Code Savings? - explainx.ai](https://explainx.ai/blog/spotify-portal-shunt-claude-code-token-savings-2026)
- [Spotify Cuts Claude Code Token Usage by 90% - AIM](https://analyticsindiamag.com/ai-news/spotify-cuts-claude-code-token-usage-by-90)
- [Backstage 定價整理 - devtune.ai](https://devtune.ai/verticals/internal-developer-platforms/backstage/pricing)
- [melonkernel/shuntkit](https://github.com/melonkernel/shuntkit)
- [mserranolm/haiku-shunt](https://github.com/mserranolm/haiku-shunt)
- [init-kaushal/skim](https://github.com/init-kaushal/skim)
- [jarvisrchen/claude-shunt](https://github.com/jarvisrchen/claude-shunt)
