---
name: ai-weekly-report
description: Use when asked to produce, update or verify an AI情報週報 from the ai_news daily digests in this repo — e.g. 「從 ai_news 取出 X 以後建立週報」「排入查證」「補產業應用」「排版」. Also use when a draft weekly report comes back with feedback about missing GitHub items, too few industry cases, unverified claims, or ugly formatting.
---

# AI 情報週報（從 ai_news 每日簡報產出）

## Overview

把 `ai_news/YYYY-MM-DD.md`（每日 6-8 則）濃縮成一期 `AI情報週報/YYYYMMDD.md`：**分類配比固定、每條四欄位、每條 WebSearch 查證、標準 Markdown 層級**。讀者是處長級主管，要的是「這幾週 GitHub 上誰在紅、同業在用 AI 做什麼、資安出了什麼事、我們的工具與帳單有何變化」的完整掃描。

## 流程

1. **讀範圍**：`grep -E '^[0-9]+\. \*\*' ai_news/<起>..<迄>.md` 先列所有標題；再整批 `cat` 全文（輸出會被持久化到 tool-results 檔，用 Read 分頁讀，不要重 cat）。
2. **合併跨日重複**：同一事件多日追蹤（版本連發、斷供三波、轉導喊卡）合成一條，以最新進展為準，來源欄列出所有 ai_news 日期。
3. **選題配比**（20 天約 140 則 → 29 條）：主推工具與成本 7、資安 8、GitHub 趨勢 8、產業應用 5、法規 1。天數不同時按比例縮放（約每 7 天 10 條），比例是各類別的**下限**：GitHub 趨勢與產業應用各不得少於總條數 15%，資安不得少於 25%。候選真的不足時寧缺勿濫，但要在文首引言註明「本期 X 類僅 N 條，因……」；法規類無新事件可為 0。GitHub 爆紅專案與遊戲同業案例**必須是主推條目**，不能塞進「其他」bullets。
4. **寫檔**：用 `template.md` 的結構直接寫最終格式（不要先寫舊式縮排格式再轉）。
5. **查證**：全部條目都查。派 sonnet subagent 平行跑（每個 agent 2-3 條，4 個一批約 2 分鐘），prompt 用 `verify-prompt.md`。結論填入 `> 🔍 **查證**` 引言區塊。
6. **訂正回寫**：查證發現的核心事實錯誤（金額、版本號、CVE、歸屬）**直接改內文**，並在查證欄註明「ai_news 原文寫 X，實為 Y」。星數差異不改內文，只在查證欄標「查證日 M/D 實際約 N」。
7. **驗證檔案**：UTF-8 無 BOM、LF、CJK bytes 為 `\xe4`–`\xe9`；`> 🔍 **查證**` 出現次數 = 條目數。
8. **文末三張清單**：核心事實訂正、未能獨立確認、ai_news 未報導的重要補充。

## Quick Reference

| 項目 | 規則 |
|---|---|
| 標題 | `###` 25–40 字，分類標籤用 `` `code` `` 另起一行 |
| 欄位 | `**新聞內容**`／`**為什麼對我們有意義**`／`**建議後續**`／`**來源**`，各自成段 |
| 多子項 | (1)(2)(3) 拆成 `1.` 有序清單，前面空一行 |
| 查證 | `> 🔍 **查證**：✅／⚠️／❌ + 來源名 + 訂正` |
| 星數 | 內文保留報導時快照，查證欄給查證日即時值 |
| 自報數字 | 廠商未揭露方法的 ROI（如「購物車 +35%」）標「公司自報非第三方基準」 |
| 分隔 | 同類別條目間 `---`，類別用 `##` |
| 頂部 | `#` 標題、引言、類別／條數／重點總覽表 |

## Common Mistakes

- **只挑工具更新**：第一版 17 條裡 GitHub 與產業應用各 1 條 → 退回。
- **查證只做資安**：使用者最終要求全部查；一開始就全查省兩輪來回。
- **舊式縮排格式**：三空格縮排的四欄位在 Markdown 渲染會合成一大段；標題 100+ 字讀不了 → 「排版很難看」。
- **兩期數字不一致不核對**：8/27 寫 600 億、9/1 ai_news 寫 640 億，查證才抓到；跨期同一事實要比對。
- **Bash 內嵌多行 `python -c`** 會被 shell profile 弄壞；一律寫成 `.temp/claude/*.py` 再執行。
- **cp950 終端機印 CJK 亂碼**：用 `python -X utf8 -c "...sys.stdout.reconfigure(encoding='utf-8')..."` 或寫檔再讀。

## 相關記錄

memory：`weekly-report-selection-criteria`。前期範本：`AI情報週報/20260916.md`（本格式）、`20260827.md`（舊格式，勿沿用排版）。
