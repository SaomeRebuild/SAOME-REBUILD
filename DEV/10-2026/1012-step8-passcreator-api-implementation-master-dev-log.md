# 2026-10-12 — Step 8 Passcreator API 完整 push 鏈 master DEV LOG

> 給未來 trace 整條「CardBuilder Step 8 → Passcreator V2」push 鏈的人 single entry point。本檔**不重述每個 commit 的細節**——所有根因 + 修法都在對應 feedback 裡；本檔負責**架構全景 + 12 輪迭代的設計 invariant + 跨檔案的 pattern 提醒**。
>
> 對齊同類型 master DEV LOG：[`1006-step8-save-and-library-real-data-wiring-master-dev-log.md`](./1006-step8-save-and-library-real-data-wiring-master-dev-log.md)（Step 8 上半段：UI + 模板庫 + 真實資料 wiring）。

## 一句話總結

把 CardBuilder Step 8「儲存並發布」的 Passcreator V2 push 鏈從「首次 200 OK 但 deployed pass 欄位是空」一路打撈到「11 條 wire-format bug + 1 條 refactor 全部 fix 完，1024 tests 全綠」。**scope = 12 個 iteration（v4 → v12-followup）+ 25 個檔案 + 1,873+ 行變更**。

## 12 輪迭代時間軸

| 輪 | 日期 | 一句話 |
|---|---|---|
| **v4** | 10-11 | 8-phase 完整 push 鏈首次上線：migration、transport、mapping、sync、frontend banner |
| **v5** | 10-11 | `headerFields[0]` 是 per-cardType 固定 slot（不是 Step 3 dropdown 推）|
| **v6** | 10-11 | colors regex 必帶 `#` prefix + per-cardType memberLevel 欄位型別 |
| **id-parse** | 10-12 | template id 從 `data.identifier` 讀（V2 envelope），不是 top-level `id`（V1）|
| **v7** | 10-12 | `images.strip` → `images.background` 重命名 + `additionalProperties[]` 推送 |
| **v8** | 10-12 | V2 update 是 `POST`，不是 `PUT`（V1 是 PUT，v4 誤用）|
| **v9** | 10-12 | `links` top-level + `logoText` top-level + `auxiliaryFields: []` + conditional `locations` |
| **v10** | 10-12 | `links[].value` 自動加 `mailto:` / `tel:` / `https://` scheme |
| **v11** | 10-12 | slot value 改 `{KeyName}` cross-reference（不是 `''`）|
| **v12** | 10-12 | `mapFieldType` 19-case switch 改 data-driven 查表（machine-checked drift guard）|
| **v12-followup** | 10-12 | `primaryFields` 改為 Apple Wallet 慣例：membership_card 強制 emit `memberName`、左右欄位都進 `secondaryFields`；移除 `additionalProperties` 對 `backFields` 的污染鏡像 |

每一輪的完整根因 / 修法 / test count / 教訓見對應 feedback：

| 輪 | feedback 檔 |
|---|---|
| v4 | [feedback/20261011-step8-passcreator-push.md](../improvements/feedback/20261011-step8-passcreator-push.md) § v4 section |
| v5 | [feedback/20261011-step8-passcreator-push.md](../improvements/feedback/20261011-step8-passcreator-push.md) § v5 follow-up section |
| v6 | [feedback/20261011-step8-passcreator-push.md](../improvements/feedback/20261011-step8-passcreator-push.md) § v6 follow-up section |
| id-parse | [feedback/20261012-step8-passcreator-create-id-parse.md](../improvements/feedback/20261012-step8-passcreator-create-id-parse.md) |
| v7 | [feedback/20261012-step8-passcreator-strip-additional-props.md](../improvements/feedback/20261012-step8-passcreator-strip-additional-props.md) |
| v8 | [feedback/20261012-step8-passcreator-update-method-post.md](../improvements/feedback/20261012-step8-passcreator-update-method-post.md) |
| v9 | [feedback/20261012-step8-passcreator-v9-structure-alignment.md](../improvements/feedback/20261012-step8-passcreator-v9-structure-alignment.md) |
| v10 | [feedback/20261012-step8-passcreator-v10-link-scheme-normalization.md](../improvements/feedback/20261012-step8-passcreator-v10-link-scheme-normalization.md) |
| v11 | [feedback/20261012-step8-passcreator-v11-cross-reference-fields.md](../improvements/feedback/20261012-step8-passcreator-v11-cross-reference-fields.md) |
| v12 | [feedback/20261012-step8-passcreator-v12-data-driven-mapfieldtype.md](../improvements/feedback/20261012-step8-passcreator-v12-data-driven-mapfieldtype.md) |
| v12-followup | [feedback/20261012-step8-passcreator-v12-followup-primary-secondary.md](../improvements/feedback/20261012-step8-passcreator-v12-followup-primary-secondary.md) |

