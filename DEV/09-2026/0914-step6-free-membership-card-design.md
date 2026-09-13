# Step 6 免費會員卡設計 — 從空狀態升級為完整編輯器

## Metadata

- 日期：2026-09-14
- 範圍：CardBuilderEditor Step 6 免費會員卡（`isPaid=false`）完整設計
- 涵蓋：3 個新 store 欄位 + 3 個新 sub-component + 1 個重寫 FreeState + i18n paid/free copy 拆分 + 4 層 schema sync + workspace validation/save 擴充
- 對齊 rule：
  - Rule 019（schema contract drift）§ 4.1 — 4 層同步（shared / backend request / backend db / frontend store）
  - Rule 023（shared package）— shared constants + zod schema
  - Rule 025（vibe coding L2 checklist）— 順序執行 + 同步測試
  - Rule 032（後端 JSONB merge 是 silent killer）— 套到新欄位的 PUT block
- 對齊既有 sibling：0911-step6-cashback-card-dev-log.md（cashback_card 同樣是 4 層 schema sync 完整範本）

## 症狀

> 2026-09-13 加入 Membership Card（見 `0913-membership-preview-6-fixes.md`）時，`MembershipCardLogicFreeState` 是一個**空狀態 placeholder**，只顯示「免費會員卡無需付費設定」+ 一段 hint 文字，沒有任何可編輯欄位。

| 問題面向 | 症狀 | 影響 |
|---|---|---|
| **業務面** | 租戶想發行「免費但有有效期限」的會員卡（例如：試用 100 天會員卡、限期免費 VIP）時，Step 6 完全沒有對應的 UI | 業務情境被鎖死；租戶必須改用付費會員卡 + 設 cost=0 才能表達「免費」語意 |
| **Preview 面** | 免費會員卡右側預覽（`PassCardPreviewBack` Section 1.5）只顯示空 strip — 沒有會員等級名稱、沒有獎勵 sub-rows、沒有到期資訊 | 使用者看不到「這張卡會長什麼樣子」 |
| **i18n 一致性** | 免費卡 hero intro 跟付費卡共用 `intro = "設定此會員卡的會員等級與付費規則"` | 免費卡明明沒付費，hero 文案卻講「付費規則」— UX inconsistent |
| **語意面** | 付費卡的「會員等級」是 VIP / Gold / Silver 等 tier；免費卡只需要 1 個 tier | 付費卡 `MembershipTierList` 整套（5-tier + 各自 duration + 各自 cost）對免費卡是 over-engineering |

## 探針 / 重現

```bash
# 1. 在 editor 開新 membership card
# 2. Step 2 選 "membership_card"，isPaid=false（預設）
# 3. 進 Step 6
# → 看到 "免費會員卡無需付費設定" empty state
# → 右側 PassCardPreview 完全沒顯示會員等級相關資訊
# → 沒有任何 input 可填

# Store 觀察（用 React DevTools 或 console.log）：
useCardBuilderStore.getState().isPaid                    // false
useCardBuilderStore.getState().membershipTiers           // [{ id: '...', name: '', ... }]
useCardBuilderStore.getState().hasExpiry                 // false（且無 setter 對 free 卡影響）
useCardBuilderStore.getState().membershipExpiryMode      // ❌ undefined（沒這個欄位）
```

## 根因

> 2026-09-13 實作 membership_card 時，付費卡路徑完整但**免費卡被當成「不重要」處理**——只做 placeholder empty state，沒有任何 card-level expiry 欄位、沒有完整 editor。

更深層原因：

