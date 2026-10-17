---
date: 2026-10-16
title: 付費會員卡 UI 沒出現會原方案 / 付費按鈕 — settings JSONB 投影遺漏
status: resolved
severity: SEV-2 (部分 user failure, 付費 template 看不見付費 UI)
component: pass-templates / public page
related:
  - runs/decisions/2026-10-16-pass-holder-paid-membership-snapshot.md
  - .cursor/rules/019-schema-contract-drift.mdc § 4.1
  - .cursor/rules/035-migration-apply-pipeline.mdc
---

# Symptom

User 開 `http://localhost:5173/pass/738d9a5e-7f25-414b-b0d9-0c3abce8cf52`（一個 `card_type = membership_card` 的後端 template），預期看到會原方案 Radio Card list + 付費按鈕（Ecpay / Payfast），但畫面上完全沒出現這段 UI，只剩 4 個 pass-delivery 欄位。

# Root cause

Backend `getPublicTemplateService` 從 `public.templates` 投影的 column 沒有包含 paid-membership 欄位，所以前端永遠拿不到 `isPaid` / `membershipTiers` / `currency`：

```sql
-- before (apps/backend/src/modules/pass-templates/db/templates.ts)
SELECT id, name, card_type, settings, passcreator_template_id
  FROM public.templates
 WHERE id = $1
```

而 `settings` JSONB 內**確實**有這些欄位（CardBuilder 編輯器會寫入 `settings.isPaid` / `settings.currency` / `settings.membershipTiers`），但後端 SELECT 沒把它們 `settings->>'isPaid'::boolean` / `settings->'membershipTiers'` / `settings->>'currency'` 提到 top-level column。

`PassHolderRegistration.tsx` 的 gate：

```ts
const isPaidTemplate = Boolean(template.isPaid && template.membershipTiers?.length);
```

`template.isPaid` 永遠 `undefined` → `Boolean(undefined) === false` → `PassHolderMembershipTiers` 完全不渲染。

# Design lesson

**Frontend feature shipped without backend read-path proof.**

2026-10-16 的 paid-membership MVP 完成了：

- Frontend L2 元件（`PassHolderMembershipTiers` / `PaymentButton`）
- Frontend helper（`buildMembershipTierSnapshot` / `resolvePaymentFields`）
- Frontend service mirror（`SAMPLE_TEMPLATES` 內 `demo-gym` / `demo-gym-zar`）
- Migration `20261016000001_023_add_pass_holder_payment_fields.sql`（打到 `pass_holders` 表）
- Shared types（`PublicMembershipTier` / `MembershipTierSnapshot`）
- i18n `membership.*` 11 keys

但**漏掉了 backend read path**：

1. `findPublicTemplateById` / `findPublicTemplateWithTenantById` 沒從 `settings` 投影 paid 欄位
2. `PublicTemplateRow` / `PublicTemplateRowWithTenant` interface 沒這 3 個欄位
3. `PublicPassTemplateDto` 沒這 3 個欄位
4. `getPublicTemplateService` 沒 map 這 3 個欄位
5. `PublicPassTemplate`（Layer 1）宣告了，但 Layer 2 / 3 / 4 沒對齊 → Rule 019 § 4.1 四層同步破

Mock 模式測試看起來全綠（`SAMPLE_TEMPLATES.demo-gym` 自己 hardcode 了這些欄位），但 production data path 完全沒驗。

# Fix

`apps/backend/src/modules/pass-templates/db/templates.ts` 改 SQL 投影（不需要 DB migration — 欄位已經在 `settings` JSONB 內）：

```sql
SELECT id, name, card_type,
       settings,
       (settings->>'isPaid')::boolean AS is_paid,
       settings->'membershipTiers'   AS membership_tiers,
       settings->>'currency'         AS currency,
       passcreator_template_id
  FROM public.templates
 WHERE id = $1
```

`getPublicTemplateService` 在 `is_paid === true` 時 conditional spread：

```ts
...(row.is_paid
  ? {
      isPaid: true,
      currency: row.currency ?? 'TWD',
      membershipTiers: normalizeMembershipTiers(row.membership_tiers),
    }
  : {}),
```

`normalizeMembershipTiers` 純函式 defensive normalize 自由格式 JSONB（drop 無 name 的 row、default `durationType: 'monthly'`、filter 空 rewards），輸出 typed `PublicMembershipTier[]`。

