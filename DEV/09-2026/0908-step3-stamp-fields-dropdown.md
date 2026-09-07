# Step 3 Card Fields Dropdown — 新增 3 個 stamp-only options（availableRewards / totalStamps / stampsRemaining）

## Metadata

- **日期**：2026-09-08
- **作者**：Josh <josh1989213@gmail.com>
- **commit hash**：本機**未 commit**（使用者明示 NO COMMIT / NO PUSH）；push 後回填
- **觸發**：Step 6 stamp card 邏輯 + Step 3 stamp grid 已 ship（見 `DEV/09-2026/0907-step6-stamp-card-logic-completion.md` + `runs/improvements/feedback/20260904-stamp-grid-feature.md`），但 Step 3 的「顯示欄位」dropdown 只暴露 6 個 common field，**stamp 卡的對應數字欄位（可用獎勵 / 總印章 / 還差幾個章）沒地方顯示**。本次新增 3 個 stamp-only options。
- **規則 / skill 觸發**：
  - `frontend/025-vibe-coding-l2-checklist.mdc` § 1 i18n（先建翻譯再寫元件 — 本次已對齊既有 namespace）
  - `frontend/023-shared-package.mdc`（card-fields constant 在 shared/）
  - `019-schema-contract-drift.mdc` § 4.1（4-layer sync — `cardFieldKeySchema` 由 `CARD_FIELD_KEYS` 自動 derive，新 key 加進 constant 即同步）
  - `frontend/022-component-reuse.mdc`（沿用既有 `Step3CardFields` 不 fork）
- **相關 DEV LOG**：
  - `DEV/09-2026/0904-step3-card-fields-selector.md`（初次建立 Step 3 fields selector — 6 個 common field）
  - `runs/improvements/feedback/20260904-stamp-grid-feature.md`（Stamp Grid L2 ship，鋪墊 `stamp_card` / `multipass` 兩種卡種）
  - `DEV/09-2026/0907-step6-stamp-card-logic-completion.md`（Step 6 stamp logic，定義 `stamp_card` / `multipass` 的 9 個 stamp 邏輯欄位）

---

## 症狀

### 症狀：stamp 卡的「印章進度」沒對應的 Step 3 顯示欄位

- **環境**：本地 dev（`npm run dev`）
- **觸發**：建立 `cardType='stamp_card'` 的 template → 走到 Step 3「顯示欄位」section → 兩個 dropdown（左/右 slot）只有 6 個 common field（phone / email / memberLevel / birthday / visitCount / memberName）
- **觀察**：
  - 使用者想讓卡片正面顯示「總印章數 3/10」「還差 7 個章換獎勵」這類 stamp 專屬進度資訊
  - 但 dropdown 沒有 stamp 對應欄位 → 使用者必須在 preview 改 hardcoded value 才能看到效果，無法在 Step 3 設定欄位綁定
  - 對應的 `PassCardPreviewBody` 已經能渲染 `availableRewards` / `totalStamps` / `stampsRemaining`（i18n key 在 `passCard.{locale}.ts` 早就有），但**沒有 source field 可綁定**
- **預期**：stamp 卡的 dropdown 應多 3 個 stamp-only options（availableRewards / totalStamps / stampsRemaining）；非 stamp 卡種（cashback / reward / membership / discount / coupon / gift）不應看到這 3 個 options（沒意義）

### 為什麼是「conditional」而不是「全部都顯示」

| 方案 | 結果 | 為什麼選 / 不選 |
|---|---|---|
| 全部 9 個 options 永遠顯示 | 所有 card type 都能選 stamp-only field | ❌ `totalStamps` 在 cashback card 上是無意義的「總印章」概念（cashback 卡沒章）；強迫所有卡種都看見會讓使用者困惑「這 3 個是什麼？」 |
| **依 cardType conditional 過濾**（採用） | 只 stamp_card / multipass 看見 stamp-only options | ✅ 同 Step 3 `<Step3StampGrid />` 的 conditional render guard — stamp grid 只在這兩種卡種顯示，欄位也應該跟著同一條件 |

---

## 實作內容

### 1. CardFieldGroup discriminator 加進 shared constant

`packages/shared/constants/card-fields.ts`:

```ts
export type CardFieldGroup = 'common' | 'stamp';

export const CARD_FIELDS: readonly CardFieldDefinition[] = [
  // common: every card type
  { key: 'phone',       group: 'common', labelKey: 'step3.fieldsSection.fields.phone' },
  { key: 'email',       group: 'common', labelKey: 'step3.fieldsSection.fields.email' },
  { key: 'memberLevel', group: 'common', labelKey: 'step3.fieldsSection.fields.memberLevel' },
  { key: 'birthday',    group: 'common', labelKey: 'step3.fieldsSection.fields.birthday' },
  { key: 'visitCount',  group: 'common', labelKey: 'step3.fieldsSection.fields.visitCount' },
  { key: 'memberName',  group: 'common', labelKey: 'step3.fieldsSection.fields.memberName' },
  // stamp: only stamp_card / multipass
  { key: 'availableRewards', group: 'stamp', labelKey: 'step3.fieldsSection.fields.availableRewards' },
  { key: 'totalStamps',      group: 'stamp', labelKey: 'step3.fieldsSection.fields.totalStamps' },
  { key: 'stampsRemaining',  group: 'stamp', labelKey: 'step3.fieldsSection.fields.stampsRemaining' },
];
```

新檔案 `CARD_FIELD_KEYS` 追加 3 個 key（`availableRewards` / `totalStamps` / `stampsRemaining`）。

### 2. shared schema 自動同步（zod enum derive）

`packages/shared/schemas/card.ts` line 53：

```ts
export const cardFieldKeySchema = z.enum([...CARD_FIELD_KEYS]);
// ↑ 自動從 CARD_FIELD_KEYS derive，新增 key 不必手動維護這裡
```

後端 `apps/backend/src/modules/cards/schemas/request.ts` 已經是 `export * from '@saome/shared/schemas/card'` 形式，4-layer sync 自動跟上。

### 3. 抽出 `filterCARD_FIELDS_BY_CARD_TYPE` 純函式

新增 `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3CardFields/filterCARD_FIELDS_BY_CARD_TYPE.ts`：

```ts
export const STAMP_CARD_TYPES: ReadonlySet<CardType> = new Set<CardType>([
  'stamp_card',
  'multipass',
]);

export function filterCARD_FIELDS_BY_CARD_TYPE(
  cardType: CardType | null,
): readonly CardFieldDefinition[] {
  const showStampGroup = cardType !== null && STAMP_CARD_TYPES.has(cardType);
  return CARD_FIELDS.filter(
    (f) => f.group === 'common' || showStampGroup,
  );
}
```

**為什麼拆成獨立檔**：`Step3CardFields/index.tsx` 是 component-only 檔（oxlint `react(only-export-components)` 規則 — React Fast Refresh 需要 components 是 module 的唯一 export）。把 filter 邏輯獨立成 `.ts` 檔是 oxlint 鐵律。

**為什麼 `STAMP_CARD_TYPES` 在這個檔內**：跟 `<Step3StampGrid />` 的 conditional render guard 同 source-of-truth（同一個 `cardType` 值）；為了避免 cross-module coupling 把 2-element 常數放到 shared/ 是過度設計。Copy-paste 風險靠 `index.test.tsx` 的 conformance test 守住（任何 STAMP_CARD_TYPES 變動會 fail 測試）。

### 4. Step3CardFields 接 `availableFields`

`Step3CardFields/index.tsx` line 156：

```tsx
const availableFields = useMemo(
  () => filterCARD_FIELDS_BY_CARD_TYPE(cardType),
  [cardType],
);
```

`<FieldSelect availableFields={availableFields} />` 把 filtered 結果傳下去。

**Store 行為保留**：使用者若先選了 stamp-only field（如 `availableRewards`）後切到 non-stamp cardType（cashback），store 仍持有 `availableRewards`；dropdown 不再 render 該 option，但 value 不被 silent clear（見 conformance test § 4）。

### 5. i18n 3 keys × 2 locales

`apps/frontend/src/i18n/locales/cardEditor.{zh-TW,en}.ts`:

| key | zh-TW | en |
|---|---|---|
| `step3.fieldsSection.fields.availableRewards` | 可用獎勵 | Available Rewards |
| `step3.fieldsSection.fields.totalStamps` | 總印章數 | Total Stamps |
| `step3.fieldsSection.fields.stampsRemaining` | 還差幾個章 | Stamps Remaining |

沿用既有 `step3.fieldsSection.fields.{key}` 結構（不需要新 namespace，跟 6 個 common field 同一層）。

preview 端的 `passCard.{zh-TW,en}.ts` 早就有對應的 `fieldPreview.{key}.{label,value}`（在 0904 Step3 初次 ship 時就加進去了 — 為未來擴充鋪墊）。