| 層級 | 既有問題 |
|---|---|
| **業務語意** | 付費卡用 `durationType: 'monthly' \| 'yearly' \| null` + 對應 `monthlyCost` / `yearlyCost` 表達「購買週期」；免費卡沒有購買週期，必須用另一組語意：「自訂 N 天後到期」OR「指定到期日」 |
| **Schema 層** | `templateSettingsSchema` 缺 3 個 free-card 欄位（`membershipExpiryMode` / `membershipCustomExpiryDays` / `membershipSpecificExpiryDate`） |
| **Backend 層** | `apps/backend/.../request.ts` 跟 `apps/backend/.../templates.ts::TemplateSettings` interface 都沒 mirror 這 3 欄位 |
| **Frontend 層** | store 沒 `membershipExpiryMode` / `membershipCustomExpiryDays` / `membershipSpecificExpiryDate` + 對應 setter；`MembershipCardLogicFreeState` 是 empty state；workspace 的 `isMembershipStep6Valid()` 對 free-card 直接 `return true`；save block 沒帶這 3 個欄位 |
| **i18n 層** | hero intro / introHint 跟付費卡共用，沒區分 |
| **Component 層** | 缺 3 個輸入元件（`MembershipExpiryModeField` radio / `MembershipCustomExpiryDaysField` number input / `MembershipSpecificExpiryDateField` date picker） |
| **`MembershipHasExpiryToggle`** | 2026-09-13 fix #6 加 `bg-primary` 背景色，但 ON 狀態 copy 只有付費卡語意（「月/年付費」）；free-card 也會看到同樣 copy，跟「指定到期日」語意不一致 |

## 設計：付費卡 vs 免費卡的 expiry 語意差異

| 維度 | 付費會員卡 | 免費會員卡 |
|---|---|---|
| **期限來源** | 跟購買週期綁定（每月 / 每年 / 終身） | 跟購買週期無關（自訂天數 / 指定日期 / 終身） |
| **期限模式欄位** | `durationType: 'monthly' \| 'yearly' \| null`（per-tier） | `membershipExpiryMode: 'custom_days' \| 'specific_date' \| null`（card-level） |
| **對應數值欄位** | `monthlyCost` / `yearlyCost`（per-tier） | `membershipCustomExpiryDays` / `membershipSpecificExpiryDate`（card-level） |
| **Lifetime 模式** | hasExpiry=false → 隱藏 duration radio，顯示 `lifetimeCost` | hasExpiry=false → 隱藏 expiry section，不顯示任何 cost |
| **Free card tier 數量** | 1-5 個 tier（`MembershipTierList`） | 永遠只有 1 個 tier（auto-seeded by `setIsPaid(false)`） |
| **Card-wide toggle** | `hasExpiry` 控制 lifetime mode | `hasExpiry` 控制是否要 expiry 區塊 |

## 修法

### 1. shared constants — 新增 free-card expiry 常數

| 檔案 | 新增 |
|---|---|
| `packages/shared/constants/membership-card.ts` | `MEMBERSHIP_EXPIRY_MODES = ['custom_days', 'specific_date'] as const` + `MembershipExpiryMode` type + `CUSTOM_EXPIRY_DAYS_MIN = 1` + `CUSTOM_EXPIRY_DAYS_MAX = 3650`（10 年上限） |

### 2. shared schema（layer 1 of 4）

| 檔案 | 新增欄位 |
|---|---|
| `packages/shared/schemas/card.ts` | `membershipExpiryMode: z.enum(MEMBERSHIP_EXPIRY_MODES).nullable().optional()` + `membershipCustomExpiryDays: z.number().int().min(1).max(3650).nullable().optional()` + `membershipSpecificExpiryDate: z.string().nullable().optional()` |
| `packages/shared/schemas/card.test.ts` | +13 conformance test（modes 4 個 + days 6 個 + date 3 個） |

### 3. backend mirror（layer 2 of 4）

| 檔案 | 新增 |
|---|---|
| `apps/backend/src/modules/cards/schemas/request.ts` | 同上 3 個欄位（從 `@saome/shared/constants/membership-card` import CUSTOM_EXPIRY_DAYS_MIN/MAX） |
| `apps/backend/src/modules/cards/db/templates.ts::TemplateSettings` | 同上 3 個 optional field（用字面 literal union 而非 enum 維持 TS-only interface 純度） |
| `apps/backend/vitest.config.ts` | 加 `@saome/shared/constants/membership-card` alias（specific-first，Rule 016 § vitest alias 鐵律） |

### 4. frontend store（layer 3 of 4）

