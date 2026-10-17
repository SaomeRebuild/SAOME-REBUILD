# Decision：V3 runtime fields 進 JSONB 的時機

**日期**：2026-10-19
**作者**：SAOME-REBUILD
**Scope**：架構方向選定（不實作，僅文件化對齊點）

---

## 背景

2026-10-19 plan shipped migration 025 加 5 個 column（`pass_identifier` / `download_url` / `barcode_value` / `issued_at` / `issuance_error`），全部 nullable，partial UNIQUE index on `pass_identifier`，partial index on `issuance_error`。

2026-10-19 follow-up：補 `iphone_uri` / `android_uri` 2 column（migration 026），共 7 個 column on `pass_holders`。

User 觀察：「V3 runtime 進 JSONB 是不是比較方便？未來 member data（點數/餘額）也需要另一個 JSONB」。

SAOME 已經大量用 JSONB：
- `templates.settings`（CardBuilder editor 的自由 form fields）
- `pass_holders.membership_tier_snapshot`（migration 023 — 選定的會員方案快照）
- 之前的 analytics JSONB（rollout 後已收斂進 aggregates）

JSONB pattern 在 codebase 已 mature。

---

## 選項

### 候選 A：全部 7 column 留 native，不解

- **pros**：最簡單、5/7 column 已 ship、回滾最易
- **cons**：未來 V3 新增欄位都要 ALTER TABLE；member data（點數/餘額）再 Decision；dashboard query 要 hardcode 7 column 名字
- **適用**：保守路徑，scope 最小

### 候選 B：Hybrid（3 indexed col 留 native + 4 data col 進 JSONB）

- **pros**：
  - keep DB-level safety net — UNIQUE on identifier（防 double-issue）、index on error / issued_at（dashboard 查詢高效）
  - future V3 新 field 改 zod schema 即可，不必每次 ALTER TABLE
  - member data 開 `member_runtime JSONB` 乾淨分離兩種 domain（pass-side 跟 tenant-side loyalty）
- **cons**：
  - migration 需 backfill 4 column 進 JSONB + DROP 4 column（不可逆，要小心規劃 window）
  - 寫入路徑 zod-validate JSONB shape（Rule 019 + Rule 032 雙重保護）
  - Reader 要 jsonb_path 或 zod parse
- **適用**：未來 refactor 的 recommended path

### 候選 C：全部 JSONB

- **pros**：最 future-proof；寫入路徑 zod-validate 一次
- **cons**：
  - `pass_identifier` UNIQUE constraint 失去（防 double-issue 的 DB-level safety net 消失）
  - `issuance_error` 改 JSONB 後，failure-rate dashboard query 要改用 GIN/jsonb_path_ops index（慢）
  - `issued_at` 改 JSONB 後，retention/audit SQL 失效，要走 `pass_runtime->>'issued_at'::timestamptz` 路徑
  - DROP column 不可逆；production smoke test 範圍大
- **適用**：過度工程化，且 SAFETY NET 丟失 — 暫不採

---

## 決定

✅ **採 Hybrid（候選 B）— 但本 PR 不 ship**

Hybrid 是 future-leaning 的推薦路徑，但**本 PR scope 切小 closure**：
1. Migration 026 — 2 個 column 補齊（iphone_uri / android_uri）+ 4 placeholder string 的 backfill + CHECK constraint
2. 不開 `pass_runtime JSONB`、不 DROP 既有 4 個 column、不做 backfill migration

完整 Hybrid refactor 留**下次 L3 Heavy brainstorm session** 評估，scope 含：
- 開 `pass_runtime JSONB` column
- Backfill 4 個既有 column 進 JSONB
- DROP 既有 column
- 寫入路徑 zod 驗證
- Read path migration（reader 要 jsonb_path / zod parse）
- Production smoke test

**Future invariant**：`pass_identifier` / `issuance_error` / `issued_at` 三個 column 永遠是 native type，即便 Hybrid refactor 也不動。

