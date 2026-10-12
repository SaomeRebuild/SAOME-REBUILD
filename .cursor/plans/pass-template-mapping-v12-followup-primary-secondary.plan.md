# Plan：Passcreator V2 mapping v12 follow-up — primaryFields / secondaryFields slot + 拿掉 additionalProperties 對 backFields 的污染

> **任務等級**：L2 Standard（修既有 mapping 邏輯 + 補測試；不跨模組、不寫入 wire-format 不相容的變更）
> **建立日期**：2026-10-12
> **對應**：`.cursor/rules/006-verification.mdc`（完工驗證）、`.cursor/rules/011-dev.mdc`（commit 規範）、`.cursor/rules/019-schema-contract-drift.mdc`（契約對齊）、`.cursor/rules/023-shared-package.mdc`（shared 邏輯邊界）
> **前置**：`runs/improvements/feedback/20261012-step8-passcreator-v12-data-driven-mapfieldtype.md`（v12 已修完 build-time drift guard，但 runtime 行為需要 3 條 follow-up）
> **不要編輯**：`.cursor/plans/pass-template-mapping-strip-additional-props.plan.md`（那是更早 v7 範圍，user 確認 partial — 但 backFields → additionalProperties 部分要 revert，見 §5 bug 3）

## 1. 背景 — v12 跑出 3 條 user-visible bug

2026-10-12 v12 完成 `mapFieldType` 從 19-case switch 改成 data-driven lookup（基於 `CARD_FIELDS[i].semanticType`）。Build/typecheck/test 全綠，但 2026-10-12 user 跑實際 Step 8 push 後回報 3 條 wire-format bug：

1. 左右欄位的左欄位跑去 `Primary fields` — 應該兩者都是 Secondary，左 / 右各一個
2. `primaryFields` 應該只有「會員卡的會員姓名」
3. `backFields` 的值不該塞進 `additionalProperties`（v7 fix 的後半被 user 推翻）

### 1.1 為什麼 v12 才被發現 — 不是 v9-v11 留下來

回溯：`mapFieldType` v12 fix 是純 refactor（行為上 `birthday` `'text'` → `'date'` 是唯一 deliberate change，但 template-level `fields[].type` 推到 Passcreator 後才會 render 差異，runtime preview 還沒用到）。**真正新暴露的 bug 是 #1 + #2** — 因為 v9-v12 期間 mapping module 一直把 Step 3 dropdown 的 `settings.leftField` / `settings.rightField` 推到 `primaryFields[0]` / `secondaryFields[0]`，user v12 跑完一遍實際 pass 才發現對 Apple Wallet 來說「primary slot = 會員姓名」是鎖定的 field placement 慣例（不是「user 兩欄中的第一欄」）。

### 1.2 v7 留下的 bug #3

`pass-template-mapping-strip-additional-props.plan.md` v7 fix 為 `additionalProperties[]` 加了 backFields entries，目的是讓 `{聯絡電話}` 等 backField label 可以當作 `{Name}` cross-reference。User 2026-10-12 反饋：「backFields 的值就填在 backFields 裡面就好」 — 不需要 mirror 到 `additionalProperties`。本 plan **revert v7 § additionalProperties 回歸到 v7 之前**（即 slot key + links 兩種 source；不包含 backFields source）。

## 2. Fix scope — 3 file edit + 1 plan + 1 feedback + 1 INDEX

| 動作 | 影響檔案 | 範圍 |
|---|---|---|
| A. primaryFields 改為「membership_card ⇒ memberName」，其餘 cardType ⇒ [] | passTemplateMapping.ts line 480-492 | 1 file, ~20 lines |
| B. secondaryFields 改為 [leftField, rightField]，filter undefined | passTemplateMapping.ts line 495-510 | 1 file, ~15 lines |
| C. buildAdditionalProperties 移除 backFields 迭代（保留 slot + links） | passTemplateMapping.ts line 730-745 | 1 file, ~15 lines |
| D. JSDoc 跟 ARCHITECTURE comment 統一更新 | 同上檔 | included in A/B/C |
| E. 更新既有 test（多條 primary/secondary 期望） + 新增 conformance tests | passTemplateMapping.test.ts | 1 file, ~25 tests 改寫 + ~6 tests 新增 |
| F. 寫 feedback doc + INDEX row | feedback/20261012-step8-passcreator-v12-followup-primary-secondary.md + INDEX.md | 1 file + 1 row |

