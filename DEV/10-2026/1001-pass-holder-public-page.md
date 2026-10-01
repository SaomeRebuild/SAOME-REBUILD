# 2026-10-01 — Pass Holder 公開 Get-Pass 頁面完整 master DEV LOG

> 給未來 trace 整條 Pass Holder 公開頁鏈的人 single entry point。本檔**不重述每個 phase 的細節**——所有根因 + 修法都在對應 decision / feedback 裡；本檔負責**架構全景 + 跨 phase 設計 invariant + 給未來 session 的提醒**。

## 一句話總結

把 SAOME 既有公開 endpoint（`/api/pass-templates/:id/public`）從 backend-only 拉到完整 frontend 頁面：**Page + L3 Layout（Shell）+ Header（ThemeToggle slot）+ L2 Form（PassHolderRegistration 全套 sub-component）+ service（mock/HTTP 雙模式 + env gate）+ 4 層 schema sync 把 `template.language` 接進頁面 i18n**。跨越 4 個 session（9/29 Decision → 9/30 MCP blocker → 10/01 Q1+Q2 → 10/01 Q3 + Header ThemeToggle），沉澱 4 條新規範。

## 範圍 vs SAOME 既有 page

| 對比項 | Dashboard / Login / Register（既有） | **Public Get-Pass（本檔）** |
|---|---|---|
| 受眾 | 已登入的 SAOME tenant user | 匿名訪客（掃 QR / 點連結進來）|
| Auth | 必填 JWT cookie | **完全 no auth** |
| i18n 來源 | `getInitialLanguage()` 讀 localStorage / browser locale | **`template.language`**（DB 設定優先），透過 `applyPageLanguage(lang)` 切換（不寫 localStorage）|
| Theme | 既有 theme toggle | **公開訪客必看 theme toggle** — 維持 dashboard 視覺一致性 |
| Layout | `<AppShell>` + nav + footer | 簡化版 `<PassHolderShell>`（僅 header + main + DashboardFooter）|
| Form data 落點 | `public.members`（平台 user）| **`public.pass_holders`**（wallet-card end-user，跟 platform member 解耦）|
| Mock fallback | 不適用（登入必要） | **必備** — `VITE_USE_PASS_MOCK=true` 讓 dev backend 沒起也能 iterate UI |

## 完整時間軸（4 個 phase）

> 編號規律：phase 是「同一個 feature 的連續迭代」，每個 phase 解 1 個或一組相關決策 / bug。phase 內可能有 1+ session。

| Phase | 觸發 | 主要交付 | 設計 / 修法 | 對應檔 |
|---|---|---|---|---|
| **1（9/29）** | 「Pass Holder 是新 persona，跟 member 解耦」| Decision Log + migration + backend module + frontend service + `.env.*` 三層 gate | `Decision 1-3`（module name `pass-templates`、mock fallback、tenant isolation）+ 拿掉 v1 visibility gate | [decision 2026-09-29](../runs/decisions/2026-09-29-pass-templates-public-endpoint.md) |
| **2（9/30）** | Migration 想 apply 但 saome_supabase MCP descriptor not found | 4 次 retry + 根因發現（**用錯工具：CallMcpTool 包 pre-listed 工具 → 應直接呼叫獨立工具名**）| Rule 035 SOP 補強（pre-listed tool 呼叫法） | [feedback 20260930](../runs/improvements/feedback/20260930-pass-templates-mcp-descriptor-blocker.md) |
| **3（10/01 morning）** | Deploy 後 production 端測試撞 2 個 bug | backend Q1 logo proxy + UUID zod parse + i18n passHolder namespace + frontend L2 component + L3 Shell + Header (without ThemeToggle) + Page + 4 層 schema sync 把 language 接進 DTO | Q1: 公開 logo proxy + R2 audit；Q2 (a): UUID zod parse → 404（不是 500）| commit `7c4c355` + decision [2026-10-01-pass-holder-language.md](../runs/decisions/2026-10-01-pass-holder-language.md) |
| **4（10/01 afternoon）** | Phase 3 部署後 user 撞 3 個新 bug（Q1+Q2+Q3 + 缺 ThemeToggle） | `applyPageLanguage` helper（in-memory only）+ zod key 改相對路徑 + Header 加 ThemeToggle slot + Page 對齊 4 state machine（loading/loaded/not-found/error） | Q1: `:` 是 pattern marker 寫 JSDoc + 2 條 regression；Q2 (b): fallback design `?? 'en'`；Q3: zod 相對 key + `t(key, key)` pattern | [decision 2026-10-01-pass-holder-language.md](../runs/decisions/2026-10-01-pass-holder-language.md) + [feedback 20261001](../runs/improvements/feedback/20261001-pass-holder-language-and-validation.md) |

