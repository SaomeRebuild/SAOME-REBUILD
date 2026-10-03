# 2026-10-04 — Production URL Alignment：saome-frontend.pages.dev → saome-frontend.josh1989213.workers.dev

**日期**：2026-10-04
**作者**：cursor (assisted)
**類型**：L1 Trivial — production URL 對齊（3 檔變更、4 行 diff）
**影響範圍**：
- `apps/backend/wrangler.jsonc`（Layer 1 CORS — 加 `saome-frontend.josh1989213.workers.dev` 顯式列示）
- `apps/frontend/.env.production`（frontend `VITE_APP_BASE_URL` default）
- `apps/frontend/src/config/env.ts`（frontend `appBaseUrl.default` + JSDoc）

**commit hash**：待 send

**觸發的 rule / skill**：
- Rule 036 § 4（Worker Runtime CORS Defense — 同步責任 SOP：wrangler.jsonc 跟 runtimeCors.ts 必須兩處都列）
- Rule 017（Production Bundle Guard — `wrangler deploy` 後必跑 CORS post-deploy check）
- Rule 024 § Mobile Future-Proof（`appBaseUrl` 是 RN 化時 QR Code 編碼的 base — 跨 9/7 commit `7935de8` Layer 3 已經 ready）

**Layer 對齊狀態**：

| 層 | 檔案 | 狀態 |
|---|---|---|
| Layer 1（主路徑） | `apps/backend/wrangler.jsonc::ALLOWED_ORIGINS` | ⏳ **本 commit 改**（加 `saome-frontend.josh1989213.workers.dev` 顯式列示，pattern 早就涵蓋）|
| Layer 2（error handler）| `apps/backend/src/shared/middleware/errorHandler.ts` | ✅ 不需改（共 Layer 1 的 `resolveAllowedOrigin`）|
| Layer 3（runtime-emitted 503 兜底）| `apps/backend/src/shared/middleware/runtimeCors.ts::RUNTIME_ALLOWED_HOSTS` | ✅ 已 ready（9/7 commit `7935de8` 開 Worker-level CORS defense 時就列入）|
| Frontend self-reference | `apps/frontend/.env.production` + `apps/frontend/src/config/env.ts::appBaseUrl.default` | ⏳ **本 commit 改**（`pages.dev` → `workers.dev`）|

---

## 摘要

把 production frontend self-reference 從 `https://saome-frontend.pages.dev`（Cloudflare Pages）正式切到 `https://saome-frontend.josh1989213.workers.dev`（Cloudflare Worker + `assets` binding）。Layer 3 backend CORS 早在 9/7 commit `7935de8` 就已經把 `saome-frontend.josh1989213.workers.dev` 列入 `RUNTIME_ALLOWED_HOSTS`；`ALLOWED_ORIGIN_PATTERNS` 早就含 `*.josh1989213.workers.dev` pattern 涵蓋此 origin。本次 commit 補齊兩處對齊：(1) `ALLOWED_ORIGINS` 顯式列示（雖然 pattern 已涵蓋，明確列示給 code reader 一目了然 + 對非 pattern-matching code path 也守住）；(2) frontend `VITE_APP_BASE_URL` + `appBaseUrl.default` 改新 URL（這是 frontend 自己知道「自己是誰」的地方，QR Code 編碼 / share link / Open Graph tag 都靠這個值）。

**為什麼這是 QR Code 功能的隱性前置作業**：Step 7 QR Code 工具（commit `1f58356`）用 `useQrCode` 編碼的 URL = `${appBaseUrl}/pass/${templateId}`。`appBaseUrl` 在 production 從 `pages.dev` 改 `workers.dev`，等於讓 production 桌牌上的 QR Code 全部指向新 URL。如果 production 端真的要 deprecated `pages.dev`，QR Code 是 user-facing touchpoint，必須先對齊 backend CORS 才能掃碼成功。

---

## 3 個實際改動

### 1. `apps/backend/wrangler.jsonc::vars.ALLOWED_ORIGINS`