**總計 4 file edit；無新增檔；無 migration；無 shared schema 變更**（CARD_FIELDS 21 entry 的 semanticType 都還對得上，僅 mapping module 行為變更）。

## 3. Fix 1 — primaryFields = membership_card ? memberName : []

### 3.1 現況

```ts
// passTemplateMapping.ts line 480-492
const primaryFields = s.leftField
  ? [{
      key: s.leftField,
      type: mapFieldType(s.leftField),
      label: getFieldLabel(s.leftField, language, template.card_type) ?? '',
      value: `{${s.leftField}}`,
    }]
  : [];
```

### 3.2 修法

```ts
/**
 * 2026-10-12 v12-followup: primaryFields is RESERVED for the
 * Apple Wallet "most important field" slot. Per Apple Wallet convention
 * + user 2026-10-12 directive:
 *   - cardType === 'membership_card' => [{ key: 'memberName', ... }]
 *   - 其它 cardType => []
 *
 * settings.leftField / settings.rightField (Step 3 dropdown) are BOTH
 * consumed by secondaryFields (see below). Previously v6-v12 populated
 * primaryFields[0] from settings.leftField — bug fixed in this commit.
 */
const primaryFields: { key: string; label: string; value: string; type: PasscreatorFieldType }[] = [];
if (template.card_type === 'membership_card') {
  primaryFields.push({
    key: 'memberName',
    type: mapFieldType('memberName'),
    label: getFieldLabel('memberName', language, 'membership_card') ?? '',
    value: '{memberName}',
  });
}
```

### 3.3 影響

- 現有 13+ test 期望 primaryFields[0] = settings.leftField → **改寫成 primaryFields = [] 除非 cardType 是 membership_card**
- slotPrefixForMakeRow 內的 phone slot entry 依然要被建（slot entry 是 additionalProperties 的事，跟 fields.primaryFields / secondaryFields 是兩件事）

## 4. Fix 2 — secondaryFields = [leftField, rightField] 順序與 filter

### 4.1 現況

```ts
// passTemplateMapping.ts line 495-510
const secondaryFields = s.rightField
  ? [{
      key: s.rightField,
      type: mapFieldType(s.rightField),
      label: getFieldLabel(s.rightField, language, template.card_type) ?? '',
      value: `{${s.rightField}}`,
    }]
  : [];
```

### 4.2 修法

```ts
/**
 * 2026-10-12 v12-followup: secondaryFields 是 Step 3 左右欄位的家。
 *
 * Apple Wallet secondaryFields[] is an array; both settings.leftField
 * (Step 3 「左欄」) and settings.rightField (Step 3 「右欄」) are dropped
 * here. Order = leftField 在前、rightField 在後（user 報
 * 「左欄位是第 1 個，右欄位是第 2 個」）。
 *
 * 沒設定的欄位被 filter（不輸出 placeholder），當兩欄都未設時
 * secondaryFields = []。
 */
const secondaryFields: { key: string; label: string; value: string; type: PasscreatorFieldType }[] = [];
for (const slotKey of [s.leftField, s.rightField]) {
  if (!slotKey) continue;
  secondaryFields.push({
    key: slotKey,
    type: mapFieldType(slotKey),
    label: getFieldLabel(slotKey, language, template.card_type) ?? '',
    value: `{${slotKey}}`,
  });
}
```

### 4.3 影響

- 多條既有 test 期望 secondaryFields[0] = rightField → 改為期望 secondaryFields[0] 或 secondaryFields[1]
- 多條既有 test 期望 secondaryFields.length === 1 → 改為期望 length === 2（兩者都設）

## 5. Fix 3 — buildAdditionalProperties 移除 backFields 迭代

### 5.1 現況

```ts
// passTemplateMapping.ts line 730-745
// 1. backFields — type: 'text'. Label is user-typed name;
//    when empty, derive a slug from first 30 chars of value.
for (const row of args.backFields ?? []) {
  const name = derivePropertyName(row.label, row.value);
  if (name === null) continue;
  out.push({ name, placeholder: `{${name}}`, type: 'text', required: false, hidden: false });
}
```

### 5.2 修法

刪除上面整個 for block。保留：
- // 0. slot keys (headerFields / primaryFields / secondaryFields)
- // 2. links (type: 'url'，跟 top-level links[] 一致的 normalization)

