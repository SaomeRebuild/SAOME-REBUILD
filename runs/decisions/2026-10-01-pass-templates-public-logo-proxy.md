# Decision: Pass-templates 公開 Logo Proxy + UUID zod parse

**日期**: 2026-10-01
**作者**: SAOME-REBUILD
**Scope**: L3 Heavy (新增 backend route + 修既有 route zod parse + frontend URL build)
**前置**: [runs/decisions/2026-09-29-pass-templates-public-endpoint.md](2026-09-29-pass-templates-public-endpoint.md)

---

## 背景

兩個 bug 同時被抓到,需要在同一輪修掉:

### Bug Q1 — 公開 logo 鏈斷

`PassHolderHeader` 的 issuer logo `<img>` 永遠是 broken image icon。症狀:

- 公開 `/pass/{templateId}` 頁面的 logo 區塊是 Store icon (Lucide fallback)
- DevTools Network 看到 `<img src="abc-tenant-uuid/716c42.../issuer-logo.png">` 直接打 HTTPS origin 失敗
- 因為 `template.issuerLogo` 是 R2 key (例如 `716c4244.../issuer-logo.png`),不是絕對 URL

**根因**: 既有 `passHolderService.getTemplate` mock 階段塞 `https://picsum.photos/...` (絕對 URL) 進 `issuerLogo`,frontend 直接當 `<img src>` 用;backend 上線後回的是 R2 key,沒有 proxy 跟絕對 URL 化,前端就壞了。

### Bug Q2 — scanner 戳 random UUID 炸 500

`wrangler tail` 看到以下 trace 反覆出現:

```
[getPublic] passing through invalid UUID 'abc' 給 zod parse
  at findPublicTemplateById (db/templates.ts:51)
  Error: invalid input syntax for type uuid: "abc"
```

**症狀**: scanner / bot 戳 random 字串到 `/api/pass-templates/{garbage}/public`,後端每秒掉 500,worker log 全是 `PostgresError`。

**根因**: [`apps/backend/src/modules/pass-templates/routes/getPublic.ts`](../apps/backend/src/modules/pass-templates/routes/getPublic.ts) 的 handler 拿 `c.req.param('id')` 後**沒 zod parse**就傳給 `findPublicTemplateById`,postgres UUID type coerce 失敗 → 500。`postgres.js` 的 `sql\`...\`` tagged template 對 `WHERE id = ${id}` 不會做 runtime type check,只有 DB driver 接收到 query 才會 throw。

### 兩個 bug 的共通性

表面無關但其實是同一個 anti-pattern:「public endpoint 沒做好輸入驗證 + 沒保護 R2 key」。

- Q1 是「輸出端沒保護」: 給匿名訪客的 `issuerLogo` 是 R2 key,不是公開可達的 URL
- Q2 是「輸入端沒保護」: 沒在 route 層把 garbage UUID 擋掉,讓它撞進 DB query

修方案必須同時解兩個,走「unauthenticated image proxy」+「schema-level UUID validation」。

---

## 選項與決定

### 1. Image proxy path 形狀

| 候選 | Path | 採納 |
|---|---|---|
| **A** | `GET /api/pass-templates/:id/logo` (簡化,只公開 logo) | ✅ A |
| B | `GET /api/pass-templates/:id/image/:type` (鏡像 dashboard `cards/:id/image/:type`) | ❌ |
| C | 在 `getPublic` response 內直接給 absolute URL (不用 proxy) | ❌ — 需要 R2 bucket 開 public read,會失去 tenant 邊界 audit |

**決定**: **A** — v1 只公開 logo (logo 是唯一對外曝光的 brand asset),`background` / `icon` 不開放,維持 path 簡潔。

未來若要公開 background / icon,直接加 `/api/pass-templates/:id/background` / `/:id/icon` 即可,不需 `:type` 通用化(避免 query string 越界,path 結構跟用法一目了然)。

### 2. R2 multi-tenant audit pattern

| 候選 | 機制 | 採納 |
|---|---|---|
| 1 | 直接 trust `template.settings.issuerLogo`,fetch R2 | ❌ 任何 attacker 拿到別的 tenant UUID 就能 cross-tenant fetch |
| 2 | JWT verify + tenantId 比較 (跟 `cards/getImage` 一致) | ❌ public endpoint 沒 JWT,`requireAuth` 會把所有訪客擋掉 |
| **3** | `buildImageKey(tenant_id, template_id, 'logo')` 重建期望值,跟 `settings.issuerLogo` 比對 | ✅ |

**決定**: **3** — public endpoint 沒 JWT,只能從 row 自身取 `tenant_id` 重建期望值,跟 `settings.issuerLogo` 字串比對;**不匹配 silent 204** (不洩漏 cross-tenant 嘗試,跟 `cards/getImage` line 36-44 的「跨租戶 → NotFoundError 偽裝成 404」同精神,但這裡用 204 因為是圖片 binary endpoint,沒有「找不到」語意差別)。

### 3. Cache header