## 架構全景（v12 最終定版）

```
Step 8 "儲存並發布" click
    ↓
useStep8Save (apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step8Save/Step8Save.hooks.ts)
    │ i18n.t() 觸發 publish
    │ on error code === 'BAD_GATEWAY' && details.upstream === 'passcreator' → Step8SaveErrorBanner
    │ on other error → sonner toast
    ↓ HTTP PUT /api/cards/:id { status: 'published' }
backend updateTemplateService
    │ DB write 之前先做 Passcreator push（Phase 3 翻轉）
    │ Push 失敗 throw BadGatewayError → 不寫 DB
    ↓
passTemplateSync (apps/backend/src/modules/pass-templates/services/passTemplateSync.ts)
    │ thin orchestrator: dispatch create vs update 根據 templates.passcreator_template_id
    │ 3 行 docstring 指向 v8 PUT→POST regression trace
    ↓
mapTemplateToPasscreator (apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts)  ← PURE
    │ serializes TemplatesRow → PasscreatorTemplateBody
    │   normalizeLinkUrl() — v10 URL scheme 自動 prefix
    │   buildAdditionalProperties() — v11 cross-reference variable store
    │   mapFieldType() — v12 data-driven 查表（from CARD_FIELDS[i].semanticType）
    │   normalizeHexColor() — v6 修 # prefix
    │   r2KeyToPublicUrl() — v4 修正 public R2 proxy route
    ↓
passcreatorFetch → createPassTemplate / updatePassTemplate (apps/backend/src/shared/lib/passcreator.ts)
    │ wraps all non-2xx / non-JSON into BadGatewayError
    │ extractTemplateId 從 data.identifier 讀（id-parse 修）
    │ V2 update 用 POST（v8 修）
    ↓
Passcreator V2 API: POST /api/v2/pass-template[/{id}]
```

### 為什麼這樣切層

`passTemplateMapping.ts`（純函式）跟 `passTemplateSync.ts`（I/O wrapper）拆開，讓 **shape** 可以無 HTTP mock 單測、**transport** 可以獨立 mock — 這是 Rule 000 Part C.2「第三方 API 必須包成 service」的具體落實。

| 層 | 角色 | 測試策略 |
|---|---|---|
| `passTemplateMapping.ts` | 純函式 serialize `TemplatesRow → PasscreatorTemplateBody` | 568 條單測（v4 = 31、v5 = +10、v7 = +16、v8 = +5 rewrite、v9 = +18、v10 = +41、v11 = +10、v12 = +38、v12-followup = +5 = 168 條 passTemplateMapping 測試）|
| `passTemplateSync.ts` | I/O orchestrator + DB 接線 | 整合測試 via `updateTemplate.passcreator.test.ts` |
| `passcreator.ts` | 第三方 transport 客戶端 | 21 條單測（fixture-based — V2 success envelope / 400 / 401 / 502 / network 等）+ 5 條 id-parse 驗證 |
| `useStep8Save` | React hook + i18n 觸發 | 19 條 Step8Save.test.tsx（error banner 區分 Passcreator vs generic）|

## 5 條跨 12 輪的設計 invariant（給未來 session）

### 1. **canonical V2 describe response 必做端到端 grep**（v7 + v9 + v10 + v11 共同的根因）

對 `mu-plugins/Passcreator/V2 end point/Pass template/describe-the-structure-of-a-pass-template.md`（或 live describe endpoint）做端到端 grep，**不要只看 doc 文字**。

| 維度 | 漏一次的下場 |
|---|---|
| **key shape** | v7: 推 `images.strip`，但 V2 是 `images.background` — silent drop |
| **位置** | v9: 推 `links` 進 `fields.backFields`，但 V2 是 top-level |
| **value 格式** | v10: 推 `links[].value` 是 raw email/phone，缺 `mailto:` / `tel:` |
| **placeholder 語法** | v11: 推 `value: ''`，但 V2 designer 期望 `{KeyName}` cross-reference |

