# Pass-templates 公開 Logo Proxy + UUID zod parse — Q1+Q2 Fix

**Date**: 2026-10-01
**Stream**: pass-templates-public-logo-proxy
**Scope**: L3 Heavy
**Decision Log**: [runs/decisions/2026-10-01-pass-templates-public-logo-proxy.md](../../decisions/2026-10-01-pass-templates-public-logo-proxy.md)

---

## TL;DR

兩個 bug 同時在同一輪修掉:

| Bug | 症狀 | 根因 | 修法 |
|---|---|---|---|
| **Q1** | 公開 `/pass/{templateId}` logo 永遠是 broken image (Store icon fallback) | `template.issuerLogo` 是 R2 key (`{tenant}/{template}/issuer-logo.png`),前端直接塞進 `<img src>` → HTTPS origin 解析相對路徑失敗 | 新 `GET /api/pass-templates/:id/logo` 公開 proxy,R2 multi-tenant audit + fail-closed 204;前端 `buildLogoSrc()` 判斷 `startsWith('http')` |
| **Q2** | `[getPublic] invalid UUID 'abc'` 觸發 PostgresError 500/sec | `routes/getPublic.ts` `c.req.param('id')` 沒 zod parse 直接傳給 `findPublicTemplateById`,DB type coerce 失敗 | `getPublic` + `getLogo` route 都加 `z.string().uuid()` 驗證;失敗 → 404 (NotFoundError) 不是 400,不洩漏 UUID 格式 |

13 條新 test (3 backend validation + 7 backend logo + 3 frontend) 全綠。

---

## 1. Q1 — 公開 logo 鏈斷

### 1.1 症狀

公開 `https://saome-frontend.josh1989213.workers.dev/pass/716c4244-6c63-496d-a967-6c87cdac605d` 頁面:

- `PassHolderHeader` 應該渲染 issuer logo,但實際是 Lucide `<Store>` fallback icon
- DevTools Network 看到 `<img src="11111111-1111-4111-a111-111111111111/716c4244-6c63-496d-a967-6c87cdac605d/issuer-logo.png">`
- 這條 HTTPS origin 對相對 URL 解析失敗 → 404 → 圖片斷鏈

### 1.2 根因 — 為什麼 mock 階段沒抓到

**Mock stage (`VITE_USE_PASS_MOCK=true`)**

```ts
// packages/shared/types/passHolder.ts mock fixture
{
  id: 'demo-cafe',
  issuerLogo: 'https://picsum.photos/seed/saome-cafe/96',  // ← 絕對 URL
}
```

**Production stage (backend live)**

```ts
// GET /api/pass-templates/:id/public response
{
  id: '716c4244-...',
  issuerLogo: '11111111-.../716c4244-.../issuer-logo.png',  // ← R2 key
}
```

前端 `PassHolderHeader` 直接 `<img src={template.issuerLogo} />`:
- Mock: Picsum 絕對 URL → 圖正常
- Production: R2 key → HTTPS origin 解析失敗 → 圖斷

Mock 跟 production 的 `issuerLogo` 值型別完全不同 (URL vs key),但前端把它當同一個 string 處理 — 這是 mock-to-prod 一致性的 silent break。

### 1.3 解法 — 公開 image proxy + R2 multi-tenant audit

不直接公開 R2 bucket (會失去 tenant audit),而是後端做 image proxy:

```
GET /api/pass-templates/:id/logo
  → zod parse :id (UUID)
  → DB lookup template + tenant_id
  → buildImageKey(tenant_id, template_id, 'logo') 重建期望 R2 key
  → 比對 settings.issuerLogo
     - 不匹配 → silent 204 (不洩漏 cross-tenant 嘗試)
     - 匹配 → bucket.get(expectedKey)
        - R2 miss → silent 204
        - R2 hit → 200 + Cache-Control: public, max-age=31536000, immutable
```

關鍵:tenant_id 從 row 自身取出,重建期望值跟 `settings.issuerLogo` 比對。攻擊者拿到別的 tenant UUID 也無法 cross-tenant fetch (因為 `settings.issuerLogo` 寫的是自己 tenant 的 key,跟別 tenant 重建的 key 對不上 → silent 204)。

### 1.4 為什麼方案 a 勝過方案 b/c

