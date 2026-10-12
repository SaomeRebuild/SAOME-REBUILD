# Plan：Passcreator V2 mapping — `images.strip` 改名 + 補 `additionalProperties`

> **任務等級**：L2 Standard（修改既有 mapping 邏輯 + 補測試，不跨模組、不破壞 wire-format 既有相容性）
> **日期**：2026-10-12
> **對齊**：`.cursor/rules/006-verification.mdc`（完工驗證）、`.cursor/rules/011-dev.mdc`（commit 規範）、`.cursor/rules/019-schema-contract-drift.mdc`（contract 對齊）
> **根因文件**：`runs/improvements/feedback/20261011-step8-passcreator-push.md`（v6 修復後的 follow-up）

---

## 1. 背景與問題

### 1.1 2026-10-11 v6 已修完的東西

`runs/improvements/feedback/20261011-step8-passcreator-push.md` + 2026-10-12 `data.identifier` 解析修完後，SAOME 後端已能**端到端把模板推上 Passcreator V2**：

- 401 / 400 / 5xx 都正確轉成 `BadGatewayError` + V2 envelope 的 per-field error 列表
- `data.identifier` 解析正確（regression fix 2026-10-12，見 `runs/improvements/feedback/20261012-step8-passcreator-create-id-parse.md`）
- `colors`、`barcode`、`fields.*[].type` 全部通過 Passcreator regex 與 contract 驗證

### 1.2 v6 還沒修完的 3 個 SAOME 端問題

| # | 問題 | 是否在這次 plan 處理 |
|---|---|---|
| **1** | **Strip image 沒被上傳**。`mapTemplateToPasscreator` 寫的 key 是 `images.strip`，但 Passcreator V2 的 describe endpoint 回應、舊 mu-plugins 的 `SAOME-Passcreator-Engine/modules/passcreator-template.php`、以及 V2 docs 都用 `images.background` 作為 strip slot 的 key。Passcreator 看到 `images.strip` 會 silently 忽略，SAOME 端以為「推上去了」其實 strip 沒帶。 | **是**（A） |
| **2** | **Additional properties 完全沒推**。`PasscreatorTemplateBody` interface 沒有 `additionalProperties` 欄位，`mapTemplateToPasscreator` 也從來沒產出這個欄位。User 2026-10-12 確認：additional properties 是「user 取名、free-form」，要把 `settings.backFields` 跟 `settings.links` 推上去，value 才能在 pass 其他地方用 `{Name}` placeholder cross-reference。 | **是**（B） |
| **3** | **很多 field 標籤沒推 + membership card 的 primary fields 是空**。這**不是 mapping bug**——是 user 還沒在 Step 3 選 leftField/rightField，導致 `primaryFields / secondaryFields` 是空 array（by design）。A 跟 B 修完後，user 一旦選 leftField 標籤就會正常推。 | 否（inform user 而已） |

> **3 號問題的判斷依據**：`mapTemplateToPasscreator` 內 primaryFields / secondaryFields 的邏輯已經正確讀 `settings.leftField` / `settings.rightField`，當 user 沒選時送空 array。Passcreator 接受空 primary/secondary，視為「未設定」並用 pass-type default layout。**不修**，但要在回應 user 時明講「空 primaryFields 是 by design，user 沒選 leftField」。

---

## 2. Fix scope（2 個改動，6 個 file edit）

| 改動 | 影響檔案 | 動作 |
|---|---|---|
| **A.** `images.strip` → `images.background` | `apps/backend/src/shared/lib/passcreator.ts`（interface 改名）<br>`apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts`（IIFE 內的 key 改名）<br>`apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts`（4 處 assertion 改 key + 描述更新） | 1 + 1 + 1 = 3 個 file edit |
| **B.** 新增 `additionalProperties` 陣列 | `apps/backend/src/shared/lib/passcreator.ts`（新增 type + interface 擴充）<br>`apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts`（新增 helper + 從 top-level mapping 呼叫）<br>`apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts`（新增 describe block × 9 條 test） | 1 + 1 + 1 = 3 個 file edit |

**總計 6 個 file edit，0 個新檔案，0 個 migration，0 個 shared schema 變更。**

---

## 3. 改動 A：`images.strip` → `images.background`

### 3.1 為什麼 key 是 `background` 不是 `strip`

