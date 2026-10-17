# 2026-10-16 — PassHolder 付費會員卡註冊流程（MVP）

> 本 DEV log 對應 plan [`passholder_付費會員卡註冊流程_7c3fa86f.plan.md`](../../../.cursor/plans/passholder_付費會員卡註冊流程_7c3fa86f.plan.md) + decision [`2026-10-16-pass-holder-paid-membership-snapshot.md`](../runs/decisions/2026-10-16-pass-holder-paid-membership-snapshot.md) + feedback [`20261016-pass-holder-paid-membership-mvp.md`](../runs/improvements/feedback/20261016-pass-holder-paid-membership-mvp.md)。

## Session 目標

擴充 `/pass/{templateId}` 公開註冊頁，當模板是付費會員卡（`isPaid: true`）時：
1. 顯示租戶設計的會員方案（Radio Card）
2. 點擊 Payfast / Ecpay 模擬按鈕（依 currency 切換 + 點擊動態效果）後解鎖 Submit
3. Submit 端把 `selectedTier` + `paymentSnapshot` 寫入 `public.pass_holders` 新欄位

Passcreator API V3 端點尚未實作，先存 DB 即可（**實質上 backend 真實 endpoint 落地 deferred，本 PR 純前端 + mock service**）。

## 流程時序

| 階段 | 動作 | 結果 |
|---|---|---|
| 0 | 讀既有 `PassHolderRegistration/` 結構（主組件 / hooks / types / Form / Header / Success / FieldSet）+ 既有測試（10 條）| 確認接入點是 `FieldSet` 內 + `Form` 下方 |
| 1 | 寫 Decision Log（`runs/decisions/2026-10-16-pass-holder-paid-membership-snapshot.md`）：3 個候選（A 擴充 pass_holders / B 新增 payments 表 / C 單一 JSONB）| 決定 A — 對 atomic register flow 最簡；user 偏好「直接擴充」|
| 2 | 建 migration 檔 `supabase/migrations/20261016000001_023_add_pass_holder_payment_fields.sql`（6 欄位 + CHECK + defensive backfill）| 檔已建 |
| 3 | 嘗試 `apply_migration` via `CallMcpTool server=user-saome-supabase tool=apply_migration` | ⚠️ `MCP descriptor not found`（5 次 retry 全 fail）|
| 4 | 嘗試 `execute_sql` / `list_tables` 驗證 MCP 是不是完全壞掉 | ⚠️ 全部 `descriptor not found` — Cursor runtime 層級 bug |
| 5 | 確認是既有的 Rule 037 第四次犯 pattern（跟 9/30 / 10/03 / 10/11 同）| Per Rule 035 § 4：保留 SQL 檔 untracked，**不 commit** workaround |
| 6 | 擴充 shared types：+ `PublicMembershipTier` / `MembershipTierSnapshot` / `PublicPassTemplate` 加 `currency?` / `isPaid?` / `membershipTiers?` / `PassHolderPayload` 加 4 個 optional 欄位 | typecheck exit 0 |
| 7 | 擴充 i18n：zh-TW + en 都加 `membership.*` 區塊（11 keys 對齊）| Rule 023 翻譯書寫紀律對齊（全中文 / 全英文）|
| 8 | 建 L2 sub-folder `PassHolderMembershipTiers/`（9 檔 + 2 個 stories）：主組件（98 行 ≤ 100）+ Radio Card row（170 行）+ Payment Button（122 行）+ types + helpers + 3 個 test + 2 個 stories | Rule 000 § A.1 + 022 元件化 + 025 Vibe Coding L2 Checklist |
| 9 | 改 `PassHolderRegistration.tsx` 整合：tier / payment state + `submitBlocked` 雙重防護 + 防禦性 onValidSubmit guard + 抽 helpers 檔 | 主組件 98 行 ≤ 100 |
| 10 | 擴充 mock service：demo-gym 加 `isPaid: true` + `currency: 'TWD'` + 2 tiers；新增 demo-gym-zar（ZAR 鏡像）| 後端 endpoint 落地前 mock 即可 |
| 11 | 擴充既有 test：PassHolderRegistration.test.tsx +7 條（paid template 全 flow）、passHolderService.test.ts +4 條 | 共 81 條新 / 擴充 test 全綠 |
| 12 | 跑驗證：typecheck + 4 個 test suite + i18n smoke | 4/4 全綠 + typecheck exit 0 |
| 13 | 寫 feedback + DEV log + INDEX update（本檔 + 上述兩件）| Rule 011 + saome-self-improvement 對齊 |
| 14 | (Deferred) MCP apply + registry entry | P0 next session |

