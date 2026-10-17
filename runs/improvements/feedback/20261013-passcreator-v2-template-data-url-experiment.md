# 2026-10-13 Passcreator V2 模板 Data URL Experiment — INCONCLUSIVE per strict rubric / PASS for SAOME-side savings

**Date**: 2026-10-13
**Type**: Experiment spike (no production code change)
**Author**: Agent (Cursor)
**Linked artifacts**:
- Plan: [passcreator_v2_模板_data_url_實驗計畫_a8edd4d7.plan.md](file:///c:/Users/user/.cursor/plans/passcreator_v2_%E6%A8%A1%E6%9D%BF_data_url_%E5%AF%A6%E9%A9%97%E8%A8%88%E7%95%AB_a8edd4d7.plan.md) + 原始英文版 [`passcreator_v2_template_data_url_experiment_0a0ce15d.plan.md`](file:///c:/Users/user/.cursor/plans/passcreator_v2_template_data_url_experiment_0a0ce15d.plan.md)
- Experiment dir: [`runs/experiments/2026-10-13-passcreator-v2-template-data-url/`](../../experiments/2026-10-13-passcreator-v2-template-data-url/)
- Full results: [`runs/experiments/2026-10-13-passcreator-v2-template-data-url/RESULTS.md`](../../experiments/2026-10-13-passcreator-v2-template-data-url/RESULTS.md)

## Context

User asked: "CardBuilder Step 8 push 時，能不能完全跳過把 strip 圖寫到 R2 這一步？改用 base64 data URL 直接塞進 Passcreator V2 的 `images.background`？"

直覺上是「省一個 R2 PUT + 簡化 deploy 路徑」的解法 B（template-level data URL）。Prior plan 是 V3 pass-level `urlToBackground`，但本輪 user 把問題收窄到 template-level，所以寫新計畫。

## Setup

實驗對象：`templates.passcreator_template_id = 6b858510-2320-4fda-85d6-3845bade872a`（SAOME `templates.id` = `07482c8d-12bc-4b68-9846-3732ed4aa61c`，tenant `efb3fbbc-0b7d-48f1-8e65-8bafa17e0893`，`cardType = discount_card`，0 個 member pass，published）。

**實驗設計 6 步**：Step 1 GET baseline / Step 2 組 1860×338 測試 PNG（pngjs） / Step 3 POST data URL（minimal payload）/ Step 3b POST data URL（完整 `images` object）/ Step 4 re-GET verify / Step 5 restore baseline（MANDATORY）。

## 觀察

1. **V2 GET 端點是 `/describe`**，不是 plan 寫的 `/{id}`。第一次 GET 拿到 TYPO3 HTML 404 page → 從 mu-plugins V2 文件 (`describe-the-structure-of-a-pass-template.md`) 撈出正確路徑。
2. **V2 update 的 `images.icon` 是必填** — partial payload（只 `images.background`）回 400 `errors: [{property: "images.icon", message: "The property icon is required"}]`。
3. **完整 `images` object（data URL background + 既有 icon + 既有 logo）200 OK** — Passcreator 接受 base64 格式本身。
4. **re-GET 後 `images.background` 是 Passcreator 新的 asset URL**，**不是原 data URL**。Passcreator re-host 到 `app.passcreator.com/assets/<新 sha>/<name>@2x.png`，新 sha 跟原 bytes 完全不同。
5. **Re-encode 發生**：原 28,232 bytes PNG → Passcreator 重新 serve 的 2,619 bytes（10x 縮小）。Passcreator 對圖做了 transcoding（可能 PNG 優化或轉 JPEG），strip 上的 stamp grid / 字型 / logo 精度都受影響。
6. **每 POST 都 mint 新 asset URL**：連續多次 push 不會複用，每次都建立新 row。沒有看到 Passcreator 的 asset list / delete endpoint。
7. **Sibling key 完整保留**：icon / logo URL 沒被 silent drop；name / type / colors / barcode / fields 全部保留。Plan 「Sibling key 副作用」風險沒有發生。
8. **Request payload 從 ~310B（既有 URL）變 37,888B（data URL）** — 約 120 倍大。延遲 POST ~1.6s、GET ~1s、verify fetch ~0.76s。
9. **目前 `images.background` 不是 R2 URL**：是 `app.passcreator.com/assets/72ff48da594f03bc5182d59c3d2c9fdb7db334f1/strip@2x.png`。Passcreator 內部把 SAOME 上傳的圖 mirror 到自己的 asset CDN（SAOME 看不到這層，只看到「update 接受了我給的 URL」）。
10. **Restore 200 OK**（含完整 images object），re-GET 後 hash / URL / name 全部回到 baseline。Template 已乾淨還原，實驗前後 production state 完全一致。

## Verdict

按 plan § 「成功 / 失敗 rubric」嚴格對照：
- 情境「API 接受但 Passcreator 內部不 cache base64」: HTTP 200 + re-GET 顯示**新 asset URL**（不是原 data URL）→ **INCONCLUSIVE**
- 情境「API 拒絕 partial」: HTTP 400 → **FAIL for minimal-payload optimization**

按實驗目標「SAOME-side 跳過 R2 寫入」寬鬆對照：
- SAOME 確實不需要寫 R2 → **PASS for SAOME-side savings**
- 但 Passcreator 內部仍持有該圖 → **不是真正的零儲存**

綜合：本實驗**未產生 production code 變更**。短期保留現狀（R2 + lifecycle）；中長期待評估三條 follow-up（見 RESULTS.md § Next Steps 建議）。

## 教訓

1. **docstring 寫的 endpoint path 未必對** — `passcreator.ts:837-870` 寫「`POST /api/v2/pass-template/{identifier}`」沒寫 GET 路徑，導致 plan 假設了「V2 一定有 GET {id} describe」。Plan 寫完前必 `GET /api/v2/pass-template/{id}/describe` 對照 doc（不只用 doc example）。
2. **「partial update 一個欄位」在 V2 update 不是 default — 必填欄位會拒絕**：實驗前的 plan 假設「只送 partial `images.background`」會 work，事實 V2 update 對 `images.icon` 是 required（即使 value 不變也必帶）。**修法**：所有未來 V2 update 計畫必先 GET /describe 看必填欄位清單，不能從「這個欄位 optional」就推「那我只送 partial」。
3. **「Passcreator mirror upload to internal CDN」是觀察到的事實**：SAOME 上傳 R2 後，Passcreator 把圖 re-host 到 `app.passcreator.com/assets/<sha>/<name>@2x.png`。SAOME 的 R2 URL 是「上傳來源」，Passcreator 內部另有儲存。**這意味著**：(a)「SAOME 刪 R2 圖」Passcreator 那份仍存活（沒 API 可清）；(b)「SAOME 上傳 base64 data URL」Passcreator re-host 出新的 asset row（asset 累積問題）。任何 storage lifecycle 設計都要算這層。
4. **Plan § 5 restore 預設「POST 回原 R2 URL」其實是錯的** — 目前 Passcreator 端儲存的是 asset URL，不是 R2 URL。restore 用 R2 URL 會**改壞**。Plan 寫完前必 `GET /describe` 看「現在值是什麼」再決定 restore target，別從規劃假設推。
6. **「完全解掉 bundle『template-level 0 storage』」對 strip 圖的 fidelity 是反效果**：Passcreator re-encode 28KB → 2.6KB（10x 縮小）。對真實 stamp grid 圖，視覺精度一定受損。如果選項 A 是唯一 forward path，要在 production 拿真實 strip 圖（不是純色測試圖）re-encode 比較視覺差異。
7. **Experiment 不一定要寫 feedback**：本實驗未動 production code → 沒 feedback 連結。本 INDEX 條目為「decision / experiment memo」性質，**不**符合 standard feedback format。INDEX 模式可以收容「待評估的方案 / 沒產出 code 的決策」，但要把這類條目跟 code-change feedback 在表格欄位視覺上分開（建議：用 `**EXP:**` prefix 跟一般 `**feat/fix:**` 區別）。
8. **PNG via `pngjs` 從 SAOME-REBUILD 根目錄 `node_modules` 引入是乾淨 pattern** — 沒污染 `apps/backend/package.json`，沒裝 dev-only `sharp`（避免 native binding 安裝）。Plan § 風險「sharp install fails」 fallback 自然成立。

## 4 future invariants

1. 任何 Passcreator V2 update plan 必先 `GET /api/v2/pass-template/{id}/describe` 拿真實 describe response 對照「哪些欄位必填」「目前值是什麼」再寫 update payload。
2. 任何「strip 圖省 R2」相關討論必先量化「Passcreator re-encode 的 fidelity loss」（拿真實 strip 圖走一次完整 cycle，比較 byte + 視覺）。
3. Restore 必寫成「等於現狀」不是「回到原始 R2 URL」 — `images.background` 的 restore target 是「describe GET 看到的當下值」，不是規劃階段假設的 source URL。
4. 實驗 / spike 計畫可走 experiments/ 資料夾獨立（不污染 runs/improvements/feedback/），但**計畫 INDEX 仍要更新**，標 `**EXP:**` prefix 區別 code-change feedback。

## 待辦

- [ ] Follow-up A：解法 A（完整 `images` object + data URL background）實作前，先拿真實 strip 圖（不是純色測試圖）測 Passcreator re-encode fidelity loss
- [ ] Follow-up B：拿真實 strip 圖走 production push cycle 量 latency（現在實驗用純色測試圖 ~3.4s round trip，真實圖會更大 → latency 變化）
- [ ] Follow-up C：確認 Passcreator 有沒有 asset list / delete endpoint（沒在 V2 文件看到，可能要走 V1 或 dashboard）
- [ ] 短期：保留現狀（R2 + lifecycle），不實作 data URL push
- [ ] 中期：production smoke test deploy v13 + verify 4 個新欄位都出現在 describe response（這是 10/12 Step 8 v13 的待辦，跟本實驗無關但同步在 backlog）

## scope

**0 production code 變更**。本實驗只動 `runs/experiments/2026-10-13-passcreator-v2-template-data-url/` 內的 1 個目錄（5 檔：run-experiment.mjs / build-test-image.mjs / test-image.png / RESULTS.md / logs/）。

模板 `6b858510-...` 已完整還原到 baseline（re-GET 確認 hash / URL / name 全部一致）。

## 拒絕清單（不寫進實驗目的 / 不做）

- ❌ 不實作 data URL push path
- ❌ 不改 `passTemplateMapping.ts`
- ❌ 不改 `passcreator.ts`
- ❌ 不改 wrangler.jsonc / .dev.vars
- ❌ 不寫新的 migration
- ❌ 不 production deploy 任何東西
- ❌ 不打 Apple Wallet / Google Wallet 視覺驗證（per plan `success_criteria: api_only`）