# 2026-10-12 Step 8 v7 fix — strip image 重命名 + additional properties 推送

> **對應 commits**: 本次 fix 還未 commit（待 user 驗證後 commit）
> **根因**:
>   1. `mapTemplateToPasscreator` 推的 strip image key 是 `images.strip`，但 Passcreator V2 describe endpoint + 舊 mu-plugins SAOME-Passcreator-Engine 都用 `images.background`。
>   2. `PasscreatorTemplateBody` interface 缺 `additionalProperties` 欄位，mapping 從來沒產過，使用者填的 back fields / links 沒辦法在 pass 內 cross-reference。
> **日期**: 2026-10-12
> **類型**: bug fix (L2 Standard + critical chain 上的後續)
> **對齊**: `runs/improvements/feedback/20261011-step8-passcreator-push.md` (v6 fix) + `runs/improvements/feedback/20261012-step8-passcreator-create-id-parse.md` (id parse fix)

---

## 1. 症狀

Step 8 publish 在 2026-10-11 v6 修完後可成功把模板 push 到 Passcreator 並 parse `data.identifier` 回來，但 user 2026-10-12 早上回報 3 個 SAOME 端問題：

1. **strip 圖（卡面中段的 background 圖）沒被傳上去**：user 在 SAOME 編輯器上傳的背景圖，到 Passcreator 那邊看不到。
2. **很多欄位的標籤跟 Additional properties 都沒有被推出去**：user 在 Step 4 填的 back fields 標籤、Step 5 的 link URL，部署到 Passcreator 之後讀不到。
3. **會員卡的 Primary fields 跟 Additional properties 沒有被填上去**：membership card 的 primary 顯示欄位是空的，additional properties 也是空的。

---

## 2. 根因

### 2.1 Strip image: `images.strip` 不是 V2 的 key

SAOME 編輯器把 background 圖存在 `settings.backgroundImage` (R2 key)，mapping 寫到 body 裡是 `out.strip`：

```ts
// 修前 (v6 寫法)
const stripUrl = r2KeyToPublicUrl(s.backgroundImage, r2PublicUrl, template.id, 'background');
if (stripUrl) out.strip = stripUrl;
```

但 Passcreator V2 describe endpoint 的回傳範本結構是：

```json
"images": {
  "logo": null,
  "background": null,        ← strip 圖的 key 是 `background`，不是 `strip`
  "icon": "...",
  ...
}
```

交叉驗證來源：
- https://developer.passcreator.com/en/api/v2/pass-template describe response
- mu-plugins 舊系統 `SAOME-Passcreator-Engine/modules/passcreator-template.php`：
  ```php
  $images_data['background'] = $bg_url;   // ← 舊系統也是用 `background`
  ```
- mu-plugins 舊系統驗證端 `SAOME-Passcreator-Engine/modules/passcreator-stamp-card.php`：
  ```php
  $v_bg_img = (string)($v_images_data['backgroundImage'] ?? $v_images_data['background'] ?? 'not_found');
  ```

Passcreator 對 `images.strip` 是 **silent drop** — 沒 warning、沒 error、HTTP 200 OK。SAOME 端以為「推上去了」，實際上 strip 圖沒帶。

> 旁註：URL path segment `/api/pass-templates/:id/background` 已經對了（r2KeyToPublicUrl 第二個參數），所以 public R2 路由沒問題，純粹是 body 裡的 key 寫錯。

### 2.2 Additional properties: 整個沒實作

`PasscreatorTemplateBody` interface 沒有 `additionalProperties` 欄位。`mapTemplateToPasscreator` 從來沒產出過這個 array。

user 2026-10-12 引用官方解釋確認：
> Additional properties give you a way to store personalised data. You can but you don't have to show this data on the pass. E.g. you can ask for the users Email address and have it available later without showing it on the pass. All additional properties can be inserted by using them as placeholder anywhere on your pass (labels, change messages, field values, barcode etc.). E.g. if your additional property has the Name "First name", you can insert the first name in another field by typing {First name}.
> Additional properties 的命名是自由的，也就是我們可以為了這些標籤命名自己的Additional properties

也就是說 — 每個 user-typed label 都是一個 cross-reference 變數，可以在 pass 任何地方用 `{Name}` placeholder 引用。

SAOME 的 user input source data：
- `settings.backFields[]` (Step 4) — 自由 label/value
- `settings.links[]` (Step 5) — label/URL

這兩個 array 還沒被轉成 `additionalProperties`。

### 2.3 會員卡的 primary field 是空 — 不是 mapping bug

檢查 `mapTemplateToPasscreator` 的 primaryFields 邏輯：

```ts
const primaryFields = s.leftField
  ? [{ key: s.leftField, type: mapFieldType(s.leftField), label: getFieldLabel(s.leftField, language, template.card_type) ?? '', value: '' }]
  : [];
```

當 user 沒在 Step 3 選 leftField，`primaryFields` 是空 array（by design）。Passcreator 對空 primary/secondary 視為「未設定」並用 pass-type default layout。

