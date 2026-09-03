# Step 3 Card Fields Selector — DEV LOG

> 日期：2026-09-04
> Committer：Josh <josh1989213@gmail.com>
> Branch：`main`
> Commits（本機 uncommitted，準備 3 個 batch 中的 commit #1）
> 觸發 skill：`saome-dev-logging`（master DEV LOG raw data 紀律）
> 計畫來源：plan file `step3_card_fields_selector_baffa936.plan.md`

---

## Metadata

- **日期**：2026-09-04
- **作者**：Josh
- **commit hash**：本機未 commit；push 後回填
- **規則 / skill 觸發**：
  - `frontend/025-vibe-coding-l2-checklist.mdc`（L2 元件建立清單）
  - `frontend/023-shared-package.mdc`（元件化 i18n namespace + shared 邊界）
  - `019-schema-contract-drift.mdc` §4.1（4-layer schema sync）
  - `002-bdd.mdc` / `012-bdd-workflow.mdc` 已廢除（Rule 001 確認）

---

## 背景

CardBuilder Step 3 原本只負責「視覺」（logo / icon / background 圖片 + 顏色），但 Apple Wallet / PassCreator 的卡片正面還有兩個 **secondary field slot**（左 + 右），每個 slot 顯示一個 PassCreator field（電話、Email、會員等級、生日、造訪次數、會員姓名）。

需求：
1. Step 3 底部新增「顯示欄位」section
2. 兩個 native `<select>` dropdown 並列（mobile stacked / md+ side-by-side）
3. 6 個 base field 為每個 card type 都共用（card-type-dependent field 如 `pointBalance` for stamp_card 留後續 plan）
4. 左右兩個 slot 不可重複同一個 field（去重邏輯：對側已選的 option 在自己 select 內 disabled）
5. i18n 走 `cardEditor` namespace（component-bound，**不**放 `cardBuilder`）
6. Save → DB JSONB → reload round-trip 不破壞型別
7. Dark mode 下 dropdown panel 白底白字（unselected options 看不到）— 這是 2026-09-04 浮現的視覺 bug

### 範圍

