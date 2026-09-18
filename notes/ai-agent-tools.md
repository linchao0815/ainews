# AI Agent 工具筆記

收藏的 AI agent / 工具相關分享。新項目請往下附加。

---

## Jev：競品廣告策略拆解 Agent

- **加入日期**：2026-09-18
- **來源**：Jev（社群貼文，作者暱稱）
- **內容摘要**：一個能大規模掃描競品廣告的 AI agent。單次執行約 40 秒，拆解 37 個品牌、724 支正在投放的廣告，成本約 $0.09（token 費用）。
- **分析維度**：不只是抓廣告素材，而是拆解成完整的競品廣告策略框架：
  1. **Hook**：開場怎麼抓注意力
  2. **Format**：用了什麼廣告形式
  3. **Offer**：拿什麼誘因轉換
  4. **CTA**：最後要你做什麼
  5. **Awareness Stage**：廣告打在哪個認知階段
  6. **Landing Page**：廣告跟落地頁有沒有對上
- **重點觀察**：競品廣告研究正在從「人工逐支看、逐品牌整理」，轉變為「把整個 category 當成 dataset，即時掃描整個市場」。
- **備註**：原始貼文內容保留如下。

```
這東西有點誇張

40 秒，直接拆完 37 個品牌、724 支正在投放的廣告

而且不是只幫你抓廣告素材，而是直接把整個競品廣告策略拆開：

① Hook：開場怎麼抓注意力
② Format：用了什麼廣告形式
③ Offer：拿什麼誘因轉換
④ CTA：最後要你做什麼
⑤ Awareness Stage：廣告打在哪個認知階段
⑥ Landing Page：廣告跟落地頁有沒有對上

最扯的是，跑完這一輪分析只用了大約 $0.09 的 token

以前做競品廣告研究，是一支一支看、一個品牌一個品牌整理

現在 Agent 可以直接把整個 category 當成 dataset 來分析

Competitive research 正在從「人工做功課」，變成「即時掃描整個市場」
```

### Jev 是什麼？（查證後補充說明）

- **加入日期**：2026-09-18
- **修正**：Jev 並非貼文作者暱稱，而是背後驅動這類分析的 **AI 模型本身**的名字。

**一句話版本**：Jev 不是一個會跟你聊天的 AI，而是一個專門「幫你的程式快速做判斷題」的 AI 模型——你丟一堆資料進去、開一串是非/選擇題，它幾乎瞬間、幾乎免費地把每一題答案吐回來。這也解釋了為什麼能在 40 秒內把 724 支廣告、6 個維度全部拆解完，只花 $0.09。

**背景**：由前 OpenAI 研究員、ChatGPT 背後 RLHF 技術共同發明人 **Diogo Almeida** 創立的新創 **TypeSafe AI** 開發。TypeSafe 悶了兩年後於 2026 年 9 月從 stealth 模式浮出，拿到 $40M 資金，Jev 是他們第一個公開模型（目前 early access）。

**跟一般 LLM（GPT、Claude）差在哪**：一般語言模型是「一個字一個字接龍」生成文字。Jev 屬於 TypeSafe 稱之為 **"System One"** 的新模型類別（借用心理學「系統一 = 直覺反射」概念）：給它一段情境資料（state）+ 一串明確定義的問題（是非題/選擇題/給分題），它不生成自然語言文字，而是一次把所有題目的答案連同「校準過的信心機率」直接吐回結構化數值。

**速度與費用**：

| | Jev | 一般 LLM 呼叫一次 |
|---|---|---|
| 速度 | 70ms–500ms（多數約 100ms），官方示範 0.114 秒 vs GPT-5.6 Terra 的 8.566 秒，快 40–200 倍 | 秒級起跳 |
| 費用 | 輸入 $0.042 / 百萬 token，**輸出不收費**（不吐長文字） | 輸出長文字會疊加費用 |

一次典型判斷（約 300 token）成本約 $0.0000126，10 萬次判斷也才 $1.26。

**回扣到這則貼文**：37 個品牌、724 支廣告，很可能是把每支廣告素材當 state，開 6 道結構化問題（Hook/Format/Offer/CTA/Awareness Stage/Landing Page），讓 Jev 對每支廣告各答 6 題——因為每題都是毫秒級、幾乎零成本，才能把整個廣告 category 當資料集在秒等級掃完。