user 認為「會員卡 primary field 沒被填」 — 因為他沒在 Step 3 選 leftField。這不是 mapping bug，是 by design。

**這部分在 commit message 跟 reply 給 user 時要明講：「空 primaryFields 是 by design — 一旦您選了 leftField 就會有值」**。

---

## 3. 修法

3 個檔案，scope 控制在 1 個 PR：

| 檔案 | 改動 |
|---|---|
| `apps/backend/src/shared/lib/passcreator.ts` | (a) `PasscreatorTemplateBody.images`: `strip?: string` → `background?: string`；(b) 新增 `PasscreatorAdditionalProperty` interface + body 的 `additionalProperties?` 欄位 |
| `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` | (a) `out.strip` → `out.background`；(b) 在 backFields 結尾 append 從 `settings.links` 產生的 HTML anchor rows；(c) 新增 `buildAdditionalProperties()` pure function + `derivePropertyName()` + `slugify()` + `escapeHtmlAttribute()` / `escapeHtmlText()` + `MAX_LINKS_IN_BACK_FIELDS` 常數；(d) top-level return 加 `additionalProperties:` 欄位 |
| `apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts` | (a) 4 個 `body.images.strip` 改成 `body.images.background` + 加 1 條 regression guard 「pushed key 是 `background`」；(b) 新增 8 條 `additionalProperties (v7 — 2026-10-12)` describe；(c) 新增 5 條 `links → HTML anchor in backFields.value` describe |

### 3.1 additionalProperties 設計決策

| 維度 | 決定 | 理由 |
|---|---|---|
| **資料源** | `settings.backFields[]` + `settings.links[]` | user 2026-10-12 明講「backFieds的標籤與值租戶寫好了，直接用就行了吧」 |
| **每 row → 1 entry** | 是 | 1 對 1 對應 user 預期（每個 back field label 就是一個可引用的變數） |
| **`type` 對 back field** | `'text'` | back field 自由文字 |
| **`type` 對 link** | `'url'` | link.value 是 URL |
| **`required`** | `false` | SAOME back fields / links 都是 advisory labels，不是 pass-issuance 時 blocking 的 input |
| **`hidden`** | `false` | value 確實會在 pass 背面顯示（不是只給 placeholder 用） |
| **`placeholder`** | `` `{${name}}` `` | Passcreator 官方 placeholder 語法 |
| **空 label fallback** | 從 value 前 30 字 derive slug | user 2026-10-12：「backFieds的Label非必填，所以有些租戶會留空不填」；Passcreator 拒絕空 name |
| **label + value 都空** | skip | Passcreator 拒絕空 name |
| **HTML 渲染** | link 渲染成 `<a href="URL">Label</a>` 塞進 `fields.backFields[].value` | user 2026-10-12：「link那邊的Value，要包成html再推出」；Passcreator 官方：「you can also use HTML links anywhere in your back fields instead of using these dedicated link fields」 |
| **HTML escape** | 5 chars (`& < > " '`) 都 escape | 防止 user-typed label 跟 URL 內的 `&` 破壞 attribute 結構 |
| **link 4-link cap** | 4 個 | Passcreator 接受 4 個 dedicated link；HTML link 技術上無上限但 cap 起來預覽/部署一致 |
| **空 URL link** | skip (back field 跟 additionalProperties 都不加) | `<a href="">label</a>` 沒意義 |

### 3.2 程式碼關鍵片段

```ts
// buildAdditionalProperties — 純函式, no I/O
export function buildAdditionalProperties(args: {
  backFields: TemplatesRow['settings']['backFields'];
  links: TemplatesRow['settings']['links'];
}): PasscreatorAdditionalProperty[] {
  const out: PasscreatorAdditionalProperty[] = [];

  // 1. backFields → type: 'text'
  for (const row of args.backFields ?? []) {
    const name = derivePropertyName(row.label, row.value);
    if (name === null) continue;
    out.push({ name, placeholder: `{${name}}`, type: 'text', required: false, hidden: false });
  }

  // 2. links → type: 'url', cap at 4
  const links = (args.links ?? []).filter((row) => Boolean(row.value?.trim()));
  if (links.length > MAX_LINKS_IN_BACK_FIELDS) {
    console.warn(`[passTemplateMapping] links count ${links.length} exceeds cap; overflow dropped.`);
  }
  for (const row of links.slice(0, MAX_LINKS_IN_BACK_FIELDS)) {
    const name = derivePropertyName(row.label, row.value);
    if (name === null) continue;
    out.push({ name, placeholder: `{${name}}`, type: 'url', required: false, hidden: false });
  }
  return out;
}
```

```ts
// backFields render:  user back fields + HTML-anchor-form links
const userBackFields = (s.backFields ?? []).map((row) => ({
  key: '',
  type: 'text' as const,
  label: row.label,
  value: row.value,
}));
const linkBackFields = (s.links ?? [])
  .filter((row) => Boolean(row.value?.trim()))
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
```

---

## 4. 驗證

