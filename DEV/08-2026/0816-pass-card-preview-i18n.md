# 0816 PassCard Preview + TemplateCard i18n Key Structure Drift

## Metadata

- **日期**：2026-08-16
- **作者**：Cursor Agent
- **規則 / skill 觸發**：`saome-dev-logging`、`saome-task-router`（L2）、`018-form-autofill-and-multi-step-state.mdc`（i18n 關聯）

---

## 症狀

> 使用者回報：卡片預覽的 i18n 翻譯沒顯示，變成 raw key（如 `passCard.defaultIssuerName`）。

- **環境**：本地 dev（`localhost:5173`）
- **觸發條件**：登入 → 儀表板 → 卡片建置器（`/app/dashboard/card-builder`）
- **觀察到的錯誤**：卡片預覽顯示 `passCard.defaultIssuerName`、`passCard.defaultCardType`、`passCard.fieldLabelLeft`、`passCard.fieldLabelRight` 等 raw key
- **預期**：顯示中文翻譯（`未命名卡片`、`卡片`、`左欄位`、`右欄位`）

---

## 探針 / 重現

### Playwright Probe

```javascript
// debug-i18n.mjs — 登入後導航到卡片建置器
await page.goto('http://localhost:5173/login');
await page.fill('input[name="email"]', 'ppp@hotmail.com');
await page.fill('input[name="password"]', 'www123123');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard**');
await page.goto('http://localhost:5173/app/dashboard/card-builder');
const bodyText = await page.textContent('body');
console.log(bodyText?.includes('passCard.')); // true → raw key
```

### i18n 初始化的 Console Log

```
[i18n] resources keys: [auth, dashboard, passNotification, theme, landing, legal, pricing, nav, member, cardBuilder, cardEditor, passCard]
[i18n] passCard content: {
  "defaultCardType": "卡片",
  "defaultIssuerName": "未命名卡片",
  "defaultName": "未命名卡片",
  "fieldLabelLeft": "左欄位",
  "fieldLabelRight": "右欄位"
}
[i18n] initialized, passCard t: passCard.defaultIssuerName
```

**觀察**：resources 有正確註冊，且翻譯內容正確。但 `t('passCard.defaultIssuerName')` 返回 raw key。

---

## 根因

> i18n key 結構不一致：翻譯檔是 flat key（`defaultIssuerName`），但元件呼叫時多了一層前綴（`passCard.defaultIssuerName`），導致 i18next 找不到翻譯。

**為什麼之前沒抓到**：
1. 新增 `passCard`、`cardBuilder`、`cardEditor` namespace 時，沒有對照既有 namespace（如 `auth`、`dashboard`）的 key 結構
2. 翻譯檔案（如 `passCard.zh-TW.ts`）是 flat key，但 `useTranslation('passCard')` 後，t() 已經在 `passCard` namespace 內，所以呼叫 `t('defaultIssuerName')` 才是正確的
3. 錯誤示範：`t('passCard.defaultIssuerName')` = 在 `passCard` namespace 內找 `passCard.defaultIssuerName`，實際上是 `passCard.passCard.defaultIssuerName`

**其他問題**：`src/test/i18n.ts` 缺少 `cardBuilder`、`cardEditor`、`passCard` 三個 namespace，導致新增 namespace 時 test 環境沒有正確初始化。

---

## 修法

### 1. 修復元件的 i18n 呼叫

| 檔案 | 修改內容 |
|------|----------|
| `PassCardPreview.tsx` | `t('passCard.defaultName')` → `t('defaultName')` |
| `PassCardPreviewHeader.tsx` | `t('passCard.defaultIssuerName')` → `t('defaultIssuerName')`，`t('passCard.defaultCardType')` → `t('defaultCardType')` |
| `PassCardPreviewBody.tsx` | `t('passCard.fieldLabelLeft')` → `t('fieldLabelLeft')`，`t('passCard.fieldLabelRight')` → `t('fieldLabelRight')` |
| `TemplateCardPreview.tsx` | 同上，全部移除 `passCard.` 前綴 |

### 2. 補上 test i18n 設定

| 檔案 | 修改內容 |
|------|----------|
| `src/test/i18n.ts` | 新增 `cardBuilder`、`cardEditor`、`passCard` namespace 的 import 與 resources |

### 3. 修復測試期望

| 檔案 | 修改內容 |
|------|----------|
| `PassCardPreview.test.tsx` | `expect(screen.getByText('未命名卡片'))` → `expect(screen.getByText('defaultName'))`（mock 返回 key 本身） |

### 驗證結果

```
Body text sample:
未命名卡片
卡片
左欄位
右欄位
```

所有 raw key 消失，翻譯正確顯示。

---

## 衍生

### 影響的檔案
- `apps/frontend/src/i18n/index.ts`（已正確，無需修改）
- `apps/frontend/src/test/i18n.ts`（需同步）
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreview*.tsx`（4 個檔案）
- `apps/frontend/src/components/business/dashboard/TemplateCard/TemplateCardPreview.tsx`

### 需要後續追蹤
- [ ] `cardBuilder`、`cardEditor` namespace 的 key 是否也有同樣問題？需普查
- [ ] `TemplateCard` 其他元件的 i18n 呼叫是否正確？

---

## 自問

- **下次怎麼不犯？**
  新增 i18n namespace 時，**必須**對照現有 namespace 的 key 結構範例（如 `auth`、`dashboard`）。建議在 `023-shared-package.mdc` 加一條 checklist：「namespace 的 key 是否為 flat key（即 `useTranslation('namespace')` 後，t() 只傳 `key` 而非 `namespace.key`）」

- **哪條 rule 該補？**
  `023-shared-package.mdc` 的 i18n namespace 規範，缺少「key 結構一致性」的檢查點。

- **哪個 test 該加？**
  i18n smoke test：驗證 production bundle 內每個 namespace 的 key 都可正確解析（不是 raw key）。

---

> 撰寫者：Cursor Agent ｜ 時間：2026-08-17
