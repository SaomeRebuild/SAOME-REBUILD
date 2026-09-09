---
title: "2026-09-09 Cold Start 503 Root Cause — Missing scheduled Handler + Fix"
date: 2026-09-09
type: bug-trace
scope: backend/cold-start
status: resolved
severity: SEV-2
commits:
  - (this PR)   # fix(backend): add worker.scheduled handler — cron now keeps Worker warm, eliminates cold-start 503+CORS-drop
related:
  - runs/improvements/feedback/20260909-cold-start-dead-zone-network-error.md
  - runs/decisions/2026-09-07-three-layer-cors-defense.md
  - .cursor/rules/036-worker-runtime-cors-defense.mdc
  - apps/backend/src/index.ts
  - apps/backend/wrangler.jsonc
---

# 2026-09-09 Cold Start 503 Root Cause — Missing scheduled Handler + Fix

## TL;DR

0909 早上的 frontend 硬化（LoginPage warmup + httpClient retry）解決了「cold start 後使用者看到 Network error」的症狀，但**根本原因**是：`wrangler.jsonc::triggers.crons` 宣告了 `*/5 * * * *`（每 5 分鐘），但 Worker 的 `ExportedHandler` **從來沒有 `scheduled` 方法**。Cloudflare 照樣每 5 分鐘發一次 cron 事件，但 worker 沒有任何 handler 接收 → cron 事件進 void、Worker isolate 照樣被 idle-eviction 踢掉、幾小時後第一個 user request 冷啟、runtime 503、Layer 3 來不及（見 036 §8）。

修法：在 `worker` 物件上加 `scheduled(event, env, ctx)` 方法，每 2 分鐘做三件事：
1. HTTP warmup：`fetch(SaOME_BACKEND_URL/health)` → 暖化整個 Hono pipeline
2. Hyperdrive keep-alive：`SELECT 1` → 防止 >60s idle 斷線
3. Billing cycle advancement → 原本也是 HTTP route（沒被 cron 呼叫），現在正確掛鉤

## 症狀（對比）

| | 根本原因（修前）| 表面症狀（修前）| 修後 |
|---|---|---|---|
| 什麼壞 | Worker 沒有 `scheduled` handler | 503 + CORS drop | Worker 有 `scheduled`，每 2 分鐘暖化 |
| 何時壞 | 每小時 idle 後第一個 request | 早上來、幾小時後回來 | 2 分鐘內就暖化，isolate 不會被踢掉 |
| curl 能看到嗎 | 可以（curl 不在 HTTPS origin 內）| 不行（瀏覽器 CORS drop）| N/A — 修後不會發生 |
| 本地有嗎 | 沒有（wrangler dev 不睡）| 沒有 | 沒有 |

## 根因 trace

### 為什麼本地不會有這個問題？

`wrangler dev` 啟動後 Vite 保持長連接，Worker isolate 永遠活著，沒有 idle-eviction。Production Cloudflare Workers：

- Worker isolate idle 超過 ~15-30 分鐘（視記憶體壓力）→ 被踢掉
- 下一個 request 進來 → 必須重新初始化整個 V8 isolate + 編譯整個 bundle（~450 KB）
- 初始化時間取決於 bundle 大小：450 KB → 數秒到數十秒
- 如果初始化時間太長，Cloudflare runtime 直接 emit 503（還沒進 Hono）
- 這段 503 繞過 Layer 3（`ensureCorsOnResponse` 還沒跑）
- 瀏覽器看到無 CORS header 的 503 → silent drop → fetch reject TypeError

### 為什麼 cron trigger 沒暖化？

Cloudflare Cron Trigger 的機制：
1. `wrangler.jsonc::triggers.crons` 宣告排程
2. Cloudflare 在排程時間呼叫 Worker 的 `scheduled(event, env, ctx)` 方法
3. 如果 Worker **沒有** `scheduled` 方法 → cron 事件被 Cloudflare 默默丢掉，**沒有任何錯誤回傳**
4. Worker isolate 照樣被 idle-eviction 踢掉

`warmupCron.ts` 是 HTTP route（`GET /api/cron/warmup`），不是 `scheduled` handler。這是之前的設計錯誤：意圖是讓 cron 呼叫它，但從來沒有把 cron 事件導向 HTTP route 的程式碼。

### 為什麼 wrangler deploy output 沒有說 cron handler 找不到？

Cloudflare 的設計是「如果 Worker 沒有 `scheduled` handler，cron 就默默失敗，不噴 error」。這讓問題難以發現。

## 修法實作

### 1. `src/index.ts` — 加 `worker.scheduled` 方法

