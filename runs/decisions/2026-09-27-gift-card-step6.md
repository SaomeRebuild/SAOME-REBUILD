# Decision: Gift Card (禮品卡) Step 6 邏輯實作

## 背景

禮品卡 (gift_card) 是 SAOME 卡片體系的第 8 種卡型，採用「消費者先付錢買點數，再用點數換商品」的 prepaid 模型。與其他 7 種（stamps/rewards/cashback/membership/discount/coupon/multipass）卡片邏輯完全不同——禮品卡**只有一條兌換比率**，沒有 tier list、沒有 earning mode、沒有 expiry。

這是「新增卡片類型邏輯」的架構變動，Rule 001 § Decision Log 觸發範圍明列「新增卡片類型邏輯」屬於必填範圍，因此需要走三段式決策紀錄。

## 選項與決定

### 兌換比率的形狀

- **選項 A**：tier list（多組兌換比率，類似 reward_card 的 rewardTiers 結構）
- **選項 B**：單一比率（X 元 = Y 點，類似 coupon_card 的單一 flat rule 結構）
- **決定**：選項 B（單一比率）

理由：禮物卡的產品定位最簡單——商家只設定一條兌換比率（例如 1 元 = 1 點），消費者按此比率購買。tier list 會增加複雜度而無商業價值。Step 6 的 sub-module 結構因此成為 SAOME 所有 sub-module 中最簡單的（跟 coupon_card 結構相似但更精簡）。

### 預覽格式

- **選項 A**：沿用 `BALANCE_PREVIEW_CARD_TYPES` 的兩行 block（label + currency-driven value）
- **選項 B**：新的兩行 block，label = "點數" / "Points"，value = 硬編常數 "2363點"
- **決定**：選項 B（新的兩行 block，硬編常數）

理由：禮物卡的「點數」概念跟其他卡的「餘額」概念不同——它強調的是「已累積點數」而非「可消費餘額」。值 "2363點" 純視覺展示（per user decision 2026-09-27），無 currency 依賴（不像 BALANCE_PREVIEW_AMOUNTS 是 currency-driven 的 TWD/ZAR 切換）。未來若會員 row 接上，可改為 store-driven 的 `points * rate` 換算。

### Step 2 隱藏欄位

- **選項 A**：保留 passValidDays + expiryDate（讓使用者仍可選禮物卡期限）
- **選項 B**：隱藏兩個欄位，跟 membership_card / discount_card / multipass 一致
- **決定**：選項 B（隱藏）

理由：禮物卡是 prepaid 長期點數，沒有期限概念。Step 6 GiftCardLogic 也只處理兌換比率，不處理卡片到期。跟 membership_card（終身）/ discount_card（Step 6 expiry）/ multipass（無時間概念）一致。

### Step 3 隱藏「會員等級」

- **選項 A**：保留 memberLevel（讓禮物卡也能顯示會員等級）
- **選項 B**：隱藏 memberLevel，跟 coupon_card 一致
- **決定**：選項 B（隱藏）

理由：禮物卡沒有等級制度——所有持卡人都是平等的「點數持有者」，沒有金卡/銀卡之分。這跟 coupon_card 同樣「非 tier-driven」，所以沿用既有的 `hideOnCardTypes: ['coupon_card', 'gift_card']` pattern。

### Autosave 模式

- **選項 A**：僅依賴 Step 6 handleNext 儲存（舊模式，coupon 之前的做法）
- **選項 B**：1s debounce autosave，套用 Rule 030/031/032 baseline-armed + loadSettled + snapshot diff pattern
- **決定**：選項 B（debounce autosave）

理由：跟 coupon_card 完全相同的 pattern（Rule 025 § 3 — L2 業務元件必跑 TDD + autosave regression test）。禮物卡只有 2 個欄位（giftCardAmount / giftCardPoints），但 slow-network race 仍可能洗 DB（前端 default 1:1 + 後端 JSONB `||` silent overwrite），所以 baselineArmedRef + step4LoadSettledRef 共用是必要的。

