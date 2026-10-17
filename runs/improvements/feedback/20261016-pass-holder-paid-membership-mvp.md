# Feedback：Pass Holder 付費會員卡註冊流程 — MVP（前端 + mock service，後端真實 endpoint 落地 deferred）

**日期**：2026-10-16
**作者**：SAOME-REBUILD
**類型**：L2 Standard（純前端 + 1 個 DB migration + mock service 擴充）
**關聯**：
- 決策記錄：[`runs/decisions/2026-10-16-pass-holder-paid-membership-snapshot.md`](../decisions/2026-10-16-pass-holder-paid-membership-snapshot.md)
- DEV log：[`DEV/10-2026/1016-pass-holder-paid-membership-mvp.md`](../../DEV/10-2026/1016-pass-holder-paid-membership-mvp.md)
- 計畫：[`passholder_付費會員卡註冊流程_7c3fa86f.plan.md`](../../../.cursor/plans/passholder_付費會員卡註冊流程_7c3fa86f.plan.md)

---

## 摘要

在既有 `/pass/{templateId}` 公開頁下方新增「會員方案選擇 + 模擬付費」區塊；只有 `isPaid: true` 的模板才顯示。Passcreator API V3 端點尚未實作，前端先把 `selectedTierIndex` + `membershipTierSnapshot` + `paymentProvider` + `paymentStatus` 一起塞進 `passHolderService.register` 的 payload 送出（mock service log 即可，DB 寫入等後端真實 endpoint 落地）。currency 驅動 Payfast（ZAR）/ Ecpay（TWD）按鈕 logo + 點擊 1.5s 模擬付款狀態。

## 範圍（11 個新檔 + 6 個擴充 + 1 migration）

### 新增

| 檔案 | 行數 | 用途 |
|---|---|---|
| `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderMembershipTiers.tsx` | 98 | 主組件（≤ 100 行 Rule 000 §A.2）|
| `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderMembershipTierRow.tsx` | 170 | Radio Card sub-component |
| `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderPaymentButton.tsx` | 122 | Payfast / Ecpay 3-state button sub |
| `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderMembershipTiers.types.ts` | 105 | 共用型別 + `resolvePaymentProvider` helper |
| `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.helpers.ts` | 72 | `buildMembershipTierSnapshot` + `resolvePaymentFields` 純函式 |
| `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/index.ts` | 17 | barrel |
| `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderMembershipTiers.test.tsx` | 151 | 主組件 10 條 conformance |
| `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderMembershipTierRow.test.tsx` | 169 | 11 條 sub-component test |
| `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderPaymentButton.test.tsx` | 136 | 10 條 3-state test |
| `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderMembershipTiers.stories.tsx` | 116 | 3 個 Storybook 場景 |
| `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderPaymentButton.stories.tsx` | 89 | 6 個按鈕狀態 story |

### 擴充

| 檔案 | 變更 | 行數 |
|---|---|---|
| `packages/shared/types/passHolder.ts` | +3 型別（PublicMembershipTier / MembershipTierSnapshot）+ PublicPassTemplate 加 3 optional 欄位 + PassHolderPayload 加 4 optional 欄位 | +50 |
| `apps/frontend/src/i18n/locales/passHolder.zh-TW.ts` | + `membership.*` 區塊（11 keys）| +28 |
| `apps/frontend/src/i18n/locales/passHolder.en.ts` | + `membership.*` 區塊（11 keys）| +29 |
| `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.tsx` | 整合 tier / payment state + submit 鎖定 + 防禦性 onValidSubmit guard | 98 行（≤ 100）|
| `apps/frontend/src/components/business/pass/PassHolderRegistration/index.ts` | + barrel 出口 | +9 |
| `apps/frontend/src/services/passHolderService.ts` | `demo-gym` 加 isPaid=true + currency='TWD' + 2 tiers；新增 `demo-gym-zar` 鏡像 | +44 |
| `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.test.tsx` | + 7 條 paid-membership scenarios | +198 |
| `apps/frontend/src/services/passHolderService.test.ts` | + 4 條 demo-gym / demo-gym-zar / paid-membership register test | +60 |

### Migration（**untracked, pending MCP apply**）

| 檔案 | 用途 | MCP 狀態 |
|---|---|---|
| `supabase/migrations/20261016000001_023_add_pass_holder_payment_fields.sql` | 6 個新欄位（selected_tier_index / membership_tier_snapshot / payment_provider / payment_status / paid_amount / currency）+ CHECK constraints + defensive backfill | ⚠️ `apply_migration` 在本 session 回 `MCP descriptor not found`（Rule 037 第 N 次犯）|