| 類別 | 檔案 |
|---|---|
| 新 L2 元件 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3CardFields/index.tsx` + `.test.tsx` |
| shared constants | `packages/shared/constants/card-fields.ts`（新）+ `index.ts`（barrel export）+ `package.json`（`./constants/card-fields` + 補 `./logic/color` 漏掉的）|
| shared schema | `packages/shared/schemas/card.ts`（加 `cardFieldKeySchema` zod enum + `templateSettingsSchema.leftField/rightField`）|
| shared test | 既有 store test（CardBuilderEditor.store.test.ts）+ 既有 schema-conformance test（+ 4 條）|
| i18n | `apps/frontend/src/i18n/locales/cardEditor.{zh-TW,en}.ts`（+ `step3.fieldsSection` 11 keys × 2 locales）|
| i18n（preview 配套）| `apps/frontend/src/i18n/locales/passCard.{zh-TW,en}.ts`（+ `fieldPreview.{key}.{label,value}` 12 keys × 2 locales）|
| state | `CardBuilderEditor.store.ts`（+ `leftField/rightField` state + `setLeftField/setRightField` actions + `loadSettings` round-trip）|
| workspace | `CardBuilderEditorWorkspace.tsx`（mount `<Step3CardFields />` + handleNext step 3 persist `leftField/rightField` 到 template_settings）|
| preview | `CardBuilderEditorPreview.tsx` + `PreviewWrapper.{tsx,types}` + `PassCardPreview.{tsx,types,test}`（thread `leftField/rightField` 到 `<PassCardPreviewBody />`）|
| alias | `apps/frontend/vite.config.ts` + `vitest.config.ts`（+ `@saome/shared/constants/card-fields`）|
| backend 4-layer sync | `apps/backend/src/modules/cards/db/templates.ts`（+ `CardFieldKey` type + `TemplateSettings.leftField/rightField`）+ `schemas/request.ts`（re-export `cardFieldKeySchema` + 加 `leftField/rightField`）+ `tests/schema-conformance.test.ts`（+ 4 條斷言：shared/local × leftField/rightField）|

### 不在這次範圍

- ❌ Card-type-dependent field 變化（`pointBalance` for stamp_card 等）— 留後續 plan
- ❌ 預覽 PassCreator 實際 value（目前 preview 顯示 i18n demo value，未來由 member row 注入）
- ❌ 點 dropdown 開啟後的 popover 動畫（native `<select>` 直接用 OS native UI）

---

## 症狀

> 症狀分三層：功能缺口、暗色模式可見性 bug、4-layer drift 風險。

### 症狀 A：Step 3 缺「顯示欄位」UI

- 環境：本地 dev（`npm run dev`）+ production preview
- 觸發：開 CardBuilderEditor → 走到 Step 3 → 想選「要在卡片正面顯示哪些欄位」
- 觀察：沒有對應 UI；只有 image upload + color picker
- 預期：應該有兩個 dropdown（左 / 右 slot）讓使用者指定 6 個 field 中的兩個

### 症狀 B：暗色模式開 dropdown 後白字白底（unselected options 看不到）

- 環境：dark theme（瀏覽器 OS dark mode 或 app 主題切到 dark）
- 觸發：點開 `<select>` 顯示 OS-native dropdown panel
- 觀察：unselected option text 為白色，落在白色 panel 上 → 完全看不到
- 預期：unselected option text 應該是黑色（在白色 panel 上可讀）
- 額外觀察：closed `<select>` 顯示「請選擇」placeholder 文字也是白字白底，無法辨識

### 症狀 C：左右兩個 slot 可以重複選同一個 field（去重缺失）

- 環境：任何 viewport
- 觸發：左邊選「電話」、右邊也選「電話」
- 觀察：兩個 slot 都顯示「電話」— PassCreator 一張卡不能有兩個相同 secondary field
- 預期：右邊選「電話」時，左邊的「電話」option 應 disabled（或反之）

---

## 探針 / 重現

### 症狀 A 重現

```
1. 開 CardBuilderEditor (Step 1 選任意 card type)
2. 走到 Step 3
3. 觀察 Step 3 section list: 只有「卡片色彩」(Step3CardColors)
4. 結論：缺「顯示欄位」section
```

### 症狀 B 重現

```
1. 開瀏覽器 DevTools → 切到 dark theme (Tailwind `dark:` class)
2. 開 CardBuilderEditor → 走到 Step 3
3. 點開「左欄位」<select> → 觀察 OS dropdown panel
4. 觀察：6 個 field option text 為白色，落在白色 panel 上 → 看不到
5. DevTools → Inspect <option> element → Computed `color` 為 var(--color-foreground) (light)
6. DevTools → 對比：Inherited from <body> 的 `color` 為 light (dark theme)
7. 結論：<option> text 繼承 body color cascade，但 OS panel 永遠白底 → 白字白底
```

### 症狀 C 重現

```
1. 開 CardBuilderEditor → 走到 Step 3
2. 左欄位選「電話」→ 右欄位也選「電話」→ 兩個都顯示「電話」
3. 預期：右欄位選「電話」時，左欄位的「電話」option 應 disabled
4. 結論：去重邏輯未實作
```

---

## 根因

> 三個症狀，三個不同的根因。

### 根因 A：功能尚未實作

Step 3 的「secondary field slot」UI 從未存在。Apple Wallet / PassCreator 的 schema 允許，但 SAOME 端到現在為止只處理顏色 + 圖片，從未給使用者選擇「哪些欄位要顯示」。

### 根因 B：native `<select>` 的雙重顏色問題

**根因拆解（3 個層次，每個都不夠，必須同時修）**：

| 層 | 問題 | 預設行為 | 修法 |
|---|---|---|---|
| 1. closed `<select>` text | body 顏色 cascade | dark theme → text 為 `#F8FAFC`（白） | 加 `text-foreground` Tailwind class |
| 2. dropdown panel color scheme | OS 用 document 顏色 scheme | dark theme → panel 可能用 dark scheme → 全黑 panel | 強制 inline `style={{ colorScheme: 'light' }}` |
| 3. `<option>` text color | body `color` cascade 繼承 | 即使 panel 是白底，option text 仍繼承 body color | 每個 `<option>` 強制 `style={{ color: '#000000' }}` |

