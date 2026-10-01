# Decision：Pass-templates 公開 Endpoint（含 Visibility Gate Drop）

**日期**：2026-09-29
**作者**：SAOME-REBUILD
**Scope**：L3 Heavy（新增 backend module + DB table + frontend service swap + 公開/認證路徑分流）

---

## 背景

「Pass Holder」是 wallet-card 的 end-user（手機拿到卡片的人），跟 SAOME platform member 是兩個完全不同的 persona。Captured data 是 pass-delivery info（email / phone），**不是** login credential。

v1 計畫的 endpoint 設計含一個 **public visibility gate**（只回 `status='published'` 的 template）。v2 把這個 gate 拿掉 — 理由詳 §「拿掉的決策」。其餘三個核心 decision（module 名稱 / mock 處理 / tenant isolation）仍保留。

---

## 選項與決定

### Decision 1 — Module 名稱：`pass-templates`

| 候選 | 範圍 | 命名理由 |
|---|---|---|
| `pass` | 付款後發卡流程 | 既有 module，**不適用** |
| `pass-templates` | 公開預覽 / 註冊 / 公開 metadata 讀取 | ✅ 路徑對齊 `/api/pass-templates/...` |
| `public` | 任何公開 endpoint | 太廣，後續 opt-in flow、recovery link 都會混進來 |

**決定**：`pass-templates`

理由：

- 兩個 module 用途完全不同：`pass` 是付款後 wallet 發卡（需 auth）；`pass-templates` 是匿名訪客讀 template metadata + 註冊成為 pass holder（no auth）
- URL path `/api/pass-templates/:id/public` 跟 `/api/pass-templates/:id/register` 語義清楚
- 之後若加 `pass-templates/:id/qr`、`pass-templates/:id/recovery` 等 endpoint，都自然落在同一 module

### Decision 2 — Mock service 處理（env flag 切換）

| 選項 | 行為 |
|---|---|
| 砍掉 mock | production / dev / test 都走 HTTP |
| **Mock 保留但 fallback** ✅ | dev / test 預設走 HTTP；mock 透過 `VITE_USE_PASS_MOCK=true` 手動開啟 |
| Mock 自動 fallback | HTTP 失敗時退回 mock |

**決定**：**Mock 保留但 fallback**，env flag 控制

```ts
const useMock = import.meta.env.VITE_USE_PASS_MOCK === 'true';
async getTemplate(id) {
  if (useMock) return getMockTemplate(id);   // dev / test only
  return httpClient.get(...);                // production 唯一路徑
}
```

理由：

- Production 不該有「HTTP 失敗就退化到 mock」的行為，這會把 mock 資料 expose 給真實使用者。
- Dev backend 沒起來時手動開 mock 是合理的 dev velocity 工具，但 **不該是自動行為**（避免誤導）。
- Tree-shake：production build 沒有 `VITE_USE_PASS_MOCK=true` → mock 區段被 dead-code-elimination 砍掉。

#### Env 設定（rule `000-dynamic-config.mdc`）

| 檔案 | `VITE_USE_PASS_MOCK` |
|---|---|
| `apps/frontend/.env.development` | `false`（預設走 HTTP，dev backend 沒起才手動改 `true`）|
| `apps/frontend/.env.production` | `false`（唯一 production 行為）|
| `apps/frontend/.env.test` | `true`（vitest 預設走 mock 維持既有 test 行為）|

> 註：`apps/frontend/.env.test` 目前不存在，會在 Step 5 一併建立。

### Decision 3 — Tenant isolation：public endpoint 不揭露 tenant_id

**決定**：Public endpoint response **不包含** `tenant_id`、`created_by`、`updated_by`、`internal_settings` 等敏感欄位。Register endpoint **不存** `tenant_id`（`pass_holders` 是 end-user，不是 platform member）。

理由：

- UUID v4 不可枚舉（122 bits 熵），純靠 UUID 即可達成 tenant isolation。
- 攻擊者拿到 UUID 也不該能 cross-tenant enumerate。
- `pass_holders` table 設計上不存 `tenant_id`，因為 holder 跟 tenant 的關係是「透過 template_id 反查」，不是直接 FK。
- Conformance test 必含：`response 沒有 tenant_id / status / settings 全量`（詳 Step 7 backend tests）。

---

## 拿掉的決策（v1 → v2）

### ~~Public visibility gate~~ — **v2 拿掉**

v1 設計：

```sql
-- v1: 只回 published，其他（含 draft / abandoned）一律 404
SELECT * FROM templates WHERE id = $1 AND status = 'published'
```

v2 設計：

```sql
-- v2: 任何 status 都回（不 filter）
SELECT * FROM templates WHERE id = $1
```