| 動作 | 細節 |
|---|---|
| 新增 3 個 state | `membershipExpiryMode: MembershipExpiryMode \| null` + `membershipCustomExpiryDays: number \| null` + `membershipSpecificExpiryDate: string \| null` |
| 新增 3 個 setter | `setMembershipExpiryMode` / `setMembershipCustomExpiryDays` / `setMembershipSpecificExpiryDate` |
| `setMembershipExpiryMode` 雙向清除 | 切到 `'custom_days'` 時清 `membershipSpecificExpiryDate`；切到 `'specific_date'` 時清 `membershipCustomExpiryDays`（mirrors `setEarningMode` / `setHasExpiry` pattern） |
| `setMembershipCustomExpiryDays` clamp | NaN / 非整數 / 超出 [1, 3650] 由 setter clamp + UI 顯示 validation error |
| `setMembershipSpecificExpiryDate` 格式檢查 | 字串不符合 `/^\d{4}-\d{2}-\d{2}$/` 時 reject（store guard）；「不能早於今天」由 `<input type="date" min={today}>` 強制 |
| `setIsPaid(true)` 清除 3 個欄位 | 切換到付費卡時清空 free-card expiry（避免 stale data leak；付費卡用 per-tier `durationType`） |
| `setIsPaid(false)` auto-seed `membershipTiers[0]` | 確保 free-card 一定有 1 個 implicit tier 供 `MembershipTierNameField` 編輯 |
| `loadSettings` defensive hoist | 從 backend 回傳的 `resolved.membershipExpiryMode` / `membershipCustomExpiryDays` / `membershipSpecificExpiryDate` 重置 store；缺值 fallback 到 current state 不 silent overwrite |

### 5. 前端 sub-components — 3 個新 + 1 個重寫

| 元件 | 行數 | 用途 |
|---|---|---|
| `MembershipExpiryModeField.tsx` | ~125 | 兩顆 radio card（`custom_days` / `specific_date`），用既有 `radio-card-primary` CSS pattern（Pattern A：透過 `:has(:checked)` CSS rule 切換背景，無 React conditional） |
| `MembershipCustomExpiryDaysField.tsx` | ~95 | `<input type="number" inputMode="numeric">` for [1, 3650] 天，placeholder「例如：100」，suffix「天」；守 `CUSTOM_EXPIRY_DAYS_MIN/MAX` |
| `MembershipSpecificExpiryDateField.tsx` | ~105 | `<input type="date" min={today}>` for ISO YYYY-MM-DD；`getTodayIsoDate()` helper 給測試與 mobile UI 共用（exported for testing） |
| `MembershipCardLogicFreeState.tsx`（重寫） | 122（原 ~30 行 empty state） | 完整 free-card editor：4 區塊串接：<br>1. `MembershipTierNameField`（復用付費卡元件，bind `tierId={freeTier.id}`）<br>2. `MembershipHasExpiryToggle`（復用）<br>3. 當 `hasExpiry=true` 時顯示 `MembershipExpiryModeField` + 對應子輸入<br>4. `MembershipTierRewardList`（復用，bind `tierId={freeTier.id}`） |

3 個新元件各自附 test：
- `MembershipExpiryModeField.test.tsx`
- `MembershipCustomExpiryDaysField.test.tsx`
- `MembershipSpecificExpiryDateField.test.tsx`
- `MembershipCardLogicFreeState.test.tsx`

### 6. i18n split — paid / free 兩組 keys

> 觸發：原本 `MembershipCardLogicFreeState` 顯示時 hero intro 是付費卡 copy「設定此會員卡的會員等級與付費規則」— 免費卡沒付費規則，文案 misleading。

| 檔案 | 變更 |
|---|---|
| `apps/frontend/src/i18n/locales/cardEditor.zh-TW.ts` | 新增 `step6.membership.introFree` / `introHintFree` / `hasExpiryOnFree` / 6 個 `free*` 標題 / placeholder / error keys / 5 個 validation keys；保留 `intro` / `introHint` 給付費卡（語意從「付費規則」微調為「收費方案」）|
| `apps/frontend/src/i18n/locales/cardEditor.en.ts` | 同上英文版 |
| `Step6CardLogic.tsx` | 加 `isPaid` selector，hero intro 三元運算：<br>`isPaid ? t('intro') : t('introFree')`<br>`isPaid ? t('introHint') : t('introHintFree')` |