> **Phase 4 對應本 session 結尾「header 加 ThemeToggle」**：最後一個動作是在 `PassHolderHeader` 右側 slot 加 `<ThemeToggle />`，加 2 條 regression test 確認 loading 跟 loaded 兩個 state 都渲染 ThemeToggle，mock `useTheme()` 避免 localStorage state 跨 test 污染。

## 架構全景

```
┌──────────────────────────────────────────────────────────────────┐
│ Frontend（公開 page，no auth）                                     │
├──────────────────────────────────────────────────────────────────┤
│ App.tsx                                                          │
│  └── route /pass/:templateId                                     │
│      └── PassHolderRegistrationPage                              │
│          ├── useParams({templateId})                             │
│          ├── useEffect → passHolderService.getTemplate(id)       │
│          │     ├── VITE_USE_PASS_MOCK=true → SAMPLE_TEMPLATES    │
│          │     └── 否則 → httpClient → backend                  │
│          ├── applyPageLanguage(template.language)  // Q2 fix   │
│          └── 4 state machine: loading | loaded | not-found | error│
│              ├── PassHolderShell (L3 layout)                     │
│              │   ├── PassHolderHeader (含 ThemeToggle slot)     │
│              │   ├── main > PassHolderRegistration (L2)         │
│              │   └── DashboardFooter (reuse 既有)                │
│              └── ComingSoonCard (404 / 錯誤 placeholder)        │
├──────────────────────────────────────────────────────────────────┤
│ passHolderService（mock + HTTP 雙模式）                          │
│  ├── SAMPLE_TEMPLATES（8 種 cardType 各 1 個，Vite DCE）         │
│  ├── getTemplate(id) → PublicPassTemplate | PassHolderNotFound   │
│  └── register(templateId, payload) → {ok, passHolderId}          │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Backend（Worker runtime）                                         │
├──────────────────────────────────────────────────────────────────┤
│ src/index.ts                                                     │
│  └── /api/pass-templates/:id/public  (Q1 logo proxy + Q2 zod)   │
│      └── getPublicService → findPublicTemplateById(sql, id)      │
│          → templates WHERE id = $1  (no status filter, v2)       │
│          → 回 { template: { id, name, cardType, ..., language } }│
│      └── /api/pass-templates/:id/logo  (Q1 fix — proxy + 204)  │
├──────────────────────────────────────────────────────────────────┤
│ DB（Supabase）                                                    │
│  └── public.pass_holders（019 號 migration，holder end-user 表） │
│      UNIQUE (template_id, email)                                 │
└──────────────────────────────────────────────────────────────────┘
```

### 檔案清單（11 個新檔 + 16 個修改檔）

#### Frontend 新增（10）

| 檔案 | 行數 | 用途 |
|---|---|---|
| `apps/frontend/src/components/layout/PassHolderShell.tsx` | 31 | L3 layout（header + main + footer 三段式）|
| `apps/frontend/src/components/layout/PassHolderShell.test.tsx` | — | 5 條 shell render test |
| `apps/frontend/src/pages/pass/PassHolderRegistrationPage.tsx` | 137 | Page entry + 4 state machine |
| `apps/frontend/src/pages/pass/PassHolderRegistrationPage.test.tsx` | — | 10 條 page test（Q1 route pattern × 2 + Q2 language × 2 + 4 state × 多）|
| `apps/frontend/src/services/passHolderService.ts` | 252 | mock + HTTP 雙模式 + 8 種 SAMPLE_TEMPLATES |
| `apps/frontend/src/services/passHolderService.test.ts` | — | 14 條 service test |
| `apps/frontend/src/components/business/pass/PassHolderRegistration/`（10 個檔）| 11.5KB | L2 sub-component suite（Header + FieldSet + Form + Success + hooks + types + stories + test + index）|
| `apps/frontend/src/i18n/locales/passHolder.en.ts` | — | en 翻譯 |
| `apps/frontend/src/i18n/locales/passHolder.zh-TW.ts` | — | zh-TW 翻譯 |
| `apps/frontend/.env.test` | — | vitest 預設開 mock |