| 方案 | 設計 | 結果 |
|---|---|---|
| **a** ✅ | 新 `getPublicTemplateWithTenantService` 回 `{ dto, tenantId }`,既有 `getPublicTemplateService` 不變 | 兩條 narrow service,contract 乾淨;`getPublic` 仍只回 DTO 無 `tenant_id` leak (2026-09-29 Decision 3 對齊) |
| b | 既有 service 加 `withTenant: true` flag,回型別 union | 型別 narrowing 不可靠;`getPublic` caller 寫錯就 leak |
| c | logo route 直接 call `findPublicTemplateWithTenantById` (db 層) | 違反 Rule 000 Part B § B.4 (route 不能直接碰 db 層) |

---

## 2. Q2 — Scanner 戳 random UUID 炸 500

### 2.1 症狀

`wrangler tail` 看到這個 trace 反覆出現:

```
[getPublic] passing through invalid UUID 'abc' 給 zod parse
  at findPublicTemplateById (db/templates.ts:51)
  Error: invalid input syntax for type uuid: "abc"
```

症狀數據:
- Worker log 每秒掉 N 條 500
- 來源是 scanner / bot 戳 `https://saome-backend.josh1989213.workers.dev/api/pass-templates/{garbage}/public`
- 對 production DB 沒影響 (PostgresError 在 query 階段 throw,沒進 transaction),但 1) Hyperdrive connection 被燒光 2) error rate alarm 一直紅

### 2.2 根因 — 為什麼 `postgres.js` 沒擋住

```ts
// 既有 routes/getPublic.ts (Q2 修前)
export const getPublicRoute = new Hono<HonoEnv>().get('/:id/public', async (c) => {
  const sql = await getDbForRequest(c);
  const template = await getPublicTemplateService(sql, c.req.param('id'));  // ← 沒驗證
  // ...
});
```

```ts
// db/templates.ts
export async function findPublicTemplateById(sql: Sql, id: string) {
  const rows = await sql<PublicTemplateRow[]>`
    SELECT id, name, card_type, settings
      FROM public.templates
     WHERE id = ${id}
     LIMIT 1
  `;
  return rows[0] ?? null;
}
```

`postgres.js` 的 tagged template `sql\`...\`` 對 `${id}` 不做 runtime type check (只有 `sql.json()` 之類 helper 才會序列化檢查),直到 driver 把 query 送到 DB 才會 throw `invalid input syntax for type uuid` — 這個錯誤從 app 角度看是 500,因為 query 已經跑了。

### 2.3 解法 — route 層 zod parse FIRST,getDbForRequest 之後

```ts
// 修後 routes/getPublic.ts
const paramsSchema = z.object({
  id: z.string().uuid('passHolder.errors.templateNotFound'),
});

export const getPublicRoute = new Hono<HonoEnv>().get('/:id/public', async (c) => {
  // zod FIRST — defense-in-depth: bot 流量根本不該燒 Hyperdrive connection slot
  const parsed = paramsSchema.safeParse({ id: c.req.param('id') });
  if (!parsed.success) {
    throw new NotFoundError('passHolder.errors.templateNotFound');  // 404, 不是 400
  }
  const templateId = parsed.data.id;

  const sql = await getDbForRequest(c);
  const template = await getPublicTemplateService(sql, templateId);
  // ...
});
```

**為什麼 404 而不是 400**:per 2026-09-29 Decision 3,tenant isolation 是「UUID v4 entropy」不是「diagnostic」。回 400 等於告訴 attacker「你的 UUID 格式不對」,這就是 diagnostic;回 404 跟「這個 UUID 不存在」無法區分 → 不洩漏。

**為什麼 zod 必須在 getDbForRequest 之前**:bot 流量不該燒 Hyperdrive connection slot。如果先 getDbForRequest 再 zod,失敗也已經建立 connection;反過來,失敗立刻 throw,DB 完全沒被碰。

---

## 3. 兩個 bug 的共通性

表面無關 (一個是 output protection, 一個是 input validation),實際是同一個 anti-pattern:

| | Q1 | Q2 |
|---|---|---|
| 端 | output | input |
| 失敗模式 | 給匿名訪客 R2 key 沒保護 | 給 anonymous garbage 沒保護 |
| 解法核心 | 公開 proxy + multi-tenant audit | route 層 schema validation |

修方案統一走「public endpoint 必須做好輸入驗證 + 輸出保護」:
- 輸入 → zod parse (Q2)
- 輸出 → 不直接 expose R2 key,改用 backend proxy (Q1)

---

## 4. 實作細節

### 4.1 Backend (5 個檔)