四個維度任何一個沒對齊都會 silent fail（V2 接受 payload 但部署出來的 pass 欄位是空 / 圖不顯示 / 連結不可點）。

**禁止**：只用 doc 文字做 partial grep（v6-v11 每次只看局部就漏一個維度）。

### 2. **`passTemplateMapping.ts` 是純函式 — 零 I/O、零 env reads**

```typescript
// ✅ 正確：caller 把 language / r2PublicUrl / passTypeId 顯式傳進來
export function mapTemplateToPasscreator(
  template: TemplatesRow,
  options: { language: 'zh-TW' | 'en'; r2PublicUrl: string; passTypeId: string }
): PasscreatorTemplateBody { ... }

// ❌ 危險：mapping 內部讀 env 或 fetch
// → 失去 unit-testable 性質，必須 mock 整個 process.env
```

**理由**：
- 568 條 mapping 測試可無 HTTP mock、無 env setup
- `language` 顯式傳入 → preview 跟 deployed pass 一定同字串（v5 教訓）
- 任何新加的 normalizer（`normalizeLinkUrl` / `normalizeHexColor` / `slugify` / `derivePropertyName`）必為 pure function

### 3. **V2 mutation 統一 `POST`、V1 是 `PUT`**（v8 regression trace）

```typescript
// apps/backend/src/shared/lib/passcreator.ts
async function createPassTemplate(body: PasscreatorTemplateBody, env) {
  // V2 create: POST /api/v2/pass-template
  return passcreatorFetch('/api/v2/pass-template', 'POST', body, env);
}

async function updatePassTemplate(id: string, body: PasscreatorTemplateBody, env) {
  // V2 update: POST /api/v2/pass-template/:id   ← NOT PUT
  return passcreatorFetch(`/api/v2/pass-template/${id}`, 'POST', body, env);
}
```

V1 doc 寫 `PUT /api/pass-template/[id]`、V2 doc 寫 `POST /api/v2/pass-template[/{id}]` —— 跨版本慣例差異是 v8 bug 的根因（前一個 coder 從 V1 把 PUT 帶進 V2 code）。

**任何 test 必 pin `URL + method` 兩個**（不是只有 method）—— 防 refactor 只改 URL 不改 method 或反之。

### 4. **`CARD_FIELDS` 是 face-slot metadata 唯一 single source of truth**（v12 machine-checked drift guard）

```typescript
// packages/shared/constants/card-fields.ts
export type FieldSemanticType = 'text' | 'number' | 'date';

export interface CardFieldDefinition {
  key: CardFieldKey;
  group: 'left' | 'right' | 'header';
  labelKey: string;
  hideOnCardTypes?: ReadonlyArray<CardType>;
  semanticType: FieldSemanticType;   // ← v12 required，漏 = build fail
}

// 21 個 entry 一次補齊（5 text / 15 number / 1 date）
export const CARD_FIELDS: readonly CardFieldDefinition[] = [
  { key: 'phone',         group: 'left',  labelKey: 'phone',         semanticType: 'text' },
  { key: 'email',         group: 'left',  labelKey: 'email',         semanticType: 'text' },
  { key: 'memberName',    group: 'left',  labelKey: 'memberName',    semanticType: 'text' },
  { key: 'memberLevel',   group: 'left',  labelKey: 'memberLevel',   semanticType: 'text' },
  { key: 'birthday',      group: 'left',  labelKey: 'birthday',      semanticType: 'date' },  // ← v12 唯一行為變更：text → date
  { key: 'visitCount',    group: 'left',  labelKey: 'visitCount',    semanticType: 'number' },
  // ... 15 more
];
```

Header field 不在 CARD_FIELDS 內（不進 Step 3 dropdown），走平行常數：

```typescript
// packages/shared/i18n/fieldLabels.ts
export const HEADER_FIELD_TYPES: Record<string, FieldSemanticType> = {
  memberExpiry: 'date',
  discountExpiry: 'date',
  couponExpiry: 'date',
  balance: 'number',
  giftPoints: 'number',
  passValidDays: 'number',
};
```

`mapFieldType` 從 19-case switch 變成 ~10 行：

