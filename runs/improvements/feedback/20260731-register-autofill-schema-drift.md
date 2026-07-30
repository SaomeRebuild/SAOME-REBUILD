# 2026-07-31 — Register 表單 autofill + schema drift 三連環

> 這個 session 是 tenant 註冊流程的 3 輪 recovery chain。
> 每一輪 root cause 都不同，但共享同一個盲點：沒人在任何一輪問過
> 「瀏覽器會不會在這個 input 裡偷偷塞值？」。

## Index（3 輪同 session）

| Round | 症狀（user-visible） | Root cause | 修法 |
|-------|---------------------|------------|------|
| 1 | 註冊後 `tenants.email` / `mobile` / `website` 欄位永遠是 null | DB schema 缺這三個欄位；前端 payload 帶了，後端 `insertTenant` 沒欄位可寫，靜悄悄丟掉 | 新增 migration 加三欄，Supabase MCP `apply_migration` 跑一次 |
| 2 | 前端 `z.string().min(2)` 過、`POST /api/auth/register` 後端 `z.string().min(1)` 過；後端 stub 跟 shared schema 漂移 | 後端 `request.ts` 是 hand-written `TODO: cp from shared/`，從沒被 sync 過 | 兩邊 schema 對齊；後端 stub 改成 mirror shared（真正的 `from-shared/` pipeline 還沒建，照 `request.ts` 註解標 TODO） |
| 3 | 每筆 `tenants.email` 都長得像 `contact_name_prefix + "@randomdomain.cc"`（例：`contact_name="pjj"` → `email="pjj@jj.mm"`） | Chrome 從 Step 1 的 contact name 欄位「猜」一個值，自動塞進 Step 2 的 `<input type="email" autoComplete="email">`；RHF 把 autofilled DOM value 同步進 `_formValues` 但 `isDirty` 維持 `false` | Step 2 mount 時用 `requestAnimationFrame` x2 + `setTimeout(100)` 清掉 DOM value 跟 RHF `_formValues` |

### 真實 `tenants_rows.json` 證據（2026-07-30 註冊污染的 rows）

```json
[
  { "contact_name": "pjj",              "email": "pjj@jj.mm",                "tax_id": "0" },
  { "contact_name": "zzzzfopdaks",      "email": "zzzzfopdaks@ff.cc",        "tax_id": "0" },
  { "contact_name": "zzz00i09890",      "email": "zzz00i09890@jfoasjfdoi.cc","tax_id": "0" },
  { "contact_name": "qqq98765",         "email": "josh1989213@gmail.com",    "tax_id": "0" }
]
```

第一筆是 autofill 污染（`pjj → pjj@jj.mm`）；第二、三筆同樣模式；
第四筆是 `josh1989213@gmail.com`，是已登入 Chrome profile 真的 email，
證明 Chrome 從 saved profile 同步進來，不是猜的。

## 上游 root cause（不是症狀）

| # | Root cause | 類別 |
|---|------------|------|
| 1 | DB schema 跟 shared zod schema 各走各的，沒有 contract test 綁住。 | **cross-package drift** |
| 2 | 後端留著 `TODO: cp from shared/` stub，從來沒人 sync 過。 | **stale contract** |
| 3 | 沒任何測試抓到 Chrome autofill 在多步表單的 bleed-through。 | **browser API quirk** |
| 4 | RHF `isDirty` 只是 UI 提示，不是 source of truth；沒有任何機制強制「submit 時 `input.value === formState[name]`」。 | **state-source confusion** |
| 5 | `/register` 沒接 Playwright probe 或 smoke test，整個 bug 就這樣流到 production DB 的 rows。 | **missing test layer** |

## Process Lessons（跨 session 的原則）

### Lesson 1 — 瀏覽器會在 input 裡偷塞值，這是常態不是例外

任何 multi-step 表單、任何 `<input type="email" autoComplete="...">`、
任何依賴 RHF `isDirty` 判斷「使用者有沒有改」的邏輯，**都假設**：
「目前 DOM `input.value` = 使用者打過的值」。

這個假設在 Chrome 開啟 autofill 的環境下是錯的。Chrome 會在第一個
raf 之後（甚至到 100ms 內）非同步注入值。RHF 對 DOM 的 listener
（`onChange`）在 autofill 路徑下不一定會被觸發。

**防禦**：mount 時 raf x2 + setTimeout(100) sweep 清空。

