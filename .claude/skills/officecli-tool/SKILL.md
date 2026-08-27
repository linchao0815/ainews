---
name: officecli-tool
description: Use when the user wants to create, read, or edit a Word/Excel/PowerPoint file (.docx/.xlsx/.pptx) via CLI, or asks to "用OfficeCLI"/"用officecli-tool". Provides a pre-verified binary bundled inside this skill, so no re-download or install script is needed.
---

# officecli-tool

已完成資安查核並手動驗證雜湊的 OfficeCLI 執行檔，**隨這個skill本身附帶**，位於這份 SKILL.md 同一目錄下的 `officecli-tool/officecli-win-x64.exe`。用來讓AI agent直接讀寫 `.docx`／`.xlsx`／`.pptx`，不需安裝微軟Office。

## 路徑組法（重要）

這個binary放在**skill目錄內**，不是專案目錄內。呼叫時的工作目錄通常是使用者的專案根目錄，不是skill目錄，所以**不能用相對路徑**（如 `.\officecli-tool\officecli-win-x64.exe`）直接呼叫，一定要用skill載入時系統回報的「Base directory」組出絕對路徑：

```powershell
$officecli = "<Base directory>\officecli-tool\officecli-win-x64.exe"
# 例如 Base directory 為 C:\Users\linchao\.claude\skills\officecli-tool 時：
# $officecli = "C:\Users\linchao\.claude\skills\officecli-tool\officecli-tool\officecli-win-x64.exe"
& $officecli config autoUpdate false
```

## 使用前必查

1. **一律使用這份skill內建、已驗證的binary**，不要重新執行官網的 `irm ... | iex` 一行安裝指令（會覆蓋掉這個已驗證版本，且該安裝腳本會自動寫入AI工具skill目錄、開啟自動更新）。
2. 每次使用前確認自動更新仍是關閉狀態：
   ```powershell
   & $officecli config autoUpdate false
   $env:OFFICECLI_SKIP_UPDATE = "1"
   ```
3. 完整資安評估見 [AI情報週報/officecli-資安評估-2026-08-13.md](../../AI情報週報/officecli-資安評估-2026-08-13.md)（此連結相對於這份skill在本專案內的位置，SKILL.md本身沒有移動，路徑層數不變；全域skill副本沒有這份週報，資安結論仍適用，僅連結會失效）——安裝腳本本身有風險（自動寫skill目錄、Windows binary未簽章），但這個已手動驗證雜湊的binary本身可用於受控PoC。

## 版本資訊

- v1.0.143（Windows x64），SHA256見 skill目錄下 `officecli-tool/SHA256SUMS`
- 升級前務必重新手動下載＋比對雜湊，不要直接覆蓋（見 skill目錄下 `officecli-tool/README.md` 升級流程）。**本機同時存在專案版與全域版（`~/.claude/skills/officecli-tool/`）時，升級要兩邊都更新，否則雜湊會對不上。**

## 核心操作模式

OfficeCLI是**低階、逐條指令**的文件操作API（跟pptxgenjs這種一次寫腳本描述整份文件的高階工具不同），操作方式（`$officecli` 為上面組好的絕對路徑）：

```powershell
# 建立空白文件
& $officecli create <file> --type pptx|docx|xlsx

# 查schema（每種格式/元素支援的屬性）
& $officecli help pptx
& $officecli help pptx <element>          # 如 slide, shape, table, textbox
& $officecli help pptx add <element>       # 該元素的add用法與所有屬性

# 單一指令新增/修改
& $officecli add <file> <parent-path> --type <element> --prop key=val ...
& $officecli set <file> <path> --prop key=val ...
& $officecli get <file> <path>
& $officecli query <file> <selector>

# 大量操作用batch（JSON陣列，一次跑完，效率高很多）
& $officecli batch <file> --input batch.json --best-effort
```

## 重要細節（踩過的坑）

- **文字換行**：`--prop text=` 的值裡，`\n` 開新段落（會各自成一個項目符號/bullet）、`\v` 是同一段落內強制換行（Shift+Enter效果）。**列表/bullet內容一律用`\n`分項**，用`\v`會導致所有項目擠成一條bullet。
- **顏色格式**：`fill`/`color` 等prop接受不帶`#`的hex（如`FF0000`）或帶`#`皆可；但這是OfficeCLI自己的格式，不要跟其他工具（如pptxgenjs，那邊`#`前綴會直接讓檔案損毀）混淆。
- **圖示/圖片**：OfficeCLI的`picture`元素只能吃**本機檔案路徑**，不支援inline base64；要嵌入icon需先產生PNG檔案（可用Node.js的react-icons+sharp，或任何方式產出PNG後傳路徑）。
- **批次操作用`batch`指令效率高很多**：與其對同一份文件跑幾百次獨立CLI呼叫，把所有指令組成一個JSON陣列一次送進`batch --input`，速度快非常多且對既有檔案是「resident process」模式運作。
- **對既有文件做局部修改**是OfficeCLI最擅長的場景（比pptxgenjs這種「從零產生」工具更適合）：用`add`/`set`精準改動指定節點，其餘內容與原始格式完全保留，不用整份重新生成。

## 何時該用這個工具 vs 別的工具

- **修改既有正式文件的局部內容**（公司範本、已上線報表、法遵文件）→ 用這個
- **需要同時操作 docx／xlsx／pptx 三種格式**、想要單一CLI語法 → 用這個
- **多輪對話中持續漸進式微調同一份文件** → 用這個（可搭配`open`/`save`/`close`維持resident process）
- **從零產生一份全新簡報，且需要高度客製化視覺設計一次到位** → 考慮用pptxgenjs等高階工具反而更快（見 [AI情報週報/](../../AI情報週報/) 內的比較簡報）
