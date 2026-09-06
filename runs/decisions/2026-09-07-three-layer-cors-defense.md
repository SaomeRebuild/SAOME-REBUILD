# Decision：3-Layer CORS Defense（Worker Runtime Boundary）

## Metadata

- **日期**：2026-09-07
- **作者**：Josh（agent-assisted via Cursor）
- **觸發**：2026-09-07 production 登入 CORS drop — Worker runtime 直接 emit 503，繞過 Hono middleware chain，導致 `Access-Control-Allow-Origin` header 缺席、瀏覽器 silent drop
- **規則 / skill 觸發**：`001-methodology.mdc` L3 Heavy（含 Critical chain bridge；auth 是 critical chain，bug fix 必走 production smoke + Decision Log）
- **Commit**：`7935de8` — fix(backend): Worker-level CORS injection for runtime-emitted 503s
- **對應 feedback**：`runs/improvements/feedback/20260907-cors-runtime-503-fix.md`
- **對應 DEV LOG**：`DEV/09-2026/0907-cors-runtime-503-fix.md`

---

## 背景

### user-visible symptom

登入按鈕按下後，前端 fetch promise 立刻 reject `TypeError: Failed to fetch`，UI 顯示「網路錯誤」。DevTools Network 顯示 POST 收到 **503** + response 完全沒有 `Access-Control-Allow-Origin`。wrangler tail 找不到這條 request。

### curl vs 瀏覽器的不對稱

| 工具 | 看到 | 解讀 |
|---|---|---|
| `curl -i -X POST /api/auth/login`（帶 Origin header） | 503 + 沒有 CORS header | 「backend overload」之類的合理錯誤 |
| Chrome incognito（HTTPS origin 內） | fetch reject `TypeError` | 「CORS policy 拒絕，silent drop」|

### 關鍵矛盾

`OPTIONS /api/auth/login`（帶 Origin）回 **204 + 完整 CORS header** — 證明 Hono chain 內的 corsMiddleware 正常；但 POST 卻走完全不同的路徑。

### Cloudflare Worker fetch 出口的 3 條路徑

```
                                 ┌─────────────────────────────┐
HTTP request ─▶ Worker fetch ──┤ ① runtime-level error path  │ ← 503 由 Cloudflare 發出
                                 │    (binding failure, CPU/   │   完全沒進 Hono
                                 │     memory limit, etc.)     │   CORS coverage: 無
                                 ├─────────────────────────────┤
                                 │ ② Hono `app.onError()`     │ ← route handler throw
                                 │    (SaomeError / unknown)   │   CORS coverage: errorHandler 內
                                 │                              │   `applyCorsHeadersToResponse`
                                 ├─────────────────────────────┤
                                 │ ③ Hono `app.fetch()`        │ ← 正常 response
                                 │    (route handler 完成)     │   CORS coverage: corsMiddleware
                                 └─────────────────────────────┘   `wrap-after-next`
```

### 為什麼前幾輪沒踩到

| 時期 | CORS defense | 缺口 |
|---|---|---|
| 2026-07-28 Bug-4c | bundle 內含 localhost → Mixed Content drop（前端） | 前端層，不是後端 |
| 2026-07-28 Bug-4d | `ALLOWED_ORIGINS` 缺 Workers preview subdomain | 走 Hono chain 但 allow-list miss，路徑 ②③ 處理 |
| 2026-09-05 Phase 3.3 | `corsMiddleware` 改成 `wrap-after-next` + `errorHandler` 內加 CORS 注入 | 覆蓋路徑 ②③，但路徑 ① 仍是黑天鵝 |
| **2026-09-07（這次）** | runtime-emitted 503 | 路徑 ① — Worker entry boundary 必須補 |

每一輪只覆蓋前一輪沒看到的場景 — 這是 defense-in-depth 在 production 一次一次被逼出來的典型節奏。

---

## 選項

### 選項 A：在 `app.onError()` 加 try-catch（最簡單，看起來對）

