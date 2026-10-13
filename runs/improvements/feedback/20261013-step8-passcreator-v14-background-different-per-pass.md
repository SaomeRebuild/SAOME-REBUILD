# 2026-10-13 Step 8 v14 — `images.backgroundDifferentForEachPass` 硬編 `true`（default-on）

> **對應 commit**: 待 user 驗證後 commit（單一 commit 跟 feedback 同進）
> **日期**: 2026-10-13
> **類型**: minimal mapping extension（L2 Standard — 不跨模組、不動 schema、不動 DB、不動前端、不動 i18n）
> **根因**: user 2026-10-13 撤回 v14 原 plan（加 Step 3 Switch + 4-layer schema sync + UI + i18n），改要 SAOME 自動 emit `true`，給 Passcreator 一個「以後每張 pass 都可以獨立上傳背景覆蓋 template default」的預設行為，但 SAOME 自己不暴露 toggle。

**對齊**:
- `runs/improvements/feedback/20261012-step8-passcreator-v13-location-radius-initial-message-and-membership-backfields.md`（v13 是 mappings 最後一次完整 cycle）
- `runs/decisions/2026-10-11-step8-passcreator-push.md`（v9-v12 batched decisions）
- `.cursor/plans/step8_v14_backgrounddifferentforeachpass_—_default-on_4efdcb70.plan.md`（本 plan）

---

## 1. 症狀

User 2026-10-13 在 v14 plan 通過後撤回原 scope：

> 「我不是要在前端新增欄位，而是希望以後卡片模板做好送出後這個選項預設為true」