**結論**：Jev 適合「大量、重複、有固定框架的判斷/分類/打分」場景，不適合寫文章、聊天、創意發想。

**參考來源**：
- [Jev: TypeSafe's System One Model That Never Hallucinates](https://www.datacamp.com/blog/system-one-models-jev)
- [Introducing System One Models & Jev - TypeSafe AI Blog](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
- [TypeSafe Jev: the First Decision-Only Model Class, Benchmarked and Priced](https://www.developersdigest.tech/blog/typesafe-jev-system-one-models-release-guide-2026)
- [Jev by TypeSafe AI: 200x Faster Structured-Output Model (2026)](https://www.explainx.ai/blog/typesafe-ai-jev-system-one-models-launch-2026)
- [TypeSafe's Jev Claims 193x Faster and 444x Cheaper](https://thecherrycreeknews.com/typesafe-jev-system-one-model-claims-evals-independent-tests-cherry_creek/)
- [ChatGPT pioneer launches Jev model for programmatic logic](https://www.artificialintelligence-news.com/news/chatgpt-pioneer-launches-jev-model-for-programmatic-logic/)
- [TypeSafe AI, founded by ChatGPT co-inventor, emerges from stealth with $40M](https://techstartups.com/2026/09/16/typesafe-ai-an-ai-startup-founded-by-chatgpt-co-inventor-emerges-from-stealth-with-40m-to-build-ai-thats-100x-faster-and-cheaper/)
- [Jev (typesafe) · Cloudflare AI docs](https://developers.cloudflare.com/ai/models/typesafe/jev/)

---

## OpenClaude（Gitlawb/openclaude）新功能追蹤

> 背景與來源說明見另一篇筆記：[openclaude-vs-claude-code.md](./openclaude-vs-claude-code.md)（含「未經 Anthropic 授權的 Claude Code 衍生代碼」這項關鍵發現）。這裡只追蹤功能演進，不重複背景說明。

### 2026-09-18 追蹤

- **加入日期**：2026-09-18
- **比對範圍**：`aceacf0`（2026-09-02 初次拉取）→ `d16318a`（本次查詢，共 13 個 commit）
- **版本號**：仍是 `0.30.0`（尚未發新版）

**新功能（feat）**：

| 功能 | 說明 |
|---|---|
| **Command Code 混合 Gateway**（#2196） | 新增 "Command Code" OpenAI 相容聚合型 gateway provider，用專屬 `CMD_API_KEY` 認證。單一 PR 補了 30+ 次修正（模型驗證、憑證隔離、路由優先權），上線過程明顯不順 |
| **Skills 撤銷清單機制**（#2187） | 安裝 skill 時讀取 registry 旁的 `revocations.json`（或 `OPENCLAUDE_SKILLS_REVOCATIONS_URL`），id/版本/sha256 命中撤銷清單就拒裝。清單不存在＝不撤銷，但清單格式錯誤會讓安裝失敗（fail-closed）——資安補強功能 |
| **Skill 驗證：撤銷 + "eyebrow drift" 檢查**（#2215） | 延伸上面機制，再檢查 skill 描述/metadata 是否偏離原始註冊內容 |
| **啟動器記憶體上限百分比**（#2219） | 新增 `--max-old-space-size-percentage`，用「佔可用記憶體百分比」設定 Node heap 上限，取代原本寫死的 8192 MB，方便在小型 container 或大型工作站上自動調整 |

**值得注意的修正（fix / docs）**：

- xAI OAuth：回呼前先驗證 state，避免 callback 被搶先處理（安全性修正）
- Plugin marketplace 快取：Windows 上避免用「長得很像」的網域繞過 hostPattern 檢查
- 新增 `docs: skills 撰寫指南` 與給 LLM 探索用的 `llms.txt`
- 辨識 OpenCode Go 的請求做特殊處理
- SDK：修正 async generator 的 session context 沒被保留的問題
- Profile 系統：context 上限改成套用到該 profile 底下所有模型

**觀察**：這波更新偏向「補洞」和「新增一個 provider」，沒有架構級大改動。比較值得留意的是 **skills 撤銷清單（revocations.json）**，代表他們開始考慮「已發佈的 skill 之後發現有問題該怎麼下架」這個治理問題。
