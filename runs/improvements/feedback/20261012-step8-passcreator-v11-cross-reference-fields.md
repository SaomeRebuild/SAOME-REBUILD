# 2026-10-12 Step 8 v11 fix — `headerFields` / `secondaryFields` 用 `{Name}` cross-reference 推上去（對應使用者實測 SQL 兩條樣板）

> **對應 commits**: 本次 fix 還未 commit（待 user 驗證後 commit — 跟 v6/v7/id-parse/v8/v9/v10 一起 batched 還是分開待 user 決定）
> **根因**: `mapTemplateToPasscreator` 把 `headerFields[0].value` / `primaryFields[0].value` / `secondaryFields[0].value` 都推成空字串 `''`，Passcreator admin UI 看起來這 3 個 slot 全部「空白」（labels 跟 keys 都有但 value 沒東西）。User 2026-10-12 把 SQL 拉出來：「卡片模板有 leftField / rightField 的選定，但 headerFields 跟 SecondaryField 還是空的」，並要求這兩個的值用 `{xxx}` 的 Additional properties — 也就是 Passcreator 的 cross-reference placeholder 語法。
>
> **日期**: 2026-10-12
> **類型**: bug fix（L2 Standard — Step 8 push 鏈的後續，same family as v6/v7/id-parse/v8/v9/v10）
> **對齊**:
>   - `runs/improvements/feedback/20261011-step8-passcreator-push.md` (v6 fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-create-id-parse.md` (id parse fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-strip-additional-props.md` (v7 fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-update-method-post.md` (v8 fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-v9-structure-alignment.md` (v9 fix — `links` top-level / `logoText` top-level / `auxiliaryFields` / conditional `locations`)
>   - `runs/improvements/feedback/20261012-step8-passcreator-v10-link-scheme-normalization.md` (v10 fix — `links[]` URL scheme 自動正規化)

---

## 1. 症狀

User 2026-10-12 把 SQL templates 兩條 dump 出來：

```sql
-- Template 1: discount_card, zh-TW
"leftField": "pointsToNextTierDiscount", "rightField": "discountTierBracket"

-- Template 2: discount_card, en
"leftField": "visitCount", "rightField": "accumulatedSpendDiscount"
```

User 原文：「我很確定 headerFields 沒有被推上去，Passcreator 那邊是空的；SecondaryField 也是空的，左右欄位的標籤沒有被推上去；而且這兩個地方的值現在因該是 `{xxx}` 的 Additional propertie；所以現在沒有針對租戶的選擇推送，沒有因為什麼卡推什麼 headerFields 跟 SecondaryField」。

User 對應的 Passcreator 部署狀況：

| Slot | Apple Wallet Pass 位置 | 推上去的 value | Passcreator admin 視覺 |
|---|---|---|---|
| `headerFields[0]` | 卡頂端小字（有效期限 / 到期日）| `''` (空) | 看起來空白 |
| `primaryFields[0]` (left) | 卡正面左欄 (visitCount / pointsToNextTierDiscount) | `''` (空) | label 還在但 value 是 0 |
| `secondaryFields[0]` (right) | 卡正面右欄 (accumulatedSpendDiscount / discountTierBracket) | `''` (空) | label 還在但 value 是 0 |
| `auxiliaryFields` | 卡正面下排 | `[]` (v9 修過) | OK |
| `backFields` | 卡背面 | user 內容 | OK (v7/v9 修過) |

User 期望：
- headerFields / primaryFields / secondaryFields 的 value 用 `{KeyName}` cross-reference 推出去（讓 Passcreator designer 看到 placeholder 跟 variable 對應）
- 對應的 KeyName 進 `additionalProperties[]`（讓 Passcreator designer 可以 cross-reference）

### 為什麼 v9 / v10 沒抓到

v9 修了 (a) `links` 位置、(b) `logoText` 獨立 push、(c) `auxiliaryFields: []` 對齊、(d) `locations` 條件推送 — 都沒動 `value: ''` 的部分。v10 修了 `links[].value` 的 URL scheme 自動 prefix — 也沒影響 slots 的 `value`。

「`value: ''`」 這個 pattern 是 v6 第一次 push fix 時訂下的「不要在 template-level 帶假資料」保守策略，per-pass runtime 從 member row inject 真實 value。但 user 端沒看到 per-pass runtime 注入時的 UI（admin UI 看 template 自身），結果是 admin 永遠看起來空白。

---

## 2. 根因

### 2.1 兩個對 canonical V2 describe response 的 gap，第 11 次回頭才抓齊

v7/v8/v9/v10 每次只對局部維度做端到端 grep：
- v7: `images.strip` key 的 silent drop
- v8: PUT vs POST method
- v9: `links` 位置 / `logoText` top-level / `auxiliaryFields` / conditional `locations`
- v10: `links[].value` URL scheme 前綴

但都漏了 `value` 欄位本身的語意：**Passcreator V2 的 template-level value 用 `{Name}` placeholder 指向 `additionalProperties[]`**，這是 design-time 的變數交叉引用機制。我們一直推 `''` 等於讓 template 在 design tool 內完全無法 expression resolve。

### 2.2 「template 不帶資料等 runtime 灌」是危險保守策略

v4/v5/v6 fix 把 `value: ''` 當作「不要寫死資料到 template」的安全預設 — 但這預設只對 runtime injection 場景成立。Passcreator template designer 期望看到 `{Name}` placeholder 才有 expression resolve 的 UI affordance，沒有 placeholder 等於「這個 slot 是空的，designer 也沒辦法 bind 任何 variable」。

### 2.3 `additionalProperties[]` 從來沒跟 slot 一致

v7 fix 開了 `additionalProperties[]`，只從 `backFields[]` 跟 `links[]` 產 entries。但 `headerFields` / `primaryFields` / `secondaryFields` 的 key 從來沒出現在 `additionalProperties[]` 裡 — 即使現在開始推 `{KeyName}` 也會變 dangling placeholder（Passcreator designer 看到 `{visitCount}` 但沒地方 bind 對應的 variable）。

### 2.4 v5 user directive「headerField 不要讀 leftField」正確但只解了 label 來源

v5 修了 `headerField` 來源（per-cardType fixed，不再讀 leftField），但 value 部分仍然是空。User 原本的「因為什麼卡推什麼 headerFields」其實不是要改 source（v5 已經做對），是要把 `value` 改成 `{xxx}` 讓 Passcreator designer 看到對應 variable。

---

## 3. 修法

### 3.1 修法的 3 個獨立改動

| 改動 | 來源 | 為什麼 |
|---|---|---|
| (a) `value` 從 `''` 改 `'{<key>}'` | `headerFields[0]` / `primaryFields[0]` / `secondaryFields[0]` 各一個改動 | 讓 Passcreator designer 看到 placeholder，啟用 expression resolve UI |
| (b) `additionalProperties[]` 補 slot entries | `buildAdditionalProperties` 加 `slotKeys` 參數 | placeholder 跟 variable 一致，避免 dangling reference |
| (c) `mapFieldType` 補缺失的 numeric CardFieldKey | visitCount / accumulatedSpendDiscount / pointsToNextTierCashback / pointsToNextTierDiscount / 等等 | 語意上明顯是 number，先前 mapFieldType 只涵蓋 balance / giftPoints / passValidDays / memberLevel 4 個 — 其餘因為 v6 還沒人 push 過所以沒被發現 |

### 3.2 修改 1 — value 改 `{Name}` cross-reference

`mapTemplateToPasscreator` 內 3 個 slot：

```ts
const headerFields = headerEntry
  ? [{
      key: headerEntry.key,
      type: mapFieldType(headerEntry.key),
      label: headerEntry.label,
      // v11: value uses `{KeyName}` cross-reference (was '').
      value: `{${headerEntry.key}}`,
    }]
  : [];
const primaryFields = s.leftField
  ? [{
      key: s.leftField,
      type: mapFieldType(s.leftField),
      label: getFieldLabel(s.leftField, language, template.card_type) ?? '',
      value: `{${s.leftField}}`,  // v11
    }]
  : [];
const secondaryFields = s.rightField
  ? [{
      key: s.rightField,
      type: mapFieldType(s.rightField),
      label: getFieldLabel(s.rightField, language, template.card_type) ?? '',
      value: `{${s.rightField}}`,  // v11
    }]
  : [];
```

### 3.3 修改 2 — `buildAdditionalProperties` 加 `slotKeys` 參數

```ts
export function buildAdditionalProperties(args: {
  backFields: TemplatesRow['settings']['backFields'];
  links: TemplatesRow['settings']['links'];
  /** v11 — slot keys that the corresponding `fields[]` row references via `{Name}` cross-reference. */
  slotKeys?: { header?: string | null; left?: string | null; right?: string | null };
}): PasscreatorAdditionalProperty[] {
  const out: PasscreatorAdditionalProperty[] = [];

  // v11 — slot entries first (most visible to tenant), then backFields, then links.
  // Each populated slot emits ONE additional property whose name is the slot's `key`.
  // `type` from mapFieldType (date-typed keys → 'text' fallback because Passcreator
  // additionalProperties.type enum doesn't include 'date').
  for (const k of [args.slotKeys?.header, args.slotKeys?.left, args.slotKeys?.right]) {
    if (!k) continue;
    const fieldType = mapFieldType(k);
    const propertyType: PasscreatorAdditionalProperty['type'] =
      fieldType === 'number' ? 'number' : 'text';
    out.push({ name: k, placeholder: `{${k}}`, type: propertyType, required: false, hidden: false });
  }

  // existing backFields + links logic preserved
  ...
}
```

呼叫端從
```ts
additionalProperties: buildAdditionalProperties({
  backFields: s.backFields ?? [],
  links: s.links ?? [],
}),
```
改成
```ts
additionalProperties: buildAdditionalProperties({
  backFields: s.backFields ?? [],
  links: s.links ?? [],
  slotKeys: {
    header: headerEntry?.key,
    left: s.leftField ?? null,
    right: s.rightField ?? null,
  },
}),
```

### 3.4 修改 3 — `mapFieldType` 補 numeric CardFieldKeys

`packages/shared/constants/card-fields.ts` 列的 17 個 keys，先前 `mapFieldType` 只認 4 個 number（balance / giftPoints / passValidDays / memberLevel），其他全部 fall-through 到 'text'。User data 用的 keys：

| Key | 語意 | 先前 type | v11 type |
|---|---|---|---|
| `visitCount` | count | text | **number** |
| `accumulatedSpendDiscount` | spend amount | text | **number** |
| `pointsToNextTierDiscount` | spend amount | text | **number** |
| `discountTierBracket` | percent | text | **number** |
| `couponRemainingCount` | count | text | **number** |
| `couponDiscount` | amount/percent | text | **number** |
| `multipassCompleted` | count | text | **number** |
| `multipassPointsToNextTier` | count | text | **number** |
| ... 其他 9 個 count / amount keys | ... | text | **number** |

完整 switch case 補齊（14 個新加入 'number' 分支）：
```ts
case 'visitCount':
case 'availableRewards':
case 'totalStamps':
case 'stampsRemaining':
case 'pointsToNextTier':
case 'currentPoints':
case 'pointsToNextTierCashback':
case 'accumulatedSpendCashback':
case 'pointsToNextTierDiscount':
case 'accumulatedSpendDiscount':
case 'discountTierBracket':
case 'couponRemainingCount':
case 'couponDiscount':
case 'multipassCompleted':
case 'multipassPointsToNextTier':
  return 'number';
```

**為什麼補齊是必要的**：user 端 push 真實產出時，`fields.primaryFields[0].type` 直接被 Passcreator 用於 input validation + Apple Wallet 渲染格式。`type: 'text'` 讓 visitCount 在 pass 上變成純文字沒格式化、`type: 'number'` 會 trigger numeric rendering（commas / decimal places）。

### 3.5 `additionalProperties[].type` date-key 退到 'text'

Passcreator `additionalProperties[].type` enum：`'text' | 'textarea' | 'url' | 'number' | 'select' | 'checkbox' | 'radiobutton'` — **沒有 `date`**。

Date 語意的 slot（`memberExpiry` / `discountExpiry` / `couponExpiry`）在 `additionalProperties[]` 內 emit 時 type 退到 `'text'`，但 `fields.headerFields[0].type` 仍記得 `'date'`（兩條 type 欄位語意不同 — `fields[].type` 是 input validation，`additionalProperties[].type` 是 designer UI widget）。

### 3.6 為什麼不直接 emit `{dynamic}`

考慮過動態 fallback（`{visitCount ?? balance}`）讓 Passcreator designer auto-pick — 但 user 沒指示，且每個 slot 已經有一個特定 key（v5 user directive「不是 step3 設定的」是講 headerField 不讀 leftField，不是講要 auto-pick value）。保守策略：每個 slot emit 一個精準對應的 `{KeyName}`，讓 designer 手動 cross-reference 任何他們要的 variable。

---

## 4. 驗證

```
npm run typecheck --workspace=apps/backend
→ exit 0

npm test --workspace=apps/backend -- --run
→ 664/664 passed (35 test files)
→ +10 new tests for v11 + 14 existing tests updated
```

### 4.1 新增的 10 條 v11 conformance test

`passTemplateMapping.test.ts > mapTemplateToPasscreator — {Name} cross-reference values (v11 — 2026-10-12)` describe block：

| Test | 覆蓋 |
|---|---|
| `headerFields[0].value is the {<headerEntry.key>} cross-reference (discount_card → {discountExpiry})` | header slot emit `{<key>}` placeholder + 對應 `discountExpiry` key 在 user 的 discount_card scenario |
| `headerFields[0].value is the {<headerEntry.key>} cross-reference (reward_card → {balance})` | balance headerField 的 placeholder |
| `primaryFields[0].value is the {<leftField>} cross-reference (visitCount)` | user data 真實 scenario，visitCount 走 number type |
| `secondaryFields[0].value is the {<rightField>} cross-reference (accumulatedSpendDiscount)` | user data 真實 scenario，accumulatedSpendDiscount 走 number type |
| `additionalProperties includes one entry per populated slot (header + primary + secondary)` | 3 個 slot 各 emit 1 entry 到 additionalProperties，shape 完全對齊（name / placeholder / type / required / hidden 5 個欄位）|
| `headerFields is empty (no headerEntry) → no header entry in additionalProperties` | card_type=null 邊界：不出現 headerEntry 但 leftField / rightField 仍 emit |
| `primaryFields empty when leftField is unset → no leftField entry in additionalProperties` | leftField undefined → 沒 primaryField slot 也沒 additionalProperty entry |
| `secondaryFields empty when rightField is unset → no rightField entry in additionalProperties` | 同上 for rightField |
| `date-typed headerEntry keys map to {Name} in additionalProperties but type is "text" (date not in enum)` | memberExpiry / discountExpiry / couponExpiry 在 additionalProperties 用 'text' 不是 'date'；但 fields.headerFields[0].type 仍是 'date' |
| `values are empty string when slot is empty (defensive — no spurious {undefined} placeholder)` | 全部 slot 都空時，不會 emit `{undefined}` 之類的 garbage |

### 4.2 既有 test 的更新（14 條）

| Describe 區塊 | 修改 |
|---|---|
| `mapTemplateToPasscreator — fields (header / primary / secondary / back)` | 6 條 `toEqual(...)` 把 `value: ''` 改 `value: '{<key>}'`（key 從對應 slot）|
| `mapTemplateToPasscreator — cardType-aware memberLevel override` | 1 條 stamp_card tests 把 `value: ''` 改 `value: '{<key>}'` |
| `mapTemplateToPasscreator — additionalProperties (v7)` | 6 條 strict `toEqual([...])` 在陣列頭加 slot entries（共 3 條 `balance` / `phone` / `email` for default makeRow）；引入 `slotPrefixForMakeRow` local const 集中管理 |
| `mapTemplateToPassactor — additionalProperties (v7)` line 906 | `toHaveLength(1)` 改 `toHaveLength(4)` — 1 個 backFields slug + 3 個 slot entries |

### 4.3 Test totals

- passTemplateMapping 130 → 140（+10 條 v11）
- backend 35 檔 654 → 664 全綠
- typecheck exit 0

---

## 5. Production impact

### 5.1 Idempotent update

跟 v9 / v10 一樣：Passcreator V2 update endpoint 對每個 field optional。對既有 template 重 push：
- **好處**：headerFields / primaryFields / secondaryFields 的 value 變成 `{KeyName}` placeholder，designer 看得到對應 variable
- **沒風險**：不洗掉既有 images / colors / barcode / additionalProperties / backFields / links

### 5.2 UX 改善

User 看到 Passcreator admin：
- headerField / primaryField / secondaryField 從「看起來空白」變成「顯示 placeholder 文字」 — designer 知道這 slot 是活的、要 bind variable
- `additionalProperties[]` 多 3 個 entries（slot 對應），designer 可以 cross-reference `{balance}` `{visitCount}` `{accumulatedSpendDiscount}` 等到任何 field

### 5.3 Runtime injection 路徑不變

Per-pass runtime inject 流程（v6 已存在的 plan）不變：template-level `{KeyName}` 是 design-time 用的；issuance-time 把 user-specific value 灌到 `{KeyName}` 該 bind 的 variable 上。對 user-facing pass 行為零影響。

---

## 6. 累積教訓（串到 v6/v7/v8/v9/v10/v11 整串 Step 8 fix）

### 教訓 1 — 永遠對 canonical V2 describe response 做端到端 grep（再次重申，v11 同 pattern）

v11 還是同一條：對 V2 describe response / example payload 做完整的 schema 對齊。v7 `images.strip` silent drop / v9 `links` 位置 / v10 `links` value scheme / **v11 `value` 欄位語意** — 4 個都是「canonical schema 對齊」的子問題，每次只看局部就漏一個維度。

完整對齊需要查的維度（v11 擴充）：
- field 是否存在 ✓ (v7)
- field 在哪個 layer（top-level vs nested）✓ (v9)
- field 的 value 格式（scheme 前綴 / 顏色 regex / 圖片 URL pattern）✓ (v10)
- **field 的 value 自身用什麼語意** ✓ (v11 — `{Name}` cross-reference，不是 raw value)

### 教訓 2 — 「不要寫死資料」是危險保守策略

v6/v5/v4 把 `value: ''` 當作「等 runtime inject 真實資料」的安全預設 — 但這預設只對 runtime injection 場景成立。Passcreator template 的「`value`」欄位語意不是「此 template 給每張 pass 的真實 value」而是「designer 表達 expression 的 placeholder」。

教訓：對 third-party 的 descriptive 欄位（`value`、`label`、`text`）要分清「runtime instance data」vs「design-time template」 — 兩種 place 寫不同東西，**不能都用同個 `''`** 當 safe default。

### 教訓 3 — 跨層 placeholder 必須跟 cross-reference store 同步

v7 fix 開了 `additionalProperties[]` 當 cross-reference variable store。但只有 `backFields[]` 跟 `links[]` 的 keys 進去，其他 slot 的 keys 沒有進 — 這是 type-level 的 risk：未來任何加到 `fields[].value` 的 `{Name}` placeholder 都必須在 `additionalProperties[]` 找得到 binding，否則 designer 看到 unresolved variable。

教訓：`fields[].value` 跟 `additionalProperties[]` 必須一起演進（one consumer push 進 store，另一 consumer pull 進 value slot）。沒有「先推 value 後補 store」的兩階段 commit — 必須同 commit。

### 教訓 4 — numeric CardFieldKey 在共享 mapping 沒被全列

v6 fix 寫 `mapFieldType` switch case 時只列了當時 Step 3 dropdown 已實作的 4 個 numeric keys（balance / giftPoints / passValidDays / memberLevel）。後續 Step 3 加了 visitCount / accumulatedSpendDiscount 等 14 個 numeric keys，但 `mapFieldType` 沒同步 — 因為 shared schema（CardFieldKey enum）跟 mapping logic 是兩個獨立 surface。

教訓：shared enum 的 membership 變更跟 consumer logic 的 case 必須 machine-checked 自動對齊（例如 `mapFieldType` 改成 data-driven：讀 `CARD_FIELD_META[key].type` 而非 hard-code switch）。**未來 v12 PR**：把 `mapFieldType` 改成 data-driven，從 `CARD_FIELDS` array 結構讀 type，不再有 hard-code switch-case 漏列的問題。

### 教訓 5 — user 看的症狀 vs code 看的結果可能差好幾層

User 用肉眼在 Passcreator admin 看到「slot 是空的」 — 直覺會想到「headerFields 沒推 → fix headerFields 邏輯」。但 code 端檢查實際有推（with `key/label/type` 都對），只是 `value` 是空字串讓 designer UI 沒 affordance。

教訓：user-facing 症狀的「症狀層」（admin 看到空白）跟 root cause 的「邏輯層」（value 是 ''）之間常常差好幾層 abstraction。Debug 時不能只 follow user 描述的「這地方沒推」要往下挖到「為什麼 designer 看到空白」。

---

## 7. 待辦（未在 v11 範圍）

- **v12 plan**: 把 `mapFieldType` 從 hard-code switch 改成 data-driven（讀 `CARD_FIELDS[i].semanticType`）。新 cardType / 新 CardFieldKey 不再會有「type 欄位沒同步」的 drift。詳見教訓 4。
- **跨層 invariant 文件化**：rule 019 / rule 032 / 這條 feedback 三處都引用「`fields[].value` 跟 `additionalProperties[]` 同 commit 演進」— 未來寫成 rule（必查 `buildAdditionalProperties` 是否仍處理所有 slot keys）。
- **Date type `additionalProperties[].type` 問題**：Passcreator enum 沒有 'date'，目前用 'text' fallback。如果未來 Passcreator 加 'date' enum，要立刻 sync（rule 034 § 6 對齊 DB CHECK 概念）。
- **production smoke test**：push 一個有 leftField / rightField 的真實 template 看 Passcreator admin 是不是顯示 placeholder + variable binding 都對。

---

## 8. Commits（待 user 決定）

v11 fix 是 uncommitted，跟 v6 / id-parse / v7 / v8 / v9 / v10 六項 batched 還是一個個分開待 user 決定。Commit footer 應含：

- `Refs: runs/improvements/feedback/20261012-step8-passcreator-v11-cross-reference-fields.md`
- `Sync: https://github.com/SaomeRebuild/SAOME-REBUILD commit <hash>`

---

## 9. Cross-references

- **v6 fix** (`feedback/20261011-step8-passcreator-push.md`) — colors regex `#` prefix + per-cardType label 源頭
- **v7 fix** (`feedback/20261012-step8-passcreator-strip-additional-props.md`) — `images.background` slot + `additionalProperties[]` 開張
- **v8 fix** (`feedback/20261012-step8-passcreator-update-method-post.md`) — POST verb (V2)
- **v9 fix** (`feedback/20261012-step8-passcreator-v9-structure-alignment.md`) — `links` top-level + `logoText` top-level + `auxiliaryFields` + conditional `locations`
- **v10 fix** (`feedback/20261012-step8-passcreator-v10-link-scheme-normalization.md`) — `links[].value` URL scheme 自動 prefix
- **Passcreator V2 docs**:
  - `mu-plugins/Passcreator/V2 end point/Pass template/pass-template-management.md`
  - `mu-plugins/Passcreator/V2 end point/Pass template/describe-the-structure-of-a-pass-template.md` — additionalProperties schema
- **Rule references**:
  - Rule 019 § 4.1 — 四層 schema sync (對齊到 `mapFieldType` 的 update)
  - Rule 032 — JSONB merge silent killer spirit（v11 是同 spirit：placeholder 是否在 store 內也是類似的 silent killer）
  - Rule 017 — Production Bundle Guard（deploy 跑 grep）
  - Rule 036 — Worker Runtime CORS Defense（cross-realm invariant）
- **Code**:
  - `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` — `value: \`{${key}}\`` × 3 + `buildAdditionalProperties` 加 `slotKeys` + `mapFieldType` 加 14 個 numeric case
  - `apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts` — 10 新 describe 區塊 + 14 既有測試改寫

---

## 10. Test 摘要表

### 10.1 v11 新增的 10 條 regression test

| Test | Symptom pinned |
|---|---|
| `headerFields[0].value is the {<headerEntry.key>} cross-reference (discount_card → {discountExpiry})` | discount_card scenario: headerField emit {discountExpiry} placeholder |
| `headerFields[0].value is the {<headerEntry.key>} cross-reference (reward_card → {balance})` | reward_card scenario: headerField emit {balance} placeholder |
| `primaryFields[0].value is the {<leftField>} cross-reference (visitCount)` | user SQL data 1 對應 scenario: primaryField visitCount 走 number type |
| `secondaryFields[0].value is the {<rightField>} cross-reference (accumulatedSpendDiscount)` | user SQL data 2 對應 scenario: secondaryField accumulatedSpendDiscount 走 number type |
| `additionalProperties includes one entry per populated slot (header + primary + secondary)` | 3 個 slot 各 1 entry 到 store；shape 完整 |
| `headerFields is empty (no headerEntry) → no header entry in additionalProperties` | card_type=null 邊界 |
| `primaryFields empty when leftField is unset → no leftField entry in additionalProperties` | leftField undefined 邊界 |
| `secondaryFields empty when rightField is unset → no rightField entry in additionalProperties` | rightField undefined 邊界 |
| `date-typed headerEntry keys map to {Name} in additionalProperties but type is "text" (date not in enum)` | enum 缺 'date' 的 fallback 守門 |
| `values are empty string when slot is empty (defensive — no spurious {undefined} placeholder)` | empty slot 不會 emit garbage placeholder |

### 10.2 既有 test 的 14 條更新

| Describe 區塊 | Test 數 | 變更 |
|---|---|---|
| `mapTemplateToPasscreator — fields (header / primary / secondary / back)` | 6 | `value: ''` → `value: '{<key>}'` |
| `mapTemplateToPassactor — cardType-aware memberLevel override` | 1 | stamp_card tests `value: ''` → `value: '{memberLevel}'` |
| `mapTemplateToPassactor — additionalProperties (v7)` | 6 | strict-match 加 slot entries（balance / phone / email for default makeRow）；引入 `slotPrefixForMakeRow` local const |
| `mapTemplateToPassactor — additionalProperties (v7)` empty-slot test | 1 | `toHaveLength(1)` → `toHaveLength(4)`（3 slots + 1 slug）|

### 10.3 既有 test 不變

| Describe 區塊 | 狀態 |
|---|---|
| `mapTemplateToPasscreator — name` | 不變（`name` 沒改）|
| `mapTemplateToPasscreator — logoText (v9)` | 不變（`logoText` 沒改）|
| `mapTemplateToPasscreator — colors` | 不變 |
| `mapTemplateToPassactor — barcode` | 不變 |
| `mapTemplateToPassactor — images` | 不變 |
| `mapTemplateToPassactor — auxiliaryFields (v9)` | 不變 |
| `mapTemplateToPassactor — locations (v9, conditional on DB toggle)` | 不變 |
| `mapTemplateToPassactor — passTypeId` | 不變 |
| `mapTemplateToPassactor — type` | 不變 |
| `mapTemplateToPassactor — language propagation` | 不變（label 部分不變，value 部分已包含在 6 條 fields tests 內）|
| `mapTemplateToPassactor — field type mapping (regression — 2026-10-11)` | 既有 9 條仍綠（balance/giftPoints/memberExpiry/discountExpiry/couponExpiry 都是既有 case）+ 新行為隱含在 mapFieldType 擴充 case — 但**沒新增**「visitCount / accumulatedSpendDiscount → number」strict-match test（這些 case 由 10.1 v11 第一條 'secondaryFields visitCount' 跟 'accumulatedSpendDiscount' 隱含覆蓋）|
| `mapTemplateToPassactor — top-level links (v9)` | 不變 |
| `mapTemplateToPassactor — link URL normalization (v10)` | 不變 |
| `normalizeLinkUrl` | 不變 |
| `shared/lib/passcreator.test.ts` | 不變（`mapFieldType` 是 pass-template-mapping 的 internal function，沒 export）|
| `updateTemplate.passcreator.test.ts` | 不變 |
