# 2026-10-25 — 共用模組：Pass runtime value model（事件帳本 + 到期規則 + header slot 單一來源）

> 本檔是 `42d375b feat(pass-templates): runtime value model for pass registration`（62 files, +10473/−907）的 DEV LOG。
> 決策層敘述見 `runs/decisions/2026-10-24-pass-runtime-value-model.md`（決定一～七 + 追加 決定八～十一）。
> 本檔責任是「實作層的結構、驗證輸出、已知限制、以及後續 work item」。

## Metadata

- **日期**：2026-10-25
- **作者**：SAOME 開發者（Cursor agent session）
- **commit hash**：`42d375b`（**local-only，尚未 push**；origin 為 `github.com/SaomeRebuild/SAOME-REBUILD.git`，`main` 落後 origin 2 commits）
- **規則 / skill 觸發**：Rule 000（模組化設計）、Rule 016（config / tsconfig 9 surface）、Rule 019（schema contract drift）、Rule 035（migration apply pipeline）、Rule 037（MCP tool call pattern）、Rule 038（context budget）、`saome-dev-logging` skill

---

## 一句話總結

**把「持卡人 runtime value（餘額 / 點數 / 到期日）」從「模板層的字串 placeholder」升級成「一條 append-only 事件帳本 + 一組可重放的純函式 + 一份 backend / frontend 共用的 slot 契約」，並用兩條 migration 落地到 `public.pass_events`。**

| 面向 | 決策 | 落地位置 |
|---|---|---|
| 資料模型 | 事件帳本為唯一 source of truth，快照只是衍生資料 | `packages/shared/schemas/passValues.ts` + `supabase/migrations/20261024000001_028_init_pass_events.sql` |
| 計算 | 註冊初始值與未來事件共用同一套 reducer | `packages/shared/logic/passValueCalculator.ts` |
| 對外 wire | 首次簽發與後續 PATCH 共用同一份 formatter output | `packages/shared/logic/passFieldFormatter.ts` → `v3-pass.ts::updatePassValues()` |
| 到期 | 三種期限模式統一，UTC 錨定 | `packages/shared/logic/passExpiry.ts` |
| UI 契約 | 8 卡種 header 歸屬單一來源 | `packages/shared/constants/headerSlots.ts` |

---

## 症狀（為什麼需要這次重構）

> 一句話講發生什麼。

**模板層早就鋪好了 `{balance}`、`{giftPoints}`、`{memberExpiry}` 等交叉引用，但 Wallet 上真正代表 runtime value 的欄位全部是空的。**

- 環境：dev / 本地 repo（`apps/backend` Cloudflare Worker + `apps/frontend` React 19 + Supabase Postgres）
- 觸發條件：把任何一張非會員卡（gift / stamp / reward / cashback / multipass）推給 Passcreator，觀察 Wallet 內的 header 與 strip
- 觀察到的錯誤：
  - `issuePass()` 只送四個欄位 — `memberName` / `phone` / `birthday` / `email`。餘額、點數、到期日**沒有任何一個欄位被送出**。
  - `pass_holders` 表只有「交付欄位」與「V3 發行結果欄位」，**沒有任何地方記錄「這個持卡人目前有多少點數」**。資料模型不存在，不是漏寫。
  - `packages/shared/logic/pass.ts::calculateExpirationDate()` 是**死碼**（零 caller，且只回 `Date` 物件 — 無法 JSON 序列化進 JSONB）。
- 預期 vs 實際：
  - 預期：模板綁了 `{balance}` 就送餘額，綁了 `{memberExpiry}` 就送到期日
  - 實際：Wallet 顯示空白；就算不空白也無從得知每個持卡人的值是怎麼算出來的

---

## 探針 / 重現

### 探針 A：確認資料模型缺口（讀碼，非執行）

```bash
# 1. 確認 issuePass 只送 4 個欄位
rg -n "memberName|phone|birthday|email" apps/backend/src/shared/lib/passcreator/v3-pass.ts

# 2. 確認 calculateExpirationDate 是死碼（0 caller）
rg -n "calculateExpirationDate" packages/ apps/ --glob '!**/node_modules/**'

# 3. 確認 pass_holders 沒有 runtime value 欄位
rg -n "pass_values_snapshot|spend_accumulated|gift_points" apps/backend/src/modules/pass-templates/db/passHolders.ts
```

