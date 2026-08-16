# Feedback: i18n Namespace Key Structure Drift — `passCard` / `cardBuilder` / `cardEditor`

**Date**: 2026-08-16
**Author**: Cursor Agent
**Related**: `DEV/08-2026/0816-pass-card-preview-i18n.md`

---

## Summary

新增 `passCard`、`cardBuilder`、`cardEditor` 三個 i18n namespace 時，觸發了 **key 結構不一致**問題：翻譯檔是 flat key，但元件呼叫時多了一層前綴，導致 raw key 外漏。

**核心問題**：namespace 的 key 結構沒有對照既有範例（如 `auth`、`dashboard` 的 flat key），導致 `t('namespace.key')` vs `t('key')` 混淆。

---

## 根因分析（Root Cause Analysis）

### 根因 1: namespace key 結構沒有對齊既有範例

**既有的正確範例**（flat key）：
```typescript
// auth.zh-TW.ts
export default {
  login: { email: '電子郵件', password: '密碼' },
};
// 使用方式
const { t } = useTranslation('auth');
t('login.email'); // ✅ 在 auth.login.email 找翻譯
```

**新增 namespace 的錯誤實作**（多了一層前綴）：
```typescript
// passCard.zh-TW.ts
export default {
  passCard: { defaultIssuerName: '未命名卡片' }, // ❌ 多了 passCard 這層
};
// 使用方式
const { t } = useTranslation('passCard');
t('passCard.defaultIssuerName'); // ❌ 變成 passCard.passCard.defaultIssuerName
```

**正確做法**（flat key）：
```typescript
// passCard.zh-TW.ts
export default {
  defaultIssuerName: '未命名卡片', // ✅ flat key
};
// 使用方式
const { t } = useTranslation('passCard');
t('defaultIssuerName'); // ✅ 在 passCard.defaultIssuerName 找翻譯
```

### 根因 2: test i18n.ts 沒有同步更新

`src/test/i18n.ts` 缺少 `cardBuilder`、`cardEditor`、`passCard` 三個 namespace，導致：
- 測試環境 i18n 初始化不完整
- 新增 namespace 時沒有即時發現問題

---

## 受影響的檔案

| 檔案 | 問題 |
|------|------|
| `PassCardPreview.tsx` | `t('passCard.defaultName')` → 需改 `t('defaultName')` |
| `PassCardPreviewHeader.tsx` | `t('passCard.defaultIssuerName')` → `t('defaultIssuerName')` |
| `PassCardPreviewBody.tsx` | `t('passCard.fieldLabelLeft')` → `t('fieldLabelLeft')` |
| `TemplateCardPreview.tsx` | 同上 |
| `PassCardPreview.test.tsx` | 測試期望從中文改為 raw key（因 mock 返回 key） |
| `src/test/i18n.ts` | 缺少三個 namespace |

---

## 修復驗證

### Playwright 探針輸出

```
Body text (before fix):
passCard.defaultIssuerName
passCard.defaultCardType
passCard.fieldLabelLeft
passCard.fieldLabelRight

Body text (after fix):
未命名卡片
卡片
左欄位
右欄位
```

### Vitest 測試結果

```
✓ src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreview.test.tsx (9 tests)
✓ src/components/business/dashboard/TemplateCard/TemplateCard.test.tsx (5 tests)
Test Files  2 passed (2)
Tests  14 passed (14)
```

---

## 建議的 Process Fix

### 1. 在 `023-shared-package.mdc` 的 i18n convention 加一條 checklist

> **Namespace key 結構一致性檢查**（新增 namespace 時必跑）：
> 1. 翻譯檔案（`*.zh-TW.ts`）的 export 是否為 flat key？
> 2. `useTranslation('namespace')` 後，t() 是否只傳 `key` 而非 `namespace.key`？
> 3. 對照既有 namespace（如 `auth`、`dashboard`）的 key 結構確認一致

### 2. i18n smoke test

建議加 `scripts/verify-namespace-keys.mjs`，在 namespace 拆分後驗證所有 key 可正確解析（不是 raw key）：

```javascript
// scripts/verify-namespace-keys.mjs
import i18n from '../apps/frontend/src/i18n/index.ts';

const namespaces = ['auth', 'dashboard', 'passNotification', 'theme', 'landing', 'legal', 'pricing', 'nav', 'member', 'cardBuilder', 'cardEditor', 'passCard'];

for (const ns of namespaces) {
  const keys = Object.keys(i18n.getResourceBundle('zh-TW', ns));
  for (const key of keys) {
    const translated = i18n.t(`${ns}.${key}`, { ns });
    if (translated === `${ns}.${key}`) {
      console.error(`FAIL: ${ns}.${key} returns raw key`);
    }
  }
}
```

### 3. test i18n.ts 同步流程

新增 namespace 時，**必須**同步更新 `src/test/i18n.ts` 的 import 與 resources。可以寫一個 git pre-commit hook 或 CI check。

---

## 受影響的現有 Feedback

| 檔案 | 關聯 |
|------|------|
| `runs/improvements/feedback/20260812-i18n-namespace-split-feedback.md` | 之前的 i18n split 沒有檢查到 key 結構一致性 |
| `runs/improvements/feedback/20260812-renewal-reminder-i18n-schema-feedback.md` | 另一個 i18n namespace load fail 的案例 |

---

## Pending Action Items

- [ ] `023-shared-package.mdc` 加 i18n namespace key 結構一致性 checklist
- [ ] 加 `scripts/verify-namespace-keys.mjs` i18n smoke test
- [ ] 普查 `cardBuilder`、`cardEditor` namespace 的其他元件是否也有同樣問題

---

> 撰寫者：Cursor Agent ｜ 時間：2026-08-17
