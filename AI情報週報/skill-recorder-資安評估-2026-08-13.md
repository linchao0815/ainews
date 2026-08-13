# Skill Recorder 資安評估

> 對象：[microsoft/skill-recorder](https://github.com/microsoft/skill-recorder)（MIT License）
> 起因：[20260813.md](20260813.md)「GitHub趨勢｜微軟Skill Recorder」該則新聞建議企劃/運營試錄評估，導入前先做資安查核
> 評估日期：2026-08-13　評估版本：`c7f2fe4`（release/0.5.0 merge，main HEAD）
> 方法：shallow clone 原始碼實際檢視錄製內容儲存、Analyze/Build 階段資料外送路徑、敏感資料遮蔽機制，非僅閱讀README

## 結論

Skill Recorder 是一支**螢幕＋視窗切換＋剪貼簿＋（選用）語音全程錄製工具**，本機錄製、Copilot 雲端分析。它不是鍵盤側錄器（未發現任何 keylogger），錄製內容也**不會**在錄製當下外流；只有使用者主動按下「Analyze」才會把時間軸事件、螢幕截圖與語音轉錄文字送到 GitHub Copilot 雲端服務做分析。專案內建一層「Advanced protection」（預設開啟，可一鍵關閉）在文字面用 secretlint + 結構化 PII 偵測器遮蔽 email/信用卡/SSN/電話/API金鑰/JWT，在畫面面用 on-device OCR 模糊比對到的敏感字串再送出。

但實測程式碼發現一個**具體的遮蔽漏洞**：Advanced protection 只套用在「Analyze」（Describer）階段的 `get_timeline`/`get_events`/`get_narration` 工具（`electron/describer/tools.ts` 內呼叫 `redact()`）；但使用者按下「Create」產生 Skill／Automation 時，Skill Builder／Automation Builder 共用的 `get_timeline`（`electron/builders/read-tools.ts`）**直接讀取未經遮蔽的 `bundle.json` 原始資料**（視窗標題、URL、終端指令、剪貼簿計數）送給 Copilot 雲端，沒有呼叫任何 redact 函式。也就是說即使使用者在 Analyze 階段依賴「Advanced protection」把密碼/token 遮起來，Build 階段仍可能把同一份未遮蔽資料再送一次到雲端。這是本評估最重要的技術性發現，建議在正式導入前要求發包方/上游修補或以流程規避（見第二節）。

密碼欄位本身**沒有**任何技術層面的自動排除（無 input type=password 偵測、無應用程式白名單/黑名單），僅靠錄製前的一次性警示對話框（純 UX 提醒），敏感資料排除完全依賴使用者自律 + 事後的文字/OCR 掃描補救。整體工程品質（安裝腳本簽章/雜湊驗證、沙箱化工具、CI、測試覆蓋）偏高於一般 GitHub 新專案，但這仍是 0.5.0、成立不久的專案，**不建議未經上述缺口修補與流程管控前，用真實客戶/內部機敏畫面試錄**；可用「假資料」場景做 PoC。

## 一、查證通過的項目

- **本機儲存路徑明確、不會偷偷上雲**：錄製資料存於 `app.getPath("userData")/sessions/<id>/`（`electron/recorder/session-store.ts:15`），包含 `session.json`、`events.jsonl`、`frames/`、`video`、`narration.json`。純本機檔案系統寫入，錄製過程中無任何網路呼叫（README 亦明載「Recording…all happen on your computer; nothing leaves while you record」，程式碼與其一致）。
- **無鍵盤側錄（keylogger）**：全 repo（`electron/`、`common/`）搜尋 keydown/keystroke/keylog 均無匹配；捕捉的是視窗切換、瀏覽器 URL（`electron/collectors/`）、剪貼簿「預覽」（非全文，`common/sensitive.ts` 文件註解稱其為 clipboard previews）、螢幕影片/低速快照（Chromium 錄製），以及選用的語音。
- **語音轉錄是 on-device**：README 及 `electron/narration/whisper.ts` 顯示用 Whisper 模型本機轉錄（首次使用下載約 252MB 模型），轉錄文字不外送，除非使用者按 Analyze。
- **Analyze 階段的資料外送路徑可讀、可稽核**：`electron/describer/describer.ts` 透過 `@github/copilot-sdk` 以 stdio 方式啟動**本機 bundled** 的 `@github/copilot-{platform}-{arch}` 二進位（`electron/copilot-cli-path.ts`），不是直接 HTTP 呼叫；該 CLI 再由 GitHub 官方通道與 Copilot 雲端通訊（其安全模型屬 GitHub Copilot CLI 本身的信任邊界，不在本 repo 範圍）。工具集合白名單化（`availableTools: tools.map(t=>t.name)`），並註明「若 runtime 無法遵守白名單就直接失敗，而非默默開放完整工具集」（`describer.ts:269-276`），設計上有意識地做沙箱化。
- **具體外送內容可對應到程式碼**：`electron/describer/tools.ts` 的 `getTimeline`/`getEvents`/`getNarration` 回傳 JSON 文字（時間軸、事件、語音逐字稿），`getFrames` 把螢幕截圖以 base64 JPEG **原圖**方式作為 `binaryResultsForLlm` 附加送出（`tools.ts:285-322`）——確認「不只文字描述，實際畫面截圖本身會外送」。
- **Advanced protection 機制真實存在且預設開啟**：`electron/ipc.ts:167-212` 顯示 `sensitiveModels.isAdvancedEnabled()` 預設為 true，關閉是使用者主動的單一 opt-out；開啟時文字用 secretlint（`@secretlint/core`，偵測 private-key/api-key/jwt/password）+ 結構化 PII 偵測器（`common/sensitive.ts`：email、Luhn 驗證信用卡、SSN、電話）遮蔽，畫面用 on-device OCR（tesseract.js）比對命中值後模糊（`electron/sensitive/frame-redact.ts`）。掃描失敗時**保守處理**：文字面放行未遮蔽（有 log warning），但畫面面直接 withhold（不送任何 frame），避免掃描器故障導致畫面裸奔外流（`ipc.ts:203-211`）。
- **安裝方式無「來路不明二進位」**：`install.sh`/`install.ps1` 是「原始碼建置」腳本，非下載預編譯 App；Node.js runtime、Electron runtime、`package-lock.json` 全部做 SHA-256 校驗並與官方發佈雜湊比對（`install.sh:127-197`、`330-357`），Windows 版另外用 `Get-AuthenticodeSignature` 驗證 Electron/Node 執行檔簽章（`install.ps1:243-248`）。安裝要求指定 40 字元 commit SHA，等同鎖定確切版本，降低供應鏈竄改風險。
- **無內建遙測 SDK**：`package.json` 依賴清單中無 telemetry/analytics/appinsights/sentry 類套件；`electron/logger.ts` 僅為本機 log，其註解「Replaced/extended when telemetry lands」顯示遙測**尚未**存在但未來可能加入（見風險項）。
- **License / SECURITY 合規**：MIT License；`SECURITY.md` 為標準 Microsoft repo 樣板，導向 `aka.ms/SECURITY.md` 協調式漏洞通報流程，不接受 public issue 揭露漏洞。CI 存在 3 條 GitHub Actions workflow（`non-windows.yml`/`portable.yml`/`windows.yml`），本機發現 29 個 `*.test.ts` 測試檔，涵蓋 sensitive 偵測、frame redaction、crash guard、session 邊界、skill placement 等關鍵路徑，並有獨立的 `evals/` fixture-based 評測套件檢驗 describer/builder 品質。

## 二、風險項目

### 高：Build（Skill/Automation 產生）階段繞過了 Analyze 階段的敏感資料遮蔽

- **證據**：`electron/describer/tools.ts` 的 `getTimeline` 對輸出呼叫 `redact(JSON.stringify(view, null, 2))`（第122行）；但 `electron/builders/read-tools.ts`（被 `electron/skillbuilder/tools.ts` 與 Automation Builder 共用）的 `getTimeline`（第62-90行）**直接** `JSON.stringify(view, null, 2)` 回傳，未呼叫任何 redact 函式，也沒有從呼叫端（`electron/skillbuilder/builder.ts`）注入 `RedactionContext`。
- **影響**：使用者若仰賴「Advanced protection」在 Analyze 階段遮蔽視窗標題/URL/終端指令/剪貼簿中的機敏字串，一旦進入「Create Skill/Automation」流程，同一份 `bundle.json`（含視窗標題全文、完整 URL、終端指令、剪貼簿計數）會**未經遮蔽**地透過 `get_timeline` 再送一次到 GitHub Copilot 雲端。這與 README「Analyze 前都會提醒你」的使用者心智模型不符——使用者可能誤以為第一次 Analyze 已把敏感內容擋下，實際上 Build 階段是另一條未受保護的外送路徑。
- **建議**：導入前要求上游修補（在 `read-tools.ts` 加上與 describer 相同的 redaction 注入），或流程上規避：**Build 階段前手動複查/編輯 analysis 文字**，且避免對含有真實機敏視窗標題/URL 的 session 執行 Create；短期內把這條 gap 回報給專案（SECURITY.md 走 `aka.ms/SECURITY.md` 協調揭露流程，不要開 public issue）。

### 中：敏感資料排除完全依賴使用者自律，無任何欄位層級技術遮蔽

- `src/RecordingPrivacyWarning.tsx` 只是一次性提醒對話框（純文字警語＋「查看確切擷取內容」按鈕），`src/RecordingPrivacyWarning.tsx`/`electron/recording-privacy.ts` 沒有任何 password-input 偵測、應用程式黑名單、視窗排除清單。錄製「螢幕影片」時，密碼輸入框、公司內部系統畫面、他人聊天視窗等一律照錄不誤，只能靠：(a) 使用者自己不要把敏感畫面留在螢幕上，或 (b) 事後 Analyze 階段的 OCR-比對-模糊（且如上所述僅覆蓋 Analyze，不覆蓋 Build）。
- OCR 比對式模糊只對**已知匹配到的字串**（secretlint 規則 + 結構化 PII 正則）生效；對公司內部儀表板、客戶資料表格、非結構化機敏文字（例如合約內文、員工姓名+薪資組合）等**不會**自動偵測與模糊，因為這些不落在 email/信用卡/SSN/電話/私鑰/JWT/密碼 的偵測範圍內。換言之「Advanced protection」是防「外洩憑證/個資」的安全網，不是防「洩漏商業機敏內容」的機制。
- 剪貼簿只存「預覽」（`common/sensitive.ts` 文件註解：clipboard previews），推測有長度截斷，但仍是明文儲存於本機 `events.jsonl`，且未加密（見下）。

### 中：本機錄製檔案未加密，且無自動保留期限/清除機制

- `session-store.ts`/`sessions.ts` 顯示所有錄製產物（`events.jsonl`、`session.json`、影片、frames、narration.json、`bundle.json`、`analysis.json`）皆以**明文**寫入使用者 profile 目錄下的 `sessions/`，沒有看到任何 at-rest 加密（無 DPAPI/keychain/加密庫呼叫）。若企業筆電遺失、被植入惡意軟體，或多人共用同一 OS 帳號，這些包含視窗標題全文、URL、剪貼簿內容、螢幕畫面的檔案可被直接讀取。`deleteSession()`（`sessions.ts:210-213`）僅在使用者手動刪除 session 時才會清除，沒有找到自動過期/自動清空機制。

### 低：Skill/Automation 產出檔可能意外夾帶錄製過程出現的機敏字面值

- `common/values.ts` + `electron/skillbuilder/tools.ts` 的 `propose_plan` 顯示 Skill Builder 代理人會從錄製內容中萃取「固定字面值」（URL、路徑、repo slug、常數）直接寫死進 `SKILL.md`／`automation.json`（以 `{{id}}` token 取代並在最終渲染時代入字面值）。這些值來自模型對 `get_analysis`/`get_timeline` 的判斷，雖然介面上使用者可在核准前編輯每個「pill」，但若使用者沒有逐一檢查，介面設計並未強制阻擋模型把「一次性看似固定、實則含敏感資訊」的值（如內部系統 URL 中夾帶的 token 參數、特定帳號路徑）寫死進最終產出檔案——而該檔案是設計用來被分享／重複執行的成品，風險比一次性 session 記錄更持久。

### 低：GitHub Copilot CLI 登入走互動式 terminal，屬第三方信任邊界

- `electron/copilot-signin.ts` 只是開一個終端機視窗執行 bundled Copilot CLI 的 `login` 指令，實際的 OAuth/裝置碼登入與後續 token 保存屬於 GitHub Copilot CLI 自身（超出本 repo 範圍，但企業導入前應一併確認 org 的 Copilot 政策：資料保留、模型訓練使用權、地區合規等，這些不是 Skill Recorder repo 本身能保證的）。

### 低（前瞻）：目前無遙測，但程式碼註解顯示未來計劃加入

- `electron/logger.ts` 註解「Minimal tagged logger. Replaced/extended when telemetry lands.」——代表現在沒有遙測，但需在後續版本升級時重新查核是否加入了新的資料回傳通道。

## 三、建議的安裝與使用方式

1. 依 `INSTALL.md`／README 使用 `install.sh`/`install.ps1`，**務必**顯式指定 40 字元 release commit SHA（不要用未鎖定版本的指令），讓 Node/Electron 雜湊校驗生效。
2. 導入前先在乾淨、非生產帳號的機器上以**假資料場景**（見第四節）試錄，不要用任何真實客戶/內部系統畫面。
3. 在企業導入前，正式向專案回報「Build 階段繞過 Analyze 階段遮蔽」這個 gap（`aka.ms/SECURITY.md` 協調揭露管道），並在修補前，內部流程上規定：**Create Skill/Automation 前，人工審閱 Analysis 逐字稿與 timeline，確認沒有殘留機敏視窗標題/URL/指令**，才可繼續。
4. 若必須錄製含真實工作畫面的 session：關閉不必要的通知/聊天視窗、密碼輸入一律用密碼管理員的自動填入且**暫停錄製**（目前沒有自動偵測輸入框機制，需人工暫停/繼續錄製），並在 Analyze 前用「See exactly what's captured」自行檢視一次。
5. Session 資料夾（`userData/sessions/`）建議放在已用 BitLocker/FileVault 等全磁碟加密保護的磁碟；用完的 session 主動刪除，不要長期留存明文錄製檔。
6. 確認公司的 GitHub Copilot 授權方案之資料保留/訓練使用條款，因為 Analyze/Build 兩階段的實際資料處理者是 GitHub Copilot 雲端，不是 Skill Recorder 本身。

## 四、PoC 的環境要求

- macOS（主要支援平台）或 Windows 11 x64/ARM64（README 標注「Windows 11 is supported too，見 WINDOWS-VALIDATION.md」）；Ubuntu 也有 install.sh 分支但非主打平台。
- Node.js 24（安裝腳本會自動下載校驗過的可攜式 runtime，不需預先安裝，但建置本機仍需 `curl`/`tar`（macOS/Linux）或 PowerShell（Windows））。
- 具備 Copilot access 的 GitHub 帳號（Copilot CLI 隨 App 附帶，首次 Analyze 才要求登入）。
- macOS 需授予「螢幕錄製」系統權限；Windows 需求詳見 `WINDOWS-VALIDATION.md`。
- 建議在非生產、非公司網域帳號、乾淨測試環境執行 PoC，並只用人為捏造的假資料場景（見第三節第2點）。

## 五、給決策者的一句話

這是一支「本機錄、雲端析」的螢幕自動化工具，工程品質不錯（安裝簽章/雜湊、沙箱化 Copilot 工具、預設開啟的敏感資料遮蔽），但實測發現 Build 階段會繞過 Analyze 階段的遮蔽再送一次原始視窗/URL/指令資料到雲端、且密碼欄位無技術層面自動排除——在此缺口修補或流程管控到位之前，只建議用假資料試錄 PoC，不建議直接拿真實客戶或內部機敏畫面錄製分析。