```ts
app.onError((err, c) => {
  try {
    return buildErrorResponse(c, err);
  } catch (innerErr) {
    return new Response('Internal Server Error', { status: 503 });
  }
});
```

**優點**：1 行程式碼。
**致命缺點**：`onError` 是 Hono middleware chain 的 sibling — Worker runtime 直接 emit 的 503 **完全不會進到 Hono chain**，自然也不會走 `onError`。這個改法對 production 觸發情境完全無效。

### 選項 B：把 allow-list 也寫進 Hono context（用 `c.env`）

```ts
const worker = {
  async fetch(request, env, ctx) {
    const res = await app.fetch(request, env, ctx);
    if (!res.headers.has('Access-Control-Allow-Origin')) {
      const origin = request.headers.get('Origin');
      const allowed = resolveAllowedOrigin(origin, env);
      if (allowed) {
        res.headers.set('Access-Control-Allow-Origin', allowed);
      }
    }
    return res;
  },
};
```

**優點**：跟 wrangler.jsonc `ALLOWED_ORIGINS` / `ALLOWED_ORIGIN_PATTERNS` 自動對齊；新增 production origin 只要改 wrangler.jsonc 即可。
**致命缺點**：Hono app **已經** mount 過 corsMiddleware 跟 errorHandler 處理過 CORS（路徑 ②③）；如果 response 沒有 `Access-Control-Allow-Origin`，那是因為 ① runtime 直接拒絕、或 ②③ 真的設漏了。這條選項在「runtime 直接拒絕」場景會**重複**做 corsMiddleware 的工作但**沒**新增覆蓋 — 因為 runtime 直接 emit 的 response 根本沒進 Hono，這層 entry 只看得到 response object。

更重要的是：把 CORS 邏輯分散在兩處（corsMiddleware 跟 entry wrapper）違反 single source of truth。

### 選項 C：硬編 allow-list（不靠 env）+ Worker entry boundary 包裹 ✅

