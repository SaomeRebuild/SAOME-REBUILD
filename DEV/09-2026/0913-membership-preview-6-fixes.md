# Membership Card Preview 修正 DEV LOG：6 個 UI 缺陷收尾

## Metadata

- 日期：2026-09-13
- 範圍：CardBuilderEditor 的 Membership Card 預覽 + Step 6 編輯器
- 目標：修正 2026-09-13 加入 Membership Card 後浮現的 6 個 UI 缺陷
  - Fix 1：會員獎勵位置（DOM 結構正確，無需修改）
  - Fix 2：移除 membership_card 的 memberLevel override 與 firstMembershipTierName 鏈
  - Fix 3：Strip 移除 UserIcon（membership branch）— 對齊真實 Apple Wallet pass
  - Fix 4：會員姓名 fallback（已有邏輯，新增測試覆蓋）
  - Fix 5：移除 MembershipCardLogicPreview（Step 6 內 Live Preview 區塊）
  - Fix 6：MembershipHasExpiryToggle ON 狀態加 bg-primary 背景
- 對齊既有 rule：
  - Rule 000（modular design）— 主組件 ≤ 100 行、拆 sub-component
  - Rule 019（schema contract drift）— 不動 DB schema、不改 migration
  - Rule 023（i18n namespace）— 移除 dead keys + 同步 test i18n
  - Rule 025（vibe coding L2 checklist）— 順序執行 6 個 fix + 驗證 SOP
- Plan ref：[membership_card_preview 修正計畫 dc27be8b](../../.cursor/plans/membership_card_preview_修正計畫_dc27be8b.plan.md)

## 問題與根因

2026-09-13 加入 Membership Card（見 `Step6CardLogic/MembershipCardLogic/`）後，使用者於預覽頁面回報 6 處視覺缺陷：

| # | 缺陷描述 | 根因 |
|---|---|---|
| 1 | 會員獎勵位置（使用者描述「覆蓋正面欄位」） | 實際 DOM 結構正確（Section 1.5 在背面底部），內容是測試殘留字串；視覺上是正確的 |
| 2 | 卡片正面的「會員等級」欄位被改成「獎勵」+ 第一個 tier 名 | `PassCardPreviewBody::resolveSlot` 的 membership_card override branch（line 192-200，2026-09-13 加入）誤把 memberLevel slot override 成 stampLabel + `firstMembershipTierName`，違反使用者意願 |
| 3 | Strip 區塊顯示 UserIcon（會員卡限定） | 真實 Apple Wallet pass 的 strip 不會出現 user glyph（label/value 配對已足夠），UserIcon 是 over-design |
| 4 | 會員姓名沒輸入時顯示空字串而非預設值 | 已有 fallback `{name || t('fieldPreview.memberName.value')}`（→ 王大明 / Thabo Mokoena），但缺測試覆蓋 |
| 5 | Step 6 編輯器底部有冗餘 Live Preview 區塊 | `MembershipCardLogicPreview` 顯示的內容已經在右側卡片預覽鏡像出來，雙重顯示是 noise |
| 6 | Toggle ON 狀態沒背景色（使用者描述「擋住字」） | 舊實作用 thumb 軌道當唯一視覺指示，button 本身維持 `bg-card`，看不出 ON/OFF 差異 |

### 為什麼 Fix 2 的 override branch 必須移除

stamp_card / reward_card / cashback_card 的 memberLevel override 是有意義的（會員等級其實是「獎勵 tier」），但 membership_card 的「會員等級」是真實的「會員等級」——會員有 VIP / Gold / Silver 之分，跟「兌換什麼獎勵」是兩件事。Override 邏輯誤把兩者混為一談。

### 為什麼 Fix 5 的 Live Preview 必須刪

`PassCardPreviewBack` 已經在卡片背面 Section 1.5 渲染會員獎勵 + tier 資訊；右側即時預覽也顯示同一份資料。Step 6 的 Live Preview 只是 editor 區域的 mirror，無實質功能，純粹佔空間。

## 實作內容

### Fix 2 — 移除 membership_card override + firstMembershipTierName 鏈

