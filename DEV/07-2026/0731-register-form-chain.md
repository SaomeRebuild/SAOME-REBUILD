# 2026-07-31 Register 表單三連環 — Deep Dive

> 對應 `runs/improvements/feedback/20260731-register-autofill-schema-drift.md`。
> 已 commit 到 `DEV/07-2026/0731-register-form-chain.md`（操作層）。

---

## 為什麼要寫這份

Feedback file 是「規則層」的紀錄（root cause + lesson + follow-up）。
這份是「操作層」的 deep dive — 重現時間軸、每輪的真實 commit、
以及「為什麼某個修法會 / 不會 work」的技術細節。

如果未來有人看到 rule 018 / 019 / skill `saome-form-integrity`
時好奇「這條 rule / skill 對應的真實 bug 長什麼樣子、修法寫在哪」，
來這裡讀。

## 事故時間軸

```
T0: 前一個 session 結束
    - admin-login recovery chain (2026-07-28) 修完
    - 後端 tenants table 已有欄位: id, owner_user_id, name,
      contact_name, phone_city, address, tax_id, invoice_address,
      created_at (沒有 email / mobile / website)

T1: 開發者開新 session 開始修 tenant 註冊流程
    - 註冊 UI 已經寫好 (RegisterForm.tsx, Step 1 + Step 2)
    - Step 2 要填 email / password / mobile / website
    - Submit 帶完整 payload 到 POST /api/auth/register

T2: Round 1 — 後端 registerService.ts::insertTenant 沒 insert
    - DB 沒有 email / mobile / website 欄位
    - 前端送的值靜悄悄丟掉
    - 用 Supabase MCP apply_migration 加三欄

T3: Round 2 — 後端 zod schema 對前端擋下
    - 前端 registrationPayloadSchema: name min(2)
    - 後端 stub: name min(1)
    - 但 backend 沒有 businessEmail / mobile / website optional field
    - 兩邊對齊，把後端 stub 改成 mirror shared

T4: Round 3 — Chrome autofill 污染
    - 真實測試註冊，進 production DB
    - 每一筆 email 長得像 contact_name_prefix + "@xxx"
    - 範例: pjj → pjj@jj.mm
    - 修法: Step 2 mount 時 raf+timeout sweep 清 DOM + RHF

T5: Self-improvement session (本 session)
    - 寫 feedback
    - 寫 rule 018 + 019
    - 寫 skill saome-form-integrity
    - 寫 check-shared-schema-sync.cjs
```

## 三輪的真實污染證據

`tenants_rows.json` 是 production DB 在 2026-07-30 被污染的 4 筆 rows。
**這份檔案 commit 進 repo 是當作 feedback 證據**，未來不要清掉。

| id | contact_name | email | 解讀 |
|----|--------------|-------|------|
| 1fd952e2... | `pjj` | `pjj@jj.mm` | Chrome 從 contact name 猜的 (Round 3 典型) |
| 5a78876c... | `zzzzfopdaks` | `zzzzfopdaks@ff.cc` | 同樣模式 |
| c7ad470f... | `zzz00i09890` | `zzz00i09890@jfoasjfdoi.cc` | 同樣模式 |
| eae3ccc5... | `qqq98765` | `josh1989213@gmail.com` | **Chrome 從 saved profile 撈的真實 email** |

第 4 筆特別值得注意 — 它不是「猜」的，是從 Chrome 已登入 profile
（Google account = josh1989213@gmail.com）直接同步進來。這證明 autofill
不只會拼奇怪的值，還會直接打 user 真實的 credential。

> **如果這是 B2B 表單，且使用者用公司 email 登入 Chrome，會把公司的
> email 自動填進「公司註冊 email」欄位 — 這就是企業內部註冊資料外洩
> 的攻擊面。**

## Round 3 修法細節（autofill dual-fix）

```ts
// apps/frontend/src/components/business/auth/RegisterForm/RegisterForm.tsx
useEffect(() => {
  if (step !== 1) return;
  const clearAutofill = () => {
    const emailInput = document.querySelector<HTMLInputElement>('input[name="email"]');
    if (emailInput && emailInput.value !== '') {
      emailInput.value = '';
    }
    accountForm.setValue('email', '', { shouldDirty: false });
    accountForm.setValue('password', '', { shouldDirty: false });
    accountForm.setValue('confirmPassword', '', { shouldDirty: false });
  };
  const raf1 = requestAnimationFrame(clearAutofill);
  const raf2 = requestAnimationFrame(() => requestAnimationFrame(clearAutofill));
  const timeoutId = window.setTimeout(clearAutofill, 100);
  return () => {
    cancelAnimationFrame(raf1);
    cancelAnimationFrame(raf2);
    window.clearTimeout(timeoutId);
  };
}, [step, accountForm]);
```

