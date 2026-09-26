# Step 6 Gift Card (禮品卡) 完工 DEV LOG：第 8 個 sub-module + 預覽硬編 2363點 + Step 2 隱藏期限

## Metadata

- 日期：2026-09-27
- 範圍：CardBuilder Step 6（gift_card 禮品卡的兌換比率邏輯）+ Step 2（gift_card 隱藏 PassValidDaysField + ExpiryDateField）+ Step 3（gift_card 隱藏 memberLevel「會員等級」）+ 預覽（PassCardPreviewHeader 新增 2-line「點數 / 2363點」block，gift_card 從預設 pill 移除）+ Gift Card 常數與 i18n + autosave 補齊 + Backend 4-layer schema sync
- 目標：
  1. 完成 Step 6 dispatcher 對 `gift_card` 的分流（8 個 sub-module 的最後一個，也是結構最簡單的）
  2. 落地「[輸入框]元＝[輸入框]點」flat rule 編輯器（X 元 = Y 點，no tier list / no radio / no issue count）
  3. 貨幣驅動的單位標籤：TWD→「元」/「NT$」，ZAR→「R」
  4. 預覽右側新增 2-line block：「點數 / 2363點」（硬編常數，per user decision）
  5. Step 2 對 gift_card 隱藏卡片有效天數 / 到期日（沿用 membership / discount / multipass 模式）
  6. Step 3 對 gift_card 隱藏「會員等級」（沿用 coupon_card 的 `hideOnCardTypes` pattern）
  7. 補齊 gift_card 兩個欄位 autosave（1s debounce，套 Rule 030/031/032 pattern）
  8. Backend 4-layer schema sync（新增 `giftCardAmount` / `giftCardPoints` 兩個 optional 整數）
- Plan ref：`gift_card_step_6_plan_<uuid>.plan.md`（Step 6/Step 2/Step 3/預覽/i18n/autosave/conformance 共 13 todos）
- Decision ref：`runs/decisions/2026-09-27-gift-card-step6.md`（三段式決策紀錄，背景 6 個決策點）

## 問題與根因

禮品卡 (gift_card) 在 Step 6 dispatcher 仍是 ComingSoon placeholder。本輪 user 在 prompt 內明確了 **5 條** 規格：

1. **單一 flat rule**：「[輸入框]元＝[輸入框]點」，沒有 tier list。
2. **貨幣驅動單位**：Step 2 選 TWD 顯示「元」，選 ZAR 顯示「R」（南非表示法）。
3. **沒有卡片期限**：禮物卡是長期 prepaid 點數，passValidDays / expiryDate 都要隱藏。
4. **沒有會員等級**：禮物卡沒有 tier 制度，memberLevel「會員等級」要隱藏。
5. **預覽替換 CARD TYPE**：右側容器預覽把 gift_card 的 CARD TYPE 替成「點數」+「2363點」2-line block（純視覺展示，不是 store-driven）。

### 為什麼禮物卡是「最簡 sub-module」

| 維度 | reward_card | coupon_card | **gift_card（本 PR）** |
|---|---|---|---|
| Tier 結構 | 多 tier（name + threshold + discount%）| 無 | 無 |
| Radio group | 無 | amount_off vs percent_off | 無 |
| Issue count | 無 | 必填 ≥ 1 | 無 |
| Accrual mode | visit / spend | 不適用 | 不適用 |
| Card expiry | 必填 | 沿用 Step 2 | **Step 2 隱藏** |
| Member tier | 不限制 | 隱藏 | **隱藏** |
| Preview block | tier-aware | 2-line（NT$XX off / XX% off）| 2-line（**硬編 "2363點"**）|

Coupon 是 DiscountCard 簡化版（去掉 tier list、加 radio + issue count）；Gift 是 **CouponCard 進一步簡化版**（再去掉 radio + issue count，只剩 2 個整數 input + 1 個 live preview）。在 SAOME 8 個 sub-module 中結構最精簡。

### 4-layer schema sync（Rule 019 § 4.1）— 預防性補齊

