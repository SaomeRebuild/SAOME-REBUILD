# Billing Cycle Hybrid 決策日誌

## Metadata

- **日期**：2026-08-09
- **作者**：Josh（agent-assisted via Cursor）
- **觸發**：實作 passes module 前需要先確認 billing cycle 計算邏輯
- **規則 / skill 觸發**：`saome-dev-logging`、`saome-methodology-bridge`（L3 Heavy → Decision Log 先出）

---

## 決策範圍

### Q1：計算起點

| 選項 | 做法 |
|---|---|
| A. +30 天滾動 | `billing_cycle_end = paid_at + 30 * N days` |
| B. 日曆月（每月 1 號） | billing cycle 固定對齊每月 1 號 |

**決定：選 A（+30 天滾動）**。

理由：
- 對使用者直觀：付費後 30 天就是下個到期日
- 跨月不複雜
- `paid_at` 本身已記錄精確日期

### Q2：更新機制

| 選項 | 做法 |
|---|---|
| A. 前端 trigger | 用戶登入時後端 lazy update |
| B. 背景 cron | Cloudflare Cron job 每天跑批次更新 |
| C. Hybrid（兩層） | lazy update 即時 + cron 兜底修正 drift |

**決定：選 C（Hybrid）**。

理由：
- **Lazy update**：在 `/api/pass/current` 或 `/api/auth/refresh` 裡，發現 `billing_cycle_end <= now()` 時自動往前遞進（+30 天）
- **Cron 兜底**：`GET /api/cron/billing-cycle` 每天跑一次批次更新

---

## 待實作清單（未來工作）

| 項目 | 說明 | 狀態 |
|---|---|---|
| Migration 005 | `passes` table 新增 `paid_at` + `billing_cycle_end` | ⏳ pending |
| Lazy update logic | 寫在 `getPassService.ts` | ⏳ pending |
| Cron endpoint | `apps/backend/src/modules/passes/routes/billingCycleCron.ts` | ⏳ pending |
| `wrangler.jsonc` | `triggers.crons` 設定 | ⏳ pending |
| Frontend UI | Dashboard 顯示「下次結帳日」 | ⏳ pending |
| 續期提醒 mail | `billing_cycle_end - 3 days` trigger | ⏳ pending |
| 試用期提醒 mail | `end_date - 3 days` + `paid_at IS NULL` | ⏳ pending |

---

## 自問

- **下次怎麼不犯？**
  - 重大 schema 變更需要先出 Decision Log 再實作，避免做到一半發現架構問題
- **哪條 rule 該補？**
  - `runs/decisions/` 已經是 L3 Heavy 的必跑流程，但沒有明確要求「Decision Log 跟 DEV LOG 成對 commit」
- **哪個 test 該加？**
  - Passes module 實作後：
    - `billingCycleCron.test.ts`：測 +30 天滾動進位
    - `getPassService.test.ts`：測 lazy update 遞進
    - `billingCycle.test.ts`：測 Hybrid 兩層互補
