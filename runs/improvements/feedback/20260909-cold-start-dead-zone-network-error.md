---
title: "2026-09-09 Cold Start 503 Dead Zone — Frontend Network-Error Retry + LoginPage Warmup"
date: 2026-09-09
type: bug-trace
scope: frontend/cold-start-defense
status: resolved
severity: SEV-2
commits:
  - (this PR)   # fix(frontend): close cold-start 503 dead zone — network-error retry + LoginPage warmup
related:
  - runs/improvements/feedback/20260907-cors-runtime-503-fix.md
  - runs/decisions/2026-09-07-three-layer-cors-defense.md
  - .cursor/rules/036-worker-runtime-cors-defense.mdc
---

# 2026-09-09 Cold Start 503 Dead Zone — Frontend Network-Error Retry + LoginPage Warmup

## TL;DR

0907 修的三層 CORS defense 已經覆蓋 Hono chain 內 + Layer 3 Worker entry boundary，但 **Worker isolate cold start 早期**（isolate 還沒載到 entry code 就 emit 的 503）繞過 Layer 3 — 瀏覽器看到「無 CORS header」直接 silent drop，fetch 拋出 `TypeError("Failed to fetch")`。User 看到的「Network error」實際上是 cold start + CORS drop + 缺 network-error retry 的三層組合。修法不在後端（Layer 3 已是最後防線），在前端補兩條：**(1) `httpClient` 加 network-error retry**（TypeError with exponential backoff, max 2）跟 **(2) `LoginPage` mount 背景 ping `/health` 預熱 Worker isolate**。兩條必須並存：warmup 預防、retry 兜底。

## 症狀（user-visible）

| 表面 | 觀察 |
|---|---|
| 時間 | 2026-09-09 ~06:10 (UTC+8) — user 早上來、Worker idle 超過 5 min cron 周期 |
| 前端 UI | 點登入 → 卡片顯示「Network error」 |
| DevTools Network | POST 回 503，response headers 沒有 `Access-Control-Allow-Origin`，fetch promise reject `TypeError: Failed to fetch` |
| DevTools Console | `content_main.js isTriggerKey TypeError`（Chrome extension 干擾，但跟 SAOME 無關）|
| Wrangler tail | 沒有這條 request log（runtime 拒絕，未進 Hono）|
| F5 後 | 可以繼續操作 — 但**不是**登入成功，是舊 access token 還在 localStorage，前端用 bearer 自動接 GET /api/cards/{id} + PATCH /api/cards/{id}/touch |

## 時間軸（trace）

| 時間 (UTC) | 事件 |
|---|---|
| 2026-09-08 22:10 | user 截圖：POST `/api/auth/login` 503 + 沒 CORS header |
| 2026-09-08 22:12 | curl OPTIONS + POST 同一個 endpoint：OPTIONS 204 + CORS、POST 400 + CORS（表示 backend 完全活著） |
| 2026-09-08 22:14 | 連打 5 次 POST：全部 400 + 完整 CORS（cold start 已 warm）|
| 2026-09-08 22:14 | 推斷 root cause：cold start 期間 Worker isolate emit 503 早於 entry code 載入，Layer 3 抓不到；瀏覽器 CORS drop → TypeError → httpClient 5xx retry 抓不到（TypeError 不是 5xx response）|
| 2026-09-08 22:20 | 確認 fingerprint 跟 0907 同源（cold start + CORS drop），但 dead zone 在 Layer 3 之後 |
| 2026-09-09 06:20 | 寫計畫，3 條硬化 work item |
| 2026-09-09 06:25 | 實作 httpClient.network-retry + LoginPage warmup + 8 條 regression test |

## 根因（為什麼 5xx retry 抓不到）

`httpClient.requestWithRetry` 的既有 5xx retry path 檢查的是 `res.status`：

```ts
const res = await this.fetchImpl(url, ...);  // ← 直接 await，沒 try/catch
// 5xx retry path
if (RETRYABLE_5XX.has(res.status) && attempt < MAX_5XX_RETRIES) {
  // ...
}
```

但 cold start 503 + 無 CORS header 走的是**完全不同的失敗路徑**：

