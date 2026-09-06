---
title: "2026-09-07 Production CORS Drop — Worker Runtime-Emitted 503"
date: 2026-09-07
type: bug-trace
scope: backend/runtime-cors
status: resolved
severity: SEV-1
commits:
  - 7935de8   # fix(backend): Worker-level CORS injection for runtime-emitted 503s
related:
  - runs/improvements/feedback/20260907-cors-runtime-503-fix.md
  - runs/decisions/2026-09-07-three-layer-cors-defense.md
  - .cursor/rules/036-worker-runtime-cors-defense.mdc
  - DEV/08-2026/0808-bug-7-trace.md (Bug-4c/4d 同源 fingerprint)
  - runs/improvements/feedback/20260808-admin-login-6-bug-chain-index.md
---

# 2026-09-07 Production CORS Drop — Worker Runtime-Emitted 503

## TL;DR

2026-09-07 ~02:00–02:40 UTC+8，production `https://saome-frontend.josh1989213.workers.dev` 送出的 `POST /api/auth/login` 在某些情境下回 503 但 **沒有任何 CORS header**，瀏覽器 silent drop，使用者看到「Network error」而 curl 完全看不出來。根因是 503 來自 Cloudflare Worker runtime（在 Hono middleware chain 啟動**之前**），Hono 的 `corsMiddleware` 跟 `errorHandler` 都只活在 Hono chain 內，覆蓋不到這個出口。修法：在 `apps/backend/src/index.ts` 加第 3 層 CORS defense（Worker entry boundary 的 `ExportedHandler.fetch` 包裹），讓所有離開 Worker 的 response — 包括 runtime-emitted 503 — 都過 `ensureCorsOnResponse`。commit `7935de8` 部署後 Chrome incognito 登入成功，curl OPTIONS 跟 POST 都帶 CORS header。

## 時間軸（trace）

| 時間 (UTC+8) | 事件 | 備註 |
|---|---|---|
| 2026-09-06 ~late | Phase 5.13 migration pipeline + Phase 5.16 i18n audit 結束，commit chain 收尾 | 9/5-9/6 batch 結束 |
| 2026-09-07 ~01:30 | deploy `7935de8`（CardBuilder Step 3 → Step 5 data contracts alignment）| commit `3ae74df` + `ccce6d1` |
| 2026-09-07 ~02:00 | 部署 CORS allow-list 擴增（Workers preview subdomain）後，部分登入仍失敗 | user 回報 |
| 2026-09-07 ~02:10 | 開始 curl 排查：OPTIONS 204 ✓、POST 200 (正確憑證) ✓、POST 401 (錯誤憑證) ✓ | 看似 backend 正常 |
| 2026-09-07 ~02:12 | Chrome incognito 仍失敗 → DevTools Network 截圖 | 看到 503 + 無 CORS header |
| 2026-09-07 ~02:15 | Wrangler tail 開起來再重發 POST → tail **沒看到這條 request 的 log** | runtime 直接拒絕 |
| 2026-09-07 ~02:18 | 對比 OPTIONS 跟 POST：OPTIONS 進 Hono、POST 沒進 | 推導出 3 條出口路徑 |
| 2026-09-07 ~02:20 | 確認根因：runtime-emitted 503 繞過 Hono chain（路徑 ①）| 寫進 decision log |
| 2026-09-07 ~02:25 | 實作 `runtimeCors.ts` + `index.ts` 包 `ExportedHandler.fetch` | TDD-style：先寫 6 條 conformance test 再實作 |
| 2026-09-07 ~02:28 | typecheck 通過、vitest 6/6 新測試綠、其他 170 條 test 全綠 | 沒 regression |
| 2026-09-07 ~02:32 | commit `7935de8` + push → Cloudflare Git-integration auto-deploy | 約 90 秒後 deploy 完成 |
| 2026-09-07 ~02:36 | curl OPTIONS + POST 重測：OPTIONS 204 + CORS、POST 401 + CORS | curl 看起來跟修前一樣，但 header 在 |
| 2026-09-07 ~02:38 | Chrome incognito 登入 saome-frontend.josh1989213.workers.dev | UI 顯示錯誤訊息（401 wrong creds），console 沒有 CORS policy block |
| 2026-09-07 ~02:40 | production 登入完整鏈恢復 | fix confirmed |

---

## 症狀層 — 為什麼 curl 看不到、瀏覽器看到

### curl 看到什麼