```typescript
const FACE_FIELD_TYPE_MAP = new Map(CARD_FIELDS.map(f => [f.key, f.semanticType]));

function mapFieldType(key: string | undefined | null): PasscreatorFieldType {
  if (!key) return 'text';
  return FACE_FIELD_TYPE_MAP.get(key) ?? HEADER_FIELD_TYPES[key] ?? 'text';
}
```

**新 key 加進流程簡化**：`CARD_FIELDS` 補 entry 順手填 `semanticType`，不用動 mapping module。

### 5. **Apple Wallet `PKPassStyleStoreCard` slot 慣例是 contract**（v12-followup 教訓）

```
primaryFields[]    = RESERVED for "most-important field" slot
secondaryFields[] = Step 3 dropdown home（BOTH 左/右）
```

**禁止** 任何 refactor 把 Step 3 dropdown 的 `leftField` 推到 `primaryFields[0]`（v6-v11 都這麼做，被 v12-followup 修掉）。

特殊例外：membership_card 強制 emit `[memberName]` 進 `primaryFields[0]`，即使 `memberName` 在 `CARD_FIELDS` 內有 `hideOnCardTypes: ['membership_card']`（Step 3 dropdown 不顯示）—— Apple Wallet primary slot 慣例 vs editor dropdown 自由，**wire-format contract 勝**。

## Bug pattern 家族（12 輪的 4 條反覆出現根因）

### Pattern A：對 canonical V2 schema 端到端 grep 漏一個維度

| 輪 | 漏哪個維度 | 下場 |
|---|---|---|
| v7 | key shape（`images.strip` vs `background`）| strip 圖 silent drop |
| v8 | HTTP method（PUT vs POST）| nginx default 404 HTML page（lang="de" 是 Passcreator / nginx 預設錯誤頁 fingerprint）|
| v9 | 位置（`links` top-level vs backFields）| 連結渲染成 HTML anchor、display 異常 |
| v10 | value 格式（`mailto:` / `tel:` prefix）| 整個 push 400 reject |
| v11 | placeholder 語法（`{KeyName}` vs `''`）| designer 看起來空白 |

**SOP**：每次 push 任何改動前，重跑完整 4 維度 grep（key shape / 位置 / value 格式 / placeholder 語法）vs canonical V2 describe response。

### Pattern B：DB schema 早就有的欄位不會自動流到 mapping

| 輪 | 漏接的欄位 | DB 何時有 | Mapping 何時接 |
|---|---|---|---|
| v9 | `settings.locationsDisabled` / `settings.locations[]` | 2026-09-06 | 2026-10-12 v9 |
| v9 | `settings.logoText` 進 top-level field | 2026-09-06 | 2026-10-12 v9 |
| v7 | `settings.backFields[]` 進 `additionalProperties` | 2026-09-06 | 2026-10-12 v7（v12-followup 部分 revert）|

`PasscreatorTemplateBody` interface 沒這 key → mapping 跳過 → 永遠不會 push。

**SOP**：每加 DB 欄位必問「對應 Passcreator 什麼？沒就 skip，要就加 interface 欄位 + mapping 邏輯 + test」。

### Pattern C：「fallback into other field」是危險 pattern

| 輪 | 哪個 fallback | 為什麼錯 |
|---|---|---|
| v9 | `logoText` 併進 `name` fallback chain | `name` = Card Name (UI 標題) ≠ `logoText` (header strip 文字)，兩個獨立 V2 欄位 |
| v4-v11 | `value: ''` 當成「per-pass runtime 會 inject」的保守預設 | 對 design-time template 是錯的：designer 看不到 placeholder |

**SOP**：「fallback into other field」必先證明「**同一個 UI 槽**有多 source」才能用。Card Name 跟 logo text 是不同 UI 槽。

### Pattern D：cross-reference variable store 是解析機制、不是備份機制

| 輪 | 哪個污染 | 為什麼錯 |
|---|---|---|
| v7 | `buildAdditionalProperties` 從 `backFields[]` 鏡像 entries | user 報「backFields 的值就填在 backFields 裡面就好」—— v12-followup revert |
| v11 | `value: ''` 沒配對的 `additionalProperties` entry | designer 看不到 `{Name}` placeholder |

**SOP**：`additionalProperties[]` 是 **Passcreator designer 看到 `{Name}` placeholder 時要 resolve 的 variable 來源**——slot cross-reference 跟 link normalization 必共享同一份 filter 邏輯（保持 `{Name}` 跟 pushed URL 一致），但不能當成 data 鏡像機制。

## 測試策略演進