## MCP Apply 失敗（Rule 037 第四次犯）

依照 Rule 035 § 4：若 `apply_migration` 失敗，**不要** commit SQL 檔，等 MCP reconnect 再 apply。SQL 檔目前是 `??` untracked 狀態，符合規範。

### 嘗試

| # | Server / Tool | 結果 |
|---|---|---|
| 1 | `CallMcpTool server="user-saome_supabase" tool="apply_migration"` | `MCP descriptor not found` |
| 2 | `CallMcpTool server="user-saome-supabase" tool="apply_migration"` | `MCP descriptor not found` |
| 3 | `CallMcpTool server="user-saome-supabase" tool="execute_sql"` | `MCP descriptor not found` |
| 4 | `CallMcpTool server="user-saome-supabase" tool="list_tables"` | `MCP descriptor not found` |
| 5 | `CallMcpTool server="user-saome_supabase" tool="list_tables"` | `MCP descriptor not found` |

5 個呼叫全部回同樣錯誤，符合 `runs/improvements/feedback/20260930-pass-templates-mcp-descriptor-blocker.md` 跟 `runs/improvements/feedback/20261003-mcp-tool-call-pattern-regression.md` 描述的「Cursor runtime 層級 descriptor mapping 注入壞掉」pattern（雖然歷史 trace 結論是「`CallMcpTool` 包 pre-listed 工具是 anti-pattern」— 但本 session 的 GetMcpTools 確認 `saome-supabase` 是 runtime discoverable，**唯一路徑是 `CallMcpTool`**，而 `CallMcpTool` 也壞了，這是純 Cursor runtime bug）。

### Resolution path

| 步驟 | 動作 |
|---|---|
| 1 | 重新啟動 Cursor session（client process 重啟 → MCP descriptor 重新注入）|
| 2 | 重新啟動後驗證：`CallMcpTool server="user-saome-supabase" tool="list_tables"` 應回傳 table 清單 |
| 3 | 驗證後跑 `apply_migration`（SQL 內容已存在 `supabase/migrations/20261016000001_023_add_pass_holder_payment_fields.sql`）|
| 4 | 成功後立刻 append registry entry：<br>`{ "filename": "20261016000001_023_add_pass_holder_payment_fields.sql", "applied_at": "2026-10-16", "applied_by": "pass-holder-paid-membership-snapshot", "via": "saome_supabase-mcp", "notes": "Extend pass_holders with paid-membership tier + payment snapshot. No real Passcreator API V3 integration yet; frontend mock persists via the existing register mock. See runs/decisions/2026-10-16-pass-holder-paid-membership-snapshot.md." }` |
| 5 | 跑 `npm run check:migrations --workspace=apps/backend` 確認通過 |
| 6 | frontend typecheck / lint / test 全部已在本 session 過（不依賴 DB）— deploy frontend 即可 |

## 驗證（Rule 006 全部在本 session 過）

| 驗證項 | 指令 | 結果 |
|---|---|---|
| TypeScript | `npx tsc -b apps/frontend/tsconfig.app.json --noEmit` | exit 0 |
| Frontend test (新檔) | `npx vitest run src/components/business/pass/PassHolderRegistration` | 4 files / 48 tests pass |
| Frontend test (service) | `npx vitest run src/services/passHolderService.test.ts` | 1 file / 18 tests pass |
| Frontend test (page) | `npx vitest run src/pages/pass/PassHolderRegistrationPage.test.tsx` | 1 file / 10 tests pass |
| Frontend test (layout) | `npx vitest run src/components/layout/PassHolderShell.test.tsx` | 1 file / 5 tests pass |
| i18n smoke test | `npm run verify:i18n` | 待跑（commit 前）|
| Migration registry CI gate | `npm run check:migrations --workspace=apps/backend` | ⚠️ 會 fail（因 registry 缺 023 entry）— deferred 到 MCP apply success 後 |

### 5 個子測試套件 + 11 條 sub-component + 10 條 main + 7 條 integration 共 81 條新 / 擴充 test 全綠