```diff
-    "ALLOWED_ORIGINS": "http://localhost:5173,http://localhost:8788,https://saome-frontend.pages.dev,https://saome-admin.pages.dev,https://josh1989213.workers.dev,https://saome-backend.josh1989213.workers.dev,https://app.saome.org,https://admin.saome.org,https://saome.org",
+    "ALLOWED_ORIGINS": "http://localhost:5173,http://localhost:8788,https://saome-frontend.pages.dev,https://saome-frontend.josh1989213.workers.dev,https://saome-admin.pages.dev,https://josh1989213.workers.dev,https://saome-backend.josh1989213.workers.dev,https://app.saome.org,https://admin.saome.org,https://saome.org",
```

新增 `https://saome-frontend.josh1989213.workers.dev` 在 `saome-frontend.pages.dev` 之後、`saome-admin.pages.dev` 之前（frontend family 兩個 URL 並列）。

**為什麼 pattern 已涵蓋還要顯式列**：
- Code reviewer 一眼看到 `ALLOWED_ORIGINS` 就能知道「這個 origin 被接受」就記得住，不需要再去看 `ALLOWED_ORIGIN_PATTERNS`
- 未來如果有人改 pattern（例如把 `*.josh1989213.workers.dev` 改成 `*.backend.josh1989213.workers.dev`），frontend 不會 silent 漏掉
- 跟 `josh1989213.workers.dev`（apex）/ `saome-backend.josh1989213.workers.dev` / `saome-frontend.pages.dev` 一致風格 — 顯式列已知 host

### 2. `apps/frontend/.env.production`

```diff
-VITE_APP_BASE_URL=https://saome-frontend.pages.dev
+VITE_APP_BASE_URL=https://saome-frontend.josh1989213.workers.dev
```

Production build 用 `.env.production` 內的 value（Vite 自動載入）。Dev / staging 仍走各自 `.env`。

### 3. `apps/frontend/src/config/env.ts`

```diff
- *       prod: https://saome-frontend.pages.dev
+ *       prod: https://saome-frontend.josh1989213.workers.dev

-        ? 'https://saome-frontend.pages.dev'
+        ? 'https://saome-frontend.josh1989213.workers.dev'
```

兩個地方：
- Line 18：JSDoc 內的 prod default 範例
- Line 47：`ConfigSchema::appBaseUrl` 的 zod `.default()` 實值

`zod` 的 `.default()` 在 production build 時（`isProd === true`）fallback 用 `https://saome-frontend.josh1989213.workers.dev`，確保 production bundle 不會因為 `VITE_APP_BASE_URL` env 沒設而指向 pages.dev。

---

## 為什麼需要這個對齊

### Worker + assets binding 取代 Pages hosting

SAOME 從 2026-09-07（commit `7935de8` Worker-level CORS + Layer 3 CORS defense）開始把 frontend hosting 從 Cloudflare Pages 遷到 Cloudflare Worker。Worker 的 `wrangler.jsonc` 加 `"assets": { "directory": "./dist" }`（Rule 015 § wrangler.jsonc Worker-only 格式）後，整個 frontend static assets 由 Worker serve：

- 舊 URL：`https://saome-frontend.pages.dev`（Cloudflare Pages）
- 新 URL：`https://saome-frontend.josh1989213.workers.dev`（Cloudflare Worker）

兩條 URL 都能 serve 同一份 frontend bundle（Pages 對映過 Worker 上 deploy 的 source）。Worker hosting 統一了 dev / production 的 deploy script（單一條 `wrangler deploy`），不再分 Pages / Workers 兩個入口。

### 為什麼 Layer 3 早就 ready 而 Layer 1 漏了顯式列示

