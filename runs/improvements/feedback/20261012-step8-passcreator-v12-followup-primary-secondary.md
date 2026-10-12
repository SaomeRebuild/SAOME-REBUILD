# 2026-10-12 Step 8 v12 follow-up — `primaryFields` / `secondaryFields` slot + 拿掉 `additionalProperties` 對 `backFields` 的污染

> **對應**：`runs/improvements/feedback/20261012-step8-passcreator-v12-data-driven-mapfieldtype.md`（v12 已修完 build-time drift guard，但 runtime 行為需要 follow-up）
> **類型**：fix（L2 Standard）
> **影響範圍**：`apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` + 兩個 test file

## 1. 背景 — v12 跑完出現 3 條 user-visible bug

2026-10-12 v12 完成 `mapFieldType` 從 19-case switch 改成 data-driven lookup（基於 `CARD_FIELDS[i].semanticType`）。Build/typecheck/test 全綠，但 user 跑實際 Step 8 push 後回報 3 條 wire-format bug：

| # | bug | user 原話（zh-TW） |
|---|---|---|
| 1 | 左右欄位的左欄位跑去 `Primary fields` | 「左右欄位的左欄位跑去 Primary fields，這是不對的，他實際上是是兩個 Secondary fields，左欄位是第 1 個，右欄位是第 2 個」 |
| 2 | `primaryFields` 應該只有「會員卡的會員姓名」 | 「只有會員卡的會員姓名會在 Primary fields」 |
| 3 | `backFields` 的值不該塞進 `additionalProperties` | 「你把 backFields 的值填到了 Additional properties，這是錯誤的，backFields 的值就填在 backFields 裡面就好」 |

### 1.1 bug #1 + #2 的根因 — Apple Wallet 「primary slot 是會員姓名」的慣例被忽略

回溯 v6-v12 期間：mapping module 一直把 Step 3 dropdown 的 `settings.leftField` 推到 `primaryFields[0]`、把 `rightField` 推到 `secondaryFields[0]`。這違反 Apple Wallet 的 `PKPassStyleStoreCard` 設計 — 對 SAOME 這種 storeCard layout 來說：

```
primaryFields[]  = RESERVED for the most-important field slot
secondaryFields[] = Step 3 dropdown 的左/右欄位（BOTH）
```

v6-v12 把 leftField 推到 primary 是用「user dropdown 的第一欄 = primary」邏輯，但 user 報這違反 Apple Wallet 慣例：primary slot 應該固定給「會員姓名」（membership card 的「who is the pass holder」識別），不要被 Step 3 dropdown 覆蓋。

### 1.2 bug #3 的根因 — v7 plan 多寫了 backFields → additionalProperties 鏡像

`pass-template-mapping-strip-additional-props.plan.md` v7 fix 為 `additionalProperties[]` 加了 `backFields` 迭代，目的是讓 `{聯絡電話}` 等 backField label 可以當 `{Name}` cross-reference。User 2026-10-12 反饋：

> 「backFields 的值就填在 backFields 裡面就好」

— 不需要 mirror 到 `additionalProperties`。

這是 v7 plan 在 commit 之前由 user 推翻的部分，本 follow-up revert v7 的 `backFields` 鏡像；保留 slot entries（header/left/right → `{KeyName}` cross-reference）跟 links iteration（type: 'url'）。

---

## 2. 修法

### 2.1 `mapTemplateToPasscreator` — `primaryFields` 改為 `membership_card ? [memberName] : []`

```typescript
const primaryFields = [];
if (template.card_type === 'membership_card') {
  primaryFields.push({
    key: 'memberName',
    type: mapFieldType('memberName'),  // 'text'
    label: getFieldLabel('memberName', language, 'membership_card') ?? '',
    value: '{memberName}',
  });
}
```

注意：`memberName` 在 `CARD_FIELDS` 內 `hideOnCardTypes: ['membership_card']` — Step 3 dropdown 對會員卡不顯示此選項。但 mapping 對會員卡強制 emit `memberName` — 因為 user 報 Apple Wallet primary slot 就是要顯示會員姓名（即使 pass 已經有 `templates.name`，避免 Apple Wallet primary position 整個空白）。store value 保留，editor dropdown 行為不變。

### 2.2 `mapTemplateToPasscreator` — `secondaryFields = [leftField, rightField]` 順序與 filter