| 候選 | 值 | 採納 |
|---|---|---|
| 1 | `public, max-age=3600` (1 小時) | ❌ 太短,匿名訪客每次都打 R2 |
| **2** | `public, max-age=31536000, immutable` (1 年) | ✅ 沿用 `cards/getImage` line 120-122 |
| 3 | `private, no-store` | ❌ CDN 不吃,而且 logo 不變不需要 revalidate |

**決定**: **2** — logo 一旦上傳就 immutable (per dashboard 既有 pattern),1 年 cache + `immutable` 讓瀏覽器 / CDN 永遠 cache,不發 conditional request。

### 4. Frontend URL build

| 候選 | 邏輯 | 採納 |
|---|---|---|
| 1 | 永遠 wrap: `api.baseUrl + api.paths.passLogo(id)`,但 R2 miss 會 204 壞圖 | ❌ mock 階段 (Picsum 絕對 URL) 也會被 wrap,變 double-proxy |
| **2** | `if (issuerLogo.startsWith('http')) use as-is, else wrap with api.baseUrl + api.paths.passLogo(id)` | ✅ |
| 3 | 拆兩個欄位 (`issuerLogo` 給 mock, `issuerLogoKey` 給 R2) | ❌ 跟現有 schema 衝突,需要 migration |

**決定**: **2** — mock (Picsum 絕對) 跟 production (R2 key) 共用同段 code path,只需判斷 `startsWith('http')` 一行。

### 5. Service 拆分 — **方案 a (使用者選定)**

| 候選 | 設計 | 採納 |
|---|---|---|
| **a** | 新 `getPublicTemplateWithTenantService` 回 `{ dto, tenantId }`,既有 `getPublicTemplateService` 不變 | ✅ a |
| b | 既有 `getPublicTemplateService` 加 optional `{ withTenant: true }` flag,回型別變成 `PublicPassTemplateDto \| PublicPassTemplateWithTenant` (type union) | ❌ 模糊,type narrowing 不可靠 |
| c | 既有 service 不動,logo route 直接 `findPublicTemplateWithTenantById` (db 層呼叫) | ❌ 違反 Rule 000 Part B § B.4 (DB 查詢不能在 route 內) |

**決定**: **a** — 兩條 narrow service 勝過一條 fat service with optional flag,contract 乾淨無歧義;`getPublic` endpoint 仍只回 DTO (無 `tenant_id` leak per 2026-09-29 Decision 3);logo route 拿 `tenantId` 給 R2 multi-tenant audit 用。

### 6. Tenant isolation (跟 2026-09-29 Decision 3 對齊)

`getPublic` endpoint response **不包含** `tenant_id` (per 2026-09-29 Decision 3) — 本次決定**不破壞**此契約。

新 service `getPublicTemplateWithTenantService` 的 `tenantId` 欄位**只在 backend 內部**用於 R2 key 重建,絕不序列化到任何 response。

### 7. DB migration

**不做 migration**。`templates.tenant_id` 既有 column 已足夠(這欄在 schema 從來就有,只是 public DTO 從不 expose)。

---

## 影響

### Backend (5 個檔)

| 檔案 | 動作 |
|---|---|
| `apps/backend/src/modules/pass-templates/routes/getPublic.ts` | 加 zod parse `:id` uuid (修 Q2) |
| `apps/backend/src/modules/pass-templates/db/templates.ts` | 新增 `findPublicTemplateWithTenantById` + `PublicTemplateRowWithTenant` |
| `apps/backend/src/modules/pass-templates/services/getPublicService.ts` | 新增 `getPublicTemplateWithTenantService` + `PublicTemplateWithTenant` |
| `apps/backend/src/modules/pass-templates/routes/getLogo.ts` | **新檔** — `GET /api/pass-templates/:id/logo` 含 R2 multi-tenant audit |
| `apps/backend/src/modules/pass-templates/index.ts` | mount `getLogoRoute` |

### Frontend (2 個新檔 + 1 個新 test)

| 檔案 | 動作 |
|---|---|
| `apps/frontend/src/config/api.ts` | 加 `passLogo: (id) => '/api/pass-templates/${id}/logo'` |
| `apps/frontend/src/components/layout/PassHolderHeader.tsx` | 改 `<img src={...}>` 建構邏輯:`startsWith('http')` 直傳 / R2 key 包 proxy / fallback Store icon |
| `apps/frontend/src/components/layout/PassHolderHeader.test.tsx` | **新檔** — 3 條 test (mock absolute / R2 key 包成 URL / template null fallback) |

### Tests (13 條 new)

| 檔案 | 條數 | 覆蓋 |
|---|---|---|
| `apps/backend/src/modules/pass-templates/tests/getPublic.validation.test.ts` (新) | 3 | valid UUID 200 / `:abc` 400 (Q2 regression) / empty path 400 |
| `apps/backend/src/modules/pass-templates/tests/getLogo.test.ts` (新) | 7 | template 404 / no logo 204 / R2 key mismatch 204 / R2 key matches & R2 hit 200 / R2 key matches & R2 miss 204 / zod malformed 400 / tenant_id NULL fail-closed |
| `apps/frontend/src/components/layout/PassHolderHeader.test.tsx` (新) | 3 | mock absolute 直傳 / R2 key 包 URL / template null fallback |