#### Backend 新增（1）

| 檔案 | 用途 |
|---|---|
| `supabase/migrations/20260929000001_019_init_pass_holders.sql` | `public.pass_holders` table + UNIQUE(template_id, email) |

#### Frontend 修改（11）

| 檔案 | 變更摘要 |
|---|---|
| `apps/frontend/src/components/layout/PassHolderHeader.tsx` | 加 `<ThemeToggle />` 右側 slot + 更新 JSDoc（明確「不要語言切換器」說明）|
| `apps/frontend/src/components/layout/PassHolderHeader.test.tsx` | +2 條 ThemeToggle integration test + mock `useTheme` |
| `apps/frontend/src/App.tsx` | mount `/pass/:templateId` route |
| `apps/frontend/src/config/routes.ts` | 加 `passHolder.registration` route 定義 |
| `apps/frontend/src/i18n/index.ts` | + `applyPageLanguage(lang)` helper（in-memory only）|
| `apps/frontend/src/test/i18n.ts` | sync test i18n resources |
| `apps/frontend/.env.development` | `VITE_USE_PASS_MOCK=false` 預設 |
| `apps/frontend/.env.production` | `VITE_USE_PASS_MOCK=false` 強制 |
| `apps/frontend/vite.config.ts` | + `@saome/shared/types/passHolder` alias |
| `apps/frontend/vitest.config.ts` | + `@saome/shared/types/passHolder` alias |

#### Backend 修改（4）

| 檔案 | 變更摘要 |
|---|---|
| `apps/backend/src/shared/contracts/passTemplates.ts` | + `language: CardLanguage` on `PublicPassTemplateDto`（Q2 4 層 sync）|
| `apps/backend/src/modules/pass-templates/db/templates.ts` | 兩個 row interface 都加 `settings.language?: CardLanguage` |
| `apps/backend/src/modules/pass-templates/services/getPublicService.ts` | 兩個 service 都加 `language: settings.language ?? 'en'` |
| `apps/backend/src/modules/pass-templates/tests/getPublic.test.ts` | +3 條 Q2 regression test（language / fallback / null settings）|

#### Shared 修改（2）

| 檔案 | 變更摘要 |
|---|---|
| `packages/shared/types/passHolder.ts` | 新檔：`PublicPassTemplate` + `PassHolderPayload` + `PassHolderService` interface |
| `packages/shared/types/index.ts` | barrel re-export `passHolder` |

#### Docs（4）

| 檔案 | 用途 |
|---|---|
| `runs/decisions/2026-09-29-pass-templates-public-endpoint.md` | Phase 1 — module name + mock fallback + tenant isolation |
| `runs/improvements/feedback/20260930-pass-templates-mcp-descriptor-blocker.md` | Phase 2 — MCP 用錯工具 4 次 retry + 根因 |
| `runs/decisions/2026-10-01-pass-holder-language.md` | Phase 4 — language override design + Q1+Q2+Q3 取捨 |
| `runs/improvements/feedback/20261001-pass-holder-language-and-validation.md` | Phase 4 — Q1+Q2+Q3 bug fix trace |

### 4 層 schema sync（per Rule 019 § 4.1）— 涵蓋 `language` 欄位

| 層 | 位置 | 內容 |
|---|---|---|
| 1 | `packages/shared/types/passHolder.ts::PublicPassTemplate` | `language: CardLanguage`（**必填**，i18next `fallbackLng: 'en'`）|
| 2 | `apps/backend/src/shared/contracts/passTemplates.ts::PublicPassTemplateDto` | `language: CardLanguage` |
| 3 | `apps/backend/src/modules/pass-templates/db/templates.ts` | 兩個 row interface 都加 `settings.language?: CardLanguage`（DB 端 optional）|
| 4 | `apps/backend/src/modules/pass-templates/services/getPublicService.ts` | 兩個 service 都 `language: settings.language ?? 'en'`（application 端 fallback）|

#### 為什麼 L1 必填 + L3 optional

