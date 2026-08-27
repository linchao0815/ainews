# OfficeCLI（已驗證版本）

供AI agent直接讀寫Word／Excel／PowerPoint的CLI工具。這份是**已完成資安查核並手動驗證雜湊**的版本，供專案內重複使用，避免每次重新下載。

## 版本資訊

- 版本：v1.0.143
- 平台：Windows x64
- 來源：https://github.com/iOfficeAI/OfficeCLI/releases/tag/v1.0.143
- SHA256：`d4d4c10fced307e209744cf98a56b003a6e613424fd651b08469274704afd2c6`（見 `SHA256SUMS`，2026-08-13驗證通過）

## 資安背景

完整評估見 [../AI情報週報/officecli-資安評估-2026-08-13.md](../AI情報週報/officecli-資安評估-2026-08-13.md)。摘要：

- 原始碼可稽核、無遙測外傳，可在受控沙盒PoC
- **安裝腳本會自動寫入AI工具的skill目錄、自動更新預設開啟**——本目錄下的binary是手動下載＋雜湊驗證後的版本，**未執行過官方install腳本**
- 使用前務必確認 `officecli config autoUpdate false` 仍生效，且不要另外執行官網一行安裝指令覆蓋本檔案

## 使用方式

```powershell
# 確認自動更新已關閉（每次升級前重新檢查一次）
.\officecli-win-x64.exe config autoUpdate false
$env:OFFICECLI_SKIP_UPDATE = "1"

# 查看指令
.\officecli-win-x64.exe --help
.\officecli-win-x64.exe help pptx
```

## 升級流程（若未來要更新版本）

**不要**直接跑新版install腳本蓋掉這個檔案。改成：
1. 從 [GitHub Releases](https://github.com/iOfficeAI/OfficeCLI/releases) 手動下載新版 exe 與 SHA256SUMS
2. 用 `Get-FileHash -Algorithm SHA256` 比對雜湊相符後才覆蓋此目錄
3. 更新本檔案的版本號與雜湊值
4. 重新執行 `config autoUpdate false`