---

## 影響

### 本 PR scope（含 migration 026）

| 動作 | 影響 |
|---|---|
| Migration 026 — `iphone_uri` / `android_uri` 2 column 新增 | nullable，舊 rows 不影響；新增的 3 URI 持久化路徑完整 |
| Migration 026 — 4 placeholder string backfill to NULL | production 髒資料一次性清乾淨（`'no value given'` / `'no value specified'` / `'no barcode'` / `''`） |
| Migration 026 — CHECK constraint 防 placeholder 再寫入 | DB-level last-line-of-defense；前端 + 後端 parser + DB 三層 defense-in-depth |
| `db/passHolders.ts` — 加 2 欄到 `PassHolderRow` + SELECT/RETURNING | Rule 019 § 4.1 L3 同步 |
| `db/passHolders.ts` — `updatePassHolderIssuance` 加 `iPhoneUri` / `androidUri` 寫入路徑 | ALL 7 column 在 1 個 UPDATE 內 atomic 寫入 |
| `services/registerService.ts` — success path 傳 3 URI 給 `updatePassHolderIssuance` | frontend `pickDownloadUri()` UA detection 從 fallback 到 3 URI 都可用 |

### 未來 Hybrid refactor session scope（下次 L3 Heavy）

- 開 `pass_runtime JSONB` column
- Backfill 4 個既有 data column（`download_url` / `barcode_value` / `iphone_uri` / `android_uri`）進 `pass_runtime->'uris'`
- DROP 既有 4 個 column（保留 3 indexed column：`pass_identifier` / `issuance_error` / `issued_at`）
- 寫入路徑 zod-validate `pass_runtime` shape（Rule 019 + Rule 032）
- Read path migration：reader 用 jsonb_path 或 zod parse
- Production smoke test：完整 end-to-end verify
- 同步加進 `feedback/2026-MM-DD-hybrid-jsonb-refactor.md` + INDEX row

### Future member data（獨立 Decision，未來 feature）

獨立 `member_runtime JSONB` column，跟 `pass_runtime` 完全分離：
- `pass_runtime` = Passcreator 上游 artifact（per-pass runtime）
- `member_runtime` = tenant-side loyalty data（點數 / 餘額 / 等級）

兩個 domain 不混淆，zod schema 各自獨立。

### Out of scope（本 PR 不做）

- ❌ Hybrid JSONB 完整 refactor — 下次 L3 Heavy session
- ❌ `pass_runtime JSONB` 物理建立 — 本 PR schema 不變
- ❌ Production deploy smoke test（2026-10-19 follow-up #6 沿襲）
- ❌ Passcreator 端舊 test pass 清理（operator action，非 code）
- ❌ `member_runtime JSONB` for future member data（獨立 Decision，未來 feature）

---

## Trigger 過 Rule 索引

| Rule | 觸點 |
|---|---|
| Rule 019 § 4.1 | Migration 026 → backend `PassHolderRow` → service sig 4 層同步（本 PR 在 backend 3 層；frontend 0 改） |
| Rule 027 | UPDATE 7 column 全用 `${}` tagged template injection，不混 `$N` |
| Rule 032 | `updatePassHolderIssuance` 寫 7 column，但每個 column 是 atomic 寫，**沒有** `\|\|` operator merge，沒有 silent overwrite 風險 |
| Rule 035 | Migration 026 apply via saome_supabase MCP + registry append + CI gate |
| Rule 037 | `user-saome-supabase-apply_migration({...})` 直接呼叫獨立工具名（pre-listed），**禁用** `CallMcpTool` 包 |
| Rule 006 | 完工前驗證 SOP 5/5 |
| Rule 011 | 本 feedback 同 commit（code + feedback + INDEX row + Decision Log 一次性 commit） |
| Rule 025 § 5 DB Migration Checklist | 建 / apply / registry / footer / CI gate 全套 |