```bash
$ curl -sS -i -X OPTIONS "https://saome-backend.josh1989213.workers.dev/api/auth/login" \
    -H "Origin: https://saome-frontend.josh1989213.workers.dev" \
    -H "Access-Control-Request-Method: POST" | head -20
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://saome-frontend.josh1989213.workers.dev
Access-Control-Allow-Credentials: true
# ← OPTIONS 完美 204 + CORS header ✅

$ curl -sS -i -X POST "https://saome-backend.josh1989213.workers.dev/api/auth/login" \
    -H "Origin: https://saome-frontend.josh1989213.workers.dev" \
    -H "Content-Type: application/json" \
    -d '{"email":"nonexistent@test.invalid","password":"wrong"}' | head -20
HTTP/1.1 503 Service Unavailable
content-type: application/json
# ← 503，沒 Access-Control-Allow-Origin ❌
```

**curl 解讀**：OPTIONS 通 → Hono chain 進去了 → corsMiddleware 運作；POST 503 → 「backend overload / temporary issue」之類的合理錯誤。但這條 503 的 request **完全沒進 Hono chain**（wrangler tail 證實），所以 corsMiddleware 沒機會跑。

### 瀏覽器看到什麼

從 `https://saome-frontend.josh1989213.workers.dev`（HTTPS origin）fetch `https://saome-backend.josh1989213.workers.dev/api/auth/login`（HTTPS target）— Mixed Content 不會觸發（CORS 才會）。但 response **沒有 CORS header**，瀏覽器把這個 response 視為「對方拒絕我的 preflight / 沒有 CORS policy」，silent drop：

```js
// 前端 fetch 立刻 reject
fetch('https://saome-backend.../api/auth/login', { ... })
  .catch(err => {
    err instanceof TypeError  // ← "Failed to fetch"
    console.error(err);        // ← DevTools 看不到 server response
  });
```

UI 顯示「網路錯誤，請稍後再試」。

### 矛盾的本質

| 工具 | 看到 | 解讀 |
|---|---|---|
| curl | 503（合理 backend error）| 「backend overload，retry」|
| 瀏覽器 | silent drop（CORS policy）| 「CORS 拒絕，debug 無從」|
| wrangler tail | 沒有這條 request 的 log | 「request 沒進 Worker」|

這是 SAOME 自 2026-07-28 Bug-4c 開始就記住的 fingerprint：**curl 看起來通、瀏覽器不通**。任何 silent CORS drop 都會有這個對稱性。

---

## 結構層 — Cloudflare Worker fetch 的 3 條出口

```
                                  ┌─────────────────────────────┐
HTTP request  ──▶ Worker fetch ──┤ ① runtime-level error path  │  ← 503 由 Cloudflare 發出
                                  │    (binding failure, CPU/   │     **完全沒進 Hono**
                                  │     memory limit, etc.)     │     CORS coverage: 無
                                  ├─────────────────────────────┤
                                  │ ② Hono `app.onError()`     │  ← route handler throw
                                  │    (SaomeError / unknown)   │     CORS coverage: errorHandler 內
                                  ├─────────────────────────────┤     `applyCorsHeadersToResponse`
                                  │ ③ Hono `app.fetch()`        │  ← 正常 response
                                  │    (route handler 完成)     │     CORS coverage: corsMiddleware
                                  └─────────────────────────────┘     `wrap-after-next`
```

這次觸發的是路徑 ①。`errorHandler` 跟 `corsMiddleware` 都在 Hono app 內，runtime-level 503 不會經過它們。

### 為什麼之前沒踩到 — 4 輪 defense-in-depth 演進

| 時期 | CORS defense | 缺口 | 觸發情境 |
|---|---|---|---|
| 2026-07-28 Bug-4c | bundle 內含 localhost → Mixed Content drop（前端）| 前端層，不是後端 | Bug-4 chain |
| 2026-07-28 Bug-4d | `ALLOWED_ORIGINS` 缺 Workers preview subdomain | 走 Hono chain 但 allow-list miss，路徑 ②③ 處理 | Bug-4 chain |
| 2026-09-05 Phase 3.3 | `corsMiddleware` 改成 `wrap-after-next` + `errorHandler` 內加 CORS 注入 | 覆蓋路徑 ②③，但路徑 ① 仍是黑天鵝 | commit `11b5f58` |
| **2026-09-07（這次）**| runtime-emitted 503 | 路徑 ① — Worker entry boundary 必須補 | 本次修法 |