```text
$ npm test --workspace=apps/backend -- --run passTemplateMapping
 Test Files  1 passed (1)
      Tests  76 passed (76)        ← 60 既有 + 16 新 v7 tests

$ npm test --workspace=apps/backend -- --run
 Test Files  35 passed (35)
      Tests  600 passed (600)      ← 沒 regression

$ npm run typecheck --workspace=apps/backend
> tsc --noEmit
(無 output, exit 0)
```

### 4.1 新增的 16 條 tests

- `images — pushed key is 'background', never 'strip'` (regression guard, 2026-10-12)
- `images` 既有 4 條全改用 `background` key
- `additionalProperties (v7 — 2026-10-12)`:
  1. backFields → additional properties (one entry per row)
  2. links → additional properties (type 'url')
  3. empty label but non-empty value → name derived from first 30 chars
  4. both label and value empty → row is skipped
  5. empty settings.backFields + empty settings.links → empty array
  6. HTML escape: `&` in URL is HTML-attr-escaped
  7. zh-TW label passes through as the property name
  8. links over the 4-link cap are silently dropped
- `links → HTML anchor in backFields.value (v7 — 2026-10-12)`:
  1. links render as `<a href="URL">Label</a>` rows in backFields
  2. HTML escape: `&` in URL becomes `&amp;`; `"` in label becomes `&quot;`
  3. HTML escape: `<` / `>` / `'` are also escaped
  4. empty link label falls back to the URL as the rendered text
  5. link is dropped from backFields when the URL is empty

---

## 5. Out of scope（這次 PR 沒做、user 沒要求）

- ❌ **自動從 `membershipTiers` / `rewardTiers` / `cashbackTiers` 取 tier 名稱當 additional properties**：user 訊息沒要求，且這會需要 cardType-aware 邏輯 + Passcreator `functionality.tiers` mapping（v3 follow-up 議題）
- ❌ **`functionality.type = 'loyalty_collect_points'` + `functionality.tiers` mapping**：Passcreator 完整結構有 `functionality` section（per describe response），但 SAOME 還沒設計 reward/stamp 的 functionality 對應。屬於功能/設計議題
- ❌ **per-pass value injection at issuance time**：mapping 既有 JSDoc 已標 deferred（"All three slots have `value: ''` at template time; the per-pass runtime injects the real member-row value"）
- ❌ **empty primaryFields 的自動 fallback**：user 沒選 leftField 時 primaryFields 是空 array 是 by design。一個 user 開了新的模板但忘了選 leftField 就不會看到 primary — 這是 UX 議題，不是 mapping bug

---

## 6. 給 user 的訊息（下次 deploy 後）

1. ✅ **strip 圖**：v7 fix 後 `images.background` 才是 Passcreator V2 的 key，舊的 `images.strip` 被 silent drop。redeploy 既有模板就會帶 strip 圖。
2. ✅ **欄位標籤**：v7 fix 後 `additionalProperties` 從 backFields + links 推上去，每個 user-typed label 都會是一個可被 `{Name}` 跨欄位引用的變數。
3. ℹ️ **membership card primary field 是空**：這是 by design — 一旦您在 Step 3 選了 leftField（例如 memberLevel / phone / email），primaryFields 就會帶值。如果想讓 membership card 在 Passcreator 端自動帶 tier 名稱，需要新增 tier → primary field 的 mapping（屬於 v3+ 議題）。
4. ℹ️ **links 的 value 在 pass 背面會渲染成 HTML 連結**：例如 `https://cafe.example.com` 變成 `<a href="https://cafe.example.com">官方網站</a>`，這是 Passcreator 官方支援的「HTML links anywhere in your back fields」機制。

---

## 7. 參照

- 根因 1 — strip image 重命名:
  - https://developer.passcreator.com/en/api/v2/pass-template (describe response 範本)
  - `mu-plugins/SAOME-Passcreator-Engine/modules/passcreator-template.php:404-406` (舊 SAOME 的 `images.background` payload)
  - `mu-plugins/SAOME-Passcreator-Engine/modules/passcreator-stamp-card.php:351` (舊 SAOME 讀 `images.background` / `images.backgroundImage`)
  - `mu-plugins/Passcreator/V2 end point/Pass template/describe-the-structure-of-a-pass-template.md` (V2 docs — `images.*` schema)
- 根因 2 — additional properties schema:
  - `mu-plugins/Passcreator/V2 end point/Pass template/update-a-template.md` (additionalProperties[].id/name/type/required)
  - https://developer.passcreator.com/en/api/v2/pass-template describe response (additionalProperties 完整 schema 含 `placeholder` / `hidden` / `options`)
  - `mu-plugins/Passcreator/webhooks/Appscan Hooks/app-scan-created.md:42-43` (additionalPropertiesPass 是 ID-keyed map)
  - user 2026-10-12 引用官方解釋
- 前置修復:
  - `runs/improvements/feedback/20261011-step8-passcreator-push.md` (v6 fix — colors / type / fields)
  - `runs/improvements/feedback/20261012-step8-passcreator-create-id-parse.md` (data.identifier parse fix)
- 程式碼:
  - `apps/backend/src/shared/lib/passcreator.ts` (interface)
  - `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` (mapping)
  - `apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts` (tests)
