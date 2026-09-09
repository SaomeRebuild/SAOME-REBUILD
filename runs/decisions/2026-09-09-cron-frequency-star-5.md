# Decision: Cron frequency `*/2` → `*/5` — stay within Workers Free CPU quota

Date: 2026-09-09
Status: accepted (L1 — config tuning, low risk)
Owner: backend (saome-backend Worker)

## 背景

Workers Free plan 限制：

| 資源 | Free plan 額度 |
|---|---|
| CPU time | **10 秒 / 天** |
| Requests | 100,000 / 天 |

`sawtooth-1102`（`exceededCpu`）在 2026-09-09 的登入流程優化後（`jwt-tenant-id-trust`）已大幅減少，但 cron trigger 本身仍是 CPU 消耗源。

`sawtooth-1102` 發生在 cron 每次 trigger：cron handler 執行 3 個 sub-task，詳見下表。

## Cron handler 現況分析

每次 cron tick（`*/2` 時每天 720 次）執行：

| Step | 操作 | 每次 CPU 時間 | 每天次數（`*/2`） | 每天 CPU |
|---|---|---|---|---|
| 1 | `app.fetch('/health')` in-process warmup | < 5ms | 720 | ~3.6 秒 |
| 2 | `SELECT 1` Hyperdrive keep-alive | ~10ms + DB roundtrip | 720 | ~7.2 秒 |
| 3 | `GET /api/cron/billing-cycle` | < 5ms（多數 no-op）| 720 | ~3.6 秒 |
| **合計** | | | | **~14 秒 / 天** |

`*/2` 時 cron CPU 為 **14 秒 / 天**，**超出 Free 額度 40%**，是 1102 的潛在觸發源。

## 選項與決定

| 選項 | 摘要 | CPU / 天 | 評估 |
|---|---|---|---|
| A | **`*/5` — 維持單一 cron trigger，頻率從每 2 分鐘改為每 5 分鐘** | ~6 秒 | ✅ 採納 |
| B | **`*/10` — 每 10 分鐘** | ~3 秒 | 可行但踩 idle eviction 邊界（CF idle eviction 15-30 min）|
| C | **合併 steps 1+2 為單一 in-process call；billing-cycle 拆到 `0 * * * *` 每小時** | ~10 秒 | Free 額度邊緣，仍不安全 |
| D | **升 Workers Paid plan** | 無限制 | $5 / 月，超出本次 scope |
| E | **砍 keep-alive cron** | 0 秒 | ❌ Cloudflare idle eviction（15-30 min）會讓 Worker cold-start → 1102 或 503 |

**決定**：選項 A（`*/5`）。

理由：
1. **CPU 安全**：~6 秒 / 天，Free 額度內有 40% buffer（10s - 6s = 4s 餘裕）。
2. **Idle eviction 安全**：CF idle eviction 為 15-30 分鐘；`*/5`（最長 5 分鐘空檔）遠低於 eviction window，cold-start 風險接近零。
3. **Billing cycle 正確性**：`billing_cycle_end` 精度為「日」，`*/5` 不影響結算邏輯（每小時的 billing-cycle cron 已在 separate trigger 中）。
4. **零 regression**：Cron trigger 本身是 Worker 內部 keep-alive 機制，頻率改動不改變任何業務邏輯。

## 變動檔案

| 檔案 | 變動 |
|---|---|
| `apps/backend/wrangler.jsonc` | `triggers.crons: ["*/2 * * * *"]` → `["*/5 * * * *"]` |
| `apps/backend/src/index.ts` | 更新 `Frequency tuning` 註解（附 decision log 連結）|
| `apps/backend/src/modules/health/routes/warmupCron.ts` | 更新 `@description` 中的頻率描述 |
| `apps/backend/src/index.scheduled.test.ts` | 8 個 test fixtures cron 字串更新 |

## 驗證

- [x] `src/index.scheduled.test.ts` 全部通過（8 個 fixtures 已同步）
- [ ] 部署後觀察 `wrangler tail`，確認無 1102
- [ ] 觀察一週，確認無新增 1102 或 503

## 附錄：為何 billing-cycle 不拆出去

目前 cron handler 內含 3 個 sub-task（HTTP warmup、Hyperdrive ping、billing-cycle），三者共用同一個 cron trigger。billing-cycle 從 business 角度看應當每小時執行一次，但：

- 獨立 trigger 需要在 wrangler.jsonc 新增第二個 cron entry，這會佔用 Free plan 的 5-cron-trigger 上限（目前已用 1 個）。
- billing-cycle 的核心邏輯是 `billing_cycle_end <= now()` → advance，精度是「日」不是「分」，`*/5` vs `*/60` 不影響正確性。
- 合併執行減少 cron trigger 數量，為未來預留 trigger slot。

未來流量成長後，billing-cycle 可獨立拆出來精細化控管頻率（需 Paid plan）。