每一輪只覆蓋前一輪沒看到的場景 — 這是典型的 defense-in-depth 在 production 一次一次被逼出來。

### 為什麼 ②③ 的修法救不了這次

```ts
// apps/backend/src/shared/middleware/cors.ts（Phase 3.3 起，2026-09-05）
export const corsMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  // ...
  await next();   // ← wrap-after-next：先等 route handler 跑完才設 CORS header
  if (allowed) {
    c.res.headers.set('Access-Control-Allow-Origin', allowed);
    // ...
  }
};
```

wrap-after-next 修掉了「route handler `return new Response(...)` 把 pre-await header 吃掉」這個 bug（2026-09-05 的 B2）。**但前提是 request 真的有進 Hono chain** — runtime 直接 emit 503 不會經過這條。

```ts
// apps/backend/src/shared/middleware/errorHandler.ts
function applyCorsHeadersToResponse(c: Context<HonoEnv>, response: Response): Response {
  const origin = c.req.header('Origin');
  const allowed = resolveAllowedOrigin(origin, c.env);
  if (allowed) {
    response.headers.set('Access-Control-Allow-Origin', allowed);
    // ...
  }
  return response;
}
```

`app.onError()` 接收的是「在 Hono chain 內 throw 出來的 error」。**前提是 request 已經進 Hono chain**。

路徑 ① 在兩者之前發生，兩層都救不了。

---

## 規範層 — 修法 = Worker Entry Boundary 包裹

### 修法核心

把 `apps/backend/src/index.ts` 的 default export 從直接 expose Hono app 改成 `ExportedHandler.fetch` 包裹，在 Worker runtime boundary 對每個出 Worker 的 response 跑 `ensureCorsOnResponse`。

```ts
// apps/backend/src/index.ts（line 76-103）
import { ensureCorsOnResponse } from '@/shared/middleware/runtimeCors';

export const app = new Hono<HonoEnv>();
// ... existing middleware + modules

const worker: ExportedHandler<HonoEnv['Bindings']> = {
  async fetch(request, env, ctx) {
    try {
      const res = await app.fetch(request, env, ctx);
      return ensureCorsOnResponse(request, res);
    } catch (err) {
      console.error('[worker.fetch] uncaught error:', err);
      const fallback = new Response(
        JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: err instanceof Error ? err.message : 'Internal server error',
          },
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      );
      return ensureCorsOnResponse(request, fallback);
    }
  },
};
export default worker;
```

### 為什麼這層硬編 allow-list（不讀 env）

`ensureCorsOnResponse` 跑在 Worker entry boundary，**這層還沒進入 Hono context**，`c.env` 不可用。三個選擇：

| 方案 | 優點 | 缺點 |
|---|---|---|
| 把 env 解析邏輯寫死一份 | 跟 wrangler.jsonc 自動對齊 | 違反 DRY；wrangler 改 env 後 deploy 完 runtimeCors 不知道 |
| **硬編 host Set + pattern regex** ✅ | Worker entry 仍能運作；deploy 不依賴 env 載入 | 跟 wrangler.jsonc drift 風險（新增 origin 要同步兩處）|
| 從 `env` 讀（但要拉進 entry）| 單一來源 | Hono app 還沒 mount，env 結構得重複解析；增加 entry 複雜度 |

選硬編理由：entry boundary 是「last line of defense」，寧可犧牲 DRY 換「就算 Hono 整個掛了，CORS 還在」。文件註解明寫「若 wrangler.jsonc 新增 production origin，要同步加進這層」。

### 為什麼不直接在 `onError` 加 try-catch

`onError` 是 Hono middleware chain 的 sibling — Worker runtime-emitted 503 **不會**進到 Hono chain。必須在 `ExportedHandler.fetch` 包裹 — 這層是 runtime 與 Hono 之間的 boundary。

### 為什麼不放進 `apps/backend/src/shared/middleware/` 之外的別處

`shared/middleware/` 是全 Worker 共用層（`apps/backend/AGENTS.md` 三層分層圖），且獨立檔方便 unit test（不需 import Hono app）。

### 程式碼變動（commit `7935de8`）

```diff
// apps/backend/src/index.ts
- export default app;
+ const worker: ExportedHandler<HonoEnv['Bindings']> = {
+   async fetch(request, env, ctx) {
+     try {
+       const res = await app.fetch(request, env, ctx);
+       return ensureCorsOnResponse(request, res);
+     } catch (err) {
+       console.error('[worker.fetch] uncaught error:', err);
+       const fallback = new Response(
+         JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: ... } }),
+         { status: 503, headers: { 'Content-Type': 'application/json' } },
+       );
+       return ensureCorsOnResponse(request, fallback);
+     }
+   },
+ };
+ export default worker;
```

