# 2026-10-06 — Delete 500 + R2 cleanup 漏 exportKey + 下載桌牌 no-op master DEV LOG

> 給未來 trace「Template Library 三條 user-visible bug」的人 single entry point。Scope = 後端 2 個 service bug + 前端 1 個 wiring bug + 對應 test + i18n 改動。**本檔不重述每個 commit 行級 diff** — 對應 feedback 才有完整 trace；本檔負責**三條 bug 的根因分組 + cross-cutting 設計 + 給未來 session 的 invariant 提醒**。

## 一句話總結

Template Library 上線後第一批 user flow bug：

1. **刪除 published 模板直接 500**（`cardService.deleteTemplateService` 殘留 published-guard 拋 plain `Error`，被 errorHandler 包成 500 — Library 只 render published rows，所以每筆刪除都壞）
2. **刪模板後 R2 漏砍桌牌 export PNG**（`collectR2KeysForTemplate` 漏收 `settings.tableCard.exportKey`，只收 per-element imageKeys；merged PNG 永遠 orphan 在 R2）
3. **「下載桌牌」按下去只 `console.log`**（`CardBuilderPage.handleSend` 是 placeholder no-op，沒接到 `cardService.downloadTableCardBlob`）

三條都是「Service 寫了但 Library 沒接好」的 sibling bug，**scope 集中在 Template Library / cards feature**，無 DB schema / migration 變更。修法 = 拿掉 guard + 補 collect + 補 wiring + 對應 regression test + i18n key。

## 三條 bug 的根因分組

### Bug A — 刪 published 模板 500

```
User 在 Library 按「刪除模板」→ DELETE /api/cards/:id
   → cardService.deleteTemplateService 內：
     if (existing.status === 'published') {
       throw new Error('Published templates cannot be deleted via this route');
     }
   → errorHandler 接住 plain Error → 包成 ServerError(500)
   → 500
```

**根因**：

- 早期 `deleteTemplate` 設計時還沒決定「published 是不是要保留」— 寫了 guard 防呆。但 Library 上線後只 render `status='published'` rows（見 `findTemplatesByTenantId` 的 `WHERE status='published'`，commit `52c679e`），所以**Library 的每筆刪除都會 hit 這個 guard**。
- 拋 plain `Error`（非 `SaomeError`）→ errorHandler 沒 code → 包成 generic 500。沒有結構化 error code，前端沒辦法 show 「published 不可刪」之類的 user-facing 文案。

**修法（Option B — 直接拿掉 guard）**：

- 刪掉 `if (existing.status === 'published')` 那 3 行
- Cross-tenant 404 守門員（`existing.tenant_id !== tenantId`）**保留** — 不是 published 議題，是 ownership 議題
- 對應 `deleteTemplate.test.ts` 第一條 regression：published 模板直接刪，200 OK

**為什麼不是 Option A（改成 SaomeError(409)）**：

- Library 永遠只看到 published rows，return 409 等於「Library 上所有刪除都壞，只是壞的方式不同」
- 沒有「unpublish 流程」（即將做的 Step 8.5 / abandon flow 才會 unpublish）— 暫時沒有 user 會需要 published 不可刪
- Decision Log 條目 `runs/decisions/2026-10-06-published-delete-guard.md`（TBD — 本 PR 沒建，follow-up 補）

### Bug B — R2 漏砍桌牌 export PNG

```
User 刪模板 → deleteTemplateService 跑 enqueueTemplateR2Keys
   → collectR2KeysForTemplate 只收：
     - settings.issuerLogo / backgroundImage / iconImage (3 條 top-level)
     - settings.tableCard.elements[].imageKey (per-element PNGs)
   → 漏收：settings.tableCard.exportKey  ← 桌牌 merged PNG
   → R2 永遠 orphan: {tenantId}/{templateId}/table-card-export.png
```

**根因**：

- 2026-10-03 `r2-tombstone-cron-sweep` commit（plan `f0bcfa50`）上 `collectR2KeysForTemplate` 時，**桌牌 exportKey 還沒實作完成** — `routes/exportTableCard.ts` 是後來才接的，所以 collect 階段沒把這個 key 加進去
- 程式碼原本留了「(If a future plan adds `tableCardExport` to settings, enqueue here.)」TODO 註解，但**沒人去補**
- 沒寫 test：「刪模板時 R2 tombstone 必須包含 exportKey」— 整條 cron sweep chain 沒有 owner

**修法**：

- `collectR2KeysForTemplate` 加 `tableCard.exportKey` branch
- **prefix guard 必須** — 跟 per-element branch 同樣的 `${tenantId}/${templateId}/` 前綴檢查，防 JSONB column corruption 把別人的 key enqueue 進來
- 4 條 `r2OrphanCleanup.test.ts` regression cases：happy path、wrong-tenant reject、no-prefix reject、exportKey + per-element together

