# MediaAssetUploader Variant Header Pattern

## Metadata

- **日期**：2026-09-01
- **作者**：Josh（agent-assisted via Cursor）
- **commit hash**：pending（docs commit 同步）
- **規則 / skill 觸發**：`saome-image-upload`、`saome-task-router`（L1 Trivial — 文件化既有 pattern）
- **影響**：variant 數量從 2（logo / icon）擴展到 N（logo / icon / background / future avatar 等）時，每次新 variant 都會重複發明 header UI / token，造成跨變體視覺漂移（font weight 不一致、`items-center` vs `items-start`、Fredoka fallback 到系統字等）
- **嚴重度**：SEV-4（cosmetic / 純文件；無功能性損壞，但放任 drift 會累積成 SEV-3 視覺不一致）

---

## 症狀

> **觀察**：2026-08-31 commit `126ad99` 新增 LogoUploader 的 in-component header（標題 + 規格說明）時，default 使用 `items-center` + 帶 `text-center` 的 `<p>`。

對比 CardBuilderEditor Step 3 的 Icon section header（`<h3>` + `<p>`，left-aligned + `text-base font-semibold` + `var(--font-family-heading)`），兩個 header **視覺完全不在同一層級**：

| 項目 | LogoUploader sub-header (126ad99) | Icon section header（既有） |
|---|---|---|
| Alignment | `items-center`（置中） | `items-start`（左對齊） |
| Title weight | `font-semibold` | `font-semibold` |
| Title font | 系統字（沒設 `font-family`） | `var(--font-family-heading)` (Fredoka) |
| Description alignment | `text-center` | 預設（left） |

兩個 header 在同一個 page 上各自漂移，使用者讀起來「不是同一類東西」。

---

## 根因

### 1. `items-center` 是錯的 default

LogoUploader 內部還有一個 128×128 的 preview / crop frame，是**中心對齊的視覺元素**。開發者把這種「中心對齊的視覺」誤推廣到「整個 header 也該置中」。

但 header 是**文字區**，不是視覺元素中心。Header 的對齊要跟 sibling section heading 一致——CardBuilderEditor Step 3 的 section heading 是 left-aligned，header 必須 left-aligned 才能讀成同一段。

### 2. Fredoka 字體 fallback 風險

`<h3>` 沒設 `style={{ fontFamily: 'var(--font-family-heading)' }}`，渲染時 fallback 到系統字。在 Fredoka 載入完成前的 FOUT 期間，使用者看到的是系統字，跟 Icon section header 同一時間點的 Fredoka 字體不一致。

### 3. 沒規範可循

Rule 028 當時只有 § 1–14（Crop Window Invariant / Stage Height Invariant / Cache Busting / Auth Strategy 等），沒有「變體 header 怎麼做」的 pattern 規範。每次新 variant 各做各的。

### 4. i18n layer 混淆風險

實作過程一度考慮過合併 `iconUpload.title` 跟 `cardEditor.step3.iconSection.title` 兩套 i18n key。兩者**語意不同**：
- `iconUpload.title` = action verb（使用者要做什麼：「上傳 Icon」）+ 技術規格（裁切尺寸）
- `cardEditor.step3.iconSection.title` = 概念（這個 section 是什麼：「推播通知圖示」）+ 出現位置（手機鎖屏與推播中心）

合併會把兩層語意塌陷成一層。

---

## 解法

### Pattern 三件（rule 028 § 15）

1. **Sub-component `MediaAssetUploaderHeader/`**：50 行,只做渲染,3 props(`title` / `description?` / `className?`)
2. **`showHeader?: boolean` prop on parent**：default `true`,consumer 巢在已有 section header 的 parent 時設 `false`
3. **Consumer 自己渲染 header**：當 `showHeader={false}`,consumer 用相同 token 渲染

### 跨變體 token 一致性（鐵律）

兩個 header 路徑**必須**共用同一組 token：

| 元素 | Token |
|---|---|
| Title (`<h3>`) | `text-base font-semibold text-foreground` + `style={{ fontFamily: 'var(--font-family-heading)' }}` |
| Description (`<p>`) | `text-sm text-muted-foreground` |
| Container (`<div>`) | `flex w-full flex-col items-start gap-2` |

### 對齊鐵律

