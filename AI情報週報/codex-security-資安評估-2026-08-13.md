# Codex Security 資安評估

> 對象：[openai/codex-security](https://github.com/openai/codex-security)（Apache License 2.0）
> 起因：[20260813.md](20260813.md)「主推工具動態／資安｜OpenAI Codex Security」該則新聞提到目前僅限核准客戶使用，這裡查核其資料流向與存取限制的實際情況
> 評估日期：2026-08-13　評估版本：5c26297（2026-08-12）
> 方法：shallow clone 原始碼實際檢視程式碼掃描資料流向、認證機制、存取限制 gate，非僅閱讀 README

## 結論

Codex Security 本質是一個「本機 CLI 外殼 + OpenAI Codex CLI/SDK（`@openai/codex` 0.144.6）」的包裝器：它不會自己組 HTTP request 把程式碼傳給 OpenAI，而是把整個 repo 的檔案系統存取權交給本機啟動的 Codex agent（`codex startThread`），由該 agent 依 `codex_security_scan` 這個「唯讀＋輸出目錄可寫」的檔案系統 profile 讀取原始碼、把片段放進對話內容，再透過 Codex 既有的 Responses API 送往 OpenAI 後端做分析——也就是說，**掃描到的原始碼內容範圍等於「Codex agent 認為要讀的所有檔案」，沒有固定的「只傳 diff 摘要」保證**。認證與憑證儲存完全委派給 `codex` 子行程本身（`codex login` / `auth.json`），此 repo 只加了一層本機檔案權限鎖（chmod 700 / Windows ACL）與「輸出目錄不得落在被掃 repo 內」的強制檢查。最關鍵的一點：程式碼裡確實有一個**伺服器端即時查核的存取限制閘門**——每次掃描開始都會呼叫 MCP 工具 `get_tac_status`（Trusted Access for Cyber），若帳號/組織未獲核准，狀態為 `not_granted` 時用戶端不會硬擋掃描本身，而是由 OpenAI 後端在該次請求中拒絕產出「部分資安請求或受保護的漏洞細節」。換句話說：**裝了 CLI、設了 API key 就能跑掃描動作，但沒有核准資格時，敏感的漏洞分析結果會被後端擋下**，這與新聞所述「僅限核准客戶」的說法一致，且該閘門是活的伺服器查核而非本機寫死的假閹割。

給決策者的建議：可以先用取得 Trusted Access 核准的帳號在**低機敏度、可公開的測試 repo**上小規模 PoC，驗證輸出品質與資料treatment；在正式核准與合約條款（尤其資料保留/訓練排除）落地前，不建議把公司真正機敏的原始碼餵給它。

## 一、查證通過的項目

1. **License 為 Apache-2.0**，`sdk/typescript/LICENSE` 與根目錄 `LICENSE` 一致，可自由使用/修改/商用，無額外授權限制條款。
2. **SECURITY.md 明確揭露威脅模型**：明講「Codex Security 以你本機 OS 帳號執行」「只掃你信任且有權限評估的 repo」「掃描 subprocess 可能繼承你的環境變數，workbench 只會移除 `OPENAI_API_KEY`/`CODEX_API_KEY`，其他如 `GITHUB_TOKEN`、`AWS_SECRET_ACCESS_KEY` 不會被移除」——這是一個誠實且具體的風險揭露，而非行銷式安全聲明。
3. **CI 用 `OPENAI_API_KEY`／`CODEX_API_KEY` 的處理方式有原始碼佐證**：README 明寫「Environment API keys are passed directly to the current scan and are never stored in Codex's credential home or system keyring」；`sdk/typescript/src/runtime.ts` 的 `runWorkbench()` 在呼叫本機 Python workbench 腳本時，會把 `OPENAI_API_KEY`／`CODEX_API_KEY`／`OPENROUTER_API_KEY`／`FIREWORKS_API_KEY` 從傳給子行程的環境變數中過濾掉（第 1284-1296 行），確保這把 key 不會被不需要它的本機腳本存取到。
4. **掃描結果輸出目錄有主動的路徑防護**：`api.ts` 的 `requireOutputOutsideRepository()`（配合 `OutputInsideProtectedRootError`）會在多個路徑（output dir、runtime home、暫存目錄、scan dir）強制檢查輸出不得落在被掃描 repo（`protectedRoot`）之內，若使用者手動指定 `--output-dir` 到 repo 內會直接丟錯，而非提示但仍執行。預設情況下（未指定 `--output-dir`）輸出落在系統 tmp 目錄下的 `codex-security-<repo>-<random>` 目錄，不落在 repo 樹內。
5. **本機憑證/狀態目錄有實際的檔案權限強制**：`codexSecurityCredentialHome()` 建立於 `$CODEX_HOME/state/plugins/codex-security/codex-home`，建立時 `mkdir(..., mode: 0o700)`，並有 `requireSecureCredentialHome()`／`requirePrivateCredentialFile()` 在每次使用前重新核驗目錄非 symlink、權限非 0o077、擁有者為目前使用者；Windows 上另有一整套用 `icacls`/PowerShell `Get-Acl` 做 DACL 檢查與修復的邏輯（`inspectWindowsCredentialAcl` 等，runtime.ts 第 280-990 行），比一般 CLI 常見的「裸寫檔案」做法嚴謹。
6. **依賴套件精簡且來源可信**：`sdk/typescript/package.json` 的 `dependencies` 只有 12 個套件（`@openai/codex`、`@openai/codex-sdk`、`@octokit/core`、`ajv`、`extract-zip`、`smol-toml` 等常見、維護中的套件），沒有發現可疑或不明來源的相依套件。

## 二、風險項目

### 高：程式碼內容外送給 OpenAI 的具體範圍不是「只送 diff 摘要」，而是「Codex agent 讀到的一切」

實際資料流向（依原始碼追出）：

1. `codex-security scan .` 呼叫 `sdk/typescript/src/api.ts` 的 `CodexSecurity.run()`。
2. 它用 `@openai/codex-sdk`（同版本 0.144.6，OpenAI 自家 Codex SDK）的 `Codex.startThread({ workingDirectory, skipGitRepoCheck, approvalPolicy: "never" })` 在**本機**啟動一個 Codex agent 執行緒（`api.ts:132-138`）。
3. 傳給這個 thread 的不是原始碼本身，而是一段自然語言 prompt（`scanPrompt()`，`api.ts:2221` 起），內容大致是「用 `$CODEX_SECURITY_PLUGIN_ROOT/skills/<skillName>/SKILL.md` 這個 skill，非互動執行這次掃描」。
4. 真正讀檔、送內容給模型的動作，是由 Codex agent 依照 bundled plugin 裡的 skill（`sdk/typescript/_bundled_plugin/skills/security-scan/SKILL.md` 等）與其背後的 Python 腳本（如 `scripts/workbench_source_excerpt.py`、`scripts/generate_in_scope_files.py`）自主決定要讀哪些檔案、讀多少內容，再把這些內容放進與模型的對話（本質上就是 Codex CLI 既有的「讀檔 tool call → 內容進 context → 送 Responses API」流程），走 OpenAI 的 Responses API 端點（此 repo 未直接寫死 endpoint URL，因為底層 HTTP 呼叫在 `@openai/codex` 執行檔內，不在這個 TypeScript SDK 原始碼範圍內）。
5. `SCAN_PERMISSION_PROFILE = "codex_security_scan"`（`api.ts:297`）這個檔案系統 profile 允許「讀本機檔案系統」＋「寫入 workspace root 與選定的 scan 狀態目錄」，`approvalPolicy: "never"` 代表**掃描期間不會逐一詢問使用者是否可以讀某個檔案**——只要 agent 判斷需要，就會讀。

**結論**：沒有「只送函式簽章」「只送 diff」這種硬性資料極小化保證；規模與範圍完全取決於 Codex agent 對「掃描這個目標所需資訊」的判斷，對於大型 monorepo 或深度模式（`--mode deep`）掃描，實務上可能觸及相當比例的原始碼被送進 OpenAI 的模型服務。SECURITY.md 也承認這件事是設計上「本機以你的 OS 帳號執行」的一部分，並非產品邊界——換言之，這是**設計選擇而非 bug**，但企業評估時必須把「掃描 = 把公司原始碼片段送去 OpenAI 服務分析」當作既定事實，而非可調整的細節。

### 中：CI 環境 `OPENAI_API_KEY` 管理依賴使用者自律，非強制沙箱

`docker/entrypoint.sh` 只處理 `GH_TOKEN`/`GITHUB_TOKEN`（設定 git credential helper），並未對 `OPENAI_API_KEY` 做任何特殊處理——它單純作為一般環境變數傳給 `codex-security` 執行檔，再由其傳給 `codex` 子行程。SECURITY.md 明白寫「Scan and workbench subprocesses can inherit your environment... Other variables, such as `GITHUB_TOKEN` or `AWS_SECRET_ACCESS_KEY`, can remain available to local subprocesses. Run a scan with only the environment credentials it needs.」——即官方自承：**除了 workbench 腳本會過濾 4 個已知的 model-provider key 外，其餘機敏環境變數（含 CI 常見的雲端憑證）預設會被子行程繼承**，需要使用者自己在 CI job 層級把不必要的 secret 排除，工具本身不會幫你做 least-privilege 隔離。

### 中：本機掃描結果的存放位置未強制加密，仍可能被意外納入版控

掃描歷史（scan history / workbench sqlite、findings 等）預設存放在 `CODEX_SECURITY_STATE_DIR`（預設 `$CODEX_HOME/state/plugins/codex-security`），這是 repo 之外的路徑，且 `requireOutputOutsideRepository` 已經擋掉「輸出目錄落在被掃 repo 內」這條路——但如果使用者主動用 `--output-dir` 指到一個**在別的 repo 裡**的路徑（例如把多個專案的掃描結果都收斂進某個「內部工具/文件」repo 的子目錄），程式碼裡並沒有檢查「輸出目的地是否本身也是另一個受版控管理的目錄」，仍要靠使用者自行留意 `.gitignore`。findings/報告內容可能包含具體弱點細節與程式碼片段（`sdk/typescript/_bundled_plugin/examples/completed-scan/findings.json` 範例即含檔案路徑與片段結構），一旦誤 commit 到公開或权限過寬的 repo，等同公開揭露內部漏洞情資。

### 低：Verbose 診斷日誌可能含機敏資料

README 自承：「Verbose diagnostics may contain sensitive data. Review local logs before sharing them.」雖然「已知認證格式」的字串會被過濾，但這只是啟發式，不是完整的資料分類/遮罩機制。

## 三、建議的安裝與使用方式

1. 先向 [chatgpt.com/cyber](https://chatgpt.com/cyber)（個人／`tac1`/`tac2`）或 [openai.com/form/enterprise-trusted-access-for-cyber](https://openai.com/form/enterprise-trusted-access-for-cyber/)（組織／API key）申請 Trusted Access for Cyber，取得核准後再評估，否則掃描很可能拿到殘缺或被拒絕的結果，浪費 PoC 時間。
2. 用**獨立、非公司正式 API 帳號／獨立 API key**做 PoC，並在該 key 的 OpenAI 帳號設定中確認資料保留/是否用於訓練的政策（此 repo 本身管不到這件事，是 OpenAI 帳戶層級設定）。
3. PoC 先選一個**低機敏度、可公開或已開源**的內部 repo（例如工具腳本、非核心業務邏輯），不要一開始就對核心產品程式碼跑 `--mode deep`。
4. CI 整合時，`OPENAI_API_KEY` 之外的其他 secret（`GITHUB_TOKEN` 例外，工具本身需要它做 clone）應該用「只給這個 job 用的最小權限 token」，並在 job 層級（非工具層級）確保沒有多餘機敏環境變數被繼承進這個容器。
5. `--output-dir` 一律指向與任何版控 repo 無關的獨立路徑（例如專用的加密儲存磁碟區），不要圖方便指到某個內部文件 repo 底下再手動 `.gitignore`。

## 四、PoC 的環境要求

- Node.js 22.13.0+（22.x 線）、24.x 或 26.x；Python 3.10+（bundled plugin 的 workbench 腳本需要）。
- 已取得核准的 Trusted Access for Cyber 資格（個人或組織二選一）。
- `OPENAI_API_KEY` 或 `CODEX_API_KEY`（CI／非互動）或 `codex-security login` 的 ChatGPT 登入（互動）。
- 若走容器化批次掃描：`compose.yaml` / `Dockerfile` 提供的官方映像，Ubuntu host 上需留意 `docker/codex-security-seccomp.json`、`compose.apparmor.yaml` 這類額外沙箱設定，用以在 unprivileged user namespace 受限的主機上仍能跑 Codex 的檔案系統 sandbox。
- 一個低機敏度、可犧牲的目標 repo（見上一節建議）。

## 五、給決策者的一句話

這是一個「幫你把原始碼交給 OpenAI 分析的正規化外殼」，安全工程做得比一般同類 CLI 認真（本機權限鎖、輸出路徑防護、金鑰過濾都有實作），但目前仍卡在伺服器端 Trusted Access 核准門檻——先申請核准、先拿非核心程式碼小規模驗證,核准與資料保留條款未到位前不要拿機敏原始碼下去跑。
