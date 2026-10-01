# Feedback: Pass Holder 公開頁三 bug 同修（Q1+Q2+Q3）

**日期**: 2026-10-01
**作者**: SAOME-REBUILD
**前置**: runs/decisions/2026-10-01-pass-templates-public-logo-proxy.md（Q1 logo + Q2 UUID zod parse）
**範圍**: L2 Standard — public `/pass/:templateId` 頁面 i18n / validation / route pattern

---

## 背景

Q1+Q2（logo + UUID zod parse）commit `7c4c355` 部署後，使用者測試公開 `/pass/{templateId}` 頁面（template ID `b5541307-78c8-4caf-b295-2a39de1590fa`,DB 存 `language: 'en'`），又回報三個 bug。

---

## 三個 bug 各自根因

### Q1 — `/pass/:abc`（字面冒號）到 Coming Soon(非 bug,user confusion)

**症狀**: `/pass/b5541307-...` 有畫面，`/pass/:b5541307-...`(字面冒號前綴)到 Coming Soon。

**根因**: React Router v6 的 `:` 是 route pattern 語法,不是 URL 的一部分。`App.tsx` 定義的 `/pass/:templateId` 對應的 URL 是 `/pass/<value>`（無冒號）。當 user 把 route definition 整段貼到網址列,加了字面 `:`，這個 URL 在瀏覽器裡不匹配任何 route,走到 wildcard 404 → Coming Soon。

**修法**: 不改 code（這是 React Router 預期行為）。加 2 條 regression test:
- `PassHolderRegistrationPage.test.tsx::Q1: matches /pass/{uuid} (no colon prefix) and renders the form`
- `PassHolderRegistrationPage.test.tsx::Q1: shows not-found for /pass/:abc (literal colon prefix in URL — user confusion case)`

並在 `PassHolderRegistrationPage.tsx` 的 JSDoc 寫明「`:templateId` 是 pattern marker,不是 URL 字元」的對應關係,避免後續 refactor 誤判。

### Q2 — DB 存 en 卻顯示中文

**症狀**: 模板 DB 存 `language: 'en'`,但 `/pass/{templateId}` 頁面的標題、表單 label、placeholder 都是中文。

**根因**: `apps/frontend/src/i18n/index.ts::getInitialLanguage()` 只看 localStorage 或 browser language,**完全沒讀 template.language**。`PublicPassTemplate` DTO 也沒有 `language` 欄位,所以前端就算想讀也讀不到。

**修法(選項 a)**:
1. 四層同步加 `language` 欄位（Rule 019 § 4.1）:
   - Layer 1: `packages/shared/types/passHolder.ts::PublicPassTemplate` 加 `language: CardLanguage`
   - Layer 2: `apps/backend/src/shared/contracts/passTemplates.ts::PublicPassTemplateDto` 加 `language: CardLanguage`
   - Layer 3: `apps/backend/src/modules/pass-templates/db/templates.ts` 兩個 row interface 都加 `settings.language?: CardLanguage`
   - Layer 4: `apps/backend/src/modules/pass-templates/services/getPublicService.ts` 兩個 service 都加 `language: settings.language ?? 'en'`
2. 新 helper `applyPageLanguage(lang)`（只 call `i18n.changeLanguage`,**不寫 localStorage**,避免污染用戶登入後偏好）
3. `PassHolderRegistrationPage.tsx` 載入成功後 call `applyPageLanguage(template.language)`
4. 8 個 mock `SAMPLE_TEMPLATES` 補 `language: 'en'`
5. Conformance test 同步 pin 4 層(Q2 regression)

**為何選 a 不選 b/c**:
- b: 讓用戶瀏覽器偏好覆蓋 template 設定 → user 期望「DB 存 en 就該顯示英文」,b 直接違反
- c: 加語言切換器讓訪客選 → YAGNI,目前沒看到訪客主動切換的需求,徒增 UI 複雜度

