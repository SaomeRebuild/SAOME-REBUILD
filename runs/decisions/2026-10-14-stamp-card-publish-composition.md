# Decision: Stamp Card Image Composition 觸發時機 — Option B（Publish 觸發前端組圖 + Push）

> 2026-10-14 — Stamp Card Image Composition Plan Phase 2

## 背景

`StampCardImageComposer` 與後端 `PUT /api/templates/:id/stamp-images/:fillCount` upload 通道已完整
（front-end 組圖 + base64 encode + PUT；back-end decode + magic check + SHA-256 + R2 PUT）。

但「前端**什麼時候**把組好的 0.png~15.png 推給後端」這個觸發時機有三條路徑：

| 選項 | 觸發時機 | 範圍 | mobile 慢網路影響 |
|---|---|---|---|
| A. minimal viable | 不主動推，Scanner runtime 即時組圖 | 0 張預渲染 | Scanner 每次掃描都被卡，UX 卡 |
| **B. publish 觸發前端組圖再 push**（採用） | Publish 時組 0.png 並 push；1–15 仍由 Scanner runtime 組 | 1 張預渲染（0.png）| Publish 多 0.5–2s 等待（手機 canvas 慢），但只多 1 個 PUT |
| C. 完整預渲染 | Publish 時把所有 16 張全組並 push | 16 張預渲染 | Publish 多 10–30s 等待，慢網路會 timeout，UX fail |

原 Step 3 的「Preview Save as 0.png」按鈕是 dev-time 主動觸發，與 Publish 無關。
原本 P2 計畫（`StampCardImageComposer` module-level doc）寫的也是「Step 3 預渲染 0.png；Scanner 填 1–15」。
這條 Decision 變更的是：**0.png 的實際上傳時機從 Step 3 拉到 Publish**，其他階段不變。

## 選項與決定

- 選項 A：完全不預渲染，Scanner 即時組圖 — ❌ 弱網路下 Scanner 拿不到 png，視覺獎勵失效
- 選項 B：Publish 觸發 0.png 組圖並 push — ✅ **採用**（理由：UX 順、可接受成本、與既有架構對齊）
- 選項 C：Publish 全預渲染 16 張 — ❌ mobile 慢網路風險過高（reason for rejection：見下）

**決定**：選項 B，scope 為「Publish 流程結束前組 0.png 並 PUT，其餘 fillCount 仍按現狀」。

### 為什麼是 Option B

1. **UX 順**：使用者按 Publish 後，模板的「空白蓋章卡預覽」立刻在後台 R2 落地，不需等第一次 customer 掃描才看到。
2. **最低成本**：只多 1 個 PUT（≈ 30–80KB base64 PNG），mobile 4G 慢網路 1–2s。可接受。
3. **與既有架構對齊**：`StampCardImageComposer` 已經是「前端組 → 後端接」的 split；只需把組 0.png 的觸發從 Step 3 按鈕移到 Step 8 publish hook。
4. **1–15 留給 Scanner**：Scanner 仍按需組圖與上傳（fill-by-fill），這條路徑在 mobile 會有風險，但屬於另一條 tradeoff（已用 ack：slow-network → 視覺獎勵降級，而非完全失效）。

### 為什麼不是 Option C

- 16 張預渲染在 mobile 4G 慢網路（Cloudflare Pages edge 200–700ms + Hyperdrive fetch 300–700ms × 16 + R2 PUT × 16）容易把 publish timeout 推到 30s+。
- 即使成功，user 在 publish 按鈕 disabled 期間看到空白 spinner，心裡會覺得「我是不是按錯了」。
- 16 張完整預渲染的成本，跟「Scanner 即時組 1 張相比」，使用者感受差異極小 → C 的投資報酬率低。

### 為什麼不是 Option A

- Scanner 在 mobile 即時組 16 張 PNG 對 customer 是不可見成本（他們只看到蓋章動畫），但**沒有一張 png 落地**。
- 這意味 customer 端的 Wallet preview（比 Scanner 更廣的 surface）只能靠 fallback 的 SVG/generic icon，UX 不一致。
- A 的代價由後續的 wallet preview / Scanner analytics 取證 / Scanner offline mode 三條路徑共同承擔，無法用「Scanner 一條慢網路」蓋過。

## 影響

| 受影響系統 | 影響 |
|---|---|
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step8Save/Step8Save.hooks.ts` | `publish()` 需在 `cardService.update({ status: 'published' })` 之前先組 0.png 並 PUT |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step8Save/Step8Save.types.ts` | `Step8SaveStatus` 需擴 `rendering-stamp-zero` / `uploading-stamp-zero` 子狀態 |
| `apps/frontend/src/i18n/locales/cardEditor.{en,zh-TW}.ts` | 新增「儲存並發布」期間的「正在準備蓋章卡預覽」字串 |
| `packages/shared/schemas/stampCard.ts` | 不變 — `uploadStampCardImageRequestSchema` 已涵蓋 fillCount=0 |
| `apps/backend/src/modules/stamp-images/*` | 不變 — 0.png PUT 走既有 route |
| `supabase/migrations/*` | 不變 — `stamp_card_images` 已存在 |
| `apps/frontend/src/components/business/stampCard/StampCardImageComposer/*` | 不變 — Hook 已經能傳 fillCount=0 |
| Future Scanner workflow（1.png–15.png）| 不在這條 Decision 範圍，仍按 Plan Phase 3 處理 |

### 設計約束（採用此選項的代價）

1. **Publish 時間變長**：mobile 4G 約多 1–2s；必須有明確 loading 狀態，否則使用者會以為按鈕壞掉。
2. **Stamp card 0.png 失敗 → publish 整體失敗**：若 compose 0.png 或 PUT 0.png 失敗，**不可**只 warn 後繼續 publish — 因為這代表 published template 的「預覽圖」會缺。要嘛成功 push，要嘛整個 publish rollback。
3. **Auth token 必須可用**：publish 是在 login 後，token 已存在；不需新設計，但若 token 過期要在這裡 refresh。
4. **Concurrent republish**：同一 template 重複 publish 不會衝突（PUT 用同一 R2 key 覆寫），但若 0.png 內容跟新 design 不一致（user 改了 grid 配置後 republish），必須**重新組圖**，不可重用舊 cache。

### 不在範圍（明確排除）

- 1.png~15.png 的 render/push 時機
- Scanner 端的 offlinemode fallback 設計
- Wallet preview 端的 png fetch fallback
- 預渲染產生的 R2 key 是否需要加 hash（採 SHA-256 over PNG bytes，使用 `stamp_card_images.byte_hash` 對撞來偵測 stale）
- 公版 stamp icon manifest 的擴充（不在這條 Decision）

## 觸發同步檢查

- [ ] `Step8Save.types.ts` 新狀態需同步更新 `Step8Save.stories.tsx` / `Step8Save.test.tsx` 的狀態列表
- [ ] `Step8Save.hooks.ts::publish` 需加 regression test：「publish 失敗 → 0.png 不應落地 R2」
- [ ] `StampCardImageComposer.hooks.ts` 既有 test 行為不變，無需改