**文案對照**：

| 情境 | intro | introHint |
|---|---|---|
| 付費卡 | 設定此會員卡的會員等級與收費方案 | 會員可依等級享有不同優惠與專屬獎勵，最多可設定 5 組會員等級。 |
| 免費卡 | 設定此免費會員卡的會員等級與有效期限 | 免費會員卡只需設定一組會員等級與有效期限，最多可設定 5 組會員獎勵。 |

**hasExpiry 切換 copy**：

| 情境 | hasExpiryOn | hasExpiryOff |
|---|---|---|
| 付費卡 | 有期限（月/年付費） | 無期限（終身會員） |
| 免費卡 | 有期限（指定到期日） | 無期限（終身會員） |

`MembershipHasExpiryToggle` 加 `isPaid` selector；OFF 兩邊共用（終身會員語意兩邊通）。

### 7. workspace validation + save block

| 動作 | 細節 |
|---|---|
| `isMembershipStep6Valid()` 拆 free/paid 兩條 | free-card：tiers.length≥1 + tier[0].name.trim()!=='' + 當 hasExpiry=true 時 mode + 對應子欄位驗證；paid-card：既有 per-tier durationType + cost 驗證邏輯不變 |
| `CardBuilderEditorWorkspace.tsx` save block | destructure 加 `membershipExpiryMode` / `membershipCustomExpiryDays` / `membershipSpecificExpiryDate`；付費卡寫 `undefined`（schema optional），免費卡寫真實值 |

### 8. Step 6 dispatcher 測試覆蓋

`Step6CardLogic.test.tsx` 加 2 條 paid/free intro 互斥測試：
- `renders paid-card intro for membership_card when isPaid=true (default)`
- `renders free-card intro for membership_card when isPaid=false (2026-09-14)`

兩條都用 `queryByText` 反向斷言另一組 key **沒有**渲染——守護「paid/free 互斥」invariant。

### 9. Step 6 integration test

`CardBuilderEditorWorkspace.step6-integration.test.tsx` 5 條既有 test 全部加 3 個 free-card fields 到 expected `onSave` payload 斷言（stamp_card / reward_card / cashback_card 都帶 `membershipExpiryMode: undefined` + 另 2 個 `undefined`），確保付費 / 其他卡種不會 silent 帶 free-card fields 出去。

## 4 層 schema sync 驗證（Rule 019 § 4.1）

| 層 | 檔案 | 欄位 | 驗證 |
|---|---|---|---|
| 1 | `packages/shared/schemas/card.ts::templateSettingsSchema` | `membershipExpiryMode` / `membershipCustomExpiryDays` / `membershipSpecificExpiryDate` | +13 conformance test（modes × 4 / days × 6 / date × 3）|
| 2 | `apps/backend/src/modules/cards/schemas/request.ts::templateSettingsSchema` | 同上 3 欄位 | import 自 shared constants `CUSTOM_EXPIRY_DAYS_MIN/MAX` |
| 3 | `apps/backend/src/modules/cards/db/templates.ts::TemplateSettings` | 同上 3 optional field | 字面 union `('custom_days' \| 'specific_date') \| null` 跟 shared enum 對齊 |
| 4 | `apps/backend/src/modules/cards/services/cardService.ts` | 自動從 `TemplateSettings` interface 推到 service signature | 既有 service signature `Promise<{ settings: TemplateSettings }>` 無變動（Optional fields 不影響 contract） |

`shared/frontend store` (`apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts`) 第 4.1 條不在「4 層 backend chain」內，但同步性也驗證：

| 5 | `CardBuilderEditor.store.ts` | 同上 3 個 state + 3 個 setter | +20 line 變動；setter 雙向清除 + clamp + 格式檢查都有 |

## i18n 同步檢查