```
Worker isolate cold start
   ↓
Hyperdrive binding 解析 timeout
   ↓
Worker runtime emit 503（entry code 還沒載入 → Layer 3 沒跑）
   ↓
Browser fetch 看到「無 CORS header」→ silent drop
   ↓
fetch promise reject TypeError("Failed to fetch")
   ↓
httpClient requestWithRetry 直接 throw TypeError ← 不是 Response，5xx retry 抓不到
   ↓
TypeError propagate 到 caller → user 看到「Network error」
```

換言之 **Layer 3 的死區我們後端抓不到，前端的 5xx retry 也抓不到**，是雙重 dead zone。

## Worker fetch 出口的 5 層 defense-in-depth

```
                                  ┌─────────────────────────────┐
HTTP request  ──▶ Worker fetch ──┤ ① runtime-level error path  │  ← 503 由 Cloudflare 發出
                                  │    (binding 解析失敗)       │     **完全沒進 Hono**
                                  │    Cold start 期間          │     **Layer 3 也抓不到**
                                  ├─────────────────────────────┤     Layer 4: LoginPage warmup 預防
                                  │ ② Layer 3 ensureCors       │  ← Worker entry boundary
                                  │    (ExportedHandler.fetch)  │     抓得到的 503
                                  ├─────────────────────────────┤     但 cold start 期間 entry code 還沒跑
                                  │ ③ Hono `app.onError()`     │  ← Layer 2 errorHandler CORS
                                  ├─────────────────────────────┤
                                  │ ④ Hono `app.fetch()`        │  ← Layer 1 corsMiddleware wrap-after-next
                                  │    (正常 response)         │
                                  └─────────────────────────────┘
                                                                 Layer 5: httpClient.network-retry 兜底 TypeError
```

每一輪只覆蓋前一輪沒看到的場景：

| 時期 | Defense | 覆蓋場景 | 沒覆蓋 |
|---|---|---|---|
| 2026-07-28 Bug-4c | frontend Mixed Content | 前端 bundle | 後端 |
| 2026-07-28 Bug-4d | `ALLOWED_ORIGINS` 補 Workers preview subdomain | Hono path ②③④ | runtime ① |
| 2026-09-05 Phase 3.3 | `corsMiddleware` wrap-after-next + `errorHandler` 內 CORS | Hono path ②③④ | runtime ① |
| 2026-09-07 | `ensureCorsOnResponse` Worker entry boundary | runtime ① (warm 後) | cold start 期間 entry code 還沒跑 |
| **2026-09-09（這次）**| **httpClient.network-retry + LoginPage warmup** | **cold start TypeError 兜底** | — |

## 修法（兩條硬化）

### Layer 4 — `LoginPage` mount 背景 ping `/health`

[apps/frontend/src/pages/auth/LoginPage.tsx](apps/frontend/src/pages/auth/LoginPage.tsx) — 加 useEffect：

```ts
useEffect(() => {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => {
    fetch(`${api.baseUrl}/health`, {
      method: 'GET',
      signal: ctrl.signal,
      credentials: 'omit',
    }).catch(() => {
      /* swallow — httpClient.network-retry handles real failures */
    });
  }, 100);
  return () => {
    ctrl.abort();
    window.clearTimeout(timer);
  };
}, []);
```

設計重點：
- **`useEffect` mount-only**：deps `[]` 確保每個 mount 只 ping 一次
- **100ms delay**：避開 React hydration 跟 initial paint 的競爭（user 還沒看到 form 就先打 network 有點 over-eager）
- **AbortController cleanup**：component unmount 時 abort（防止 stale fetch）
- **`.catch(() => {})`**：fire-and-forget，warmup 失敗不該影響 user 看到 form
- **`credentials: 'omit'`**：warmup 不需要帶 cookie

### Layer 5 — `httpClient` 補 network-error retry

[apps/frontend/src/services/httpClient.ts](apps/frontend/src/services/httpClient.ts) — 在 `requestWithRetry` 內包 try/catch：

```ts
const MAX_NETWORK_RETRIES = 2;
const NETWORK_RETRY_BASE_DELAY_MS = 500;

let res: Response;
try {
  res = await this.fetchImpl(url, { ... });
} catch (err) {
  if (err instanceof TypeError && attempt < MAX_NETWORK_RETRIES) {
    const delayMs = NETWORK_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return this.requestWithRetry<T>(method, path, init, attempt + 1);
  }
  // AbortError 或超過 retry 上限 → 給 caller 處理
  throw err;
}
```