**R2 outage isolation 配套**：

- `deleteTemplateService` 把 `await enqueueTemplateR2Keys(...)` 包進 try/catch
- enqueue 失敗只 `console.error`，**絕對不能 fail user-facing delete**
- 理由：cron sweep 是 canonical cleanup，user-facing delete 只要 row 被刪就算成功
- 對應 `deleteTemplate.test.ts` 第 3 條：「enqueue throws → delete 仍 200」

### Bug C — 下載桌牌 no-op

```
User 在 Library 按「下載桌牌」→ handleSend(id)
   → 原本：console.log('Public templates')  ← 整支函式是 placeholder
   → 沒接到 cardService.downloadTableCardBlob
   → 沒 <a download> click
   → 什麼都沒發生（沒有 toast 沒有 spinner 沒有 error）
```

**根因**：

- `CardBuilderPage.handleSend` 是 Step 8 wiring 階段的 stub（commit `86a798d` 那批），當時只接 `handleEdit` 跟 `handleDelete`，send 留 placeholder
- 沒寫 conformance test「按 send 應該 trigger download」— 所以 no-op 不會被抓
- i18n key 還是舊的 `發送卡片`（對應舊「send to user via email/wallet」語意）— 跟新行為「下載桌牌 PNG」對不上

**修法**：

- `handleSend` 改寫成 `cardService.downloadTableCardBlob(id)` → `URL.createObjectURL(blob)` → `<a download>` click → `URL.revokeObjectURL` → `toast.success`
- 對齊 `Step7TableCard.hooks.ts::handleDownload` pattern（editor 端「ready」按鈕已 wire 過一次）
- 404 special case：「user 從未按過 生成桌牌」→ `toast.error(t('toast.tableCardNotExported'))`，不當 generic network error 處理
- `httpClient.getBlob` 內部帶 Bearer token — `window.open` 在 production 會 silent 401（沒附 Authorization header）

**為什麼不是 `window.open(url)`**：

- `routes/exportTableCard.ts` 是 Bearer-protected endpoint，瀏覽器導航不帶 Authorization header
- Production 會 silently 401，user 看到「無反應」+ dev tools 一片空白
- 走 `httpClient.getBlob` 拿 Blob → `URL.createObjectURL` → `<a download>` 才是正確 path

**UI state plumbing 配套**：

| 既有 | 新增 |
|---|---|
| `deletingIds: ReadonlySet<string>` | `downloadingIds: ReadonlySet<string>` |
| `isDeleting: boolean` (TemplateCard) | `isDownloading: boolean` (TemplateCard) |
| 三按鈕 `disabled={isDeleting}` | 三按鈕 `disabled={isDeleting \|\| isDownloading}` |
| Send icon (Send) | Send icon ↔ Loader2 spinner（mirror of delete） |

對應 `CardBuilderPage.test.tsx` + `TemplateCard.test.tsx` 各加 download flow 的 happy-path / 404 / 500 case。

### i18n 改動（cross-cutting — 三條 bug 都有連動）

| namespace.key | 舊 | 新 | 觸發 |
|---|---|---|---|
| `cardBuilder.templateCard.send` | `發送卡片` | `下載桌牌` | Bug C 修法：行為改為下載 |
| `cardBuilder.templateCard.delete` | `刪除卡片` | `刪除模板` | 操作對象是「模板」非「卡片」（Library 文案統一） |
| `cardBuilder.templateCard.downloading` | — | `下載中...` | Bug C 修法：mirror of `deleting` |
| `cardBuilder.toast.tableCardDownloaded` | — | `桌牌下載完成` | Bug C 修法：success toast |
| `cardBuilder.toast.tableCardNotExported` | — | `此模板尚未生成桌牌，請先至編輯器生成` | Bug C 修法：404 special case |
| `cardBuilder.toast.downloadError` | — | `下載失敗：{{detail}}` | Bug C 修法：generic 500 path |

EN locale 同步對齊（`cardBuilder.en.ts`），結構不變。

## 架構全景

