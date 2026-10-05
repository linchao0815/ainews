# pstack：讓 Coding Agent 像工頭一樣派工與驗收的技能包

收集 pstack（Lauren Tan 為 Cursor 打造的 agent 工作流程技能包）的內容、運作方式，以及移植到 Claude Code 的社群版本。

- **加入日期**：2026-10-05
- **作者**：Lauren Tan（[@poteto](https://github.com/poteto)，前 React Core 成員，現任職 Cursor）
- **官方版**：[cursor/plugins - pstack](https://github.com/cursor/plugins/tree/main/pstack)（Cursor 外掛，`/add-plugin pstack` 安裝）
- **Claude Code 社群版**：[TheOnlyFusionCube/potetos-for-everyone](https://github.com/TheOnlyFusionCube/potetos-for-everyone)（自稱取代較早的 `pstack-claude`）

---

## 一句話版本

pstack 是一整套「工頭」技能包：你只描述想要的結果，它會幫 AI 挑做法、拆任務、把工作分派給適合的模型，而且**要看到驗證證據才算完成**——「build 過了」不算數。原版給 Cursor 用，Claude Code 可裝社群移植版。

## 內容組成

- **規模**（不同來源數字略有出入）：約 23–24 個工作流程技能、21–23 條工程原則、22 套任務劇本（playbook）、2 個專用 subagent、輔助程式，以及選用的自動化套件。
- **主指令**：`/poteto-mode`。描述目標後，它會：
  1. 挑一套劇本（調查、修 bug、新功能、重構、效能問題、原型、執行期鑑識、自動長跑、多工協調、看顧等）
  2. 建立任務清單
  3. 需要時呼叫其他技能
  4. 把工作分派給適合的模型
  5. 要求驗證證據後才回報成功
- **設計目標**：不是寫更多程式碼，而是**更少、更好的程式碼**，並有足夠驗證讓多個 agent 平行工作也不會把 repo 弄亂。
- **採用量**：上線時 Cursor 內部一週就被使用約 9,000 次（官方頁標題為「the skills behind 10,000 agent runs」）。

## 多模型分工

- 模型分派設定存在 `~/.cursor/rules/pstack-models.mdc`，依角色（實作、調查、判斷、審查）指定模型。
- 範例分工：一般實作交給較快的模型，最難的修改、判斷與文字撰寫交給頂級模型。

## 驗證規則

pstack 明確拒絕把「build 過了」當作完成證據，驗證方式要跟改動類型對應：

| 改動類型 | 要求的證據 |
|---|---|
| CLI 指令 | 實際執行指令看輸出 |
| 介面 | 實際走一遍 UI 流程 |
| 效能 | 比對前後的 trace |

## Claude Code 版的限制

- 社群版是翻譯移植，不是 Lauren Tan 官方維護。
- 作者與評論者都指出 **Cursor 仍是最合適的環境**，因為 Cursor 能替每個 subagent 指定不同模型；Claude Code 上這一層的彈性較小。

## 觀察與建議

- 核心價值在「驗收紀律」：要求 agent 依改動類型拿出實跑證據，這點與我們既有的 `verification-before-completion` 習慣一致，可直接借用其劇本分類。
- 技能數量多，全部載入會吃 context；建議先用 `/poteto-mode` 跑一兩個中型任務，觀察實際有沒有省掉來回驗收的時間，再決定是否長期使用。
- 社群移植版更新節奏不受原作者控制，導入前留意版本與授權。

**參考來源**：
- [pstack: the skills behind 10,000 agent runs - Cursor](https://cursor.com/ja/lp-team/lauren)
- [A deep dive into pstack - flaviocopes](https://flaviocopes.com/pstack)
- [cursor/plugins - pstack](https://github.com/cursor/plugins/tree/main/pstack)
- [potetos-for-everyone README](https://cdn.jsdelivr.net/npm/potetos-for-everyone@0.1.0/README.md)
- [React 團隊介紹頁（Lauren Tan）](https://18.react.dev/community/team)