- L1（DTO）必填：前端拿到的 DTO **必須**有 `language`，不然 page 不知道該切哪個語系。
- L3（DB row）optional：DB 既有 5+ 個 demo 模板的 settings JSONB 沒 `language` 鍵（migration 在 2026-09-29 才把 language 加進 settings key 範圍，但 settings 是 JSONB 沒強制 schema）。改 required 會讓既有 demo 全部爆 500。
- L4 fallback 到 `'en'`：`i18next.fallbackLng: 'en'` 一致。en 是國際 fallback — 就算 fallback 錯了，en 用戶仍可讀。

### 4 層 schema sync — `PublicPassTemplate` 完整欄位

| 欄位 | L1 shared type | L2 backend DTO | L3 DB row (settings) | L4 service 輸出 |
|---|---|---|---|---|
| `id` | ✅ | ✅ | (col `id`) | — |
| `name` | ✅ | ✅ | (col `name`) | — |
| `cardType` | ✅ | ✅ | (col `card_type`) | — |
| `logoText` | ✅ | ✅ | `settings.logoText` | ✅ |
| `issuerName` | ✅ | ✅ | `settings.issuerName` | ✅ |
| `language` | ✅ | ✅ | `settings.language?` | ✅ `?? 'en'` |
| `issuerLogo` | ✅? | ✅? | `settings.issuerLogo?` | ✅? |
| `backgroundColor` | ✅? | ✅? | `settings.backgroundColor?` | ✅? |
| `textColor` | ✅? | ✅? | `settings.textColor?` | ✅? |

（✅? = optional）

### 5 個 module 拆解

#### Module 1 — Backend `pass-templates`

```
apps/backend/src/modules/pass-templates/
├── routes/
│   ├── getPublic.ts          ← GET /:id/public  (Q2: UUID zod parse → 404)
│   └── getLogo.ts            ← GET /:id/logo    (Q1: R2 audit + 204 fallback)
├── db/
│   └── templates.ts          ← findPublicTemplateById (v2 no status filter)
├── services/
│   └── getPublicService.ts   ← settings.language ?? 'en' fallback
└── tests/
    ├── getPublic.test.ts             ← 3 條 Q2 regression
    ├── getPublic.validation.test.ts  ← 3 條 UUID zod regression
    └── getLogo.test.ts               ← 7 條 logo proxy test
```

#### Module 2 — Shared contract

```
packages/shared/types/
├── passHolder.ts   ← PublicPassTemplate / PassHolderPayload / PassHolderService
└── index.ts        ← barrel re-export
```

#### Module 3 — Frontend i18n

```
apps/frontend/src/i18n/
├── locales/
│   ├── passHolder.en.ts      ← en translations
│   └── passHolder.zh-TW.ts   ← zh-TW translations
└── index.ts                  ← + applyPageLanguage(lang)  (in-memory only)
```

> 既有 `setLanguage(lang)` 寫 localStorage — 公開 page 不能用（會污染登入後偏好）。新 `applyPageLanguage(lang)` 只 `i18n.changeLanguage(lang)`，page reload 自動 revert。

#### Module 4 — Frontend service

```
apps/frontend/src/services/
└── passHolderService.ts    ← mock + HTTP 雙模式
    ├── useMock = import.meta.env.VITE_USE_PASS_MOCK === 'true'
    ├── SAMPLE_TEMPLATES    ← 8 種 cardType 各 1 個，Vite DCE 砍掉
    ├── getTemplate(id)     ← mock 延遲 300ms / HTTP 走 httpClient
    ├── register(templateId, payload)  ← mock console.info / HTTP 走 httpClient
    └── toPassHolderError(err, id)     ← SaomeApiError → PassHolderError
                                       ← 404 → PassHolderNotFoundError(i18nKey)
                                       ← 5xx → 'common.error.serverError'
```

> **為什麼 production 不自動 fallback mock**：攻擊者打 backend → backend fail → frontend 退到 mock → 攻擊者看到假資料。Production 唯一行為是 HTTP。Dev backend 沒起時手動開 mock 是 OK 的 dev velocity 工具。

#### Module 5 — Frontend layout + page