```
User flow 1 (刪除):
[Library] ─按「刪除模板」→ DELETE /api/cards/:id
                              ├─ cardService.deleteTemplateService
                              │   ├─ findTemplateById (ownership 404 guard 保留)
                              │   ├─ unwrapCardSettings (Bug #8/#8.5 防禦)
                              │   ├─ enqueueTemplateR2Keys ← Bug B 修法：含 exportKey
                              │   │   ├─ collectR2KeysForTemplate (3 top-level + exportKey + per-element)
                              │   │   └─ for each key → enqueueR2Delete
                              │   │       └─ DB INSERT into r2_pending_deletes (best-effort try/catch)
                              │   ├─ deleteTemplate (DB row removal)
                              │   └─ return { success: true }
                              └─ 200 OK (Bug A 修法：拿掉 published-guard)

User flow 2 (下載桌牌):
[Library] ─按「下載桌牌」→ cardService.downloadTableCardBlob(id)
                              ├─ httpClient.getBlob(/api/cards/:id/table-card-export)
                              │   └─ Bearer token 內帶
                              ├─ return Blob
                              └─ CardBuilderPage.handleSend:
                                  ├─ URL.createObjectURL(blob)
                                  ├─ <a download="table-card.png"> click
                                  ├─ 1000ms 後 URL.revokeObjectURL
                                  └─ toast.success / toast.error

Background cron sweep (every 5 min, worker.scheduled):
SELECT * FROM r2_pending_deletes
   WHERE status='pending' AND next_retry_at <= now()
   ORDER BY created_at ASC LIMIT 50
   ↓
DELETE from R2  →  UPDATE status='done'
   ↓ (failure)   →  retry_count++, next_retry_at = now() + backoff
```

## 設計 invariant（給未來 session）

### 1. published 模板的「可刪 / 不可刪」政策

| 階段 | 政策 | 理由 |
|---|---|---|
| 2026-10-04 之前（commit `52c679e`）| published 不可刪（guard 拋 Error）| 沒想清楚 |
| **2026-10-06（本 PR）**| **published 可刪** | Library 只 render published；Option B 拿掉 guard |
| 未來（Step 8.5 / abandon flow）| TBD — 可能改成「soft-delete（status='abandoned'）+ 30 天 grace 才 hard-delete」| 跟 abandon flow 整合 |

未來如果想再限制 published delete，**不要在 service 層拋 plain `Error` 復活 guard**。要拋請用：

```ts
throw new ConflictError('cards.error.publishedDeleteBlocked', '...');
```

讓前端可以接 `SaomeApiError(409, 'cards.error.publishedDeleteBlocked')` 顯示 i18n 文案。

### 2. R2 cleanup 必走「collect → enqueue → cron sweep」三段式

| 段 | 職責 | 失敗處理 |
|---|---|---|
| collect | 列舉這個 template 擁有的所有 R2 key（含 exportKey）| prefix guard 防 cross-tenant |
| enqueue | INSERT into `r2_pending_deletes` (status='pending', retry_count=0) | try/catch per-key + outer try/catch 整批 |
| cron sweep | 每 5 min worker.scheduled 撿 50 筆 → DELETE R2 → mark done | 失敗 retry，backoff |

**三段任一不可省**：
- 沒 collect → 漏砍（Bug B 原始症狀）
- 沒 enqueue → cron sweep 沒工作可做
- 沒 cron sweep → 累積 tombstone 沒人消化 → R2 storage cost 一直漲

未來新增任何「template 持有 R2 object」的場景（例如 Step 8 新加 cover image）：
1. **同 PR** 加進 `collectR2KeysForTemplate`，**且**
2. **同 PR** 加一條 `r2OrphanCleanup.test.ts` regression case，**且**
3. 確認 upload path 也走 `{tenantId}/{templateId}/...` prefix（不然 prefix guard 會誤放行）

### 3. 下載桌牌走 Blob + `<a download>`，不走 `window.open`

| 方案 | 帶 Bearer | Production 行為 |
|---|---|---|
| `window.open(url)` | ❌ 瀏覽器導航不帶 header | silent 401，user 看到「無反應」|
| `<a href={url} download>` | ❌ 同上 | silent 401 |
| **`httpClient.getBlob()` + `URL.createObjectURL(blob)` + `<a download>`** ✅ | ✅ 內部 fetch 帶 header | 200，user 拿到 PNG |

未來任何「從 R2 拿私有物件下載」都走同一個 pattern：`httpClient.getBlob` → Blob → object URL → `<a download>` click → revoke。**禁止** `window.open`。

### 4. Template Library row-level state 必走 `Set<string>`

`deletingIds` + `downloadingIds` 兩個 Set 是 sibling pattern，**結構必須一致**（同樣的 ReadonlySet、同樣的 `prev => new Set(prev)` immutability update、同樣的 cleanup in `finally`）。未來新增 row-level in-flight state（例如 `exportingIds`）必須：

- 用同一個 `ReadonlySet<string>` shape
- 對應 component 必加 `isExporting: boolean` prop
- 三按鈕 `disabled={isAnyInFlight}`（isDeleting || isDownloading || isExporting）
- cleanup 在 `finally`，不能在 `catch` 漏 `next.delete(id)`

### 5. i18n renames 必對齊 en / zh-TW 兩 locale

`send: '發送卡片' → '下載桌牌'` 跟 `delete: '刪除卡片' → '刪除模板'` 兩條 rename 是 **cross-locale invariant** — 一邊改一邊不動就是 drift，verify:i18n 會抓。`npm run verify:i18n` 必跑。