設計重點：
- **只 retry `TypeError`**，不 retry `AbortError`（`AbortSignal.timeout` 拋出）
- `MAX_NETWORK_RETRIES = 2`（比 5xx 的 3 次少，避免 user 等太久；加上 5xx retry 會疊到 6 次總計）
- `NETWORK_RETRY_BASE_DELAY_MS = 500` → 第一次 retry 500ms、第二次 1000ms
- network-retry 與既有 5xx-retry **完全獨立**：cold start 期間先走 network-retry（TypeError），warm 後走 5xx-retry（5xx response）

## 為什麼兩條必須並存

只有 warmup（沒 retry）→ 偶發 cold start 仍會 leak 出來（warmup 跟 user 點登入的 race window ≈ 100ms）
只有 retry（沒 warmup）→ 每次冷啟動 user 都多等 500ms-1000ms（可接受但不優雅）

兩條並存：
- **常見情況**（warmup 成功）：user 完全無感 cold start
- **Race window 內**（warmup 失敗）：network-retry 兜底 500ms 後重試一次
- **Worker 完全 down**（warmup + retry 都失敗）：user 看到「Network error」（原本就是這種情況，沒有 regression）

## 測試覆蓋

### Layer 4 — LoginPage warmup（3 條）

新增 `apps/frontend/src/pages/auth/LoginPage.test.tsx::LoginPage Worker isolate warmup` describe block：

| # | Test | 覆蓋 |
|---|---|---|
| 1 | mount 後 50ms 內 fetch 沒被呼叫、100ms 後 fetch 呼叫 1 次 | 100ms delay 設計 |
| 2 | unmount 後 AbortController 觸發 `signal.aborted === true` | cleanup 路徑 |
| 3 | 已認證 user 走 `<Navigate>` redirect 時 warmup useEffect 仍會跑（mount 觸發）| useEffect 順序 |

### Layer 5 — httpClient.network-retry（5 條）

新增 `apps/frontend/src/services/httpClient.test.ts::HttpClient — network-error retry behavior` describe block：

| # | Test | 覆蓋 |
|---|---|---|
| 1 | TypeError 第一次 + 第二次 success → 拿到 success，fetch 2 次 | 基本 retry |
| 2 | TypeError 連續 3 次（超過 MAX_NETWORK_RETRIES=2）→ throw TypeError，fetch 3 次 | retry 上限 |
| 3 | AbortError（DOMException name='AbortError'）→ throw immediately，不 retry | timeout 不 retry |
| 4 | 第一次 200 OK → fetch 1 次，無 retry | 成功路徑不受 retry 影響 |
| 5 | TypeError → 503 → 503 → 200（network-retry + 5xx-retry 鏈）→ fetch 4 次 | 兩個 retry 機制獨立運作 |

加上既有 11 條 5xx retry + tryRefresh mutex 測試，總計 16 條 httpClient 測試 + 5 條 LoginPage 測試。

## 為什麼 curl 沒第一時間抓到 cold start

```bash
curl -X POST https://saome-backend.josh1989213.workers.dev/api/auth/login
# → 503（runtime 拒絕）
# curl 不在 HTTPS origin 內，沒有 CORS 規則，503 直接 body 給你看
```

**curl 看不到 cold start 的 dead zone**：
- 第一次 curl 在 cold start 早期 → 503
- 第二次 curl（1-2 秒後）→ 400（warm 後正常）

但**瀏覽器看到的失敗訊息跟 curl 完全對不上** — 因為瀏覽器在 HTTPS origin 內才會觸發 CORS drop，這是 SAOME 自 2026-07-28 Bug-4c 開始就記住的 fingerprint。

## 自問

**Q：為什麼不直接修後端？**
A：Layer 3 (`ensureCorsOnResponse`) 已經是 last-line-of-defense。Cold start 期間 **entry code 還沒跑** 就 emit 503，是 Cloudflare isolate 機制的底層限制，沒有 Cloudflare runtime hook 可以讓我們在「entry code 載入前」inject CORS。修法只能在前端硬化（retry + warmup）。

**Q：network-retry 跟 5xx-retry 為什麼不共用同一個 counter？**
A：兩個 retry 觸發條件不同：network-retry 看 `TypeError`、5xx-retry 看 `res.status`。共用 counter 會：
1. 讓 cold start → TypeError → warm 後 503 → throw 太早（counter 已用完）
2. 失去「兩個 retry 機制獨立運作」的可觀察性（devtools log 會混在一起）