這次不是像 coupon 卡那樣**漏了 backend 欄位**才事後補（見 `runs/improvements/feedback/20260919-coupon-step6-no-backfill-backend-schema-drift.md`），而是**事前**就跟齊 4 層：

| 層 | 位置 | 新增 |
|---|---|---|
| 1 | `packages/shared/schemas/card.ts::templateSettingsSchema` | `giftCardAmount: z.number().int().positive().optional()` + `giftCardPoints` 同 |
| 2 | `apps/backend/src/modules/cards/schemas/request.ts::templateSettingsSchema` | 同（鏡像）|
| 3 | `apps/backend/src/modules/cards/db/templates.ts::TemplateSettings` | 同（interface）|
| 4 | `apps/backend/src/modules/cards/services/cardService.ts` | 自動 `Partial<TemplateSettings>` 覆蓋 |

外加 `apps/backend/src/modules/cards/tests/gift-card-schema-conformance.test.ts`（2 條 conformance test 斷言 backend 與 shared schema 的 field set 完全一致）。這是 Rule 019 § 3 的硬要求。

## 實作內容

### 1. 新檔案結構

```
apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/GiftCardLogic/
├── index.ts                          ← barrel
├── GiftCardLogic.tsx                 ← 主組件（28 行，純組裝）
├── GiftCardLogic.types.ts            ← 1 個 props (showValidation)
├── GiftCardLogic.test.tsx            ← 6 條 composer smoke test
├── GiftCardLogic.stories.tsx         ← 4 個 story
├── GiftCardAmountField.tsx           ← currency-aware 整數 input
├── GiftCardPointsField.tsx           ← 整數 input
└── GiftCardRatePreview.tsx           ← live "X 元 = Y 點" preview
```

外加：
- `apps/backend/src/modules/cards/tests/gift-card-schema-conformance.test.ts` ← backend ↔ shared schema conformance
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step2CardSettings/index.test.tsx` ← Step 2 hide-on-gift_card 測試
- `packages/shared/constants/gift-card.ts` ← `GIFT_POINTS_PREVIEW_VALUE` + 預設值 + 單位標籤
- `runs/decisions/2026-09-27-gift-card-step6.md` ← 3 段式決策紀錄

### 2. GiftCardLogic 主組件（最簡單的 sub-module）

```tsx
export function GiftCardLogic({ showValidation }: GiftCardLogicProps) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <GiftCardAmountField showValidation={showValidation} />
      <GiftCardPointsField showValidation={showValidation} />
      <GiftCardRatePreview />
    </div>
  );
}
```

3 個 sub-component，**每個都不到 80 行**。對比 CouponCardLogic（2026-09-19）也是 3 個，但多了 radio group 共 5 個 props；Gift 把 radio 砍掉、issue count 砍掉，剩 2 個 NumberField + 1 個 Preview。

### 3. PassCardPreviewHeader 2-line block（硬編常數）

```tsx
// 從 CARD TYPE pill 移除 gift_card → 走 GIFT_POINTS_PREVIEW_CARD_TYPES 分支
export const GIFT_POINTS_PREVIEW_CARD_TYPES = new Set<CardType>(['gift_card']);

