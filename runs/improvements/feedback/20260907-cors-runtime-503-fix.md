---
title: "2026-09-07 Production Login CORS Drop — Worker-Level 503 Bypasses Hono Middleware"
date: 2026-09-07
type: bug-trace
scope: backend/runtime-cors
status: resolved
severity: SEV-1
commits:
  - 7935de8   # fix(backend): Worker-level CORS injection for runtime-emitted 503s
---

# 2026-09-07 Production Login CORS Drop — Worker-Level 503 Bypasses Hono Middleware

## TL;DR

Production frontend `https://saome-frontend.josh1989213.workers.dev` 送出的 `POST /api/auth/login`，在某些情境下回 503 且 **沒有任何 CORS header**。瀏覽器把 response 視為 CORS 失敗，**silent drop** — 使用者看到「Network error」、DevTools 只看到 TypeError，curl 完全看不出來。根因是 503 來自 Cloudflare Worker runtime（在 Hono middleware chain 啟動**之前**），Hono 的 `corsMiddleware` 跟 `errorHandler` 都只活在 Hono chain 內，覆蓋不到這個出口。修法：在 `apps/backend/src/index.ts` 加第 3 層 CORS defense（Worker entry boundary 的 `ExportedHandler.fetch` 包裹），讓所有離開 Worker 的 response — 包括 runtime-emitted 503 — 都過 `ensureCorsOnResponse`。

## 症狀（user-visible）

| 表面 | 觀察 |
|---|---|
| 前端 UI | 點登入 → 卡片顯示「網路錯誤，請稍後再試」 |
| DevTools Network | POST 回 503，response headers 沒有 `Access-Control-Allow-Origin`，fetch promise reject `TypeError: Failed to fetch` |
| 後端 wrangler log | **沒有這條 request 的 log**（沒進到 Hono chain 就被 runtime 拒絕）|
| curl `POST /api/auth/login`（無 Origin header）| 回 503（runtime 拒絕） |
| curl `POST /api/auth/login` 帶 `Origin: https://evil.example.com` | 回 503，沒 CORS header |
| curl `OPTIONS /api/auth/login` | 回 204，有 CORS header（這條會進 Hono） |

關鍵矛盾：**curl 看起來都 503 / 204，但瀏覽器看到的失敗訊息跟 curl 完全對不上**。這是 Mixed Content / CORS drop 的經典 fingerprint。

## 時間軸（trace）

| 時間 (UTC+8) | 事件 |
|---|---|
| 2026-09-07 ~02:00 | 部署 CORS allow-list 擴增（Workers preview subdomain）後，部分登入仍失敗 |
| 2026-09-07 ~02:10 | 開始 curl 排查：OPTIONS 204 ✓、POST 200 (正確憑證) ✓、POST 401 (錯誤憑證) ✓；但 Chrome incognito 仍失敗 |
| 2026-09-07 ~02:15 | DevTools Network 顯示 503 + 無 CORS header。Wrangler tail 沒這條 request → runtime 直接拒絕 |
| 2026-09-07 ~02:20 | 確認根因：runtime-emitted 503 繞過 Hono chain |
| 2026-09-07 ~02:25 | 實作 `runtimeCors.ts` + `index.ts` 包 `ExportedHandler.fetch` |
| 2026-09-07 ~02:30 | typecheck / vitest 全綠（新增 6 條 conformance test）|
| 2026-09-07 ~02:35 | commit `7935de8` + push → Cloudflare Git-integration auto-deploy |
| 2026-09-07 ~02:40 | curl OPTIONS + POST 重測：OPTIONS 204 + CORS、POST 401 + CORS、Chrome incognito 登入成功 |

## 根因（為什麼 503 在 runtime level）

Cloudflare Worker 的 `fetch` handler 出口有 3 條路徑，每條對應不同的 CORS coverage：

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

### 為什麼之前沒踩到

| 時期 | CORS defense | 缺口 |
|---|---|---|
| 2026-07-28 Bug-4c | bundle 內含 localhost → Mixed Content drop（前端） | 前端層，不是後端 |
| 2026-07-28 Bug-4d | `ALLOWED_ORIGINS` 缺 Workers preview subdomain | 走 Hono chain 但 allow-list miss，路徑 ②③ 處理 |
| 2026-09-05 Phase 3.3 | `corsMiddleware` 改成 `wrap-after-next` + `errorHandler` 內加 CORS 注入 | 覆蓋路徑 ②③，但路徑 ① 仍是黑天鵝 |
| **2026-09-07（這次）**| runtime-emitted 503 | 路徑 ①，必須在 Worker entry boundary 補 |

