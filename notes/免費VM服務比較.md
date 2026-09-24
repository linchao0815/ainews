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
- PAYG（綁卡升級）帳號是否適用：官方文件寫「**All tenancies** get the first 1,500 OCPU hours and 9,000 GB hours」，後句才說「For Always Free tenancies, this is equivalent to 2 OCPUs and 12 GB」；InfoQ 報導客服 email 曾回覆 PAYG 可維持 4/24 不收費，但與文件不一致——**以文件為準視為 PAYG 也只有 1,500/9,000 免費額度，超過會計費**。
- 官方另警告：既有資源一旦 terminate，可能無法再以超出新額度的規格重建（InfoQ 引述）。

**閒置回收規則**（官方原文）：「Idle **Always Free** compute instances may be reclaimed by Oracle」——7 天內 CPU（95 百分位）< 20%、網路 < 20%、記憶體 < 20%（僅 A1）三項**全部**成立即可能被回收。
- 升級 PAYG 能否免除回收：官方文件與 FAQ **都沒有明文保證**，屬社群經驗，不能當事實。
- 官方 FAQ 另有**帳號層級**規則：「Accounts left idle for 30 days or more may be deemed abandoned and become eligible for suspension or termination」——帳號 30 天不用也可能被停權。
- 官方 FAQ：Free Trial 期間用 credits 建的付費資源在試用結束後會被回收；標記為 Always Free 的資源不會因試用結束而被回收。

**其他坑**：
- 熱門地區常「Out of host capacity」開不出 A1，resize 也可能失敗（第三方）。
- home region 註冊後不能改，台灣使用者建議選 **Japan East（東京）／Japan Central（大阪）／Singapore**，延遲較低（地區可選性以註冊頁為準）。

### Google Cloud（GCP）——最穩但最小

官方（Free Tier 文件）：
- **1 台 e2-micro**（非 preemptible，每月整月份）：2 vCPU 但每顆只保證 12.5% CPU 時間（合計 0.25 vCPU），可短暫 burst 到 100% 約 30 秒；1 GB RAM（官方 machine types 文件）
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
- Free Tier 可用機型（官方 EC2 FAQ）：t3.micro、t3.small、t4g.micro、t4g.small、c7i-flex.large、m7i-flex.large。
- **t4g.small 免費試用延長至 2026-12-31**（官方 AWS re:Post 公告原文）：「All new and existing AWS customers can utilize the free trial to automatically deduct up to 750 hours per month with the t4g.small instances through December 31, 2026」——新舊客戶都適用，750 小時跨所有地區合計（EC2 FAQ）；超出 baseline 的 surplus CPU credits 要付費。
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
| GitHub Codespaces | GitHub Free 每月 120 core-hours、15 GB 儲存；Pro 180 core-hours、20 GB（官方） | 官方 changelog：120 core hours＝2-core 機器 60 小時；開發環境用途，非常駐主機 |
| Render | 免費 web service，每 workspace 每月 750 instance hours（官方） | 閒置 15 分鐘無流量就休眠，喚醒約 1 分鐘；免費 Postgres **30 天後到期**（官方） |
| Koyeb | **新用戶已無免費方案** | 2026-02 被 Mistral AI 收購，免費 tier 停止對新用戶開放、既有用戶保留（TechCrunch 等） |
| Fly.io | **無免費方案，只有試用** | 官方：試用 = 2 VM-hours 或 7 天（先到者），機器跑 5 分鐘自動停 |
| Northflank | Sandbox：2 services、1 database、2 cron jobs，不休眠（官方 pricing） | 規格上限官方未列 |
| Cloudflare Workers | 10 萬 requests/日 | 非 VM，但跑 API/bot/網站通常比 VM 更適合 |

## 選擇建議