## 驗證（per Rule 006）

```
backend tsc: exit 0
backend vitest: 30 files / 428 tests passed
frontend tsc: exit 0
frontend verify:i18n: 19 namespaces / 38 locale files
frontend vitest: 139 files / 1823 tests passed
```

新增/擴充的 test 計數：

| 檔案 | 新增 test 數 | 覆蓋 |
|---|---|---|
| `apps/backend/src/modules/cards/tests/deleteTemplate.test.ts`（新檔）| 6 | Bug A 500→200 + cross-tenant 404 + R2 outage isolation |
| `apps/backend/src/modules/cards/tests/r2OrphanCleanup.test.ts` | +4 | Bug B exportKey collection 4 個 case |
| `apps/frontend/src/components/business/dashboard/TemplateCard/TemplateCard.test.tsx` | +N | isDownloading prop / spinner / 3 button disable matrix |
| `apps/frontend/src/components/business/dashboard/TemplateCard/TemplateCardPreview.test.tsx` | +N | preview i18n 對齊 |
| `apps/frontend/src/components/business/dashboard/TemplateLibraryGrid/TemplateLibraryGrid.test.tsx` | +N | downloadingIds pass-through |
| `apps/frontend/src/pages/app/dashboard/card-builder/CardBuilderPage.test.tsx` | +N | handleSend happy / 404 / 500 / concurrent in-flight |

## 衍生

- **Decision Log 缺項** — 這次 Option B（拿掉 published-guard）沒寫 `runs/decisions/2026-10-06-published-delete-guard.md`，當下只 inline 在 commit body。**Follow-up**：補一份三段式決策紀錄（背景：guard 為何存在 / 選項：拿掉 vs 409 vs soft-delete / 影響：Library flow 直接打通）
- **R2 sweep observability** — `enqueueTemplateR2Keys` 內有 `console.log` 印 enqueued/skipped，但沒上 structured log（沒 tenant_id 維度的 metric）。Production 觀察 R2 orphan 趨勢需要看 wrangler tail + grep；中長期應該上 Workers Analytics Engine
- **Step 8.5 / abandon flow** — 拿掉 published-guard 後，「刪 published」就是「hard-delete」。未來 Step 8.5 想做「soft-delete → grace period → hard-delete」流程時，要重看這個 commit（不能再用同一個 service code path）
- **front-end `cardService.downloadTableCardBlob`** — 這個 method 已經存在（commit history 沒翻到本 PR 加的）— 可能 Step 7 那批就接好了。**本 PR 只接 wiring**，沒改 service signature 或 backend route

## 自問

- 下次怎麼不犯？
  - **Service 層的 guard 拋 plain `Error` 就是 code smell** — 永遠要拋 `SaomeError(code, ...)` 才有結構化 error code 可 trace
  - **「(If a future plan adds X, enqueue here.)」這類 TODO 註解 = P0 alarm** — 留 TODO 等於「我沒 owner」；刪除 TODO 必須同 PR 補上實作
  - **Step-by-step wiring（Step 7 → Step 8 → Library）的每個新 feature 都要走 conformance test 驗「真的接到 service」，不能信「stub 應該會被後面的人接好」**

- 哪條 rule 該補？
  - **Rule 032（jsonb merge silent killer）的姊妹篇**：R2 cleanup collector 漏 key 也算 silent killer（沒 throw、沒 warning、production R2 storage 一直漲）
  - 考慮新增 `Rule 0XX-r2-cleanup-completeness.mdc`：列舉 R2 key 來源（top-level / tableCard / 未來 cover image）的 single source of truth = `collectR2KeysForTemplate`，新增任何 R2 key 場景必走同 PR 補 collect + 補 test

- 哪個 test 該加？
  - `cardService.deleteTemplateService` 的 **integration test**（目前只有 unit 6 條）— 真的起 worker + 真的 call DELETE route + 真的看 R2 tombstone 有沒有被塞進 DB
  - R2 cron sweep 的 **end-to-end test**（mock R2 binding）— 驗證 enqueue → sweep → R2 delete 三段 link 起來沒掉

## 觸發本 dev log 的 commit 群

- 本 PR 範圍：15 modified + 1 new test + 1 new dev log = 17 個檔案
- 不包含：`test_output.txt`（local debug 輸出，不 commit）、`DEV/10-2026/1006-step8-save-and-library-real-data-wiring-master-dev-log.md`（Step 8 master log，已另開 PR 群追蹤）

---

> 撰寫者：Josh ｜ 時間：2026-10-06
> Plan: `fix_delete_500_+_r2_cleanup_+_download_table_card_1c2ed700`（TBD — plan 檔未 commit，僅作為 working reference；Decision Log 同 TBD）
