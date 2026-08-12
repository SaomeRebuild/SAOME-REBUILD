# Renewal Reminder Debug Chain — i18n + schema drift + CI TS6198

## Metadata

- **日期**：2026-08-12
- **作者**：Josh（agent-assisted via Cursor）
- **commit hash**：
  - `94132f4` — refactor(i18n): split dashboard duplicate keys + extract pass-notification namespace
  - `1b9c73f` — fix(i18n): correct namespace 'pass-notification' → 'passNotification' (camelCase per resources key)
  - `7f59007` — fix(auth): add phase, paidAt, billingCycleEnd to authSessionSchema pass object
  - `3953efe` — fix(frontend): prefix unused TenantToolbar props with _ to satisfy TS6198
- **規則 / skill 觸發**：`saome-dev-logging`、`saome-form-integrity`、`019-schema-contract-drift`

---

## 症狀

### Bug 1 — Renewal Reminder 通知「吃不到字」

- **環境**：production（租戶端 Dashboard）
- **觸發條件**：登入後看到 Dashboard，出現 `renewalReminder` notification
- **觀察到的錯誤**：notification 的 `title`、`subtitle`、`cta` 顯示 raw key（如 `passNotification.renewalReminder.title`），而非翻譯後的中文字
- **預期 vs 實際**：
  - 預期：`title` = "本月剩餘 {{daysLeft}} 天"
  - 實際：`title` = `passNotification.renewalReminder.title`（raw key）

### Bug 2 — renewalReminder 條件永遠不成立

- **環境**：production
- **觀察到的錯誤**：即使處於 trial 階段，Dashboard 也不顯示 `trial` notification
- **根因 trace**（見 Bug 3 detail）：`authSessionSchema.pass` 缺少 `paidAt`、`phase`、`billingCycleEnd` 三個欄位，zod parse 時這三個欄位被靜默 strip

### Bug 3 — CI build fail (TS6198)

- **環境**：Cloudflare Pages deploy pipeline
- **觸發條件**：`npm run build` → TypeScript compile
- **觀察到的錯誤**：`TS6198: 'defaultWidth' is declared but its value is never read`
- **預期 vs 實際**：
  - 預期：build pass
  - 實際：build fail，block deploy

---

## 探針 / 重現

### Bug 1 — i18n namespace mismatch

**診斷過程**：

1. 檢查 `pass-notification.zh-TW.json` 的 key 結構：
   ```json
   {
     "renewalReminder": {
       "ariaLabel": "{{daysLeft}} 天剩餘",
       "title": "{{daysLeft}} 天剩餘",
       "subtitle": "請完成付款以確保服務不中斷",
       "cta": "前往付款"
     }
   }
   ```
2. 檢查 `src/i18n/index.ts` 的 resources 綁定：
   ```ts
   passNotification: passNotificationZhTW, // key 是 camelCase
   ```
3. **檔名**：`pass-notification.zh-TW.json`（hyphen format）
4. **問題**：load path 用 `-`（hyphen），但 i18next resources key 用 camelCase `passNotification`
5. **驗證**：直接 `curl` bundle 確認 key 有在檔案內

**結論**：檔名 `pass-notification.zh-TW.json` 的 hyphen 與 resources key `passNotification`（camelCase）mismatch，導致 namespace 載入失敗。

---

### Bug 2 — Schema parse 靜默丟欄位

**診斷過程**：

1. `useAuth.ts` 的 `renewalReminder` 邏輯：
   ```ts
   const showRenewalReminder =
     pass?.phase === 'trial' && daysLeft <= 3 && !pass.paidAt;
   ```
2. 檢查 `authSessionSchema`（`packages/shared/schemas/auth.ts`）：
   ```ts
   pass: passSchema.optional(),
   ```
3. 檢查 `passSchema`（`packages/shared/schemas/pass.ts`）：
   - 缺少 `paidAt`、沒有 `phase`、沒有 `billingCycleEnd`
4. **驗證**：後端 `refresh` route 回傳的 SQL row 確實有這三個欄位，但前端 zod parse 時被 strip

**Schema drift 鏈**：
- `passes` table → `billing_cycle_end`、`paid_at`、`phase` 都有（migration 004）
- Backend `refresh` route → SQL query 正確取出這三個欄位
- Frontend `authSessionSchema.pass` → zod schema 沒定義這三個欄位 → parse 時 strip
- Result：`pass.phase` 永遠是 `undefined` → `showRenewalReminder` 永遠 `false`

---

### Bug 3 — TS6198 CI build fail

**根因**：`TenantToolbar.tsx` 宣告了 `defaultWidth` 與 `onWidthChange` props 但未使用：