| 證據來源 | 結論 |
|---|---|
| [Passcreator V2 docs](https://developer.passcreator.com/en/api/v2/pass-template) | V2 用 `images.background` 表 strip image（Apple Wallet convention 的「pass 上的大橫幅圖」） |
| `mu-plugins/Passcreator/V2 end point/Pass template/describe-the-structure-of-a-pass-template.md` line 106 | V2 describe endpoint 回應也用 `background`（不是 `strip`）|
| `mu-plugins/SAOME-Passcreator-Engine/modules/passcreator-template.php` line 405 | 舊 mu-plugins 推的 key 也是 `background`（user 切換到新 backend 後 strip 從此消失） |
| `passTemplateMapping.ts` 內的 `r2KeyToPublicUrl(..., imageType: 'background')` | R2 proxy 的 URL path segment 已經是 `background`（2026-10-12 修的）—— body key 也對齊就好 |

> 結論：`background` 才是 V2 對的 key，SAOME 從 v4 一路沿用 `strip` 是個延續舊習慣的 bug。

### 3.2 `passcreator.ts` 改動（`PasscreatorTemplateBody.images` 區段）

**現況**：

```ts
  /**
   * Image references.
   *
   * `icon` is REQUIRED by Passcreator V2 in practice — when the value
   * is `''` (empty string), Passcreator tries to download the empty
   * URL and returns
   *   `errors[].images.icon = 'The given icon  could not be downloaded.'`
   *
   * When the SAOME template has no icon uploaded, the mapping OMITS
   * the `icon` key entirely (rather than sending `''`) so Passcreator
   * falls back to the pass-type default icon.
   *
   * `logo` and `strip` are optional — omitted when missing.
   */
  images: {
    icon?: string;
    logo?: string;
    strip?: string;
  };
```

**改成**：

```ts
  /**
   * Image references.
   *
   * `icon` is REQUIRED by Passcreator V2 in practice — when the value
   * is `''` (empty string), Passcreator tries to download the empty
   * URL and returns
   *   `errors[].images.icon = 'The given icon  could not be downloaded.'`
   *
   * When the SAOME template has no icon uploaded, the mapping OMITS
   * the `icon` key entirely (rather than sending `''`) so Passcreator
   * falls back to the pass-type default icon.
   *
   * `logo` and `background` are optional — omitted when missing.
   *
   * Note on `background` (2026-10-12 v7 fix): Passcreator V2's
   * `images.background` is what Apple Wallet conventionally calls
   * the "strip image" (the wide horizontal image above the primary
   * fields). The SAOME mapping used to send `images.strip` (a v4-era
   * holdover; the old mu-plugins `SAOME-Passcreator-Engine` predates
   * the V2 API rename and the new backend inherited the wrong key).
   * Passcreator V2 silently ignores `images.strip` — the field never
   * reaches Apple Wallet. The key in the request body is now
   * `background`; the R2 proxy route
   * (`/api/pass-templates/:id/background`) was already aligned on
   * 2026-10-12.
   */
  images: {
    icon?: string;
    logo?: string;
    background?: string;
  };
```

**Diff 概念**：

- 把 `logo and strip are optional` 改為 `logo and background are optional`
- `strip?: string;` 改為 `background?: string;`
- 在 JSDoc 補一段 `Note on background (2026-10-12 v7 fix)` 解釋 rename 原因（保留 SAOME 對「strip image」這個 user-facing 概念的 intent，換成 V2 的 key）

### 3.3 `passTemplateMapping.ts` 改動（IIFE 內 images 區段）

**現況**（images IIFE）：

```ts
    images: (() => {
      // Build image URLs via the public R2 proxy at
      // `/api/pass-templates/:id/:type` (regression fix 2026-10-12).
      // The previous `${r2PublicUrl}/${r2Key}` pattern had no matching
      // route and Passcreator rejected with
      //   `errors[].images.icon = 'The given icon ... could not be downloaded.'`
      // The public route validates the tenant owns the image and
      // streams from R2 with the right Content-Type.
      const out: Record<string, string> = {};
      const iconUrl = r2KeyToPublicUrl(s.iconImage, r2PublicUrl, template.id, 'icon');
      const logoUrl = r2KeyToPublicUrl(s.issuerLogo, r2PublicUrl, template.id, 'logo');
      const stripUrl = r2KeyToPublicUrl(s.backgroundImage, r2PublicUrl, template.id, 'background');
      if (iconUrl) out.icon = iconUrl;
      if (logoUrl) out.logo = logoUrl;
      if (stripUrl) out.strip = stripUrl;
      return out;
    })(),
```

**改成**：

```ts
    images: (() => {
      // Build image URLs via the public R2 proxy at
      // `/api/pass-templates/:id/:type` (regression fix 2026-10-12).
      // The previous `${r2PublicUrl}/${r2Key}` pattern had no matching
      // route and Passcreator rejected with
      //   `errors[].images.icon = 'The given icon ... could not be downloaded.'`
      // The public route validates the tenant owns the image and
      // streams from R2 with the right Content-Type.
      //
      // 2026-10-12 v7: the body key for the strip image is now
      // `background` (not `strip`). Passcreator V2's `images.background`
      // is the strip slot per Apple Wallet convention. The R2 proxy
      // route segment was already `background` since the 2026-10-12
      // fix; only the body key needs to follow. `r2KeyToPublicUrl`'s
      // third arg is still `'background'` — the URL path doesn't
      // change, only the request-body key.
      const out: Record<string, string> = {};
      const iconUrl = r2KeyToPublicUrl(s.iconImage, r2PublicUrl, template.id, 'icon');
      const logoUrl = r2KeyToPublicUrl(s.issuerLogo, r2PublicUrl, template.id, 'logo');
      const backgroundUrl = r2KeyToPublicUrl(s.backgroundImage, r2PublicUrl, template.id, 'background');
      if (iconUrl) out.icon = iconUrl;
      if (logoUrl) out.logo = logoUrl;
      if (backgroundUrl) out.background = backgroundUrl;
      return out;
    })(),
```

**Diff 概念**：

- `const stripUrl = ...` 改為 `const backgroundUrl = ...`（變數名跟 body key 對齊，可讀性）
- `if (stripUrl) out.strip = stripUrl;` 改為 `if (backgroundUrl) out.background = backgroundUrl;`
- 補 inline JSDoc 段落解釋 v7 rename

**Top-level JSDoc**（「What the mapping does」§ 8）也要對應補一句：

> § 8. Builds `images` from `settings.issuerLogo / iconImage / backgroundImage` etc. The strip image is sent as `images.background` (Passcreator V2's key for Apple Wallet's strip slot; was `strip` in v4 — rename fix 2026-10-12). When the value is an R2 key, we convert it to the public R2 URL.

### 3.4 `passTemplateMapping.test.ts` 改動（4 處改 key，描述更新）

**需要改的 assertion**：

| 位置 | 現況 | 改成 |
|---|---|---|
| `images` describe 內（`body.images.strip` 1 處） | `expect(body.images.strip).toBe(...)` | `expect(body.images.background).toBe(...)` |
| `images` describe 內（`not.toHaveProperty('strip')` 2 處） | `expect(body.images).not.toHaveProperty('strip');` | `expect(body.images).not.toHaveProperty('background');` |
| `images` describe 內（regex match 1 處） | `expect(body.images.strip).toMatch(/...background$/);` | `expect(body.images.background).toMatch(/...background$/);`（regex 不用改，URL 還是 `.../background`）|

**描述 / JSDoc 更新**（把 `strip` 這個字眼換成更精準的說法，避免 reviewer 誤會）：

| 位置 | 現況 | 改成 |
|---|---|---|
| `fields` describe 開頭的 JSDoc | `// header / primary / secondary / back slots + strip + logo` | `// header / primary / secondary / back slots + strip image (sent as background) + logo` |

**不需要改的**：

- `imageType: 'background'` 在 `r2KeyToPublicUrl` 的型別定義——URL path segment 沒變
- `stripHexHash` / `no longer strips` 等講 hex 顏色的 JSDoc（與 image 無關）
- 任何講 "strip image" 概念的 user-facing JSDoc——保留（Apple Wallet convention 仍稱 strip image，只是 Passcreator V2 的 wire-format key 是 `background`）

---

## 4. 改動 B：新增 `additionalProperties` 陣列

### 4.1 Passcreator `additionalProperties` schema（節錄自 V2 docs）

> 來源：[Passcreator V2 docs — Pass template](https://developer.passcreator.com/en/api/v2/pass-template) + `mu-plugins/Passcreator/V2 end point/Pass template/update-a-template.md` line 110-114 / 150-157

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `id` | integer | 由 Passcreator 在 create 時指派 | SAOME 不送（Passcreator 自己編） |
| `name` | string | ✅ | user-facing 變數名；placeholder 用 `{name}` cross-reference |
| `type` | enum | ✅ | `text` / `textarea` / `url` / `number` / `select` / `checkbox` / `radiobutton` |
| `required` | boolean | ❌（default false）| pass-issuance 時是否必填 |
| `hidden` | boolean | ❌（default false）| 是否從 pass UI 隱藏（仍可 placeholder 引用）|
| `placeholder` | string | ❌ | cross-reference token；default 是 `{name}` |
| `options` | string[] | 只給 `select` / `checkbox` / `radiobutton` | 選項清單 |

> Webhook 端（`mu-plugins/Passcreator/webhooks/Appscan Hooks/app-scan-created.md`）的 `additionalPropertiesPass` 是 name-keyed map——證明 `name` 真的是 cross-reference key（key 是 string，不是 id）。

### 4.2 `passcreator.ts` 改動

**新增 type**（放在 `PasscreatorTemplateBody` 之前）：

```ts
/**
 * Passcreator `additionalProperty` schema — V2 (`update-a-template.md` line 110-114).
 *
 * Each property is a user-named, free-form variable that can be
 * referenced elsewhere on the pass via Passcreator's `{Name}` placeholder
 * syntax. SAOME pushes one entry per `settings.backFields` row
 * (type: 'text') and one per `settings.links` row (type: 'url').
 *
 * Field semantics:
 *   - `name` is the user-facing identifier. Passcreator's placeholder
 *     syntax is literally `{name}` — so the rendered cross-reference
 *     for a property named "Phone" is `{Phone}`.
 *   - `placeholder` defaults to `{name}`. We always set it explicitly
 *     so the wire format is grep-friendly (test fixtures can assert
 *     the exact string, not rely on Passcreator's default).
 *   - `required` is FALSE for SAOME back fields and links — they're
 *     advisory labels, not blocking inputs at issuance time. Per-pass
 *     issuance (deferred, see JSDoc in `passTemplateMapping.ts`) can
 *     override this if a future flow needs it.
 *   - `hidden` is FALSE — the value IS shown on the back of the pass.
 *   - `options` is ONLY for `select` / `checkbox` / `radiobutton`. SAOME
 *     currently only pushes `text` and `url`, so `options` is always
 *     `undefined` in our push.
 */
export interface PasscreatorAdditionalProperty {
  /** User-facing name (free-form per Passcreator docs). */
  name: string;
  /** Auto-generated placeholder token for cross-references (e.g. '{Phone}'). */
  placeholder: string;
  /** Passcreator-supported input type. */
  type: 'text' | 'textarea' | 'url' | 'number' | 'select' | 'checkbox' | 'radiobutton';
  /** Whether the property must be supplied at pass-issuance time. */
  required: boolean;
  /** Whether the property is hidden from the pass UI (still queryable via placeholder). */
  hidden: boolean;
  /** Only meaningful for select / checkbox / radiobutton types. */
  options?: string[];
}
```

**擴充 `PasscreatorTemplateBody` interface**（在 `images` block 後、`fields` block 前）：

```ts
  /**
   * Additional properties — user-named, free-form variables that the
   * pass can reference via `{Name}` placeholders elsewhere
   * (e.g. in `fields.primaryFields[].value`).
   *
   * SAOME pushes one entry per `settings.backFields` row
   * (type: 'text') and one per `settings.links` row (type: 'url').
   * The mapping helper `buildAdditionalProperties` is the single
   * source of truth for derivation rules (see `passTemplateMapping.ts`).
   *
   * This field is OPTIONAL in the contract — legacy test fixtures
   * that don't push `additionalProperties` still type-check
   * (Passcreator also accepts its absence). Empty array is allowed;
   * Passcreator treats it as "no extra properties defined".
   *
   * @see update-a-template.md § additionalProperties (line 110-114)
   * @see https://developer.passcreator.com/en/api/v2/pass-template
   */
  additionalProperties?: PasscreatorAdditionalProperty[];
```

### 4.3 `passTemplateMapping.ts` 改動

**新增兩個 helper**（放在既有 `mapFieldType` 之後、`buildFieldRows` 之前）：

```ts
/**
 * Slugify a string into a safe `name` for `additionalProperties[]`.
 *
 * Rules:
 *   - Trim leading / trailing whitespace.
 *   - Collapse internal whitespace runs to a single underscore.
 *   - Drop any character that is not `[A-Za-z0-9_]` (Passcreator's
 *     `name` validator accepts the slug form; raw Chinese / emoji
 *     would be silently rejected or render as a placeholder that
 *     can't be cross-referenced via `{...}` reliably).
 *   - Cap at 30 chars (Passcreator's `name` field has a 50-char
 *     cap; we leave 20 chars of headroom for any future prefix /
 *     suffix the mapping might add).
 *   - Empty result → return empty string (caller decides whether to
 *     skip the row entirely).
 *
 * Why this exists: `settings.backFields` / `settings.links` can
 * have a user-typed label that's a long sentence ("Contact us at
 * hello@example.com for inquiries"). Without slugification, that
 * becomes the `name` verbatim, the `{...}` placeholder token is
 * unreadable, and Passcreator may reject the long string. We don't
 * translate the label (the user typed it; cross-reference keys
 * must be the literal string), but we DO ensure the name is a
 * safe token.
 */
function slugifyName(input: string): string {
  const collapsed = input.trim().replace(/\s+/g, '_');
  const safe = collapsed.replace(/[^A-Za-z0-9_]/g, '');
  return safe.slice(0, 30);
}

/**
 * Build the `additionalProperties` array from `settings.backFields`
 * and `settings.links`.
 *
 * Derivation rules (user 2026-10-12 directive + V2 docs):
 *
 *   **backFields** (Step 4 free-form user input):
 *     - Skip row if BOTH label AND value are empty (or whitespace-
 *       only; Passcreator rejects empty `name` with
 *       `'The property name is required'`).
 *     - `name` = label (trimmed), or `slugifyName(value)` if label
 *       is empty but value is present.
 *     - `placeholder` = `{name}` (Passcreator's documented cross-
 *       reference syntax).
 *     - `type` = `'text'`.
 *     - `required` = false, `hidden` = false.
 *
 *   **links** (Step 4 `[{label, value}]` where value is a URL):
 *     - Same skip rules.
 *     - `name` = label (trimmed), or `link_to_<host>` if label is
 *       empty (e.g. `'https://cafe.example.com/'` →
 *       `link_to_cafe_example_com`).
 *     - `placeholder` = `{name}`.
 *     - `type` = `'url'`.
 *     - `required` = false, `hidden` = false.
 *
 *   The HTML-wrapped form of a link (an `<a href="...">label</a>`
 *   anchor that Apple Wallet renders as a tappable link) is NOT
 *   stored in `additionalProperties` — it's stored in
 *   `fields.backFields[].value` (the actual rendered text on the
 *   back of the pass). `additionalProperties` is the variable
 *   store; the rendered text lives where Apple Wallet actually
 *   looks. See § "Open decisions" below for the rationale.
 *
 *   **Order**: backFields first, then links. Predictable, no
 *   surprises in Passcreator's editor.
 *
 *   **Cap**: `settings.links` is capped at 4 (Passcreator accepts
 *   up to 4 dedicated links). Overflow is silently dropped with a
 *   `console.warn` so the user sees the message in `wrangler tail`
 *   but the push still succeeds. Same convention as the v6 fix's
 *   `images.icon` omit-when-empty.
 *
 *   **Empty result**: returns `[]`. Never returns `undefined` —
 *   the top-level mapping always sends the key (empty array is
 *   greppable; undefined is invisible in logs).
 */
const MAX_LINKS = 4;

function buildAdditionalProperties(args: {
  backFields: TemplatesRow['settings']['backFields'];
  links: TemplatesRow['settings']['links'];
}): PasscreatorAdditionalProperty[] {
  const out: PasscreatorAdditionalProperty[] = [];

  // backFields → text properties
  for (const row of args.backFields ?? []) {
    const labelTrim = (row.label ?? '').trim();
    const valueTrim = (row.value ?? '').trim();
    if (!labelTrim && !valueTrim) continue; // skip fully empty rows
    const name = labelTrim || slugifyName(valueTrim);
    if (!name) continue; // slugify returned empty (e.g. value was all non-ASCII)
    out.push({
      name,
      placeholder: `{${name}}`,
      type: 'text',
      required: false,
      hidden: false,
    });
  }

  // links → url properties (capped at 4)
  const links = args.links ?? [];
  for (let i = 0; i < links.length; i++) {
    if (i >= MAX_LINKS) {
      console.warn(
        `[passTemplateMapping] settings.links has ${links.length} entries; capping at ${MAX_LINKS} (Passcreator accepts max 4 dedicated links).`,
      );
      break;
    }
    const row = links[i]!;
    const labelTrim = (row.label ?? '').trim();
    const valueTrim = (row.value ?? '').trim();
    if (!labelTrim && !valueTrim) continue;
    let name = labelTrim;
    if (!name) {
      // Derive from URL host: `https://cafe.example.com/` → `cafe_example_com`.
      // Strip protocol, drop path/query, slugify the host.
      const host = valueTrim.replace(/^https?:\/\//i, '').split('/')[0] ?? '';
      name = `link_to_${slugifyName(host)}`;
    }
    if (!name) continue;
    out.push({
      name,
      placeholder: `{${name}}`,
      type: 'url',
      required: false,
      hidden: false,
    });
  }

  return out;
}
```

**Top-level mapping 改動**（在 return 物件的 `fields: { ... }` 後面加 `additionalProperties` 屬性）：

```ts
  return {
    passTypeId: args.passTypeId ?? 'pass.saome.org.passcreator',
    type: 'storeCard',
    name,
    description: s.description ?? '',
    organizationName: s.issuerName ?? '',
    colors: { ... },
    barcode: { ... },
    images: (() => { ... })(),
    fields: {
      headerFields,
      primaryFields,
      secondaryFields,
      backFields,
    },
    /**
     * Additional properties — derived from backFields (text) and
     * links (url). See `buildAdditionalProperties` for the full
     * derivation rules. May be an empty array; Passcreator accepts
     * it as "no extra properties defined".
     *
     * 2026-10-12 v7 fix: previously this field was missing entirely,
     * so values couldn't be cross-referenced via `{Name}` placeholders
     * elsewhere on the pass.
     */
    additionalProperties: buildAdditionalProperties({
      backFields: s.backFields ?? [],
      links: s.links ?? [],
    }),
  };