1. **想要一台真正能用的免費主機**：Oracle A1（2 OCPU / 12 GB）仍是最大方的，但 2026 年已證明 Oracle 會不公告就砍額度，**不要把重要服務只放這裡**，要有備份與遷移計畫。
2. **求穩的小服務**：GCP e2-micro，但流出流量 1 GB/月很緊，對外服務要搭 CDN（例如 Cloudflare 免費 CDN 擋在前面）。
3. **Oracle / GCP VM + Cloudflare Tunnel**：VM 不開任何 inbound port，用 `cloudflared` 把服務開出去，再用 Zero Trust Access 加登入保護——安全性與免費程度都最好的組合。
4. **學習／短期專案**：Azure（亞洲機房）或 AWS credits，記得設預算警示，到期前刪資源。
5. **其實不需要 VM**：網站、API、webhook、bot、定時任務 → Cloudflare Workers / Pages 免費額度更穩、沒有被回收問題。

## 白話詳解：VM + Cloudflare Tunnel + Zero Trust Access

一句話：**主機不接受任何外面主動連進來的連線，只由主機自己往外連到 Cloudflare；外人要進來，得先在 Cloudflare 那邊登入過關。**

### 用房子比喻

**一般做法（開 port）**
- VM 有個公開 IP，就像房子有門牌地址，全世界都查得到。
- 開 port 等於在牆上開一扇門，例如 22 號門給 SSH、443 號門給網站。
- 網路上隨時有機器人在逐戶敲門：掃 port、猜 SSH 密碼、打網站漏洞。一台新 VM 上線幾分鐘，log 裡就會出現陌生 IP 在嘗試登入。
- 門開越多，被闖進來的機會越大。

**Tunnel 做法**
- 把房子所有對外的門都封死，外面的人連門都找不到。
- 由屋內的人（`cloudflared` 這支程式）主動打電話給 Cloudflare 的總機，而且一直不掛斷。這就是 Tunnel。
- 訪客不再直接來你家，而是去 Cloudflare 的大廳（例如 `app.你的網域.com`）。
- 大廳櫃台就是 Zero Trust Access，先驗身分：用 Google 或 GitHub 登入，或收 email 驗證碼。你事先設好白名單，例如只有 `me@gmail.com` 能進。
- 驗證通過後，櫃台才透過那條一直沒掛斷的電話線，把訪客的請求轉進屋內。

### 為什麼更安全

| 威脅 | 開 port 的主機 | Tunnel + Access |
|---|---|---|
| port 掃描 | 掃得到開了什麼服務 | 掃不到任何開著的 port |
| SSH 暴力猜密碼 | 每天大量嘗試 | 22 port 根本沒開，無從猜起 |
| 網站或管理後台的漏洞 | 任何人都能直接打 | 要先通過 Cloudflare 登入，陌生人碰不到你的程式 |
| DDoS 流量攻擊 | 直接打到你的 IP | 先被 Cloudflare 擋下 |
| 暴露主機真實 IP | 暴露 | 使用者只看得到 Cloudflare |

關鍵在於：就算你的服務有漏洞（例如 NAS 後台、自架的 n8n、Home Assistant），沒登入的人也碰不到它。

### 為什麼是免費組合

- **VM**：Oracle 或 GCP 的永久免費主機。
- **Tunnel**：免費，沒有數量或流量限制（第三方資料）。
- **Zero Trust Access**：50 人內免費（第三方資料），個人或小團隊用不完。
- **網域**：唯一可能要花的錢，一年約幾百台幣。Tunnel 需要一個由 Cloudflare 管 DNS 的網域。

還有兩個額外好處：
- **GCP 流量問題**：GCP 免費主機每月只有 1 GB 對外流量。網站靜態內容可以交給 Cloudflare CDN 快取，減少主機直接送出的流量。
- **家用主機也適用**：家裡沒有固定 IP、路由器不想設定轉 port，同樣能用這套把服務開出去。

### 實際長什麼樣

```
你的手機/筆電
   │ 1. 開 https://n8n.example.com
   ▼
Cloudflare（全球機房）
   │ 2. Access：先用 Google 登入，確認是白名單的人
   │ 3. 通過 → 經 Tunnel 轉進去
   ▼
Oracle VM（沒有任何開著的對外 port）
   └ cloudflared ──主動連出──> Cloudflare（這條線一直保持連著）
   └ n8n 只在本機 localhost:5678 上跑
```

### 設定大致流程