### 為什麼 raf x2 + setTimeout(100)？

Chrome autofill 在三個時機點會非同步觸發：
1. 第一個 `requestAnimationFrame` (mount 後 ~16ms)
2. 第二個 `requestAnimationFrame` (mount 後 ~32ms，Chrome 內部第二次 layout)
3. `setTimeout(..., 100)` (保險絲，覆蓋 Chrome 真的慢到 100ms 才 inject)

只設 `autoComplete="off"` 不夠 — Chrome 把 `off` 視為「hints」，
不是強制指令。

### 為什麼 `setValue(name, '', { shouldDirty: false })` 而不是 `setValue(name, null)`？

`setValue` 帶 `null` 會 trigger `formState.dirtyFields[name] = true`，
等於告訴 RHF「使用者改了這個欄位」。但使用者根本沒打字，這會污染
「使用者改了哪些欄位」的判斷。

`{ shouldDirty: false }` 是 explicit 告訴 RHF：「這個改不是 dirty」，
未來 rule 018 的「submit 時 reconcile DOM vs RHF」用 `formState[name]`
還是空字串。

### 為什麼也要清 `password` / `confirmPassword`？

1Password / LastPass 等 password manager 不靠 autofill attribute，
而是直接 hook DOM。`<input type="password">` mount 時它們就會 inject。

如果不清空，submit 帶的值是 password manager 儲存的密碼（很可能
是 user 登入 google 的密碼 — 不是他要註冊 saome 的密碼）。

> 這條在 rule 018 沒有明寫，是這次 deep dive 才補的：**任何
> multi-step form 含 password 欄位，必清 password 跟 confirm password**。

## Round 2 修法細節（schema 對齊）

### 對齊前

`apps/backend/src/modules/auth/schemas/request.ts::registrationPayloadSchema`：

```ts
export const registrationPayloadSchema = z.object({
  name: z.string().min(1, 'validation.required'),
  contactName: z.string().min(1, 'validation.required'),
  phoneCity: z.string().min(1, 'validation.required'),
  address: z.string().min(1, 'validation.required'),
  taxId: taxIdSchema,
  invoiceAddress: z.string().min(1, 'validation.required'),
  // ❌ 缺 mobile / website / email / password
});
```

`packages/shared/schemas/auth.ts::registrationPayloadSchema`：

```ts
export const registrationPayloadSchema = tenantInfoSchema.merge(
  accountInfoBase.omit({ confirmPassword: true }),
).extend({
  invoiceAddress: z.string().min(1, 'validation.required').max(500),
});
```

`accountInfoBase` 已經含 `email` / `password` / `mobile` / `website` /
`businessEmail`，shared 透過 `.merge()` 把它們全合併進來。
後端 stub 完全不知道這些欄位的存在 → Round 2 對齊把它們補上。

### 對齊後（後端 stub）

```ts
export const registrationPayloadSchema = z.object({
  // tenantInfo fields (required)
  name: z.string().min(1, 'validation.required'),
  contactName: z.string().min(1, 'validation.required'),
  phoneCity: z.string().min(1, 'validation.required'),
  address: z.string().min(1, 'validation.required'),
  taxId: taxIdSchema,
  invoiceAddress: z.string().min(1, 'validation.required'),
  // optional tenantInfo fields
  mobile: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  // accountInfo fields (confirmPassword is omitted — frontend doesn't send it)
  email: z.string().email('validation.email'),
  password: z.string().min(8, 'validation.passwordTooShort'),
});
```

### 為什麼後端沒把 `min(2)` 改成 `min(2)`？

題外：shared 是 `.min(2)`，後端對齊後還是 `.min(1)`。**這是 drift**。
未來 follow-up #3 (rule 019 conformance test) 會抓。

但目前沒造成 user-visible bug，因為前端在送 payload 之前就擋掉
`min(2)`，根本不會送長度 < 2 的字串到後端。後端 `.min(1)` 只是
「**沒那麼嚴**」的檢查，不會 fail。

→ 結論：rule 019 conformance test 是必要的，目前這個 drift 是
silent drift，下次前端改了 `min(2) → min(3)` 沒同步後端，會突然壞掉。

## check-shared-schema-sync.cjs 設計演進

### 第一版（只認 `z.object({...})`）

```js
// 從 source 找 'z.object({' 然後 regex 抓 fields
```

壞處：shared 用 `.merge()` + `.extend()`，第一版只能抓到
`tenantInfoSchema` 的 5 個欄位 → false-positive 報一堆 drift。

### 第二版（支援 `.merge()` + `.extend()`）