---

## 探針 / 重現

### 重現步驟（修前）

1. `npm run dev` 起 dev server
2. 開 `/dashboard/card-builder/new`，cardType 選「集點卡 (stamp_card)」
3. 走到 Step 3 → 「顯示欄位」section
4. 看左/右兩個 dropdown — 沒有 stamp-only options
5. 切 cardType 到「現金回饋卡 (cashback_card)」— 一樣沒有（合理）
6. 但 stamp_card 也不該跟 cashback 一樣 → 缺條件式顯示

### 修後預期行為

| cardType | dropdown options |
|---|---|
| `null`（Step 1 未選）| 6 common（phone / email / memberLevel / birthday / visitCount / memberName）|
| `stamp_card` | 6 common + 3 stamp = 9 |
| `multipass` | 6 common + 3 stamp = 9 |
| `cashback_card` / `reward_card` / `membership_card` / `discount_card` / `coupon_card` / `gift_card` | 6 common |

### Conformance test 守護（`Step3CardFields/index.test.tsx`）

```
✓ each <select> has 7 options for non-stamp cardType="cashback_card" ... 等 6 個 non-stamp 卡種
✓ each <select> has 10 options for cardType="stamp_card" (1 placeholder + 6 common + 3 stamp)
✓ each <select> has 10 options for cardType="multipass"
✓ switching cardType from stamp_card to cashback_card hides the stamp-only options 
  but PRESERVES a previously-picked stamp-only leftField value (no silent data loss)
✓ filterCARD_FIELDS_BY_CARD_TYPE helper: 
  returns 6 common fields for null, non-stamp, or unmatched cardType; 
  returns all 9 for stamp_card/multipass
```

5 個新 test case 守住 conditional 行為 + silent-data-loss 防護。

### Vitest 預期

`npm test apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3CardFields/index.test.tsx`

應全綠（前次 ship 的 store / dropdown / dark-mode white-on-white 修正仍過）。

---

## 根因（為什麼初次 ship 時沒加）

`Step3CardFields` 在 2026-09-04 初次 ship 時，**Stamp Grid L2 還沒開始**（Stamp Grid 是當天才開始 review、9/4 結束才 ship）。當時 stamp 系列卡種連 conditional render guard 都還沒決定，更別說欄位綁定。所以 0904 DEV LOG「不在這次範圍」段明確寫：

> ❌ Card-type-dependent field 變化（`pointBalance` for stamp_card 等）— 留後續 plan

本次（0908）補的是「後續 plan」**之一**（stamp 進度類欄位），其他卡種的 conditional field（如 cashback 的 `cashbackRate` 之類）仍待後續。

---

## 修法

### 變更檔案