### 探針 B：確認 Wire Contract（Passcreator V3 官方 docs）

```bash
curl -sS https://developer.passcreator.com/en/api/v3/pass | grep -n -A5 "PATCH"
```

**關鍵發現**：V3 的更新 endpoint 是 **`PATCH`**，不是 `POST`。
- `PATCH` 只更新提供的欄位
- `POST` 會**刪除**未提供的資料

這一條決定了 `transport.ts` 必須把 `PATCH` 加進 method union，也決定了「任何更新既有 Pass 的方案誤用 POST 就會把使用者的 Pass 清空」這條風險。

### 探針 C：migration 套用後驗證（透過 `saome_supabase` MCP）

```
apply_migration 20261024000001_028_init_pass_events → success
apply_migration 20261024170000_029_pass_events_one_registered_per_holder_idx → success
```

兩條 migration 都**在 commit 之前**套用（Rule 035 § 1 的「apply 先、commit 在後」），並在 `supabase/migrations/.applied-migrations.json` append registry entry。

### 探針 D：驗證輸出

| 驗證項 | 指令 | 結果 |
|---|---|---|
| Backend typecheck | `npx tsc --noEmit -p apps/backend/tsconfig.json` | exit 0 |
| Frontend typecheck | `npx tsc --noEmit -p apps/frontend/tsconfig.app.json` | exit 0 |
| Backend tests | `npm test --workspace=apps/backend` | **799 passed / 23 skipped**（50 files） |
| Frontend tests | `npm test --workspace=apps/frontend` | **2071 passed / 1 failed** |
| Migration gate | `npm run check:migrations --workspace=apps/backend` | OK 27 |
| Lint | `npm run lint` | 0 error（既有 warning 不變） |

**唯一失敗項**：`PassHolderRegistration.giftCard.test.tsx` 5s timeout。
- 隔離跑 **9/9 全綠**（`npx vitest run PassHolderRegistration.giftCard`）
- 與本次改動無關（gift card 註冊流程，非 runtime value 路徑）
- 判定為全量並行執行的 test timeout  flakes，非 regression

---

## 根因

> 一句話結論。

**runtime value 從來沒有被當成一個「領域概念」建模過 — 它被當成模板層的字串 placeholder，於是資料模型、計算、wire format、UI 契約四個層各自缺位。**

拆成四層看：

1. **資料層缺位** — `pass_holders` 沒有 runtime value 的欄位。不是沒有欄位而已，是連「這個值是累加器還是差值、是整數還是小數、能不能是負數」都沒有被定義過。
2. **計算層缺位** — 沒有 reducer。累計值靠「讀 → 算 → 寫」表達，任何一次失敗就留下不一致，且冪等性只能靠應用層小心維護。
3. **Wire 層缺位** — 建立（`POST /api/v3/pass`）與更新（`PATCH /api/v3/pass/{identifier}`）若各自組 payload，第一次送 `100`、第二次送 `"100"` 這種型別漂移就會發生，而 Wallet 端對 number / string 的處理並不一致。
4. **UI 契約層缺位** — 「哪個卡種的 header 顯示什麼」被寫了四份（template push / frontend preview / i18n label / test selector）。加第 9 個卡種要改四處，漏一處不會 build fail，只會讓 preview 跟 push 出貨不一致。

**為什麼之前測試沒抓到**：這不是 regression，是從未存在的功能。測試自然無從失敗 — 但 `HEADER_SLOTS` 特別設計成 `Record<CardType, HeaderSlotKind>`（非 `Partial<>`），就是為了讓「新增卡種但沒加 header row」變成 **TypeScript build error**，把第 4 層的漏接從 runtime 漂移提前到編譯期。

---

## 修法

### A. `packages/shared/` — 領域模組（本體）

```
packages/shared/
├── schemas/passValues.ts (302 行)
│   └── PASS_VALUE_METRICS (6 個) + 整數 / 非負白名單 + 事件 discriminated union
├── logic/passValueCalculator.ts (344 行)
│   └── buildInitialMetrics() / buildInitialValues() / reducePassValues()
├── logic/passFieldFormatter.ts (348 行)
│   └── formatPassValues() → { storedValue?, expirationDate?, properties }
├── logic/passExpiry.ts (500 行)
│   └── never | duration_days | duration_months | specific_date（UTC 錨定）
├── logic/passValueErrors.ts (83 行)
│   └── PassValueDomainError（i18n-key-shaped code）
├── constants/headerSlots.ts (233 行)
│   └── HEADER_SLOTS + HEADER_SLOT_KIND_SPECS（8 卡種 → 5 kind）
└── barrels (logic/schemas/constants/i18n) + package.json exports
```