```ts
export function buildAdditionalProperties(args: {
  backFields: TemplatesRow['settings']['backFields']; // kept param for backward compat; body unused now
  links: TemplatesRow['settings']['links'];
  slotKeys?: { header?: string | null; left?: string | null; right?: string | null };
}): PasscreatorAdditionalProperty[] {
  const out: PasscreatorAdditionalProperty[] = [];

  // 0. slot keys — 每個 populated slot 發一個 entry，所以 {KeyName} placeholder 可 resolve
  for (const k of [args.slotKeys?.header, args.slotKeys?.left, args.slotKeys?.right]) {
    if (!k) continue;
    const fieldType = mapFieldType(k);
    const propertyType: PasscreatorAdditionalProperty['type'] = fieldType === 'number' ? 'number' : 'text';
    out.push({ name: k, placeholder: `{${k}}`, type: propertyType, required: false, hidden: false });
  }

  // 1. (REMOVED 2026-10-12 v12-followup) backFields mirror.

  // 2. links — type: 'url'. 同一 normalizeLinkUrl 過濾、4-link cap.
  const links = (args.links ?? []).filter((row) => normalizeLinkUrl(row.value) !== null);
  if (links.length > MAX_PASS_LINKS) {
    console.warn(`[passTemplateMapping] links count ${links.length} exceeds the ${MAX_PASS_LINKS}-link cap; overflow will be dropped from additionalProperties + top-level links.`);
  }
  for (const row of links.slice(0, MAX_PASS_LINKS)) {
    const name = derivePropertyName(row.label, row.value);
    if (name === null) continue;
    out.push({ name, placeholder: `{${name}}`, type: 'url', required: false, hidden: false });
  }

  return out;
}
```

### 5.3 影響

- 多條 slotPrefixForMakeRow 內 phone/email 仍 emit
- 既有「{聯絡電話} backField label 推 additionalProperties」的所有測試 → 移除，更新期望為 NOT contain 聯絡電話 / 官方網站
- 既有的 empty label but non-empty value test 整條作廢
- 既有的 both label and value empty test 整條作廢
- 既有的 links — additional properties test 仍綠
- 既有的 empty settings.backFields + empty settings.links → empty additionalProperties array test 仍綠

## 6. Test rewrite 與新增

### 6.1 改寫既有 tests（~13 條）

| 既有 test | 改動 |
|---|---|
| primaryFields[0] uses settings.leftField with a localized label | 改為 primaryFields 為 [] (reward_card default)；新一條 membership_card 版本 |
| secondaryFields[0] uses settings.rightField with a localized label | 改為 secondaryFields[0] uses settings.leftField |
| 比較 primaryFields[0]?.label / secondaryFields[0]?.label | 改為 secondaryFields[0]?.label / secondaryFields[1]?.label |
| primaryFields = [] / secondaryFields = [] 同行 | 改為 secondaryFields 期望行為：left + right 都設 ⇒ length 2 |
| primaryFields = [memberLevel] (v12 memberLevel re-tag) | 改為 secondaryFields = [memberLevel] |
| primaryFields empty when leftField is not set | 改為 secondaryFields empty when both unset |
| secondaryFields empty when rightField is not set | 改為 left / right 互相獨立時 |
| phone primaryField → type: "text" | 改為 phone secondaryField → type: "text" |
| email secondaryField → type: "text" | 改為 secondaryFields[1] (位置變化) |
| memberLevel primaryField (reward_card) → type: "text" | 改為 memberLevel secondaryField → type: "text" |
| passValidDays primaryField → type: "number" | 改為 passValidDays secondaryField → type: "number" |
| primaryFields / secondaryFields labels match getFieldLabel | 改為 secondaryFields only |
| stamp_card pushes 獎勵 for primaryFields[0] AND secondaryFields[0] | 改為「stamp_card with memberLevel 在 left + right 都有，secondaryFields 兩者都是 獎勵」 |
| primaryFields[0]?.label === '電話' / secondaryFields[0]?.label === 'E-mail' | 改為 secondaryFields[0] / secondaryFields[1] |
| primaryFields[0].value is the {<leftField>} cross-reference (visitCount) | 改為 secondaryFields[0].value |
| secondaryFields[0].value is the {<rightField>} cross-reference (accumulatedSpendDiscount) | 改為 secondaryFields[1].value |
| primaryFields empty when leftField is unset → no leftField entry in additionalProperties | 改成 secondaryFields-based |
| secondaryFields empty when rightField is unset → no rightField entry in additionalProperties | 改成新文意 |
| slotPrefixForMakeRow 注釋改寫 | 改為 secondary-only |
| 多條期望的 additionalProperties 序列 | 移除期望的 backField entry |
| empty label but non-empty value test | 整條移除 |
| both label and value empty test | 整條移除 |
| zh-TW label 「電話」 passes through as the property name | 整條移除（或改用 links source） |