### Decision Log 衍生 (同 commit 帶)

- `runs/improvements/feedback/20261001-pass-templates-public-logo-q1-q2-fix.md` (Step 1-10 完成後,描述兩個 bug 的根因 + 方案 a 的 rationale)

### 不影響的系統

- `apps/backend/wrangler.jsonc` (CORS env 已涵蓋 `*.josh1989213.workers.dev`,無新增 origin)
- `apps/backend/src/shared/middleware/runtimeCors.ts` (同樣已涵蓋,無需同步 — per Rule 036 § 4)
- `packages/shared/types/passHolder.ts` (`PublicPassTemplate` 介面不變,front/back DTO 都沒有 `tenant_id`)
- `apps/backend/src/shared/contracts/passTemplates.ts` (同上)

---

## 影響的回歸測試

| 既有測試 | 是否受影響 |
|---|---|
| `apps/backend/src/modules/pass-templates/tests/getPublic.test.ts` (既有 11 條 conformance + functional) | 既有 mock 的 `getPublicTemplateService` 行為不變,測試不需改 |
| `apps/backend/src/modules/pass-templates/tests/register.test.ts` | 完全不影響 (新 route 不影響 register) |
| `apps/frontend/src/components/layout/PassHolderShell.test.tsx` | 既有 test 是 `PassHolderShell` 層級,header 內部 logo src 改動不會 break (因為 `PassHolderShell` test 沒 assert `src` 屬性) |

---

## Future Reconsideration Trigger

| Trigger | 觀察方式 | 重新評估時考慮 |
|---|---|---|
| 業務需要公開 `background` / `icon` 圖片 | Product 提需求 | 加 `/:id/background` / `/:id/icon` 平行 endpoint,沿用同 R2 audit pattern |
| R2 bucket 改用 object versioning (logo 可更新) | 觀察 dashboard 是否加入 logo edit UI | 把 `immutable` 拿掉,改 `max-age=3600` + cache tag |
| Bug 出現: 攻擊者枚舉 template UUID 成功偷到 logo | 觀察 log / 攻擊 pattern | 加 rate limit middleware(per template_id + IP) |

---

## 同步契約

| 層 | 位置 | 影響 |
|---|---|---|
| Layer 1 | `packages/shared/types/passHolder.ts::PublicPassTemplate` | **不變** |
| Layer 2 | `apps/backend/src/shared/contracts/passTemplates.ts::PublicPassTemplateDto` | **不變** (tenantId 從不出現在這個 DTO) |
| Layer 3 | `apps/backend/src/modules/pass-templates/db/templates.ts` | 新 `PublicTemplateRowWithTenant`(內部用,**不** mirror 到 shared) |
| Layer 4 | `apps/backend/src/modules/pass-templates/services/getPublicService.ts` | 新 `getPublicTemplateWithTenantService` |

Layer 3 為何不 mirror 到 shared:`tenant_id` 是 backend 內部 audit 用的,從不對前端公開。shared 介面只放 cross-package contract,放 `tenant_id` 會破壞 2026-09-29 Decision 3 契約。

---

## 必須配套的 Feedback (Step 11 寫)

`runs/improvements/feedback/20261001-pass-templates-public-logo-q1-q2-fix.md`:

- Q1 根因:`template.issuerLogo` 是 R2 key 不是 URL
- Q2 根因:`c.req.param('id')` 沒 zod parse → DB type coerce 失敗
- 方案 a 為何勝過 b/c:two narrow services > one fat with optional flag
- R2 fail-closed 204 pattern 跟 `cards/getImage` 跨租戶 NotFoundError 偽裝的對照

---

## 必須跑的 rule checklist

- ✅ Rule 000 Part B § B.2 (feature module 結構) — `routes/` `services/` `db/` `schemas/` `tests/` 五件齊
- ✅ Rule 000 Part B § B.5 (route handler 只做組裝) — getLogo 只有 zod parse + service call + R2 fetch
- ✅ Rule 001 § Decision Log (本檔)
- ✅ Rule 003 TDD — 先 failing test (Step 3, 7, 10) 再 GREEN
- ✅ Rule 006 § 驗證清單 — typecheck + lint + test + smoke + bundle audit
- ✅ Rule 011 § commit 紀律 — 實作完成後同 commit 帶 DEV LOG + feedback
- ✅ Rule 017 § post-deploy bundle + backend CORS check
- ✅ Rule 019 § 4.1 layer 4 — `getPublicTemplateWithTenantService` 回的 `tenantId` 沒進 DTO
- ✅ Rule 036 § 三層 CORS Defense — 既有 `corsMiddleware` + `errorHandler` + `runtimeCors` 已涵蓋
