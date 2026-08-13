# OfficeCLI 資安評估

> 對象：[iOfficeAI/OfficeCLI](https://github.com/iOfficeAI/OfficeCLI)（Apache-2.0）
> 起因：[20260813.md](20260813.md)「GitHub趨勢｜開源 OfficeCLI」該則新聞建議企劃室試裝，導入前先做資安查核
> 評估日期：2026-08-13　評估版本：v1.0.143（2026-07-28 發布）
> 方法：shallow clone 原始碼實際檢視 installer、CI workflow、更新器、內建伺服器與檔案剖析路徑，非僅閱讀 README

## 結論

**未發現惡意行為或後門，程式碼安全衛生優於多數同類工具。** 但有兩項「設計上的信任讓渡」與兩項發布面缺口，導入前應以受控方式安裝，不建議直接執行官網的一行安裝指令。

**建議結論：可在受控沙盒進行概念驗證（PoC），暫不列為全室標準工具。**

## 一、查證通過的項目

| 項目 | 查證結果 |
|---|---|
| 原始碼可稽核 | `src/` 含完整 .NET 原始碼（1,201 個檔案），非只放二進位檔的 repo |
| Release 出處 | `.github/workflows/build.yml` 由 git tag 觸發、GitHub Actions 建置，SHA256SUMS 於 CI 產生，資產發布者為 `github-actions[bot]`，非人工上傳 |
| macOS 簽章 | Developer ID 簽章 ＋ Apple notarize（workflow 第 86–118 行） |
| XXE 防護 | 所有 `XmlReaderSettings` 均設 `DtdProcessing.Prohibit` ＋ `XmlResolver = null`；處理不信任來源的 OOXML 該有的防護都在 |
| Zip 路徑穿越 | 僅以 `ZipArchive` 讀取 entry，全庫無 `ExtractToDirectory`／`ExtractToFile`，不存在 zip-slip |
| 本機預覽伺服器 | `TcpListener(IPAddress.Loopback)` 只綁 127.0.0.1，並有 Host／Origin 白名單防 DNS rebinding（`Core/Watch/WatchServer.cs`） |
| 遙測與外傳 | 全庫搜尋 `telemetry`／`analytics` 命中 0；文件內容純本機處理，不上傳雲端 |

> 最後一項對公司特別重要：**企劃書、營運報表、對外簡報的內容不會離開本機**，這是相對其他線上文件 AI 工具的主要優勢。

## 二、風險項目

### 高：安裝腳本自動寫入 AI 工具的 skill 檔

`install.ps1` 第 167–203 行（`install.sh` 第 235–263 行同理）會偵測 `%USERPROFILE%\.claude`、`.cursor`、`.copilot` 等 10 個目錄，命中就直接放一份 `SKILL.md` 進去，**不詢問、不提示**。

該檔案是 AI agent 會當成「指令」讀取的內容。等於在 agent 的上下文裡開了一個由遠端內容決定的注入面；若該檔案內容日後被替換為惡意指令，agent 可能在使用者未察覺下執行非預期操作。風險高低取決於各人 agent 的授權寬鬆程度。

### 高：自動更新預設開啟，會自我替換執行檔

`Core/UpdateChecker.cs` 的 `AutoUpdate` 預設為 `true`。背景檢查到新版即下載、驗 SHA256、`File.Move` 覆蓋自身，並同步更新已安裝的 SKILL.md。

這不是漏洞，但構成一條**常駐的遠端程式碼更新通道**——使用者是在長期信任發布方，而非只信任當初稽核過的那一版。可關閉：`officecli config autoUpdate false` 或環境變數 `OFFICECLI_SKIP_UPDATE=1`。

### 中：主要下載來源為自架 CDN，且 checksum 同源

install 腳本與更新器都以 `https://d.officecli.ai` 為優先來源、GitHub Releases 僅為 fallback。SHA256SUMS 與二進位檔取自同一來源，**只能防傳輸損毀，無法防上游被入侵**（攻擊者能同時替換兩者）。GitHub Releases 上那份才有 CI 建置的可追溯性。

### 中：Windows 執行檔未簽章

CI 只對 macOS 簽章與公證，兩個 Windows exe **沒有 Authenticode 簽章**，也未產生 SLSA build provenance attestation。實務影響：SmartScreen 會示警、無法驗證發行者身分、資安軟體可能誤攔。

### 中：專案年紀與治理資訊有限

repo 建立於 2026-03-15，五個月累積 2.8 萬星；6,000 次 commit 但**未公開任何測試檔**（全庫路徑搜尋 `test` 命中 0）。`SECURITY.md` 有私密回報管道，但無修補時效承諾。作者署名 `goworm`，背後實體資訊不明。

以上單獨都不構成拒絕理由，但「新專案 ＋ 高熱度 ＋ 治理資訊少」三者疊加，應採較保守的安裝方式。

### 低

- install 腳本會修改使用者層級的 PATH 環境變數
- npm 安裝管道（`@officecli/officecli`）有 `postinstall` 腳本會下載二進位檔
- 截圖功能會呼叫本機既有的 Chrome／Edge，不自帶也不額外下載瀏覽器

## 三、建議的安裝方式

**不要使用 `irm https://... | iex` 一行安裝。** 改採下列步驟：

1. 從 [GitHub Releases](https://github.com/iOfficeAI/OfficeCLI/releases) 手動下載 `officecli-win-x64.exe` 與 `SHA256SUMS`，以 `Get-FileHash -Algorithm SHA256` 比對雜湊
2. 自行放置到指定目錄，**不執行 install 腳本**（避開自動寫入 SKILL.md 與修改 PATH）
3. 首次啟動即關閉自動更新：`officecli config autoUpdate false`，並設定 `OFFICECLI_SKIP_UPDATE=1`
4. 是否安裝 SKILL.md 由使用者自行決定；要裝就先讀過內容再手動放置，並固定版本
5. 升級改為人工觸發：重跑步驟 1、比對雜湊、留意版本差異

## 四、PoC 的環境要求

- 在**全新的空目錄**進行，不要在含有客戶資料、營運數據或個資的專案目錄下執行
- 測試素材使用**去識別化或虛構的假資料**，不要拿真實營運報表當第一份測試檔
- 若該台機器的 AI agent 具有寬鬆的檔案寫入／指令執行授權，PoC 期間先收緊
- 驗收重點：產出品質、省下的工時，以及**是否有非預期的檔案寫入或網路連線**

## 五、給決策者的一句話

技術面可用、資料不外流，主要顧慮是**發布方信任與自動更新通道**，可用「手動安裝 ＋ 關閉自動更新 ＋ 沙盒 PoC」控制在可接受範圍。