## 衍生

### 2026-10-16 — Decision Log 觸發

新增 `selected_tier_index` / `membership_tier_snapshot` / `payment_provider` / `payment_status` / `paid_amount` / `currency` 6 個欄位 — **Rule 001 § Decision Log 觸發**（新增 DB column migration）。3 個候選：

| A | 擴充 pass_holders 6 欄位（決定 ✅）|
| B | 新增獨立 `public.payments` 表 |
| C | 單一 JSONB `pass_holder_payment_snapshot` 欄位 |

決定 A：對 atomic register flow 最簡、user 偏好「直接擴充」、revenue 規模不需獨立表、mock 階段 schema 演進成本最低。Future Reconsideration Trigger 寫在 decision log（refund / subscription renewal / 真實金流整合 時重評）。

### 2026-10-16 — Rule 037 第四次犯

跟 9/30 + 10/03 + 10/11 同 pattern：MCP `apply_migration` 回 `MCP descriptor not found`。本 session 嘗試 5 個 call 全 fail，包括 `list_tables` / `execute_sql` control test — 確認是整個 `saome-supabase` server descriptor mapping 注入壞掉，**不是 user 對特定工具呼叫方式錯**。

Per Rule 035 § 4：保留 migration SQL 檔 untracked，**不 commit workaround**。下次 Cursor session restart 後再 apply。

### 2026-10-16 — submit 雙重防護 pattern

純前端 gate 用 `disabled={submitBlocked}` 跟 dev tools 強制 enabled button 衝突；純 onValidSubmit guard 跟 UI affordance 衝突。**兩條都做**：

```ts
// UI: button 仍可點（user 點下去會看到 form validation 訊息）
<SubmitButton disabled={isSubmitting ?? pending}>

// JS: onValidSubmit 自己擋住（defense in depth）
if (submitBlocked) return;
```

測試 2 條對應：a) paid template 沒選 tier → 按 submit → `passHolderService.register` **不**被呼叫；b) 選 tier 但沒付款 → 同樣不呼叫。**「form 永遠可送、submit handler 自己擋」是 React 表單的 robust pattern**（不是 disabled 派）。

### 2026-10-16 — 3-state payment machine（不是 4-state）

原 plan 草稿想加 `'error'` 段（mock payment 失敗），但 4 段沒 user-visible trigger（mock 100% 成功）— 3 段 `'idle' | 'paying' | 'paid'` 簡潔夠用。Future 真實金流整合時再加 `'error' | 'failed'`。**YAGNI 的真實版**。

## 自問（待續 action items）

- [ ] **MCP reconnect 後**：(a) `apply_migration` 跑 023 (b) append registry entry (c) 跑 `npm run check:migrations --workspace=apps/backend` 確認 CI gate 過
- [ ] **Backend 真實 endpoint 落地**：(a) Rule 019 § 4.1 二三四層 schema sync (b) Rule 027 postgres.js dynamic query (c) Rule 032 backend jsonb merge silent killer — `membership_tier_snapshot` 是 jsonb 必走 zod 驗證 (d) server-side validate `selected_tier_index` / `currency` / `payment_provider` / `payment_status`
- [ ] **Passcreator V3 整合**：當付費完成後呼叫 Passcreator `/v3/pass` 推送實體 pass（next feature）
- [ ] **真實金流整合**：Payfast / Ecpay API 串接，替換目前 1.5s setTimeout 模擬
- [ ] **Refund / 取消流程**：當前 PR 不處理