### 6.2 新增 tests（6 條）

| Cluster | Test | 覆蓋 |
|---|---|---|
| primary membership-rule | primaryFields is empty for non-membership cardType | reward/stamp/cashback/discount/coupon/gift/multipass ⇒ [] |
| primary membership-rule | primaryFields[0] is memberName when cardType === 'membership_card' | zh-TW + en |
| primary membership-rule | primaryFields[0] value is '{memberName}' cross-reference for membership_card | v11 cross-reference 對齊 |
| secondary two-slot | secondaryFields is [left, right] when both are set | 主驗證 |
| secondary two-slot | secondaryFields has only [left] when right is unset / vice versa | filter undefined |
| additionalProperties clean | additionalProperties does NOT contain backField labels | 主驗證 |

### 6.3 Test totals

- passTemplateMapping.test.ts: ~150 (前 168 -13 移除 +6 新增 -7 改寫 collapse)
- backend total: ~674 (-18)
- shared total: 458 (不變)
- typecheck: exit 0
- lint: exit 0

## 7. Verification steps

1. `npm run typecheck --workspace=apps/backend` ⇒ exit 0
2. `npm run lint --workspace=apps/backend` ⇒ exit 0
3. `npm test --workspace=apps/backend -- passTemplateMapping` ⇒ 全綠
4. `npm test --workspace=apps/backend` ⇒ 全跑
5. `npm test --workspace=packages/shared` ⇒ 全跑

## 8. Out of scope

- images.strip → images.background rename（v7 已在 v7 plan 處理）
- additionalProperties[].type === 'date' enum 缺失（v12 已記為 follow-up）
- passTemplateMapping.ts 大檔 → Rule 000 § A.3 hook extraction（v13+）
- Per-pass runtime value injection（user-facing pass 行為）
- Step 3 dropdown 對 memberName 在 membership_card 上 hide — 不動

## 9. 參考文件

- runs/improvements/feedback/20261012-step8-passcreator-v12-data-driven-mapfieldtype.md
- .cursor/plans/pass-template-mapping-strip-additional-props.plan.md（§ additionalProperties 部分被本 plan revert）
- Passcreator V2 docs
- apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts
- apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts
- packages/shared/constants/card-fields.ts（CARD_FIELDS source-of-truth，不動）
- packages/shared/i18n/fieldLabels.ts（getFieldLabel / getHeaderField，不動）

## 10. Commit 計畫

```
fix(pass-templates): v12 follow-up — primaryFields=memberName IF membership_card; secondaryFields=[left,right]; drop backFields from additionalProperties

- 2026-10-12 v12 follow-up (post data-driven mapFieldType, user-reported bugs)
- Apple Wallet primaryFields[] is RESERVED for the most-important
  field slot. Step 3 left/right dropdown are BOTH emitted to
  secondaryFields[] (left first, then right). Per-cardType:
  - membership_card => primaryFields = [memberName]
  - 其它 => primaryFields = []
- additionalProperties[] no longer mirrors settings.backFields rows
  (user directive). Slot entries (header/left/right) + links still
  emitted.

Verification:
- typecheck: exit 0
- lint: exit 0
- test: passTemplateMapping — net -18 (13 removed, 6 added, 7 rewritten)
- full backend: 692 → 674 (-18) tests pass

Refs: runs/improvements/feedback/20261012-step8-passcreator-v12-data-driven-mapfieldtype.md
Sync: https://github.com/SaomeRebuild/SAOME-REBUILD commit <pending>
Self-improvement: runs/improvements/feedback/20261012-step8-passcreator-v12-followup-primary-secondary.md
```

## 11. Plan complete?

Is the plan complete?
