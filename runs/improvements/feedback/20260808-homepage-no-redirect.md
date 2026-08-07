# 2026-08-08 — Bug-7 follow-up: HomePage reverse-direction redirect 太廣

> Bug-7 修完後跑 production smoke，發現新問題：已登入用戶訪問任何
> 公開頁（包括 `/`、`/demo`、`/pricing/compare`）都被踢回 dashboard。
> 是 reverse-direction AuthGuard 套在 `HomePage` 太廣的後遺症。
>
> 完整 trace 見 `DEV/08-2026/0808-bug-7-trace.md`。

## 症狀

- 環境：production (`https://saome-frontend.josh1989213.workers.dev`)
- 觸發條件：admin 登入後，點 Header Logo（連到 `/`）或訪問 `/demo`
- 觀察到的錯誤：URL 被無聲 redirect 到 `/admin/dashboard`，user 想看 marketing copy 看不成
- 預期 vs 實際：
  - 預期：marketing landing 對所有人（包括已登入 user）顯示
  - 實際：已登入 user 訪問 `/` 被 `<Navigate to="/admin/dashboard" replace />` 踢回去

## 探針 / 重現

`tests/probe/ux-email-link.mjs`：

```
=== Step 3: Click Logo to navigate to / (HomePage) ===
Current URL after Logo click: https://saome-frontend.josh1989213.workers.dev/
Should NOT have redirected away from /
Has marketing hero text: 1

=== Step 6: Visit /pricing/compare (public route) ===
Current URL: https://saome-frontend.josh1989213.workers.dev/pricing/compare
Has email link: 1
Should NOT have redirected: true
```

修完之後這 2 條 assertion 都 pass。

`tests/probe/auth-trace.mjs`（修之前的 trace）顯示：

```
After /demo desktop-logout-btn: 0
After /demo auth-user-email: 0
=== /api/auth/refresh trace ===
 - 200 http://localhost:5173/api/auth/refresh user=NONE role=NONE
 - 200 http://localhost:5173/api/auth/refresh user=NONE role=NONE
```

refresh 200，但 `user=NONE` → Header 看不到 logout btn（因為 `isAuthenticated=false`）。

## 根因

> `apps/frontend/src/pages/HomePage.tsx` 把 reverse-direction AuthGuard
> 套到 root page，太廣。

```ts
// beforereturn <Navigate to={ROLE_HOME_PATH[state.user.role as Role]} replace />;
```

這個 reverse-direction guard 是 Bug-5 fix (`e0f9f44`) 加到 `LoginPage` /
`RegisterPage` 的，**目的是 back-button 重 render login form**。同樣的
pattern 被 copy 到 `HomePage`，但**對 `HomePage` 不適用** — HomePage 是
public marketing landing，所有人都應該看到。

### 為什麼之前測試沒抓到

- `HomePage.test.tsx` 原本有 2 條 test 期待 reverse-direction redirect
  （`redirects an authenticated admin from / to admin dashboard`），
  **測試本身在 enforce bug**
- 沒有人 catch 這條 test 不應該期待 redirect
- smoke test 沒有從 production user 視角跑「登入後訪問 `/`」這個 flow

## 修法

### `apps/frontend/src/pages/HomePage.tsx`

移除 reverse-direction branch：

```ts
// after
export function HomePage() {
  // Touch useAuth so the AuthProvider's session-recovery effect has a reason
  // to run on mount even if we don't redirect.
  useAuth();

  return (
    <>
      <Hero />
      <SocialProof />
      ...
      <CTASection />
    </>
  );
}
```

注意：保留 `useAuth()` 呼叫 — 這樣 AuthProvider 的 session-recovery effect
仍然 mount 時跑（refresh cookie 還在的話 state 會更新），只是 HomePage
不 navigate 而已。

### `apps/frontend/src/components/layout/Header.tsx`

Desktop + mobile menu 的 user email `<span>` 改 `<Link>`，
href 為 `ROLE_HOME_PATH[role]`：

```tsx
<Link
  to={dashboardPath}
  className="text-sm font-medium transition-colors hover:opacity-80"
  style={{ color: 'var(--color-muted-foreground)' }}
  data-testid="auth-user-email"
  aria-label={t('nav.openDashboard')}
>
  {state.user?.email}
</Link>
```