### 為什麼拿掉

| 理由 | 細節 |
|---|---|
| **DB 內 UUID 全是 draft** | `cardService.publish()` API 已寫好（`apps/frontend/src/services/cardService.ts` line 98-101），但 `git grep cardService.publish apps/frontend/src/components` → **0 hits**。目前沒有 UI 按鈕呼叫，tenant 永遠停在 draft。 |
| **UUID 不可枚舉** | UUID v4 有 122 bits 熵，brute-force 列舉不可行。要洩漏只能透過「分享 URL 這條 explicit 路徑」— 而分享 URL 時本來就是要讓收件者看到，gate 也擋不住。 |
| **Gate 擋掉合法訪客** | 本計畫的目標 UUID `716c4244-6c63-496d-a967-6c87cdac605d` 是 draft。套用 v1 gate → 訪客看到 404 → 跟「這個 UUID 不存在」無法區分 → 連 preview 都看不到。 |
| **Mock fallback 已經能 cover 開發** | dev backend 沒起時開發者開 `VITE_USE_PASS_MOCK=true` 即可，不需要靠 visibility gate 過濾。 |

### Future Reconsideration Trigger（精確化）

**當以下任一條件成立時，重新開 Decision Log 重評 visibility gate**：

| Trigger | 觀察方式 |
|---|---|
| 業務元件 import `cardService.publish` | `git grep -l "cardService.publish" apps/frontend/src/components` |
| Dashboard 列表區分 draft / published | `apps/frontend/src/components/business/dashboard` 內有「未發布卡片」UI |
| Share modal / public URL 生成 UI 出現 | `apps/frontend/src/components/business/pass` 出現分享按鈕 |

重新評估時一併考慮：

- UI 是否有「未發布卡片」保護（draft 不應出現在 dashboard list 給 end-user 看到）
- UUID 在 publish 後才對外曝光（分享 modal 才拿 URL）
- Register flow 是否要區分「draft template 不接受註冊」vs「任何 template 都能註冊」

---

## 影響

| 範圍 | 影響 |
|---|---|
| `apps/backend/src/modules/pass-templates/` | 新 module（routes / services / db / schemas / tests），**無 status filter** |
| `supabase/migrations/20260929000001_019_init_pass_holders.sql` | 新增 `public.pass_holders` table（透過 `saome_supabase` MCP `apply_migration` + 同步 append `.applied-migrations.json`）|
| `apps/backend/src/shared/contracts/passTemplates.ts` | 新增 `PublicPassTemplateDto`（mirror `packages/shared/types/passHolder.ts::PublicPassTemplate`）|
| `apps/backend/src/index.ts` | mount `/api/pass-templates` |
| `apps/frontend/src/services/passHolderService.ts` | 加 `useMock` guard；production 唯一路徑走 `httpClient` |
| `apps/frontend/.env.{development,production,test}` | 加 `VITE_USE_PASS_MOCK` flag |
| `apps/backend/wrangler.jsonc` | **不變**（`*.josh1989213.workers.dev` pattern 已涵蓋）|
| `apps/backend/src/shared/middleware/runtimeCors.ts` | **不變**（同上 pattern 涵蓋）|
| `packages/shared/types/passHolder.ts` | **不變**（已對齊 8 欄 `PublicPassTemplate`）|
| Future trigger | 業務元件 import `cardService.publish` → 開新 Decision Log 重評 visibility gate |

---

## 計畫 Steps（reference）

| # | Step | 必跑 rule |
|---|---|---|
| ✅ 1 | **本 Decision Log** | Rule 001 § Decision Log |
| 2 | Migration `20260929000001_019_init_pass_holders.sql` + `apply_migration` + append `.applied-migrations.json` | Rule 035（MANDATORY）|
| 3 | `apps/backend/src/modules/pass-templates/`（routes / services / db / schemas / tests）| Rule 000 Part B § B.2 + 036 CORS 三層 |
| 4 | `apps/backend/src/shared/contracts/passTemplates.ts` | Rule 019 四層同步 |
| 5 | `apps/backend/src/index.ts` mount `/api/pass-templates` | — |
| 6 | `passHolderService.ts` 加 `useMock` guard + HTTP swap | Decision 1+2 |
| 7 | `.env.{development,production,test}` 加 `VITE_USE_PASS_MOCK` | Decision 2 |
| 8 | Backend tests（5 functional + 1 conformance）+ Frontend tests | Rule 003 TDD + 019 § 3 |
| 9 | Local 端到端驗證 | Rule 006 § Local 端到端驗證 |
| 10 | Deploy + post-deploy CORS 矩陣 + bundle audit | Rule 036 § 4 + 017 § Backend Worker CORS post-deploy check |