```tsx
export const TenantToolbar = ({
  defaultWidth,
  onWidthChange,
  tenant,
  role,
}: TenantToolbarProps) => { ... }
```

TypeScript strict mode 視未使用的參數為 error（TS6198）。

**修法**：加 `_` prefix 明確標示為 intentionally unused：
```tsx
export const TenantToolbar = ({
  _defaultWidth,
  _onWidthChange,
  tenant,
  role,
}: TenantToolbarProps) => { ... }
```

---

## 根因

> **一句話結論**：三個獨立的 bug chain 在同一個 feature（Dahsboard renewalReminder）上重疊爆發——i18n namespace load fail、schema parse 靜默 strip 新欄位、CI TS6198 block build。

### Bug 1 — i18n namespace naming mismatch

i18next 的 resources key（`passNotification`）與檔名（`pass-notification.zh-TW.json`）格式不一致。`index.ts` 用 camelCase import，load path 用 hyphen filename，導致 namespace 載入失敗，`t('passNotification.renewalReminder.title')` 回傳 raw key。

### Bug 2 — Schema parse strip 新增欄位

`authSessionSchema.pass`（zod）比實際後端 SQL row 少 3 個欄位。zod parse 時額外欄位被 strip，導致 `pass.phase` 永遠 `undefined`，`renewalReminder` 條件判斷失效。

這是 schema drift 的經典 pattern——migration 加了 DB column，shared schema 沒同步，backend `refresh` route 沒在 `authSessionSchema.parse()` 之前修正。詳見 `019-schema-contract-drift.mdc` § 1 鐵律。

### Bug 3 — TS6198 unused variable in production code

`TenantToolbar` 元件宣告未使用的 props，TS6198 在 strict mode 下是 error，導致 CI build fail，block 所有後續 deploy。

---

## 修法

### Bug 1

| 檔案 | 變更 |
|---|---|
| `apps/frontend/src/i18n/locales/pass-notification.zh-TW.json` | rename to `passNotification.zh-TW.json` |
| `apps/frontend/src/i18n/locales/pass-notification.en.json` | rename to `passNotification.en.json` |
| `apps/frontend/src/i18n/index.ts` | 確認 import key 是 `passNotification`（已正確） |
| **commit** | `94132f4` + `1b9c73f` |

### Bug 2

| 檔案 | 變更 |
|---|---|
| `packages/shared/schemas/pass.ts` | 加 `paidAt`、`phase`、`billingCycleEnd` 至 `passSchema` |
| `packages/shared/schemas/auth.ts` | 確認 `authSessionSchema.pass` 使用更新後的 `passSchema` |
| **commit** | `7f59007` |

### Bug 3

| 檔案 | 變更 |
|---|---|
| `apps/frontend/src/components/layout/TenantToolbar.tsx` | `defaultWidth` → `_defaultWidth`、`onWidthChange` → `_onWidthChange` |
| **commit** | `3953efe` |

---

## 衍生

### 已知殘留問題

- 既有 `auth.test.ts` 有 4 個 mobile 欄位（`phoneCity`、`mobile`、`website`、`invoiceAddress`）測試失敗，需獨立修
- `en.json`（479 行）和 `zh-TW.json`（479 行）仍是 single `translation` namespace，隨著 feature 增加會越來越龐大 → 已列 Decision Log（`runs/decisions/2026-08-12-i18n-namespace-split.md`）

### 相關 Rule 缺口

- `019-schema-contract-drift.mdc` 提到「DB column 必須同步進 shared zod schema」，但沒有「zod parse 時 extra keys 被 strip」的危險性說明（sub-pattern）
- `saome-form-integrity/SKILL.md` 的 autofill probe 模板可以延伸到 schema drift 的 probe：檢查 `schema.parse()` 的 output 是否包含預期欄位

### 自問

1. **下次怎麼不犯？**
   - schema drift 檢查清單：每次加 DB migration，必須同步檢查 `authSessionSchema` 的 fields 是否涵蓋所有新 column
   - i18n namespace 命名：明定「檔名 = resources key = camelCase」，並寫進 rule

2. **哪條 rule 該補？**
   - `019-schema-contract-drift.mdc` → 加一個 sub-pattern：「zod parse strip extra keys 的危險性」
   - `023-shared-package.mdc`（i18n convention）→ 明定 namespace 命名規則

3. **哪個 test 該加？**
   - `authSessionSchema` conformance test：驗證 schema output 包含 `pass.paidAt`、`pass.phase`、`pass.billingCycleEnd`
   - i18n bundle smoke test：確認新加的 namespace 在 production bundle 內

---

> 撰寫者：Josh ｜ 時間：2026-08-12
