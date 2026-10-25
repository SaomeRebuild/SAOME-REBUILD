# Card Builder step 8 進度文字顯示 i18next 錯誤字串（object-valued key）

- 日期：2026-10-26
- 範圍：純前端（1 個 component + 1 個既有 test + 1 個新 test + 1 個 i18n 驗證腳本）。沒有 locale 檔變更、沒有 backend 變更、沒有 DB migration。
- 症狀：`key 'steps.save (zh-TW)' returned an object instead of string. (8/8)`
- 對應計畫：`C:\Users\user\.cursor\plans\fix-steps-save-i18n-object-key_7cd04d42.plan.md`

---

## 1. 背景

user 回報 Card Builder 的步驟指示器在第 8 步顯示：

```
key 'steps.save (zh-TW)' returned an object instead of string. (8/8)
```

這是 i18next 內部的錯誤字串，不是文案。翻譯本身存在（`cardEditor.steps.save.title` 在 zh-TW 是「儲存並發布」、en 是「Save & Publish」），問題出在 **key 指向的值是一個 object，不是一個 string**。

---

## 2. 根因

### 2.1 直接根因：locale key 從 scalar 改成 object，consumer 沒跟著改

commit `64e06b5`（2026-10-06，`feat(cardbuilder): add Step 8 Save & Publish`）把 `cardEditor.steps.save` 在 **zh-TW 與 en 兩檔**都從平面字串（`save: '保存'`）改成巢狀物件：

```ts
save: {
  title: '儲存並發布',
  summary: '請確認以下資訊',
  publish: '儲存並發布',
  back: '返回模板庫',
  publishSuccess: '卡片已發布',
  publishError: '發布失敗,請稍後再試',
  // ... 更多 Step 8 子 key
},
```

而 `CardBuilderEditorSteps.tsx`（最後一次被 `ec21274` 動過，早於 `64e06b5`）的 step 8 指標仍指向舊的 scalar 路徑：

```ts
const STEP_KEYS: Array<{ key: EditorStep; labelKey: string }> = [
  // ...
  { key: 8, labelKey: 'steps.save' },   // ← 已經是 object 了
];
```

i18next 預設 `returnObjects: false`，遇到 object-valued key 就 fallback 成字串 `key 'steps.save (zh-TW)' returned an object instead of string.`（i18next `dist/cjs/i18next.js:620`），訊息格式與 user 回報完全一致，連 `(zh-TW)` 後綴都對得上。

### 2.2 Blast radius：同一個檔案的 2 個 render site

| 位置 | 影響 |
|---|---|
| 進度文字 `{t(STEP_KEYS[currentStep - 1].labelKey)} ({currentStep}/8)` | 只有 `currentStep === 8` 壞掉 → 這就是回報裡的 `(8/8)` |
| 每顆 pill 的 `title={t(step.labelKey)}` | 8 顆 pill **無條件** render，所以 step 8 的 tooltip 在**任何步驟**都是壞的 |

### 2.3 為什麼三道關卡都沒抓到

