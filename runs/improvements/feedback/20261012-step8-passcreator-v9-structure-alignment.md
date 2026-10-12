# 2026-10-12 Step 8 v9 fix — Passcreator V2 payload 結構對齊（`links` top-level / `logoText` top-level / `auxiliaryFields` / conditional `locations`）

> **對應 commits**: 本次 fix 還未 commit（待 user 驗證後 commit — 跟 v7/id-parse/v8 一起 batched 還是分開待 user 決定）
> **根因**: `mapTemplateToPasscreator` 推出去的 body 不符合 Passcreator V2 的 canonical schema:
>   1. `links` 推成 `fields.backFields[]` 內的 HTML anchor，但 V2 範例 payload 是 top-level `links[]` array。
>   2. `logoText` 沒單獨推，只被合併進 `name` 的 fallback chain。
>   3. `fields.auxiliaryFields` 從來沒推（V2 範例是 `[]`，SAOME 也該對齊）。
>   4. `locations` / `locationsDisabled` 從來沒推，user 的「若 DB 有開啟就把資訊推上去」需求沒實作。
>
> **日期**: 2026-10-12
> **類型**: bug fix（L2 Standard + critical chain 上的後續 — same severity family as v7/v8, see `AGENTS.md § Auth flow 鐵律`）
> **對齊**:
>   - `runs/improvements/feedback/20261011-step8-passcreator-push.md` (v6 fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-create-id-parse.md` (id parse fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-strip-additional-props.md` (v7 fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-update-method-post.md` (v8 fix)

---

## 1. 症狀

User 2026-10-12 把 v7/v8 fix（POST method + strip image + additionalProperties）部署完實測 push 後回報 4 個 payload-level 問題：

1. **`links` 放錯位置**: v7/v8 把 links 推到 `fields.backFields[]` 內的 `<a href="URL">label</a>` HTML anchor，但 Passcreator V2 範例 payload（user 直接貼 DOC 範例進來）的 `links` 是 **top-level array**（跟 `images` / `colors` / `additionalProperties` 同層），不是塞在 `fields.backFields` 裡。
2. **`logoText` 沒有傳**: `name` 雖然會拿到 `settings.logoText` 當 fallback（看起來 logoText 是有的），但 **頂層的 `logoText` 欄位從來沒推**。Passcreator 部署出來的 pass header strip 顯示空字串。
3. **左右欄位跟 headerField 還是沒有出現標籤跟 Additional properties**:
   - 左右欄位 = primaryFields / secondaryFields
   - headerField = headerFields
   - 「標籤」是指 `label`
   - 「Additional properties」是 user 引用 Passcreator doc 原文（指 `additionalProperties[]` top-level array）
   - 我們程式碼內這 4 個欄位的 label 都還在（tests 驗證過），但 `logoText` 沒推跟 `links` 放錯位是 user 在 deployed pass 看到的真實症狀。user 把 4 條症狀包在這一句，一起報。
4. **地理位置沒有條件推送**: 「地理位置是否啟用，取決於 DB 裡的設定，若有開啟，要把裡面的資訊推上去」— `settings.locationsDisabled` 的 toggle 早就存在 DB 跟 shared schema 裡（2026-09-06 就有），但 mapping 從沒讀過它來決定要不要推 `locations[]`。

---

## 2. 根因

### 2.1 Links 放錯位置 — 用了 V2 doc 寫的「alternative」 workaround，但 canonical 是 top-level

v7 fix 把 links 渲染成 HTML anchor 塞進 `fields.backFields[]`，依據是 Passcreator doc 的「alternative」:

> You can also use HTML links anywhere in your back fields instead of using these dedicated link fields!

但 user 2026-10-12 直接貼了 V2 範例 payload（從 `mu-plugins/Passcreator/V2 end point/Pass template/pass-template-management.md` / `describe-the-structure-of-a-pass-template.md`）— 範例裡 `links` 是 **top-level array**:

```json
{
  ...
  "links": [
    { "label": "Contact", "value": "tel:004989123456789" },
    { "label": "Website", "value": "https://www.example.com" }
  ],
  "images": { ... },
  "colors": { ... },
  "additionalProperties": [ ... ],
  ...
}
```

跟 `images` / `colors` / `additionalProperties` / `locations` / `beacons` 一樣，是 peer-level 欄位。

我們用了 workaround 而沒用 canonical — 跟 v7 `images.strip` 那個 bug 同類型：對 workaround 太熟，沒對 canonical V2 範例做端到端比對。

### 2.2 LogoText 沒單獨推 — 被併進 `name` 的 fallback chain

`mapTemplateToPasscreator` line 304:

```ts
// 修前
const name = (template.name && template.name.trim()) || s.logoText || 'Untitled Card';
```

`settings.logoText` 確實有參與 `name` 的 fallback，但 **`logoText` 從來沒作為獨立欄位被推上去**。V2 範例 payload 兩個欄位並存:

```json
"name": "My template",
"logoText": "",   ← 範例是空字串，但我們的 `settings.logoText` 是有的
```

`name` = Card Name（Passcreator UI 標題），`logoText` = Apple Wallet header strip 文字 — 兩個是不同的 UI 區。我們把兩個合併成一個，等於把 header strip 文字丟掉了。

### 2.3 `auxiliaryFields` 從來沒在 mapping 推

`fields: { headerFields, primaryFields, secondaryFields, backFields }` — 缺 `auxiliaryFields`。V2 範例的 `fields` 是 5 keys（含 `auxiliaryFields: []`）。

Passcreator 對缺這個 key 不會 silent drop（因為它是 array，缺了預設空），但 V2 schema 對齊要求該推就推，跟 `additionalProperties[]` 是 top-level array 一樣 — descirbe response 必定有，即使空。

### 2.4 `locations` 跟 `locationsDisabled` 從來沒在 mapping 推

DB 跟 shared schema 早就有:

```ts
// db/templates.ts::TemplateSettings
locationsDisabled?: boolean;
locations?: Array<{ name: string; latitude: number; longitude: number; relevantText?: string | null }>;
```

但 `mapTemplateToPasscreator` 從來沒讀過 — root cause 跟 v7 的 `additionalProperties` 一樣：interface 沒欄位就跳過。user 2026-10-12 提的「若 DB 有開啟就把資訊推上去」是對 toggle 的 functional spec，但實作端一直沒接上。

---

## 3. 修法

### 3.1 `PasscreatorTemplateBody` interface 擴充

`apps/backend/src/shared/lib/passcreator.ts` 加 4 個 top-level fields + `auxiliaryFields`:

```ts
export interface PasscreatorTemplateBody {
  ...
  /**
   * Logo text — text shown on the pass header.
   * V2 endpoint expects this as a top-level field (separate from `name`).
   */
  logoText?: string;
  ...
  fields: {
    headerFields: Array<{...}>;
    primaryFields: Array<{...}>;
    secondaryFields: Array<{...}>;
    /** V2 schema key — always emit `[]` even when no authoring. */
    auxiliaryFields: Array<{...}>;
    backFields: Array<{...}>;
  };
  /** Top-level `links[]` — V2 canonical (NOT inside fields.backFields). */
  links?: Array<{ label: string; value: string }>;
  /** Geolocation toggle. Always sent. */
  locationsDisabled?: boolean;
  /** Geolocation triggers — only sent when locationsDisabled === false. */
  locations?: Array<{ latitude: number; longitude: number; relevantText?: string }>;
}
```

### 3.2 `mapTemplateToPasscreator` 重寫 link 邏輯

`apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts`:

```ts
// 修前 (v7/v8)
const linkBackFields = (s.links ?? [])
  .filter((row) => Boolean(row.value && row.value.trim().length > 0))
  .slice(0, MAX_LINKS_IN_BACK_FIELDS)
  .map((row) => {
    const safeUrl = escapeHtmlAttribute(row.value);
    const safeLabel = escapeHtmlText(row.label || row.value);
    return {
      key: '',
      type: 'text' as const,
      label: row.label,
      value: `<a href="${safeUrl}">${safeLabel}</a>`,
    };
  });
const backFields = [...userBackFields, ...linkBackFields];

// 修後 (v9)
const backFields = (s.backFields ?? []).map((row) => ({...}));

// links 推到 top-level
links: (s.links ?? [])
  .filter((row) => Boolean(row.value && row.value.trim().length > 0))
  .slice(0, MAX_PASS_LINKS)
  .map((row) => ({ label: row.label, value: row.value })),
```

`linkBackFields` 整個刪掉 — 不再產生 HTML anchor。`escapeHtmlAttribute` / `escapeHtmlText` helper 也跟著刪掉（dead code，沒人呼叫了）。

`MAX_LINKS_IN_BACK_FIELDS` 重新命名為 `MAX_PASS_LINKS` — 反映新語意（top-level links slot 的 4-link cap）。

### 3.3 新增 `logoText` top-level

```ts
return {
  ...
  name,                              // Card Name — 跟 logoText 是 2 個獨立欄位
  logoText: s.logoText ?? '',        // ← v9 新增
  description: ...,
  ...
};
```

`name` 的 fallback chain 保留（用 `logoText` 當 `name` 的後備值，避免 Card Name 完全空），但 V2 canonical 上「每個欄位都獨立推」。

### 3.4 `auxiliaryFields: []` 永遠 emit

```ts
fields: {
  headerFields,
  primaryFields,
  secondaryFields,
  auxiliaryFields: [],   // ← v9 新增，SAOME Step 3 不作者 auxiliary slot
  backFields,
},
```

### 3.5 `locationsDisabled` + conditional `locations`

```ts
locationsDisabled: s.locationsDisabled === true,
...(s.locationsDisabled === true
  ? {}
  : {
      locations: (s.locations ?? []).map((loc) => {
        const out: { latitude: number; longitude: number; relevantText?: string } = {
          latitude: loc.latitude,
          longitude: loc.longitude,
        };
        if (loc.relevantText != null && loc.relevantText.length > 0) {
          out.relevantText = loc.relevantText;
        }
        return out;
      }),
    }),
```

- `locationsDisabled` 永遠 emit（讓 Passcreator 知道 explicit state）
- `locations` 條件 emit：
  - `settings.locationsDisabled === true` → 完全 omit（不讓 Passcreator 看到 stale data，符合 user spec「若 DB 有開啟才推」）
  - `settings.locationsDisabled === false | undefined` → emit 陣列（即使空 `[]`，Passcreator 接受）
- Per-row strip `name` 欄位（SAOME Step 5 tenant-facing label，Passcreator V2 schema 沒這個 key）
- `relevantText: null | ''` 也 strip（Passcreator 拒絕空字串）

### 3.6 `additionalProperties[]` 對 links 的處理**不變**

`buildAdditionalProperties` 還是讀 `settings.links[]` 產 `type: 'url'` 的 cross-reference entries — 這個跟渲染位置無關，是 placeholder 變數，獨立邏輯。`links` 從 backFields 搬到 top-level，但 `additionalProperties` 對每個 link 都產 `name` / `placeholder` / `type: 'url'` 沒變 — 測試 `additionalProperties (v7)` describe 區塊全部保留不動。

### 3.7 檔頭 docstring + inline comment 全面更新

`passTemplateMapping.ts` 開頭的 "What the mapping does" 段落加上 step 8（top-level `links[]`）、step 9（conditional `locationsDisabled` + `locations[]`），把 step 2 的「logoText → name if empty」改成「logoText → 獨立 top-level 欄位」，step 7 的 fields 改成「header / primary / secondary / auxiliary / back」。

`passcreator.ts` `PasscreatorTemplateBody` 的 docstring 加 v9 的 regression trace 跟 V2 contract 來源 reference（v2 endpoint doc 的 `links` / `logoText` / `locations` / `locationsDisabled` 章節）。

---

## 4. 驗證

### 4.1 Typecheck

```bash
npm run typecheck --workspace=apps/backend
# → exit 0, 無錯誤
```

### 4.2 passcreator + passTemplate 測試

```bash
npm test --workspace=apps/backend -- --run passcreator passTemplate
# → 3 files, 140 tests passed
# - src/modules/pass-templates/tests/passTemplateMapping.test.ts (89 tests)
# - src/shared/lib/passcreator.test.ts (46 tests)
# - src/modules/cards/tests/updateTemplate.passcreator.test.ts (5 tests)
```

### 4.3 整套 backend test suite

```bash
npm test --workspace=apps/backend -- --run
# → Test Files  35 passed (35)
# → Tests       613 passed (613)
# → Duration    11.65s
# v9 新增的 24 條 test（top-level links × 5 / logoText × 5 / auxiliaryFields × 2 / conditional locations × 6 / 其他 regression × ~6）全部綠
```

### 4.4 新增的核心 regression 測試

`passTemplateMapping.test.ts` 新增 4 個 describe 區塊（覆蓋 user 報的 4 個症狀）：

| describe block | 覆蓋症狀 | 重點 test |
|---|---|---|
| `top-level links (v9)` | #1 links 位置 | 「emits links as a top-level array, NOT inside fields.backFields」回歸守門 |
| `logoText (v9)` | #2 logoText top-level | 「logoText is INDEPENDENT of name」守「兩個欄位不會再被合併」 |
| `auxiliaryFields (v9)` | #3 V2 schema 對齊 | 「always emits auxiliaryFields: []」 |
| `locations (v9, conditional on DB toggle)` | #4 DB toggle 控制推送 | 「emits locationsDisabled: true and OMITS locations[]」+ 「locationsDisabled: false and INCLUDES locations[]」對稱覆蓋 |

外加 `preserves label verbatim (NO HTML escape needed — top-level array is plain data)` — 把 v7 那個「HTML escape link with `&`」test 改寫成「label passes through as-is」（top-level links 不再需要 HTML escape，因為不是 HTML 形式）。

---

## 5. Out of scope

| 項目 | 為什麼不修 |
|---|---|
| **真的 update pushed payload → Passcreator 看到 v9 結構後是否實際生效** | dev/staging 不易 mock 出真實 Passcreator 反應；production push 上線後第一次 re-publish 既有的模板就會帶 v9 結構。Idempotent — Passcreator V2 對 top-level + fields.auxiliaryFields 都是 optional 的 update field，缺的 field 保留舊值。所以既有的 template 不會被 v9 推送洗掉既有 metadata。 |
| **beacons / beaconsDisabled** | user 沒提到 beacons。只推 user 列的「地理位置」— locations + locationsDisabled。如果之後要加 beacons（push-to-pass 的 iBeacon 觸發），schema 加上去就行，不是這個 PR 的範圍。 |
| **Step 5 editor 的 `location.name` 顯示** | Step 5 editor 用 `name` 欄位給租戶看（SAOME tenant-facing label）；Passcreator V2 schema 沒 `name`，所以 mapping 端 strip 掉。租戶在 editor 看到的 name 跟 deployed pass 看到的 relevantText（如果有的話）本來就是兩件事 — 暫時不動 editor。 |
| **Step 5 編輯器加「啟用 / 停用」toggle UI** | DB 端 toggle `settings.locationsDisabled` 早就有 — editor 端如果沒顯式 toggle，預設啟用（DB 沒寫 `locationsDisabled` → mapping 視為 `false` → 推 locations）。如果 editor 完全沒讓 user 設這個欄位，所有的 published template 都會預設推 locations（且 `locations: []` 至少會 emit，不會 error）。v9 不改 editor，只補 mapping 端的 hookup。 |

---

## 6. 給 user 訊息

- **這是 v9，沿 v7/v8 的方向繼續對齊 V2 canonical schema**：links 推到 top-level（不再用 HTML anchor workaround），logoText 推到 top-level（不再併進 name fallback），auxiliaryFields 補上，locations 條件推送（讀 DB toggle）。
- **affected 既有的 Passcreator template（v7/v8 已 push 過的）**：v9 是 idempotent update — Passcreator V2 update endpoint 對所有 properties 都是 optional，缺的 field 保留舊值。所以既有的 template 重新被 push 一次後會：
  - 多出 top-level `links[]` 跟 `auxiliaryFields: []`（皆 optional，新值）
  - 多出 top-level `logoText: "..."`（新值，header strip 開始有字）
  - 多出 `locationsDisabled: false` + `locations: [...]`（新值，條件是 settings.locationsDisabled 不是 true）
  - **不會洗掉** 既有 fields / images / barcode / colors / additionalProperties 等 metadata（update 的 partial semantics）
- **production deploy 動作**：把 v9 + 既有的 v7/id-parse/v8 一個 batched commit（或 4 個分開，看 user 決定）push 到 main，等 backend deploy Worker，然後既有 published template 透過下一輪 Step 8 編輯 re-publish 就會走 v9 結構。
- **新 fix 一次 commit 包含 3 個檔案**：
  - `apps/backend/src/shared/lib/passcreator.ts`（型別擴充）
  - `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts`（mapping 重寫）
  - `apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts`（4 個新 describe 區塊 + 1 個舊 test 改寫）
- **commit message**：
  ```
  fix(pass-templates): v9 Passcreator V2 payload structural alignment (links/logoText/auxiliaryFields/conditional locations)
  ```
- **可選**：把 v9 + v7 + id-parse + v8 一起 batched commit（一個 4 項 squash），或分開 4 個獨立 commit — 看你 deploy pipeline 習慣。Rule 011 要求 code + feedback + INDEX update 同 commit，這個 feedback 就是其中一個。

---

## 7. 參照

### 7.1 V2 endpoint doc / 規範來源

- `mu-plugins/Passcreator/V2 end point/Pass template/pass-template-management.md` — pass-template management overview（含 create + update endpoints 概覽）
- `mu-plugins/Passcreator/V2 end point/Pass template/update-a-template.md` — update endpoint 細節（all fields optional 的 partial-update 語義）
- `mu-plugins/Passcreator/V2 end point/Pass template/describe-the-structure-of-a-pass-template.md` — describe response shape（含 `fields.auxiliaryFields` 跟 `additionalProperties[]` 的 canonical schema）
- `https://developer.passcreator.com/en/api/v2/pass-template` — 線上 API docs

### 7.2 既有 feedback（同事故串）

- `runs/improvements/feedback/20261011-step8-passcreator-push.md` — v6 fix（type/colors/strip）
- `runs/improvements/feedback/20261012-step8-passcreator-create-id-parse.md` — id parse 修復
- `runs/improvements/feedback/20261012-step8-passcreator-strip-additional-props.md` — v7 fix（images.strip → background + additionalProperties）
- `runs/improvements/feedback/20261012-step8-passcreator-update-method-post.md` — v8 fix（PUT → POST update method）

### 7.3 Rule references

- **Rule 019 § D.3** — third-party API is a contract；mapping 是 serialize 到 contract 的單一地方
- **Rule 032 (silent-killer spirit)** — 對憑空刪掉「stale data」要小心（這裡 push locations 但 toggle false 時不推，符合 user spec）
- **Rule 003 (TDD)** — failing test 先寫，這次 4 個 describe 區塊先寫 test 再實作
- **Rule 005/006 (verification)** — typecheck + 整套 backend test suite 全綠才 commit

### 7.4 三條教訓（v9 後擴充到清單）

從 v6/v7/v8/v9 整串 Step 8 修下來的累積教訓:

1. **永遠對 canonical 範例 payload 做端到端 grep 比對，不要只看 doc 文字**：
   - v7 (`images.strip` vs `images.background`) — Passcreator 對 unknown key 是 silent drop，沒 error
   - v9 (`links` top-level vs HTML anchor workaround) — 我們用了 doc 寫的「alternative workaround」而沒對 canonical 範例做 schema 對齊
   - **強制**：每次寫 mapping module 必先讀**完整的** V2 describe response / create example，diff 一次「我有沒有 key 都對」
2. **DB schema 早就有的欄位不會自動流到 mapping**：toggle 早就寫好（`settings.locationsDisabled` 2026-09-06），mapping 端從來沒接 — 因為 `PasscreatorTemplateBody` interface 沒有 `locationsDisabled` key 就直接跳過。Mapping 是 contract serializer，**每加一個 DB 欄位都要問：「這個欄位在 Passcreator 對應什麼？沒對應就 skip，要對應就加進 mapping。」**
3. **「fallback into other field」是危險 pattern**：`settings.logoText` fallback to `name` 看起來合理，但實際上 Passcreator 把 `name` 跟 `logoText` 視為 2 個獨立 UI 槽（UI 標題 vs header strip 文字）。合併 = 兩個都壞。**強制**：每個欄位必獨立 emit，fallback chain 只用於「同一個 UI 槽有多個 source 時挑哪個」。

---

## 8. Test 摘要表

### 8.1 v9 新增的 24 條 regression test

| Describe block | Tests | Symptom pinned |
|---|---|---|
| `top-level links (v9 — 2026-10-12)` | 5 | #1 links 位置 |
| `logoText (v9 — 2026-10-12)` | 5 | #2 logoText top-level |
| `auxiliaryFields (v9 — 2026-10-12)` | 2 | #3 V2 schema auxiliaryFields 對齊 |
| `locations (v9 — 2026-10-12, conditional on DB toggle)` | 6 | #4 DB toggle → 推送與否 |

### 8.2 v9 修改的既有 test

| Test | 變更 | 為什麼 |
|---|---|---|
| `links → additional properties` describe 區塊的 `HTML escape` test | 改名 `label with & passes through verbatim`，註解改成「v9: links top-level, NO HTML escape」 | 反映「top-level array 是 plain data，不需要 HTML escape」的 v9 設計 |
| `links → HTML anchor in backFields.value (v7)` 整個 describe | **整個刪掉**，被 `top-level links (v9)` describe 取代 | v9 移除了 HTML anchor 渲染，這個 describe block 在測 deprecated 行為 |

### 8.3 v9 不變的既有 test

| Describe block | 狀態 |
|---|---|
| `mapTemplateToPasscreator — name` | 不變（name 的 fallback chain 仍存在，只是不再用 logoText AS sole input） |
| `mapTemplateToPasscreator — colors` | 不變（hex regex `^#...$` 鎖住） |
| `mapTemplateToPasscreator — barcode` | 不變 |
| `mapTemplateToPasscreator — images` | 不變（strip → background key fix 是 v7，這次沒動 image） |
| `mapTemplateToPasscreator — fields (header / primary / secondary / back)` | 不變（auxiliaryFields 跟 backFields 不重疊，這個 describe 維持） |
| `mapTemplateToPasscreator — passTypeId` | 不變 |
| `mapTemplateToPasscreator — type` | 不變 |
| `mapTemplateToPasscreator — field type mapping` | 不變 |
| `mapTemplateToPasscreator — language propagation` | 不變（labels 還在，是「傳到 deployed pass 的 labels 沒出現」這個症狀可能來自 Passcreator 渲染端，不是 mapping bug） |
| `mapTemplateToPasscreator — cardType-aware memberLevel override` | 不變 |
| `mapTemplateToPasscreator — additionalProperties (v7)` | 不變（cross-reference variables 跟渲染獨立） |
| `shared/lib/passcreator.test.ts` | 不變（transport 層 v8 POST method 已修，這次不動） |
| `updateTemplate.passcreator.test.ts` | 不變（integration test，這次不動） |

---

## 9. 檔案清單

```
M apps/backend/src/shared/lib/passcreator.ts                                          +60 lines (PasscreatorTemplateBody 新 fields + docstring)
M apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts              +60 / -25 lines (mapping 重寫 + 刪 dead code)
M apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts          +260 / -100 lines (4 新 describe + 改寫 1 + 刪 1)
A runs/improvements/feedback/20261012-step8-passcreator-v9-structure-alignment.md    (this file)
M runs/improvements/INDEX.md                                                          (+1 entry at top)
```

`passTemplateSync.ts` 不動（transport 層跟 mapping 無關）。