| 輪 | 測試增量 | 累計 | 重要 test pattern |
|---|---|---|---|
| v4 開張 | 568 backend tests（passTemplateMapping 31 + shared fieldLabels 15 + frontend Step8Save 19）| — | 純函式 mapping 容易 unit test；frontend hook 用 RTL + i18n mock |
| v5 | passTemplateMapping 41 + fieldLabels 24 + integration 14 | +49 | `headerField INDEPENDENT of leftField` regression test |
| v6 | + per-cardType memberLevel type 測試 | +6 | v6 fixes（# prefix + memberLevel 為 number）|
| id-parse | + 5 fixture-based | +5 | `fixtures/passcreator/success-create.json` 從 live V2 capture |
| v7 | + 13 | +13 | additionalProperties 8 + HTML anchor escape 5 |
| v8 | 0 淨增量，2 條既有 test rewrite | 0 | `uses POST method` 同時 pin URL 防 refactor flip |
| v9 | + 18 | +18 | 4 個 describe block（top-level links / logoText / auxiliaryFields / locations）|
| v10 | + 41 | +41 | `normalizeLinkUrl` 31 + 整合 10 |
| v11 | + 10 + 14 rewrite | +10 | `{KeyName}` placeholder + additionalProperties 對齊 |
| v12 | + 38 + 4（card-fields conformance）| +42 | `it.each(CARD_FIELDS.map(...))` 21 entry iteration + 1 birthday deliberate change |
| v12-followup | passTemplateMapping 42 + integration 14 rewrite | 0 | primaryFields 改 membership_card-only、secondaryFields 改 left+right |
| **最終** | **1024 tests 全綠** | — | 35 backend files + 14 shared files + 1 frontend file |

### Capture-driven fixtures（id-parse 的關鍵）

```bash
# Live V2 error capture — 從真實 production push 拿 envelope
$ node apps/backend/scripts/capture-passcreator-errors.cjs
# → fixtures/passcreator/{bad-token,empty-body,invalid-pass-type-id,wrong-format-field,success-create}.json
```

沒有 `success-create.json` 的真實 V2 envelope 抓 bytes，id-parse bug 沒辦法有 fixture-based regression test。

## 跟既有的 DEV LOG 對齊

- [`1006-step8-save-and-library-real-data-wiring-master-dev-log.md`](./1006-step8-save-and-library-real-data-wiring-master-dev-log.md) — Step 8 上半段（UI + 模板庫 + 真實資料 wiring）
- [`1006-delete-500-r2-cleanup-download-table-card-master-dev-log.md`](./1006-delete-500-r2-cleanup-download-table-card-master-dev-log.md) — 1006 R2 cleanup + table-card download（Step 8 push 觸發的 r2 cleanup 對應）
- [`1003-r2-tombstone-cron-sweep.md`](./1003-r2-tombstone-cron-sweep.md) — R2 刪除的對應防護（pass-template push 圖片刪除走 cron sweep）
- [`1001-pass-holder-public-page.md`](./1001-pass-holder-public-page.md) — 早期 public page 設計
- `0822-card-builder-draft-abandon-full-trace.md` — CardBuilder 早期 step 設計，Step 8 publish 對應 happy path

## 對齊的既有 rule / skill

- **Rule 000 Part C.2** 第三方 API 必須包成 service — `passTemplateSync.ts` + `passcreator.ts` + `passTemplateMapping.ts` 三層分離的 reference
- **Rule 019 § 4.1** 四層 schema sync（shared schema → backend request → db interface → service signature）— `card-fields.ts::semanticType` 是 build-time drift guard
- **Rule 022 變體擴充 vs 修改** — headerField per-cardType 用 variant 擴充、不修改既有 helper
- **Rule 023 shared package 邊界** — `card-fields.ts` / `fieldLabels.ts` / `currency.ts` 都在 `packages/shared/`
- **Rule 025 § i18n 全中文/全英文** — 5 條新增 cardEditor.{en,zh-TW}.ts keys 對齊
- **Rule 027 postgres dynamic query** — `passTemplateMapping.ts` 內無 SQL（純函式），Rule 不適用
- **Rule 032 backend JSONB silent killer** — Step 8 publish 寫 `status: 'published'` 是 SQL column、不是 JSONB merge，無 silent overwrite 風險
- **Rule 036 Worker Runtime CORS** — backend 3 層 CORS defense 對應
- **Rule 037 MCP Tool Call Pattern** — `capture-passcreator-errors.cjs` 用 `fetch` 直接打（不是 MCP wrapper）
- **Rule 011 commit 紀律** — code + feedback + INDEX + DEV log 同 commit

