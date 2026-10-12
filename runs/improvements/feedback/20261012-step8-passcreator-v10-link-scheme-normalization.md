# 2026-10-12 Step 8 v10 fix — Passcreator `links[]` URL scheme 自動正規化

> **對應 commits**: 本次 fix 還未 commit（待 user 驗證後 commit — 跟 v6/v7/id-parse/v8/v9 一起 batched 還是分開待 user 決定）
> **根因**: `mapTemplateToPasscreator` 把 `settings.links[].value` 原封不動推給 Passcreator，但 Apple Wallet / Google Wallet 必須靠 URL scheme 分派（`mailto:` / `tel:` / `https://`），user 在 Step 4 打的純 email 或純電話沒前綴就被 Passcreator V2 reject。
>
> **日期**: 2026-10-12
> **類型**: bug fix（L2 Standard — Step 8 push 鏈的後續，same family as v6/v7/v8/v9）
> **對齊**:
>   - `runs/improvements/feedback/20261011-step8-passcreator-push.md` (v6 fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-create-id-parse.md` (id parse fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-strip-additional-props.md` (v7 fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-update-method-post.md` (v8 fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-v9-structure-alignment.md` (v9 fix — 把 `links` 搬回 top-level)

---

## 1. 症狀

User 2026-10-12 在 v9 修完後回報：

> 「link的值沒有包裹html 所以我們要定義: 網址(網站或whatsapp連結，可是這個本來就是html可以直接用) 郵箱(mailto) 電話(tel:) 或之類可以包裹的資料怎麼推上去」

具體症狀：

| user 在 Step 4 打的 value | v9 推上去的 value | Passcreator V2 結果 |
|---|---|---|
| `https://cafe.com`（網站）| `https://cafe.com` | ✓ OK — Apple Wallet 開 Safari |
| `https://wa.me/88691234567`（WhatsApp）| `https://wa.me/88691234567` | ✓ OK — Apple Wallet 開 Safari / WhatsApp app |
| `info@cafe.com`（email）| `info@cafe.com` | ✗ 400 — Passcreator 認為這不是合法 URL |
| `+886-2-1234-5678`（電話）| `+886-2-1234-5678` | ✗ 400 — 同上 |
| `tel:+886-...`（user 知道 URI scheme）| `tel:+886-...` | ✓ OK |
| `mailto:foo@bar.com`（同上）| `mailto:foo@bar.com` | ✓ OK |

**核心問題**: 99% 的 tenant 在 Step 4 輸入 contact info 時不會主動打 `mailto:` / `tel:` 前綴（這是 developer-mind 習慣），v9 的 passthrough 邏輯直接 reject 這類輸入。

---

## 2. 根因

v9 把 `links` 從 `fields.backFields[]` 內的 `<a href>` HTML anchor 搬到 **top-level `links[]` array**（對齊 V2 canonical schema），但 **沒處理 URL scheme 自動補上前綴**：

```typescript
// v9 寫法 — passthrough only
links: (s.links ?? [])
  .filter((row) => Boolean(row.value && row.value.trim().length > 0))
  .slice(0, MAX_PASS_LINKS)
  .map((row) => ({ label: row.label, value: row.value })),
```

`links[].value` 推到 Passcreator 後，Apple Wallet / Google Wallet 會 **依 scheme 分派**：

| Scheme | Apple Wallet 行為 |
|---|---|
| `https://` / `http://` | 開 Safari / Google Chrome |
| `mailto:` | 開 Mail app（Compose 新郵件）|
| `tel:` | 開 Phone app（撥號 UI）|
| `sms:` | 開 Messages |
| `geo:` | 開 Maps |
| `https://wa.me/...` | 開 Safari / WhatsApp app |
| `https://chat.whatsapp.com/...` | 開 Safari / WhatsApp app |

**沒前綴的 `info@cafe.com` 不是合法 URL** — Passcreator V2 schema 會回 400，整個 template push 失敗，使用者看到「Passcreator sync failed」banner。

### 為什麼 user 之前的「fallback into other field」pattern 失效（教訓串到 v9）

v6 修了一個類似的根因：把 `settings.logoText` 合併進 `name` 的 fallback chain，看起來「有傳」但其實 Apple Wallet 的 `logoText` 欄位沒被 emit。v10 是同 pattern 的另一個變體 — **canonical 欄位有 emit（top-level `links[]` 對齊），但 value 的格式沒對齊 Passcreator 的 contract**（需要 scheme 前綴）。

教訓：**永遠對 canonical V2 describe response / example payload 做端到端 grep 比對**。`links[]` 的 value 格式（要 scheme 前綴）就是 V2 describe response 裡 example `tel:004989123456789` 暗示的，但 v9 只看了「array 在 top-level」沒看「value 要帶 scheme」。

---

## 3. 修法

### 3.1 新 helper `normalizeLinkUrl(value)` — 純函數，可單元測試

```typescript
/**
 * Normalize a link value to a valid URL string for Passcreator V2.
 *
 * Detection order:
 *   1. Already has scheme (RFC 3986: ^[a-z][a-z0-9+\-.]*:) → keep as-is
 *   2. Looks like email (local@domain.tld) → prefix mailto:
 *   3. Looks like phone (>= 7 digits, only digits/+/spaces/dashes/parens)
 *      → prefix tel:
 *   4. Otherwise → return null (caller drops the row)
 *
 * Pure function. Unit-tested.
 */
export function normalizeLinkUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v.length === 0) return null;

  if (/^[a-z][a-z0-9+\-.]*:/i.test(v)) return v;          // scheme already there
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;  // email
  const strippedPhone = v.replace(/[\s\-()]/g, '');
  if (/^[\d+]+$/.test(strippedPhone)) {
    const digitCount = (strippedPhone.match(/\d/g) ?? []).length;
    if (digitCount >= 7) return `tel:${v}`;
  }
  return null;
}
```

### 3.2 `links[]` mapping 用 helper

```typescript
links: (s.links ?? [])
  .flatMap((row): { label: string; value: string }[] => {
    const normalized = normalizeLinkUrl(row.value);
    return normalized ? [{ label: row.label, value: normalized }] : [];
  })
  .slice(0, MAX_PASS_LINKS),
```

### 3.3 `additionalProperties[]` 也用同樣 normalization（保持一致）

避免 `{Name}` placeholder 指向一個根本沒被 push 的 URL。`buildAdditionalProperties` 內的 link filter 從 `Boolean(row.value && row.value.trim().length > 0)` 改成 `normalizeLinkUrl(row.value) !== null`：

```typescript
const links = (args.links ?? []).filter((row) => normalizeLinkUrl(row.value) !== null);
```

### 3.4 為什麼不「全部都接受 `example.com` 就 prefix `https://`」

保守策略：
- `example.com` → 是 URL 還是 description 文字？user 可能打 `Visit our store.example.com booth` 之類
- `Hello World` → 不是 URL
- `1234` → 是電話分機還是數字描述？
- 寬鬆 prefix 會把 description 文字誤判成 URL，Passcreator 一樣 reject

**嚴格檢測**比寬鬆 prefix 安全。User 想 push URL 就自己打 scheme（或是我們 helper 自動 detect 補上）。

---

## 4. 驗證

```
npm run typecheck --workspace=apps/backend
→ exit 0

npm test --workspace=apps/backend -- --run
→ 654/654 passed (35 test files)
→ +41 new tests for v10 (31 helper unit + 10 integration)
```

### 4.1 New tests pinned (passTemplateMapping.test.ts)

**`normalizeLinkUrl` describe block** — 31 tests covering:

| Branch | Tests |
|---|---|
| 已帶 scheme（kept verbatim）| 11 條 — `https://` / `http://` / `wa.me` / `api.whatsapp.com` / `chat.whatsapp.com` / `tel:` / `mailto:` / `sms:` / `geo:` / case-insensitive / trim |
| Email 自動加 `mailto:` | 4 條 — 純 email / 子域名 / plus addressing / 含 dot 的 local part |
| Phone 自動加 `tel:` | 6 條 — `+886-...` / `02-1234-5678` / `0912345678` / `0800-...` / `+1 (555) 123-4567` / 保留原始格式 |
| Rejected（return `null`）| 10 條 — empty / whitespace / undefined / null / 模糊文字 (`example.com`) / 短電話 (< 7 digits) / 隨機中文 / email 沒 TLD / 含空白 / 含字母的電話 |

**`mapTemplateToPasscreator — link URL normalization (v10 — 2026-10-12)` describe block** — 10 integration tests:

- email 自動 wrap `mailto:`
- phone 自動 wrap `tel:`
- https URL 不動
- WhatsApp URL 不動
- 混合 4 種 link type 全部正確
- 已帶 scheme 的不 double-prefix
- 無效 URL 被 drop（empty / garbage / too-short / no-scheme-no-pattern）
- 中文 label passthrough
- 與 language setting 無關（en / zh-TW 一致）
- 無效 link row 同時從 `additionalProperties[]` drop（保持 placeholder set 與 pushed URL set 一致）

### 4.2 既有 93 tests 全綠

包含 v9 留下的 5 條 top-level links tests + v7 留下的 6 條 additionalProperties tests — 沒 regression。

---

## 5. Production impact

### 5.1 Idempotent update

Passcreator V2 update endpoint 對每個 property 都 optional。對既有 template 重 push 一次：
- **好處**: 舊 template 自動帶 v10 的 `mailto:` / `tel:` 前綴，使用者打 email/phone 不會壞了
- **沒風險**: 不會洗掉既有 fields / images / colors / barcode / additionalProperties

### 5.2 UX 改善

- Tenant 從此打 `info@cafe.com` 或 `+886-2-1234-5678` 就會自動 wrap 正確 protocol
- 仍接受「developer-mind」進階 user 自己打 `mailto:foo@bar.com` / `tel:+886-...`
- Ambiguous 文字（`Hello World` / `1234` / `example.com`）會 silently drop — 可在 console.warn 加 log（待 v11 觀察）

---

## 6. 累積教訓（串到 v6/v7/v8/v9）

### 教訓 1 — 永遠對 canonical V2 describe response 做端到端 grep 比對

v6 fix `images.strip` silent drop / v9 fix `links` 位置 / **v10 fix `links` value scheme** — 三個都是「canonical schema 對齊」的子問題。每一次只看局部（顏色 / 位置 / 形狀）就漏一個維度。完整比對需要：
- field 是否存在 ✓
- field 在哪個 layer（top-level vs nested）✓
- field 的 value 格式（scheme 前綴 / 顏色 regex / 圖片 URL pattern）← **v10 新增這條**

### 教訓 2 — DB schema 早就有的欄位不會自動流到 mapping

v9 fix `locations` / `locationsDisabled` 從來沒推 — DB 跟 shared schema 2026-09-06 就有 `locationsDisabled`，mapping 端到 2026-10-12 才接。**v10 不是這個 pattern**（email/phone 從 Step 1 就有），但仍是 DB schema drift 的提醒。

### 教訓 3 — 「fallback into other field」是危險 pattern

v9 修的 `logoText` 被合併進 `name` 的 fallback chain（v6-v8 的 bug）— 兩個獨立 V2 欄位看起來同源但 UI 槽不同。v10 不在這個 pattern，但 **「passthrough 給 upstream 不處理 protocol」是同個 anti-pattern 的另一面**：兩個看起來「同義」的輸入（email 字串 vs mailto: URL），mapping 端把它們視為等價，但 Passcreator 端拒絕無前綴的。

### 教訓 4（v10 新增）— 「使用者自然輸入」跟「upstream contract」之間一定有 normalization gap

任何「free-form text field」推給 strict schema 都要處理：value normalization / default value / error recovery。CardBuilder 的 Step 4 link row 就是典型案例 — user 不知道也不該知道 `mailto:` / `tel:` 這些 URI scheme，mapping 必須補上。

---

## 7. 待辦（未在 v10 範圍）

- **`console.warn` 加 log 觀察 silent-drop 案例**: 目前 `Hello World` / `1234` / `example.com` 會 silently drop。Production observability 應該 log 哪些 row 被 drop + 原因，方便 v11 評估要不要放寬 detection rule。
- **DB 欄位是否要加 `linkKind: 'url' | 'email' | 'phone' | 'custom'`?**: 讓 user 明確指定比 auto-detect 更 robust，但需要 DB migration + Step 4 UI 改版。建議先觀察 silent-drop 的比例再決定。
- **WhatsApp 連結的 scheme 多樣性**: 目前只測 `wa.me` / `api.whatsapp.com` / `chat.whatsapp.com` 三種。實務可能有 `web.whatsapp.com` / `whatsapp://` 等。如果有 v11 production drop 案例再加。

---

## 8. Commits（待 user 決定）

目前 v10 是 uncommitted，跟 v6 / id-parse / v7 / v8 / v9 一起 batched 還是分開 commit 待 user 決定。Commit footer 應含：

- `Refs: runs/improvements/feedback/20261012-step8-passcreator-v10-link-scheme-normalization.md`
- `Sync: https://github.com/SaomeRebuild/SAOME-REBUILD commit <hash>`

---

## 9. Cross-references

- **v6 fix** (`feedback/20261011-step8-passcreator-push.md`) — colors regex `#` prefix
- **v7 fix** (`feedback/20261012-step8-passcreator-strip-additional-props.md`) — `images.background` slot + `additionalProperties[]`
- **v8 fix** (`feedback/20261012-step8-passcreator-update-method-post.md`) — POST verb (V2)
- **v9 fix** (`feedback/20261012-step8-passcreator-v9-structure-alignment.md`) — `links` top-level + `logoText` top-level + `auxiliaryFields` + conditional `locations`
- **Passcreator V2 docs**:
  - `mu-plugins/Passcreator/V2 end point/Pass template/pass-template-management.md`
  - `mu-plugins/Passcreator/V2 end point/Pass template/describe-the-structure-of-a-pass-template.md`
- **Code**:
  - `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` — `normalizeLinkUrl()` + `links[]` mapping
  - `apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts` — 41 new tests