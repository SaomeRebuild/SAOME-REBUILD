# Step 5 完工 DEV LOG：Passcreator API 對齊與位置播報設定

## Metadata

- 日期：2026-09-06
- 範圍：CardBuilder Step 5（位置播報、距離、相關文字）
- 目標：讓前端、共用 schema、後端資料模型與 Passcreator API 命名一致，並保留舊資料
- 相關 feedback：`runs/improvements/feedback/20260906-phase5.14-step5-passcreator-alignment.md`、`runs/improvements/feedback/20260906-step5-passcreator-api-data-backfill.md`

## 問題與根因

Step 5 原先使用 `notificationRadius`，但 Passcreator API 使用 `locationsMaxDistance`。位置的緯度與經度也曾允許省略，導致畫面看似可繼續、實際產出的 Apple Wallet 位置資料不完整。此外，Step 5 原本沒有明確的停用開關，無位置觸發需求的卡片只能依賴永遠可略過的流程行為。

這次修正將資料契約集中到共用 schema，再同步前端 store、後端 request schema、資料庫介面與 service 型別。`locationsDisabled` 控制 Step 5 是否需要位置資料；啟用位置播報時，每個位置都必須包含名稱、緯度、經度與有效距離。每個位置另可帶有最多 100 字的 `relevantText`。

## 實作內容

1. 將 `notificationRadius` 統一更名為 `locationsMaxDistance`，並保留 100 至 1000 公尺的限制。
2. 新增 `locationsDisabled`，停用時清空位置與距離資料，避免殘留設定重新啟用。
3. 將緯度與經度改為啟用位置時的必要欄位，新增 `relevantText` 的欄位與長度驗證。
4. 將位置播報的初始訊息、距離、空狀態、錯誤與相關文字翻譯同步到中英文 locale。
5. 新增位置資料純函式、schema conformance 測試與 Step 5 autosave slow-network regression 測試。
6. 新增 migration `20260906000001_017_rename_notificationRadius_to_locationsMaxDistance.sql`，將既有設定轉換為新欄位、補上 `locationsDisabled: false`，並為舊位置資料補上 `relevantText: null`。

## Migration Apply 結果

Migration 017 已透過 `saome_supabase` MCP 套用，並登錄於 `supabase/migrations/.applied-migrations.json`。資料回填驗證結果為：34 筆資料的舊欄位計數為 0、缺少 `locationsDisabled` 的資料為 0、缺少 `relevantText` 的位置為 0；原本存在的距離值 100 已保留。

## 驗證

- TypeScript：`npm run typecheck` 通過。
- Lint：`npm run lint` 通過；沒有新增 lint error。
- Unit test：`npm test` 通過，614 passed、5 skipped。
- i18n：`npm run verify:i18n --workspace=apps/frontend` 通過，17 個 namespace 通過。
- Migration gate：`npm run check:migrations --workspace=apps/backend` 通過，migration registry 與 SQL 檔案一致。

## 後續注意事項

Step 5 的位置播報資料現在以 `locationsMaxDistance` 對外；後續若修改欄位名稱，必須同步共用 schema、前端 store、後端 schema、資料庫介面、service、locale、測試與 migration。已套用的 migration 不應直接修改；任何修補都要建立新的日期序號 migration。