**6 個 metric 各自是獨立語意量**（不合併成單一 `balance`）：

| metric | 語意 | 整數 | 非負 |
|---|---|---|---|
| `giftPoints` | 贈品卡預付點數餘額 | ✅ | ✅ |
| `pointsBalance` | 獎勵卡賺取點數餘額 | ✅ | ✅ |
| `carryoverBalance` | `N − M` carryover 差值 | ✅ | ❌（可負）|
| `spendAccumulated` | 現金回饋 / 折扣累計消費 | ❌（可小數）| ✅ |
| `visitCount` | 造訪次數 | ✅ | ✅ |
| `stampCount` | 集章數 | ✅ | ✅ |

白名單是 **per-metric** 而非 blanket rule — 同一個 snapshot 內不同 metric 的整數性要求不同，所以不能用整個物件上的單一 `.int()` 表達。

### B. 決定二 — 註冊初始值與事件重放共用同一套計算

`buildInitialValues()` **不是**直接回傳最終 state，而是產生一個 `registered` event，之後走**同一個** reducer。

這看起來只差一行，但它是整個模型能不能長大的關鍵：

- 若註冊走「直接算」、Scanner 事件走「重放」，兩條路徑的語意會在第一個真實 Scanner 事件進來時立刻分歧 — 而分歧的症狀會是「余額對不起來」，排查成本極高
- 讓註冊也走事件，得到一個不變式：**任何 snapshot 都能由事件重放得出**
- 這個不變式同時是 backfill 安全的前提 — 回填既有持卡人時，每筆補一個 `registered` event 後重放，就得到跟當初首次註冊**完全一致**的結果

### C. Backend — 帳本 / 快照 / 同步三層

```
apps/backend/src/modules/pass-templates/
├── db/passEvents.ts (208 行)         appendPassEvent / listPassEvents / findPassEventByIdempotencyKey / countPassEvents
├── db/passHolders.ts (編輯)           PassHolderRow + SELECT / RETURNING 加 pass_values_snapshot
├── db/templates.ts (編輯)            修正過窄的 settings 型別（SQL 實際回傳完整 JSONB）
├── services/passValueService.ts (393 行)   applyPassEvent / replayPassRuntimeState / syncValuesToPasscreator
├── services/passValueBackfill.ts (302 行)  planPassRuntimeValueBackfill / backfillPassRuntimeValues
├── services/passRegistrationService.ts (222 行)  ensureRegistrationRuntimeState
└── services/registerService.ts (編輯)  建立 registered event + 初始 snapshot
```

**決定七 — 同步失敗不回滾帳本**：DB transaction 內只做「append event → reduce → 寫 snapshot」；commit 後才呼叫 Passcreator PATCH。

理由：DB transaction 不能涵蓋外部 HTTP 呼叫。放進 transaction 會讓 transaction 變成「等待網路」，且失敗時必須 rollback 已寫入的帳本 — **因為下游故障而丟失真實事件**，這是事件帳本最不能接受的失敗模式。

分界線：帳本與快照是 atomic 單位（DB 保證）；對外同步是 eventual consistency（重推保證）。重試時以 snapshot 重推，**不重複增加數值** — 因為重推的是「目前狀態」不是「增量」。

### D. Passcreator client — 新增 PATCH 能力

```
apps/backend/src/shared/lib/passcreator/
├── transport.ts (編輯)      method union 加入 PATCH
├── v3-pass-types.ts (編輯)  新增 payload 型別
├── v3-pass.ts (+230 行)     新增 updatePassValues()
└── v3-pass-update.test.ts (新檔 315 行)
```

### E. Frontend — header slot 收斂到共用 spec

```
apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/
├── PassCardPreviewHeader.tsx (−442 行)
├── passCardPreviewSlot.ts (改寫 167 行)
└── passCardPreviewSlot.test.ts (新檔 252 行)
```

