---
title: "Admin-Login 6 連環 Bug — Index（Bug-4b → 4c → 4d → 5 → 6 → 7）"
date: 2026-08-08
type: feedback-index
scope: auth/recovery-chain
status: index
chain:
  - bug-4b
  - bug-4c
  - bug-4d
  - bug-5
  - bug-6
  - bug-7
commits_total: 8
---

# Admin-Login 6 連環 Bug — Index

> 這份文檔是「admin-login recovery chain」的索引頁。
> **不重複** Round 細節——所有 Round 已在對應的 feedback / DEV LOG 寫過。
> 本檔唯一目的：給「要看完整鏈條」的人一個入口。

## 為什麼要這個 index

| 痛點 | 修法 |
|---|---|
| 6 個 Round 散落在 4 個 feedback 檔 | 統一索引 → 一頁看完整鏈 |
| Bug-7 有 Round 1 + Round 2 + Bug-7a + Bug-7b 共 3 個 commit | 索引列出全部 SHA |
| 後續 auth-related bug 該怎麼參考 history | 從這頁開始 navigate |

## 6 連環真實鏈條

| Round | 症狀 | 根因（一句話） | Commit | 來源檔 |
|-------|------|---------------|--------|--------|
| Bug-4b | POST 500 "Scrypt failed" | scrypt params 跟 seed hash 不一致 + maxmem 太小 | `46dbd7a` | `20260728-admin-login-scrypt-mismatch.md` § Bug-4b |
| Bug-4c | POST 401，但 request 沒到 backend | `dist/` 烤進 `http://localhost:8787`，HTTPS origin Mixed Content drop | `d50da87` | 同上 § Bug-4c |
| Bug-4d | POST 不送出，OPTIONS 204 但沒 CORS header | `ALLOWED_ORIGINS` 缺 Workers preview subdomain | `bab5c97` | 同上 § Bug-4d |
| Bug-5 | POST 200 + Set-Cookie，但 URL 不變 | `LoginForm.onSubmit` 沒呼叫 `navigate()`，且 `/login` 沒有 back-button guard | `e0f9f44` | 同上 § Bug-5 |
| Bug-6 | 登入後 dashboard 文字不可讀 | `ComingSoonCard` 用 Tailwind neutral 沒用 design token | `0f349ba` | 同上 § Bug-6 |
| Bug-7 | refresh 200 但 response 沒 user/tenant | `refreshRoute` selective serialize，丟掉 service 已經 hydrate 的 `user` + `tenant` | `52b23aa` | `20260807-bug7-refresh-deploy-gap.md` |

## Bug-7 Round 2 follow-ups（3 個 commit）

| Round | 症狀 | 根因 | Commit | 來源檔 |
|-------|------|------|--------|--------|
| Bug-7a | cookie flags 跟 origin 不合 | `Secure; SameSite=Lax; Domain=.saome.org` 寫死，跨 origin 失效 | `cdab98c` | `20260808-bug7-trial-banner-pass-state.md` § Background |
| Bug-7b | `useAuth.refresh()` 漏寫 `pass` | service 回傳 `pass`，但 `useAuth` 沒寫入 state | `c76d992` | 同上 § Root Cause 1 |

## 對應的 Process Lessons 索引

`20260728-admin-login-scrypt-mismatch.md` 末尾有 10 條 Lesson，每條對應的後續 rule / skill：

| Lesson | 後續規範 |
|---|---|
| L1 — 200 ≠ working flow | (沒對應 rule，靠手動 SOP) |
| L2 — Mixed Content 不可見於 curl | `apps/frontend/scripts/audit-bundle-urls.cjs` + `runs/improvements/feedback/20260808-bug7-trial-banner-pass-state.md` |
| L3 — CORS preflight 不留 server trace | `apps/backend/src/shared/middleware/cors.ts` 加 ALLOWED_ORIGIN_PATTERNS |
| L4 — Static allowlist 不 scale | 同 L3 |
| L5 — auth redirect 易忘 | AGENTS.md「Auth flow 鐵律」第 2 條 |
| L6 — auth primitive 容易不對稱 | AGENTS.md「Auth flow 鐵律」第 3 條（AuthGuard + AuthenticatedRedirect） |
| L7 — bundle-level test 防 env drift | `.cursor/rules/017-production-bundle-guard.mdc` |
| L8 — exported-but-unused hook | (沒對應 rule，靠 review) |
| L9 — "works but looks wrong" P0 | AGENTS.md「Auth flow 鐵律」第 4 條 |
| L10 — test access strategy | i18next 在 vitest 內不會自動載入 |

## 衍生出來的其他 feedback

- `20260728-saome-13-frontend-session.md` — 同一天 13 個 frontend session 整合的紀錄（無 6 連環 bug，但同日 context）
- `20260728-spec-002-analyze.md` — 同一天 spec-kit 分析（spec 002 的 spec/plan/tasks 收斂）
- `20260808-homepage-no-redirect.md` — Bug-7 UX follow-up

## 怎麼 reproduce

```bash
# 從最早的 commit 開始 checkout 看 chain
git log --oneline 46dbd7a^..c76d992 -- apps/ apps/backend/
# 或只看 auth fix
git log --oneline --grep="fix\(auth\)" --all | head -20
```

## 怎麼引用

- **field-log-01 文章**：本檔是它的 reference index；文章本體不重寫 Round 細節，只摘要並 link 過來
- **未來 new admin-login bug**：先讀本檔確認是不是 chain 的延伸，再決定是否新增 Round
- **code review**：review 任何 auth PR 時，把本檔的 10 條 Lesson 過一遍