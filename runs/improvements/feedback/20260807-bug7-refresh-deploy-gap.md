# 2026-08-07 — Bug-7 refresh route returns tokens only, no session data (deploy gap)

> Bug-7 的 Round 2。Backend `refreshService` 已經 hydrate user + tenant，
> 但 `refreshRoute` 只序列化 3 個欄位。前端 AuthProvider 拿到 response
> 後 `session.user === undefined`，所以 Header 判斷
> `isAuthenticated = false` → 看起來像 session 丟了。
>
> 完整 trace 見 `DEV/08-2026/0808-bug-7-trace.md`。

## 症狀

- 環境：production (`https://saome-frontend.josh1989213.workers.dev`)
- 觸發條件：登入後關閉 tab，重新打開 `https://saome-frontend.josh1989213.workers.dev/login`
- 觀察到的錯誤：Header 仍顯示「登入」連結（不是「登出」+ email），但 cookie 明明存在
- 預期 vs 實際：
  - 預期：AuthProvider 在 mount 跑 `refresh()`，拿到完整 session，Header 顯示 logout
  - 實際：refresh 200，但 response body 沒有 user/tenant，AuthProvider `user=null`，Header 顯示登入連結

## 探針 / 重現

`tests/probe/curl-login-then-refresh.mjs`：

```
=== Step A: login ===
>>> POST /api/auth/login -> 200
   body: {"user":{"id":"7db57eed-...","email":"admin@saome.org","role":"admin"},"tenant":null,"accessToken":"...","expiresIn":28800,...}

=== Step B: refresh with cookie ===
>>> POST /api/auth/refresh -> 200
   body: {"accessToken":"...","expiresIn":28800,"refreshToken":"..."}
                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                       沒有 user, 沒有 tenant, 沒有 expiresIn 以外的 metadata
```

第二次 refresh response **沒有 user / tenant**，跟第一次 login response 不對稱。
AuthProvider 拿到這個 response，`session.user === undefined`。

## 根因

> `apps/backend/src/modules/auth/routes/refresh.ts` 的 `c.json` 只選
> 3 個欄位序列化。

```ts
// beforereturn c.json({
  accessToken: result.accessToken,
  expiresIn: result.expiresIn,
  refreshToken: result.refreshToken,
});
```

而 `refreshService` 早就 hydrate 了完整 `AuthSessionDto`（含 user + tenant）：

```ts
// apps/backend/src/modules/auth/services/refreshService.ts
return {
  user: { id: user.id, email: user.email, role: user.role },
  tenant: tenant ? { ... } : null,
  accessToken,
  expiresIn: accessTokenTtl,
  refreshToken: newRefreshToken,
};
```

**Service 跟 route 之間的 response shape 漂移**，沒有任何 test 抓這個。

## 為什麼之前測試沒抓到

1. `refresh.test.ts` 原本的 happy path test 只 assert `accessToken` + `refreshToken` 兩個欄位
   存在，**沒 assert user / tenant 存在**
2. backend 跟 frontend 之間沒有 conformance test 對 `AuthSessionDto` shape
3. local dev session recovery 用 Vite proxy，看起來 work（但實際上 frontend
   拿到 session.user === undefined 仍然看起來 work，因為 AuthProvider
   loading=false 後 `isAuthenticated = state.user && state.accessToken`,
   而 `state.user` 是 null，**但本地 dev 的 Browser 也用 `state.accessToken`**
   作 fallback... 不對，這條 reasoning 不通。

實際上 local dev 看起來 work 是巧合 — 因為 dev 環境的 `useAuth` 早期版本
有額外的 fallback path。但 production build 後 strict mode 把那條 path
tree-shake 掉了，露出問題。

## 修法

### `apps/backend/src/modules/auth/routes/refresh.ts`

```ts
// after
return c.json(result);
```

直接回傳整個 `result`（service 已經 hydrate 完整 `AuthSessionDto`）。

