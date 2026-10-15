# 2026-10-15 — Stamp 圖製圖模組 Step 8 v15→v18 完整實作（CardBuilder 預渲染 + Passcreator strip slot）

> 從 2026-10-13「前端 Stamp 圖合成 plan」Phase 1（shared schema）→ Phase 2（前端 composer）→ Phase 3（後端 upload + DB table）一路推進，2026-10-14 進入 Phase 4（Step 8 publish 觸發 0.png pre-render + push 給 Passcreator）後，user 在 8 小時內連續回報 5 個症狀，總共推進 v15/v16/v17/v18 四個後續修復。本檔是整個模組的 master narrative。
>
> **Step 8 整段推 push master view**：見 [`1012-step8-passcreator-api-implementation-master-dev-log.md`](./1012-step8-passcreator-api-implementation-master-dev-log.md)（v4→v14 全 14+ 輪）。本檔只 stamp 圖相關 v15+ subset。
>
> **2 個 decisions 必讀**：
> - [`runs/decisions/2026-10-14-stamp-card-publish-composition.md`](../decisions/2026-10-14-stamp-card-publish-composition.md) — 觸發時機決策（Option B：Publish 觸發 pre-render 0.png）
> - [`runs/decisions/2026-10-15-stamp-card-push-wiring.md`](../decisions/2026-10-15-stamp-card-push-wiring.md) — Passcreator 派發決策（Option A：stamp_card / multipass 兩卡種用 0.png strip，其他卡種沿用 `settings.backgroundImage`）
>
> **4 個 feedback 必讀**：詳見本檔 § 5。本檔總覽整個 5 輪迭代的 context，把 v15/v16/v17/v18 的 cross-link 串起來。

## 一句話

把「CardBuilder Step 3 編輯 stamp grid」延伸到「Step 8 publish 自動合成 0.png → 推到 R2 → 派發 URL 給 Passcreator 當 strip 圖」。**scope = 13 個新檔 + 2 個 decisions + 4 個 feedback + 1 個 migration**（22 個新檔案總計）。

## Session timeline（UTC+8）

