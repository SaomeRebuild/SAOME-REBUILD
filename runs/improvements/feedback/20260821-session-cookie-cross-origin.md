# 2026-08-21 Session / Cross-Origin Cookie + JWT Secret

## 背景

登入成功後，點擊「從頭建立」按鈕觸發 `/api/cards` 401，進而觸發跳轉到 `/login` 頁面。`AuthProvider` 重新整理 session 後自動跳回儀表板，形成「登入成功 → 點建立 → 跳登入頁 → 自動跳回儀表板 → 重複」的無窮迴圈。

---

## 根因分析

### Layer 1：跨域 Cookie 被 drop

Production 的 refresh cookie 設定：
```
Set-Cookie: refresh_token=<token>; 
  Domain=saome-backend.josh1989213.workers.dev; 
  HttpOnly; Secure; SameSite=Lax
```

問題：frontend 部署在 `saome-frontend.josh1989213.workers.dev`，cookie 的 `Domain=saome-backend.*` **不是** frontend 的子網域。瀏覽器在跨域請求時**靜悄悄地忽略**這個 cookie（不發送，也不回錯誤）。

結果：`/api/auth/refresh` 收不到 refresh token → 401 → 進 error handler → `handleBuildFromScratch` 捕獲錯誤 → redirect to `/login`。

### Layer 2：AuthProvider 的 auto-redirect 讓問題更複雜

`AuthProvider` 在 `/login` 頁 mount 時自動呼叫 `refresh()`：
- 這次請求是**同域**的（如果用 `navigate` 做 client-side redirect，URL 仍在 frontend domain）
- 所以 cookie **仍然沒發出去** → refresh 仍然 401
- 但 `AuthProvider` 的 error handler 看到 401，把 `isAuthenticated` 設為 `false` → 顯示登入表單
- 使用者**看到「已經登入過但又被要求登入」的狀態**

實際上真正的根因是 Layer 3。

### Layer 3：`JWT_SECRET` 從未被設定

錯誤訊息：
```
DataError: Imported HMAC key length (0) must be a non-zero positive integer
```

根因：`wrangler secret put JWT_SECRET` 的 pipe 模式沒有正確讀取輸入值，導致 Cloudflare 上的 `JWT_SECRET` 值為空字串 `''`。後端 fallback 到 `'dev-insecure-secret'`：

```typescript
// apps/backend/src/shared/lib/jwt.ts
export const JWT_SECRET = env.JWT_SECRET ?? 'dev-insecure-secret';
```

Production 用 `''` 當 secret key，jose 庫直接 throw `DataError`。

### Layer 4（附加）：Module-level token 的 async race

`authStore._accessToken` 是 module-level variable，多個 concurrent `refresh()` 呼叫同時修改同一個變數，產生 race：
- `refresh()` A 正在執行 `jwt.verify()`
- `refresh()` B 也同時執行 `jwt.verify()`
- 兩者都可能拿到 stale 的 `_accessToken`

修法：`authStore` 改用 `sessionStorage`（同步讀寫）+ `withRefreshMutex`（防止 concurrent refresh）。

---

## 修法

| # | 修法 | Commit |
|---|------|--------|
| 1 | `authStore.ts`：sessionStorage 取代 module-level variable + `withRefreshMutex` | `7d2ba2e` |
| 2 | `authService.ts`：`refresh()` 使用 mutex；`syncTokens()` 同時寫入 `accessToken` + `refreshToken` | `7d2ba2e` |
| 3 | `httpClient.ts`：`tryRefresh()` 改用 `Authorization: Bearer` header 送 refresh token（跨域安全），fallback 到 cookie | `7d2ba2e` |
| 4 | `apps/backend/src/modules/auth/routes/refresh.ts`：同時接受 cookie + `Authorization: Bearer` header | `7d2ba2e` |
| 5 | `JWT_SECRET` Cloudflare secret 設定（透過 Dashboard，手動設定 production secret） | 手動設定 |

---

## 自問

**Q：為什麼不是一開始就用 `Authorization: Bearer` header？**
A：最初實作時只考慮同域部署（frontend 和 backend 在同一個 origin），所以用 HttpOnly cookie。跨域部署後沒預見到 cookie 跨域限制。

**Q：`wrangler secret put` 的 pipe 模式有什麼問題？**
A：PowerShell 的 `echo` / `Write-Output` 在 pipe 時可能沒有正確傳遞 Unicode 字元（如特殊符號 `^`, `*`, `()`）。建議未來用 Dashboard UI 或 `--text` 參數直接設定。

---

## 規範層影響

本次 feedback 沒有觸發新規範，但有兩條既有 rule 需要對齊：

1. **`017-production-bundle-guard.mdc`** — 這個 case 是「後端 secret 未設定」，不是 bundle 問題，但仍屬於「deploy 後 API 端點失效」。建議在 `saome-github-deploy` skill 的 checklist 加一條：
   > 部署後端前，確認所有 Wrangler secrets 已正確設定（含 `wrangler secret list` 驗證）。

2. **`011-dev.mdc`** — Commit message 內的 Sync 欄位應該包含本次修復的 commit hash：`7d2ba2e`。

---

## 學習

| 項目 | 說明 |
|------|------|
| HttpOnly cookie 的 `Domain` 限制 | cookie 只能發到同域或子網域；跨域需要 `Authorization: Bearer` header |
| `wrangler secret put` pipe 模式 | PowerShell echo 可能破壞特殊字元；建議用 Dashboard UI |
| Production deploy checklist | 除了 bundle URL audit，還要驗證 backend secrets 是否存在 |
| Module-level variable + async | 多個 concurrent `refresh()` 會 race；需要 mutex |

---

## 參照

- `DEV/08-2026/0821-card-back-ui-and-extension-pattern.md` — 今天同步開發的卡片編輯器實作
- `.cursor/rules/017-production-bundle-guard.mdc` — bundle guard（需補充 backend secrets checklist）
- `apps/frontend/src/services/authService.ts` — `withRefreshMutex` 實作
- `apps/backend/src/modules/auth/routes/refresh.ts` — 雙重 token 來源（cookie + Bearer header）
- commit `7d2ba2e` — fix(auth): send refresh token as Authorization Bearer header on cross-origin refresh