| Worker 入口 | 用途 | 何時建立 |
|---|---|---|
| Layer 3 `RUNTIME_ALLOWED_HOSTS` | 兜底 — Worker runtime 直接 emit 503 時補 CORS header | 9/7 commit `7935de8` — 開 Worker-level CORS defense 時就把新 origin 列入 |
| `ALLOWED_ORIGIN_PATTERNS` | 主路徑 — Hono `corsMiddleware` wrap-after-next 用 pattern 處理 | 9/7 commit `bab5c97` — Bug-4d 修 Workers preview URL CORS drop 時加 `*.josh1989213.workers.dev` |
| `ALLOWED_ORIGINS`（顯式列示）| 顯式列已知 host（code reviewer 一目了然 + non-pattern-matching 守門）| 9/7 之後一直漏 `saome-frontend.josh1989213.workers.dev` 顯式列（雖然 pattern 涵蓋）|

實際上 backend CORS 從 9/7 起就接受 frontend `workers.dev` request，但顯式列示在 `ALLOWED_ORIGINS` 是 best practice：code reviewer / future maintainer 一眼看到就知道這個 origin 被接受，不需要 parse `ALLOWED_ORIGIN_PATTERNS` 的 glob pattern。

### 為什麼 frontend `.env.production` + `env.ts` 都改

| 檔案 | 用途 | 為什麼都改 |
|---|---|---|
| `.env.production` | Vite build 時注入 `import.meta.env.VITE_APP_BASE_URL` | 確保 production build 時這個 env 是新 URL，無論是否顯式設 |
| `env.ts::appBaseUrl.default` | `import.meta.env.VITE_APP_BASE_URL` 沒設時的 fallback | 防禦 — 如果 build pipeline 漏掉 `.env.production` 載入，仍 fallback 到正確 URL |
| `env.ts::JSDoc` | 給 developer 看的註解 | 讓讀程式碼的人知道 prod 的實際 URL，不要憑「Pages」記憶 |

3 處一起改才能保證 frontend bundle 在任何 build 設定下都知道自己是 `workers.dev`。

---

## 驗證

### TypeScript + Lint + Test

| 項目 | 結果 |
|---|---|
| `npx tsc -b apps/frontend/tsconfig.app.json --noEmit` | ✅ exit 0（env.ts 改 default 值無 type 變動）|
| `npm run lint --workspace=apps/frontend` | ✅ exit 0（純 string literal 改，無新增 warnings）|
| `npx tsc --noEmit --project apps/backend/tsconfig.json` | ✅ exit 0（wrangler.jsonc 不是 .ts，沒影響）|
| `npm run verify:i18n --workspace=apps/frontend` | ✅ 19 namespace(s) passed（無 i18n 變動）|

### Layer 1 + Layer 3 CORS 對齊驗證

```bash
# 驗 Layer 3 (runtimeCors) 已涵蓋新 origin
node -e "import('./apps/backend/src/shared/middleware/runtimeCors.ts').then(m => console.log('saome-frontend.josh1989213.workers.dev allowed:', m.isRuntimeAllowedHost('saome-frontend.josh1989213.workers.dev')))"
# 預期: saome-frontend.josh1989213.workers.dev allowed: true

# 驗 Layer 1 (wrangler.jsonc ALLOWED_ORIGINS) 顯式列示
grep -E "saome-frontend.josh1989213.workers.dev" apps/backend/wrangler.jsonc
# 預期: 1 行命中
```

### Deploy 後必跑（Rule 017 § Backend Worker CORS post-deploy check）

```bash
BACKEND="https://saome-backend.josh1989213.workers.dev"
ORIGIN="https://saome-frontend.josh1989213.workers.dev"

# 1. OPTIONS preflight
curl -sS -i -X OPTIONS "$BACKEND/api/auth/login" \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type" \
    2>&1 | head -20
# 預期: HTTP/1.1 204 + Access-Control-Allow-Origin: $ORIGIN

# 2. POST 帶 Origin（即使 401 也必回 CORS）
curl -sS -i -X POST "$BACKEND/api/auth/login" \
    -H "Origin: $ORIGIN" \
    -H "Content-Type: application/json" \
    -d '{"email":"x@x.x","password":"x"}' \
    2>&1 | head -20
# 預期: HTTP/1.1 401 + Access-Control-Allow-Origin: $ORIGIN

# 3. POST 帶 evil origin — 必 NOT 回 Access-Control-Allow-Origin
curl -sS -i -X POST "$BACKEND/api/auth/login" \
    -H "Origin: https://evil.example.com" \
    -H "Content-Type: application/json" \
    -d '{"email":"x@x.x","password":"x"}' \
    2>&1 | head -20
# 預期: 4xx + 沒有 Access-Control-Allow-Origin header
```