```

> **為什麼不 import 一個新的 `PasscreatorAdditionalProperty` 進 top-level mapping**：helper 已經 return 正確型別（隱含推導），top-level 不需要 explicit annotation。`PasscreatorTemplateBody.additionalProperties` 的型別在 `passcreator.ts` 已經定義好。但 helper 內的 return type 仍然 explicit 標，方便 reviewer 看到契約。

**Top-level JSDoc**（「What the mapping does」§ 9 補一段）：

> § 9. Builds `additionalProperties` from `settings.backFields` (text) and `settings.links` (url, capped at 4). See `buildAdditionalProperties` for derivation rules. Each entry's `name` is the user's typed label (or a slug fallback); `placeholder` is `{name}`; `type` is `'text'` for back fields, `'url'` for links. The HTML-wrapped link form (the rendered anchor on the back of the pass) is NOT in `additionalProperties` — it goes into `fields.backFields[].value` so Apple Wallet actually renders it.

**「What the mapping does NOT do」** 保持不變——`additionalProperties` 推送不是 deferred，是這次新增。

### 4.4 `passTemplateMapping.test.ts` 改動

**新增 describe block**（放在檔案最後，新 describe 直接 append）：

```ts
/**
 * 2026-10-12 v7 — `additionalProperties` push.
 *
 * Verifies the mapping helper `buildAdditionalProperties` (defined in
 * `passTemplateMapping.ts`) correctly derives Passcreator's
 * `additionalProperties[]` array from `settings.backFields` and
 * `settings.links`.
 *
 * Pin contract:
 *   - backFields with non-empty label → 1 entry, type='text', name=label.
 *   - backFields with empty label but non-empty value → 1 entry, name
 *     = slug of value's first 30 chars.
 *   - backFields with BOTH empty (or whitespace-only) → SKIPPED.
 *   - links with non-empty label → 1 entry, type='url', name=label.
 *   - links capped at 4 (overflow silently dropped with console.warn).
 *   - Empty result → `[]` (never `undefined`; wire-format consistency).
 *   - HTML-wrapped link form is in `fields.backFields[].value` (not
 *     in `additionalProperties[].name` / `placeholder`) — this is the
 *     design decision called out in the plan.
 */
