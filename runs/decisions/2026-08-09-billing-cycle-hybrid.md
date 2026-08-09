---
title: "Billing Cycle 計算方式與更新機制"
date: 2026-08-09
status: accepted
type: decision
scope: billing
---

# Decision：Billing Cycle 計算與更新機制

## 背景

`passes` table 需要新增 `paid_at` 與 `billing_cycle_end` 兩個欄位，支援：
1. 試用期結束後的付費記錄
2. 每月自動遞進的 billing cycle
3. 續期提醒 mail 的觸發依據

在實作前有兩個設計問題需要先確認：
- **計算起點**：從 `paid_at` 當天起算 +30 天，還是固定每月 1 號？
- **更新機制**：每月遞進由 cron job 執行，還是前端 trigger？

## 選項與決定

### Q1：計算起點

| 選項 | 做法 |
|---|---|
| A. +30 天滾動 | `billing_cycle_end = paid_at + 30 * N days` |
| B. 日曆月（每月 1 號） | billing cycle 固定對齊每月 1 號 |

決定：**選 A（+30 天滾動）**。

理由：
- 對使用者直觀：付費後 30 天就是下個到期日，不需要對齊日曆
- 跨月不複雜：自然月邊界對線上系統沒有實質意義
- `paid_at` 本身已記錄精確日期，+30 天是最直接的實作

### Q2：更新機制

| 選項 | 做法 |
|---|---|
| A. 前端 trigger | 用戶登入時後端 lazy update |
| B. 背景 cron | Cloudflare Cron job 每天跑批次更新 |
| C. Hybrid（兩層） | lazy update 即時 + cron 兜底修正 drift |

決定：**選 C（Hybrid）**。

理由：
- **Lazy update**：在 `/api/pass/current` 或 `/api/auth/refresh` 裡，發現 `billing_cycle_end <= now()` 時自動往前遞進（+30 天）。正常使用的用戶每次登入立即拿到最新狀態。
- **Cron 兜底**：`GET /api/cron/billing-cycle` 每天跑一次，對所有 `paid_at IS NOT NULL AND billing_cycle_end <= now()` 的 rows 批次更新。長期不登入的用戶也能被修正。
- 兩層保障互補，兼顧即時性與健壯性。

## 影響

### 立即
- `passes` table 新增 `paid_at (timestamptz, NULLABLE)` 與 `billing_cycle_end (timestamptz, NULLABLE)`
- Migration: `005_add_billing_columns.sql`
- Lazy update logic 寫在 `apps/backend/src/modules/passes/services/getPassService.ts`
- Cron endpoint: `apps/backend/src/modules/passes/routes/billingCycleCron.ts`
- `wrangler.jsonc` 新增 `triggers.crons` 設定

### 未來
- 前端 Dashboard 需要 UI 顯示「下次結帳日」（從 `billing_cycle_end` 計算）
- 續期提醒 mail trigger 條件：`billing_cycle_end - 3 days <= now() < billing_cycle_end AND paid_at IS NOT NULL`
- 試用期提醒 mail trigger 條件：`end_date - 3 days <= now() < end_date AND paid_at IS NULL`

## 技術備註

- `paid_at` 初始為 `NULL`，付費後由 `/api/passes/confirm-payment` endpoint 寫入
- `billing_cycle_end` 初始為 `NULL`，lazy update 或 cron 第一次觸發後才會有值
- Cron job 需要在 `wrangler.jsonc` 的 `triggers.crons` 註冊，並確保 Cloudflare Workers 帳單方案支援 Scheduled Events（Workers Free 方案有 100,000 trigger/day 額度）

---

Refs: runs/articles/04-vfr-optimization-outcomes.md