| 關卡 | 為什麼漏掉 |
|---|---|
| `apps/frontend/scripts/verify-i18n-keys.mjs` | 只稽核 **locale 檔本身**（跨 locale key 對齊、namespace 前綴、語言純度、空值），從來不檢查「**程式碼引用的 key** 解析出來是不是 leaf string」 |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.test.tsx` | mock `react-i18next` 為 `t: key => key` → `t('steps.save')` 回傳字串 `'steps.save'`，object/string 的差別完全不可見。既有斷言 `getByTitle('steps.save')` 反而把錯誤狀態**鎖成預期值** |
| `apps/frontend/src/test/setup.ts` | 全域 stub `@/i18n` 為 `t: (key) => key`，同樣的理由 |

---

## 3. 修法

### 3.1 讓 step 指標指向 leaf key

`CardBuilderEditorSteps.tsx` step 8 的 `labelKey` 從 `'steps.save'` 改成 `'steps.save.title'`。

- `steps.save.title` 在兩個 locale 都已存在（`'儲存並發布'` / `'Save & Publish'`），**不需要改 locale 檔、不需要新增 key、不需要 migration**。
- steps 1-7 不動，它們的 leaf key 沒有被重構過。
- step 8 的 pill tooltip 與進度文字共用同一個 `labelKey`，一次修好兩個 render site。

考慮過改成 `'step8.title'`（也是 leaf，值為「保存」/「Save」），但那個 key 目前沒有任何 consumer 引用，而 `steps.save.title` 跟 Step 8 面板標題（`Step8Save/index.tsx:52` 用 `t('steps.save.title')`）一致，pill tooltip 跟頁面標題會講同一句話。

### 3.2 補上靜態守門：Check 6「程式碼引用的 key 必須解析成 leaf string」

`verify-i18n-keys.mjs` 新增 Check 6：

1. 用既有的 `parseLocale` 解析每個 locale 檔，算出每個 namespace 的 **object-valued path 集合**（leaf 的父層）。
2. 掃 `apps/frontend/src/**`（排除 `*.test.ts` / `*.test.tsx`），從 `useTranslation('ns')` / `useTranslation(['ns1','ns2'])` 推斷每個檔案可用的 namespace。
3. 收集候選 key literal：`t('...')` 的引數、`*Key: '...'` 形式的資料結構欄位值。
4. 若候選 key 在該 namespace 解析成 object-valued path → **fail**，印出檔案 + key + 該 object path。

守門的範圍是「object-valued path」，不是「missing key」—— missing key 會 render 成 key 字串本身，這是有聲的失敗，i18next fallback 已處理。

這個 check 直接跑在既有的 gate 上：`npm test` 與 `npm run build` 都會先跑 `node scripts/verify-i18n-keys.mjs`，CI 也跑 `npm test --workspace=apps/frontend`。

**守門有效性已驗證**：把 `labelKey` 暫時改回 `'steps.save'` 重跑腳本，腳本確實 fail 並指名 `CardBuilderEditorSteps.tsx` 與 `steps.save`；還原後通過。（守門如果抓不到原本的 bug，就是無效的守門。）

### 3.3 回歸測試用「真實 i18n 資源」而不是 key-echo mock

新增 `CardBuilderEditorSteps.test.tsx`（這個 component 原本沒有專屬測試檔），用 `I18nextProvider` + `@/test/i18n` 的**真實** `cardEditor` 資源斷言三件事：

1. step 8 進度文字 render 出翻譯字串 + ` (8/8)`，且不含 `returned an object instead of string`。
2. 8 顆 pill 的 tooltip 全部是字串（不是只有 step 8）。
3. step 8 畫面任何位置都不含 i18next 的 object-key 錯誤字串。

**關鍵設計**：這支測試刻意**不**用 `t: key => key` 的 mock。那種 mock 對任何輸入都回傳 key 本身，無法分辨 leaf key 與 object-valued key —— 正是讓這次 bug 溜過去的盲點。用真實資源時，object-valued key 會解析成 i18next 的錯誤字串，斷言才抓得到。

同時更新 `CardBuilderEditor.test.tsx` 既有斷言：step 8 tooltip 的 title 從 `'steps.save'` 改成 `'steps.save.title'`。

### 3.4 同類 bug 掃描：乾淨

掃過全部 21 個 namespace、每個非測試 source 檔，涵蓋 4 種引用型態：直接 `t()` 呼叫、namespace 前綴呼叫（`i18n.t('cardEditor:steps.save.publishError')`）、多 namespace 陣列形式（`useTranslation(['cardEditor', 'tableCard'])`）、以及存在資料結構裡的動態 key 字串。**全 repo 只有 `CardBuilderEditorSteps.tsx` / `steps.save` 一處命中**，沒有第二個同類 bug。

---

## 4. 學習

### 4.1 「key 從 scalar 變 object」是一次靜默的 API break

i18n 的 key 沒有型別系統保護。把 `save: '保存'` 改成 `save: { title, publish, ... }` 在 locale 檔看起來只是「多寫了幾個 key」，但對所有引用 `steps.save` 的 consumer 來說，這個 key 的**型別變了**。舊 consumer 不會報錯、不會 typecheck fail，只會 render 出一個錯誤字串。

**未來 invariant**：locale 檔裡任何一個 key 從 leaf 改成 object（或反過來）時，**必須**在同一個 commit 找出並更新所有引用該 key 的 consumer。`verify-i18n-keys.mjs` Check 6 從此會在 CI 層擋下漏網的那一些。

### 4.2 `t: key => key` 的 mock 會讓整類 bug 不可見

SAOME 的前端測試大量使用 `vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }))` 這種 mock。它讓「key 有沒有翻譯」這件事在測試裡永遠是 yes，因此**沒有任何一條測試能區分 leaf key 與 object-valued key**。

**未來 invariant**：任何要驗證「翻譯真的解析成預期字串」的測試，**必須**掛 `I18nextProvider` + 真實 locale 資源。key-echo mock 只能用於「測試呼叫了哪個 key」這類斷言，不能用於「key 解析成什麼」。

### 4.3 靜態守門要有「守門本身的有效性」測試

新增任何靜態檢查，都必須先確認它在**原始 bug 存在時會 fail**。本次做法是：暫時把 `labelKey` 改回 `'steps.save'` → 跑腳本 → 確認 fail 且指名正確 → 還原。一個永遠 pass 的守門比沒有守門更危險，因為它會給人「已經防住了」的假安全感。

### 4.4 「locale 檔稽核」與「程式碼引用稽核」是兩件不同的事

`verify-i18n-keys.mjs` 原本是一份**locale 檔品質**稽核（key 對齊、語言純度、空值）。它做得很好，但它的視野完全侷限在 locale 檔內 —— 一個 key 在 locale 檔裡完全合法（兩邊都是 object、key set 一致），問題出在**程式碼引用它的那一行**。這兩種稽核的邊界要在設計時就分清楚。

---

## 5. 驗證

| 項目 | 指令 | 結果 |
|---|---|---|
| i18n 守門（含新 Check 6） | `npm run verify:i18n`（apps/frontend） | OK — 21 namespace / 42 locale file 通過 |
| 守門有效性 | 暫時還原 `labelKey: 'steps.save'` 重跑 | **fail** 並指名 `CardBuilderEditorSteps.tsx` / `steps.save` → 還原 |
| 新回歸測試 + 既有測試 | `npx vitest run CardBuilderEditorSteps.test.tsx CardBuilderEditor.test.tsx` | 2 檔 / 12 條全綠 |
| 回歸測試有效性 | 暫時還原 `labelKey: 'steps.save'` 重跑 | 3 條新測試全數 fail → 還原 |
| TypeScript | `npx tsc -b --noEmit`（apps/frontend） | exit 0，無錯誤 |
| Lint | `npm run lint`（apps/frontend） | exit 0；僅既有 warning（`no-unused-vars` × 2 為 HEAD 既有、`only-export-components` 等），本次改動未新增 |
| 完整前端測試套件 | `npm test`（apps/frontend） | 153 檔 / 2075 條全綠（第三次執行；見下方「已知 flaky」） |

### 已知 flaky：完整套件偶發 timeout 型失敗

完整套件（153 檔）並行跑時，偶發出現跨檔的 `STACK_TRACE_ERROR` timeout（觀察到 2 條、13 條兩種數量，失敗檔為 `LoginForm` / `RegisterForm` / `PassHolderRegistration` 等與本次改動無關的檔案）。

判定為**環境資源競爭**而非本次改動引入，證據：

1. 這些檔案**單獨跑全綠**（`npx vitest run src/components/business/auth/... src/components/business/pass/PassHolderRegistration` → 7 檔 / 87 條全綠；`npx vitest run src/components/business/pass` → 7 檔 / 131 條全綠）。
2. **同一份程式碼連續兩次跑完整套件結果不同**：一次 13 條失敗、下一次 0 條失敗。
3. 失敗點是 timeout 型 `STACK_TRACE_ERROR`（非斷言不符），且發生時主機 CPU 100%、僅剩約 1.7GB 可用記憶體、背景有多個殘留的 node / wrangler 行程。

**未來 invariant**：完整套件的失敗若集中在與本次改動無關的檔案、且錯誤型態是 timeout 而非 assertion，先用「該檔單獨跑 + 同程式碼重跑一次」排除 flaky，再談真正的 regression。不要把負載型 timeout 誤判成自己引入的 regression。

---

## 6. Scope

- 改檔：`CardBuilderEditorSteps.tsx`（1 行 labelKey + docblock 改英文）、`CardBuilderEditor.test.tsx`（1 條斷言）、`verify-i18n-keys.mjs`（新增 Check 6）
- 新檔：`CardBuilderEditorSteps.test.tsx`、本 feedback 檔、INDEX.md 一列
- **0 locale 檔變更、0 backend 變更、0 DB migration（Rule 035 不觸發）、0 config / package.json 變更（Rule 016 不觸發）**