### Schema 4 層同步

依 Rule 019 §4.1「四層必須同步」：

1. `packages/shared/schemas/card.ts` — `templateSettingsSchema` 加 `giftCardAmount` / `giftCardPoints` 兩個 optional 整數欄位
2. `packages/shared/schemas/cardBuilder.ts` — `cardTypeExtensions.gift_card` 從 `z.object({})` 擴充為含兩個欄位的 schema
3. `apps/backend/src/modules/cards/schemas/request.ts` — 鏡像 A.1
4. `apps/backend/src/modules/cards/db/templates.ts` — `TemplateSettings` interface 加兩個欄位
5. `apps/backend/src/modules/cards/services/cardService.ts` — service signature 自動透過 `Partial<TemplateSettings>` 傳遞

外加 conformance test：`apps/backend/src/modules/cards/tests/gift-card-schema-conformance.test.ts` 斷言 backend 與 shared schema 的 field set 一致。

## 影響

| 既有系統 | 影響 |
|---|---|
| `Step6CardLogic.tsx` | 新增 `gift_card` 分支（第 8 個 sub-module），從 ComingSoon 移除 |
| `Step6CardLogic.test.tsx` | `unsupportedTypes` 陣列變空，新增 gift_card 渲染測試 |
| `CardBuilderEditorWorkspace.tsx` | `isStep6Valid` 新增 `isGiftCardStep6Valid()` dispatcher；Step 6 handleNext serializer 新增 `giftCardAmount` / `giftCardPoints` 兩個欄位 |
| `CardBuilderEditor.tsx` | 新增 giftSaveTimerRef + giftBaselineArmedRef + lastGiftSnapshotRef 區塊（共 110 行），套用 Rule 030/031/032 pattern |
| `Step2CardSettings/index.tsx` | `isGift = cardType === 'gift_card'` 加入 hide guard，跟 membership/discount/multipass 並列 |
| `card-fields.ts` | `memberLevel.hideOnCardTypes` 從 `['coupon_card']` 擴充為 `['coupon_card', 'gift_card']` |
| `PassCardPreviewHeader.tsx` | 新增 `GIFT_POINTS_PREVIEW_CARD_TYPES` set + `shouldShowGiftPointsPreview` guard + 兩行 JSX block（label + hardcoded value），gift_card 從預設 pill 移除 |
| i18n | cardEditor.{zh-TW,en} 加 `step6.gift.*` 10 個 key；passCard.{zh-TW,en} 加 `giftPointsPreview.label` |
| Shared constants | 新建 `packages/shared/constants/gift-card.ts`（`GIFT_POINTS_PREVIEW_VALUE`、`GIFT_CARD_DEFAULT_AMOUNT`、`GIFT_CARD_DEFAULT_POINTS`、`GIFT_CARD_UNIT_LABELS`） |
| vite/vitest config | 兩個都加 `@saome/shared/constants/gift-card` alias |
| Conformance test | 新建 `gift-card-schema-conformance.test.ts`（2 條 test）|
| Preview test | 新增 `gift_card` 渲染 2-line block 測試（3 條 test）；更新 pill test（移除 gift_card 從 pill cardTypes） |
| Step2 test | 新建 `Step2CardSettings/index.test.tsx`（2 條 test） |
| Dispatcher test | `unsupportedTypes` 陣列變空，新增 gift_card 渲染測試 |
| Step3 filter test | 新增 gift_card 隱藏 memberLevel 測試 |
| GiftCardLogic test | 新建 `GiftCardLogic.test.tsx`（6 條 test）+ `GiftCardLogic.stories.tsx` |

## 後續

- 預設值（1:1）可能讓使用者忘記調整就上線——建議未來在 UX 加「記得儲存你的兌換比率」hint（plan § R 風險）
- "2363點" 硬編常數未來會員 row 接上後改為 store-driven 的 `giftCardPoints * 23.63` 等換算
- 不需要 DB migration（giftCardAmount / giftCardPoints 為 JSONB optional field，靠後端 zod optional 處理）