# DEV LOG — 2026-09-08

## Bug-5b：httpClient 401→429 Retry Storm

**症狀**：使用無效 refresh cookie（incognito 模式），所有 API 呼叫都回 401，然後觸發 retry storm 直到被 rate limiter 擋下（429）。

**根因**：`httpClient.ts` 的 `requestWithRetry` 處理 401 時：
```
401 → tryRefresh() → 若 refresh 失敗（null）→ fall through 到原本的 retry 邏輯
→ retry 帶同樣的 expired token → 又 401 → 又 tryRefresh → 又 null → 又 retry...
```

這是 Hono 的 retry 迴圈重用了 5xx 的重試路徑，沒有區分「refresh 失敗是因為 token 無效（expired/revoked）」還是「refresh 失敗是暫時性錯誤」。

**為什麼 incognito 才看到**：non-incognito 的 refresh cookie 有效，loop 跑 1 次就 resolve；incognito 的 cookie 是空的，tryRefresh 永遠回 null，loop 持續直到 rate-limited。

**修復**：`apps/frontend/src/services/httpClient.ts` — 401 時 tryRefresh 回 null 就立刻 throw `SaomeApiError(401)`，**不再 retry**：

```typescript
if (res.status === 401) {
  const newToken = await this.tryRefresh();
  if (newToken) {
    setAccessToken(newToken);
    return this.requestWithRetry<T>(method, path, { ...init, retryOn401: false }, attempt);
  }
  // Refresh failed — expired / revoked token. Do NOT retry.
  let errBody: unknown;
  try { errBody = await res.json(); } catch { errBody = { message: res.statusText }; }
  throw new SaomeApiError(res.status, errBody as SaomeApiError['error']);
}
```

**同步修復**：`apps/frontend/src/services/authService.ts` — 移除 `withRefreshMutex` 包在 `httpClient.post()` 外層（httpClient 內部已有 shared mutex 保護 in-flight refresh，不需兩層）。

**驗證**：`npm test --workspace=apps/frontend` — 11/11 passed（httpClient.test.ts）；wrangler deploy 後 CORS post-deploy 3/3 通過。

---

## Bug-6：Auth Route Set-Cookie 靜默失效

**症狀**：登入成功後 refresh token 從未被寫入瀏覽器 cookie。Tab 關閉或 token 過期後，refresh 失敗、使用者靜默登出。

**根因**：`apps/backend/src/modules/auth/routes/login.ts`、`logout.ts`、`refresh.ts` 用的是 Node.js/Express 舊習慣：

```typescript
// ❌ Bug：Hono c.json() 回 immutable Response，headers.append() 是 NO-OP
const jsonResponse = c.json({ user, tenant, accessToken, ... });
jsonResponse.headers.append('Set-Cookie', cookieHeader); // 永遠不執行
return jsonResponse;
```

Hono 的 `c.json()` 回傳**不可變**的 Response object，`.headers` 是唯讀的，`.append()` 是靜默的 no-op。

**為什麼 curl 看得到但瀏覽器看不到**：curl 不受 SameSite / Secure / HttpOnly cookie 限制，可以看到 header；瀏覽器收到的是沒有 Set-Cookie 的 response，cookie jar 因此是空的。

**修復**：Set-Cookie 當作 `c.json()` 第三個參數傳入（Hono 正確 API）：

```typescript
return c.json(
  { user, tenant, accessToken, ... },
  200,
  { 'Set-Cookie': cookieHeader },
);
```

**受影響檔案**：
- `apps/backend/src/modules/auth/routes/login.ts`
- `apps/backend/src/modules/auth/routes/logout.ts`
- `apps/backend/src/modules/auth/routes/refresh.ts`

**為什麼之前沒測到**：既有測試只斷言 HTTP status 200 + response body，沒有斷言 `Set-Cookie` header 存在於 response。

**規範**：任何 response header 改動都應走 `c.json(body, status, headers)` 而非事後 mutation。Rule 036 同步更新。

---

## Feature：Balance Preview — `PassCardPreviewHeader` 餘額預覽

**Scope**：當 `cardType ∈ {stamp_card, reward_card, cashback_card}` 時，`PassCardPreviewHeader` 右側從單行 pill（`集點卡` / `stamp_card` 等）改為兩行垂直「餘額 / 200元」區塊。

**設計決策**：

1. **`BALANCE_PREVIEW_AMOUNTS` 放 `packages/shared/constants/` 而非 i18n 翻譯檔**
   - `verify-i18n-keys.mjs` § 4 hard fail：`en` namespace 禁止含 Han 字元，`200元` 不能放 `passCard.en.ts`
   - `store.currency` 驅動 amount 字串（TWD → `200元`，ZAR → `R100`），i18n 只管 label（`餘額` / `Balance`）

