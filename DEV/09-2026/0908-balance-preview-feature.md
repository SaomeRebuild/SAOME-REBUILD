# Balance Preview — PassCardPreviewHeader 餘額預覽（Stamp / Reward / Cashback 卡）

## Metadata

- **日期**：2026-09-08
- **作者**：Josh <josh1989213@gmail.com>
- **觸發**：使用者於 Step 1 選擇 Stamp / Reward / Cashback 這三種卡時，
  `PassCardPreviewHeader` 右側的單行 pill（`stamp_card` / `reward_card` / `cashback_card`）
  改為兩行垂直「餘額 / 200元」區塊；英文介面時「200元」改為「R100」（南非蘭特）。
- **規則 / skill 觸發**：
  - `frontend/025-vibe-coding-l2-checklist.mdc` § 1 i18n（先建立翻譯，再建立元件）
  - `frontend/023-shared-package.mdc`（`BALANCE_PREVIEW_AMOUNTS` 在 `packages/shared/constants/`）
  - `frontend/024-mobile-future-proof.mdc`（業務邏輯不在 component 內，在 shared/）

---

## 設計決策

### 1. `BALANCE_PREVIEW_AMOUNTS` 放在 `packages/shared/constants/` 而非 i18n

| 方案 | 結果 | 為什麼不選 |
|---|---|---|
| 放在 `passCard.{zh-TW,en}.ts` | 跨 locale 切換時驅動 amount 顯示 | ❌ `verify-i18n-keys.mjs` § 4 hard fail：en 翻譯禁止包含 Han 字元，`200元` 不能放 `passCard.en.ts` |
| 放在 `packages/shared/constants/balancePreview.ts` | 同一個 JS 值（`'200元'`）跨 locale 渲染（en 時顯示 `R100`，由 `store.currency` 切換） | ✅ 業務邏輯在 shared/（Rule 023）；i18n 只處理 label（`餘額` / `Balance`）|

**為什麼 `store.currency` 決定 amount 而非 i18n locale**：
- i18n locale 切的是 UI 語言（zh-TW ↔ en）
- `store.currency` 切的是卡片結算幣別（TWD ↔ ZAR）
- 這是兩個正交的維度。i18n locale 變動時 amount **不改變**（`store.currency` 才是驅動值）。

### 2. `store.currency` 是 Zustand reactive，支援 Step 2 切換時 live re-render

```tsx
// ✅ Reactive subscription — Step 2 切換 currency 時，Header 即時 re-render
const currency = useCardBuilderStore((s) => s.currency);

// ❌ Non-reactive — 用 getState() 拿值，Step 2 切換後 Preview 不知道
const currency = useCardBuilderStore.getState().currency;
```

### 3. `totalStamps` 插值：`{{rows}}` 代表「印章總數」而非「列數」

| 使用者選了幾列 | `STAMPS_PER_ROW` | `totalStamps = rows × STAMPS_PER_ROW` | i18n `t('fieldPreview.totalStamps.value', { rows: totalStamps })` |
|---|---|---|---|
| 1 列 | 5 | 5 | `3/5` |
| 2 列 | 5 | 10 | `3/10` |
| 3 列 | 5 | 15 | `3/15` |
| 4 列 | 5 | 20 | `3/20` |

`STAMPS_PER_ROW = 5` 是 StampGridPreview geometry 常數，在 `StampGridPreview.types.ts` 維護，
同時作為 `StampGridPreview` 的預設 `cols` prop，保持幾何契約。

---

## 實作內容

### 1. 新增 `packages/shared/constants/balancePreview.ts`

```ts
export const BALANCE_PREVIEW_AMOUNTS: Record<Currency, string> = {
  TWD: '200元',
  ZAR: 'R100',
};
```

`Currency` 型別來自 `packages/shared/schemas/card.ts`（`Currency = 'TWD' | 'ZAR'`）。
`Record<Currency, string>` 確保未來加新 currency 時 TypeScript 在這裡自動 error。

### 2. i18n label keys（`passCard.{zh-TW,en}.ts`）

| 語言 | key | 值 |
|---|---|---|
| zh-TW | `balancePreview.label` | `餘額` |
| en | `balancePreview.label` | `Balance` |

### 3. `PassCardPreviewHeader` 的 `showBalance` 分支

```tsx
{showBalance ? (
  <div className="flex flex-col items-start gap-0.5 leading-tight">
    <span className="text-[10px] font-medium">{t('balancePreview.label')}</span>
    <span className="text-sm font-bold">{BALANCE_PREVIEW_AMOUNTS[currency]}</span>
  </div>
) : (
  <span className="rounded-full px-2 py-0.5 text-xs font-medium">
    {cardType ?? t('defaultCardType')}
  </span>
)}
```

Typography 對齊 `PassCardPreviewBody`：label 10px / value 14px（字級差 4px）。
`font-bold` 強調數字（相對於 pill 的 `font-medium`）。

### 4. `BALANCE_PREVIEW_CARD_TYPES` 與 `shouldShowBalancePreview` 導出

```ts
export const BALANCE_PREVIEW_CARD_TYPES: ReadonlySet<CardType> = new Set<CardType>([
  'stamp_card',
  'reward_card',
  'cashback_card',
]);

export function shouldShowBalancePreview(
  cardType: string | null | undefined,
): cardType is CardType {
  return (
    cardType !== null &&
    cardType !== undefined &&
    BALANCE_PREVIEW_CARD_TYPES.has(cardType as CardType)
  );
}
```