| 檔案 | 變更 |
|---|---|
| `PassCardPreviewBody.tsx` | `resolveSlot` 移除 `membership_card + memberLevel` branch（line 192-200 → 整段刪除）；介面移除 `firstMembershipTierName?: string` prop |
| `PassCardPreview.tsx` | 解構移除 `firstMembershipTierName`；轉發給 `PassCardPreviewBody` 時移除該 prop |
| `PassCardPreview.types.ts` | 介面移除 `firstMembershipTierName` 欄位與 JSDoc |
| `PreviewWrapper.tsx` | 解構移除 `firstMembershipTierName`；兩個 `<PassCardPreview>` 呼叫都移除該 prop |
| `PreviewWrapper.types.ts` | 介面移除 `firstMembershipTierName` 欄位與 JSDoc |
| `CardBuilderEditorPreview.tsx` | 移除 `firstMembershipTierName` 變數；`<PreviewWrapper>` 呼叫移除該 prop（仍保留 `membershipTiersRewards` 用於 Section 1.5）|
| `PassCardPreviewBody.test.tsx` | 移除既有 `membership_card + firstMembershipTierName="Gold"` 測試；新增 `membership_card + memberLevel → 原始 label/value pair` regression 測試 |

### Fix 3 — Strip 移除 UserIcon（membership branch）

| 檔案 | 變更 |
|---|---|
| `PassCardPreviewStrip.tsx` | import 從 `CreditCard, UserIcon` 改回 `CreditCard`；`isMembership` branch 移除 `<UserIcon>` 渲染，保留 label/value 配對 |
| `PassCardPreviewStrip.test.tsx` | 新增 `describe('PassCardPreviewStrip — membership branch')` 區塊：<br>1. 渲染 strip-membership testid<br>2. 無 lucide-user SVG<br>3. 渲染 label/value spans<br>4. 空白 `name=""` fallback 到 `t('fieldPreview.memberName.value')`<br>5. 提供 `name="Alice Chen"` 時正確顯示<br>6. `isMembership` 為 false 時不渲染 strip-membership |

### Fix 4 — 會員姓名 fallback（測試覆蓋）

不需要改 production code（`{name || t('fieldPreview.memberName.value')}` 已正確）。測試覆蓋見 Fix 3 區塊的測試 #4 / #5。

### Fix 5 — 移除 MembershipCardLogicPreview

| 檔案 | 變更 |
|---|---|
| `MembershipCardLogicPreview.tsx` | **整個檔案刪除**（dead code，違反 Rule 023）|
| `MembershipCardLogic.tsx` | 移除 `MembershipCardLogicPreview` import 與 `<MembershipCardLogicPreview />` 渲染 |
| `cardEditor.zh-TW.ts` | 移除 `step6.membership.preview.*` 區塊（title / tierUnknown / unnamedTier / lifetime / lifetimeFree / lifetimeWithCost / monthly / monthlyFree / yearly / yearlyFree / durationUnset / tierLineUnknown / rewardsHeader）|
| `cardEditor.en.ts` | 同步移除 `step6.membership.preview.*` 區塊 |
| `MembershipCardLogic.test.tsx` | 既有 5 個 test 中移除 `screen.getAllByText('step6.membership.preview.tierUnknown')` 斷言；新增 `does NOT render MembershipCardLogicPreview (regression 2026-09-13)` test |
| `MembershipTierList.tsx` | 空狀態提示從 `t('step6.membership.preview.tierUnknown')` 改用 `t('step6.membership.validation.tierRequired')`（語意一致：empty state = 「請至少新增 1 組會員等級」）|

### Fix 6 — MembershipHasExpiryToggle ON 狀態加 bg-primary

| 檔案 | 變更 |
|---|---|
| `MembershipHasExpiryToggle.tsx` | button className 從 `bg-card text-foreground` 拆成兩個 branch：<br>- ON：`border-primary bg-primary text-on-primary`<br>- OFF：`border-border bg-card text-foreground`<br>移除內部 thumb 軌道 + thumb knob（簡化設計：純背景色切換）|
| `MembershipHasExpiryToggle.test.tsx` | 新增 3 條測試：<br>1. `hasExpiry=true: button has bg-primary class, NOT bg-card`<br>2. `hasExpiry=false: button has bg-card class, NOT bg-primary`<br>3. `button no longer contains the thumb track / knob inner spans` |

## 4 層 schema 同步檢查（Rule 019）

本次修正**不涉及 DB schema 變更**：
- 不新增 migration
- 不改 `templateSettings` JSONB shape
- 不動 `passes` / `templates` table

`firstMembershipTierName` 是純 UI prop，從 `CardBuilderEditorPreview.tsx` 一路 propagate 到 `PassCardPreviewBody.tsx`——這層 UI prop chain 與 Rule 019 § 4.1 的 4 層契約（DB / shared schema / backend request / backend service）**完全不相關**，因此不需要跑 4 層 schema sync 檢查。

## i18n 同步檢查