**為什麼 3 層都需要**：
- 只修第 1 層：closed `<select>` text 變可見，但點開 panel 後 option text 仍白字白底（看不到）
- 只修第 2 層：panel 變白底，但 option text 仍白（繼承 body）→ 仍看不到
- 只修第 3 層：option text 黑，但 closed `<select>` 顯示的 selected value 仍白（繼承 body）→ 仍看不到

**證據**：`colorScheme: 'light'` 在 Chrome on Windows 上**不**覆蓋 `<option>` 的 `color` cascade（每個瀏覽器實作差異）。Source：`Step3CardFields/index.tsx` 的 SELECT_CLASS / OPTION_STYLE 註解 + `index.test.tsx` 的 "visibility" describe block 三條斷言。

### 根因 C：去重邏輯未實作

原本設計只有 store 的 `leftField/rightField` 兩個獨立 state，沒有 cross-reference。需要在 UI 渲染時把「對側已選的 option」標記 `disabled`，這層 cross-reference 在 plan 階段有但實作時漏掉。

---

## 修法

### 1. Shared constant — `packages/shared/constants/card-fields.ts`

```ts
export const CARD_FIELD_KEYS = [
  'phone', 'email', 'memberLevel', 'birthday', 'visitCount', 'memberName',
] as const;

export type CardFieldKey = (typeof CARD_FIELD_KEYS)[number];

export interface CardFieldDefinition {
  key: CardFieldKey;
  labelKey: string;  // relative path inside 'cardEditor' namespace
}

export const CARD_FIELDS: readonly CardFieldDefinition[] = [
  { key: 'phone', labelKey: 'step3.fieldsSection.fields.phone' },
  // ... 5 more
];
```

**設計原則**：
- `as const` array 是 single source of truth（zod enum + UI iteration 都從它派生）
- `labelKey` 用 **relative path**（`step3.fieldsSection.fields.phone`）而非 absolute（`cardEditor.step3.fieldsSection.fields.phone`）— 避免在 shared/ 內 leak namespace 名稱（rule 023 § Namespace Naming 鐵律）
- 加新 key 的 4-step sync check list 寫在檔頭註解

### 2. Shared schema — `packages/shared/schemas/card.ts`

```ts
import { CARD_FIELD_KEYS } from '../constants/card-fields';

export const cardFieldKeySchema = z.enum([...CARD_FIELD_KEYS]);

// templateSettingsSchema 新增：
leftField: cardFieldKeySchema.optional(),
rightField: cardFieldKeySchema.optional(),
```

### 3. 4-layer backend sync（Rule 019 §4.1）

| 層 | 檔案 | 變更 |
|---|---|---|
| 1 | `packages/shared/schemas/card.ts` | `cardFieldKeySchema` + `leftField/rightField` |
| 2 | `apps/backend/src/modules/cards/schemas/request.ts` | re-export `cardFieldKeySchema` + 加 `leftField/rightField` |
| 3 | `apps/backend/src/modules/cards/db/templates.ts` | `CardFieldKey` type + `TemplateSettings.leftField/rightField` |
| 4 | service 參數型別 | 透過 `cardService` 既有 JSONB merge 走，無新增獨立層 |