**fallback 設計**: `settings.language ?? 'en'`。理由:既有 draft 模板可能沒 language 欄位(migration 在 2026-09-29 才把 `language` 加進 settings,但 settings 是 JSONB 沒強制 schema),fallback 到 `'en'` 比 `'zh-TW'` 安全 — 若 fallback 錯了,en 用戶看到英文還是讀得懂,zh-TW 用戶看到英文體驗雖差但不至於壞掉(他們可以點 dashboard 切換)。

### Q3 — 驗證紅字顯示 raw i18n key

**症狀**: 欄位驗證錯誤時,紅字顯示 `passHolder.validation.nameRequired` 等 raw key,不是翻譯文字。

**根因**: `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.hooks.ts` 的 zod schema 用**全路徑**當 error message:
```ts
.min(1, 'passHolder.validation.nameRequired')
```

但 `PassHolderRegistrationForm.tsx` 用 `useTranslation('passHolder')` 綁 namespace 後,`t(errors.name.message)` 內部會去 `passHolder` namespace 內找 literal key `passHolder.validation.nameRequired` —— **找不到**,因為實際翻譯檔的結構是:
```ts
validation: {
  nameRequired: 'Please enter your name',
}
```

i18next 找不到時 fallback 到 raw key 顯示。`useTranslation('passHolder')` 已綁 namespace,理論上應該傳相對 key `'validation.nameRequired'` 才對。

**修法**: 把 zod 的 7 個 i18n key 從 `passHolder.validation.*` 改為 `validation.*`（相對路徑）。`t('validation.nameRequired')` 在 namespace `passHolder` 內會直接命中 → 翻譯成功。

**對比 RegisterForm**: `apps/frontend/src/components/business/auth/RegisterForm/RegisterForm.tsx::translateFieldError` 用 `t(message, message)` 形式（傳原始 key 當 fallback value）。這招能 work 是因為 `useTranslation('auth')` + `t('validation.email', 'validation.email')` — `validation.email` 是 `auth` namespace 內的相對 key,找得到。PassHolder 表單是 `t(errors.name.message)` 沒帶 fallback,如果 key 是全路徑就會 fail。

---

## 為何這三個 bug 一起修

表面無關但其實是同一個 anti-pattern cluster:**「public endpoint 沒做好輸入驗證 + 沒保護設定輸出 + 沒對齊 schema」**。

| Bug | 維度 | 共同主題 |
|---|---|---|
| Q1 | URL pattern 文法 | Public endpoint 介面沒寫清楚 |
| Q2 | i18n 設定 | template 設定(DB)→ DTO → frontend 三層漏接 |
| Q3 | i18n key 解析 | zod schema vs `useTranslation(ns)` namespace-prefix 重複 |

修方案走「四層同步 + 文檔化 + 隔離 helper」,避免後續其他 public endpoint 重蹈覆轍。

---

## 後續可改進項

| 改善 | 為何暫不做 |
|---|---|
| 在 shared schema 把 `language` 設為 required + 加 DB migration CHECK | 目前 5 個 demo 模板的 settings 沒 language,改 required 會爆;先 optional + fallback |
| 提供語言切換器(Option B) | 目前 user 已選 Option A,YAGNI |
| 把 `getInitialLanguage()` 改成可選「per-route 語系覆寫」API | 等 public endpoint 數量 > 3 再抽 helper,目前一個 page 寫死 OK |

---

## Decision Log

`runs/decisions/2026-10-01-pass-holder-language.md`(pending,Step 12 verify 之後寫): Q2 的選項 a + 為何 override language 只在 public page 生效(不寫 localStorage)。

---

## 必須跑的 rule checklist

- Rule 019 § 4.1 layer 4 同步(shared → contract → db row → service param)
- Rule 019 § 3 conformance test
- Rule 006 § 驗證清單(typecheck + test)
- Rule 011 § DEV LOG + feedback 同 commit