| 動作 | 細節 |
|---|---|
| 移除 dead keys | `step6.membership.preview.*`（zh-TW + en）|
| 新增 / 修改 keys | 無 |
| 同步 `apps/frontend/src/test/i18n.ts` | 不需變動（`cardEditor` namespace 已存在，刪 keys 不影響 import）|
| 同步 `apps/frontend/src/i18n/index.ts` | 不需變動 |
| 替代 empty-state key | `step6.membership.preview.tierUnknown` → `step6.membership.validation.tierRequired`（同 namespace、同語意）|

## 受影響測試覆蓋

| 測試檔 | 新增 / 修改 |
|---|---|
| `MembershipHasExpiryToggle.test.tsx` | +3 regression test |
| `MembershipCardLogic.test.tsx` | -1（移除舊 preview 斷言）、+1（無 preview section）|
| `PassCardPreviewStrip.test.tsx` | +6 membership branch tests（含 Fix 4 姓名 fallback）|
| `PassCardPreviewBody.test.tsx` | -1（移除 membership_card override test）、+1（membership_card default label/value regression）|

## 驗證 SOP 結果

```
typecheck (npx tsc -b --noEmit):
  exit 0 ✓

verify:i18n (npm run verify:i18n --workspace=apps/frontend):
  17 namespace(s) passed (34 locale files) ✓

frontend tests (npm test --workspace=apps/frontend --run):
  Test Files  95 passed | 1 skipped (96)
  Tests       1063 passed | 5 skipped (1068)
  exit 0 ✓

backend tests (npm test --workspace=apps/backend --run):
  Test Files  18 passed (18)
  Tests       235 passed (235)
  exit 0 ✓

build (npm run build --workspace=apps/frontend):
  audit-config-defaults: OK ✓
  built in 1.02s
  exit 0 ✓
```

## 衍生（衍生議題 / 後續 action）

1. **`MembershipCardLogicFreeState` 的「會員獎勵」section 視覺** — 會員卡付費狀態有 Section 1.5，但免費狀態（`isPaid=false`）目前只顯示 `freeStateTitle` + `freeStateHint`，沒有獎勵 section。是否需要在免費狀態也加一個輕量提示「升級到付費會員卡即可新增會員獎勵」？→ 暫不做（不在本次 6 個 fix 範圍）。
2. **Step 3 `cardType=membership_card` 的 `memberLevel` option label** — 目前跟其他卡種一樣是「會員等級」，但跟 reward / cashback / stamp 的「獎勵」option 平行時，使用者可能會混淆。→ 暫不做（不在本次 6 個 fix 範圍；可在下次 review 加入 spec 評估）。
3. **`step6.membership.preview.title` 的 i18n key** — 已被刪除，但 grep 確認無其他地方引用，安全。

## 自問

- 為什麼 membership_card 不該跟 stamp / reward / cashback 一樣有 memberLevel override？
  → 因為會員卡有真正的「會員等級」語意（VIP / Gold / Silver 是會員身分），跟「兌換獎勵」是兩件事。Override 邏輯適合用在「會員等級欄位其實是獎勵 tier 名」的卡種，不適合用在會員卡。

- 為什麼 UserIcon 在 strip 是 over-design？
  → 真實 Apple Wallet pass 的 strip 從不渲染 user glyph（label/value 配對的 typography hierarchy 已足夠溝通「這是個 slot」）。加 icon 反而擠壓空間、跟其他卡種的 strip 視覺風格斷裂。

- 為什麼 Toggle 簡化成單純背景色切換？
  → 舊實作 thumb 軌道 + thumb knob 是「開關」標準 pattern，但對教學場景的「有期限 / 終身會員」二元選項太精緻。改用單純背景色（ON = primary，OFF = card）反而讓 ON/OFF 對比更強烈，跟 Tailwind shadcn Toggle Group 風格一致。

- 為什麼 MembershipCardLogicPreview 直接整個檔案刪除而不是保留？
  → dead code 違反 Rule 022 與 Rule 023（reusable component 必須有重用者；無引用的元件是維護負擔）。如果未來需要「editor-side 即時預覽」，可以從 `CashbackCardLogicPreview` 複製 pattern 重新建立。

## 索引

- Plan ref：`plans/membership_card_preview_修正計畫_dc27be8b.plan.md`
- 對齊既有 DEV LOG：`0912-step3-cashback-card-display-fields.md`（同類型 cardType-specific UI 修正）
- 對齊既有 DEV LOG：`0911-step6-cashback-card-dev-log.md`（CashbackCardLogic 是本次 MembershipCardLogic 的 sibling）