- ✅ Header 一律 left-aligned(`items-start`)
- ❌ Header `items-center` → 視覺漂移
- ❌ Title `font-medium` 而 parent section `font-semibold`(或反之)→ 權重不一致
- ❌ Title 不用 `var(--font-family-heading)` → Fredoka 字體 fallback 到系統字

### i18n layout 保留

| Key | Namespace | 語意 |
|---|---|---|
| `iconUpload.title` / `iconUpload.hint` | 變體獨立 namespace | Action verb + 技術規格 |
| `cardEditor.step3.iconSection.title` / `.hint` | 父 feature namespace | 概念 + 出現位置 |

**禁止**：誤判為重複而合併。

### 何時用 `showHeader={false}`

| 情境 | 設定 |
|---|---|
| Uploader 獨立成一區（無 parent section）| `showHeader={true}`（default）— 顯示內部 header |
| Uploader 巢在已有 section header 的 parent 內 | `showHeader={false}` — parent 自己渲染,避免雙重 header |

範例：`CardBuilderEditor Step 3` 的 Icon 區塊已有 `<section><h3>推播通知圖示</h3><p>...</p></section>`,所以 `<MediaAssetUploader variant="icon" showHeader={false}>`。

---

## 驗證

既有 5 個 test 已涵蓋 `MediaAssetUploaderHeader`:

| Test | 涵蓋 |
|---|---|
| 1. `renders the title as an h3 with the heading font-family token` | h3 + font-family token |
| 2. `renders the description below the title when provided` | description 渲染 |
| 3. `hides the description paragraph when not provided` | 條件渲染（不渲染空 `<p>`）|
| 4. `renders nothing inside the wrapper besides title + optional description` | DOM 結構扁平 |
| 5. `forwards className to the outer wrapper` | className 轉發 + 預設 `items-start` |

跨變體視覺一致性透過 **rule 028 § 15.3 鐵律 + 既有 CardBuilderEditorWorkspace 的 section header 對照**保證（不靠 conformance test,因 token 一致性已是 code review 視覺可驗）。

---

## 衍生

### 為什麼這次只文件化,不重構既有 code

`MediaAssetUploaderHeader` 已在 commit `155019f` 完成對齊（`items-start` + 移除 `text-center` + 加 `var(--font-family-heading)`）。Code 已是「對」的狀態,只是當時沒寫進 rule。下次新 variant（background / avatar）才會用到這條 rule。

### 為什麼不 generalize 到 `000-modular-design.mdc`

目前只有一個例子（media uploader）用到「variant sub-component + opt-out prop」pattern。過早 generalize 會變成「對未來可能的需求抽象」,違反 YAGNI。等第二個例子出現再考慮 generalize（例如未來 theme / variant 切換的 L2 元件）。

### 為什麼不寫 conformance test

既有 5 個 test 已涵蓋 items-start assert + font-family token assert。最低必要覆蓋面已達。Conformance test（如 grep 整 repo `text-lg font-semibold` 確認沒人改 token）屬於「流程守門」,目前沒 CI 自動化檢查,加 test 反而是 dead weight。後續若 CI 接 lint rule 再考慮加。

### 為什麼不寫 Storybook story

屬於「驗證層」（visual review）。使用者選 minimal scope,可後續 PR 補。Pattern 文件化已能防止下次發明輪子。

---

## Decision Log

無（本 pattern 不涉及架構決策,純粹是「既有 code 提煉成規範」）。

---

## 參照

- commit `126ad99` — 新增 LogoUploader in-component header（症狀起點）
- commit `155019f` — header 樣式對齊 Icon section header（修法起點）
- `.cursor/rules/028-image-uploader-pattern.mdc` § 15 — Variant Header Pattern（本 commit 新增）
- `.cursor/skills/saome-image-upload/SKILL.md` § 4 — Variant Header Pattern MANDATORY 段（本 commit 新增）
- `design-system/MASTER.md` § 2 — h1-h3 scale（本 commit 新增 h3 scale）
- `design-system/MASTER.md` § 14 — Variant Header Pattern（本 commit 新增）
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploaderHeader/` — sub-component 實作範本
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorWorkspace.tsx` L234–253 — Icon section header（跨變體 token 一致性對照基準）
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.types.ts` L22–31 — `showHeader?: boolean` prop 定義