每一輪只覆蓋前一輪沒看到的場景 — 這是典型的 defense-in-depth 在 production 一次一次被逼出來。

## 修法（3 層 CORS defense，belt-and-suspenders）

### Layer 1 — `corsMiddleware`（Hono chain 內）

```ts
// apps/backend/src/shared/middleware/cors.ts
await next();   // ← 先 await route handler
if (allowed) {
  c.res.headers.set('Access-Control-Allow-Origin', allowed);
  // ...
}
```

- 覆蓋：路徑 ③（正常 response）
- 來源：env-driven allow-list + patterns
- 特性：`wrap-after-next` 確保 handler 即使 `return new Response(...)` 也帶 CORS

### Layer 2 — `errorHandler`（Hono chain 內）

```ts
// apps/backend/src/shared/middleware/errorHandler.ts
function applyCorsHeadersToResponse(c, response) {
  const origin = c.req.header('Origin');
  const allowed = resolveAllowedOrigin(origin, c.env);
  if (allowed) { /* set headers */ }
  return response;
}
```

- 覆蓋：路徑 ②（SaomeError / unknown throw）
- 來源：env-driven allow-list（跟 Layer 1 共用 `resolveAllowedOrigin`）
- 特性：`onError` 是 middleware chain 的 sibling — throw 出去後 middleware 不會 wrap-after-next，所以 errorHandler 自己必須 set headers

### Layer 3 — `ensureCorsOnResponse`（Worker entry boundary）← 本次新增

```ts
// apps/backend/src/shared/middleware/runtimeCors.ts
export function ensureCorsOnResponse(request, response) {
  const origin = request.headers.get('Origin');
  if (!origin) return response;
  const host = new URL(origin).host.toLowerCase();
  if (!isRuntimeAllowedHost(host)) return response;   // 硬編 allow-list
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Vary', 'Origin');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}

// apps/backend/src/index.ts
const worker = {
  async fetch(request, env, ctx) {
    try {
      const res = await app.fetch(request, env, ctx);
      return ensureCorsOnResponse(request, res);
    } catch (err) {
      const fallback = new Response(
        JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: ... } }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
      return ensureCorsOnResponse(request, fallback);
    }
  },
};
export default worker;
```

- 覆蓋：路徑 ①（Worker runtime-emitted 503）— **這次新增的場景**
- 來源：**硬編 allow-list**（不靠 env，因為 Worker entry 還沒拿到 `c.env`）
- 特性：
  - 不在 Hono chain 內，獨立檔 `runtimeCors.ts`，可單獨 unit test
  - 只 echo back allow-list 內的 origin（防 evil.com）
  - 即使路由 handler throw 且 `onError` 跳過（Hono 內部錯誤），catch block 也會走 ensureCorsOnResponse

### 為什麼 Layer 3 硬編 allow-list（不讀 env）

`ensureCorsOnResponse` 跑在 Worker entry boundary，**這層還沒進入 Hono context**，所以 `c.env` 不可用。三個選擇：

| 方案 | 優點 | 缺點 |
|---|---|---|
| 把 env 解析寫死一份 | 跟 wrangler.jsonc 自動對齊 | 違反 DRY；wrangler 改 env 後 deploy 完 runtimeCors 不知道 |
| **硬編 host Set + pattern regex** ✅ | Worker entry 仍能運作；deploy 不依賴 env 載入 | 跟 wrangler.jsonc drift 風險（新增 origin 要同步兩處） |
| 從 `env` 讀（但要拉進 entry） | 單一來源 | Hono app 還沒 mount，env 結構得重複解析；增加 entry 複雜度 |

選硬編理由：entry boundary 是「last line of defense」，寧可犧牲 DRY 換「就算 Hono 整個掛了，CORS 還在」。文件註解明寫「若 wrangler.jsonc 新增 production origin，要同步加進這層」。

## 測試覆蓋

新增 `apps/backend/src/shared/middleware/runtimeCors.test.ts`，6 條 conformance test：

| # | Test | 覆蓋 |
|---|---|---|
| 1 | `isRuntimeAllowedHost` exact match | production workers.dev / saome.org |
| 2 | `isRuntimeAllowedHost` pattern match | Pages preview subdomain |
| 3 | `isRuntimeAllowedHost` 拒絕 unrelated host | 防 evil.example.com / localhost |
| 4 | `ensureCorsOnResponse` 帶 allow-list origin 的 503 → 加 CORS header | **本次事故回歸測試** |
| 5 | `ensureCorsOnResponse` 帶 evil origin → 不加 CORS header | 安全邊界 |
| 6 | `ensureCorsOnResponse` preserve existing headers | 與 requestId 等 middleware 並存 |