| 動作 | 細節 |
|---|---|
| 新增 keys（zh-TW）| `step6.membership.introFree` / `introHintFree` / `hasExpiryOnFree` / `freeTierNameTitle` / `freeTierNamePlaceholder` / `freeTierNameCounter` / `freeTierNameRequiredError` / `freeExpiryModeTitle` / `freeExpiryModeCustomDays` / `freeExpiryModeSpecificDate` / `freeExpiryModeRequiredError` / `freeCustomExpiryDaysTitle` / `freeCustomExpiryDaysPlaceholder` / `freeCustomExpiryDaysUnit` / `freeCustomExpiryDaysRangeError` / `freeSpecificExpiryDateTitle` / `freeSpecificExpiryDatePlaceholder` / `freeSpecificExpiryDateRequiredError` / `freeSpecificExpiryDatePastError` + 5 個 validation keys |
| 新增 keys（en）| 同上英文對應 |
| 既有 `intro` / `introHint` | 付費卡保留，文字從「付費規則」微調為「收費方案」（語意更精準，避免跟 free card 衝突）|
| 同步 `apps/frontend/src/test/i18n.ts` | 不需變動（`cardEditor` namespace 已存在）|
| 同步 `apps/frontend/src/i18n/index.ts` | 不需變動 |
| `npm run verify:i18n` | 17 namespace(s) passed (34 locale files) ✓ |

## 驗證 SOP 結果

```
typecheck (npx tsc -b --noEmit):
  exit 0 ✓

verify:i18n (npm run verify:i18n --workspace=apps/frontend):
  17 namespace(s) passed (34 locale files) ✓

frontend tests (npm test --workspace=apps/frontend --run):
  Test Files  99 passed | 5 skipped (104)
  Tests       1142 passed | 5 skipped (1147)
  exit 0 ✓

backend tests (npm test --workspace=apps/backend --run):
  Test Files  18 passed (18)
  Tests       235 passed (235)
  exit 0 ✓

Step6CardLogic dispatcher test (新增 paid/free 互斥):
  12/12 passed ✓
```

## 受影響測試覆蓋

| 測試檔 | 新增 / 修改 |
|---|---|
| `Step6CardLogic.test.tsx` | +2 paid/free intro 互斥 regression test |
| `MembershipHasExpiryToggle.test.tsx` | +3 free-card copy variant test（`hasExpiryOnFree` / shared `hasExpiryOff` / 付費卡保留 `hasExpiryOn`） |
| `MembershipCardLogicFreeState.test.tsx` | 全新（≥8 條 layout + conditional rendering 測試）|
| `MembershipCardLogic.test.tsx` | +5（既有 freeStateTitle placeholder 斷言移除，改為驗證 `MembershipCardLogicFreeState` 渲染）|
| `MembershipExpiryModeField.test.tsx` | 全新（≥6 條 radio + validation 測試） |
| `MembershipCustomExpiryDaysField.test.tsx` | 全新（≥5 條 range + validation 測試） |
| `MembershipSpecificExpiryDateField.test.tsx` | 全新（≥4 條 date + past-date 測試） |
| `packages/shared/schemas/card.test.ts` | +13 conformance（modes 4 + days 6 + date 3） |
| `CardBuilderEditorWorkspace.step6-integration.test.tsx` | 5 條既有 test 加 free-card fields 預期（stamp / reward / cashback） |

## 衍生（衍生議題 / 後續 action）

1. **`MembershipHasExpiryToggle` 的 ON 狀態顏色在 free card 偏深** — 付費卡使用 `bg-primary text-on-primary` 在 free card 上下文沒問題，但免費卡 user 可能覺得「指定到期日」顏色對比太強烈。→ 不在本批次處理；若 user feedback 後再評估用 `bg-secondary` 變體。
2. **`MembershipTierNameField` 在 free-card 路徑強制必填** — 但若 `setIsPaid(false)` auto-seed 的 tier 有預設名稱（例如 "VIP"），使用者沒輸入直接 Next 會被 validation 擋下。→ 不在本批次；store auto-seed 目前不給 name，user 必須手動輸入符合「這是你的會員卡」語意。
3. **`membershipSpecificExpiryDate` 的 `min={today}` 在跨時區使用者可能誤判** — 例如 UTC+8 凌晨 1 點使用者看到「昨天」當成 past date。→ 不在本批次；native `<input type="date">` 本來就吃使用者瀏覽器 local timezone；跨時區 edge case 等 production feedback 再處理。
4. **`MembershipExpiryModeField` 切換時 store 雙向清除** — 但若 user 已經填了 `custom_days: 100`，切到 `specific_date` 再切回 `custom_days`，原本的 100 就不見了（被雙向清除）。→ 這是 by design（避免 stale data leak）；若 user 反饋需要 preserve，可在 setter 加「值進 history」邏輯。

