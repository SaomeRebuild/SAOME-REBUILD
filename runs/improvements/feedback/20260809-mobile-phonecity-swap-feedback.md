# mobile/phoneCity 必填性對調 Feedback

## 摘要

| 項目 | 內容 |
|---|---|
| **日期** | 2026-08-09 |
| **觸發** | 使用者要求「手機必填、市內電話選填」 |
| **影響範圍** | DB schema、shared schema、backend services、frontend form、i18n |
| **耗時** | ~30 分鐘（主要是 service 層需要加 fallback + frontend test 改 assertion） |

---

## 遇到的主要卡點

### 1. Backend service 需要加 `?? null` fallback

**現象**：DB migration 把 `phone_city` 改成 `NULL`，但 `loginService`、`refreshService` 直接做 `tenant.phone_city`，TypeScript error。

**修法**：加 `tenant.phone_city ?? null` explicit fallback。

**lesson**：DB column 從 NOT NULL 改 NULL 時，所有下游 service 的型別推斷都會變。**下次 schema 改 NULL 前，先跑 `npx tsc -b` 看有多少 error**。

### 2. Frontend test 需要更新 assertion

**現象**：`RegisterForm.test.tsx` 的「leaving mobile blank does not block Step 2」測試失敗，因為 mobile 已經是 required。

**修法**：
- 測試名改為「providing mobile allows progression」
- 移除 `phoneCity` 填寫（因為變成 optional）
- 加 `mobile` 填寫

**lesson**：schema 改 required/optional 後，UI test 的前提假設會被破壞。**下次改 schema 前，先 grep 所有相關 test**。

### 3. `aria-required` propagation

**現象**：測試想用 `toBeRequired()` 斷言 mobile 為必填，但 Field component 沒有把 `required` prop 轉成 `aria-required` attribute。

**修法**：更新 `Field.tsx` 的 `cloneElement` 加 `'aria-required': required || undefined`。

**lesson**：Accessibility 屬性在 component wrapper 層容易被忽略。**下次新加 required field 前，同時檢查 Field 的 aria 屬性 propagation**。

---

## 建議的 Rule 補充

在 `019-schema-contract-drift.mdc` 或新 rule 中加一條：

> **Schema required/optional 改動 checklist**：
> 1. ✅ 先跑 `npx tsc -b` 確認無 error（避免 DB NULL → service error）
> 2. ✅ grep 所有相關 test，改 assertion
> 3. ✅ 更新 i18n hint（required → 必填 / optional → 選填）
> 4. ✅ 更新 Field.tsx 的 aria 属性 propagation（如需要）
> 5. ✅ 跑 full test suite 確認無 regression

---

## 衍生後續

- [ ] `loginService.test.ts` 加 mobile required schema conformance test
- [ ] `refreshService.test.ts` 加 phoneCity optional schema conformance test
- [ ] `RegisterForm.stories.tsx` 更新 mobile/phoneCity 的 required visual indicator
