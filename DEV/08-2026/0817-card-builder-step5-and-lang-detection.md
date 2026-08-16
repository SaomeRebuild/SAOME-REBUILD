# 0817 CardBuilder Step 5 + Browser Language Detection

## Metadata

- **日期**：2026-08-17
- **作者**：Cursor Agent
- **規則 / skill 觸發**：`saome-dev-logging`、`saome-task-router`（L2）

---

## 任務 1：CardBuilderEditor — 新增 Step 5「客製化桌牌」

### 背景

CardBuilderEditor 原本只有 5 步（選擇類型 → 設定 → 設計 → 資訊 → 保存），業務需求在中間新增「客製化桌牌」步驟。

### 變更

| 檔案 | 變動 |
|------|------|
| `CardBuilderEditor.types.ts` | `EditorStep` 從 `1\|2\|3\|4\|5` → `1\|2\|3\|4\|5\|6` |
| `CardBuilderEditorSteps.tsx` | `STEP_KEYS` 第 5 步改為 `customizePlaceCard`，新增第 6 步 `save` |
| `CardBuilderEditorWorkspace.tsx` | 拆分 Step 2-4（通用預留）、Step 5（客製化桌牌）、Step 6（保存）各自獨立區塊 |
| `cardEditor.zh-TW.ts` / `en.ts` | 加入 `steps.customizePlaceCard`、`step5.title`、`step6.title` |
| `CardBuilderEditor.test.tsx` | 測試從 `renders all 5 steps` → `renders all 6 steps` |

### 驗證

- TypeScript check: exit 0
- CardBuilderEditor unit tests: 9/9 passed

---

## 任務 2：Browser Language Detection — 為 Unauthenticated User 自動偵測語言

### 背景

修好 i18n localStorage 持久化後，未登入訪客（無 localStorage 語言偏好）預設語言仍是 `'zh-TW'`。需要從瀏覽器語言設定自動偵測。

### 變更

新增 `packages/shared/i18n/`：

- `detectLanguage.ts`：純函式，讀 `navigator.languages[0]` 與 `navigator.language`，fallback 為 `'zh-TW'`
- `detectLanguage.web.ts`：Vite 自動選擇的 browser shim（移除 test env guard）
- `index.ts`：barrel export

Frontend config 更新：

- `vite.config.ts`：加 `zustand` + `@saome/shared/i18n/detectLanguage` aliases
- `vitest.config.ts`：同上
- `test/setup.ts`：設 `process.env.TEST_LANG='zh-TW'` 覆寫 jsdom 的 `navigator.language='en'`
- `i18n/index.ts`：`getInitialLanguage()` 改呼叫 `detectDeviceLanguage()`

### 驗證

- TypeScript check: exit 0
- i18n verify script: 12 namespaces passed

---

## 衍生待辦

- [ ] 表單 autofill 跟 schema drift 的 smoke test probe 尚未寫完（`tests/probe/` 有佔位檔）

---

## 自問

- **這次學到什麼？**
  1. 多步驟 UI 新增步驟時，要把「預留」區塊拆分乾淨，避免多個 step 共享同一個 conditional block
  2. `detectDeviceLanguage` 在 jsdom 環境預設 `en`，unit test 必須有 override mechanism

- **下次怎麼不犯？**
  1. Step 變更時，先更新 `EditorStep` type，再更新 `STEP_KEYS`，最後更新 workspace 的 conditional rendering，三個地方要一起改
  2. Browser 偵測 utility 要區分「在 browser 執行時的實作」與「在 test jsdom 環境的 fallback」

> 撰寫者：Cursor Agent ｜ 時間：2026-08-17