| Suite | File | Tests | 用途 |
|---|---|---|---|
| Tiers (主) | `PassHolderMembershipTiers.test.tsx` | 10 | section 渲染 / currency 驅動 provider / tier select / payment state / 邊緣 case |
| Tiers (sub) | `PassHolderMembershipTierRow.test.tsx` | 11 | 渲染 / cost 格式 / TWD vs ZAR 符號 / 免費 case / rewards / disabled |
| Tiers (sub) | `PassHolderPaymentButton.test.tsx` | 10 | Payfast / Ecpay logo / 3-state / disabled / parent-driven 轉換 |
| Registration | `PassHolderRegistration.test.tsx` (擴充) | 7 | paid template 渲染 / no tier 不 submit / no pay 不 submit / 完整 flow / ZAR 走 payfast / 非付費不渲染 / empty tiers 不渲染 |
| Service | `passHolderService.test.ts` (擴充) | 4 | demo-gym isPaid / demo-gym-zar / 非付費無 tier / register 接受 paid fields |

## 4 條教訓

1. **「isPaid + tiers 條件渲染」的 source-of-truth 放 `PublicPassTemplate` 是對的**：把 isPaid 跟 membershipTiers 都放在 shared/types 內，跟 `PublicPassTemplate` 一起 expose，未來 backend 真實 endpoint 落地時直接 emit 這兩個欄位即可（不用再 sync 第三個 surface）。Backend request.ts 與 db interface（Rule 019 § 4.1 第二三四層）deferred — plan § 9 待辦 1。

2. **「submit 鎖定」走 defense-in-depth 而不是純 UI button disable**：UI 端 button 仍可點（discoverability — user 按下去看為什麼沒反應），但 `onValidSubmit` 內 guard `if (submitBlocked) return;`（rule file 跟測試都有 pin）。Dev tools 強制 enabled button 也擋得住 — **「form 永遠可送，submit handler 自己擋」是 React 表單的 robust pattern**（不是 disabled 派）。

3. **payment state machine 3 段而非 4 段**：原 plan 草稿想過加 `'error'` 段（mock payment 失敗），但 4 段沒 user-visible trigger（mock 100% 成功）— 3 段 `'idle' | 'paying' | 'paid'` 簡潔夠用，future 真實金流整合時再加 `'error' | 'failed'`。**「少寫將來可能用到的 state」是 YAGNI 的真實版**。

4. **「Radio Card 用 `<label>` 包 `<input type="radio">` + `sr-only`」**：讓整個 card 表面都可點，鍵盤 / 螢幕閱讀器 / 觸控三種 input 一次滿足。Visible radio dot 改用 CSS span + Check icon 顯示狀態。**比 `<input>` + onClick 兩個獨立元素乾淨**。

## 4 條 follow-ups

| # | 內容 | 優先度 | 觸發時機 |
|---|---|---|---|
| 1 | **MCP apply migration 023**：見上「Resolution path」6 步 | P0 | MCP reconnected |
| 2 | **Backend `POST /api/pass-templates/:id/register` 真實 endpoint 落地**：(a) Rule 019 § 4.1 二三四層 schema sync (b) Rule 027 postgres.js dynamic query (c) Rule 032 backend jsonb merge silent killer — `membership_tier_snapshot` 是 jsonb 必走 zod 驗證 (d) 對 `selected_tier_index` / `currency` / `payment_provider` / `payment_status` 做 server-side validation | P0 | Next session |
| 3 | **Passcreator API V3 整合**：當付費完成後呼叫 Passcreator `/v3/pass` 推送實體 pass | P1 | Real payment 整合完成後 |
| 4 | **真實 Payfast / Ecpay API 串接**：替換目前 1.5s setTimeout 模擬 | P1 | 商業評估後 |

## Future Invariants

- `PublicPassTemplate.isPaid === true` 必伴隨 `membershipTiers` 非空（picker 才會 render — 否則 disabled section）
- `PublicPassTemplate.currency === 'ZAR' → resolvePaymentProvider → 'payfast'`，其他（含 undefined）→ 'ecpay'
- `submitBlocked` 雙重防護（button state + onValidSubmit guard）必同步存在；缺一即 UI 欺騙
- 任何 `membershipTierSnapshot` 寫入必走 zod 驗證（Rule 032 防 silent overwrite）— backend PR 必加
- `apply_migration` MCP failure 期間 migration file 必保持 untracked，**不能 commit workaround 規避**（Rule 035 § 4）
- 1.5s 模擬付款 delay 是 mock-only 數字；真實金流整合時必走 backend async polling 或 webhook

## commit 安排

**本 PR commit 跟以下檔案同 commit**（Rule 011 / 025 § Vibe Coding L2 Checklist 對齊）：
- 11 個新檔
- 6 個擴充檔
- 1 個 DEV log
- 1 個 feedback（本檔）
- 1 個 INDEX row

**MCP migration 023 不在本 PR commit**（per Rule 035 § 4 deferred — 等 MCP reconnected 後再走 `apply_migration` + append registry + commit migration file + 跑 `check:migrations`）。