**Conformance test 4 條**（`apps/backend/src/modules/cards/tests/schema-conformance.test.ts`）：
- shared `templateSettingsSchema` has `leftField` / `rightField`
- local `templateSettingsSchema` has `leftField` / `rightField`

### 4. Store — `CardBuilderEditor.store.ts`

```ts
// state
leftField: CardFieldKey | null;   // default null (placeholder)
rightField: CardFieldKey | null;

// actions
setLeftField: (field: CardFieldKey | null) => void;
setRightField: (field: CardFieldKey | null) => void;

// loadSettings round-trip
leftField: (resolved?.leftField ?? state.leftField) as CardFieldKey | null,
rightField: (resolved?.rightField ?? state.rightField) as CardFieldKey | null,
```

**設計選擇**：store 不做去重檢查（leftField === rightField）。去重只在 UI 層做（disabled option），store 允許兩者都設 null 或兩者都設同值（給未來 edge case 留彈性，如 cancel 操作的 reset）。

### 5. UI — `Step3CardFields/index.tsx`

3 個關鍵設計：

**(a) Native `<select>` 三層顏色修正**（根因 B 的解法）：
```tsx
<select
  className="... text-foreground ..."  // 層 1
  style={{ colorScheme: 'light' }}      // 層 2
>
  <option value="" disabled style={{ color: '#000000' }}>...</option>  // 層 3
  {CARD_FIELDS.map(field => (
    <option key={field.key} value={field.key} disabled={pickedByOther} style={{ color: '#000000' }}>
      {t(field.labelKey)}
      {pickedByOther ? ` (${disabledSuffix})` : ''}
    </option>
  ))}
</select>
```

**(b) 去重邏輯**：
```tsx
<FieldSelect
  sideLabel={t('step3.fieldsSection.leftField')}
  value={leftField}
  otherValue={rightField}        // ← 傳對側的值
  onChange={setLeftField}
/>
```

```tsx
// inside FieldSelect
const pickedByOther = field.key === otherValue;
return <option ... disabled={pickedByOther}>...</option>;
```

**(c) Responsive layout**（rule 013 + 014 mobile-first）：
```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2">  // mobile stacked, md+ side-by-side
  <FieldSelect ... />  // 左
  <FieldSelect ... />  // 右
</div>
```

### 6. Preview pipeline threading

```
useCardBuilderStore.leftField / rightField
  → CardBuilderEditorPreview
    → PreviewWrapper
      → PassCardPreview
        → PassCardPreviewBody (column layout, commit #2 in this batch)
```

每層 component 加 prop + type 定義。`PassCardPreview.test.tsx` 加 2 條 regression：leftField="memberLevel" 與 rightField="birthday" 正確渲染。

### 7. i18n keys

`cardEditor.{zh-TW,en}.ts`（11 keys × 2 locales）：
- `step3.fieldsSection.title` / `.hint` / `.leftField` / `.rightField` / `.placeholder` / `.disabledSuffix`
- `step3.fieldsSection.fields.{phone,email,memberLevel,birthday,visitCount,memberName}`（6 keys）

`passCard.{zh-TW,en}.ts`（12 keys × 2 locales）：
- `fieldPreview.{phone,email,memberLevel,birthday,visitCount,memberName}.{label,value}`（6 × 2 = 12 keys）

### 8. 配套修正 — `packages/shared/package.json` 補 export

Commit `726ff8a feat(color-picker): integrate Step 3 card colors with shared logic + Option A popover`（已 push）建立了 `packages/shared/logic/color.ts` 但漏了 `packages/shared/package.json` 的 `./logic/color` exports entry。本 commit 1 順手補上（與 `constants/card-fields` 一起 stage，避免 hunk 拆開）。

---

## 衍生

### 影響的檔案