### Lesson 2 — `isDirty` 不是 source of truth

RHF 的 `formState.isDirty` 是「使用者至少改過一次欄位」的 UI 提示，
不是「目前值是使用者意圖」。

把 `isDirty` 拿來當「使用者確認過所有欄位」的 gate，是 anti-pattern。

**防禦**：submit 之前對每個欄位讀 `input.value === formState[name]`，
不一樣就以 DOM 為準，並 log 警告（dev mode）。

### Lesson 3 — shared zod schema 是契約，但沒有機制保證它是契約

`packages/shared/schemas/` 假設是 source of truth，但後端
`apps/backend/src/modules/auth/schemas/request.ts` 是 hand-written
stub，兩邊各走各的。沒 CI / 沒 vitest test 把兩邊 `shape` 綁住。

**防禦**：rule 019 強制 conformance test + 推薦
`scripts/check-shared-schema-sync.cjs`。

### Lesson 4 — 新增 DB column 必須是「同一個 commit」內 triple-binding

任何新增的欄位，**必須** 在同一個 commit 內：

1. 寫 migration 加欄位
2. 在 shared zod schema 加 optional field
3. 在後端 `tenants.ts::insertX` 參數列加欄位

任一缺一，後續 round 2 / round 3 類的 drift 就會再出現。

**防禦**：rule 019 migration 紀律條款。

### Lesson 5 — multi-step form 的 state handoff 不能只靠 RHF `reset()`

我們原本 Step 1 → Step 2 的 handoff 只 call `accountForm.reset()`，
但沒考慮：

- 使用者按上一步回 Step 1 時，Step 1 的值如果存在 RHF 還在，但如果
  RHF 重 render 過就丟了。
- 跨 step 的資料傳遞必須有持久層（sessionStorage / context）。

**防禦**：rule 018 多步 handoff 條款。

### Lesson 6 — Playwright probe 比單元測試更早抓到這類 bug

如果 `/register` 有 Playwright probe（不是單純 unit test），
probe 在 Step 2 mount 後等 200ms 讀一次 `input.value`，autofill bug
就直接露餡了。Unit test 用 jsdom 不會觸發 Chrome autofill 邏輯。

**防禦**：skill `saome-form-integrity` Step A 給 Playwright probe 模板。

## 與既有 feedback 的關係

- `20260728-admin-login-scrypt-mismatch.md`（Bug-4b）：同樣是
  「server-side 看起來通了，user-visible 不通」的主題。本 feedback
  把它延伸到 client-side 跟 DB schema 兩個新面向。
- `20260728-saome-13-frontend-session.md` Lesson 6
  （`zod input/output type divergence`）：本 feedback Round 2
  是同類問題的 sibling，但這次是跨 package 而不是 schema 內部。

## Open follow-ups（未在此 session 完成）

1. 把 `apps/backend/src/modules/auth/schemas/request.ts` 的
   `TODO: cp from shared/` 真正換成 `export * from '@/shared/schemas/from-shared/auth';`
   （需要先建 `from-shared/` 拷貝 pipeline）。歸在 rule 019。
2. 加 Vitest conformance test 綁住 `localSchema.shape === sharedSchema.shape`。
   歸在 rule 019。
3. `apps/frontend/scripts/audit-bundle-urls.cjs` 已經有了；建議
   新增 `apps/backend/scripts/check-shared-schema-sync.cjs`
   （見 plan optional-script 段）。
4. 把 `tests/probe/register-probe.ts` 從「debug 用 probe」轉成
   「integration smoke test」 — 每次 deploy 前跑，斷言
   `emailInputAfterTyping === expectedTypedValue`。

---

Refs:
- `apps/frontend/src/components/business/auth/RegisterForm/RegisterForm.tsx`
- `apps/backend/src/modules/auth/schemas/request.ts`
- `apps/backend/src/modules/auth/db/tenants.ts`
- `apps/backend/migrations/001_init_users_tenants.sql`
- `packages/shared/schemas/auth.ts`
- `tests/probe/register-probe.ts`
- `tenants_rows.json`（autofill 污染的證據）
- Plan: `register_autofill_+_schema_alignment_c601f2a8.plan.md`
- New rules: `.cursor/rules/018-form-autofill-and-multi-step-state.mdc`,
  `.cursor/rules/019-schema-contract-drift.mdc`
- New skill: `.cursor/skills/saome-form-integrity/SKILL.md`