2. **`BALANCE_PREVIEW_CARD_TYPES` + type guard**：`shouldShowBalancePreview()` 確保 exhaustive coverage

3. **`totalStamps` 插值**：`{{rows}}` = `stampGridRows × STAMPS_PER_ROW`（`STAMPS_PER_ROW = 5`）

**新檔**：`packages/shared/constants/balancePreview.ts`

**測試**：`PassCardPreviewHeader.test.tsx` — 17 個 test cases（全卡種 / currency switch / reactive re-render / typography / DOM layout）

**驗證**：
- `npm run verify:i18n` — 17 namespaces, 34 locale files, no raw key
- `npx tsc -b --noEmit` — exit 0
- `npm test` — 113/113 + 488/488 全綠

---

## Feature：Step 3 Stamp-Only Field Options

**Scope**：當 `cardType ∈ {stamp_card, multipass}` 時，Step 3 左右欄位 dropdown 從 6 個 common options 擴到 9 個（+ `availableRewards` / `totalStamps` / `stampsRemaining`）。

**實作**：

| 元件 | 變動 |
|---|---|
| `packages/shared/constants/card-fields.ts` | `CARD_FIELD_KEYS` +3 keys；`CardFieldGroup` 型別；`CARD_FIELDS` 加 stamp group 條目 |
| `filterCARD_FIELDS_BY_CARD_TYPE.ts` | **新檔** — `STAMP_CARD_TYPES` set + `filterCARD_FIELDS_BY_CARD_TYPE()` 純函式 |
| `Step3CardFields/index.tsx` | `<FieldSelect>` 新 prop `availableFields`；`useMemo(filterCARD_FIELDS_BY_CARD_TYPE(cardType))` |
| `Step3CardFields/index.test.tsx` | +5 conformance test cases |

**i18n**：`cardEditor.zh-TW.ts` + `cardEditor.en.ts` 各加 3 個 keys。

**驗證**：`npm test` — 全綠。

---

## Decision：3-Layer CORS Defense — Worker Runtime Boundary

**觸發**：2026-09-07 production 登入 CORS drop，根因是 503 來自 Cloudflare Worker runtime（在 Hono middleware chain 啟動之前）。

**三層出口**：

| 層 | 位置 | 覆蓋 |
|---|---|---|
| Layer 1 | `corsMiddleware`（wrap-after-next）| 正常 response（path ③）|
| Layer 2 | `errorHandler.applyCorsHeadersToResponse` | Hono throw（path ②）|
| **Layer 3** | `runtimeCors.ensureCorsOnResponse`（Worker entry boundary）| **Runtime-emitted error（path ①）** |

**Worker entry boundary 包裹**（`apps/backend/src/index.ts`）：

```typescript
const worker: ExportedHandler<HonoEnv['Bindings']> = {
  async fetch(request, env, ctx) {
    try {
      const res = await app.fetch(request, env, ctx);
      return ensureCorsOnResponse(request, res);
    } catch (err) {
      const fallback = new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', ... } }), { status: 503 });
      return ensureCorsOnResponse(request, fallback);
    }
  },
};
export default worker;
```

**同步責任 SOP**：新增 production origin 必須**同 PR** 改 `wrangler.jsonc`（Layer 1+2）**和** `runtimeCors.ts`（Layer 3），並加 conformance test。

**驗證**：
- `npm test --workspace=apps/backend` — 176/176 通過（+6 新測試）
- CORS post-deploy curl 矩陣：3/3 通過
- Chrome incognito 登入：production 恢復 ✅

---

## 規範變動

| 檔案 | 動作 |
|---|---|
| `.cursor/rules/036-worker-runtime-cors-defense.mdc` | **新增** — 3 層 CORS defense 正式記錄 + Worker entry boundary SOP + 同步責任 |
| `.cursor/rules/017-production-bundle-guard.mdc` | 擴充：backend Worker CORS post-deploy check（curl 矩陣）|
| `apps/backend/AGENTS.md` | 加 3 層 CORS defense 註解 + 同步責任 SOP |

---

## 待追蹤事項

| Item | Priority |
|---|---|
| Backend Set-Cookie regression test（assert `Set-Cookie` header 存在於 response）| P1 |
| Playwright smoke test：`POST /api/auth/login` 帶 Origin header 必須回 `Set-Cookie` | P2 |
| `STAMP_CARD_TYPES` 在 `Step3CardFields` 與 `<Step3StampGrid>` 兩處重複，drift 風險 | P2 |
| wrangler CPU limit crash 根因（哪個 endpoint 觸發 CPU time limit？）| P3 |
| `dev-restart.ps1` script 納入正式 SOP | P3 |