**Q：為什麼 warmup 在 100ms 後而不是 mount 立刻？**
A：mount 立刻 fetch 會跟 React hydration 跟 initial paint 競爭 network（雖然有 HTTP/2 multiplexing，但仍是 over-eager）。100ms 是經驗值：user 開始看到 form 時 warmup 已經發射，但 user 還沒開始輸入密碼。

**Q：為什麼只 warmup LoginPage，不 warmup 所有 page？**
A：cold start 503 只在「user 第一次 request」發生。LoginPage 是 user 的第一個 entry point，warmup 後 isolate 已 warm，後續 navigate 到 Dashboard / CardBuilder 等頁面都不會 cold start。如果連 Dashboard 都 warmup 會變成 over-eager network usage。

**Q：為什麼 network-retry 不 retry 5xx 也包含的 `500`？**
A：500 是 application bug，不是 transient。我們的 retry 哲學是「retry transient，surface permanent」。5xx retry 只 retry 502/503/504，500 跟 4xx 一樣 surface 給 caller。

## 規範層影響

| 規範 | 動作 | 原因 |
|---|---|---|
| `.cursor/rules/036-worker-runtime-cors-defense.mdc` | **擴充** Chapter 5：cold start 期間 Layer 3 dead zone 的 fingerprint + 前端硬化必要 | 把 Layer 4-5 寫進 SOP |
| `apps/frontend/src/services/AGENTS.md`（若存在）| 加 network-retry 章節 | 給未來 agent 知道 retry 哲學 |
| `apps/frontend/src/pages/auth/AGENTS.md`（若存在）| 加 warmup useEffect 模板 | 給未來 page 標準化 pattern |
| `runs/improvements/INDEX.md` | 加一條 entry | 給未來 session trace |

詳見 decision log：`runs/decisions/2026-09-09-five-layer-cold-start-defense.md`（待補）。

## 學習

| 項目 | 說明 |
|---|---|
| Defense-in-depth 在 production 一次一次長出來 | Bug-4c → 4d → 0907 Layer 1-3 → 0909 Layer 4-5 |
| Cold start 是 Cloudflare isolate 機制的底層限制 | Layer 3 救不了 entry code 還沒跑的情境 |
| 修法不在後端，在前端 | 修後端只會增加 complexity 無實質保護 |
| curl 看不到 dead zone | SAOME 2026-07-28 Bug-4c 起的 fingerprint；debug 必須從瀏覽器 DevTools 驗 |
| `TypeError` retry 跟 `AbortError` 不 retry 是不同哲學 | transient vs user-initiated 不能混為一談 |

## 參照

- [`apps/frontend/src/services/httpClient.ts`](apps/frontend/src/services/httpClient.ts) — Layer 5 實作（requestWithRetry try/catch）
- [`apps/frontend/src/services/httpClient.test.ts`](apps/frontend/src/services/httpClient.test.ts) — 5 條 network-retry regression test
- [`apps/frontend/src/pages/auth/LoginPage.tsx`](apps/frontend/src/pages/auth/LoginPage.tsx) — Layer 4 實作（mount useEffect warmup）
- [`apps/frontend/src/pages/auth/LoginPage.test.tsx`](apps/frontend/src/pages/auth/LoginPage.test.tsx) — 3 條 warmup regression test
- [`apps/backend/src/index.ts`](apps/backend/src/index.ts) — Layer 3 Worker entry boundary（既有）
- [`apps/backend/src/shared/middleware/runtimeCors.ts`](apps/backend/src/shared/middleware/runtimeCors.ts) — Layer 3 ensureCorsOnResponse（既有）
- [`apps/backend/src/modules/health/routes/warmupCron.ts`](apps/backend/src/modules/health/routes/warmupCron.ts) — 後端 5-min cron warmup（既有）
- [`runs/improvements/feedback/20260907-cors-runtime-503-fix.md`](runs/improvements/feedback/20260907-cors-runtime-503-fix.md) — Layer 1-3 起源
- [`runs/decisions/2026-09-07-three-layer-cors-defense.md`](runs/decisions/2026-09-07-three-layer-cors-defense.md) — Layer 1-3 決策
- [`.cursor/rules/036-worker-runtime-cors-defense.mdc`](.cursor/rules/036-worker-runtime-cors-defense.mdc) — Worker runtime CORS defense rule