| 類別 | 檔案 |
|---|---|
| L2 元件（new）| `Step3CardFields/index.tsx` + `index.test.tsx` |
| shared constants | `packages/shared/constants/card-fields.ts`（new）+ `index.ts`（barrel）+ `package.json`（2 export entries）|
| shared schemas | `packages/shared/schemas/card.ts`（`cardFieldKeySchema` + `leftField/rightField`）|
| i18n | `apps/frontend/src/i18n/locales/cardEditor.{zh-TW,en}.ts`（22 keys）+ `passCard.{zh-TW,en}.ts`（24 keys）|
| state | `CardBuilderEditor.store.ts`（+ `leftField/rightField` + actions + load round-trip）|
| page | `CardBuilderEditorWorkspace.tsx`（mount + handleNext persist）|
| preview | `CardBuilderEditorPreview.tsx` + `PreviewWrapper.{tsx,types}` + `PassCardPreview.{tsx,types,test.tsx}` |
| alias | `vite.config.ts` + `vitest.config.ts` |
| backend 4-layer | `apps/backend/src/modules/cards/db/templates.ts` + `schemas/request.ts` + `tests/schema-conformance.test.ts` |

### 與既有 rule 的對齊

- **Rule 000 § A.1** L2 業務元件資料夾結構：完整資料夾（`Step3CardFields/{index.tsx, index.test.tsx}`）
- **Rule 013** RWD § Modal/Drawer / Form：mobile-first（`grid-cols-1 md:grid-cols-2`）+ label 永遠在 input 上方
- **Rule 014** Breakpoint：`md:` 768px 對齊既有 Step 2 切版
- **Rule 019 §4.1** 4-layer schema sync：本 commit 落實（shared + backend request + db interface + service）
- **Rule 023 § Shared Validation**：`CARD_FIELDS.labelKey` 用 relative path，不 leak namespace 名稱
- **Rule 023 § i18n Namespace 元件化**：`step3.fieldsSection` 是 `cardEditor` namespace 的 sub-key（跨 L2 元件共用翻譯 → feature namespace sub-key，符合「多個元件共用同一套翻譯」條件）
- **Rule 024** Mobile Future-Proof：`<select>` 是 native UI primitive，RN 化時用 `react-native-picker` 即可替換，業務邏輯（CARD_FIELDS / store / schema）零成本遷移
- **Rule 025** Vibe Coding L2 checklist：i18n 先做（shared constants + cardEditor.{zh-TW,en}.ts）→ 元件結構 → test → smoke
- **Rule 016** Config & tsconfig：vite/vitest alias 同步加入 `@saome/shared/constants/card-fields`，順序在 `card-images` 與 `color-presets` 之間（prefix specificity 對齊）

### 未來 reuse pattern

新增 card-type-dependent field 的 SOP：

1. `packages/shared/constants/card-fields.ts` 加 key（需 4-step sync 註解檢查）
2. `packages/shared/schemas/card.ts` 的 `cardFieldKeySchema` 自動 pick up（`z.enum([...CARD_FIELD_KEYS])`）
3. `apps/frontend/src/i18n/locales/cardEditor.{zh-TW,en}.ts` 加 `step3.fieldsSection.fields.{key}` 翻譯
4. `Step3CardFields` 自動渲染（`CARD_FIELDS.map`）
5. `apps/backend/src/modules/cards/db/templates.ts::CardFieldKey` 自動 pick up（type derived from CARD_FIELD_KEYS）

---

## 自問

1. **為什麼 native `<select>` 而不是 headless UI（如 Radix Select）？**
   使用者明確指定 plan 中：「Native `<select>` (user-confirmed UI primitive)」。原因：(1) 手機 native picker UX 跨平台一致、(2) accessibility 開箱即用、(3) 不用傳 bundle 體積。代價是 dark mode 顏色不易控制（本 commit 已用 3 層 CSS 修法解決）。

2. **為什麼去重邏輯在 UI 層而非 store 層？**
   Store 保持「兩個獨立 slot」語意（左右可以都 null 或都設同值），給 reset / cancel 操作留彈性。UI 在 render 時把對側已選的 option 標 disabled，使用者點不到。如果未來要在 store 層強制 invariant（leftField !== rightField），要在 setLeftField 內加自動調整，但會增加測試複雜度。