| 時間 | 事件 |
|---|---|
| 10-13 早上 | frontend plan Phase 1 — `packages/shared/{constants,schemas,logic}/stampCard.ts` 寫完（schema-contract-driven design） |
| 10-13 下午 | Phase 2 — `apps/frontend/src/components/business/stampCard/StampCardImageComposer/` 11 檔（含 `.web.ts` + `.native.ts` Hook Split Pattern）、`apps/frontend/src/i18n/locales/stampCard.{en,zh-TW}.ts` |
| 10-13 晚上 | Phase 3.1 — migration `022_init_stamp_card_images.sql`（partial unique index + status machine）via `saome_supabase-mcp` apply |
| 10-13 晚上 | Phase 3.2 — `apps/backend/src/modules/stamp-images/` 8 檔（index / route / service / db / schemas / 3 個 tests） |
| 10-13 晚上 | Phase 3.3 — `src/index.ts` mount `app.route('/api/templates', stampImagesModule)`、run backend 456 tests 全綠 |
| 10-14 晚上 | user 回報「untracked 0.png 沒被推到 Passcreator」→ 寫 [Decision v15](../decisions/2026-10-14-stamp-card-publish-composition.md)（Option B publish 觸發 pre-render）|
| 10-14 23:00 | 寫 [Decision v15 push wiring](../decisions/2026-10-15-stamp-card-push-wiring.md)（Option A stamp_card/multipass 派發 0.png）|
| 10-15 04:00 | v15 push pipeline 部署 + `[feedback #1](../improvements/feedback/20261015-stamp-0-png-push-pipeline-fix.md)`：Passcreator 沒 strip / 沒吃背景圖 / grid 不置中 — 3 個獨立症狀合一條 fingerprint |
| 10-15 09:00 | v16 fix — 後端 mapping 加 `backgroundHidden: false`（同 fingerprint 延伸：「送 URL 但 Passcreator describe 預設把它藏起來」）→ [feedback #2](../improvements/feedback/20261015-stamp-card-backgroundhidden-passthrough.md) |
| 10-15 09:30 | user 再回報「換背景圖/換格數，0.png 還是舊的」→ v17 fix — composer fetch URL 加 `?v=<backgroundImageVersion>` → [feedback #3](../improvements/feedback/20261015-stamp-card-0-png-background-cache-bust.md) |
| 10-15 10:30 | user 再回報「Passcreator 端 strip 圖還是好幾版之前」→ v18 fix — push URL 加 `?v=<byteHash[:12]>` → [feedback #4](../improvements/feedback/20261015-stamp-card-push-cache-bust-url-hash.md) |
| 10-15 23:00 | 本 master DEV LOG + INDEX row + 同 commit 收掉 5 輪迭代 |

## 5 輪迭代（v13 + v15 + v16 + v17 + v18）的脈絡

整個 stamp 圖系統不是一次 ship 的，是沿「發現問題 → 鎖指紋 → 跨 cache 層修法」的 pattern 推進：

| 版本 | 觸發 | 範圍 | 修法類型 |
|---|---|---|---|
| **v13** (10-13) | user 提需求「pass 要 strip 圖帶 stamp grid + 預設空模板蓋章卡預覽」| shared schema + 前端 composer + 後端 upload + DB table | feature：完整 CRUD pipeline |
| **v15** (10-15 04:00) | deploy v13 後 user 實測「strip 圖 strip 完全沒在 deployed pass 上」 | Step 8 publish hook + Passcreator 派發 + `?v=0` cache-bust | feature + integration |
| **v16** (10-15 09:00) | 派發 URL 送了但 Passcreator describe 預設把 background 藏起來 | mapping IIFE 加 `backgroundHidden: false` flag | fingerprint 修法 #1 |
| **v17** (10-15 09:30) | 換背景圖 → 0.png 顯示舊背景（瀏覽器 cache 同 URL 不同 bytes） | composer fetch URL 加 `?v=<backgroundImageVersion>` | fingerprint 修法 #2 |
| **v18** (10-15 10:30) | Passcreator / Cloudflare edge strip URL 一樣 → cache hit | push URL 加 `?v=<byteHash[:12]>` | fingerprint 修法 #3 |

**核心 fingerprint**：5 輪修法中 3 輪（v16/v17/v18）都是「**URL 是 stable、bytes 是 dynamic、cache 不會 revalidate**」這條 SAOME 自 2026-07-28 Bug-4c 起的家族 pattern。修法都是「加讓 cache 失效的 token」。

## 模組架構總覽（v18 production 狀態）

```
┌──────────────────── Backend ────────────────────┐    ┌─── Frontend ───┐
│                                                  │    │                │
│  apps/backend/src/modules/stamp-images/          │    │  StampCard     │
│  ├─ index.ts                  (Hono sub-app)     │    │  ImageComposer │
│  ├─ db/stampImages.ts         (5 sql funcs)      │    │  ├─ .tsx       │
│  ├─ routes/uploadStampImage.ts                    │    │  ├─ .hooks.ts  │
│  │   PUT /api/templates/:tid/stamp-images/:fc    │    │  ├─ .web.ts    │
│  ├─ schemas/request.ts                           │    │  └─ .native.ts │
│  │   (zod + PNG magic + 4MB cap)                 │    │                │
│  ├─ services/uploadStampImage.ts (atomic-ish)     │    │  Step8Save     │
│  └─ tests/ 3 檔 (41 tests)                        │    │  .hooks.ts     │
│                                                  │    │  (pre-render   │
│  apps/backend/src/modules/pass-templates/        │    │   + upload)    │
│  ├─ routes/getTemplateStampImage.ts              │ ◄──┤                │
│  │   GET /api/pass-templates/:tid/stamp-image/:fc│    │  Step8Save     │
│  ├─ services/passTemplateMapping.ts              │    │  .hooks.ts     │
│  │   images IIFE: cardType dispatch + byteHash   │    │  (publish      │
│  │   ?v=<hash[:12]> cache-bust (v18)             │    │   call)        │
│  ├─ services/passTemplateSync.ts                 │    │                │
│  │   thread stampImageByteHash to mapping        │    │                │
│  └─ tests/ 2 檔 (15 tests: passTemplateMapping   │    │                │
│     .stamp-image + getTemplateStampImage)        │    │                │
│                                                  │    │                │
│  supabase/migrations/                            │    │                │
│  20261013000001_022_init_stamp_card_images.sql    │    │                │
│  (partial unique + status machine + trigger)     │    │                │
└──────────────────────────────────────────────────┘    └────────────────┘
        │                              ▲                          │
        │                              │                          │
        ▼                              │                          │
   PostgreSQL:                         │                          │
   public.template_stamp_card_images   │                          │
   ├─ pending → uploaded → failed      │                          │
   ├─ (template_id, fill_count)        │                          │
   │   UNIQUE WHERE status='uploaded'  │                          │
   └─ byte_hash char(64) SHA-256       │                          │
                                       │                          │
   R2 bucket:                          │                          │
   tenants/{tenantId}/templates/       │                          │
       {templateId}/stamp-{fc}.png     │                          │
                                       │                          │
   Passcreator V2:                     │                          │
   GET /describe ?stamp_image_key      │ ◄───── v18 fix via ──────┘
   = .../stamp-image/0?v=<hash[:12]>   │       ?v=<hash[:12]>
```

## 設計決策細節

### D1 觸發時機：Publish 觸發 pre-render 0.png（Option B）

**為什麼不是 Option A**：完全不預渲染 → Scanner 即時組圖 → customer 端的 Wallet preview 拿不到 png，UX 不一致，視覺獎勵對 strip / Scanner / analytics 三條路徑不能同步。

**為什麼不是 Option C**：Publish 全預渲染 16 張 → mobile 4G 慢網路容易把 publish timeout 推到 30s+。

**為什麼是 Option B（採用）**：UX 順、最低保本（只多 1 個 PUT ≈ 30–80 KB）、與既有架構對齊、1–15 留給 Scanner runtime。

**設計約束**（per Decision v15 觸發同步檢查）：
- Publish 時間變長：mobile 4G 約多 1–2s → Step8Save 擴 `rendering-stamp-zero` / `uploading-stamp-zero` 子狀態 + i18n hint
- 0.png 失敗 → publish 整體失敗（**不** silent warn；published template 的 preview 不能缺）
- Concurrent republish：同 R2 key 覆寫、**但** user 改 design 後必須重新組圖（`backgroundImageVersion` 強制 invalidate via v17 fix）

### D2 派發讀 0.png：cardType dispatch（Option A）

**為什麼不是 Option B**：emit 多個 strip variant → Passcreator V2 schema 不支援。

**為什麼不是 Option C**：PassKit spec 強制 strip 圖由 template 提供，App 渲染無法繞過。

**為什麼是 Option A（採用）**：cardType 派發在 backend `passTemplateMapping.ts` images IIFE，前端不感知。

**Dispatch truth-table（v18 production）**：

| cardType       | stampImageKey | stampImageByteHash | emitted URL                                  |
|----------------|---------------|--------------------|----------------------------------------------|
| !stampish      | *             | *                  | `${tid}/background` proxy (既有路徑)         |
| stampish       | no            | (any)              | `${tid}/background` proxy (既有路徑)         |
| stampish       | yes           | null/empty         | `${tid}/stamp-image/0` (v15 compat, 無 cache-bust) |
| stampish       | yes           | non-empty          | `${tid}/stamp-image/0?v=<hash[:12]>` (v18)   |

### D3 schema contract 四層同步（Rule 019 § 4.1）

| 層 | 檔案 | 角色 |
|---|---|---|
| 1 | `packages/shared/schemas/stampCard.ts` | `uploadStampCardImageRequestSchema` + `uploadStampCardImageResponseSchema` + `stampCardImageInputSchema` + `stampCardImageOutputSchema` |
| 2 | `apps/backend/src/modules/stamp-images/schemas/request.ts` | layer-2 加固：base64 fast-fail + 4 MB raw cap + PNG magic header check + fillCount path-param schema |
| 3 | `apps/backend/src/modules/stamp-images/db/stampImages.ts` | sql accessor (5 funcs: insertPending / markUploaded / markFailed / deletePending / findUploaded) + `TemplateStampImageRow` interface |
| 4 | `apps/backend/src/modules/stamp-images/services/uploadStampImage.ts` | service signature `(sql, bucket, {templateId, tenantId, fillCount, imageBase64}) => UploadStampImageResult` |

**Rule 019 § 4.1 verified**：4 層皆有對齊（v15 push pipeline 額外加 `MapTemplateToPasscreatorArgs.stampImageKey` + v18 `stampImageByteHash` 雙 optional arg — internal service signature，不是對外 API contract，跳過 § 4.1 4 層檢查；conformance test 仍覆蓋 via `passTemplateMapping.stamp-image.test.ts`）。

### D4 DB partial unique index（migration 022）

`UNIQUE (template_id, fill_count) WHERE status = 'uploaded'` 的設計精髓：

- **`uploaded` rows 唯一**：避免「多張上傳成功 row 都指同一個 slot」
- **`pending` rows 多重**：R2 write 期間 transient 狀態
- **`failed` rows 多重**：audit + 未來 cron sweep retry

對應 atomic-ish write flow：`INSERT pending → R2 PUT → UPDATE uploaded`（失敗：`UPDATE failed` 但 row 保留供未來 retry）。v18 還觀察到一個 bug：user re-publish 同 slot → 第 7a 步 `UPDATE uploaded` 會被 partial unique 拒絕（因為上一輪的 `uploaded` row 還在） → 加 **Step 4 DELETE pre-existing `uploaded` rows** 前置清場（見 `uploadStampImage.ts::uploadStampImage` line ~176）解決。

### D5 Hook Split Pattern（mobile future-proof）

`composeStampCardImage.{ts,web.ts,native.ts}` 三檔結構：
- 主檔持有 public API（`composeStampCardImage()`）
- `.web.ts` 提供 Canvas API binding（`createImageBitmap` + `OffscreenCanvas` + `canvas.convertToBlob()`）
- `.native.ts` stub throw NotImplementedError（指向 RN migration backlog）

對齊 Rule 024 § Hook Split Pattern + tsconfig `moduleSuffixes: ["", ".web", ".native"]`。

### D6 atomic-ish write flow 的 idempotency

```typescript
// uploadStampImage.ts service
async uploadStampImage(sql, bucket, {templateId, tenantId, fillCount, imageBase64}) {
  // Step 1+2: decode + byte-level validation (zod + magic + 4MB cap)
  const bytes = decodeBase64ToBytes(args.imageBase64);
  assertPngMagicHeader(bytes);   // 8 bytes 89 50 4E 47 0D 0A 1A 0A
  assertRawByteLength(bytes);    // ≤ 4 MB

  // Step 3: SHA-256 byte hash (lower-case hex 64 chars)
  const byteHash = await sha256Hex(bytes);

  // Step 4: 前置清場 — 刪既有 uploaded rows（修 partial unique 衝突）
  const deletedUploadedCount = await deleteUploadedStampImage(sql, {
    templateId, fillCount,
  });
  // warn > 1（partial unique 應擋下，>1 = 之前有 bug）

  // Step 5: INSERT pending row (DB state visible immediately)
  const pendingRow = await insertPendingStampImage(sql, {
    templateId, fillCount, r2Key, byteHash, byteLength,
  });

  // Step 7: R2 PUT (httpMetadata contentType + customMetadata byteHash)
  try {
    await bucket.put(r2Key, bytes, {
      httpMetadata: { contentType: 'image/png' },
      customMetadata: { templateId, tenantId, fillCount, byteHash },
    });
  } catch (err) {
    await markStampImageFailed(sql, pendingRow.id);
    throw new BadGatewayError({ upstream: 'r2', kind: 'invalid_response', ... });
  }

  // Step 8a: flip uploaded
  const updated = await markStampImageUploaded(sql, pendingRow.id);
  return {
    r2Key: updated.r2Key,
    byteHash: updated.byteHash,
    byteLength: updated.byteLength,
    uploadedAt: (updated.uploadedAt ?? new Date()).toISOString(),
  };
}
```

**失敗語意**：
- `ValidationError` 400（bad base64 / non-PNG / oversize）— 無副作用
- `BadGatewayError` 502（R2 PUT 失敗）— pending row 改成 `failed` 保留 audit，未來 cron sweep 可 retry
- `Error` 500（R2 PUT 成功但 row 在 INSERT/UPDATE 間消失）— 超極邊緣情境，explicit message 操作者看到

### D7 cache-bust 雙 token 策略（v17 + v18）

兩個 layer 各一個 token，避免「一個 token 撐全部 cache」：

| Layer | Token | 何時 bump | Source |
|---|---|---|---|
| 瀏覽器 composer (URL: `/api/pass-templates/${tid}/background`) | `?v=<backgroundImageVersion>` | Step 3 上傳新背景圖時 bump | `setBackgroundImage` store action 內 `Date.now()` |
| Passcreator / edge cache (URL: `/api/pass-templates/${tid}/stamp-image/0`) | `?v=<byteHash[:12]>` | PNG bytes 改變時（hash 必變） | `template_stamp_card_images.byte_hash` |

為什麼 **不** 用同一個 token 撐全部：兩個 layer 的 invalidation 時機不同 — background 換但 grid 不換時，0.png bytes 沒變（composer hash 跟上一次一致），但 `${tid}/background` 必須重新 fetch（瀏覽器拿到新背景）；反之 grid 換但 background 不換，composer 重新合出不同 bytes（hash 變），但 `${tid}/background` 仍可 cache hit。雙 token 才是正確的 expressive 設計。

## 完整 test 矩陣（v18 production）

| 測試檔案 | 條數 | 涵蓋 |
|---|---|---|
| `apps/backend/src/modules/stamp-images/tests/uploadStampImage.test.ts` | ~20 | atomic-ish write flow：decode success / bad base64 / non-PNG / oversize / R2 PUT fail mark-failed / re-publish DELETE-uploaded |
| `apps/backend/src/modules/stamp-images/tests/uploadStampImageRoute.test.ts` | ~12 | route 層：JWT 缺 / tenantId 缺 / template 找不到 / 200 happy path / safeParse fail |
| `apps/backend/src/modules/stamp-images/tests/requestSchema.test.ts` | ~10 | zod schema 邊緣：fillCount 邊界、base64 length cap、path-param UUID regex |
| `apps/backend/src/modules/pass-templates/tests/passTemplateMapping.stamp-image.test.ts` | 18 (v15 8 + v16 4 + v18 4 + 2 integration) | cardType 派發 + `backgroundHidden` flag + `?v=<hash[:12]>` cache-bust |
| `apps/backend/src/modules/pass-templates/tests/getTemplateStampImage.test.ts` | 7 | 公開 R2 proxy：204 / 404 / r2_key mismatch / R2 hit / R2 miss / UUID 錯 / tenant_id NULL |
| `apps/frontend/src/components/business/stampCard/StampCardImageComposer/StampCardImageComposer.test.tsx` | ~10 | composer state machine (idle/composing/uploading/saved/error) + grid cap warning |
| `apps/frontend/src/components/business/stampCard/StampCardImageComposer/composeStampCardImage.web.test.ts` | ~8 | Canvas API 行為：color / image / grid / fillCount / cap warning / transparency |
| `apps/frontend/src/components/business/stampCard/StampGridPreview/StampGridPreview.test.tsx` | ~6 | grid preview 渲染 |
| `apps/frontend/src/components/business/stampCard/StampGridPreview/StampGridPreview.utils.test.ts` | ~5 | `computeStampGridLayout` math (1×5 / 2×5 / 3×5 / 4×5) |
| `packages/shared/logic/stampCardImage.test.ts` | ~12 | `isGridFullyStampable` + `computeStampGridLayout` 純函式 |
| `packages/shared/schemas/stampCard.test.ts` | ~15 | zod schemas: Input/Output/upload request/upload response + byteHash regex + hex color regex |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step8Save/Step8Save.composeZero.test.tsx` | 8 | Step 8 publish hook：pre-render 0.png + PUT upload |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step8Save/Step8Save.hooks.multipass.test.tsx` | 6 | multipass 派發：也是 stamp card 同源路徑，verify dispatch |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step8Save/Step8Save.backgroundCacheBust.test.tsx` | 4 | v17 wire format：`?v=<backgroundImageVersion>` + re-upload bump + color-only path + no-token-leak |

**完整測試結果（v18 production）**：
```
pass-templates:  164/164 passed
stamp-images:     41/41 passed
cards:           251/251 passed
typecheck:         0 errors
i18n verify:      (stamps + others) OK
```

## 4 層 schema + Rule 驗證

| Rule | 觸發 | 證據 |
|---|---|---|
| Rule 000 § B.4 模組化 | ✅ | routes/ 只做 zod parse + service 呼叫；service 拆 `uploadStampImage` / `decodeBase64ToBytes` / `assertPngMagicHeader` / `assertRawByteLength` / `sha256Hex` / `buildStampImageKey` 多個 named export |
| Rule 019 § 4.1 4 層 schema sync | ✅ | shared/schemas/stampCard.ts + backend/schemas/request.ts + backend/db/stampImages.ts (TemplateStampImageRow interface) + backend/services/uploadStampImage.ts (UploadStampImageResult interface) 對齊 |
| Rule 024 Hook Split Pattern | ✅ | `composeStampCardImage.{ts,web.ts,native.ts}` 3 檔 + tsconfig `moduleSuffixes: ["", ".web", ".native"]` |
| Rule 027 postgres.js dynamic query | ✅ | 不直接寫 SQL，全部走 `@/shared/db/client.ts::getDb` |
| Rule 032 backend JSONB merge silent killer | ✅ | 不寫 jsonb 欄位，本表是 regular table |
| Rule 035 migration apply pipeline | ✅ | migration 022 via `saome_supabase-mcp apply_migration` success → `.applied-migrations.json` 已 append entry (`applied_at: 2026-10-14, applied_by: frontend-stamp-card-image-composition, via: saome_supabase-mcp`) |
| Rule 037 MCP tool call pattern | ✅ | migration 022 + 016 (10-04 補 apply) 都是直接呼叫 `user-saome_supabase-apply_migration({...})`，無 `CallMcpTool` wrapper（歷經 9/30 + 10/03 兩次教訓） |
| Rule 011 commit message footer | ✅ | 同 commit 帶 code + 4 feedback + 2 decisions + 本 DEV log + INDEX row |

## Future invariant（給未來 session）

| Invariant | 為什麼 |
|---|---|
| `template_stamp_card_images.uploaded` row 必唯一 per (template, fill_count) | partial unique index enforce |
| 0.png publish 觸發 = CardBuilder Step 8 publish hook | per Decision v15 Option B |
| Passcreator push URL 加 `?v=<stampImageByteHash[:12]>` | per v18 fingerprint 修法 |
| Composer fetch URL 加 `?v=<backgroundImageVersion>` | per v17 fingerprint 修法 |
| Mapper 同時 emit `backgroundHidden: false` 當 `images.background` 有 URL | per v16 fingerprint 修法 |
| Hook Split Pattern 必走 3 檔 | RN 化時 `.native.ts` throw NotImplementedError |
| `byte_hash` 必 lower-case hex 64 chars | migration 022 CHECK + shared schema regex 都 enforce |
| `gridColor: 'transparent'` 為 design contract | pinned literal type in shared schema |
| `STAMP_FILL_CAP = 15` 為 cost cap | user 確認「after 16.png no more generation」 |
| `tenants/{tenantId}/templates/{templateId}/stamp-{fillCount}.png` R2 key convention | 對齊既有 `cards/db/generateUploadUrl.ts` 風格 |

## 待辦（next session，v19+）

- [ ] **production smoke test 必跑 v18 deploy 後**：用 Playwright 開真實瀏覽器、實際上傳背景、換格數、再 publish → verify Passcreator `GET /describe` 回傳 `images.background` URL 的 `?v=<hash>` token 跟新 bytes 對應。**owner: user deploy + production 實測後回報**
- [ ] **Cache-Control header audit**（V17 feedback action item #1+#2 仍未處理）：`apps/backend/src/modules/pass-templates/routes/getTemplateImage.ts` 的 `Cache-Control: public, max-age=31536000, immutable` 對 background proxy 不適用（同 key 會被覆寫）。改 header 比改每個 consumer 加 cache-bust 更治本
- [ ] **`getTemplateImage.ts` 也加 `?v=<hash>` cache-bust**：Passcreator 未來 push background route 時仍會撞到同 fingerprint
- [ ] **`template_stamp_card_images.byte_hash` 改 partial unique index 綁定 `uploaded` 條件**（v18 feedback action item #5）：確保 uploaded row 一定有有效 hash
- [ ] **Scanner 整合 1.png–15.png**：目前只有 0.png，Plan Phase 3 留的 1–15 留給 Scanner runtime 組圖
- [ ] **multipass 的 grid UI 與專屬 icon**：v15 同源派發，UI 還沒做細節（v15 self-improvement action item #2）
- [ ] **觀察 Passcreator 端對 `?v=...` 的實際 cache 行為**：如果忽略 query，這條修法無效 → 回頭改 Cache-Control header。Production 實測後決定
- [ ] **`uploadStampCardImage.ts` (frontend service) 介面與 CardBuilderEditorPreview auth URL 路徑統一**：目前兩條不同路徑（auth URL vs public proxy），未來要統一時先把 CardBuilderEditorPreview 的 auth URL 換成 public proxy

## 5 輪迭代的 6 條教訓（v13+v15+v16+v17+v18）

### T1 URL = stable、bytes = dynamic、cache 不 revalidate — 是 SAOME Bug-4c 起家族第 4-6 例

| 例子 | 哪一層 cache | 哪個 URL 不變 |
|---|---|---|
| 2026-07-28 Bug-4c | 瀏覽器 mixed content | localhost dev URL 烤進 production bundle |
| 2026-07-28 Bug-4d | Cloudflare edge origin | Hono path 走 401 |
| 2026-09-07 CORS drop | Worker runtime | 503 + 沒 CORS header |
| 2026-10-15 v16 | Passcreator describe default | `images.backgroundHidden: true` |
| 2026-10-15 v17 | 瀏覽器 HTTP cache | `${tid}/background` 同 URL 不同 bytes |
| **2026-10-15 v18** | **Passcreator / Cloudflare edge** | **`${tid}/stamp-image/0` 同 URL 不同 bytes** |

共同 fingerprint：URL 是 stable，實際內容是 dynamic，中間某個 layer 的 cache 不會 revalidate。每一例的修法都是加「讓 cache 失效的 token」。**未來一律 check Rule 040 草案（cache-bust 統一 SOP）**。

### T2 「front-end 觸發」與「Passcreator consume URL」之間的 cache protocol 要分層

不能單一 token 撐全部 — 因為兩個 layer 的 invalidation 時機不同：
- 換 background 但 grid 不換 → composer hash 跟上一次一致 + `${tid}/background` 必須重新 fetch
- grid 換但 background 不換 → composer hash 變 + `${tid}/background` 仍可 cache hit

「composer-side token」跟「edge-side token」是兩個 token，不是同一個。

### T3 partial unique index (template_id, fill_count) WHERE status='uploaded' 是 atomic-ish write flow 的物理保證

但 re-publish 同一 slot 會撞 partial unique → 必須前置 DELETE uploaded rows。這是 migration 022 沒顯式寫但服務層必清的隱性合約。

### T4 schema-driven design 把 cache-bust token 從 implicit 變 explicit

`StampCardImageOutput.blobHash` 跟 `template_stamp_card_images.byte_hash` 跟 Passcreator 推送的 `?v=<hash>` 三個地方用同一個值，schema 強制 SHA-256 hex 64 字規則（`char(64)` + regex `^[0-9a-f]{64}$` + schema 驗證）。**沒有這個 contract，v18 cache-bust 無從設計**。

### T5 「user 在 production 多版本 keep」是 SCAN 過去 assumption 的最大敵手

v18 case：user 連續換 background / grid / icon 各 3 次，每次 publish → URL 永遠 stable（沒 cache-bust token）→ 10+ 版本的 0.png 都 cache 在 Passcreator / edge → user 只看到第一次的 strip 圖。

教訓：**任何 R2 上會被覆寫但 URL 不變的 route，必須設計 cache invalidation token**（query string 或 `Cache-Control: private, max-age=0` 二選一）。**新 route audit 必帶這條 checklist**。

### T6 conformance test 要分階段寫在 source-level + integration + end-to-end

- source-level：`passTemplateMapping.stamp-image.test.ts` (18 條) 驗證 mapping 行為 + URL format
- integration：`getTemplateStampImage.test.ts` (7 條) 驗證 R2 proxy 行為 + 204/404 silent
- end-to-end：**目前還沒寫 Playwright smoke test**（v18 feedback action item #4 提到，下次 deploy 必補）

## Cross-ref

### Decisions（2）

- [`runs/decisions/2026-10-14-stamp-card-publish-composition.md`](../decisions/2026-10-14-stamp-card-publish-composition.md) — 觸發時機（Option B publish pre-render）
- [`runs/decisions/2026-10-15-stamp-card-push-wiring.md`](../decisions/2026-10-15-stamp-card-push-wiring.md) — Passcreator 派發（Option A stamp_card/multipass 兩卡種）

### Feedback（4 — 對齊 v15/v16/v17/v18）

- [`runs/improvements/feedback/20261015-stamp-0-png-push-pipeline-fix.md`](../improvements/feedback/20261015-stamp-0-png-push-pipeline-fix.md) — **v15** Stamp / Multipass 0.png push pipeline（3 個症狀合一條 fingerprint：Passcreator 沒 strip / 沒吃背景圖 / grid 不置中）
- [`runs/improvements/feedback/20261015-stamp-card-backgroundhidden-passthrough.md`](../improvements/feedback/20261015-stamp-card-backgroundhidden-passthrough.md) — **v16** Stamp / Multipass 0.png `backgroundHidden` bug fix（Passcreator describe 預設 `true` 把它藏起來）
- [`runs/improvements/feedback/20261015-stamp-card-0-png-background-cache-bust.md`](../improvements/feedback/20261015-stamp-card-0-png-background-cache-bust.md) — **v17** 0.png composer background cache-bust（瀏覽器 HTTP cache 同 URL 不同 bytes）
- [`runs/improvements/feedback/20261015-stamp-card-push-cache-bust-url-hash.md`](../improvements/feedback/20261015-stamp-card-push-cache-bust-url-hash.md) — **v18** Stamp push URL cache-bust via `byteHash` query（Passcreator / edge cache 同 URL 不同 bytes）

### Migration（1）

- [`supabase/migrations/20261013000001_022_init_stamp_card_images.sql`](../../supabase/migrations/20261013000001_022_init_stamp_card_images.sql) — `template_stamp_card_images` table + partial unique index + status machine + updated_at trigger
- `.applied-migrations.json` entry 已 append（`applied_at: 2026-10-14, applied_by: frontend-stamp-card-image-composition, via: saome_supabase-mcp`）

### Related rules

- `.cursor/rules/027-postgres-dynamic-query-pattern.mdc` § workerd JSON.stringify pitfall — strict template `${}` injection
- `.cursor/rules/035-migration-apply-pipeline.mdc` — apply / append registry / CI gate
- `.cursor/rules/019-schema-contract-drift.mdc` — 4 層 schema sync
- `.cursor/rules/024-mobile-future-proof.mdc` § Hook Split Pattern — `.web.ts` / `.native.ts`
- `.cursor/rules/006-verification.mdc` — 完工驗證清單
- `.cursor/rules/011-dev.mdc` — feedback 同 commit

### Rule 017 production bundle guard

Stamp 模組 deploy 是 backend only（worker `saome-backend`），前端 composer 是 browser-side 不影響 production bundle。但 frontend 1 次 deploy（含 `Step8Save.hooks.ts` 改 `buildZeroFillStampInput` signature）必跑 `grep -rn localhost apps/frontend/dist/` = OK。

### Step 8 master DEV LOG

[`1012-step8-passcreator-api-implementation-master-dev-log.md`](./1012-step8-passcreator-api-implementation-master-dev-log.md) — v4→v18 全 18 輪 Step 8 push 迭代架構（本檔是 v15-v18 stamp 圖專屬 master view）

---

> 撰寫者：Cursor Assistant ｜ 時間：2026-10-15 23:00 (UTC+8)
>
> Self-improvement action items：見 § 待辦（v19+）；INDEX row 同步新增；feedback 已在 10-15 17:00 起 4 篇原檔 commit（與本 master DEV LOG 屬同 commit closure）
