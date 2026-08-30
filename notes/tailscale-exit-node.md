# Tailscale Exit Node：讓手機流量走家裡電腦出去

> 建立日期：2026-08-29
> 用途：手機在外連公共 Wi-Fi 時，把流量導回家裡電腦出口，等於自帶 VPN

這是上篇「3 步私人雲」的進階續集。上篇教怎麼裝 Tailscale、把手機和家裡電腦連成同一個私人網路（tailnet）；這篇講兩個進階功能——**exit node（出口節點）**——全程都在 Tailscale 免費個人方案的額度內，不用多付一毛錢。

---

## 1. 為什麼需要 exit node

咖啡廳、機場的公共 Wi-Fi 大多沒加密，同一段網路的其他使用者，理論上有辦法用技術手段側錄或攔截流量（例如假熱點、ARP 欺騙）。銀行 App、購物網站雖然本身走 HTTPS，但連線 metadata、DNS 查詢還是可能被看到你在連什麼服務。

開啟 exit node 之後，手機的**全部流量**（不只是連家裡那台電腦的流量）都會先繞進 tailnet，從家裡電腦的實體網路出口再送到公網。效果等同：

- **公共 Wi-Fi 場景**：所有對外連線都走家裡的固定線路出去，旁人在同一段 Wi-Fi 也看不到你的流量內容和目的地。
- **出國場景**：手機對外顯示的 IP 是家裡電視的 IP（台灣），可以用來存取「僅限台灣 IP」的服務（例如某些串流、銀行、政府網站）。
- **等於自帶一台 VPN**，如果你原本有訂閱商用 VPN 服務，這個功能上線後大多可以退訂。

代價：所有流量都繞道家裡，速度上限被家裡的**上傳頻寬**卡住（因為手機的下載流量要先從公網進到你家，再從你家上傳送回手機）。如果家裡是一般民用光纖，上傳通常只有幾十 Mbps，看影片、視訊夠用，但不適合大量下載。

---

## 2. 步驟一：把家裡電腦設成 exit node

以家裡那台常開機的電腦（Mac / Windows / Linux 皆可）為例。

### 2.1 開啟 IP forwarding（Linux 才需要，Mac/Windows 不用）

只有家裡那台是 Linux 主機時要做這步，Mac 和 Windows 上的 Tailscale 客戶端會自動處理。官方建議直接寫進設定檔並套用，一次到位（重開機也不會失效）：

```bash
echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.d/99-tailscale.conf
echo 'net.ipv6.conf.all.forwarding = 1' | sudo tee -a /etc/sysctl.d/99-tailscale.conf
sudo sysctl -p /etc/sysctl.d/99-tailscale.conf
```

如果系統沒有 `/etc/sysctl.d` 目錄，改寫進 `/etc/sysctl.conf` 再執行 `sudo sysctl -p /etc/sysctl.conf`。

### 2.2 用 `--advertise-exit-node` 重新註冊

在家裡電腦的終端機執行（`tailscale set` 只改這一項設定，不會動到其他既有設定，比重跑一次 `tailscale up` 更保險）：

```bash
sudo tailscale set --advertise-exit-node
```

第一次設定、或想用 `tailscale up` 一次到位也可以，效果相同：

```bash
sudo tailscale up --advertise-exit-node
```

Mac / Windows 圖形介面則是透過 Tailscale 內建的裝置管理網頁（選單列圖示 → **"Manage this device..."**，會開啟 `http://100.x.x.x:5252` 這類本機頁面）：**This device → Exit node → Run as exit node**。

### 2.3 到管理後台核准

執行完上面指令後，家裡電腦不會馬上生效，要到 [Tailscale 管理後台](https://login.tailscale.com/admin/machines) 手動核准：

1. 找到家裡那台電腦——如果還沒核准，它旁邊會有一個藍色的 **Exit Node** 徽章加驚嘆號
2. 點右側選單「…」→ **"Edit route settings"**
3. 勾選 **"Use as exit node"** → **Save**

沒做這一步，手機那端會看不到這台機器可選為 exit node。（如果你在 ACL 裡設定過 `autoApprovers`，符合條件的裝置會自動核准，不用手動做這步。）

---

## 3. 步驟二：手機連上 exit node

### iOS

1. 打開 Tailscale App
2. 點 **Exit Node**
3. 從清單選家裡那台電腦
4. 確認連線後，App 內會顯示「Connected to exit node」

### Android

1. 打開 Tailscale App，側邊選單
2. **Exit node** → 選家裡電腦
3. 系統會跳出 VPN 連線確認，允許即可
4. 需要同時連家裡區網內其他裝置（例如 NAS），可以另外開啟 **Allow LAN access**

開啟後，手機上所有 App 的流量都會走這條路徑，不只是原本 tailnet 內部的服務。

---

## 4. 怎麼確認真的生效了

在手機瀏覽器開 `https://ifconfig.me` 或 `https://whatismyip.com`，比對顯示出來的 IP：

- **關閉 exit node 時**：顯示的是你手機所在網路（電信商 4G/5G 或當地 Wi-Fi）的公網 IP
- **開啟 exit node 後**：顯示的應該是**家裡網路的公網 IP**（跟你在家用電腦查到的 IP 一致）

如果兩者一樣，代表 exit node 沒生效，回頭檢查：
- 管理後台是否已核准該機器為 exit node
- 家裡電腦是否還在線（Tailscale 需要那台電腦保持開機、有網路）
- 手機端有沒有選到正確的 exit node

---

## 5. 幾個實務上的小地雷

- **家裡電腦要保持開機**：exit node 靠家裡那台機器中繼，它睡眠或關機，手機就斷線回到原本網路，不會斷網，只是失去保護。
- **上傳頻寬是瓶頸**：看第 1 節，重度下載（例如大檔案、4K 影片）建議關閉 exit node，只在瀏覽敏感網站、視訊、公共 Wi-Fi 時開啟。
- **部分網站會誤判成異常流量**：因為你的 IP 突然「跳」到家裡那條線，某些銀行 / 購物網站可能觸發風控（簡訊驗證、圖形驗證碼），屬正常現象，驗證過就好。
- **手機耗電略增**：VPN 常駐連線會增加背景耗電，不是長時間出門建議用完關掉。
- **免費方案額度**：Tailscale 個人（Personal）免費方案目前（2026-08）是最多 **6 個使用者**、每個使用者可連接的**裝置數量沒有上限**；第 7 個使用者加入會讓整個 tailnet 轉為付費方案。一般家庭用不到這麼多人，exit node 功能本身完全免費、不額外收費。

---

## 參考來源

- [Exit nodes (route all traffic) · Tailscale Docs](https://tailscale.com/docs/features/exit-nodes)
- [Use exit nodes · Tailscale Docs](https://tailscale.com/docs/features/exit-nodes/how-to/setup)
- [tailscale up command · Tailscale Docs](https://tailscale.com/kb/1241/tailscale-up)
- [Free pricing plans and discounts · Tailscale Docs](https://tailscale.com/docs/account/manage-plans/free-plans-discounts)