type guard 確保 consumer 端有 exhaustive coverage。

### 5. `stampGridRows` prop 傳遞鏈

```
PassCardPreview
  → PassCardPreviewHeader prop（已有）✅
  → PassCardPreviewBody + stampGridRows prop
        → resolveSlot() 內 `totalStamps = (stampGridRows ?? 1) * STAMPS_PER_ROW`
        → i18n interpolation: t('fieldPreview.totalStamps.value', { rows: totalStamps })
```

`PassCardPreview` 從 `useCardBuilderStore` 取 `stampGridRows`，直接往下傳。
當使用者於 Step 3 Stamp Grid 調整列數時，`store.stampGridRows` 更新，
`PassCardPreview` re-render → `stampGridRows` 傳到 `Body` → `totalStamps` 動態更新。

---

## 測試覆蓋

`PassCardPreviewHeader.test.tsx` — 17 個 test case：

| 分類 | cases |
|---|---|
| Default pill（非目標卡種）| 5 non-target card types + null + undefined |
| Balance preview（目標卡種）| stamp_card / reward_card / cashback_card × TWD default |
| Currency switch | 單次 ZAR + reactive setState re-render |
| textColor scope | label + value 雙 span 繼承 `color` inline style |
| Typography | compact/non-compact label 8px/10px + value 11px/14px + font-bold |
| DOM layout | flex-col + items-start（靠左對齊）+ label 在 value 之前 |
| Pure helper contract | `BALANCE_PREVIEW_CARD_TYPES.size === 3` + 5 excluded types |

`PassCardPreview.test.tsx` + `PassCardPreviewBody.test.tsx` — 同步 regression test。

---

## 驗證

| 檢查 | 結果 |
|---|---|
| `npm run verify:i18n` | 17 namespaces / 34 locale files — no raw key |
| `npx tsc -b --noEmit` | exit 0 |
| `npm run lint` | exit 0（無新 warnings）|
| `npm test` CardPreview suite | 113/113 + 488/488 全綠 |

---

## 變更檔案

```
?? packages/shared/constants/balancePreview.ts          # 新增
M  apps/frontend/src/i18n/locales/passCard.en.ts     # +balancePreview.label
M  apps/frontend/src/i18n/locales/passCard.zh-TW.ts  # +balancePreview.label
?? apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewHeader.test.tsx  # 新增
M  apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewHeader.tsx      # +balance preview branch
M  apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreview.tsx            # +stampGridRows prop
M  apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreview.test.tsx       # +stampGridRows prop
M  packages/shared/constants/index.ts                  # +balancePreview barrel export
M  apps/frontend/vite.config.ts                     # +@saome/shared/constants/balancePreview alias
M  apps/frontend/vitest.config.ts                   # +@saome/shared/constants/balancePreview alias
```

---

## 衍生觀察

### 待處理

1. **`BALANCE_PREVIEW_AMOUNTS` 目前是 hardcoded demo value**：當真正的 member row 接入時（Rule 019 § future），這個 constant 會變成 default placeholder，真實值從 member balance 注入。
2. **其他卡種的 balance preview**：membership / discount / coupon / gift / multipass 這 5 種目前維持原 pill。待後續需求再實作。

### 觀察但不處理

1. **`STAMPS_PER_ROW = 5` 是 locked-in design**：StampGridPreview geometry 固定 5-column。若未來改變（如 4-wide 或 6-wide），必須同步更新這裡 + `StampGridPreview.utils.test.ts` 的 locked-in cell-size numbers。
2. **`BALANCE_PREVIEW_CARD_TYPES` 與 `Step3CardFields/filterCARD_FIELDS_BY_CARD_TYPE.ts` 的 `STAMP_CARD_TYPES`**：兩者有部分重疊（`stamp_card` 在兩者都出現），但目標集合不同（前者的 `reward_card` / `cashback_card` 不在後者），目前維持各自獨立。未來有第三個 caller 出現時再 hoist 到 `shared/constants/card-types.ts`。

---

## 自問

### 下次怎麼不犯

- i18n 只放 label，業務邏輯（currency → display string）走 shared/ constant — 這是正確的分界，en 翻譯不准有 Han 字元（`verify-i18n-keys.mjs` hard fail）
- Zustand store 的 reactive subscription（`useCardBuilderStore((s) => s.currency)`）vs non-reactive（`getState()`）是 live re-render 的關鍵；任何「資料來源是 store 且 component 會持續 mount」的場景，都用 reactive subscription

### 哪個 production smoke 該加

- `tests/smoke/card-builder-preview.spec.ts` 加 1 個 case：建立 stamp_card template → 驗證 Header 顯示 `餘額` / `200元`（TWD）→ 切換 currency 到 ZAR → 驗證 Header 顯示 `Balance` / `R100`

### 觸發哪些現有 rule

- `frontend/023-shared-package.mdc` — 業務邏輯在 shared/ ✅
- `frontend/024-mobile-future-proof.mdc` — 沒有在 component 內寫業務邏輯 ✅
- `frontend/025-vibe-coding-l2-checklist.mdc` § 1 i18n — 先建立翻譯再建立元件 ✅

---

> 撰寫者：Josh ｜ 時間：2026-09-08 07:08（UTC+8）