```ts
// apps/backend/src/shared/middleware/runtimeCors.ts（NEW）
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

export function ensureCorsOnResponse(request, response) {
  const origin = request.headers.get('Origin');
  if (!origin) return response;
  let host;
  try { host = new URL(origin).host.toLowerCase(); }
  catch { return response; }
  if (!isRuntimeAllowedHost(host)) return response;
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Vary', 'Origin');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}

// apps/backend/src/index.ts
const worker: ExportedHandler<HonoEnv['Bindings']> = {
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

**優點**：

1. **真正的 runtime boundary**：Worker entry 是 Hono 之外的世界，`ExportedHandler.fetch` 是 runtime 跟 Hono 之間的唯一接縫。這層包裹保證「不論 response 從哪條路徑出 Worker」，CORS 都會被注入。
2. **不依賴 env**：Worker entry 拿不到 `c.env`（request 還沒進 Hono）；硬編 allow-list 是唯一可選方案。
3. **獨立可測**：`runtimeCors.ts` 不 import Hono app，6 條 conformance test 可在 workerd pool 內獨立跑（不需要 mock 整個 backend）。
4. **fail-safe**：即使 Hono 整個掛了、corsMiddleware 沒 mount、errorHandler 沒掛，這層 entry 仍會帶 CORS — **last line of defense**。
5. **dev / preview 預設不命中**：allow-list 只列 production 域名；dev (localhost) 跟 Cloudflare Pages preview 不會被這層 echo CORS（避免 Layer 1+2 還沒 mount 就被 Layer 3 接管的情境）。

**缺點**：

1. **跟 wrangler.jsonc drift 風險**：硬編一份 allow-list，跟 env-driven allow-list 分裂。新增 production origin 必須**同步兩處**。
2. **違反 DRY**：兩份 allow-list 結構近似但不完全相同（regex vs glob，Set vs comma-separated）。
3. **沒處理 R2 / cron / health 之外的入口**：目前 backend 只有 `default export`，Worker entry 全覆蓋；但未來若開新 Worker（如 saome-api、saome-cron-worker），每個都要單獨套同樣 pattern。

---

## 決策

**選擇**：**C** — 硬編 allow-list + Worker entry boundary 包裹

**理由**：

1. **真實解掉 production 觸發**：A 跟 B 都沒解決「runtime 直接 emit 503」這條路徑；C 是唯一覆蓋這條路徑的選項。
2. **last line of defense > DRY**：寧可犧牲 DRY 換「Hono 整個掛了，CORS 還在」。Entry boundary 是 fail-safe 性質，單一職責比複用重要。
3. **獨立可測**：`runtimeCors.ts` 不 import Hono、不讀 env，是純函式 + 純資料 → 6 條 conformance test 涵蓋所有 corner case（exact / pattern / case / evil origin / no origin / unparseable origin / existing headers）。
4. **可立即 ship**：現有架構 + 1 個新 middleware 檔 + 1 個 test 檔 + index.ts 改 ~25 行 = 完整 fix。不需動 schema、不需動 wrangler、不需動 corsMiddleware（減少 surface regression 風險）。

### Trade-offs（誠實列出）

| 取捨 | 影響 | 接受度 |
|---|---|---|
| 兩份 allow-list drift 風險 | 新增 production origin 必須兩處改 | 中 — Rule 036 § 同步責任 SOP 寫死；未來每 6 個月檢視是否抽 env helper |
| 違反 DRY | 兩處 regex / glob 結構近似但不同 | 高 — trade-off 換 last-line-of-defense |
| 沒處理新 Worker | saome-api / saome-cron-worker 等要重複套 | 中 — Rule 036 § 7 強制 SOP；新 Worker 必走同樣 pattern |
| 硬編清單可能過期 | 一年後 production 域名若改，這層會 silent miss | 中 — 6 個月 review + 每次 deploy 必跑 smoke test |

---

## 影響

### 新增檔案

| 檔案 | 角色 |
|---|---|
| `apps/backend/src/shared/middleware/runtimeCors.ts` | Layer 3 — `ensureCorsOnResponse` + `isRuntimeAllowedHost` |
| `apps/backend/src/shared/middleware/runtimeCors.test.ts` | 6 條 conformance test（exact / pattern / reject / case-insensitive / no-origin / unparseable / preserve-headers / 200 defense-in-depth）|
| `.cursor/rules/036-worker-runtime-cors-defense.mdc` | 正式記錄 3 層 pattern + 同步責任 SOP + Worker entry boundary 概念 |

### 修改檔案

| 檔案 | 改動 |
|---|---|
| `apps/backend/src/index.ts` | default export 從 `app` 改 `worker`（`ExportedHandler<HonoEnv['Bindings']>` 包裹）；import `ensureCorsOnResponse`；Worker entry 加 try-catch fallback 503 |
| `apps/backend/AGENTS.md` | 加 3 層 CORS defense 註解 + 同步責任 SOP |
| `.cursor/rules/017-production-bundle-guard.mdc` | 擴充：backend Worker CORS post-deploy check（curl OPTIONS + POST 帶 Origin 必回 CORS header）|
| `runs/improvements/INDEX.md` | 加 entry（feedback / DEV LOG / decision log 三份）|

### 沒變動的檔案（刻意保持現狀）

| 檔案 | 為什麼不改 |
|---|---|
| `apps/backend/src/shared/middleware/cors.ts` | Layer 1 — wrap-after-next 已正確；Hono chain 內 200 response 仍走這層 |
| `apps/backend/src/shared/middleware/errorHandler.ts` | Layer 2 — `applyCorsHeadersToResponse` 已正確；Hono chain 內 4xx/5xx response 仍走這層 |
| `apps/backend/wrangler.jsonc` | Layer 1+2 的 env-driven allow-list；跟硬編 Layer 3 故意分離（見決策理由 #2）|

---

## 同步責任 SOP（MANDATORY — 寫進 Rule 036）

未來新增任何 production origin：

1. **必跑** `apps/backend/wrangler.jsonc::vars.ALLOWED_ORIGINS` 加新 origin（或 `ALLOWED_ORIGIN_PATTERNS` 加新 pattern）
2. **必跑** `apps/backend/src/shared/middleware/runtimeCors.ts::RUNTIME_ALLOWED_HOSTS` 加新 host（或 `RUNTIME_ALLOWED_HOST_PATTERNS` 加新 regex）
3. **同一個 PR** 帶齊上面兩個改動 + 一條 conformance test 驗證新 origin 被兩處都接受
4. **PR 描述必填**「同步加進 wrangler.jsonc 跟 runtimeCors.ts」checklist
5. **deploy 後必跑** smoke test：curl `OPTIONS /api/auth/login` 帶新 origin 必須回 CORS header；curl `POST /api/auth/login` 帶新 origin 即使 401 也必須回 CORS header

---

## 自問

- **下次怎麼不犯？**
  - 任何 Cloudflare Worker 都必須把 `default export` 包成 `ExportedHandler.fetch`（Rule 036 § 3），不可直接 export Hono app
  - 任何 backend Worker 的 CORS defense 都必須 3 層全覆蓋（Rule 036 § 6）
- **哪條 rule 該補？**
  - 新增 `.cursor/rules/036-worker-runtime-cors-defense.mdc`（本決策衍生）
  - `.cursor/rules/017-production-bundle-guard.mdc` 擴充 backend Worker CORS post-deploy check
  - `apps/backend/AGENTS.md` 加 3 層 CORS defense 註解
- **哪個 test 該加？**
  - `apps/backend/src/shared/middleware/runtimeCors.test.ts`（已加 6 條）
  - 既有 `corsMiddleware.test.ts`（Bug-4d regression）+ `errorHandler.test.ts`（SaomeError CORS regression）— 3 個測試檔共同 pin 死 3 層防禦的行為
- **production smoke test 涵蓋哪些？**
  - SEV-1 auth chain → 必須 production smoke：Chrome incognito 登入 saome-frontend.josh1989213.workers.dev，console 必須沒有 CORS policy block
  - 每次 deploy backend 必跑 `curl OPTIONS` + `curl POST`（帶 Origin header）確認兩條都回 CORS header（Rule 017 擴充）

## Follow-up

| Priority | Task | 評估 |
|---|---|---|
| P1 | 半年後檢視是否可以把硬編 allow-list 抽成 env helper（從 `env.ALLOWED_RUNTIME_ORIGINS` 讀），同步兩處改成單一來源 | F1 — 半年後若 dev experience 痛就抽 env helper |
| P1 | 未來新增任何 Cloudflare Worker（saome-api / saome-cron-worker / saome-image-worker 等）必套同樣 3 層 pattern；Rule 036 § 7 強制 SOP | 持續 |
| P2 | 抽 `isRuntimeAllowedHost` 到 `shared/lib/corsAllowlist.ts`，讓多個 Worker 共用一份 allow-list 資料 | F1 — 第二個 Worker 出現時啟動 |
| P2 | 加 Playwright smoke test：跨 origin 登入必須成功（取代人工 Chrome incognito 驗證）| F1 — Playwright infra ready 後啟動 |
| P3 | Worker entry boundary 加 structured logging（`[worker.fetch] uncaught error: ...`）目前只有 `console.error`，可升級成 `structured log` 進 Cloudflare Logpush | F3 |

## Sync 狀態

- **狀態**：Decision Log 已寫
- **下一步**：建立 Rule 036 + 擴充 Rule 017 + 更新 apps/backend/AGENTS.md → 更新 INDEX.md → commit & push
- **本次 commit 範圍**：decision log + DEV log + Rule 036 + Rule 017 擴充 + AGENTS.md 更新 + INDEX.md 更新（規範層）+ feedback（已存在 untracked，補 commit）