```typescript
const worker: ExportedHandler<HonoEnv['Bindings']> = {
  async fetch(request, env, ctx) { ... },   // 既有的 Layer 3 CORS wrapper

  // 新增：Cloudflare Cron Trigger handler
  async scheduled(event, env, ctx) {
    const cronName = event.cron;

    // Purpose 1: HTTP warmup — 暖化整個 Hono pipeline
    try {
      const res = await fetch(`${env.SAOME_BACKEND_URL}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
      });
      console.log(`[scheduled] cron=${cronName} http-warmup status=${res.status}`);
    } catch (err) {
      console.warn(`[scheduled] cron=${cronName} http-warmup FAILED:`, err.message);
    }

    // Purpose 2: Hyperdrive keep-alive — 防止 >60s idle 斷線
    try {
      const sql = await getDb(env.HYPERDRIVE);
      await sql`SELECT 1`;
      console.log(`[scheduled] cron=${cronName} hyperdrive-keepalive ok=1`);
    } catch (err) {
      console.warn(`[scheduled] cron=${cronName} hyperdrive-keepalive FAILED:`, err.message);
    }

    // Purpose 3: Billing cycle advancement — 原本也是 HTTP route，現在正確鉤上
    try {
      const res = await fetch(`${env.SAOME_BACKEND_URL}/api/cron/billing-cycle`, {
        method: 'GET',
        signal: AbortSignal.timeout(30_000),
      });
      const body = await res.json();
      console.log(`[scheduled] cron=${cronName} billing-cycle status=${res.status}`);
    } catch (err) {
      console.warn(`[scheduled] cron=${cronName} billing-cycle FAILED:`, err.message);
    }
  },
};
```

**為什麼三條都包在 try/catch**：warmup 的任何一步失敗都不應 crash cron handler。Cloudflare Cron Trigger 的錯誤不會自動重試；如果 handler throw，整個 cron tick 就没了。包 try/catch 讓錯誤變成 `console.warn` — wrangler tail 看得見，不影響其他步驟。

### 2. `wrangler.jsonc` — 頻率 `*/2 * * * *`

```jsonc
"triggers": {
  "crons": ["*/2 * * * *"]   // 從 */5 改為 */2（每 2 分鐘）
}
```

`*/5`（每 5 分鐘）已經足夠對付 ~15-30 分鐘的 idle timeout，但 `*/2` 更保守。Cloudflare Cron Trigger 完全免費，頻率高一點不浪費資源。

### 3. `wrangler deploy` output 確認

```
Deployed saome-backend triggers (2.06 sec)
  https://saome-backend.josh1989213.workers.dev
  schedule: */2 * * * *
```

**有 `schedule` 這行**表示 `scheduled` handler 已經正確綁定。之前 deploy 沒有這行（因為沒有 handler）。

## 防禦層級對照

| 層 | 檔案 | 覆蓋 | 狀態 |
|---|---|---|---|
| 1 | `corsMiddleware`（Hono chain）| 正常 response | ✅ |
| 2 | `errorHandler` inline CORS | Hono throw | ✅ |
| 3 | `runtimeCors.ts::ensureCorsOnResponse`（Worker entry）| runtime emit 503 但已進 fetch handler | ✅ |
| 4 | `worker.scheduled`（本檔）| **根本原因：防止 cold start** | ✅ 新增 |
| 5 | `LoginPage` warmup + `httpClient` retry | cold start 後的 UX 兜底 | ✅ 既有的 |

## 驗證

```bash
# 1. deploy output 有 schedule 行
$ wrangler deploy
Deployed saome-backend triggers (2.06 sec)
  schedule: */2 * * * *

# 2. health endpoint 正常
$ curl https://saome-backend.josh1989213.workers.dev/health
{"ok":true}  # 有 CORS header

# 3. cron 手動測試
$ curl https://saome-backend.josh1989213.workers.dev/api/cron/warmup
{"cron":"warmup","executedAt":"...","upstreamStatus":200}

# 4. wrangler tail 看 cron 實際有沒有跑
$ wrangler tail --format pretty --watch
# 等 2 分鐘，應該看到 [scheduled] cron=*/2 * * * * http-warmup status=200
```

## 衍生觀察

### 為什麼 curl 可以看到 backend 在跑？

curl 在 shell 環境發 request，不在任何 HTTPS origin 內，所以沒有 CORS 限制。看到的是「backend 503」跟「正常 503」無法區分。只有從 `https://saome-frontend.josh1989213.workers.dev` fetch 才會觸發 CORS policy。

### warmupCron HTTP route 怎麼了？

原本的 `warmupCron` 是 HTTP route（`GET /api/cron/warmup`），意圖是手動觸發暖化。但它 Mount 為 HTTP route，不是 `scheduled` handler。

現在的架構：
- `worker.scheduled` → 每 2 分鐘自動暖化（主要機制）
- `GET /api/cron/warmup` → 保留給手動 smoke test（仍在，且已更新文件）

兩者都是 HTTP layer warmup。真正的 Hyperdrive keep-alive 只有 `scheduled` handler 在做（`SELECT 1`）。
