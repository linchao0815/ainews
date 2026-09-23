# ai-memory 遷移評估：能否完全取代現有記憶機制

查證日期：2026-09-23
評估對象：akitaonrails/ai-memory（https://github.com/akitaonrails/ai-memory）
本 repo：S:\AI\ainews

## 結論

**不建議「完全以 ai-memory 為主」做一次性切換。** 本 repo 與 ai-memory 真正重疊的機制只有兩個，而 ai-memory 有一個結構性弱點會打到 CLAUDE.md 的紀律核心：recall 是 pull-based，agent 必須主動呼叫 MCP 工具才拿得到記憶，不像 auto-memory 的 `MEMORY.md` 每次 session 自動載入。建議分層並存、實測後再逐項移除。

## 一、本 repo 實際重疊的機制（已盤點）

| 機制 | 是什麼 | 與 ai-memory 關係 |
|---|---|---|
| auto-memory | `~/.claude/projects/s--AI-ainews/memory/*.md` + `MEMORY.md`（2 檔） | 重疊：都是策展過的事實 |
| `tools/sync_memory.py` Stop hook | 把 auto-memory 鏡射到 repo `memory/` 做備份/攜帶 | 重疊：ai-memory 的 git-backed wiki + 多機共享已涵蓋 |

- 本 repo 沒有 llm-wiki（`raw/`、`wiki/` 都不存在）——那套在 h5protect，不受本評估影響。
- Orca hooks、CodeGraph 屬編排/程式圖，與記憶不重疊，不該動。

## 二、功能對等查證（能不能真的取代）

- **auto-memory 的 always-on 索引**：ai-memory 的 SessionStart 會注入 pinned pages + `_rules/` + 一段 unseen delta，讓 agent 開場就知道規則與專案基本狀態（來源：docs/design-decisions.md，已查證）。但任意事實的 recall 仍需 agent 主動呼叫 `memory_query` / `memory_explore`（來源：usage 文件「not automatically injected... depends on the agent knowing which MCP tool to call」，已查證）。→ 部分對等：規則/釘選頁可自動上，零散事實要靠 agent 記得查。
- **sync_memory.py 的攜帶性**：ai-memory git 版控 wiki + 多機共享完全對等，甚至更好。
- **既有 markdown 匯入**：有 `ai-memory bootstrap`，但它讀 git log / README / docs / rule files，且需要設定 LLM provider（破壞零 LLM 預設，有 key 與 token 成本）。本 repo 只有 2 個小 memory 檔，手動 `memory_write_page` 反而乾淨。

### recall 工具名稱（已查證）

- `memory_query`：全文搜尋 + 排序檢索
- `memory_explore`：依離開時間長度縮放的摘要
- `memory_handoff_list` / `memory_handoff_accept`：待接手工作
- `memory_write_page`：持久寫入

## 三、若真要完全遷移，移除步驟

1. 移除 Stop hook：刪 `.claude/settings.json` 的 `python tools/sync_memory.py`，並刪 `tools/sync_memory.py`。
2. 停用 auto-memory 寫入：Claude Code 的 memory 無法在專案層完全關閉，實務上改 CLAUDE.md 不再要求寫 auto-memory，改要求走 `memory_write_page`。
3. 改寫全域 CLAUDE.md：拿掉「Memory 同步到專案目錄」整節與 memory 寫入規則（user/feedback/project/reference 那套），把來源標註規則（已驗證/已查證/推測）寫進 ai-memory 的 `_rules/`。
4. 遷移既有內容：把 `memory/weekly-report-selection-criteria.md` 用 `memory_write_page` 寫進 ai-memory wiki。
5. 安裝：預建 exe → `serve`（127.0.0.1:49374）→ `install-mcp` → `install-hooks --agent claude-code`；裝完 diff `~/.claude.json` 與 settings 確認 Orca hooks 未被動到。

## 四、深入風險評估（為何不建議一次切換）

1. **把唯一記憶押在 experimental 元件上。** 原生 Windows 仍 experimental，且需常駐 server。server 掛掉＝記憶全失 + hook 空跑加延遲。違反 CLAUDE.md「驗能不能用」原則。
2. **pull-based recall 打到紀律核心。** 現行工作流靠 `MEMORY.md` 每次自動載入索引。改成 agent 要主動 `memory_query` 才拿得到——只要某次忘了查，記憶等於不存在。行為風險比技術風險更難察覺。
3. **來源標註紀律會被稀釋。** ai-memory 靠 hook 自動 consolidate transcript，用它自己的格式，不遵守「已驗證/已查證/推測」三級標註。自動捕捉物可信度不明，違背「錯的記錄比沒有更糟」。
4. **bootstrap 需要 LLM key**，破壞零 LLM 賣點，對只有 2 檔的 repo 是殺雞用牛刀。
5. **遷移期雙 source of truth**，期間以哪套為準會混亂。

## 五、建議：分層並存，不要 big-bang

- 保留 auto-memory 當「策展過、always-on 的索引」——ai-memory 目前補不齊（pull-based）。
- 保留 `sync_memory.py` 直到 ai-memory 多機 wiki 實測可靠再撤。
- 新增 ai-memory 只當「自動捕捉 + 跨 agent 交接」層，先在乾淨測試 repo 驗證 SessionStart 注入在 Windows 上能穩定帶出規則與事實。
- 實測數週、確認 recall 行為可靠後，再逐項移除重疊機制，而不是先拆再說。

## 來源連結

- https://github.com/akitaonrails/ai-memory
- https://github.com/akitaonrails/ai-memory/blob/main/docs/design-decisions.md
- https://github.com/akitaonrails/ai-memory/blob/main/docs/ARCHITECTURE.md
- https://github.com/akitaonrails/ai-memory/blob/main/CHANGELOG.md
