# SAOME Self-Improvement Index

> 索引每次 session 在 `runs/improvements/feedback/` 寫下的「教訓」。
> 新 session 開啟時第一件事：讀本 INDEX 了解最近發生過什麼。

## 索引

| 日期 | 主題 | 路徑 | 影響 / 後續 |
|------|------|------|------|
| 2026-08-08 | 7 個 Bug 完整 root cause trace（admin-login recovery chain）| DEV/08-2026/0808-bug-7-trace.md | 沉澱 5 個共同 pattern（deploy 後才算完工 / 200 OK ≠ 完工 / config 不分 build target / API contract drift / chain-think 缺失）|
| 2026-08-08 | Bug-7 follow-up：HomePage reverse-direction redirect 太廣 | runs/improvements/feedback/20260808-homepage-no-redirect.md | HomePage 移除 reverse-direction AuthGuard，Header email 變 dashboard link（commit `d6be7aa`）|
| 2026-08-07 | Bug-7 refresh route 沒回 user/tenant（deploy gap）| runs/improvements/feedback/20260807-bug7-refresh-deploy-gap.md | `routes/refresh.ts` 改 `c.json(result)`；加 user/tenant assertion；commit `52b23aa` |
| 2026-07-31 | Register 表單 autofill + schema drift 三連環 | runs/improvements/feedback/20260731-register-autofill-schema-drift.md | 新增 rule `018` (form autofill + multi-step state) + `019` (schema contract drift)；新增 skill `saome-form-integrity`；commit + push（規範層） |
| 2026-07-27 | spec-kit-demo merge 誤刪 12 rules | runs/improvements/feedback/20260727-rules-overwritten-by-speckit-merge.md | 規範層修復已 push（commit `652e0a2` + `704af2a`） |
| 2026-07-27 | MemberBadge verification 漏跑 | runs/improvements/feedback/20260727-member-badge-verification-missed.md | 補強 `.cursor/rules/006-verification.mdc` commit message 驗證輸出欄位 |
| 2026-07-27 | SDD / BDD / TDD 三層流程試跑 | runs/improvements/feedback/20260727-sdd-bdd-tdd-flow-test.md | 觀察用，無規範變更 |
| 2026-07-27 | Cloudflare Pages 部署 + lockfile 跨平台 binding | runs/improvements/feedback/20260727-cloudflare-pages-deploy.md | 補強 rule `015` + `016` + deploy skill；commit `80a97b7` 修 lockfile；新增 `apps/frontend/scripts/audit-lockfile-bindings.cjs` |
| 2026-07-27 | Dependabot 5 漏洞 deferred | runs/improvements/feedback/20260727-dependabot-deferred.md | 等 SPEC-002 `dependabot-triage` 開工復工 |

## 使用方式

1. **新 session 開啟** — 第一件事讀本 INDEX 了解最近教訓。
2. **找特定主題** — 依日期與主題欄定位。
3. **寫新 feedback** — `runs/improvements/feedback/YYYYMMDD-<topic>.md`，至少含「背景/根因/修法/學習」四段。
4. **新增 feedback 後** — 回頭在本 INDEX 加一行（依日期倒序排）。

## 觸發條件

引用 `.cursor/skills/saome-self-improvement/SKILL.md` trigger #5：同日多於 1 個 feedback 時必須觸發更新此 INDEX。