Mobile menu 同樣：

```tsx
<Link
  to={dashboardPath}
  className="w-full rounded-md border px-4 py-3 text-center text-sm font-medium"
  style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
  data-testid="mobile-auth-user-email"
  aria-label={t('nav.openDashboard')}
  onClick={() => setIsMobileMenuOpen(false)}
>
  {state.user?.email}
</Link>
```

### `apps/frontend/src/i18n/locales/{zh-TW,en}.json`

新增 `nav.openDashboard`：

| Locale | 值 |
|---|---|
| zh-TW | 前往儀表板 |
| en | Open dashboard |

### Test 調整

| 檔案 | 變更 |
|---|---|
| `apps/frontend/src/pages/HomePage.test.tsx` | 翻 2 條 test：redirect → keep-on-home |
| `apps/frontend/src/components/layout/Header.test.tsx` | 新 1 條 test：email 是 `<a href={ROLE_HOME_PATH[role]}>` |
| `apps/frontend/src/pages/auth/LoginPage.test.tsx` | mock refresh 回傳 full session |
| `apps/frontend/src/hooks/useAuth.tsx` + `apps/frontend/src/hooks/useAuth.test.tsx` | 加 `?? 28800` fallback |

TDD 流程：先 RED（test 翻成期待新行為，但 source 還沒改）→ 改 source → GREEN。

## 保留的 reverse-direction guard

`LoginPage` / `RegisterPage` 的 reverse-direction guard **保留**，因為
back-button 重 render login form 確實會 confuse user（Bug-5 修的就是這個）。

差別：
- `LoginPage` / `RegisterPage`：reverse-direction **保留**（back-button 防呆）
- `HomePage`：reverse-direction **移除**（marketing 對所有人都顯示）

## 驗證

| 驗證項 | 結果 |
|---|---|
| `npx vitest run src/pages/HomePage.test.tsx src/components/layout/Header.test.tsx` | 25/25 passing |
| Full suite | 185 → **186 tests** all green |
| `npx tsc -b --noEmit` | exit 0 |
| `npm run lint` | exit 0 (1 既有的 `useAuth.tsx` warning) |
| `npx wrangler deploy --dry-run` | 0 forbidden URLs, 1 production URL |
| Deploy | saome-frontend version `36781a52-5e37-43a0-8e88-ca8c71241556` ✅ |
| E2E probe `ux-email-link.mjs` (7 步) | All green ✅ |
| E2E probe `prod-smoke-ux.mjs` (production URL) | All green ✅ |

## 衍生

### 影響的其他檔案

- `apps/frontend/src/pages/HomePage.tsx`
- `apps/frontend/src/components/layout/Header.tsx`
- `apps/frontend/src/i18n/locales/zh-TW.json` + `en.json`
- 4 個 frontend test 檔（見 Test 調整）

### 連到的 feedback / dev-log

- `DEV/08-2026/0808-bug-7-trace.md` — 完整 7 個 bug trace
- `runs/improvements/feedback/20260807-bug7-refresh-deploy-gap.md` — Bug-7b (refresh 沒 user/tenant)

## 自問

### 下次怎麼不犯？

任何 reverse-direction guard（已登入訪問某 route → 推回 dashboard），
**必跑 product sense check**：這個 route 是「auth-only」還是「public marketing」？
只有 auth-only route 才能套 reverse-direction guard。

寫進 commit message 模板：`feat: reverse-direction guard on [route] because
[auth-only | back-button防呆]`。如果理由不夠明確，不加 guard。

### 哪條 rule 該補？

`rules/004-code-review.mdc` 的 review checklist 應該加一條：

> [ ] Reverse-direction AuthGuard 是否真的必要？route 是 auth-only 還是 public marketing？

### 哪個 test 該加？

- `apps/frontend/src/pages/HomePage.test.tsx` 應該加 1 條 E2E test：
  admin 登入 → 訪問 `/` → 看到 marketing content（**就是這次修完加的**）
- 應該建一個 Playwright spec `tests/e2e/auth-flow.spec.ts`，跑完整
  「login → marketing → email-link → dashboard → logout」chain。

---

> 撰寫者：Josh (via Cursor) ｜ 時間：2026-08-08 04:48 UTC+8