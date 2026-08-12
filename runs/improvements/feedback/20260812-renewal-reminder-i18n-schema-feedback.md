# Renewal Reminder i18n + Schema Drift Feedback

## 摘要

| 項目 | 內容 |
|---|---|
| **日期** | 2026-08-12 |
| **觸發** | Dashboard renewaReminder notification「吃不到字」debug chain |
| **根因** | 三層獨立 bug 重疊爆發：i18n namespace naming mismatch、zod parse strip 新欄位、TS6198 CI block |
| **commits** | `94132f4` / `1b9c73f` / `7f59007` / `3953efe` |
| **狀態** | 已修，DEV LOG：`DEV/08-2026/0812-renewal-reminder-i18n-schema-chain.md` |

---

## Bug Chain 1 — i18n Namespace Naming Mismatch

### 問題描述

`pass-notification.zh-TW.json` 檔名用 hyphen（`pass-notification`），但 `src/i18n/index.ts` 的 resources key 是 camelCase（`passNotification`）：

```ts
// index.ts — resources key 是 camelCase
passNotification: passNotificationZhTW,

// 但檔名是 hyphen
// pass-notification.zh-TW.json
```

i18next load namespace 時，用 resources key（`passNotification`）去匹配載入的檔案，但檔名是 `pass-notification`，導致 namespace 載入失敗，所有 `t('passNotification.xxx')` 回傳 raw key。

### Lesson Learned

i18n namespace 的命名需要一致性約束：
- **檔名** = resources key = **camelCase**（如 `passNotification.zh-TW.json`）
- **禁止**在 resources key 使用 hyphen（`pass-notification`）—— JavaScript 物件 key 不支持 hyphen 作為識別符

### 建議的 Rule 補充

在 `023-shared-package.mdc` 的 i18n convention 中加一條：

> **namespace naming**：namespace key 必為 camelCase（如 `passNotification`、`dashboard`），禁止 hyphen。檔名格式：`{namespace}.{locale}.json`。
> 觸發時機：任何新增 i18n namespace。

---

## Bug Chain 2 — Zod Schema Parse Strip 新增欄位

### 問題描述

`authSessionSchema.pass`（zod）比後端 SQL row 少了 3 個欄位：`paidAt`、`phase`、`billingCycleEnd`。

zod parse 時，**不在 schema 定義內的額外欄位會被靜默 strip**（這是 zod 的預設行為）。

```ts
// packages/shared/schemas/pass.ts — 缺少這三個欄位
export const passSchema = z.object({
  id: z.string(),
  // paidAt? — 沒有
  // phase? — 沒有
  // billingCycleEnd? — 沒有
  ...
});
```

後端 SQL query 取到了這三個欄位，但前端 `authSessionSchema.parse()` 把它們 strip 掉。

Result：`pass.phase === 'trial'` 的判斷永遠是 `false`（`undefined !== 'trial'`），`showRenewalReminder` 永遠 `false`。

### Lesson Learned

「schema parse strip extra keys」是 schema drift 的隱蔽子-pattern。`019-schema-contract-drift.mdc` § 1 提到「shared zod schema 是契約」，但沒有明說「zod.parse() 預設 strip 額外欄位」這個危險行為。

### 建議的 Rule 補充

在 `019-schema-contract-drift.mdc` § 3 加一段：

> **Zod strip 的危險性**：
> `schema.parse(data)` 時，不在 schema 內的 extra keys 會被**靜默丟掉**。這在新增 schema field 時特別危險——如果前端 schema 比後端 response 少一個 field，使用者不會看到 error，只會看到 `undefined`。
> 防禦：每次加 DB column，要同步確認所有 `parse()` 的 output 是否包含該欄位（可用 `console.log` 或 test assert）。

---

## Bug Chain 3 — TS6198 Unused Variables Block CI

### 問題描述

`TenantToolbar.tsx` 宣告了 `defaultWidth` 和 `onWidthChange` props 但未使用，TS6198 在 strict mode 下是 error，導致 Cloudflare Pages build fail。

### Lesson Learned

TS6198 是「已宣告但未使用」的編譯期 error，比 runtime `undefined` 好抓（起碼 CI 會 block）。但如果沒在本地跑 `npm run build`，就不會發現。

### 建議的 Rule 補充

在 `006-verification.mdc` 的驗證指令清單加一條：

| 驗證項 | 指令 | 通過條件 |
|---|---|---|
| TypeScript build | `npm run build` | exit 0，無 TS6198 / TS2304 |

---

## 衍生後續（Action Items）

- [ ] `auth.test.ts` 的 4 個 mobile 欄位（`phoneCity`、`mobile`、`website`、`invoiceAddress`）測試失敗，需獨立修
- [ ] `019-schema-contract-drift.mdc` 加「zod strip extra keys」危險性說明
- [ ] `023-shared-package.mdc` 加 i18n namespace naming convention（camelCase）
- [ ] `006-verification.mdc` 加 `npm run build` 至驗證清單
- [ ] Decision Log：`runs/decisions/2026-08-12-i18n-namespace-split.md`（全面拆分 `en.json` 479 keys）