`PassCardPreviewHeader.tsx` 一次砍掉 **442 行** — 原本 4 份重複的「哪個卡種顯示什麼」邏輯全部換成對 shared spec 的 lookup。`packages/shared/i18n/fieldLabels.{ts,en.ts,zh-TW.ts}` 也改讀同一份 spec。

### F. Migrations（2 條，皆已 apply + registry）

| 檔名 | 內容 |
|---|---|
| `20261024000001_028_init_pass_events.sql` | `public.pass_events` 表 + `pass_holders.pass_values_snapshot` JSONB + indexes + RLS on |
| `20261024170000_029_pass_events_one_registered_per_holder_idx.sql` | unique index — 每個 holder 只允許一條 `registered` 事件 |

第二條 unique index 是決定二的 **DB 層強制**：應用層的「只准一條 registered」是建議，unique index 才是硬約束。

### G. Backfill 工具鏈

| 檔案 | 行數 | 用途 |
|---|---|---|
| `apps/backend/scripts/backfill-pass-runtime-values.cjs` | 346 | 一次性回填腳本（dry-run 優先）|
| `apps/backend/scripts/pass-runtime-values-backfill-worker.ts` | 169 | Wrangler worker 形式的回填 worker |
| `apps/backend/wrangler.backfill.jsonc` | 31 | 該 worker 的獨立 wrangler 設定 |

### H. Config 同步（Rule 016 9 surface）

新增 shared 專屬 export path，因此以下 surface **同步更新**：

- `packages/shared/package.json` — exports map（+6 行）
- `apps/frontend/vite.config.ts` — `resolve.alias`（+11 行）
- `apps/frontend/vitest.config.ts` — `resolve.alias`（+11 行）
- `apps/backend/vitest.config.ts` — `resolve.alias`（+11 行）

**vitest alias 順序鐵律**：specific-before-generic。`@saome/shared/schemas` 必須宣告在 `@saome/shared` 之前，否則 generic 會 swallow specific（Rule 016 § 「vitest alias 順序」）。

---

## 衍生

### 影響範圍

- **不變**：`pass_holders` 既有欄位語意（`purchased_points` / `gift_card_snapshot` 等）、`templates.settings` JSONB 結構、Public DTO 暴露範圍、Preview 渲染行為
- **已修**：`templates.ts` 的 `settings` 型別過窄（SQL 實際回傳完整 JSONB，TypeScript 型別沒如實反映 — 屬於既有的 schema drift，本 commit 一併修）

### 已知限制

1. **Scanner 事件語意未定** — 本輪 reducer 只處理 `registered` 與純數值增減。Scanner 特有的去重 / 退款 / carryover 留待 blocked 計畫 `runs/plans/2026-10-24-pass-scanner-event-semantics.md`。
2. **既有 46 筆持卡人沒有 runtime value** — backfill 必須先 dry-run，且**不應自動 bulk PATCH production Pass**。回填只補帳本與快照；對外同步要人工挑一張受控測試 Pass 先驗證。
3. **Passcreator PATCH 失敗無自動重試佇列** — 本輪只保證「帳本不回滾 + 可重推」。queued retry / manual resync UI 屬 Scanner 計畫範圍。

### 後續 work item（決定八～十一的實作，尚未開始）

Decision Log 追加的 決定八～十一 已定義語意，但**實作由另一個 work item 進行**。必須存在的 conformance tests：

1. reducer 拒絕會把非負 metric 推低於零的消費事件，拋 `PassValueDomainError`，帳本狀態完全不變
2. `carryoverBalance` 可以是負值；其餘所有 metric 不可為負
3. `spendAccumulated` 接受小數 `delta`；其餘所有 metric 拒絕小數 `delta`
4. `at` 拒絕 date-only 與無 timezone 的值、接受任何帶 offset 的值；reducer 對混合 offset 帳本排出的順序與 UTC 正規化後的順序完全一致

---

## 自問

### 下次怎麼不犯

