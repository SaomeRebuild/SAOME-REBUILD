# CardBuilder data-loss + icon-preview broken — Phase 1 & 3 fix (2026-08-31)

## Metadata

- **日期**：2026-08-31
- **作者**：Cursor Agent + Josh
- **觸發任務**：`fix_cardbuilder_data_loss_+_icon_preview_6eb27ab7.plan.md`
- **完成階段**：Phase 1（SQL MERGE）+ Phase 3 defensive（Preview onError + loadSettings version bump + R2 PUT response check）
- **規則 / skill 觸發**：`saome-task-router`（L2 Standard）、`saome-dev-logging`、`019-schema-contract-drift.mdc`、`028-image-uploader-pattern.mdc`

## TL;DR

兩個症狀同根：`updateTemplate` 後端 SQL 行為錯誤（**REPLACE** 而非 **MERGE**）+ 沒有 `loadSettings` 版本回填機制。本 commit 同時修兩個洞。

| 症狀 | 根因 | 修法 |
|---|---|---|
| Step 2 資料沒存入 DB | SQL `settings = $1::jsonb` REPLACE 整個 JSONB → Step 3 寫 logo+icon 時把 step 2 全部洗掉 | SQL 改 `settings = settings \|\| $1::jsonb` (PostgreSQL JSONB merge) |
| Icon 預覽破圖 | (a) R2 PUT 失敗但 code 沒檢查 response 仍存 key (b) `loadSettings` 不 bump `iconImageVersion` → resume 草稿時 `v=0` 可能撞到 stale cache | (a) PUT response 檢查 (b) loadSettings bump version when key loaded |

## 根因（已驗證）

### Bug A — SQL REPLACE wipes unrelated settings

```typescript
// apps/backend/src/modules/cards/db/templates.ts (BEFORE)
const setSettings = input.settings !== undefined
  ? sql`settings = ${JSON.stringify(input.settings)}::jsonb`
  : null;
```

時間軸：
1. Step 1：`create({ settings: { isPaid: false } })` → DB `settings = { isPaid: false }`
2. Step 2：`update(id, { settings: { storeName: 'X', issuerName: 'Y', barcodeType: 'pdf_417', passValidDays: 365, currency: 'TWD', isPaid: false } })` → DB 變成上述 7 個欄位
3. Step 3 logo upload：`MediaAssetUploader.handleApplyCrop` →
   ```ts
   const safeSettings = (await cardService.getById(templateId)).settings;
   await cardService.update(templateId, { settings: { ...safeSettings, issuerLogo: key } });
   ```
   → SQL `settings = $1::jsonb` 把整個 settings 換成 `{ ..., issuerLogo: key }` ✅ 這次還有 step 2 欄位（因為有 spread）
4. Step 3 icon upload：同樣 `settings = $1::jsonb` → `{ ..., issuerLogo, iconImage }` ✅ 仍然有 step 2
5. 但如果用戶是**回到既有草稿**（settings 已經是 `{ ..., issuerLogo, iconImage }`），然後 user 改了 cardType → 只送 `cardType`，不送 settings → settings 保留
6. **但如果 user 重新編輯 step 2** → handleNext 在 step 2 送的是 `{ barcodeType, storeName, ..., issuerLogo: undefined, ... }`（看 CardBuilderEditorWorkspace.tsx 第 113-122 行）→ SQL REPLACE → settings 變成只含 step 2 欄位 + `issuerLogo: undefined`（被 JSON.stringify 過濾掉）→ **issuerLogo + iconImage 被洗掉** ❌

### Bug B — Icon preview 破圖

| # | 候選 | 排除 / 確認 |
|---|---|---|
| 1 | R2 沒 object | **ELIMINATED** by Phase 2 wrangler evidence（`runs/improvements/feedback/20260830-icon-preview-investigation.md`） |
| 2 | URL 構造錯 | **ELIMINATED** by `MediaAssetUploader.icon-preview.test.tsx` (2/2 pass) |
| 3 | `getImage` 路由 field map 錯 | **ELIMINATED** by 路由 source code review（line 47-51：icon → iconImage）|
| 4 | Store update 路徑錯 | **ELIMINATED** by same test（store `iconImage` = correct R2 key）|
| 5 | Cache poisoning on `v=0` | **CONFIRMED root cause**：resume draft 時 `reset()` 將 `iconImageVersion: 0`，`loadSettings` 不 bump，URL 帶 `v=0` 撞到 stale browser cache |