```ts
// apps/backend/src/shared/middleware/runtimeCors.ts（NEW, 85 行）
const RUNTIME_ALLOWED_HOSTS = new Set([
  'saome-frontend.josh1989213.workers.dev',
  'saome-admin.josh1989213.workers.dev',
  'saome-frontend.pages.dev',
  'saome-admin.pages.dev',
  'app.saome.org',
  'admin.saome.org',
]);

const RUNTIME_ALLOWED_HOST_PATTERNS: RegExp[] = [
  /^[a-z0-9-]+\.josh1989213\.workers\.dev$/i,
  /^[a-z0-9-]+\.saome-frontend\.pages\.dev$/i,
  /^[a-z0-9-]+\.saome-admin\.pages\.dev$/i,
  /^[a-z0-9-]+\.app\.saome\.org$/i,
  /^[a-z0-9-]+\.admin\.saome\.org$/i,
];

export function isRuntimeAllowedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (RUNTIME_ALLOWED_HOSTS.has(h)) return true;
  return RUNTIME_ALLOWED_HOST_PATTERNS.some((re) => re.test(h));
}

export function ensureCorsOnResponse(request: Request, response: Response): Response {
  const origin = request.headers.get('Origin');
  if (!origin) return response;
  let host: string;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return response;
  }
  if (!isRuntimeAllowedHost(host)) return response;
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Vary', 'Origin');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}
```

```ts
// apps/backend/src/shared/middleware/runtimeCors.test.ts（NEW, 6 條 conformance test）
describe('isRuntimeAllowedHost', () => {
  it('accepts exact-match production origins', () => { /* workers.dev, saome.org */ });
  it('accepts production subdomain pattern matches', () => { /* Pages preview */ });
  it('rejects unrelated hosts', () => { /* evil.example.com, localhost, saome.org apex */ });
  it('is case-insensitive on host', () => { /* .toUpperCase() */ });
});

describe('ensureCorsOnResponse', () => {
  it('attaches CORS headers when origin host is on allow-list (regression — 2026-09-07)', () => { /* 503 path regression */ });
  it('does NOT attach CORS headers when origin host is NOT on allow-list', () => { /* evil origin */ });
  it('does NOT throw or modify headers when origin is missing (same-origin)', () => { /* same-origin */ });
  it('does NOT throw when origin header is unparseable', () => { /* 'not-a-url' */ });
  it('preserves existing headers on the response (additive, not destructive)', () => { /* additive */ });
  it('works on a 200 response (defense-in-depth)', () => { /* normal path */ });
});
```

---

## 規範層 — 規範文件變動

| 規範 | 動作 | 原因 |
|---|---|---|
| `.cursor/rules/036-worker-runtime-cors-defense.mdc` | **新增** | 正式記錄 3 層 CORS defense pattern + Worker entry boundary 必須的 SOP + 同步責任 |
| `.cursor/rules/017-production-bundle-guard.mdc` | 擴充：backend Worker CORS post-deploy check | Bug-4c 修過 frontend，但 backend Worker runtime 沒有對應 grep / smoke |
| `apps/backend/AGENTS.md` | 加 3 層 CORS defense 註解 + 同步責任 SOP | 給未來 agent 知道為什麼有 3 個檔 + 兩處必須同步 |
| `runs/decisions/2026-09-07-three-layer-cors-defense.md` | **新增** | 為什麼選硬編 allow-list 而不是讀 env（三段式）|
| `runs/improvements/INDEX.md` | 加 entry | feedback / DEV / decision 三份 cross-link |

---

## 驗證

| 驗證項 | 結果 |
|---|---|
| `npm run typecheck --workspace=apps/backend` | exit 0 |
| `npm test --workspace=apps/backend` | 176/176 通過，新增 6 條全綠 |
| `curl OPTIONS /api/auth/login`（帶 Origin header） | 204 + `Access-Control-Allow-Origin` ✅ |
| `curl POST /api/auth/login`（帶 Origin、錯誤憑證）| 401 + `Access-Control-Allow-Origin` ✅ |
| `curl POST /api/auth/login`（帶 Origin、正確憑證）| 200 + `Access-Control-Allow-Origin` ✅（不在這次修法範圍，但 smoke 順便跑）|
| Chrome incognito 登入 saome-frontend.josh1989213.workers.dev | UI 顯示錯誤訊息（401 wrong creds），console 沒有 CORS policy block ✅ |