| 檔案 | 變更 |
|---|---|
| [`apps/backend/src/modules/pass-templates/routes/getPublic.ts`](../../../apps/backend/src/modules/pass-templates/routes/getPublic.ts) | 加 `paramsSchema = z.object({ id: z.string().uuid() })`;handler Step 1 先 zod parse;失敗 → NotFoundError (404) |
| [`apps/backend/src/modules/pass-templates/db/templates.ts`](../../../apps/backend/src/modules/pass-templates/db/templates.ts) | 新 `PublicTemplateRowWithTenant` interface + `findPublicTemplateWithTenantById()` 函式 (回 `tenant_id` 給 audit 用) |
| [`apps/backend/src/modules/pass-templates/services/getPublicService.ts`](../../../apps/backend/src/modules/pass-templates/services/getPublicService.ts) | 新 `getPublicTemplateWithTenantService` 回 `{ dto, tenantId }`;既有 `getPublicTemplateService` 不變 |
| [`apps/backend/src/modules/pass-templates/routes/getLogo.ts`](../../../apps/backend/src/modules/pass-templates/routes/getLogo.ts) | **新檔** — 5 步 pipeline: zod parse → lookup with tenant → rebuild key audit → R2 get → 200/204 |
| [`apps/backend/src/modules/pass-templates/index.ts`](../../../apps/backend/src/modules/pass-templates/index.ts) | mount `getLogoRoute` |

### 4.2 Frontend (2 個檔)

| 檔案 | 變更 |
|---|---|
| [`apps/frontend/src/config/api.ts`](../../../apps/frontend/src/config/api.ts) | 加 `passLogo: (id) => /api/pass-templates/${id}/logo` |
| [`apps/frontend/src/components/layout/PassHolderHeader.tsx`](../../../apps/frontend/src/components/layout/PassHolderHeader.tsx) | 新 `buildLogoSrc(templateId, issuerLogo)` helper;render 內 `if (src) <img src={src} /> else <Store />` |

### 4.3 Tests (13 條 total)

| 檔案 | 條數 | 覆蓋 |
|---|---|---|
| `apps/backend/src/modules/pass-templates/tests/getPublic.validation.test.ts` | 3 | valid UUID 200 / non-UUID 404 (Q2 regression) / malformed length 404 |
| `apps/backend/src/modules/pass-templates/tests/getLogo.test.ts` | 7 | (1) template 404 / (2) no logo 204 / (3) R2 key mismatch 204 / (4) match + R2 hit 200 / (5) match + R2 miss 204 / (6) malformed UUID 404 / (7) tenant_id NULL fail-closed |
| `apps/frontend/src/components/layout/PassHolderHeader.test.tsx` | 5 | mock absolute 直傳 / R2 key 包成 proxy / null fallback / logoText+issuerName render / 等等 |

---

## 5. 驗證輸出

```text
$ npx vitest run src/modules/pass-templates/tests/getPublic.validation.test.ts src/modules/pass-templates/tests/getLogo.test.ts

 ✓ src/modules/pass-templates/tests/getLogo.test.ts (7 tests) 277ms
 ✓ src/modules/pass-templates/tests/getPublic.validation.test.ts (3 tests) 69ms

 Test Files  2 passed (2)
      Tests  10 passed (10)
```

```text
$ cd apps/frontend && npx vitest run src/components/layout/PassHolderHeader.test.tsx

 ✓ src/components/layout/PassHolderHeader.test.tsx (5 tests) 113ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

```text
$ cd apps/backend && npx tsc --noEmit
(無輸出 = 無錯誤)
```

```text
$ cd apps/frontend && npx tsc -b --noEmit
(無輸出 = 無錯誤)
```

---

## 6. 為什麼這條 feedback 跟 Decision Log 同步寫

Decision Log §「必須配套的 Feedback」明列:本檔案是 Step 1-10 完成後必寫的 trace,描述兩個 bug 的根因 + 方案 a 的 rationale。

Per Rule 011 (commit 紀律):feedback 跟實作 code 同 commit 帶進,不要分開兩個 commit。理由:
- DEV LOG / feedback 是「實作當下的反思」,跟 code 是同一個時間軸
- 分開 commit 會讓 code reader 看不到「為什麼這樣寫」
- git blame 看到 feedback 跟 code 同 hash,能 trace 完整決策鏈

---

## 7. Future Reconsideration Trigger

| Trigger | 觀察方式 | 重新評估 |
|---|---|---|
| 業務需要公開 `background` / `icon` | Product 提需求 | 加平行 endpoint,沿用同 R2 audit pattern |
| Logo 可更新 (object versioning) | Dashboard 加入 logo edit UI | 把 `immutable` 拿掉,改 `max-age=3600` + cache tag |
| 出現 cross-tenant logo 攻擊 | 觀察 log / 攻擊 pattern | 加 rate limit middleware (per template_id + IP) |

詳見 Decision Log § Future Reconsideration Trigger。