describe('mapTemplateToPasscreator — additionalProperties (v7 — 2026-10-12)', () => {
  it('backFields → 2 text properties (name = label, placeholder = {name})', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.additionalProperties).toEqual([
      { name: '聯絡電話', placeholder: '{聯絡電話}', type: 'text', required: false, hidden: false },
      { name: '官方網站', placeholder: '{官方網站}', type: 'text', required: false, hidden: false },
    ]);
  });

  it('links → 2 url properties (name = label, placeholder = {name}, type = url)', () => {
    const row = makeRow();
    row.settings.links = [
      { label: '官方網站', value: 'https://cafe.example.com' },
      { label: '粉絲專頁', value: 'https://fb.com/cafe' },
    ];
    const body = mapTemplateToPasscreator({ template: row, language: 'zh-TW', r2PublicUrl: R2_URL });
    expect(body.additionalProperties).toEqual([
      { name: '官方網站', placeholder: '{官方網站}', type: 'url', required: false, hidden: false },
      { name: '粉絲專頁', placeholder: '{粉絲專頁}', type: 'url', required: false, hidden: false },
    ]);
  });

  it('empty label falls back to value-derived slug (first 30 chars, slugified)', () => {
    const row = makeRow();
    row.settings.backFields = [
      { label: '', value: 'Contact us at hello@example.com for inquiries' },
    ];
    row.settings.links = [];
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    // slugify: trim → collapse whitespace → drop non-[A-Za-z0-9_] → slice(0, 30).
    // 'Contact us at hello@example.com for inquiries'
    //   → 'Contact_us_at_helloexamplecom_for_inquiries'
    //   → slice(0, 30): 'Contact_us_at_helloexamplecom'
    // (The `@` and `.` are dropped by the [^A-Za-z0-9_] filter.)
    expect(body.additionalProperties?.[0]?.name).toBe('Contact_us_at_helloexamplecom');
    expect(body.additionalProperties?.[0]?.placeholder).toBe('{Contact_us_at_helloexamplecom}');
  });

  it('both label and value empty → row is skipped (no entry in array)', () => {
    const row = makeRow();
    row.settings.backFields = [
      { label: 'OK 1', value: 'value 1' },
      { label: '', value: '' },         // ← skip
      { label: '   ', value: '   ' },   // ← skip (whitespace trims to empty)
      { label: 'OK 2', value: 'value 2' },
    ];
    row.settings.links = [];
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.additionalProperties).toHaveLength(2);
    expect(body.additionalProperties?.map((p) => p.name)).toEqual(['OK 1', 'OK 2']);
  });

  it('empty settings.backFields + empty settings.links → empty additionalProperties array (never undefined)', () => {
    const row = makeRow();
    row.settings.backFields = [];
    row.settings.links = [];
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.additionalProperties).toEqual([]);
    // Wire-format consistency: always present (not undefined).
    expect('additionalProperties' in body).toBe(true);
  });

  it('links capped at 4 (Passcreator accepts max 4 dedicated links) — overflow silently dropped', () => {
    const row = makeRow();
    row.settings.backFields = [];
    row.settings.links = [
      { label: 'L1', value: 'https://l1.example.com' },
      { label: 'L2', value: 'https://l2.example.com' },
      { label: 'L3', value: 'https://l3.example.com' },
      { label: 'L4', value: 'https://l4.example.com' },
      { label: 'L5', value: 'https://l5.example.com' }, // ← dropped
      { label: 'L6', value: 'https://l6.example.com' }, // ← dropped
    ];
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
      expect(body.additionalProperties).toHaveLength(4);
      expect(body.additionalProperties?.map((p) => p.name)).toEqual(['L1', 'L2', 'L3', 'L4']);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('capping at 4'),
      );
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });

  it('HTML-wrapped link form goes into fields.backFields[].value (NOT additionalProperties[].name/placeholder) — design decision', () => {
    // Pin the design decision called out in § 5.1:
    //   - additionalProperties: clean name + placeholder (no HTML).
    //   - fields.backFields: HTML-wrapped form appended as a row
    //     so Apple Wallet renders a single ordered list.
    const row = makeRow();
    row.settings.links = [
      { label: '官方網站', value: 'https://cafe.example.com' },
    ];
    const body = mapTemplateToPasscreator({ template: row, language: 'zh-TW', r2PublicUrl: R2_URL });
    // additionalProperties: clean name + placeholder (no HTML).
    expect(body.additionalProperties?.[0]?.name).toBe('官方網站');
    expect(body.additionalProperties?.[0]?.placeholder).toBe('{官方網站}');
    expect(body.additionalProperties?.[0]?.type).toBe('url');
    // fields.backFields: HTML-wrapped form appended as a row.
    const linkRow = body.fields.backFields.find(
      (b) => b.value.startsWith('<a href='),
    );
    expect(linkRow?.value).toBe('<a href="https://cafe.example.com">官方網站</a>');
  });

  it('HTML escape: link with value containing & and " produces HTML-attr-escaped anchor in fields.backFields[].value', () => {
    const row = makeRow();
    row.settings.links = [
      { label: 'Search "A&B"', value: 'https://example.com/?a=1&b=2&q="x"' },
    ];
    row.settings.backFields = [];
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    const linkRow = body.fields.backFields.find((b) => b.value.startsWith('<a href='));
    // & → &amp;, " → &quot; in both href and label (defense-in-depth
    // so the anchor doesn't break surrounding HTML).
    expect(linkRow?.value).toBe(
      '<a href="https://example.com/?a=1&amp;b=2&amp;q=&quot;x&quot;">Search &quot;A&amp;B&quot;</a>',
    );
    // additionalProperties carries the un-escaped label form (it's
    // a cross-reference key, not rendered HTML).
    expect(body.additionalProperties?.[0]?.name).toBe('Search "A&B"');
    expect(body.additionalProperties?.[0]?.type).toBe('url');
  });

  it('back field label "電話" + zh-TW language passes through as the name (no translation — user typed it)', () => {
    // Regression guard: the mapping does NOT translate additionalProperty
    // names. The user's typed label IS the cross-reference key
    // (because passcreator's `{Name}` placeholder syntax is a literal
    // string match, not a translated lookup).
    const row = makeRow();
    row.settings.backFields = [{ label: '電話', value: '+886-2-1234-5678' }];
    row.settings.links = [];
    const body = mapTemplateToPasscreator({ template: row, language: 'zh-TW', r2PublicUrl: R2_URL });
    expect(body.additionalProperties?.[0]?.name).toBe('電話');
    expect(body.additionalProperties?.[0]?.placeholder).toBe('{電話}');
  });
});
```

**注意**：`makeRow()` helper 本身**不**改（會動到既有所有 mapping tests）。新 describe 內的 test 透過 `row.settings.backFields = [...]` 跟 `row.settings.links = [...]` override per-test 即可。

> `settings.links` 在 `TemplatesRow` 的型別是 `Array<{label: string; value: string}>`，可從既有 `passTemplateMapping.ts` 的 `s.links` 引用鏈看到。

---

## 5. 開放決策（請 user 確認後再實作）

### 5.1 HTML-wrap 的 link 應該放哪裡

User 在 2026-10-12 說：**「link 那邊的 value，要包成 html 再推出」**。

Passcreator 的 `additionalProperties[]` 有 `name` 跟 `placeholder` 兩個欄位，**HTML 包哪一個都怪**：

| 方案 | 結果 |
|---|---|
| 把 HTML 放 `name` | name 是 cross-reference key，放 HTML 後 `{<a href=...>label</a>}` 變成無效 placeholder token |
| 把 HTML 放 `placeholder` | placeholder 是 token 模板，塞 HTML 違反語意，且 render 端會 double-encode |
| **把 HTML 放 `fields.backFields[].value`（✅ 推薦）** | `additionalProperties[]` 純做 variable store（`name` + `type` + cross-reference 資訊），實際 render 在 `fields.backFields[].value`。HTML 塞這邊符合 Apple Wallet 對 link 的 render 慣例 |

**Default decision**：HTML-wrap 放 `fields.backFields[].value`（append 一個新 row），`additionalProperties[]` 保持純 variable store。

> 反對方案：全部塞 `name`（HTML 跟 variable name 同一個欄位）— User 跟 reviewer 都會被搞瘋。

### 5.2 4-link cap

Passcreator 接受最多 4 條 dedicated link。User 沒明確講，但 SAOME Step 4 editor UI 已經 cap 在 4 條。

| 方案 | 結果 |
|---|---|
| 不 cap，讓 Passcreator reject | Editor UI 不會暴露問題，user 在 Step 8 才看到 banner，fail |
| **cap 在 4 + 靜默丟棄 overflow（✅ 推薦）** | 跟 v6 `images.icon` omit-when-empty 一致，user experience 最 smooth |

**Default decision**：`MAX_LINKS = 4`，overflow `console.warn` 但不 throw。

### 5.3 名字推導 fallback

User typed label 是首選；若 label 空白但 value 有內容，要不要從 value 推 name？

| 方案 | 結果 |
|---|---|
| 跳過整個 row | 失去「user 只想填 value」的 use case（雖然罕見） |
| **從 value 推導 name（✅ 推薦）** | 把 value 做 slug（去特殊字元 + 限 30 chars），非空就當 name |

**Default decision**：`slugifyName(value)` fallback，value 推不出 name 才 skip。

### 5.4 empty array 還是不送 `additionalProperties`？

| 方案 | 結果 |
|---|---|
| 不送 | 當 `backFields` + `links` 都空時，wire format 沒有 `additionalProperties` key。Passcreator 接受（treat as empty）。但 unit test 斷言 `body.additionalProperties === undefined` 不好寫 |
| **送空 array（✅ 推薦）** | wire format 一致，vitest 斷言容易，debug 友善（每個 push 都看得到 `additionalProperties: []`） |

**Default decision**：永遠送 `additionalProperties`（可能是 `[]`）。

---

## 6. Verification steps

執行順序（依 `.cursor/rules/006-verification.mdc`）：

1. `npm run typecheck --workspace=apps/backend` — 必須 exit 0
2. `npm test --workspace=apps/backend -- passTemplateMapping` — 新的 additionalProperties describe + 改過的 images describe + 其他 describes 必須全綠
3. `npm run lint --workspace=apps/backend` — 必須 exit 0
4. Optional：`npm test --workspace=apps/backend` — 跑全部 backend tests 確認沒有 regression

**預期測試數**（以實際 `vitest run --reporter=verbose` 為準）：

- 改動前：mapping tests 既有 describes 全綠
- 改動後：mapping tests 既有 describes 全綠 + 9 條新 additionalProperties describe 全綠
- 全 backend 跑完：原本 N 條 + 9 條新 = N + 9 條全綠

> 用 `npm test --workspace=apps/backend -- passTemplateMapping --reporter=verbose` 抓實際通過數字。

---

## 7. Out of scope（明確不做）

- `membershipTiers / rewardTiers / cashbackTiers` → `functionality.tiers` mapping（User 沒要求）
- `description → description`：已經 mapped，沒變
- `locations`：不在 current body，不是 regression，User 沒提
- Per-pass value injection at issuance time（已在 mapping 的 existing JSDoc 標 deferred）
- Strip image 的 URL path（已經是 `background`，不是這次 work 的範圍）
- `images.icon` / `images.logo` 的 key（沒變動，本來就是對的）
- CORS / Worker runtime / migration（Rule 035 不適用，沒新增 DB column）

---

## 8. 參考文件

| 文件 | 用途 |
|---|---|
| [mu-plugins\Passcreator\V2 end point\Pass template\update-a-template.md](../../mu-plugins/Passcreator/V2%20end%20point/Pass%20template/update-a-template.md) | 定義 `additionalProperties[].id / name / type / required / hidden`（line 110-114, 150-157） |
| [mu-plugins\Passcreator\V2 end point\Pass template\describe-the-structure-of-a-pass-template.md](../../mu-plugins/Passcreator/V2%20end%20point/Pass%20template/describe-the-structure-of-a-pass-template.md) | 定義 `images.background` 為 strip 槽位（line 106）、line 54 列 `additionalProperties` 為 data model 欄位 |
| [mu-plugins\Passcreator\V2 end point\Pass template\pass-template-management.md](../../mu-plugins/Passcreator/V2%20end%20point/Pass%20template/pass-template-management.md) | 完整 request body shape reference |
| [mu-plugins\Passcreator\V2 end point\Pass template\patch-a-template.md](../../mu-plugins/Passcreator/V2%20end%20point/Pass%20template/patch-a-template.md) | 定義 `additionalProperties[].id / name / type`（line 101-104） |
| [mu-plugins\Passcreator\webhooks\Appscan Hooks\app-scan-created.md](../../mu-plugins/Passcreator/webhooks/Appscan%20Hooks/app-scan-created.md) | 定義 `additionalPropertiesPass` 為 name-keyed map |
| [mu-plugins\SAOME-Passcreator-Engine\modules\passcreator-template.php line 405](../../mu-plugins/SAOME-Passcreator-Engine/modules/passcreator-template.php) | 舊 SAOME Engine 用 `images.background` 推 strip image |
| [mu-plugins\SAOME-Passcreator-Engine\modules\passcreator-template.php line 217-225](../../mu-plugins/SAOME-Passcreator-Engine/modules/passcreator-template.php) | 舊 SAOME Engine 推 `additionalProperties` 形狀（`{name, type, required, hidden}`） |
| [runs/improvements/feedback/20261011-step8-passcreator-push.md](../improvements/feedback/20261011-step8-passcreator-push.md) | v6 修復 context |
| [runs/improvements/feedback/20261012-step8-passcreator-create-id-parse.md](../improvements/feedback/20261012-step8-passcreator-create-id-parse.md) | 2026-10-12 response id-parse fix |
| [Passcreator V2 docs](https://developer.passcreator.com/en/api/v2/pass-template) | 完整 schema reference |

---

## 9. Commit 計畫

單一 commit：

```
fix(pass-templates): rename images.strip → images.background + push additionalProperties

- 2026-10-12 v7 follow-up to Step 8 Passcreator push
- Rename body.images.strip → body.images.background (Passcreator V2 key;
  old mu-plugins Passcreator Engine used 'background' too)
- Add additionalProperties derived from settings.backFields (type: text)
  and settings.links (type: url, capped at 4), so values are referenceable
  via {Name} placeholder in pass field values
- HTML-wrap link values into fields.backFields[].value (Apple Wallet
  renders anchors as tappable links)
- 9 new tests for buildAdditionalProperties; 4 updated assertions for
  images key rename

Verification (per .cursor/rules/006-verification.mdc):
- typecheck: exit 0
- lint: exit 0
- test: passTemplateMapping — all green (existing + 9 new)
- full backend: N + 9 tests pass

Refs: runs/improvements/feedback/20261011-step8-passcreator-push.md
Sync: https://github.com/SaomeRebuild/SAOME-REBUILD commit <pending>
Self-improvement: <link to runs/improvements/feedback/20261012-step8-passcreator-mapping-v7.md once written>
```

Self-improvement 段落會在實作完後，把這次 root cause + 修法 trace 進 `runs/improvements/feedback/20261012-step8-passcreator-mapping-v7.md`。

---

## 10. Plan complete?

Is the plan complete?
