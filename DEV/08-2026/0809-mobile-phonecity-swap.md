# mobile / phoneCity 必填性對調實作日誌

## Metadata

- **日期**：2026-08-09
- **作者**：Josh（agent-assisted via Cursor）
- **觸發**：使用者要求「手機改必填、市內電話改選填」
- **規則 / skill 觸發**：`saome-dev-logging`、`saome-form-integrity`（schema drift）、`saome-task-router`（L2 Standard）

---

## 實作範圍

### 改動涉及範圍（Scope）

| 層 | 檔案 | 變更 |
|---|---|---|
| DB | `apps/backend/migrations/001_init_users_tenants.sql` | `mobile` NOT NULL、`phone_city` NULL |
| DB | `packages/supabase/migrations/` | 同上（Supabase MCP migration） |
| shared schema | `packages/shared/src/schemas/auth.ts` | `mobile` required、`phoneCity` optional |
| backend request | `apps/backend/src/modules/auth/schemas/request.ts` | `mobile` required、`phoneCity` optional/nullable |
| backend db | `apps/backend/src/modules/tenants/db/tenants.ts` | `phone_city: string \| null`、`mobile: string` |
| backend dto | `apps/backend/src/modules/tenants/schemas/response.ts` | `mobile: string`、`phoneCity: string \| null` |
| backend service | `loginService.ts`、`refreshService.ts`、`registerService.ts` | 加 `?? null` fallback |
| frontend | `RegisterForm.tsx` | mobile 移到上方加 required、phoneCity 移到下方移除 required |
| i18n | `theme.zh-TW.json`、`theme.en.json`、`dashboard.zh-TW.json`、`dashboard.en.json` | mobile hint 改「必填」，加 phoneCity hint「選填」 |
| Field component | `Field.tsx` | 加 `aria-required` propagation |
| frontend test | `RegisterForm.test.tsx` | 更新 required/optional 斷言 |

### 驗證結果

| 驗證項 | 結果 |
|---|---|
| Backend typecheck (`npx tsc -b`) | ✅ |
| Backend tests (`npx vitest run`) | ✅ 83/83 passed |
| Frontend build (`npm run build`) | ✅ |
| Bundle localhost grep | ✅ 無 localhost:8787 / localhost:5173 |
| Frontend RegisterForm tests | ✅ 5/5 passed |

---

## 自問

- **下次怎麼不犯？**
  - schema 改 required/optional 時，沒有先 grep 所有受影響的 test 和 service。改前應跑 full test suite。
- **哪條 rule 該補？**
  - `019-schema-contract-drift.mdc` 已涵蓋 triple-binding，但沒有明確要求「改 required/optional 前先跑 full test」。
- **哪個 test 該加？**
  - `loginService.test.ts`、`refreshService.test.ts`：加 `mobile` required、phoneCity optional 的 schema conformance test。
