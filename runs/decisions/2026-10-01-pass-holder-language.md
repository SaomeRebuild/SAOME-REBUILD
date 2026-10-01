# Decision: Pass Holder 公開頁語系覆寫 (template.language → page i18n)

**日期**: 2026-10-01
**作者**: SAOME-REBUILD
**Scope**: L2 Standard（public `/pass/:templateId` 頁面 i18n + zod validation key 重整 + route pattern 文檔化）
**前置**: [runs/decisions/2026-09-29-pass-templates-public-endpoint.md](2026-09-29-pass-templates-public-endpoint.md)
**Feedback**: [runs/improvements/feedback/20261001-pass-holder-language-and-validation.md](../improvements/feedback/20261001-pass-holder-language-and-validation.md)

---

## 背景

`runs/decisions/2026-10-01-pass-templates-public-logo-proxy.md`（Q1 logo + Q2 UUID zod parse）部署後，使用者測試 `https://saome-frontend.josh1989213.workers.dev/pass/b5541307-78c8-4caf-b295-2a39de1590fa`（template ID,DB 存 `language: 'en'`）時回報三個新 bug：

| # | 症狀 | 真正原因 |
|---|---|---|
| **Q1** | `/pass/:b5541307-...`(字面冒號)到 Coming Soon | React Router v6 的 `:` 是 pattern 語法,不是 URL 字元;`/pass/:templateId` 對應的 URL 是 `/pass/<value>` 無冒號 |
| **Q2** | DB 存 `language: 'en'`,頁面標題 / 表單 label / placeholder 都還是中文 | `getInitialLanguage()` 只看 localStorage / browser locale,**沒讀 template.language**;`PublicPassTemplate` DTO 也沒 `language` 欄位 |
| **Q3** | 欄位驗證紅字顯示 `passHolder.validation.nameRequired` 等 raw i18n key | zod 用全路徑當 error message,但 `useTranslation('passHolder')` 已綁 namespace → `t('passHolder.validation.nameRequired')` 在 namespace 內找 literal key 找不到 → fallback 顯示 raw string |

---

## 選項與決定

### 1. Q2 語系來源 — template.language vs browser locale vs 訪客切換

| 候選 | 設計 | 採納 |
|---|---|---|
| **A** | 頁面 i18n 由 DB 模板 `language` 決定（user 已確認）| ✅ A |
| B | 沿用 `getInitialLanguage()`（localStorage / browser）| ❌ |
| C | 加語言切換器讓訪客自己選 | ❌ YAGNI |

**決定**: **A** — 業務語境是「商家發卡的模板面向終端用戶」,商家把模板設成 en,訪客看到 en 才符合商家期待。B 直接違反用戶期望;C YAGNI（目前沒觀察到訪客主動切換需求）。

**關鍵設計**: 新 helper `applyPageLanguage(lang)` 只 call `i18n.changeLanguage(lang)`,**不寫 localStorage**。理由：若用 `setLanguage()`（會寫 localStorage）,匿名訪客瀏覽一次 `/pass/...`,之後登入 dashboard 會被鎖死在 template 的語系 → 體驗炸掉。

### 2. Q2 `language` 欄位 optional vs required

| 候選 | 設計 | 採納 |
|---|---|---|
| **1** | optional + `settings.language ?? 'en'` fallback | ✅ 1 |
| 2 | required + migration 強制 NOT NULL | ❌ |

**決定**: **1** — 既有 draft 模板（DB 中既有 5+ 個 demo）的 settings 沒 `language` 欄位（migration 在 2026-09-29 才把 language 加進 settings JSONB key,但 settings 沒強制 schema）。改 required 會讓既有 demo 全部爆 500。**先 optional + fallback,等所有 demo 修完再改 required**。

**fallback 為何是 `'en'` 而非 `'zh-TW'`**: en 是國際 fallback,即使 fallback 錯了,en 用戶看到英文仍可讀;zh-TW 用戶 fallback 到英文雖 UX 較差但不至於壞掉（他們之後可進 dashboard 切換）。這跟 i18next `fallbackLng: 'en'` 一致。

### 3. Q3 zod error keys — 全路徑 vs 相對路徑

| 候選 | 設計 | 採納 |
|---|---|---|
| 1 | zod key 改相對路徑（`validation.nameRequired`）| ✅ 1 |
| 2 | `useTranslation()` 不綁 namespace,key 維持全路徑 | ❌ 違背 Rule 023 § i18n namespace 元件化 |
| 3 | zod 端呼叫 `t(key)` 把 raw key 預翻成文字 | ❌ shared logic 不能 import i18n lib（Rule 023 § Shared Validation 用 i18n Key）|

**決定**: **1** — 對齊 `useTranslation('passHolder')` 已綁 namespace 的語意。`t('validation.nameRequired')` 會去 `passHolder.validation.nameRequired` 找 → 命中 → 翻譯成功。

