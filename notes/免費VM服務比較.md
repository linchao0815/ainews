# 免費 VM 服務比較

> 查證日期：2026-09-24。「永久免費」與「試用期免費」分開看；官方／第三方來源分開標示。2026 年多家縮水，數字請以官方頁為準。

## 結論先講

| 需求 | 首選 |
|---|---|
| 要一台**長期、規格最大**的免費 Linux 主機 | **Oracle Cloud Always Free**（ARM 2 OCPU / 12 GB） |
| 要**長期、最穩、不怕被收回**的小主機 | **GCP e2-micro**（但只在美國機房，台灣連線延遲高） |
| 要**亞洲機房、短期**練手 | **Azure**（12 個月 750 小時 B1s，可選日本/香港） |
| 短期試 AWS 生態 | **AWS Free Plan**（最多 $200 credits、6 個月） |
| 只要開發環境、不用常駐 | **GitHub Codespaces**（每月 120 core-hours） |
| 只是跑網站／API／bot | 不需要 VM → **Cloudflare Workers**（見 [Cloudflare 研究筆記](cloudflare-研究筆記.md)） |

## 永久免費（Always Free）

### Oracle Cloud Infrastructure（OCI）——規格最大，但限制最多

官方（Always Free Resources 文件）：

| 資源 | 額度 |
|---|---|
| Ampere A1（ARM） | **1,500 OCPU-hours + 9,000 GB-hours/月 ≈ 2 OCPU / 12 GB**，可拆成 2 台 1 OCPU / 6 GB |
| AMD Micro（E2.1.Micro） | 2 台，每台 1/8 OCPU（可 burst）、1 GB RAM、50 Mbps 對外頻寬 |
| Block storage | 200 GB（boot + block 合計，每台 boot 最少 47 GB）、5 份備份 |
| 流出流量 | **10 TB/月** |
| 地區 | 只能在註冊時選的 home region；A1 在 South Korea North（春川）不能開 |

**2026 重大變更**（已查證，多家媒體報導）：
- A1 額度**砍半**：原本 4 OCPU / 24 GB（3,000 OCPU-hours + 18,000 GB-hours）→ 2 OCPU / 12 GB。Oracle 沒發公告，只改文件（InfoQ、Linuxiac 報導，生效約 2026-06-15）。
- 2026-08-18 起開始執行：超出額度的純免費帳號 instance 會被停機，要自己 resize 到 2/12 才能開回來。
- PAYG（綁卡升級）帳號是否適用，Oracle 客服說法互相矛盾——**不確定**。

**閒置回收規則**（官方）：7 天內 CPU（95 百分位）< 20%、網路 < 20%、記憶體 < 20%（僅 A1）三項**全部**成立 → Oracle 可回收。
- 對策：跑真正有負載的服務；社群常見做法是升級 PAYG 帳號（不超額仍 $0）以降低被回收風險——**第三方經驗，非官方保證**。

**其他坑**：
- 熱門地區常「Out of host capacity」開不出 A1，resize 也可能失敗（第三方）。
- home region 註冊後不能改，台灣使用者建議選 **Japan East（東京）／Japan Central（大阪）／Singapore**，延遲較低（地區可選性以註冊頁為準）。

### Google Cloud（GCP）——最穩但最小

官方（Free Tier 文件）：
- **1 台 e2-micro**（非 preemptible，每月整月份），共享 vCPU、1 GB RAM
- 只限 **us-west1（Oregon）、us-central1（Iowa）、us-east1（South Carolina）**
- 30 GB 標準 persistent disk
- 流出 **1 GB/月**（北美出發，不含中國、澳洲）——這是最大限制，當網站主機很容易超額
- 另有新客戶 **$300 credits / 90 天** 試用
- GPU／TPU 不在免費範圍

適合：監控腳本、cron、輕量 bot、跳板機。從台灣連美國機房延遲約 150 ms 以上（推測，依路由而定）。

## 試用期免費

### AWS——2025-07-15 起改成 credits 制

官方（AWS Free Tier 頁、AWS 部落格）：
- 新帳號（2025-07-15 以後建立）：註冊送 **$100 credits**，完成 5 項任務（開 EC2、設 RDS、建 Lambda、用 Bedrock、設 Budgets 警示，各 $20）再拿 $100，最多 **$200**。
- Free plan **6 個月或 credits 用完就到期**（先到者），到期後 90 天內升級付費才能恢復帳號。
- Free plan 只能用部分服務；另有 30+ 項服務永久免費額度（兩種 plan 都有）。
- 可用機型：t3.micro、t3.small、t4g.micro、t4g.small（第三方整理）。
- **t4g.small 免費試用延長至 2026-12-31**：每月 750 小時（第三方引述 AWS re:Post 公告；官方原文頁回 403 未能直接讀取）。
- 舊帳號（2025-07-15 前）：維持 12 個月 t2.micro/t3.micro 750 小時的舊制。
- 注意：EBS、流量、公有 IPv4 位址等周邊資源可能另計費，credits 會被扣。