```js
// 解析 merge() 引用的其他 schema，重組完整 field set
// 用 `export const <name> = ...;` 抓 referenced schema 的定義
```

壞處：regex-based parser 本質 fragile，schema 組合方式一變（例如
`.pipe()` / `.transform()` / 深層 `.omit({...})`）就要改 script。

### 第三版（final）

加 `BACKEND_OMITTED`（intentional omit，例如 `confirmPassword`）
跟 `KNOWN_DRIFT`（已知 drift，等 follow-up 修）。

### 為什麼不用 tsx loader 直接 import？

```js
// 想這樣：
import { registrationPayloadSchema as shared } from 'packages/shared/schemas/auth';
import { registrationPayloadSchema as local } from 'apps/backend/.../request';
// 直接比對 shared.shape 跟 local.shape
```

但 `registrationPayloadSchema` 的形態依賴 runtime zod context
（特別是 `.merge()` 跟 `.extend()`），用 `z.toJSONSchema()` 或
`Object.keys(registrationPayloadSchema.shape)` 在 source 層
（不是 runtime）比對反而比較穩。

下次如果用 `tsx`，必須跑 Vitest 而不是 Node CLI script — 否則
import 整個 zod tree 會 pull-in 一堆 transitive deps。

## Playwright probe (`tests/probe/register-probe.ts`) 的設計

### 為什麼 probe 在 `tests/probe/` 而不是 `tests/smoke/` 或 `tests/e2e/`？

- `smoke/` 是 deploy 後跑的 e2e（見 rule 005）
- `e2e/` 是 user-flow 測試
- `probe/` 是「debug 用」一次性 probe，**證明 bug 存在但不接到 CI**

這個 probe 證明 autofill bug 真的存在，但因為 hard-code 一個 sandbox
的 `chrome.exe` 路徑，沒辦法直接接到 CI。轉成正式 test 是 follow-up #4。

### Probe 抓的 4 個東西

1. **Step 1 inputs' `value` 在 `page.fill()` 後** — baseline
2. **Step 2 inputs' `value` 在 raf 1 / raf 2 / +100ms** — 證明 autofill
   真的在某個 tick 把值塞進來
3. **每個 tick 的 RHF `_formValues`** — 證明 RHF 有 / 沒有同步 autofill
4. **`emailValueAfterTyping` 在使用者真的 `page.fill(...)` 後** — 證明
   「正常使用」路徑沒被 autofill 修法打壞

## 跟之前事故的關係

| Session | 事故 | 新增 rule / skill | 共通盲點 |
|---------|------|-------------------|---------|
| 2026-07-28 | admin-login scrypt + bundle localhost + CORS + 缺 navigate + hardcoded color | rule 017 (bundle guard), AGENTS.md Auth/CORS | 沒主動 grep / curl 驗證 server-side 通不等於 user-visible 通 |
| 2026-07-31 | DB schema 缺欄 + 後端 stub drift + Chrome autofill 污染 | rule 018 (autofill), rule 019 (schema drift), skill saome-form-integrity | 沒主動驗證「值從哪裡來」— server 給的、瀏覽器給的、user 給的，沒分清楚 |

兩個 session 的教訓都是同一個核心：

> **不要假設程式收到的值就是你預期的來源。**
> 主動 trace、grep、curl、probe，直到值能被溯源。

下次 session 開頭如果讀 `.cursor/skills/saome-self-improvement/SKILL.md`，
會看到這條 lesson 已經被整合進去 — 任何 commit 前必跑 trace 驗證。

## Open questions（未解答）

1. **Step 2 form 要不要顯示 mobile / website / businessEmail 三個 optional 欄位？**
   - 顯示：schema 領先 UI 的狀態結束，user 真的可以填
   - 不顯示：維持 schema 領先 UI 狀態，但 `check-shared-schema-sync.cjs`
     的 `businessEmail` 會一直掛在 `KNOWN_DRIFT`
   - 砍欄位：後端 stub、shared schema 都移除，可永久解 `businessEmail` drift
2. **`autoComplete="off"` 在 React JSX 怎麼寫最對？** 純 `autoComplete="off"`
   還是有 React-specific 寫法？目前 React 19 對 `autoComplete` prop 是
   直接映射到 HTML attribute，但 user agent hint 行為還是 Chrome 自己決定。
3. **password manager (1Password / LastPass) 的 hook 順序？** 我們的
   raf+timeout sweep 順序是否能搶在他們之前？目前測過 Chrome 沒問題，
   但 1Password 行為沒驗證過。

這些是 follow-up 該走 L3 Heavy (brainstorming + decision log) 的題目，
不是這次 session 能解決的範圍。