```typescript
const secondaryFields = [];
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

- 順序 = leftField 在前、rightField 在後（user 原話：「左欄位是第 1 個，右欄位是第 2 個」）
- 沒設定的欄位 filter 掉（不產 placeholder；v11 primaryFields/secondaryFields 單值行為對齊）
- 兩個都沒設時 `secondaryFields = []`

### 2.3 `buildAdditionalProperties` — 移除 backFields iteration

```typescript
export function buildAdditionalProperties(args: {
  backFields: TemplatesRow['settings']['backFields'];
  links: TemplatesRow['settings']['links'];
  slotKeys?: { header?: string | null; left?: string | null; right?: string | null };
}): PasscreatorAdditionalProperty[] {
  const out: PasscreatorAdditionalProperty[] = [];

  // 0. slot keys (headerFields / secondaryFields). Each populated slot
  //    emits ONE entry so {KeyName} cross-reference resolves.
  for (const k of [args.slotKeys?.header, args.slotKeys?.left, args.slotKeys?.right]) {
    if (!k) continue;
    const fieldType = mapFieldType(k);
    const propertyType: PasscreatorAdditionalProperty['type'] =
      fieldType === 'number' ? 'number' : 'text';
    out.push({ name: k, placeholder: `{${k}}`, type: propertyType, required: false, hidden: false });
  }

  // 1. (REMOVED 2026-10-12 v12-followup) backFields mirror.

  // 2. links — type: 'url'. Same normalizeLinkUrl filter + MAX_PASS_LINKS cap.
  const links = (args.links ?? []).filter((row) => normalizeLinkUrl(row.value) !== null);
  if (links.length > MAX_PASS_LINKS) { /* console.warn */ }
  for (const row of links.slice(0, MAX_PASS_LINKS)) {
    const name = derivePropertyName(row.label, row.value);
    if (name === null) continue;
    out.push({ name, placeholder: `{${name}}`, type: 'url', required: false, hidden: false });
  }

  return out;
}
```

`backFields` param 保留（向後相容，但 body 不再 consume）。Slot + links 兩個 source 保留 — 這部分 v7 + v11 範圍 valid。

---

## 3. 測試更新

### 3.1 `passTemplateMapping.test.ts` — 從 v1/v2 預-v6 基準升到 v12-followup wire-format contract

測試 file 在 git HEAD 只有 37 個 v1/v2 時代 tests，期望 primaryFields=rightField 等 pre-v6 行為，與 v6/v7/v12 source code 完全錯位。本 commit 把 42 tests 全部重寫對齊 v12-followup：

| Test cluster | Tests | 覆蓋 |
|---|---|---|
| name + colors + barcode + images | 9 | 既有 v6 behavior（hex `#` 保留、R2-proxy URL pattern、background key） |
| fields (header / primary / secondary / back) | 11 | 新增 `secondaryFields [left, right]`、`primaryFields = [memberName]` IF membership、`additionalProperties 不含 backField labels` |
| passTypeId + language propagation | 6 | headerFields[0]/secondaryFields[0..1] 都用 getFieldLabel/getHeaderField（drift guard）|
| cardType-aware memberLevel override (secondary only) | 13 | reward/cashback/stamp ⇒ 獎勵；discount ⇒ 折扣等級；membership ⇒ 會員等級 + primaryFields=[memberName] |
| makeRow helper updates | — | 新增 `backgroundImage` default |

### 3.2 `fieldLabels-integration.test.ts` — drift guard 同步到 secondaryFields slot

原本 19 條測試期望 `primaryFields` 走 leftField；重寫成 14 條針對 secondaryFields 的 drift guard：

- headerField (zh-TW/en) × 2
- secondaryFields[0] from leftField (zh-TW/en) × 2
- secondaryFields[1] from rightField (zh-TW/en) × 2
- regression switch shared label (zh-TW) × 1
- regression switch shared headerField (zh-TW) × 1
- membership_card primaryFields = [memberName] × 1
- cardType-aware memberLevel override on secondaryFields × 5

---

## 4. Verification

| 項目 | 結果 |
|---|---|
| `tsc -b apps/backend --noEmit` | exit 0 |
| Backend tests | **35 files / 566 tests passed**（passTemplateMapping 42 + fieldLabels-integration 14 + 其他 510） |
| Shared tests | **14 files / 458 tests passed** |
| 總計 | 1024 tests pass |

---

## 5. 教訓

### 5.1 規範層

1. **Apple Wallet 慣例 > editor 直覺**：當 wire-format 規範（PKPassStyleStoreCard layout）跟 editor UX 直覺衝突，wire-format 規範優先。primaryFields 是 RESERVED 的「most-important field」slot — 不該讓 Step 3 dropdown 隨意覆蓋。
2. **cross-reference variable store 是「跨 wire-format slot 的 placeholder 解析」機制，不是「備份到 `additionalProperties`」**：v7 plan 把 backFields label/value 對映進 `additionalProperties` 是越界 — backFields 已經在 `fields.backFields[]` 一份，不需要也沒理由 duplicate。如果 user 想 `{name}` cross-reference，可以讓 user 顯式在 editor 維護 `additionalProperties`（不過 current CardBuilder 沒這個 UI）。
3. **data-driven metadata 是 contract，但 contract 變更需要 user 確認**：v12 把 `mapFieldType` 改成 data-driven 是 build-time drift guard，但 wire-format contract（哪些 field 推到 primary）user 看到實際 push 才發現不對。v12 是「不寫 dead switch」範圍；wire-format 變更是 v12 follow-up 範圍。兩者需要分開 commit / 分開 feedback doc，避免 commit 一個巨大的「mix bug fix + refactor」PR。

### 5.2 操作層