# 順手補的

1. **Migration 023 終於 apply** — MCP descriptor reconnected 後 `apply_migration` 成功，registry entry 已 append，`npm run check:migrations` 21 條 OK。
2. **Register write path 補完**（Rule 019 § 4.1 第四層）：
   - `passHolderRegisterPayloadSchema` 加 optional `selectedTierIndex` / `membershipTierSnapshot` / `paymentProvider` / `paymentStatus`
   - `upsertPassHolder` SQL 寫入 6 個 paid 欄位，JSONB 用 `sql.json()` 避開 workerd pitfall（Rule 027）
   - `registerService` 把 optional 欄位 pass through
3. **新測試 18 條**：`getPublic.test.ts` 加 5 條 paid-membership 投影 + 5 條 `normalizeMembershipTiers` 純函式 + 既有 conformance 補欄位；`passHolderService.test.ts` HTTP mode 加 1 條 regression「response drops 這些欄位 → picker 消失」。

# Why this is structural (not just a one-off)

兩個結構性因素導致這個 bug：

1. **Mock 模式 false positive**：`SAMPLE_TEMPLATES` 在 `passHolderService.ts` 內 hardcode 了 `demo-gym` / `demo-gym-zar`，包含 paid 欄位。所以 mock-mode 測試（`.env.test` 設 `VITE_USE_PASS_MOCK=true`）會通過，但真實 backend 永遠不會回這些欄位。Mock 模式和真實 backend 模式必須有「**同樣 field set**」的 conformance 測試。
2. **JSONB-as-source-of-truth hidden coupling**：`settings` 內任何 nested field 都可能需要被 public page 讀到（`isPaid` / `currency` / `membershipTiers` / `language` / `logoText` / ...），但 SQL 投影每次都要手動加，未來加新欄位極易漏。長期應該把「對外可見的欄位」收進一個 zod schema + 一個 `projectPublicSettings` 純函式，service 層 call 一次就好。

# Follow-up

- [ ] **Mock-vs-HTTP field set conformance 測試**（high）：在 `passHolderService.test.ts` 加一條 assertion「mock mode 跟 HTTP mode 拿到的 `PublicPassTemplate` 欄位集合完全一致」— 缺一即 fail，鎖死未來 drift。
- [ ] **`projectPublicSettings` 純函式**（P2）：把 `settings->'logoText'` / `settings->'issuerName'` / `settings->'language'` / `(settings->>'isPaid')::boolean` / 等集中到 `db/templates.ts` 一個函式，service call 一次。順便加 unit test。
- [ ] **CardBuilder editor 寫入 audit**（P2）：確認 `CardBuilderEditor` 真的會把 `isPaid` / `membershipTiers` / `currency` 寫進 `settings` JSONB。User 的 `搭哈哈` template 已經有這些欄位在 settings，所以 OK；但要 audit 既有 24 個 template 哪些是 paid、哪些不是，避免 onboarding 時 user 看不到自己明明選了付費。
- [ ] **Passcreator V3 `/v3/pass` 整合**（P1）：見 `runs/decisions/2026-10-16-pass-holder-paid-membership-snapshot.md` 候選 B。

# Verification

- `npx tsc -b apps/frontend apps/backend packages/shared --noEmit` → exit 0
- `npm run check:migrations --workspace=apps/backend` → 21 migrations OK
- `npm test --workspace=apps/backend` → 40 files / 671 tests passed
- `npm test --workspace=apps/frontend -- src/components/business/pass/PassHolderRegistration` → 4 files / 48 tests passed
- `npm run verify:i18n --workspace=apps/frontend` → 21 namespaces OK（Payfast/Ecpay brand-name WARNs 預期）
- MCP `apply_migration` 2026-10-16 → `{"success": true}`
- DB query: `SELECT column_name FROM information_schema.columns WHERE table_name='pass_holders' AND column_name IN (...)` → 6 rows 確認
- DB query: `SELECT settings->>'isPaid', settings->>'currency', jsonb_array_length(settings->'membershipTiers') FROM public.templates WHERE id='738d9a5e-7f25-414b-b0d9-0c3abce8cf52'` → `true, ZAR, 2`