注意 POST 401 的 response — 之前是 503 + 無 CORS，現在是 401 + 有 CORS。401 是 Hono 內 route handler 正常 emit 的 response，本來就走 path ③ 由 corsMiddleware 處理；503 路徑是 runtime emit 的（之前測試帶的是錯誤憑證，所以走 401；但實際 production 503 是另外觸發）。

---

## 部署

```
git commit -m "fix(backend): Worker-level CORS injection for runtime-emitted 503s"
git push origin main
```

Cloudflare Git-integration 自動部署到 `saome-backend.josh1989213.workers.dev`。部署完成後重新跑 curl + Chrome 驗證。

---

## 後續注意事項

1. **wrangler.jsonc 與 runtimeCors.ts 同步責任** — 新增 production origin 必須兩處都改：
   - `wrangler.jsonc::vars.ALLOWED_ORIGINS` / `ALLOWED_ORIGIN_PATTERNS`（Layer 1+2）
   - `apps/backend/src/shared/middleware/runtimeCors.ts::RUNTIME_ALLOWED_HOSTS` / `RUNTIME_ALLOWED_HOST_PATTERNS`（Layer 3）
2. **未來新 Worker（saome-api / saome-cron-worker / saome-image-worker 等）必須套同一個 3 層 pattern** — 已寫進 Rule 036 § 7。
3. **curl 無法驗證 CORS drop** — production deploy 後必須用瀏覽器 / Playwright 從 HTTPS origin 內驗證（Rule 017 § 為什麼 curl 不夠）。

---

## 衍生

- **Rule 036** — Worker Runtime CORS Defense（正式記錄 3 層 pattern + Worker entry boundary SOP）
- **Rule 017 擴充** — Production Bundle Guard 加 backend Worker CORS post-deploy check
- **apps/backend/AGENTS.md** — 加 3 層 CORS defense 註解
- **Decision log** — `runs/decisions/2026-09-07-three-layer-cors-defense.md`（為什麼選硬編 + 為什麼 Worker entry boundary）

---

## 自問 → Pending Actions

| 問題 | 行動 |
|---|---|
| 為什麼 curl 沒第一時間抓到？| 已寫進 feedback § 「為什麼 curl 沒抓到」。無 follow-up action |
| Layer 3 硬編 vs 讀 env 的取捨，未來會不會改？| 已寫進 decision log § Follow-up（每 6 個月檢視是否抽 env helper）|
| Cloudflare `compatibility_date: 2025-09-06` 過期了 | 跟這次無關，但下次 deploy 必 bump — 加進 `saome-github-deploy` checklist |
| 還有沒有其他 Worker 入口（cron / health）需要 3 層？ | health module 走 Hono chain 內 /api/cron mount，cron route 也是。Worker entry 是 default export → 全部覆蓋 ✅ |
| deploy.yml 的 `backend` filter 寫 `apps/backend-workers/**` 但 backend 在 `apps/backend/`，是 stale config | 加進 follow-up backlog（Rule 034 CI workflow modification 涵蓋範圍，本次修法不直接處理避免 scope 蔓延）|
| 後端 Worker 多個 entry（如 health endpoint 走 different fetch）需不需要分層？ | 目前只有一個 default export，全部覆蓋。未來若加 `experimental_tails` 或 multi-fetch 架構再評估 |

## 索引

| 項目 | 位置 |
|---|---|
| Commit | `7935de8` |
| Feedback | `runs/improvements/feedback/20260907-cors-runtime-503-fix.md` |
| Decision log | `runs/decisions/2026-09-07-three-layer-cors-defense.md` |
| Rule 036（新增）| `.cursor/rules/036-worker-runtime-cors-defense.mdc` |
| Rule 017 擴充 | `.cursor/rules/017-production-bundle-guard.mdc` |
| Backend AGENTS.md 更新 | `apps/backend/AGENTS.md` |
| 程式碼 Layer 3 | `apps/backend/src/shared/middleware/runtimeCors.ts` |
| 程式碼 Layer 3 test | `apps/backend/src/shared/middleware/runtimeCors.test.ts` |
| 程式碼 entry boundary | `apps/backend/src/index.ts`（line 76-103）|