也就是說原本 v14 plan（[step8_v14_backgrounddifferentforeachpass_24707910.plan.md](file:///c:/Users/user/.cursor/plans/step8_v14_backgrounddifferentforeachpass_24707910.plan.md)）的 scope：

1. shared schema 加 `z.boolean().optional()`
2. DB interface 加 optional field
3. Passcreator type 加 optional field
4. mapping 條件 emit
5. Frontend store + Switch UI
6. i18n keys 加 2 個
7. 4 條 conformance test

**全部推翻**，換成最簡版：

1. Passcreator type 加 optional field（必要 — emit 需 typed）
2. mapping 硬編 `true`
3. 2 條 conformance test（default-on / with-URL）
4. 不加任何 SAOME-side field

---

## 2. 為什麼這是對的決定

### 2.1 「default-on」比「user-controlled」少 9 個 surface 變更

| 主題 | 原 plan (toggle UI) | 現 plan (default-on) |
|---|---|---|
| shared schema | 加 optional boolean | **不動** |
| DB interface | 加 optional boolean | **不動** |
| Frontend store | 加 state + setter + selector + handleNext persist | **不動** |
| Frontend UI | 加 Switch + Label + popover | **不動** |
| i18n | 加 perPassToggle.title + .hint | **不動** |
| MediaAssetUploader | 不改（sibling） | 不改 |
| CardBuilderEditorWorkspace | 加 ~25 行 | **不動** |
| conftest | 4 case | 2 case |
| **總計 surface 變更** | **10 個檔案** | **4 個檔案** |

10:4 的差距，主因是 SAOME 決定不讓 tenant 控制 → Schema/UI/i18n/store 都不用動。

### 2.2 「為什麼不暴露 toggle」是 user 決策

user 訊息原文：

> 「希望以後卡片模板做好送出後這個選項預設為true」

語意：
- 「以後」= 從這個 PR 之後的 card template 都走 `true`
- 「做好送出後」= post-Save-and-Publish，不是 pre-create
- 「預設」= 系統給 default，不是 user 選

→ 推論：tenant 沒表達過要 opt-out 的需求，所以 toggle 沒必要存在。等 opt-out 需求浮現，再回頭補 6 步（plan § 7）。今天先 ship simple。

### 2.3 type widening 是必要的妥協

`images` IIFE 原本：

```ts
const out: Record<string, string> = {};
```

如果硬塞 `out.backgroundDifferentForEachPass = true`，TS 會報錯。修法：

```ts
const out: Record<string, string | boolean> = {};
```

這個 widening 對外觀察是無害的：
- `icon` / `logo` / `background` 仍是 string（assign 給 string 是合法）
- 新增 boolean 鍵是 optional（`PasscreatorTemplateBody.images` 已是 optional shape）
- return 推導型別依然 conform `PasscreatorTemplateBody.images`

唯一回退路徑是有人讀 `body.images[key]` 後期待是 string — 但 codebase 沒有這個 pattern，三個 emitter（icon/logo/background）都是寫死 key 名，不迭代。

---

## 3. 修法（4 個檔案）

### 3.1 [`apps/backend/src/shared/lib/passcreator.ts`](apps/backend/src/shared/lib/passcreator.ts)

在 `PasscreatorTemplateBody.images` 區塊加 optional field：

```ts
images: {
  icon?: string;
  logo?: string;
  background?: string;
  /**
   * 2026-10-13 v14 — per-pass background override. When `true`,
   * Passcreator accepts a per-pass background image at issuance time
   * that overrides the template-level `images.background` (which
   * remains as fallback).
   *
   * SAOME mapping HARDCODES `true` (user decision 2026-10-13): future
   * card templates get this flag set unconditionally so tenants can
   * upload per-pass backgrounds later without re-pushing the template.
   * No schema field, no DB column, no frontend toggle.
   */
  backgroundDifferentForEachPass?: boolean;
};
```

不是 schema drift：這個 type 是 upstream contract（Passcreator V2 API 的形狀），新增 optional 純反映 Passcreator 文件。

### 3.2 [`apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts`](apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts)

`images` IIFE line ~738 區段改 3 處：

(a) `out` 型別 widening：

```ts
// before
const out: Record<string, string> = {};
// after
const out: Record<string, string | boolean> = {};
```

(b) return 前加一行硬編：

```ts
if (stripUrl) out.background = stripUrl;
// v14 — hardcoded default-on (user decision 2026-10-13).
// SAOME does NOT persist this flag anywhere; the mapping emits
// `true` unconditionally so every future Passcreator template
// the tenant pushes gets the per-pass background capability.
// The flag tells Passcreator to accept a per-pass upload at
// issuance time that overrides the template-level `images.background`
// URL (which remains as the PassKit fallback default for passes
// without an override upload).
out.backgroundDifferentForEachPass = true;
return out;
```

(c) 檔頭 docstring v9-v12 列表加 14. 條目。

### 3.3 [`apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts`](apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts)

在既有 `describe('mapTemplateToPasscreator — images', ...)` 區塊加 2 條：

```ts
it('always emits images.backgroundDifferentForEachPass = true (v14 default-on)', () => {
  const body = mapTemplateToPasscreator({
    template: makeRow(),
    language: 'zh-TW',
    r2PublicUrl: R2_URL,
  });
  expect(body.images.backgroundDifferentForEachPass).toBe(true);
});

it('emits flag alongside images.background URL when tenant uploaded one (v14 default-on with URL)', () => {
  const body = mapTemplateToPasscreator({
    template: makeRow(),
    language: 'zh-TW',
    r2PublicUrl: R2_URL,
  });
  expect(body.images.backgroundDifferentForEachPass).toBe(true);
  expect(body.images.background).toBe(
    `${R2_URL}/api/pass-templates/00000000-0000-4000-8000-000000000001/background`,
  );
});
```

第 2 條附帶 verify 既有的 background URL 行為保留（PassKit fallback 不被破壞）。

### 3.4 INDEX

`runs/improvements/INDEX.md` 加新 row，記錄本 PR。

---

## 4. 不在這次 commit 範圍（plan § 7 explicit Out-of-Scope）

若未來 opt-out 需求浮現：

1. shared schema 加 `backgroundDifferentForEachPass: z.boolean().optional()`
2. DB interface 對應 optional field
3. CardBuilderEditor store 加 setter + selector
4. CardBuilderEditorWorkspace 加 Switch UI
5. i18n 加 toggle keys
6. mapping 改 conditional（`value === false` 時省略 flag；`undefined/true` 時 emit）

**今天不預先做這 6 步** — 避免過度工程。user 沒要 opt-out，就不 ship opt-out。

---

## 5. 驗證

跑 [`package.json`](apps/backend/package.json) 的：

```bash
npm run typecheck --workspace=apps/backend
npm run test --workspace=apps/backend -- passTemplateMapping.test.ts
npx tsc -b --noEmit
```

預期全綠。type widening 那行僅影響 IIFE 內部型別推導，對外觀察（`PasscreatorTemplateBody` shape）無害。

---

## 6. scope

- `apps/backend/src/shared/lib/passcreator.ts` +9（docstring + optional field）
- `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` +9（docstring + IIFE 1 行 + type widening 1 char）
- `apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts` +18（2 conformance tests）
- `runs/improvements/feedback/20261013-step8-passcreator-v14-background-different-per-pass.md` new
- `runs/improvements/INDEX.md` +1 row

無 `packages/shared/` 變更、無 DB migration、無 Frontend 變更、無 i18n 變更、無 wrangler.jsonc 變更。

---

## 7. future invariant

a. **SAOME 永遠不 persist `backgroundDifferentForEachPass`**。`templates.settings` 沒這個 key、`packages/shared/schemas/card.ts` 沒這個 key、未來若誤加要先在 code review flag。

b. **`PasscreatorTemplateBody.images.backgroundDifferentForEachPass?: boolean`** 是純 type-level 宣告。讀 source code 的人要認得：實際 emit 永遠是 `true`（沒有 false 路徑）。

c. **v14 寫死規則跟 plan § 2 docstring 互相 reference**。日後若改 mapping 行為（例如改成 conditional），要 update 兩處 + 回填這個 feedback。

d. **未來加 opt-out** 必須走 plan § 7 6 步，不可繞過 schema sync 直接做 mapping 改 — 否則跟 v9-v13 的 drift SOP 衝突。
