# Decision Log — 2026-07-31 — Add optional `mobile` field

## 背景

使用者請求「我想要加一個非必填欄位'手機號碼'」。

這個任務意外**撞到 schema 漂移** — `mobile` 在某個過去的 session 已經
被加進 backend stub 跟 DB migration，但**從來沒被 wire 進前端 UI**。
shared schema 還把它放在 `accountInfoBase`（Step 2），但 Step 2
form 也不 render。這是 rule 019 列為 KNOWN_DRIFT 的延伸症狀。

具體衝突：

| 表面 | `mobile` 狀態 |
|------|--------------|
| DB column `tenants.mobile` | ✅ 存在，`text NULL`（migration 001） |
| Backend `apps/backend/.../request.ts::registrationPayloadSchema` | ✅ 有：`mobile: z.string().optional().nullable()` |
| Backend `registerService` 寫入 | ✅ 有：`mobile: payload.mobile ?? null` |
| Backend `tenants.ts::insertTenant` | ✅ 有（line 105 已 accept） |
| Backend tests `register.test.ts` | ✅ `validPayload.mobile: '0912345678'` 期望通過 |
| **Shared `tenantInfoSchema`** | ❌ 沒有 |
| **Shared `accountInfoBase`** | ⚠️ 有 (`/^(\+?\d{8,15})?$/`)，但沒人用 |
| **RegisterForm UI** | ❌ 沒有 `mobile` input |
| **i18n keys** | ❌ 沒有 `register.mobile` / `validation.mobileInvalid` |

如果直接從 `accountInfoBase` 把 `mobile` 拉出來，schema 對齊 + UI wire up
會自然 fall into place — 但「手機號碼」語意應該是店家的（owner / store cell）
還是帳號擁有者的（user login cell）？

## 選項與決定

### 選項 A — `mobile` 放 `tenantInfoSchema`（店家手機）

店家對外提供聯絡用的 cell phone。與 `phoneCity`（公司室話 / 市內電話）
語意互補，但兩者都是「店家」所有，不是「帳號擁有者」。

優點：
- 與 DB column `tenants.mobile` 一致
- 與 `phoneCity` 同在 Step 1，使用者填的時候知道是「店家資料」
- 後端 stub 已把 `mobile` 視為 tenant info 處理（line 41）

缺點：
- Schema 變更擴大 `tenantInfoSchema`，需配套 i18n + form field

### 選項 B — `mobile` 仍放 `accountInfoBase`（帳號擁有者手機）

帳號擁有者登入用的 cell phone（用於 MFA / 簡訊驗證，未來擴充）。

優點：
- 與既有 `accountInfoBase.mobile` 位置一致

缺點：
- 沒有 DB column 對應（`users` 沒有 `mobile` column）
- 與使用者需求「店家資料」語意不符

### 選項 C — 兩個都留，未來再決定

保留 `accountInfoBase.mobile` 給 MFA 用，新增 `tenantInfoSchema.mobile` 給現在的需求。

優點：
- 不破壞未來 MFA 預留

缺點：
- Schema / DB 同步成本加倍，且目前 MFA 還沒在做（**YAGNI**）
- 規則 019 的 KNOWN_DRIFT 已經在擴大，再開新欄位會被誤導

### ✅ 決定：選項 A

把 `mobile` 移進 `tenantInfoSchema`（店家 / store cell phone），強
化 regex 成為 **E.164**：

```
/^\+?[1-9]\d{7,14}$/
```

E.164 規則：
- 可選 `+` 開頭
- 第一個數字 1-9（不能 0 開頭）
- 總長度 8-15（含選擇 +）
- 全數字

這涵蓋：
- 台灣手機：`0912345678` (10 digits, no +)
- 國際：`+886912345678` (+886 9xxxxxxxx，共 12 chars)
- 美國：`+14155551234`

#### 強化細節

1. **從 `tenantInfoSchema` 加 `mobile`**，regex 用 E.164 嚴格版
2. **從 `accountInfoBase` 移除 `mobile`**（選項 C 的「未來再決定」 —
   真要 MFA 用的時候再加回來）
3. **frontend `RegisterForm.tsx` Step 1**：在 `phoneCity` 下加
   `<Field label="Mobile" optional>`，input 用 `type="tel"` +
   `autoComplete="tel"`
4. **autofill 防護**：現有的 raf+timeout sweep 只清 account form
   的 `email/password/confirmPassword` — 不會影響 `mobile`。
   但既然 `tenantForm` 會 `reset(saved)` 從 sessionStorage 還原，
   不需要擔心 autofill 污染。需要注意的是：chrome autofill 一旦
   觸發不會因為 input 是 `type="tel"` 就跳過，所以加 `autoComplete="tel"`
   明確告訴 chrome 「這欄位接 cell phone」。rule 018 涵蓋這個情境。
5. **i18n keys**：`register.mobile`、`validation.mobileInvalid` 兩個 locale 都加

## 影響

| 表面 | 影響 |
|------|------|
| `packages/shared/schemas/auth.ts` | + `tenantInfoSchema.mobile`；− `accountInfoBase.mobile` |
| `packages/shared/schemas/auth.test.ts` | 加 `mobile` happy/sad path test；移除 `accountInfoBase.mobile` test |
| `apps/backend/src/modules/auth/schemas/request.ts` | regex 強化成 E.164 |
| `apps/frontend/.../RegisterForm.tsx` | Step 1 加 mobile Field；defaultValues 加 `mobile: ''` |
| `apps/frontend/src/i18n/locales/auth.{en,zh-TW}.json` | + `register.mobile`、`validation.mobileInvalid` |
| `apps/backend/scripts/check-shared-schema-sync.cjs` | 不變（mobile 仍在 backend field set） |
| DB migration | 不變（`tenants.mobile` column 已存在） |
| DB write path | 不變（`registerService.ts` 已寫） |

## 不做的事

- **不做** `accountInfoBase.mobile` 的「未來 MFA 用」保留（YAGNI —
  MFA 還沒排程）
- **不改** DB column `tenants.email text NOT NULL`（這是 another
  bug — Chrome 自動填污染的根因；rule 018 已經在對抗，但 schema
  沒跟著放寬成 NULL；留為 separate follow-up）
- **不**把 `phoneCity` 改成 optional（使用者已確認保留）
- **不**改 `domainData` 既有 validPayload 的 `mobile: '0912345678'`
  進 step 1 — 那個值其實是 hard-code 的測試 fixture；既然現在
  mobile 變 optional，validPayload mobile 從 `+886912345678` 改為
  optional 測試也會過