## 10 條待辦（next session）

1. **`passTemplateMapping.ts` 948 行拆分**（Rule 000 § A.3 trigger）—— 拆出：
   - `fieldTypeLookup.ts`（`mapFieldType` + `FACE_FIELD_TYPE_MAP` + `HEADER_FIELD_TYPES`）
   - `additionalProperties.ts`（`buildAdditionalProperties`）
   - `normalizers.ts`（`normalizeHexColor` / `normalizeLinkUrl` / `slugify` / `derivePropertyName`）
2. **birthday → date picker production smoke test** — v12 把 `birthday` 從 `'text'` 改 `'date'`，但目前沒有 production template 用 `birthday` 為 leftField/rightField，需要 push 一個 test template 確認 iOS Wallet calendar picker 渲染正確
3. **Per-pass runtime value injection** — template-level `{KeyName}` 是 design-time placeholder，per-pass issuance flow 還沒接線（從 member row inject real value）
4. **`membershipTiers` / `rewardTiers` / `cashbackTiers` → `functionality.tiers` mapping** — Passcreator V2 完整 `functionality` 區段還沒 wire
5. **`normalizeLinkUrl` silent-drop observability** — 加 `console.warn` log 比例觀察（`example.com` / `Hello World` / `1234` 都 silent drop，production 不知道有多少 tenant-typed link 被丟）
6. **DB `linkKind` 顯式欄位評估** — v10 production drop 案例後，考慮加 `linkKind: 'url' | 'email' | 'phone' | 'custom'` 顯式欄位
7. **WhatsApp 其他 scheme** — `normalizeLinkUrl` 涵蓋 `wa.me` / `api.whatsapp.com` / `chat.whatsapp.com`，待 `web.whatsapp.com` / `whatsapp://` 案例出現
8. **`getHeaderField()` sentinel assert** — plan § 風險 3 提到把 `getHeaderField()` 強化成 runtime throw 當 `HEADER_FIELD_TYPES[return.key]` undefined，v12 沒做
9. **CORS post-deploy verification（Rule 017）** — `wrangler deploy` 成功後必跑 3-route CORS curl 矩陣，新 `PUT /api/cards/:id` 走 `BadGatewayError` 是新 path
10. **Production secret provisioning** — `PASSCREATOR_API_KEY` 必走 `wrangler secret put`（`.dev.vars` 僅 local）

## 給未來 session 的提醒

### 新 CardFieldKey 加進 `CARD_FIELDS` 必跑

```
□ packages/shared/constants/card-fields.ts 加 entry（記得填 semanticType）
□ packages/shared/i18n/fieldLabels.{ts,zh-TW,en,test}.ts 加 label + drift guard
□ packages/shared/schemas/auth.test.ts（如果有 cross-package 影響）
□ apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts 加 it.each entry
□ apps/backend/src/modules/pass-templates/tests/fieldLabels-integration.test.ts 加整合
□ mapFieldType 不動（v12 data-driven 自動 cover）
□ 跑 typecheck → 必 exit 0（漏 semanticType = build fail）
□ 跑 vitest → passTemplateMapping 全綠
```

### 改 `PasscreatorTemplateBody` interface 必跑

```
□ 對 canonical V2 describe response 做 4 維度 grep（key shape / 位置 / value 格式 / placeholder）
□ 加 1 條 conformance test 確認 interface 跟 V2 schema 對齊
□ 改 mapping 加 1 個 describe block
□ 跑 capture-passcreator-errors.cjs（V2 reject 的 4 種 error envelope）確認 production-like 失敗行為不變
```

### 改 `mapFieldType` / `buildAdditionalProperties` 必跑

```
□ 4 維度 canonical V2 grep
□ passTemplateMapping.test.ts 對應 describe block 改
□ 跑 capture-passcreator-errors.cjs
□ 跑 v12 conformance（21 CARD_FIELDS entry iteration + HEADER_FIELD_TYPES 6 entry）
```

### 改 `passcreator.ts` 任何 transport-level code 必跑