```
apps/frontend/src/
├── components/
│   ├── layout/
│   │   ├── PassHolderHeader.tsx       ← 公開頁 header（含 ThemeToggle slot）
│   │   ├── PassHolderHeader.test.tsx  ← 5 + 2 ThemeToggle 條 test
│   │   ├── PassHolderShell.tsx        ← L3 layout（header + main + DashboardFooter）
│   │   └── PassHolderShell.test.tsx   ← 5 條 shell render test
│   └── business/pass/PassHolderRegistration/   ← L2 component 資料夾
│       ├── index.ts                            ← barrel
│       ├── PassHolderRegistration.tsx          ← 主組件（≤ 100 行組裝）
│       ├── PassHolderRegistrationHeader.tsx    ← sub: header
│       ├── PassHolderRegistrationFieldSet.tsx  ← sub: 擴充欄位 slot（passthrough）
│       ├── PassHolderRegistrationForm.tsx      ← sub: 4 欄位 RHF form
│       ├── PassHolderRegistrationSuccess.tsx   ← sub: 提交後 success view
│       ├── PassHolderRegistration.hooks.ts     ← usePassHolderForm
│       ├── PassHolderRegistration.types.ts     ← props types
│       ├── PassHolderRegistration.stories.tsx  ← Storybook
│       └── PassHolderRegistration.test.tsx     ← 6 條 test（含 Q3 + form 驗證）
└── pages/pass/
    ├── index.ts                                ← barrel
    ├── PassHolderRegistrationPage.tsx          ← 4 state machine（loading/loaded/not-found/error）
    └── PassHolderRegistrationPage.test.tsx     ← 10 條 test
```

## 4 條新規範沉澱

| Rule | 新增章節 | 來源 phase |
|---|---|---|
| **Rule 035（migration apply pipeline）§ 9** | MCP **完全無法呼叫**時的處理 SOP：不要 commit workaround + 區分「pre-listed tool」 vs 「runtime discover」 → pre-listed 工具直接呼叫獨立工具名（不包 `CallMcpTool`）| Phase 2 — 4 次 retry 的根因 |
| **Rule 019（schema contract drift）§ 4.1 Layer 4 同步** | 4 層同步必含 shared / backend DTO / db row / service 輸出；L1 必填 + L3 optional + L4 `?? 'en'` fallback pattern（i18n-driven schema）| Phase 3 + 4 — `language` 欄位的 4 層接線 |
| **Rule 023（shared package）§ i18n Namespace** | 新增 `applyPageLanguage(lang)` helper（in-memory only）— 公開 page 不能用 `setLanguage`（會污染登入後偏好）| Phase 4 — Q2 fix |
| **Rule 033（popover sizing）+ 新增 sidebar** | 公開 page 必備 ThemeToggle slot — 匿名訪客也能切換 light/dark mode；mock `useTheme` 避免 localStorage state 跨 test 污染 | Phase 4 — 結尾的「header 加 ThemeToggle」|

> **3 條既有 rule 套用**（沒有新增章節）：Rule 000 Part A（5 層分層 + L2 業務邲資料夾結構）、Rule 006（驗證清單）、Rule 013 + 014（RWD + breakpoint）。

## 跨 phase 設計 invariant

> **這段最重要**——給未來維護 Pass Holder page（或新加 public endpoint）的人。

| Invariant | 為什麼 |
|---|---|
| **Pass Holder ≠ Platform Member** | 兩個 persona 完全不同。Pass Holder 資料寫 `public.pass_holders`，platform member 寫 `public.members`。`login` / `register` flow **永遠不要**處理 Pass Holder 資料。|
| **公開 endpoint 必過 4 層 schema sync** | 任何公開 DTO 必含 `language` 欄位（i18n-driven）。L1 必填 + L3 optional + L4 `?? 'en'`。不寫就是 Q2 bug。|
| **公開 page 不能寫 localStorage** | `setLanguage` 寫 localStorage，匿名訪客瀏覽一次 `/pass/...` 後，登入 dashboard 會被鎖死語系。公開 page 必用 `applyPageLanguage(lang)`（in-memory only）。|
| **mock fallback 必手動 env flag 控制** | `VITE_USE_PASS_MOCK=true` 是 dev 工具，production 自動 fallback 會把假資料 expose 給攻擊者。Vite DCE 砍掉 mock 區段是 bonus，但 env flag 是必需。|
| **公開 endpoint 必過 tenant isolation** | `tenant_id` / `status` / `internal_settings` 不出現在 DTO；UUID v4 不可枚舉就是天然隔離。|
| **Q1 `:templateId` 是 React Router pattern marker** | URL 是 `/pass/<uuid>` 不是 `/pass/:<uuid>`。字面冒號 → wildcard 404 → Coming Soon。JSDoc + regression test 必備。|
| **zod error message 必走 i18n 相對 key** | `useTranslation('passHolder')` 已綁 namespace → zod key 必 `validation.nameRequired`（相對）不是 `passHolder.validation.nameRequired`（全路徑）。未來都應該用 `t(key, key)` pattern 防止 silent fail。|
| **header 必備 ThemeToggle slot** | 公開 page 沒 nav，ThemeToggle 是訪客唯一能客製 UI 的入口。mock `useTheme` 在 test 避免 localStorage state 跨 test。 |

