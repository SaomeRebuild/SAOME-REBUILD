# CardBuilder Step 2 — Extension Pattern Decision

## Metadata

- **日期**：2026-08-21
- **作者**：Josh（agent-assisted via Cursor）
- **觸發**：CardBuilder Step 2 欄位實作 — 卡種（`stamp_card` / `gift_card` 等 8 種）各有不同商業邏輯欄位，需確認如何擴展 Schema 而不造成膨脹
- **規則 / skill 觸發**：`saome-dev-logging`、L2 Standard 任務分流、`saome-form-integrity`（schema drift prevention）

---

## 背景

CardBuilder 是 SAOME 卡片編輯器，目前實作到 Step 2：

- **Step 1**：選擇卡種（8 種）
- **Step 2**：設定卡片內容

Step 2 通用欄位（所有卡種共用）已確認：
`barcodeType`、`storeName`、`issuerName`、`passValidDays`、`expiryDate`、`currency`、`backgroundColor`、`textColor`、`holderName`、`cardSide`

但**每個卡種有不同的商業邏輯欄位**：
- `stamp_card`：集點格數、每次集點數、蓋章圖示
- `gift_card`：餘額上限、充值門檻、最低消費
- `membership_card`：會員等級、積分規則、升等門檻

問題：**如何擴展 Schema，讓新卡種不影響既有 schema？**

---

## 選項

### 選項 A：Nested Schema

`templateSettingsSchema` 內含每個卡種的 nested object：

```typescript
const templateSettingsSchema = z.object({
  // 通用欄位
  barcodeType: barcodeTypeSchema.optional(),
  storeName: z.string().optional(),
  // ...
  // 卡種欄位（nested）
  stampCardFields: z.object({ stampsCount: z.number(), perStamp: z.number() }).optional(),
  giftCardFields: z.object({ balanceLimit: z.number(), topUpThreshold: z.number() }).optional(),
  // ...
});
```

### 選項 B：Flat Schema + Extension Map（採用）

`templateSettingsSchema` 保持 flat，`cardTypeExtensions` map 單獨擴展：

```typescript
// packages/shared/schemas/cardBuilder.ts

// Base（所有卡種都要）
export const baseCardSettingsSchema = z.object({
  storeName: z.string().min(1),
});

// Per-card Extensions
export const cardTypeExtensions = {
  stamp_card: z.object({}),
  gift_card: z.object({}),
  membership_card: z.object({}),
} as const;

// 動態組合
export function getCardSettingsSchema(cardType: CardType) {
  const extension = cardTypeExtensions[cardType] ?? z.object({});
  return baseCardSettingsSchema.extend({
    ...Object.fromEntries(
      Object.entries(extension.shape).map(([k, v]) => [k, v.optional()])
    ),
  });
}
```

---

## 優缺點分析

| 維度 | Option A: Nested Schema | Option B: Flat + Extension Map |
|------|------------------------|-------------------------------|
| **Schema 複雜度** | 8+ 卡種 × N 個欄位 = 40+ 可選欄位在同一 schema 內 | Base schema 保持精簡；Extension map 可各自独立扩缩 |
| **新增卡種** | 需改 `templateSettingsSchema`（影響 shared 契約） | 只需在 `cardTypeExtensions` 加一項，不碰 base |
| **Zod parse** | 一次 parse 所有欄位 | 兩階段：base → extension（由 `getCardSettingsSchema` 封裝）|
| **類型安全** | 所有卡種欄位都在同一型別 | 每個卡種的 extension 是獨立的 `z.object({})` |
| **Backend parse** | 一次 parse，通用欄位 + 卡種欄位混在一起 | 通用欄位走 `templateSettingsSchema`；卡種欄位走 `getCardSettingsSchema` |
| **遷移到 React Native** | JSONB 內含 nested object，RN 解析需要多一層 | JSONB 完全 flat（通用 + extension flatten），RN 讀取簡單 |

---

## 決策

**選擇**：選項 B — Flat Schema + Extension Map

**理由**：
1. **隔離性**：Extension map 可独立改動，不影響 `templateSettingsSchema`（shared 契約）
2. **擴展性**：新增卡種只需加一條 `cardTypeExtensions` entry，不碰既有 schema
3. **RN 友好**：JSONB 完全 flat，遷移到 React Native 時解析簡單
4. **未來彈性**：如果某個卡種的 extension 變得很複雜，可以拆分為獨立 sub-schema，仍不影響 base

---

## 實作規劃

| 步驟 | 說明 | 狀態 |
|------|------|------|
| 1. `templateSettingsSchema` flat base | 所有通用欄位，無 nested object | ✅ 已實作 |
| 2. `cardTypeExtensions` map | 目前全為 `z.object({})` placeholder | ✅ 已實作 |
| 3. `getCardSettingsSchema()` | 動態組合 base + extension | ✅ 已實作 |
| 4. 通用欄位 UI（Step2CardSettings/）| BarcodeSelector、StoreNameField、ExpiryDateField 等 | ✅ 已實作 |
| 5. `cardTypeExtensions` 填入真實欄位 | 等商業邏輯確認後擴展 | ⏳ pending |
| 6. Extension panel UI | 依 `cardType` render 對應 sub-component | ⏳ pending |
| 7. Backend parse | `apps/backend/` 的 `templateSettingsSchema` + `getCardSettingsSchema` | ⏳ pending |

---

## 影響

| 位置 | 影響 |
|------|------|
| `packages/shared/schemas/card.ts` | `templateSettingsSchema` 保持 flat；`cardSide` field 已加入 |
| `packages/shared/schemas/cardBuilder.ts` | 新增 `cardTypeExtensions` map + `getCardSettingsSchema()` |
| `apps/frontend/` | `Step2CardSettings/` sub-component；`CardBuilderEditorWorkspace` 依 `cardType` render extension panel |
| `apps/backend/` | Route handler parse `templateSettingsSchema`（通用欄位）+ `getCardSettingsSchema(cardType)`（卡種欄位）|
| `packages/shared/` i18n | 未来新增卡種欄位時，需在對應 namespace 新增翻譯 key |

---

## 衍生問題

1. **`cardTypeExtensions` 何時填入真實欄位？**
   → 等商業邏輯確認。目前全為 `z.object({})` placeholder，確保結構存在但不阻塞編譯。

2. **Extension UI 何時實作？**
   → 在 `cardTypeExtensions` 有真實 schema 後，依 `cardType` 在 `Step2CardSettings/` 建立對應 sub-component。

3. **Schema drift 風險？**
   → Frontend 的 `templateSettingsSchema` 和 Backend 的 parse 都必須引用 `packages/shared/schemas/card.ts`，由 shared 作為 single source of truth。

---

## 自問

- **下次怎麼不犯？**
  - 任何有多變體的 schema，先想好 extension pattern 再開始實作
  - `z.object({})` placeholder 是過渡期的好方法，確保結構存在但不阻塞

- **哪條 rule 該補強？**
  - `019-schema-contract-drift.mdc`：Extension map + dynamic schema 組合作為新增卡種時的參考模式

- **有沒有其他系統用類似 pattern？**
  - `passTierSchema`（`green`/`gold`/`platinum`）也是 enum-based extension；可對齊