### `apps/backend/src/modules/auth/tests/refresh.test.ts`

新增 failing test：

```ts
it('refresh response includes user + tenant (Bug-7 follow-up)', async () => {
  const app = buildApp();
  const res = await callRefresh(app, 'saome_refresh=old-refresh-token');
  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;
  expect(body.user).toEqual({
    id: 'user-1',
    email: 'user@example.com',
    role: 'tenant',
  });
  expect(body.tenant).toBeNull();
});
```

TDD 流程：寫 failing test → 確認 RED → 改 source → 確認 GREEN。

### 前端配套調整

- `apps/frontend/src/hooks/useAuth.tsx`：3 處加 `(session.expiresIn ?? 28800) * 1000`
  fallback，因為 `AuthSessionWithTenant.expiresIn?: number` 是 optional
- `apps/frontend/src/services/authService.ts`：doc-comment 更新
- `apps/frontend/src/pages/auth/LoginPage.test.tsx` +
  `apps/frontend/src/pages/HomePage.test.tsx` +
  `apps/frontend/src/components/layout/Header.test.tsx` +
  `apps/frontend/src/hooks/useAuth.test.tsx`：mock `refresh()` 改回
  full-session shape

### 為什麼前端 test 之前會 fail

我之前 deploy 這個 fix 時，**只 deploy 了 backend 但前端 test 還在 mock 舊 shape**
（`{accessToken, expiresIn}`），所以 backend source 跟 frontend test 一起壞。
後來前端 test 一起改成 mock full session shape。

## 驗證

| 驗證項 | 結果 |
|---|---|
| `npx vitest run src/modules/auth/tests/refresh.test.ts` | 4 → 5 tests, 1 failing → 5 passing |
| Backend 全 suite | 5/5 → 5/5 |
| Full suite (frontend + backend) | 185 → 186 tests all green |
| `npx tsc -b --noEmit` (frontend) | exit 0 |
| `npx wrangler deploy --dry-run` | `dist/index.js` line 11840 從 `c.json({accessToken, expiresIn, refreshToken})` 變成 `c.json(result)` |
| Deploy | saome-backend version `8ceb5e48-1172-4f12-9a2d-38999d186ce7` ✅ |
| E2E probe `auth-trace.mjs` | refresh body 現含 `user.email`, `user.role` ✅ |

## 衍生

### 影響的其他檔案

- `apps/frontend/src/hooks/useAuth.tsx` — 改 `(session.expiresIn ?? 28800)`
- 4 個 frontend test 檔 — mock 改成 full-session shape

### 還沒處理

- `apps/backend/src/modules/auth/services/refreshService.ts` 跟 `routes/refresh.ts`
  的 service/route boundary **還沒自動化 test 抓 drift**。建議下次加
  `apps/backend/src/modules/auth/tests/refresh-service-route-conformance.test.ts`，
  assert `refreshService` return shape === `refreshRoute` response shape。

### 連到的 feedback / dev-log

- `DEV/08-2026/0808-bug-7-trace.md` — 完整 7 個 bug trace
- `runs/improvements/feedback/20260808-homepage-no-redirect.md` — Bug-7 的 UX follow-up

## 自問

### 下次怎麼不犯？

寫任何 route handler 之前，**先確認 service function 的 return type 是 `ResponseDto`**
（不是 `internalDto`）。route 只負責 HTTP-level mapping，不應該 selective serialize。

### 哪條 rule 該補？

`rules/019-schema-contract-drift.mdc` 已經有「backend request.ts 必須 mirror shared schema」。
但**沒有涵蓋 backend 自己內部 service → route 的 response drift**。
下次應該加 section：「backend service return type 必須 == route response shape」。

### 哪個 test 該加？

如上：`refresh-service-route-conformance.test.ts`，assert
`Object.keys(refreshService return) === Object.keys(refreshRoute response)`。

---

> 撰寫者：Josh (via Cursor) ｜ 時間：2026-08-08 04:48 UTC+8