### QR Code Production Smoke Test

```bash
# 用 Playwright 跑
npm run test:smoke -- tests/smoke/card-builder-step7-qrcode.spec.ts
# 預期:
# - 加 QR 工具 → Inspector URL preview 顯示 https://saome-frontend.josh1989213.workers.dev/pass/<templateId>
# - 確認 background production build 出來的 bundle 內含新 URL:
grep -rn "saome-frontend.josh1989213.workers.dev" apps/frontend/dist/ | head -5
```

---

## 後續 TODO

- [ ] Deploy 後跑上面 § 驗證 三條 curl 矩陣
- [ ] Run `tests/smoke/card-builder-step7-qrcode.spec.ts` 確認 production QR Code URL 對齊
- [ ] 監控 production 是否有任何依賴 `pages.dev` 的 stale link / R2 object / Cloudflare Access policy
- [ ] 若 `pages.dev` 已經完全 deprecated：移除 `saome-frontend.pages.dev` 跟 `*.saome-frontend.pages.dev` pattern（不在本 commit scope，等觀察期過）
- [ ] 把「Layer 1 顯式列 + Layer 3 顯式列」同步責任 SOP 寫進 Rule 036 § 4（避免下次又只改 Layer 3 不改 Layer 1）

## 不做的事

- 不改 `ALLOWED_ORIGIN_PATTERNS`（已含 `*.josh1989213.workers.dev` 涵蓋）
- 不動 `runtimeCors.ts`（已就位）
- 不動 `errorHandler.ts`（共 Layer 1 的 `resolveAllowedOrigin`，自動受益）
- 不動 i18n / schema / shared / store / hook signature（純 config 對齊）
- 不刪 `saome-frontend.pages.dev`（觀察期過後再決定）
- 不改 `.env.test` / `.env.development`（dev 環境仍走 localhost:5173）

## 跨鏈

- **Master DEV LOG**：[DEV/10-2026/1004-step7-qrcode-master-dev-log.md](1004-step7-qrcode-master-dev-log.md)
- **Layer 3 起源**：`runs/improvements/feedback/20260907-cors-runtime-503-fix.md`（commit `7935de8`）
- **Layer 1 pattern 起源**：`runs/improvements/feedback/20260728-cors-allowlist-pages-dev.md`（commit `bab5c97`）
- **QR Code 編碼值**：`runs/decisions/2026-10-04-qrcode-library-selection.md`（URL = `${appBaseUrl}/pass/${templateId}`）
- **Rule 036 § 4 同步責任 SOP**：`.cursor/rules/036-worker-runtime-cors-defense.mdc`
- **Rule 017 § Backend Worker CORS post-deploy check**：`.cursor/rules/017-production-bundle-guard.mdc`

## Self-improvement action items

| Action | Owner | Trigger | Status |
|---|---|---|---|
| commit 規範層/操作層 2 個檔（本 DEV LOG + INDEX 條目）| Self | 立即 | ⏳ pending |
| deploy 後跑 Rule 036 + 017 CORS post-deploy check | User | push 完成後 | ⏳ pending |
| QR Code production smoke test | User | push 完成後 | ⏳ pending |
| 把「Layer 1 顯式列 + Layer 3 顯式列」同步責任 SOP 寫進 Rule 036 § 4 | Future | 下次有 origin 變更時 | ⏳ pending |
| 觀察期後決定是否 deprecated `pages.dev` URL | Future | 30 天後 | ⏳ pending |

---

> 撰寫者：cursor (assisted) ｜ 時間：2026-10-04 05:35 UTC+8
>
> 本 DEV LOG 跟 master `1004-step7-qrcode-master-dev-log.md` 同源；本檔專注 production URL 對齊的 3 檔變更細節，master 檔負責整條 Step 7 QR Code 鏈的架構全景。