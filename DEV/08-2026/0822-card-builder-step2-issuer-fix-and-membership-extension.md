# CardBuilder Step 2 實作：IssuerName 預填、Step 7/8 新增、Membership Extension

## Metadata

- **日期**：2026-08-22
- **作者**：cursor-agent
- **commit hash**：local（未 commit）
- **規則 / skill 觸發**：`001-methodology.mdc`（L2 Standard）、`025-vibe-coding-l2-checklist.mdc`（L2 checklist）

---

## 背景

CardBuilder Step 2 實作中的三個問題：

1. **Step 2 issuerName 為空**：選擇 membership_card 並進到 Step 2 後，`#issuerName` 是 `disabled` 但值為空，沒有吃到 `tenant.name`
2. **Step 7/8 新增**：Card Back UI 需要兩個新步驟
3. **Membership card 新欄位**：`isPaid` checkbox extension

---

## 問題一：IssuerName 預填失敗

### 症狀

- Playwright smoke test 進到 Step 2，`#issuerName` 的 `disabled=true` 但 `value=""`
- Console log 顯示 `tenant: undefined`
- `sessionStorage` 中有 `accessToken` 和 `refreshToken`，但 `tenant` 為 `undefined`

### 探針

```ts
// issuer-name-prefill-debug.spec.ts — smoke test
[SESSION STORAGE tokens]: {
  accessToken: 'eyJhbG...',  // 有 token
  refreshToken: 'eyJhbG...'
}
[issuerName] value="" disabled=true visible=true
[CONSOLE LOGS]:
  [log] [IssuerNameField] useEffect run, issuerName: "" tenant: undefined  // tenant 是 undefined！
```

### 根因

`IssuerNameField.tsx` 第 12 行錯誤：

```12:12:apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step2CardSettings/IssuerNameField.tsx
const { tenant } = useAuth();  // ❌ useAuth() 回傳 { state, ... }，不是 { tenant, ... }
```

`useAuth()` 的回傳值是 `{ state: AuthState, ... }`，`tenant` 在 `state.tenant` 底下，不是直接回傳。

修法：

```ts
const { state } = useAuth();
const tenant = state.tenant;
```

Effect dependency 也要從 `[tenant?.name]` 改為 `[state.tenant]`，確保當 auth refresh 完成、`tenant` 從 `null` 變成有值時，effect 正確觸發。

### 修法

- `IssuerNameField.tsx`：`const { state } = useAuth()` + `const tenant = state.tenant`
- Effect dependency：`[tenant]` → `[state.tenant]`

---

## 問題二：Step 7/8 新增 + Step 指示器 UI

### 症狀

- Card Back UI 開發需要 Step 7（客製化桌牌）和 Step 8（保存）
- Step 指示器 UI 需要調整以支援更多步驟

### 修法

- 新增 Step 7 客製化桌牌內容區（`Step7CustomizePlaceCard` component）
- 新增 Step 8 保存按鈕
- Step 指示器 UI 調整（響應式設計、disabled 狀態樣式）

---

## 問題三：Membership Card Extension（`isPaid` checkbox）

### 需求

當選擇 `membership_card` 時，Step 2 顯示「是否收費」checkbox。

### Extension Pattern 實作

Extension pattern 遵循 `runs/decisions/2026-08-21-card-type-extension-pattern.md` 的 Decision Log：

| 元件 | 實作 |
|---|---|
| Store | `isPaid: false` + `setIsPaid` + `loadSettings` |
| Component | `MembershipExtensionField.tsx` — `cardType === 'membership_card'` conditional render |
| Step2 index | `{cardType === 'membership_card' && <MembershipExtensionField />}` |
| Workspace onSave | `isPaid` 包含在 settings payload |
| i18n | `step2.membershipExtension.title / isPaid / isPaidHint`（zh-TW + en） |

### Schema Drift 檢查

`packages/shared/schemas/card.ts` 的 `templateSettingsSchema` 已有 `isPaid: z.boolean().optional()`。

但後端 `apps/backend/src/modules/cards/db/templates.ts` 的 `TemplateSettings` interface 和 `apps/backend/src/modules/cards/schemas/request.ts` 的 `templateSettingsSchema` **都漏了 `isPaid`**。

修法：

```ts:apps/backend/src/modules/cards/db/templates.ts
// TemplateSettings interface
isPaid?: boolean;
```

```ts:apps/backend/src/modules/cards/schemas/request.ts
// templateSettingsSchema
isPaid: z.boolean().optional(),
```

---

## 衍生

### 涉及檔案變更

| 檔案 | 變更 |
|---|---|
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step2CardSettings/IssuerNameField.tsx` | `useAuth()` destructuring 修正 |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts` | `isPaid` state + action |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step2CardSettings/MembershipExtensionField.tsx` | 新檔 |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step2CardSettings/index.tsx` | Conditional render |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorWorkspace.tsx` | `onSave` 含 `isPaid` |
| `apps/frontend/src/i18n/locales/cardEditor.zh-TW.ts` | `membershipExtension.*` keys |
| `apps/frontend/src/i18n/locales/cardEditor.en.ts` | `membershipExtension.*` keys |
| `packages/shared/schemas/card.ts` | `isPaid` schema（已有） |
| `apps/backend/src/modules/cards/db/templates.ts` | `isPaid` interface |
| `apps/backend/src/modules/cards/schemas/request.ts` | `isPaid` zod schema |

### 測試結果

```
Test Files  40 passed | 1 skipped (41)
     Tests  241 passed | 5 skipped (246)
```

---

## 自問

- **schema drift**：這次在實作 extension 前檢查了 shared schema，但忘了檢查後端介面。下次新增 `settings` 欄位時，應同步檢查：shared schema → backend request.ts → backend db interface 三個地方。
- **useAuth API**：每次用 `useAuth()` 前應確認其回傳值形狀，是 `{ tenant }` 還是 `{ state: { tenant } }`。建議在 `useAuth` hook 的 JSDoc 加 explicit return type 說明。
- **backend schema sync**：rule `019-schema-contract-drift.mdc` 的「DB ↔ schema binding」檢查清單應加第四層：backend request schema (`request.ts`)。

---

## 待確認

- [ ] Step 7 客製化桌牌商業邏輯尚未實作（預覽 UI 已就緒）
- [ ] Step 8 保存按鈕 UI 已就緒，實際 save flow 需串接
- [ ] `isPaid` 的商業邏輯（收費會員卡如何運作）尚未實作

---

> 撰寫者：cursor-agent ｜ 時間：2026-08-22