## 自問

- **為什麼 free-card 必須有 editor 而不是繼續空狀態？**
  → 業務上「免費 + 限期」是 legitimate use case（試用會員卡、限期免費 VIP、活動限定會員）；空狀態讓租戶誤以為「免費卡不能設定任何東西」。

- **為什麼 free-card expiry 是 card-level 而不是 per-tier？**
  → Free card 永遠只有 1 個 implicit tier（auto-seeded），不需要 per-tier expiry 概念；card-level 簡化 UI 跟 store shape。

- **為什麼付費卡的 expiry 用 `durationType: 'monthly' \| 'yearly' \| null` 而 free-card 用 `'custom_days' \| 'specific_date' \| null`？**
  → 付費卡的 expiry 跟購買週期綁（每月付費 = 月底到期、年付費 = 年底到期、null = 終身）；free card 沒有購買週期，必須直接表達「什麼時候到期」—自訂天數（N 天後）或指定日期（某月某日）。

- **為什麼 `MembershipHasExpiryToggle` 在 free-card 也顯示而不是省略？**
  → Free-card user 也需要「終身免費 vs 限期免費」二元選擇；toggle 統一兩邊 OFF 語意（無期限（終身會員）），ON 才分流 copy。

- **為什麼 `setMembershipExpiryMode` 切換時雙向清除？**
  → 避免「mode 是 custom_days 但 days=null、date 還留著」的半填狀態（DB round-trip 看到半填欄位會 silent overwrite）。若 user 來回切換，舊值丟失是 by design — 跟 `setEarningMode` 切換清空 per-tier rate 一致。

- **為什麼不直接延伸 `durationType` 讓付費卡 free-card 共用？**
  → 'monthly' / 'yearly' 對 free card 沒意義（沒購買週期）；'custom_days' / 'specific_date' 對 paid card 不夠彈性（可能想表達「每月續訂到 2030-12-31」這種 hybrid）。兩組語意平行存在最清楚。

- **為什麼 hero intro 用 isPaid selector 切換而不是 in-component 條件？**
  → `Step6CardLogic` 是 dispatcher（Rule 000 § A.2），不該知道 membership_card 內部細節；hero intro 跟 `MembershipCardLogic` 共用 `isPaid` selector，分散兩處反而維護成本高。dispatcher 知道 `isPaid` 是必要的（之後若其他卡種也有 paid/free 變體可 reuse pattern）。

## 索引

- 對齊既有 DEV LOG：`0911-step6-cashback-card-dev-log.md`（CashbackCardLogic 是同類型 4 層 schema sync 完整範本；本次 free-card extension 沿用同樣 pipeline）
- 對齊既有 DEV LOG：`0913-membership-preview-6-fixes.md`（本次是 0913 membership 實作的延伸 — 從付費卡完整 / 免費卡空狀態 → 付費卡完整 / 免費卡完整）
- 對齊既有 rule：Rule 019 § 4.1（4 層 schema sync 鐵律） + Rule 023（shared package 邊界） + Rule 025（vibe coding L2 checklist）
- 對齊既有 sibling feedback：`runs/improvements/feedback/20260822-migration-apply-pipeline.md`（Rule 035 migration apply pipeline — 本次**沒有**新增 migration，DB schema 沒變更，只是 JSONB key 新增）

---

> 撰寫者：cursor assistant ｜ 時間：2026-09-14 05:49 (UTC+8)