| 檔案 | 變更摘要 |
|---|---|
| `packages/shared/constants/card-fields.ts` | `CARD_FIELD_KEYS` 加 3 個 key；`CardFieldGroup` 型別 + `CardFieldDefinition.group` 欄位；`CARD_FIELDS` 加 3 個 stamp group 條目 |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3CardFields/filterCARD_FIELDS_BY_CARD_TYPE.ts` | **新檔**，純函式 `filterCARD_FIELDS_BY_CARD_TYPE` + `STAMP_CARD_TYPES` set |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3CardFields/index.tsx` | `<FieldSelect>` 新 prop `availableFields`；主組件 `useMemo(filterCARD_FIELDS_BY_CARD_TYPE(cardType), [cardType])` |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3CardFields/index.test.tsx` | +5 conformance test case |
| `apps/frontend/src/i18n/locales/cardEditor.zh-TW.ts` | +3 keys（availableRewards / totalStamps / stampsRemaining）|
| `apps/frontend/src/i18n/locales/cardEditor.en.ts` | +3 keys |
| `packages/shared/constants/index.ts` | （既有，已 re-export `card-fields`，無變動）|

### 不變的檔案

- `packages/shared/schemas/card.ts` — `cardFieldKeySchema = z.enum([...CARD_FIELD_KEYS])` **自動同步**（zod enum derive）
- `apps/backend/src/modules/cards/schemas/request.ts` — 4-layer sync 自動跟上（已是 re-export 形式）
- `apps/backend/src/modules/cards/db/templates.ts` — `CardFieldKey` type 從 shared 推導，自動同步
- `apps/frontend/src/i18n/locales/passCard.{zh-TW,en}.ts` — `fieldPreview.{key}` 早就有（0904 鋪墊）

---

## 衍生

### 影響的其他檔案

- **無**。所有變更都是 additive（加 key + 加 test case），沒有破壞既有 contract。
- `cardFieldKeySchema` 自動擴大 enum 範圍 → 任何 legacy template 帶 `leftField: 'pointBalance'`（若存在）的 DB row 不會 fail（只會被 zod reject 在新 PUT 路徑，但 GET path 不驗 → 安全）

### 觀察到但**不**處理的

1. **`STAMP_CARD_TYPES` 跟 `<Step3StampGrid />` 的 conditional guard 重複**：目前兩處各寫一份。等第三個 caller 出現（如 Step 4 conditional description）時再 hoist 到 `shared/constants/card-types.ts`。
2. **`fieldPreview.{key}.value` 仍是 hardcoded demo value**（如 `totalStamps: '3/{{rows}}'`）— 真正接 member row 的注入是更晚的事，本次不處理。
3. **非 stamp 卡種的 conditional field**（如 cashback 的 cashback rate、reward card 的 points multiplier）— 仍待後續 plan，本次只補 stamp 系列。

### 相關 feedback（待寫）

若後續發現「`STAMP_CARD_TYPES` 兩處重複導致 drift」或「其他卡種需要 conditional field」可以寫 `runs/improvements/feedback/20260908-step3-conditional-field-pattern.md` 沉澱 conditional field 的 SOP（目前只是一次性的 stamp-only，pattern 還沒到必須沉澱的程度）。

---

## 自問

### 下次怎麼不犯

- 新增 conditional field 時**必查**既有 conditional render guard（Step 3 的 `<Step3StampGrid />`、Step 6 的 `<StampCardLogic />`），確保三者用同一個 `STAMP_CARD_TYPES` 集合（目前 2 處重複，可接受但有 drift 風險）。
- i18n 翻譯檔若對應的 preview / description 文案已存在（如 `passCard.fieldPreview.{key}`），直接沿用既有結構、不另開新 namespace。
- 新 key 加進 `CARD_FIELD_KEYS` 時**必跑** schema conformance test（`packages/shared/schemas/card.test.ts`）確認 4-layer sync 沒漏。

### 哪條 rule 該補 / 強化

- **不需要新 rule** — 既有 `frontend/025-vibe-coding-l2-checklist.mdc` § 1 i18n + § 2 元件結構已涵蓋。
- **`019-schema-contract-drift.mdc` § 4.1 4-layer sync** 已涵蓋（zod enum derive 自動同步是這個 pattern 的標準化）。
- 可考慮把「conditional field by cardType」變成 § A.4 Hook Extraction Strategy 的延伸章節（conditional field 是 conditional render 的同源概念），但目前 scope 還小不必急著寫。

### 哪個 test 該加（production smoke / E2E）

- **production smoke**：`tests/smoke/card-builder-step3.spec.ts` 加一個 case：建立 stamp_card template → 走到 Step 3 → 驗證 dropdown 看到 10 options → 切到 cashback_card → 驗證 dropdown 看到 7 options（不 render stamp-only）。
- 暫時不在這次範圍（手動驗證已過 + vitest conformance test 守住邏輯層），若 release 前時間夠再補。

### Reference 後續延伸

- 等 cashback / reward / membership / discount / coupon / gift 等卡種也有「conditional field」需求時，應該把 `CardFieldGroup` 從 `'common' | 'stamp'` 擴成 `'common' | 'stamp' | 'cashback' | 'reward' | 'membership' | ...`，並在 `STAMP_CARD_TYPES` 旁補對應 set。**本次刻意不做**（YAGNI — 還沒需求就先抽象會做出 dead code）。

---

## 變更檔案清單（本機未 commit）

```
M  apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3CardFields/index.tsx
M  apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3CardFields/index.test.tsx
M  apps/frontend/src/i18n/locales/cardEditor.en.ts
M  apps/frontend/src/i18n/locales/cardEditor.zh-TW.ts
M  packages/shared/constants/card-fields.ts
?? apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3CardFields/filterCARD_FIELDS_BY_CARD_TYPE.ts
```

`packages/shared/constants/index.ts` 已是既有 barrel export，本次不變動（驗證 git status 顯示 `M packages/shared/constants/index.ts` 屬 0904 殘留）。

---

> 撰寫者：Josh ｜ 時間：2026-09-08 07:04（UTC+8）
> commit hash 待 push 後回填
