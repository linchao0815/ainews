# Prime Agent 資安評估

> 對象：[PrimeIntellect-ai/prime-agent](https://github.com/PrimeIntellect-ai/prime-agent)（MIT License）
> 起因：[20260813.md](20260813.md)「GitHub趨勢｜PrimeIntellect Prime Agent」該則新聞建議在沙盒試跑評估，導入前先做資安查核
> 評估日期：2026-08-13　評估版本：`0987c1b`（2026-08-12，package.json 標示 v0.7.2）
> 方法：shallow clone 原始碼實際檢視自我改進/持久化機制、subagent 執行架構、遙測路徑，非僅閱讀README

## 結論

Prime Agent 的「自我改進」實際上是把 prompt 筆記／memory／skill 描述／子 agent spec 以 JSON 形式讀寫到本機檔案（`~/.prime/agent/harness/harness_state.json`），並在 turn 結束時用 LLM 重寫 system prompt——**不涉及任何模型權重微調**；而「subagent 呼叫視為函式呼叫」則是真的會 fork 出一個 IPython/Jupyter kernel 執行任意 Python，且專案 README 自己明說「這不是安全沙盒，agent 以使用者權限執行 model 產生的程式碼」，預設**沒有**檔案系統或網路的隔離，需要另外手動裝範例沙盒擴充套件才有隔離。遙測本身只送匿名使用統計、可關閉，未發現外洩程式碼/prompt內容的證據；安裝是 curl\|sh 但有 SHA256 checksum 校驗（非簽章）。整體工程品質尚可（CI 齊全、測試量不小），但這是一個 8/7 才衝上 GitHub Trending 第一、v0.7.x 的新專案，穩定性與資安都還沒經過大量實戰檢驗。**建議結論：可在隔離的沙盒/VM（無公司內部網路存取、無正式 API key、無敏感 repo）中限時試用評估，但不建議在一般開發機或有權限存取內部系統的環境中直接安裝使用。**

## 一、查證通過的項目

| 項目 | 查證結果 |
|---|---|
| License | MIT（`LICENSE`：Copyright Mario Zechner 2025 + Prime Intellect 2026），無授權疑慮 |
| 遙測內容 | `packages/coding-agent/src/core/telemetry.ts`：只送 `os_family`/`architecture`/`install_method`/token 用量/耗時/錯誤分類等匿名統計到 `https://api.primeintellect.ai/api/v1/agent-analytics/events`，未見傳送程式碼、prompt 內容或檔案內容 |
| 遙測可關閉 | 支援 `DO_NOT_TRACK=1`、`PI_OFFLINE=1`、`PRIME_AGENT_TELEMETRY=0` 環境變數與 settings 開關（同檔 `isTelemetryEnabled()`） |
| 安裝完整性 | `install.sh` 對下載的 Node.js standalone 及 Prime Agent tarball 都做 SHA256 checksum 校驗（`verify_node_standalone_download`、`verify_prime_agent_package_checksum`），而非完全無驗證下載即執行 |
| API key 儲存 | `packages/coding-agent/src/core/auth-storage.ts`：憑證存於 `~/.prime/agent/auth.json`，寫入時 `chmodSync(..., 0o600)`、目錄 `0o700`，並用 `proper-lockfile` 避免多進程競態寫壞檔案 |
| CI/測試 | `.github/workflows/ci.yml`：build+check+sharded test matrix（agent-core/ai/tui/coding-agent 三分片+process smoke+kernel test），非空殼 CI；`prime-agent-runtime/test` 另有 1474 行 Python 測試涵蓋 harness/subagent registry |
| 供應鏈聲明式揭露 | README 明確自曝「executes model-generated Python and project commands with your user permissions... not a security sandbox」，屬少見的坦誠揭露，而非隱瞞 |
| 依賴套件 | 抽查 `packages/coding-agent/package.json`、`prime-agent-runtime/pyproject.toml`，主要依賴（undici、zeromq、uuid、ipykernel 等）版本均為近期穩定版，未見已知高風險/廢棄套件 |

## 二、風險項目

### 高：自我改進/持久化狀態機制缺乏邊界控制，且可污染跨 session 的全域狀態

- 持久化實作在 `prime-agent-runtime/src/rlm/harness.py`：狀態檔預設路徑為 `~/.prime/agent/harness/harness_state.json`（`global_=True`）或 `$RLM_SESSION_DIR/harness/harness_state.json`（local，`_state_file()` 第77-91行）。**寫入路徑完全由環境變數 `RLM_HARNESS_STATE_DIR`/`RLM_GLOBAL_HARNESS_STATE_DIR`/`PRIME_AGENT_CODING_AGENT_DIR` 決定，程式碼本身沒有對路徑做任何白名單或專案目錄限制**——不過因為 kernel 本來就是在 host 使用者權限下跑任意 Python，理論上 agent 本來就能用 `open()` 寫到磁碟任何有權限的位置，harness 只是其中一個「官方管道」。
- 更值得注意的是 `skill.py` 的 `reference`（`type: "python"` + `import`/`callable`）：agent 可以把「技能」定義成任意 Python import + callable，之後 `overview()` 會告訴自己「呼叫 `await <skill_import>(...)`」——換句話說，agent 可以自己寫一個 skill，把它註冊進持久化 harness，下一輪（甚至下一個 session，若 `global_=True`）就會被當作可信任的呼叫入口執行。
- `refine` skill（`packages/coding-agent/skills/refine/SKILL.md`）允許 agent 呼叫 `await refine.run(..., global_=True)`，把這次對話學到的「教訓」提升為**跨專案、跨 session 的全域 harness 條目**，且執行時機是「turn 結束後自動套用並重建 system prompt」，中間沒有看到使用者核准步驟。若某次任務被 prompt injection（例如惡意 repo 裡的檔案內容、惡意 MCP 工具回應）誤導，注入的「教訓」有機會被寫進全域 harness，之後影響同一台機器上其他無關專案的 agent 行為——這是自我改進機制中最需要留意的持久化污染面。
- 緩解因素：harness 條目本身只是文字/JSON（prompt 筆記、memory、skill 的 import 名稱），要造成實際危害仍需要 agent 之後真的執行對應程式碼；且本機檔案系統權限就是使用者自己的權限，並未跨使用者提權。

### 高：subagent「函式呼叫」= 真的 fork 出可執行任意程式碼的 IPython kernel，預設無沙盒隔離

- `packages/coding-agent/src/core/kernel/fork-server.ts` 顯示：kernel 是用 Node `spawn()` 直接啟動 Python 直譯器（`FORK_SERVER_SCRIPT`），走 fork-server 模式在 Linux 上用 `fork()` 產生子行程，非常接近直接在 host 上跑一般 Python 進程，**沒有 Docker/VM/namespace/seccomp 之類的隔離**。
- `prime-agent-runtime/src/rlm/__init__.py` 的 `rlm.run()`/`rlm()` 呼叫（README 所稱「視為 REPL 裡的函式呼叫」）透過 `host_request("rlm.run", ...)` 請求 TypeScript host 產生一個新的 Prime Agent child session——即另一整套 agent + kernel，而非受限的沙盒函式。
- README 第66行原文即明說：「Prime Agent executes model-generated Python and project commands with your user permissions. Its worker and kernel processes improve lifecycle isolation and recovery; they are **not** a security sandbox. Review changes and use trusted repositories, instructions, skills, and extensions only. Run untrusted code or instructions in an external sandbox or restricted environment.」——等於官方自己承認沒有沙盒。
- 專案內唯一的沙盒方案是 `packages/coding-agent/examples/extensions/sandbox/index.ts`，用 `@anthropic-ai/sandbox-runtime`（macOS `sandbox-exec`/Linux `bubblewrap`）做**選配的示範擴充套件**，需使用者手動複製到 `~/.prime/agent/extensions/` 並自行 `npm install` 才會生效，**預設安裝完全不會啟用**。
- 另一個沙盒相關字眼「Prime Sandboxes」（`packages/coding-agent/skills/prime-intellect/references/sandboxes.md`）其實是 PrimeIntellect 雲端付費的 Docker 沙盒服務（每核心 $0.05/hr），與本機 agent 執行環境無關，容易被誤認為「agent 本身有沙盒」。

### 中：安裝方式為 curl\|sh 一行指令，且無 GPG/簽章驗證

- README 建議安裝方式：`curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh`（`README.md` 第50-51行）。
- `install.sh` 對下載內容做 SHA256 checksum 比對（見上表），但 checksum manifest（`SHA256SUMS`、`SHASUMS256.txt`）本身也是從**同一台伺服器**下載，沒有看到獨立的 GPG 簽章或 Sigstore/cosign 驗證鏈；換言之這道檢查主要防「傳輸損毀/CDN 快取錯誤」，防不了「該伺服器本身被入侵並同時竄改二進位檔與其 checksum」這類供應鏈攻擊。

### 中：無 SECURITY.md，弱點通報管道未定義

- repo 內未找到 `SECURITY.md`（`.github/` 下只有 `dependabot.yml`、`ISSUE_TEMPLATE/`、`workflows/`），沒有正式的漏洞通報流程/PGP聯絡窗口。有 Dependabot 自動更新依賴，算是最低限度的供應鏈維護。

### 低：工具呼叫層面看不到「執行前需使用者核准」的通用機制

- 在 `packages/coding-agent/src/core` 全文搜尋 `approval`/`confirm`/`permission`/`yolo` 等關鍵字均無結果，`ipython.ts`（執行 Python 的核心工具）本身沒有內建的執行前確認步驟；是否有互動模式下的 UI 層核准（TUI 層另外處理）未能在本次時間內完整追蹤到，故標記為「未能完全驗證」——但至少可以確定：程式碼層級沒有寫死的、與工具無關的「危險操作攔截清單」，這點與 README 的坦白揭露（no sandbox、review changes yourself）是一致的：責任被明確轉嫁給使用者自行審查。

## 三、建議的安裝與使用方式

1. 不要在一般開發機或有 VPN/內網權限的機器上直接執行官方 `curl | sh` 安裝。
2. 在乾淨的一次性 VM 或容器內安裝（例如公司內部沙盒鏡像、雲端一次性 VM），該環境：
   - 不掛載任何生產憑證、SSH key、雲端 CLI profile。
   - 不能存取內部網路/VPN，只開放 PrimeIntellect API 與所需 LLM provider API 的對外連線。
   - 使用專案測試用、額度受限、可隨時撤銷的 LLM API key（不要用公司共用的正式 key）。
3. 若要更嚴謹，安裝後手動啟用 `packages/coding-agent/examples/extensions/sandbox`（`@anthropic-ai/sandbox-runtime`）擴充套件，限制 bash/IPython 對檔案系統與網域的存取範圍，而非依賴預設設定。
4. 測試期間關閉或觀察遙測：可設定 `PI_OFFLINE=1` 或 `DO_NOT_TRACK=1` 避免使用統計外流，若要驗證遙測行為則反向不設，並用網路封包截取確認送出內容與程式碼描述一致。
5. 全程使用一次性/可丟棄的測試 repo，不要把公司程式碼或機密文件放進去測試「自我改進」與 subagent 功能，尤其避免測試 `global_=True` 的 refine/harness 寫入，以免污染同機器上其他專案的全域狀態。
6. 測試完畢後整台 VM/容器直接銷毀重建，不要沿用同一份 `~/.prime/agent` 目錄進行下一輪評估。

## 四、PoC 的環境要求

- 一次性 VM 或容器（建議 Linux，因為 fork-server 加速模式只在 Linux 啟用；macOS/Windows 會走較慢但功能相同的直接 spawn 路徑）。
- Node.js ≥ 22.8、Python ≥ 3.10（`prime-agent-runtime/pyproject.toml` 要求）。
- 網路僅需可達 PrimeIntellect 網域與所選 LLM provider API；建議用出站白名單限制，其餘全擋。
- 一組獨立、額度有上限、可隨時吊銷的 LLM API key（Anthropic/OpenAI/PrimeIntellect Inference 皆可）；不使用公司正式 key。
- 測試用、非敏感的 sample repo；不要掛載任何生產資料、憑證檔（`~/.ssh`、`~/.aws` 等）。
- 若要驗證沙盒擴充：Linux 需另裝 `bubblewrap`、`socat`、`ripgrep`（`examples/extensions/sandbox/index.ts` 文件內註明）。

## 五、給決策者的一句話

這是一個工程品質尚可、但官方自己承認「不是安全沙盒、以使用者權限跑 AI 產生的程式碼」的剛爆紅新專案（v0.7.x），只適合在完全隔離、可拋棄的沙盒環境試用評估，不建議現階段接觸任何公司內部系統或機密資料。
