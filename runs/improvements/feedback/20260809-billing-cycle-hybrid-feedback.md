# Billing Cycle Hybrid Decision Feedback

## 摘要

| 項目 | 內容 |
|---|---|
| **日期** | 2026-08-09 |
| **決策** | Billing cycle 計算方式：+30 天滾動；更新機制：Hybrid（lazy update + cron） |
| **影響** | passes module schema、lazy update logic、Cron endpoint、future mail trigger |
| **狀態** | Decision Log 已出，實作尚未開始 |

---

## Decision Quality 評估

### 好的地方

- **兩層互補設計**：Lazy update 照顧活躍用戶、Cron 兜底長期不登入用戶，設計完整
- **trigger 條件已定義**：續期 / 試用期提醒 mail 的觸發條件都寫清楚，未來實作有據
- **技術備註完整**：`paid_at` 初始 NULL、`billing_cycle_end` 初始 NULL 的行為都有記錄

### 待驗證的假設

1. **+30 天滾動**：依賴 `paid_at` 精確記錄付費時間。如果未來有部分退款 / 優惠券場景，需要重新確認「付費時間」的定義
2. **Cron 觸發頻率**：每天跑一次是否足夠？活躍用戶每次登入都會 lazy update，Cron 主要照顧長期不登入用戶——但「長期」是多久？需要定義 threshold
3. **Workers Free 額度**：100,000 triggers/day 是否足夠？需要估算巔峰 DAU

### 建議的 Rule 補充

在 `000-modular-design.mdc` 或新 rule 中加一條：

> **Billing cycle / subscription 設計 checklist**：
> 1. ✅ 定義計算起點（滾動 vs 日曆月）
> 2. ✅ 定義更新機制（lazy vs cron vs hybrid）
> 3. ✅ 定義邊界條件（初始 NULL、部分退款、優惠券）
> 4. ✅ 定義 cron frequency 是否足夠 target DAU
> 5. ✅ 定義 mail trigger 的「提前天數」與 condition

---

## 衍生後續

- [ ] Migration 005 新增 `paid_at` + `billing_cycle_end`
- [ ] `getPassService.ts` 加 lazy update logic
- [ ] `billingCycleCron.ts` Cron endpoint
- [ ] `wrangler.jsonc` 加 `triggers.crons`
- [ ] Frontend Dashboard UI 顯示下次結帳日
- [ ] 續期提醒 mail trigger
- [ ] 試用期提醒 mail trigger
- [ ] Passes module tests（billingCycleCron、getPassService、billingCycle）