## 驗證清單（per Rule 006）

```
Phase 1-4 全程：
✅ typecheck: npx tsc -b --noEmit (frontend + backend) 都 silent exit
✅ i18n smoke: npm run verify:i18n → 19 namespace(s) passed (38 locale files)
✅ audit-config-defaults: OK (no localhost leak)
✅ frontend build: vite build → 1.46 MB bundle (407 KB gzip)
✅ vitest frontend passHolder*: 36 條全綠（4 檔案）
   - PassHolderHeader.test.tsx (7) + PassHolderShell.test.tsx (5)
   - PassHolderRegistrationPage.test.tsx (10) + passHolderService.test.ts (14)
✅ vitest backend pass-templates: 40 條全綠（4 檔案）
   - getPublic.test.ts (含 3 條 Q2 regression)
   - getPublic.validation.test.ts (含 3 條 UUID zod regression)
   - getLogo.test.ts (7) + 其他
✅ migration apply: public.pass_holders table 已建 + UNIQUE(template_id, email)
✅ CI gate: npm run check:migrations → 17 migrations registered
```

## Self-improvement action items

| Action | Owner | Trigger | Status |
|---|---|---|---|
| **Rule 035 § 9 加 SOP：pre-listed MCP tool 直接呼叫獨立工具名，不包 CallMcpTool** | Self | Phase 2 教訓 | pending commit |
| **Rule 023 加 § `applyPageLanguage` helper pattern** | Self | Phase 4 Q2 教訓 | pending commit |
| **AGENTS.md 加 §「公開 page 不能寫 localStorage」** | Self | Phase 4 invariant | pending commit |
| **Rule 006 § 驗證清單加「公開 page 必含 ThemeToggle regression」** | Self | Phase 4 結尾 | pending commit |
| **Backend CORS post-deploy check（Rule 017 § backend）** | 部署時 | 部署到 production 後 | 下次 deploy 跑 |
| **瀏覽器開 production URL `/pass/<uuid>` 驗證 ThemeToggle + language switch** | Self | 部署後 | 下次 deploy 後跑 |
| **抽 `usePageLanguage(lang)` hook（內含 React effect 套用 + cleanup）** | 觀察 | 第 2 個 public page 落地時抽 | pending |
| **評估 Option C（公開 page 訪客手動切換器）** | 觀察 | Support ticket / Analytics 出現切換需求 | future |

## Cross-link index

- **Decision Logs**：
  - [2026-09-29-pass-templates-public-endpoint.md](../runs/decisions/2026-09-29-pass-templates-public-endpoint.md) — Phase 1 設計決策
  - [2026-10-01-pass-holder-language.md](../runs/decisions/2026-10-01-pass-holder-language.md) — Phase 4 language override 設計
- **Feedbacks**：
  - [20260930-pass-templates-mcp-descriptor-blocker.md](../runs/improvements/feedback/20260930-pass-templates-mcp-descriptor-blocker.md) — Phase 2 MCP 根因
  - [20261001-pass-holder-language-and-validation.md](../runs/improvements/feedback/20261001-pass-holder-language-and-validation.md) — Phase 4 Q1+Q2+Q3 修法
- **Rules 觸發**：
  - Rule 019 § 4.1（4 層 schema sync）
  - Rule 035 § 1-4（migration apply pipeline）
  - Rule 023（shared package + i18n namespace）
  - Rule 036（CORS 三層 defense — backend deploy 必跑）

---

> 撰寫者：SAOME-REBUILD ｜ 時間：2026-10-01 22:39 UTC+8