1. **第三層 drift guard 必備**：v12 data-driven 防的是 build-time drift（型別、enum、字串），runtime wire-format contract 需要真的 end-to-end push probe 才能 catch（例如 `apps/backend/scripts/probe-real-payload.cjs` 那類工具）。Typecheck + unit test 通過 ≠ 跟 Passcreator 實際 wire format 一致。
2. **本機大規模 test rewrite 風險**：這次更新 `passTemplateMapping.test.ts` 走了 5+ 輪 StrReplace 才修乾淨；中間 StrReplace 編碼錯誤（CJK 字串、em-dash）讓 file 損壞過一次（git restore 救回）。下次考慮：**用 Python script 寫整個 file（utf-8 編碼一次確定），不要用 PowerShell StrReplace 拼 CJK**。
3. **git HEAD 的 test file 可能遠落後 source**：遇到 test file 在 git HEAD 只有 37 tests、source code 卻有 165 tests 時，**先 checkout git 的 baseline 再 surgical 改**，不要相信「之前的 working state 還在」。v12 的 128 條 test 增量已經 commit leak 過了。

---

## 6. Out of scope（user 沒要求 / 不在本 plan）

- `membershipTiers / rewardTiers / cashbackTiers` → `functionality.tiers` mapping
- `passTemplateMapping.ts` 956 行大檔 → Rule 000 § A.3 hook extraction
- Per-pass runtime value injection（template-level `{KeyName}` vs per-pass real value 的接線）
- CARD_FIELDS `hideOnCardTypes` schema-driven refactor
- Production smoke test（`birthday` date picker）

## 7. 待辦（next session）

- Production smoke test：建一個 `birthday` leftField template，push 到 Passcreator，確認 date picker render 正確
- `passTemplateMapping.ts` 985 行（post-v12-followup）已逼近 1000 行的 refactor trigger — Rule 000 § A.3 hook extraction 進程：
  - `mapFieldType(key)` → 抽到 `fieldTypeLookup.ts`
  - `buildAdditionalProperties(args)` → 抽到 `additionalProperties.ts`
  - `normalizeHexColor / normalizeLinkUrl / slugify / derivePropertyName` → 抽到 `normalizers.ts`

## 8. 參照

| 來源 | 用途 |
|---|---|
| [Passcreator V2 docs](https://developer.passcreator.com/en/api/v2/pass-template) | V2 wire-format contract — `primaryFields[]` / `secondaryFields[]` / `additionalProperties[]` |
| [apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts](../../apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts) | 改的 source file |
| [apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts](../../apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts) | 改的 test file (37 → 42 tests) |
| [apps/backend/src/modules/pass-templates/tests/fieldLabels-integration.test.ts](../../apps/backend/src/modules/pass-templates/tests/fieldLabels-integration.test.ts) | 改的 test file (19 → 14 tests) |
| [.cursor/plans/pass-template-mapping-v12-followup-primary-secondary.plan.md](../../.cursor/plans/pass-template-mapping-v12-followup-primary-secondary.plan.md) | 本 commit 對應 plan |
| [runs/improvements/feedback/20261012-step8-passcreator-v12-data-driven-mapfieldtype.md](20261012-step8-passcreator-v12-data-driven-mapfieldtype.md) | v12 背景（data-driven mapFieldType） |
| [runs/improvements/feedback/20261012-step8-passcreator-v11-cross-reference-fields.md](20261012-step8-passcreator-v11-cross-reference-fields.md) | v11 背景（slot cross-reference values） |
| [runs/improvements/feedback/20261012-step8-passcreator-strip-additional-props.md](20261012-step8-passcreator-strip-additional-props.md) | v7 背景（本次 commit revert 其 backFields 鏡像部分）|
| Rule 019 § D.3 | third-party API 是 contract；drift 是 P0 |
| Rule 023 | shared Validation：single source of truth |
| Rule 011 | feedback 在實作當下 commit，不要 batch 跨多個 fix |
| Rule 025 | L2 Standard：TDD + verification |

---

**Commit summary**：

| File | Lines changed |
|---|---|
| `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` | +60 / -45 (~985 lines, was ~944) |
| `apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts` | rewrite 37→42 (520 lines) |
| `apps/backend/src/modules/pass-templates/tests/fieldLabels-integration.test.ts` | rewrite 19→14 (199 lines) |
| `runs/improvements/feedback/20261012-step8-passcreator-v12-followup-primary-secondary.md` | new (this doc) |
| `runs/improvements/INDEX.md` | new INDEX row |
| `.cursor/plans/pass-template-mapping-v12-followup-primary-secondary.plan.md` | new plan |

**Verification**：
- `tsc -b apps/backend --noEmit` exit 0
- Backend vitest: 35 files / 566 tests passed
- Shared vitest: 14 files / 458 tests passed
- Total: **1024 tests pass**

Refs: runs/improvements/feedback/20261012-step8-passcreator-v12-data-driven-mapfieldtype.md
Sync: https://github.com/SaomeRebuild/SAOME-REBUILD commit <pending>
Self-improvement: runs/improvements/feedback/20261012-step8-passcreator-v12-followup-primary-secondary.md