1. 買一個網域，把 DNS 交給 Cloudflare 管。
2. 到 Cloudflare Zero Trust 後台建立一條 Tunnel，後台會給你一行安裝指令。
3. 在 VM 上貼上那行指令，安裝 `cloudflared` 並設成開機自動執行。
4. 在 Tunnel 設定裡把 `n8n.example.com` 對應到 `http://localhost:5678`。
5. 在 Access 建一個應用程式，保護 `n8n.example.com`，規則設成只允許你的 email。
6. **最後關門**：到 Oracle 的 Security List 或 GCP 的防火牆，把對外開放的規則都刪掉，包括 22。兩家預設通常都開著 SSH 22，這步一定要做。

SSH 也可以改走 Tunnel，有兩種方式：用瀏覽器開 SSH 終端，或在自己電腦裝 `cloudflared` 當跳板。

### 要知道的代價

- **Cloudflare 看得到你的流量**：HTTPS 加密在 Cloudflare 那一端就解開了。極度敏感的資料要評估，一般個人服務沒問題。
- **Cloudflare 當機你也跟著斷**：像 2025-11-18 那次大當機，所有透過 Tunnel 的服務都會連不上。
- **主機本身還是要照顧**：系統更新、備份照做。Tunnel 擋的是外面進來的攻擊，主機上跑的程式若本身有問題，它管不到。
- **Oracle 的回收規則照樣適用**：主機長期閒置還是可能被收回，Tunnel 解決的是安全問題，不是這個。
- **不適合的用途**：遊戲伺服器這類需要 UDP 或自訂 port、且對外人公開的服務，不太適合 Tunnel。它最適合網站、管理後台、SSH 這類 HTTP 或 TCP 服務。

## 來源

官方：
- Oracle Always Free：<https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm>
- GCP Free Tier：<https://docs.cloud.google.com/free/docs/free-cloud-features>
- AWS Free Tier：<https://aws.amazon.com/free/>
- AWS 2025-07 改制公告：<https://aws.amazon.com/blogs/aws/aws-free-tier-update-new-customers-can-get-started-and-explore-aws-with-up-to-200-in-credits/>
- Azure 免費服務：<https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/create-free-services>
- Oracle Free Tier FAQ：<https://www.oracle.com/cloud/free/faq/>
- GCP E2 shared-core 規格：<https://docs.cloud.google.com/compute/docs/general-purpose-machines>
- AWS EC2 FAQ（Free Tier 機型、T4g 試用）：<https://aws.amazon.com/ec2/faqs/>
- AWS T4g 試用延長公告：<https://repost.aws/articles/ARi_gf6vo6TuqNtMQdiYPKyA/announcing-amazon-ec2-t4g-free-trial-extension>
- GitHub Codespaces 計費：<https://docs.github.com/en/billing/concepts/product-billing/github-codespaces>、core hours 說明 <https://github.blog/changelog/2022-11-09-codespaces-for-free-and-pro-accounts/>
- Render 免費方案：<https://render.com/docs/free>
- Fly.io 試用：<https://docs.fly.io/about/free-trial/>
- Northflank 價格：<https://northflank.com/pricing>

第三方：
- Oracle A1 砍半：<https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/>、<https://linuxiac.com/oracle-quietly-cuts-free-tier-ampere-a1-resources-in-half/>、<https://terminalbytes.com/oracle-cloud-free-tier-changes-2026/>
- AWS t4g.small 延長（實測 CUR）：<https://dev.classmethod.jp/en/articles/ec2-t4g-small-free-tier-2026/>
- AWS 新制機型：<https://repost.aws/questions/QUlaKi-MimTo-3OjekpKMWiA/what-is-correct-for-ec2-free-tier-instance>
- Koyeb 被收購：<https://techcrunch.com/2026/02/17/mistral-ai-buys-koyeb-in-first-acquisition-to-back-its-cloud-ambitions/>
- Render／Fly.io／Northflank：<https://snapdeploy.dev/blog/free-cloud-deployment-platforms-2026-comparison>、<https://expresstech.io/7-fly-io-alternatives-in-2026-real-pricing-after-the-free-tier-died/>
