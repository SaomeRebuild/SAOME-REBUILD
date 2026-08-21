# CardBuilder Step 2 Base Fields + Extension Pattern

> **Date**: 2026-08-21
> **Session**: 新建卡片反面 UI + Step 2 欄位規劃
> **Status**: Completed

---

## Context

CardBuilderEditor 是兩步驟編輯器：
- **Step 1**：選擇卡種（stamp_card / cashback_card / gift_card 等 8 種）
- **Step 2**：設定卡片內容（Barcode 格式、店名、到期日等通用欄位 + 卡種專屬欄位待填）

今天實作了：

1. **卡片正/反面切換 UI**：編輯器內的 `cardSide` toggle，front / back
2. **Step 2 通用欄位**（所有卡種共用）：
   - `barcodeType`（QR Code / PDF417）
   - `storeName`（店名）
   - `passValidDays`（PASS 有效天數，可選）
   - `expiryDate`（到期日，可選）
   - `currency`（TWD / ZAR）

---

## 設計決策：Extension Pattern

### 問題

每個卡種有不同的商業邏輯欄位：
- `stamp_card`：集點格數、每次集點數
- `gift_card`：餘額、充值門檻
- `membership_card`：會員等級、積分規則

如果把這些欄位全部塞進 `templateSettingsSchema`，會有兩個問題：
1. Schema 爆炸（8+ 卡種 × N 個欄位 = 40+ 可選欄位）
2. Zod parse 時每個卡種都要處理全部可選欄位，validation 複雜

### 兩個選項

| | Option A: Nested Schema | Option B: Flat + Extension Map |
|---|---|---|
| 結構 | `templateSettingsSchema` 內含 `stampCardFields: z.object({...})` | `templateSettingsSchema` 保持 flat，`cardTypeExtensions[cardType]` 單獨擴展 |
| 優點 | 結構清晰、Zod 一次 parse | 卡種欄位完全隔離，不影響 base schema |
| 缺點 | 卡種越多 schema 越大；新增卡種要改 base schema | 需要兩階段 parse（base → extension） |
| **結論** | 不採用 | **採用** |

### 最終結構

```
templateSettingsSchema (shared fields, flat)
  ├── name, cardType, barcodeType, storeName, issuerName
  ├── passValidDays, expiryDate, currency
  └── backgroundColor, textColor, holderName, cardSide

cardTypeExtensions[cardType] (per-card extension)
  ├── stamp_card: z.object({})  ← TODO: 等待商業邏輯確認
  ├── gift_card: z.object({})   ← TODO: 等待商業邏輯確認
  └── membership_card: z.object({})
```

### `getCardSettingsSchema(cardType)` 動態組合

```typescript
export function getCardSettingsSchema(cardType: CardType) {
  const extension = cardTypeExtensions[cardType] ?? z.object({});
  return baseCardSettingsSchema.extend({
    // cardTypeExtensions[cardType] 的 fields 會在商業邏輯確認後填入
    ...Object.fromEntries(
      Object.entries(extension.shape).map(([k, v]) => [k, v.optional()])
    ),
  });
}
```

---

## 實作產出

| 檔案 | 變動 |
|------|------|
| `packages/shared/schemas/card.ts` | `templateSettingsSchema` 新增 `cardSide` field |
| `packages/shared/schemas/cardBuilder.ts` | 新增 `cardTypeExtensions` map + `getCardSettingsSchema()` |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/store.ts` | 新增 `cardSide`、`barcodeType`、`storeName`、`passValidDays`、`expiryDate`、`currency` state |

---

## Pending：卡種專屬欄位待商業邏輯確認

目前 `cardTypeExtensions` 內所有卡種都是 `z.object({})` placeholder。等商業邏輯確認後：

1. 在 `packages/shared/schemas/cardBuilder.ts` 的 `cardTypeExtensions` 填入真實欄位
2. 在 `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step2CardSettings/` 建立對應的 sub-component
3. 在 `CardBuilderEditorWorkspace.tsx` 依 `cardType` render 對應的 extension panel

---

## 衍生

- 完整決策過程（含兩選項的 pros/cons 分析）：`runs/decisions/2026-08-21-card-type-extension-pattern.md`
- DEV/08-2026/0817-card-builder-step5-and-lang-detection.md — Step 5 客製化桌牌（早期歷史）
- `packages/shared/schemas/card.ts` — `templateSettingsSchema` 是目前 schema drift 的 single source of truth
