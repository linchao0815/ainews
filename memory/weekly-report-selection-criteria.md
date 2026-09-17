---
name: weekly-report-selection-criteria
description: AI情報週報的選題與查證規則——GitHub 爆紅專案與產業應用必須是主推條目、資安條目必須 WebSearch 查證
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fc82b7d8-cb88-4444-8cf4-d332bbb36ef6
  modified: 2026-09-17T04:11:21.319Z
---

使用者對 AI情報週報（`AI情報週報/YYYYMMDD.md`）候選清單的回饋（2026-09-17）：
1. **GitHub 爆紅專案要當主推條目**，不能只塞進「其他值得留意」bullets。星數／成長速度本身就是選題理由。
2. **產業應用（美術／企劃／營運／QA 遊戲同業案例）要夠多**，第一版只有 1 條被退回；補到 5 條後接受。
3. **資安相關條目要排入查證**（WebSearch 交叉至少 2 個獨立來源），其他類別可先不查證。
4. 同一事件跨日重複報導要合併為一條，以最新進展為準。

**Why:** 週報的讀者是處長級主管，要的是「這週 GitHub 上誰在紅、同業在用 AI 做什麼」的完整掃描，不是只有工具版本更新；資安條目若未查證會被質疑可信度。

**How to apply:** 直接用專案 skill `ai-weekly-report`（`.claude/skills/ai-weekly-report/`，含 template.md 與 verify-prompt.md）。產出候選 .md 時，主推條目類別配比大約：主推工具與成本 7、資安 8、GitHub 趨勢 8、產業應用 5（2026-09-16 期為 29 條）。資安查證派 sonnet subagent 平行跑（4 個 agent 各 2-3 條，約 2 分鐘），輸出格式固定為「🔍 **查證**：✅/⚠️/❌ + 來源 + 訂正」，訂正直接改進條目內文並在查證欄註明原文出處。格式範本見 `AI情報週報/20260827.md` 與 `20260916.md`。相關：[[ainews-digest-structure]]