**對比 `RegisterForm`**: `RegisterForm.tsx::translateFieldError` 用 `t(message, message)` 形式（傳原始 key 當 fallback value）。這招能 work 是因為 i18next 找不到 key 時 fallback 到第二參數。`PassHolderRegistration` 沒帶 fallback,所以 key 錯了就 fail。**未來新表單都應該用 `t(message, message)` pattern 防止 silent fail**。

### 4. Q1 route pattern 處理 — 修 code vs 文檔化

| 候選 | 設計 | 採納 |
|---|---|---|
| **1** | 不改 code,加 JSDoc + regression test 釐清 `:` 是 pattern marker | ✅ 1 |
| 2 | 把 `:` 從 URL 拿掉（如 `/pass/template/:id`）| ❌ |
| 3 | 在 router 加 fallback 把 literal colon 轉成空字串 | ❌ |

**決定**: **1** — 這是 React Router v6 預期行為,不是 bug。User 把 route definition 整段貼到網址列的字面 `:` 在瀏覽器裡不匹配任何 route,走到 wildcard 404 → Coming Soon。加 2 條 regression test 把這個行為 pin 死,並在 `PassHolderRegistrationPage.tsx` 的 JSDoc 寫明 `:templateId` 是 pattern marker,不是 URL 字元。

---

## 影響

### 4 層 schema 同步 (Rule 019 § 4.1)

| 層 | 位置 | 變更 |
|---|---|---|
| 1 | `packages/shared/types/passHolder.ts::PublicPassTemplate` | 加 `language: CardLanguage` |
| 2 | `apps/backend/src/shared/contracts/passTemplates.ts::PublicPassTemplateDto` | 加 `language: CardLanguage` |
| 3 | `apps/backend/src/modules/pass-templates/db/templates.ts` | 兩個 row interface 都加 `settings.language?: CardLanguage` |
| 4 | `apps/backend/src/modules/pass-templates/services/getPublicService.ts` | 兩個 service 都加 `language: settings.language ?? 'en'` |

conformance test 同步 pin 4 層（getPublic.test.ts::PublicPassTemplateDto schema conformance）。

### i18n helper 擴充（不改既有 `setLanguage`）

`apps/frontend/src/i18n/index.ts` 新 `applyPageLanguage(lang)`：
```ts
export function applyPageLanguage(lang: 'en' | 'zh-TW') {
  void i18n.changeLanguage(lang);  // in-memory only
}
```

理由：`setLanguage` 寫 localStorage,會污染登入後偏好。`applyPageLanguage` 只 call `i18n.changeLanguage`,page reload 自動 revert 到 persisted 偏好。

### 同步的測（9 條 new）

| 檔案 | 條數 | 覆蓋 |
|---|---|---|
| `PassHolderRegistrationPage.test.tsx` | 4 | Q1 (route pattern × 2) + Q2 (applyPageLanguage × 1, 不寫 localStorage × 1) |
| `PassHolderRegistration.test.tsx` | 2 | Q3 (空表單紅字不顯示 raw key) + Q3 (too-short name 顯示翻譯) |
| `getPublic.test.ts` | 3 | Q2 (settings.language → DTO.language + fallback × 2 + null settings × 1) |

### 既有系統不受影響

- `/pass/:templateId` route pattern 不變（Q1 是 user confusion,不是 route bug）
- `setLanguage()` 行為不變（dashboard / login / register 仍寫 localStorage）
- 後端 `findPublicTemplateById` / `findPublicTemplateWithTenantById` SQL 不變（settings 全欄位一次 SELECT,新增的 language 在既有 jsonb 內）
- Dashboard / Login / Register / CardBuilder 頁面 i18n 行為不變

---

## Future Reconsideration Trigger

| Trigger | 觀察方式 | 重新評估 |
|---|---|---|
| 業務決定 language 必須 required | Product 提「模板不能沒語系」| migration ALTER COLUMN + 改 `language: CardLanguage` 非 optional |
| 出現多個 public page 都要 per-page 語系覆寫 | 第 2 個 public page 落地 | 抽 `usePageLanguage(lang)` hook,內含 React effect 套用 + cleanup |
| 訪客手動切語言需求浮現 | Support ticket / Analytics | 評估 Option C（加切換器 UI）|

---

## 名詞解釋

- **template.language**: 模板 DB 設定欄位,商家發卡時指定的對外曝光語言（`zh-TW` / `en`）
- **applyPageLanguage**: i18n helper,只切換 in-memory 語系,不持久化
- **getInitialLanguage**: 既有 i18n helper,讀 localStorage 或 fallback 到 browser locale（用於 dashboard 等登入後頁面）
- **Conformance test**: Rule 019 § 3,驗證 Layer 1 (Shared) 跟 Layer 2 (Backend DTO) field set 一致的測試