加上既有的 `corsMiddleware.test.ts`（Bug-4d regression）+ `cors.test.ts`（resolveAllowedOrigin 邏輯），3 個測試檔共同 pin 死 3 層防禦的行為。

## 為什麼 curl 沒第一時間抓到

```bash
curl https://saome-backend.josh1989213.workers.dev/api/auth/login
# → 503（runtime 拒絕）
# curl 不在 HTTPS origin 內，沒有 CORS 規則，503 直接 body 給你看
```

**curl 看起來是「backend 503」，跟「正常 503」無法區分**。只有從 HTTPS origin 內 fetch 才會觸發瀏覽器的 CORS drop，這是 SAOME 自 2026-07-28 Bug-4c 開始就記住的 fingerprint：curl 看起來通、瀏覽器不通。

## 自問

**Q：為什麼是 Worker entry boundary 而不是 onError 內多寫一段？**
A：`onError` 在 Hono app 內，runtime-emitted 503 還沒進 Hono 就被 runtime 拒絕。必須在 Worker `ExportedHandler.fetch` 包裹 — 這層是 runtime 與 Hono 之間的 boundary。

**Q：為什麼硬編 allow-list 而不是用 env？**
A：Worker entry boundary 拿不到 `c.env`。寧可犧牲 DRY 換「Hono 整個掛了，CORS 還在」。文件註解明寫同步責任。

**Q：會不會有 evil origin 偽造 Origin header 騙到 CORS？**
A：`isRuntimeAllowedHost` 用 hard-coded Set + regex pattern 比對，evil.example.com 不在白名單上就不會 echo。但要注意這是 defense-in-depth — 主守門員仍是 Hono 內的 corsMiddleware（env-driven，會拒絕並 return 不帶 CORS 的 response）。

**Q：之後新增 production origin 要記得同步哪兩個地方？**
A：兩處：
1. `wrangler.jsonc::vars.ALLOWED_ORIGINS` / `ALLOWED_ORIGIN_PATTERNS`（Layer 1+2）
2. `apps/backend/src/shared/middleware/runtimeCors.ts::RUNTIME_ALLOWED_HOSTS` / `RUNTIME_ALLOWED_HOST_PATTERNS`（Layer 3）
兩處必須 commit 在同一個 PR。Rule 036 把這個 SOP 寫死。

## 規範層影響

本次新增/修正：

| 規範 | 動作 | 原因 |
|---|---|---|
| `.cursor/rules/036-worker-runtime-cors-defense.mdc` | **新增** | 正式記錄 3 層 CORS defense pattern + Worker entry boundary 必須的 SOP |
| `.cursor/rules/017-production-bundle-guard.mdc` | 擴充 backend Worker CORS post-deploy check | Bug-4d 修過 frontend，但 backend Worker runtime 沒有對應 grep / smoke |
| `apps/backend/AGENTS.md` | 加 3 層 CORS defense 註解 | 給未來 agent 知道為什麼有 3 個檔 + 同步責任 |

詳見決策 log：`runs/decisions/2026-09-07-three-layer-cors-defense.md`。

## 學習

| 項目 | 說明 |
|---|---|
| Worker entry boundary 是 Hono 之外的世界 | `ExportedHandler.fetch` 包裹是 runtime-emitted error 的最後一道防線 |
| defense-in-depth 在 production 一次一次長出來 | Bug-4c → 4d → 本次，每輪只覆蓋前輪沒看到的場景 |
| 硬編 allow-list 是 trade-off，不是 anti-pattern | entry boundary 拿不到 env；寧可犧牲 DRY 換 last-line-of-defense |
| curl 看不到 CORS drop | SAOME 2026-07-28 Bug-4c 起的 fingerprint；debug 必須從瀏覽器 DevTools / Playwright 驗 |

## 參照

- `apps/backend/src/index.ts`（line 76-103, Worker entry boundary）
- `apps/backend/src/shared/middleware/runtimeCors.ts`（Layer 3 實作）
- `apps/backend/src/shared/middleware/runtimeCors.test.ts`（6 條 conformance test）
- `apps/backend/src/shared/middleware/cors.ts`（Layer 1）
- `apps/backend/src/shared/middleware/errorHandler.ts`（Layer 2）
- `apps/backend/wrangler.jsonc`（Layer 1+2 的 env-driven allow-list）
- commit `7935de8` — fix(backend): Worker-level CORS injection for runtime-emitted 503s
- `runs/improvements/feedback/20260808-admin-login-6-bug-chain-index.md` — Bug-4c/4d 同源 fingerprint
- `.cursor/rules/036-worker-runtime-cors-defense.mdc` — 本次新增的 rule