- **「事件帳本 vs 直接計數表」的判斷不是風格選擇** — append-only 帳本讓冪等成為 DB 層的自然性質，且回答「為什麼是這個數」。未來任何「目前值」型需求（造訪數、兌換數）都先問：這是狀態還是事件？
- **per-metric 白名單不能用 blanket rule 表達** — 同一個 snapshot 內不同 metric 的整數性 / 符號性要求不同。看到「給整個物件加 `.int()`」的衝動時先停下。
- **建立與更新必須共用同一份 formatter output** — 否則第一次送 `100`、第二次送 `"100"` 的型別漂移會在 Wallet 端表現成「顯示不一致」，且極難定位。
- **新增第 9 個卡種只該改 1 個地方** — `HEADER_SLOTS` 加一行 + 兩個 locale 加 label。任何需要改第二處的設計，說明那個「單一來源」沒做到位。

### 哪條 rule 該補

- **Rule 019 § 4.1 補強**：本 commit 修掉 `templates.ts` 的 `settings` 型別過窄（SQL 回傳完整 JSONB，型別寫成窄子集）。這是「DB 實際回傳形狀 vs TypeScript 宣告」這一層的 drift，現有 4 層清單沒有明確涵蓋「既有型別過窄」這個方向 — 只講了「新增 field」。建議補：**任何 `db/<table>.ts` 的 row interface 必與實際 SELECT 欄位集一致；型別過窄等同缺欄位**。
- **Rule 000 Part D 補強**：本 commit 新增 4 個 barrel（`logic/index.ts` / `schemas/index.ts` / `constants/index.ts` / `i18n/index.ts`）並在 `package.json` exports 對外開 subpath。跨層引用禁用的前提下，「哪些 symbol 對外公開」目前靠人工判斷。建議補：**shared package 新增 public subpath 時，exports map 必與 barrel 一致，且需在 PR 描述列出新增的公開 surface**。

### 哪個 test 該加

- **決定八～十一的 4 條 conformance test**（見「衍生」段）— 這是硬性 gate。
- **跨層一致性 test**：`packages/shared/constants/headerSlots.ts` 已有 `headerSlots.test.ts`（289 行）驗 8 卡種 × 5 kind 的 locale label 齊備。缺的是「backend template push 實際送出的 field key」與 `HEADER_SLOTS[cardType].passcreatorKey` 一致的測試 — 目前靠人工 review 對齊。
- **決定二的不變式 test**：`reducePassValues([buildInitialValues(input)])` 必等於 `buildInitialMetrics(input)`。這是「任何 snapshot 都能由事件重放得出」的直接表述，值得一條 pin 死。

### Commit 紀律備註

`42d375b` 目前是 **local-only**（`main` 落後 origin 2 commits，本 commit 尚未 push）。依 Rule 011，本 commit 的 body 已含 body + `Refs:` / `Sync:` / `Self-improvement:` footers。push 前需確認：

- `Sync:` footer 補上 remote commit hash（推完之後）
- migration 兩條已在 registry，CI `check:migrations` gate 會驗

---

## 參照

- `runs/decisions/2026-10-24-pass-runtime-value-model.md` — 決定一～七 + 追加 決定八～十一
- `runs/plans/2026-10-24-pass-runtime-values-roadmap.md` — Roadmap 與六份舊計畫的取代關係
- `runs/plans/2026-10-24-pass-scanner-event-semantics.md` — blocked 的 Scanner 後續計畫
- `runs/improvements/feedback/20261025-context-overflow-crash-forensics.md` — 本 commit 之前的 4 個 crashed work stream（後改以 Rule 038 派工 discipline 收斂）
- `runs/improvements/feedback/20261025-successful-session-pattern-and-sustainment.md` — 存活 session 的運作模式（Read 呼叫次數為最強預測因子）
- `runs/improvements/feedback/20261025-encoding-pollution-and-repair.md` — 同一 session 的另一條線：編碼污染偵測與修復
- `packages/shared/schemas/passValues.ts` — 事件 / 快照 Zod 契約
- `packages/shared/logic/passValueCalculator.ts` — reducer
- `packages/shared/logic/passFieldFormatter.ts` — canonical state → Passcreator payload
- `packages/shared/logic/passExpiry.ts` — 統一期限規則
- `packages/shared/constants/headerSlots.ts` — 8 卡種 header 歸屬單一來源
- https://developer.passcreator.com/en/api/v3/pass — PATCH 只更新提供的欄位；POST 會刪除未提供的資料

---

> 撰寫者：SAOME 開發者 ｜ 時間：2026-10-25