額外發現的隱藏根因（修 Bug A 之前無法觸發，修完後才浮現）：
- **R2 PUT 失敗 silently**：code 沒檢查 `fetch(uploadUrl, { method: 'PUT' })` 的 response，假設 success → 即使 PUT 真的失敗（CORS / network），key 還是存到 DB → R2 沒 object → 預覽永久破圖

## 修法

### Phase 1 — SQL MERGE

```typescript
// apps/backend/src/modules/cards/db/templates.ts (AFTER)
const setSettings = input.settings !== undefined
  ? sql`settings = settings || ${JSON.stringify(input.settings)}::jsonb`
  : null;
```

**為什麼後端修而非前端 spread**（抄自 plan）：

| 比較 | 後端 MERGE（採用）| 前端 spread |
|---|---|---|
| 修改點 | 1 行 SQL + 註解 | 改 handleNext 多送欄位 |
| Race condition | 無 | TOCTOU race |
| 涵蓋未來 step | 自動受惠 | 每個新 step 都要帶所有既有欄位 |
| 檔頭 docstring | 本來就寫「MERGED」→ 跟實作一致 | 不修 |

**檔頭 docstring 修正**：
- `|||` (typo) → `||` (correct operator)
- 「settings is REPLACED entirely (not merged)」→ 「settings is MERGED with existing settings (not replaced) so partial updates never wipe unrelated fields」

**新測試檔**：`apps/backend/src/modules/cards/tests/updateTemplate.merge.test.ts`（4 個 case，4 個 pass）

### Phase 3 — Defensive fixes

#### 3.1 R2 PUT response check

```typescript
// apps/frontend/src/.../MediaAssetUploader.tsx
const putRes = await fetch(uploadUrl, {
  method: 'PUT',
  body: blob,
  headers: { 'Content-Type': 'image/png' },
});
if (!putRes.ok) {
  throw new Error(
    `[MediaAssetUploader] R2 PUT failed: ${putRes.status} ${putRes.statusText}`,
  );
}
```

**對齊 Rule 028 § upload-error-handling**：原本 R2 PUT 失敗會 silent，假設 success → DB 存了不存在的 key → 預覽永久破圖。新版 throw error 進 catch block，set `state='error'`，UploadError 顯示 `t('error')`。

#### 3.2 Preview onError fallback

```typescript
// apps/frontend/src/.../MediaAssetUploader/Preview/Preview.tsx
const [loadError, setLoadError] = useState(false);
const handleError = useCallback(() => {
  console.error('[MediaAssetUploader.Preview] Failed to load asset image:', displayUrl);
  setLoadError(true);
}, [displayUrl]);
const handleLoad = useCallback(() => setLoadError(false), []);

// JSX
{loadError ? (
  <div data-testid="asset-load-error" className="...">
    <ImageOff className="..." />
    <span>{loadErrorLabel ?? replaceLabel}</span>
  </div>
) : (
  <img src={displayUrl} onError={handleError} onLoad={handleLoad} ... />
)}
```

**對齊 LogoUploader 行為**：
- 原本 Preview 沒 onError，`<img src>` 失敗就只看到 broken-image glyph
- 新版替換成 actionable fallback：「圖片載入失敗，請重新上傳」+ 點擊 replace button
- Recovery：onLoad 觸發時清 loadError（re-upload 後自動恢復）

#### 3.3 loadSettings version bump