if (GIFT_POINTS_PREVIEW_CARD_TYPES.has(cardType)) {
  return (
    <>
      {/* 上半：CARD TYPE + org + balance 等既有內容 */}
      {/* 下半：2-line block */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{t('giftPointsPreview.label')}</span>
        <span className="text-sm text-muted-foreground">({GIFT_POINTS_PREVIEW_VALUE})</span>
      </div>
    </>
  );
}
```

`GIFT_POINTS_PREVIEW_VALUE = '2363點'`（per user decision）放 `packages/shared/constants/gift-card.ts`，**不放在 i18n**，理由（見 shared constants 檔 header comment）：

| 方案 | 結果 |
|---|---|
| 放 `passCard.zh-TW.ts` 給「點數」/「2363點」| verify-i18n-keys.mjs § 4 會 hard fail（en path 有 Han 字元） |
| 放 `passCard.en.ts` 給「2363點」| zh-TW path 缺字串 |
| **shared/constants/（本方案）** | i18n label「點數/Points」走 i18n，**值 2363點 是 currency-invariant** 常數（兩 locale 都同值） |

未來會員 row 接上後，這個常數會變 placeholder，實際值來自 member.points * rate 換算。

### 4. Autosave 補齊（Rule 030/031/032 pattern）

跟 Step 4 / Step 5 / Step 2 走完全相同 pattern：

```tsx
// CardBuilderEditor.tsx line 798-915
const giftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const lastGiftSnapshotRef = useRef<string>('');
const giftBaselineArmedRef = useRef(false);
const giftCardAmount = useCardBuilderStore((s) => s.giftCardAmount);
const giftCardPoints = useCardBuilderStore((s) => s.giftCardPoints);

// session boundary reset
useEffect(() => {
  if (!cardId) return;
  giftBaselineArmedRef.current = false;
  lastGiftSnapshotRef.current = '';
}, [cardId]);

// baselineArmed + snapshot diff + 1s debounce + timer cleanup
useEffect(() => {
  if (!cardId) return;
  const snapshot = JSON.stringify({ giftCardAmount, giftCardPoints });

  if (!giftBaselineArmedRef.current) {
    giftBaselineArmedRef.current = true;
    lastGiftSnapshotRef.current = snapshot;
    return;
  }
  if (!loadSettledRef.current) {       // 共用 Step 4 的 loadSettled ref（兩個 step 同 fetch）
    lastGiftSnapshotRef.current = snapshot;
    return;
  }
  if (snapshot === lastGiftSnapshotRef.current) return;
  lastGiftSnapshotRef.current = snapshot;

  if (giftSaveTimerRef.current) clearTimeout(giftSaveTimerRef.current);
  giftSaveTimerRef.current = setTimeout(() => {
    const s = useCardBuilderStore.getState();
    const cardIdNow = s.cardId;
    if (!cardIdNow) return;
    const a = s.giftCardAmount, p = s.giftCardPoints;
    if (!Number.isFinite(a) || !Number.isFinite(p) || a <= 0 || p <= 0) return;
    cardService.update(cardIdNow, {
      settings: {
        ...s,
        giftCardAmount: a,
        giftCardPoints: p,
      },
    }).catch(...);
  }, 1000);

  return () => {
    if (giftSaveTimerRef.current) {
      clearTimeout(giftSaveTimerRef.current);
      giftSaveTimerRef.current = null;
    }
  };
}, [cardId, giftCardAmount, giftCardPoints]);
```

共 110 行（含註解），跟 coupon 的 105 行幾乎對稱。禮物卡只有 2 個欄位，但 slow-network race 仍可能洗 DB（前端 default 1:1 + 後端 JSONB `||` silent overwrite），所以 baselineArmedRef + 共用 step4 loadSettled ref 是必要的。

### 5. Step 2 隱藏欄位（跟其他無期限卡對齊）

```tsx
// Step2CardSettings/index.tsx
const isGift = cardType === 'gift_card';
const hideValidDaysExpiry = isMultipass || isGift || isDiscount || isMembership;
// 三個 PassValidDaysField / ExpiryDateField 都套這個 guard
```

禮物卡理由：prepaid 長期點數，沒有期限概念。跟 membership_card（終身）/ discount_card（Step 6 expiry）/ multipass（無時間概念）一致。

### 6. Step 3 隱藏 memberLevel（沿用 coupon 卡 pattern）

```ts
// packages/shared/constants/card-fields.ts
hideOnCardTypes: ['coupon_card', 'gift_card']
```

禮物卡沒有 tier 制度——所有持卡人都是平等的「點數持有者」，沒有金卡/銀卡之分。直接擴充既有的 `hideOnCardTypes` 陣列（coupon 也是同樣的處理）。

## 驗證結果

- ✅ Frontend typecheck（1470 tests, 119 files）
- ✅ Backend typecheck（332 tests, 19 files including 2 new conformance tests）
- ✅ i18n smoke test（17 namespaces, 34 locale files；giftCard.yaml namespace 不存在因為選擇了 shared/constants；en locale 沒有 Han 字元）
- ✅ Frontend production build（no hardcoded localhost，1023 KB JS）
- ✅ Lint（no new warnings）
- ✅ Gift card 在 8 個 sub-module 中第 1 名結構最簡（28 行主組件 / 3 個 sub / 6 tests / 4 stories）
- ✅ 4-layer schema sync 一次到位（不再像 coupon 卡那樣「後端漏欄 → 回填失敗 → 補 backend」三輪）

## 影響範圍

| 既有系統 | 影響 |
|---|---|
| `Step6CardLogic.tsx` | 新增 `gift_card` 分支（第 8 個 sub-module），從 ComingSoon 移除 |
| `Step6CardLogic.test.tsx` | `unsupportedTypes` 陣列變空，新增 gift_card 渲染測試 |
| `CardBuilderEditorWorkspace.tsx` | `isStep6Valid` 新增 `isGiftCardStep6Valid()` dispatcher；handleNext serializer 新增 `giftCardAmount` / `giftCardPoints` |
| `CardBuilderEditor.tsx` | 新增 giftSaveTimerRef + giftBaselineArmedRef + lastGiftSnapshotRef 區塊（共 110 行） |
| `Step2CardSettings/index.tsx` | `isGift = cardType === 'gift_card'` 加入 hide guard |
| `Step2CardSettings/index.test.tsx` | 新建（2 條 test：TWD/ZAR hide valid days） |
| `card-fields.ts` | `memberLevel.hideOnCardTypes` 從 `['coupon_card']` 擴充為 `['coupon_card', 'gift_card']` |
| `PassCardPreviewHeader.tsx` | 新增 GIFT_POINTS_PREVIEW_CARD_TYPES set + 2-line JSX block，gift_card 從預設 pill 移除 |
| `PassCardPreviewHeader.test.tsx` | 新增 3 條 gift_card 2-line block test（zh-TW/en/ZAR）+ 更新 pill test（移除 gift_card） |
| `PassCardPreview.test.tsx` | 更新 1 條整合測試 |
| `Step3CardFields/index.test.tsx` | 新增 1 條 gift_card 隱藏 memberLevel 測試 |
| `i18n` | `cardEditor.{zh-TW,en}.ts` 加 `step6.gift.*` 12 個 key；`passCard.{zh-TW,en}.ts` 加 `giftPointsPreview.label` |
| `vite.config.ts` / `vitest.config.ts` | 兩個都加 `@saome/shared/constants/gift-card` alias |
| `packages/shared/constants/gift-card.ts` | 新建（4 個 export） |
| `gift-card-schema-conformance.test.ts` | 新建（2 條 field-set equality test） |
| `GiftCardLogic.test.tsx` | 新建（6 條：render / 2 fields / preview / currency-driven units） |
| `GiftCardLogic.stories.tsx` | 新建（4 stories） |

## 後續

- 預設值（1:1）可能讓使用者忘記調整就上線——建議未來 UX 加「記得儲存你的兌換比率」hint（plan § 風險）
- "2363點" 硬編常數未來會員 row 接上後改為 store-driven 的 `giftCardPoints * 23.63` 等換算
- 不需要 DB migration（giftCardAmount / giftCardPoints 為 JSONB optional field，靠後端 zod optional 處理）

## 觸發規則對齊

| Rule | 套用範圍 |
|---|---|
| Rule 001 § Decision Log | 三段式決策紀錄（`runs/decisions/2026-09-27-gift-card-step6.md`，6 個決策點）|
| Rule 019 § 4.1 四層同步 | 事前一次 sync（避免 coupon 卡的三輪補洞）|
| Rule 023 § shared package 邊界 | GIFT_POINTS_PREVIEW_VALUE 放 shared/ 而非 i18n（en locale no Han 字元鐵律）|
| Rule 025 § L2 Vibe Coding Checklist | i18n → 元件 → 測試 → smoke 全套 |
| Rule 030 + 031 | baseline-armed pattern + 1s debounce autosave（5th 同 pattern 實例）|
| Rule 032 | 後端 JSONB `||` silent overwrite（前端 default 1:1 不會洗 DB 因為有 baselineArmedRef 守）|