### Azure——$200 / 30 天 + 12 個月 VM

官方（Microsoft Learn）：
- **$200 credits，限前 30 天**，沒用完就消失。
- 12 個月內：**B1s、B2pts v2（ARM）、B2ats v2（AMD）** 各可用 **750 小時/月**（Windows 或 Linux），可在任何有 B-series 的地區開——包括日本、香港等亞洲機房。
- 750 小時可任意分配（例如 5 台各跑 150 小時）。
- 要從 portal 的「Free services」頁建立，否則預設不一定選到免費規格而被收費。
- 12 個月後轉按量計費。

## 非 VM 但常被拿來當替代

| 服務 | 免費內容（2026） | 注意 |
|---|---|---|
| GitHub Codespaces | GitHub Free 每月 120 core-hours、15 GB 儲存；Pro 180 core-hours、20 GB（官方） | 以核心數計，2-core 機器約 60 小時（推算）；開發環境用途，非常駐主機 |
| Render | 免費 web service | 閒置 15 分鐘休眠，喚醒 30–60 秒冷啟動（第三方） |
| Koyeb | **新用戶已無免費方案** | 2026-02 被 Mistral AI 收購，免費 tier 停止對新用戶開放、既有用戶保留（TechCrunch 等） |
| Fly.io | **已無免費方案** | 第三方 |
| Northflank | 2 services、2 jobs、1 addon | 第三方 |
| Cloudflare Workers | 10 萬 requests/日 | 非 VM，但跑 API/bot/網站通常比 VM 更適合 |

## 選擇建議

1. **想要一台真正能用的免費主機**：Oracle A1（2 OCPU / 12 GB）仍是最大方的，但 2026 年已證明 Oracle 會不公告就砍額度，**不要把重要服務只放這裡**，要有備份與遷移計畫。
2. **求穩的小服務**：GCP e2-micro，但流出流量 1 GB/月很緊，對外服務要搭 CDN（例如 Cloudflare 免費 CDN 擋在前面）。
3. **Oracle / GCP VM + Cloudflare Tunnel**：VM 不開任何 inbound port，用 `cloudflared` 把服務開出去，再用 Zero Trust Access 加登入保護——安全性與免費程度都最好的組合。
4. **學習／短期專案**：Azure（亞洲機房）或 AWS credits，記得設預算警示，到期前刪資源。
5. **其實不需要 VM**：網站、API、webhook、bot、定時任務 → Cloudflare Workers / Pages 免費額度更穩、沒有被回收問題。

## 來源

官方：
- Oracle Always Free：<https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm>
- GCP Free Tier：<https://docs.cloud.google.com/free/docs/free-cloud-features>
- AWS Free Tier：<https://aws.amazon.com/free/>
- AWS 2025-07 改制公告：<https://aws.amazon.com/blogs/aws/aws-free-tier-update-new-customers-can-get-started-and-explore-aws-with-up-to-200-in-credits/>
- Azure 免費服務：<https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/create-free-services>
- GitHub Codespaces 計費：<https://docs.github.com/en/billing/concepts/product-billing/github-codespaces>

第三方：
- Oracle A1 砍半：<https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/>、<https://linuxiac.com/oracle-quietly-cuts-free-tier-ampere-a1-resources-in-half/>、<https://terminalbytes.com/oracle-cloud-free-tier-changes-2026/>
- AWS t4g.small 延長：<https://dev.classmethod.jp/en/articles/ec2-t4g-small-free-tier-2026/>、<https://repost.aws/articles/ARi_gf6vo6TuqNtMQdiYPKyA/announcing-amazon-ec2-t4g-free-trial-extension>
- AWS 新制機型：<https://repost.aws/questions/QUlaKi-MimTo-3OjekpKMWiA/what-is-correct-for-ec2-free-tier-instance>
- Koyeb 被收購：<https://techcrunch.com/2026/02/17/mistral-ai-buys-koyeb-in-first-acquisition-to-back-its-cloud-ambitions/>
- Render／Fly.io／Northflank：<https://snapdeploy.dev/blog/free-cloud-deployment-platforms-2026-comparison>、<https://expresstech.io/7-fly-io-alternatives-in-2026-real-pricing-after-the-free-tier-died/>