```typescript
// apps/frontend/src/.../CardBuilderEditor.store.ts
loadSettings: (settings) => {
  ...
  set((state) => {
    const loadLogo = resolved?.issuerLogo as string | undefined;
    const loadIcon = resolved?.iconImage as string | undefined;
    const issuerLogo = loadLogo ?? state.issuerLogo;
    const iconImage = loadIcon ?? state.iconImage;
    return {
      ...
      issuerLogo,
      iconImage,
      // Bump version only if the key actually changed (or we just loaded one).
      issuerLogoVersion: loadLogo && loadLogo !== state.issuerLogo
        ? Date.now()
        : state.issuerLogoVersion,
      iconImageVersion: loadIcon && loadIcon !== state.iconImage
        ? Date.now()
        : state.iconImageVersion,
      ...
    };
  });
},
```

**為什麼需要 bump on loadSettings**：
- `CardBuilderEditor.tsx` mount 時 `reset()` → `issuerLogoVersion: 0` + `iconImageVersion: 0`
- 然後 `loadSettings(template.settings)` 載入既有 key
- 原本 loadSettings 不動 version → URL 帶 `v=0` → 撞到 stale browser cache（可能之前 R2 404 response 被 cache 住）
- 新版 loadSettings 偵測到 key 載入時 bump version → URL 帶新 timestamp → 強制 refetch from R2

**Idempotency**：只 bump 當 key changed，避免無意義的 re-render 風暴。

### i18n key 新增

| 檔案 | key | 用於 |
|---|---|---|
| `logoUpload.zh-TW.ts` | `loadError: '圖片載入失敗，請重新上傳'` | Preview 破圖 fallback |
| `logoUpload.en.ts` | `loadError: 'Image failed to load — please re-upload'` | 同上 |
| `iconUpload.zh-TW.ts` | `loadError: '圖片載入失敗，請重新上傳'` | 同上（icon variant）|
| `iconUpload.en.ts` | `loadError: 'Image failed to load — please re-upload'` | 同上 |

## 驗證

| 項目 | 結果 |
|---|---|
| Backend `vitest run` | **92 / 92 passed** (新增 4 個 `updateTemplate.merge.test.ts`) |
| Frontend MediaAssetUploader suite | **38 / 38 passed** |
| Frontend Preview test (NEW) | **4 / 4 passed** |
| Frontend store test (NEW) | **4 / 4 passed** |
| Frontend i18n verify | **15 namespaces / 30 locale files OK** |
| Frontend tsc -b --noEmit | 我的變更 0 errors（pre-existing `PushNotificationMockup.test.tsx` 5 errors 是 IconUploader plan 尚未完成的測試，與本次無關）|
| Frontend lint | 0 errors（pre-existing warnings only）|

## 變更檔案

| 檔案 | 改動 |
|---|---|
| `apps/backend/src/modules/cards/db/templates.ts` | 1 行 SQL (REPLACE → MERGE) + 2 處註解修正 |
| `apps/backend/src/modules/cards/tests/updateTemplate.merge.test.ts` | NEW (~126 行, 4 test cases) |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.tsx` | 加 R2 PUT response check |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/Preview/Preview.tsx` | 加 onError fallback + loadErrorLabel prop |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/Preview/Preview.test.tsx` | NEW (~106 行, 4 test cases) |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts` | loadSettings bump version when key loaded |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.test.ts` | NEW (~121 行, 4 test cases) |
| `apps/frontend/src/i18n/locales/logoUpload.zh-TW.ts` | +loadError key |
| `apps/frontend/src/i18n/locales/logoUpload.en.ts` | +loadError key |
| `apps/frontend/src/i18n/locales/iconUpload.zh-TW.ts` | +loadError key |
| `apps/frontend/src/i18n/locales/iconUpload.en.ts` | +loadError key |

## Self-improvement

### 衍生的 pending action

- [ ] **Phase 2 evidence request**（已在 Phase 2 feedback 紀錄）：若使用者仍看到破圖，需要 DevTools Network tab 截圖確認是 404 / 204 / CORS / cache
- [ ] **PushNotificationMockup.test.tsx sync**（pre-existing 5 errors）：測試用 `title`/`body`/`iconUrl` props，但 component 改用 `iconImage`/`iconImageVersion`/`issuerName` → 需要 sync 測試 props

### 寫進 INDEX.md（待補）

詳見 `runs/improvements/INDEX.md`（待加 row）。

---

> 撰寫者：Cursor Agent + Josh ｜ 時間：2026-08-31
