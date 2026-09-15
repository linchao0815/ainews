# Chat On Steroids 資安評估

> 對象：[totec448-spec/chat-on-steroids](https://github.com/totec448-spec/chat-on-steroids)（MIT License）
> 起因：使用者提供 repo 連結，要求查核其架構安全性（非既有週報條目衍生）
> 評估日期：2026-09-15　評估版本：2f9be7e（package.json version 2.1.13）
> 方法：shallow clone 原始碼實際檢視，追蹤 IPC／本機 HTTP／命令執行／檔案沙箱等關鍵資料流，非僅閱讀 README

## 結論

Chat On Steroids 是一個「Electron 主程式 + Chrome extension」的橋接器：讓使用者在 ChatGPT 網頁（Developer mode / 自訂 MCP apps）對話中，透過本機常駐的 Electron app 取得讀寫檔案、執行終端機指令、操作桌面的能力。整體架構刻意採「同機信任模型」——任何以使用者身份在本機執行的程式都能拿到 extension↔Core 的 pairing token，這點在程式碼註解中被明確承認為設計取捨，而非疏漏。在此信任模型之上，實際的安全工程做得比一般同類專案紮實：命令執行一律 `spawn(shell:false)` 並用 `-EncodedCommand`／`windowsVerbatimArguments` 避開字串拼接注入；檔案存取有逐段驗證、symlink/junction 逃逸防護的沙箱層；本機 loopback HTTP server 綁定 127.0.0.1、驗證 Host/Origin、token 用常數時間比對。**最需要決策者留意的不是程式碼漏洞，而是產品本質**：一旦使用者顯式啟用 `exec_command` 或桌面操作能力，ChatGPT 對話（其輸入可能來自被讀取的檔案內容或網頁內容）就成為能觸發本機任意命令執行的入口——這是功能設計，但等同把「prompt injection 風險」直接映射成「本機系統風險」。

## 一、查證通過的項目

1. **License 為 MIT**，可自由使用/修改/商用，無額外授權限制條款。
2. **命令執行避開字串拼接注入**：`src/main/exec.ts` 的 `spawn()` 一律 `shell: false`；PowerShell 走 `-EncodedCommand`（UTF-16LE base64）而非命令列拼接；cmd.exe 用 `windowsVerbatimArguments` 搭配明確引號包裝，並在程式碼註解說明理由。
3. **高風險能力預設關閉**：`exec_command` 工具透過 `reg.guarded('command', 'exec_command', ...)` 閘控，需使用者在設定中顯式勾選啟用才可用，並非開箱即用。
4. **環境變數過濾**：傳給子行程的環境變數會過濾掉 `OPENAI_API_KEY`／`CLOUDFLARED_TOKEN` 等本工具自身機敏變數，避免被不需要它的子行程存取到。
5. **檔案沙箱實作嚴謹**：`src/main/sandbox.ts` 逐段驗證路徑（拒絕 `..`、null byte、control char、Windows 保留裝置名、ADS `:`），並用 `fs.realpath` 對最終路徑做規範化比對防 symlink/junction 逃逸，連「approved folder 本身被替換成 junction」的情境都有二次校驗（`realRoot` containment check）。
6. **Electron IPC 邊界正確**：`src/preload/index.ts` 用 `contextBridge.exposeInMainWorld` 只暴露具名函式包裝，`ipcRenderer` 本身未暴露給 renderer；`src/main/ipc.ts` 每個 channel 都用 zod schema 驗證輸入，沒有可傳任意路徑/指令字串的通用 channel。
7. **本機 HTTP server 有實質認證**：Bridge／MCP server 皆明確綁定 `127.0.0.1`；驗證 Origin 必須是 `chrome-extension://`（拒絕任何 `http(s)://` 來源，可防瀏覽器發起的 DNS rebinding 攻擊）；另做 Host header 驗證；token 用 `timingSafeEqual` 常數時間比對，存於加密 secret storage 而非明文設定檔。
8. **Extension 內部訊息驗證**：MAIN world ↔ isolated world 的 `postMessage` 都檢查 `event.source === window && event.origin === location.origin` 並搭配 nonce，非對任意網頁開放。

## 二、風險項目

### 高（設計層面，非漏洞）：同機信任模型 = 任何本機程式都能取得 pairing token

`extension/background.js` 註解明確承認「任何在此機器上以此使用者身份執行的程式都能取得 token」是刻意接受的風險。也就是說，此工具的安全邊界止於「作業系統使用者帳號」——如果同一台機器上已有其他惡意軟體以同一使用者身份執行，該惡意軟體理論上能冒充 extension 取得本機 Core 的能力（讀寫已核准資料夾、視情況執行指令）。這與該工具「本機 ChatGPT 代理人」的產品定位一致，是設計取捨而非 bug，但企業評估時必須當作既定事實：**不建議在多使用者共享機器或已知有其他不受信任軟體的裝置上安裝**。

### 中：`exec_command` 啟用後，ChatGPT 對話內容成為本機任意命令執行的觸發源

一旦使用者顯式啟用此能力，模型依對話（可能包含來自檔案內容、網頁內容的間接輸入）決定要執行的指令字串，即具備了 prompt injection → 本機命令執行的路徑。工具本身對「指令從哪來、該不該執行」沒有語意層的把關（也不可能有，這是模型代理的本質），只能防住「字串拼接注入」這類實作層漏洞，防不住「模型被騙去下真實但有害的指令」。README 也提示「Shell commands run with your normal user privileges」。

### 中：安裝檔未簽章／未公證

README 自承 Windows 版本未經 publisher 簽章、macOS 版本未簽章未 notarize（beta 階段），要求使用者自行核對 release checksum。缺乏 OS 層級的來源驗證機制，增加惡意冒充安裝檔（例如透過釣魚連結散布偽造安裝包）被使用者誤裝的風險，尤其 Windows SmartScreen／macOS Gatekeeper 的預設保護在此會被繞過或跳出警示但仍可被使用者忽略安裝。

### 低：Linux AppImage 在受限環境下 fallback 到 `--no-sandbox`

README 提到當 unprivileged user namespace 被停用時，AppImage 啟動器會退回 `--no-sandbox`，降低 Chromium/Electron 沙箱保護層級。官方建議優先使用 DEB 套件安裝以避免此情境。

## 三、建議的安裝與使用方式

1. 只在**個人專用、無其他不受信任軟體**的裝置上安裝，避免多使用者共享機器或高安全需求環境（對應同機信任模型的風險）。
2. 安裝前**核對官方 release 頁面提供的 checksum**，尤其 Windows/macOS 未簽章／未公證版本。
3. **approved folders 只核准真正需要的資料夾**，不要核准整個磁碟或使用者主目錄，降低 sandbox 邊界萬一被突破時的曝險範圍。
4. **預設不啟用 `exec_command` 與桌面操作能力**；若業務需求必須啟用，需向使用者明確說明「ChatGPT 對話內容（含間接輸入，如被讀取檔案或瀏覽器頁面內容）可能誘發非預期的本機指令執行」這個風險，並避免在此模式下開啟含不受信任內容的檔案／網頁。
5. Linux 環境優先使用 DEB 套件，避免 AppImage 在受限環境下 fallback 到 `--no-sandbox`。

## 四、PoC 的環境要求

- Windows 10/11、macOS 13 Ventura+、或現行桌面 Linux（DEB 優先）。
- Chrome 116+ 或現行 Edge，且 ChatGPT 帳號／workspace 需開通 Developer mode 與自訂 MCP apps（需先向 OpenAI 確認帳號可用性）。
- 一台**非共享、非機敏**的測試裝置，approved folders 僅指向低機敏度的測試資料夾。

## 五、給決策者的一句話

這是一個工程上把「本機信任範圍」設計得相對嚴謹的 ChatGPT-to-local-system 橋接器（路徑沙箱、指令執行安全化、loopback 認證都有紮實實作），但本質上仍是「同機信任模型」加上「可選的任意命令執行」——啟用高風險能力前，先確認裝置乾淨、approved folders 範圍夠小，並理解一旦啟用 `exec_command`，ChatGPT 對話就等同擁有你使用者身份的終端機。