```
□ URL + method 雙 pin（v8 教訓）
□ fixtures/passcreator/* 不動（capture-driven 必保真）
□ BadGatewayError 對應 test 必加
□ CORS post-deploy check（Rule 036 + 017）
```

### 改 `useStep8Save` / `Step8SaveErrorBanner` 必跑

```
□ i18n key 對齊（cardEditor.{en,zh-TW}.ts `steps.save.*`）
□ Step8Save.test.tsx 19 條 regression test 仍 pinned
□ error.code === 'BAD_GATEWAY' && details.upstream === 'passcreator' 分支必保留（banner 觸發條件）
```

## Verification

| 驗證項 | 結果 |
|---|---|
| `npx tsc -b --noEmit` (workspace root) | ✅ exit 0 |
| `npm test --workspace=apps/backend` | ✅ 692 tests passed（35 files）|
| `npm test --workspace=packages/shared` | ✅ 458 tests passed（14 files）|
| `npm test --workspace=apps/frontend` Step8Save + Step8SaveErrorBanner | ✅ 19 tests passed |
| `npx tsc -b apps/backend/tsconfig.json` | ✅ exit 0 |
| `npm run check:migrations --workspace=apps/backend` | ✅ 18/18 registered（新增 `021_pass_template_id.sql` v4 內）|
| Capture-driven fixtures | ✅ 5 fixtures in `fixtures/passcreator/`（bad-token, empty-body, invalid-pass-type-id, wrong-format-field, success-create）|
| Production smoke test | ⚠ not done — **待 user 部署後跑 CORS curl 矩陣 + birthday date picker test** |

## Self-improvement action items

- [ ] **12 個 feedback batched commit 決策** — user 還沒決定 v6 / id-parse / v7 / v8 / v9 / v10 / v11 / v12 / v12-followup 九項 batched commit 還是一個個分開。**建議** batch 成 3 個邏輯 commit：(1) **wire-format 系列** = v7 + v8 + v9 + v10 + v11（都對 Passcreator 部署欄位）；(2) **refactor 系列** = v12（純 build-time drift guard，無 runtime 行為變更）；(3) **wire-format 修正** = v12-followup（user 觸發的 3 條 wire bug fix）。三類 commit scope 明確對應
- [ ] **`passTemplateMapping.ts` 948 行拆分**（見「10 條待辦」§ 1）
- [ ] **生日 date picker production smoke test**（見「10 條待辦」§ 2）
- [ ] **CORS post-deploy check + wrangler secret put**（Rule 036 + 017 + .dev.vars → production）
- [ ] **normalizeLinkUrl silent-drop observability console.warn**（v10 教訓 1 落實）

## Lessons（12 輪累積的 6 條 design-level 教訓）

1. **canonical schema 對齊必做 4 維度 grep**（key shape / 位置 / value 格式 / placeholder 語法）—— 任何一維度漏了，Passcreator 都 silent fail 比 V1 reject 難抓
2. **shared enum membership 跟 consumer logic 必須 machine-checked 對齊**（`CARD_FIELDS[i].semanticType` required、無 default）—— v12 落實，build-time drift guard
3. **DB schema 早就有的欄位不會自動流到 mapping** —— `PasscreatorTemplateBody` interface 沒 key 就永遠跳過，每加 DB 欄位必對應 mapping
4. **Apple Wallet 慣例 > editor 直覺** —— `primaryFields` 是 RESERVED slot 不可被 dropdown 覆蓋（v12-followup 教訓）
5. **wire-format contract 變更必分開 commit**（不要跟 refactor 混）—— v12 是 refactor、v12-followup 是 wire fix，混一起會讓 user 從 production runtime 才發現 wire bug
6. **cross-reference variable store 是解析機制、不是備份機制** —— `additionalProperties[]` 跟 pushed slot / link 共享 filter，但**不**能 mirror 任何資料

## 操作教訓 1 條（本 session 學到的）

> **大規模 test rewrite 走 StrReplace 拼 CJK 字串容易把檔案弄壞**。v12-followup 把 `passTemplateMapping.test.ts` 從 37 條 v1/v2 pre-v6 baseline 整個重寫成 42 條 v12-followup contract，途中 git restore 救回一次（Shell StrReplace 拼中文字串時編碼不一致）。**下次改 test file 整個文件時用 Python script 一次寫完整 utf-8 編碼，不要走 Shell StrReplace 拼字串**。

---

> 撰寫者：cursor-assistant ｜ 時間：2026-10-12