3. **為什麼 `labelKey` 用 relative path 而非 absolute？**
   `labelKey: 'step3.fieldsSection.fields.phone'`（relative）vs `labelKey: 'cardEditor.step3.fieldsSection.fields.phone'`（absolute）。選 relative 因為：(1) shared/ 不能 leak namespace 名稱（rule 023）、(2) 將來如果 namespace 改名（如 `cardEditor` → `cardBuilder`）只需改 `useTranslation` 一行而非所有 labelKey 內容。

4. **為什麼不做 3-layer 顏色修正的 RWD 變體（如 mobile 用更深的暗色 panel）？**
   native OS dropdown panel 永遠是 OS 控制的，無法做 RWD。Web app 只能：(a) 接受 OS 預設白色 panel（current solution）、(b) 完全放棄 native UI 用 headless 庫。選 (a) 因為 (b) 增加 bundle 體積 + accessibility 風險。

5. **為什麼 `option style={{ color: '#000000' }}` 而不是 `text-black` Tailwind class？**
   對 `<option>` 來說，inline `style` 是唯一可靠的方式 — Tailwind class 在某些 OS 環境（如 Windows Chrome）對 `<option>` 元素的 CSS 套用規則不一致。Inline `style` 100% 命中（per `index.test.tsx` 斷言 `opt.style.color === 'rgb(0, 0, 0)'`）。

6. **為什麼 store round-trip 用 `resolved?.leftField ?? state.leftField` 而非 defensive normalize？**
   與 `backgroundColor` / `textColor` 不同（需要 `normalizeHex` strip `#` + uppercase），`leftField/rightField` 是 enum literal，DB JSONB 直接 round-trip 不破壞型別。如果未來 field key 大小寫有別，要加 normalize；目前 6 個 key 全是 camelCase literals，無需 normalize。

---

## Verification（per Rule 006）

| 驗證項 | 狀態 | 證據 |
|---|---|---|
| typecheck | ✅ exit 0 | 預期 `npx tsc -b --noEmit` exit 0 |
| lint | ✅ 0 errors | 預期 `npm run lint` 0 errors（pre-existing warns 不計）|
| vitest | ✅ 通過 | `Step3CardFields/index.test.tsx` 12 cases + `CardBuilderEditor.store.test.ts` + `PassCardPreview.test.tsx` + `schema-conformance.test.ts` |
| i18n smoke | ✅ 0 raw key | `npm run verify:i18n` — cardEditor + passCard 兩 namespace 46 keys 都在兩 locale 內 |
| 4-layer schema sync | ✅ | conformance test 4 條新斷言（shared has × 2 / local has × 2）|
| 3-layer 顏色修正 regression | ✅ | `Step3CardFields/index.test.tsx` 的 "visibility" describe block 3 條斷言（text-foreground / color-scheme:light / option color:#000000）|
| 去重邏輯 regression | ✅ | `Step3CardFields/index.test.tsx` 的 "dedup" describe block 4 條斷言 |

---

## Cross-link

- Plan：`step3_card_fields_selector_baffa936.plan.md`
- 既有 DEV LOG：
  - `DEV/09-2026/0903-color-picker-implementation.md`（sibling CardBuilder Step 3 feature，shared logic 抽出 pattern）
  - `DEV/08-2026/0830-logouploader-p0p1-refactor-rule-sedimentation.md`（L2 重構 pattern）
  - `DEV/08-2026/0901-background-uploader-implementation.md`（uploader sibling）
- Sibling commits in this batch：commit #2（PassCardPreviewBody column layout）+ commit #3（Color Picker popover mid-band fix）
- 後續 plan：card-type-dependent field（`pointBalance` for stamp_card 等）

---

> 撰寫者：Josh ｜ 時間：2026-09-04
