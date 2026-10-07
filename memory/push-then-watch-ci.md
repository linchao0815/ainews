---
name: push-then-watch-ci
description: 每次 push 觸發 CI 後，必須監看到跑完並回報結果，不能只列出 in_progress 就結束
metadata:
  node_type: memory
  type: feedback
  originSessionId: a02320bf-d1b6-4ed1-8a62-27ac83ca22e1
  modified: 2026-10-07T09:19:46.492Z
---

push 之後只要有觸發 GitHub Actions，同一輪就要啟動監看（`gh run watch <id> --exit-status`，背景執行），等跑完再回報成功或失敗；失敗要接著查 `gh run view <id> --log-failed`。不能只列出 run 狀態是 in_progress 就結束這一輪。

**Why:** 2026-10-07 修完 pixi-colyseus-card 的 package-lock 後 push，只列出 CI 狀態為 in_progress 就停下，沒有監看；使用者問「CI 有錯，你為何沒有監控？」（來源等級：已驗證——使用者原話；當次 run 37596701498 最後是 success，使用者看到的是前一次 37595417700 的失敗）。第一次 push 時有用背景 `gh run watch` 監看，第二次漏掉，前後不一致。

**網路不穩時：** `gh run watch` 遇到連 GitHub API 逾時會直接以 exit 1 結束，看起來像 CI 失敗但其實不是（2026-10-07 run 37599663519 實例，已驗證：log 為 `dial tcp ... connectex` 逾時，run 仍 in_progress，最後 success）。watch 非 0 結束時先 `gh run view <id> --json status,conclusion` 查實際狀態；改用每 20 秒 `gh run view` 輪詢、失敗自動重試的迴圈監看到 completed。

**How to apply:** 任何 `git push` 之後，先 `gh run list --limit 3` 找出被觸發的 run，接著背景執行 `gh run watch <id> --exit-status`；收到完成通知後讀結果並回報。修正 CI 失敗後重新 push，同樣要監看到新 run 結束，並確認測試數字（不只看 conclusion）。相關：[[weekly-report-selection-criteria]] 是另一條 repo 規則，與此無關但同在本專案。
