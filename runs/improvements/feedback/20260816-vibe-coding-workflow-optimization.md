# 20260816 Vibe Coding 工作流優化

## Metadata

- **日期**：2026-08-16
- **類型**：Self-Improvement
- **觸發**：三次 i18n drift 任務迴圈
- **規則觸發**：`saome-dev-logging`、`saome-task-router`（L2）

---

## 背景

三次任務觀察：

| # | 任務 | 耗時問題 |
|---|------|----------|
| 1 | PassCardPreview i18n drift | `t('passCard.defaultName')` 變成 raw key，浪費 15-20 分鐘除錯 |
| 2 | PassCardPreview sub-component i18n | 同上 |
| 3 | TemplateCardPreview i18n | 同上 |

---

## 根因分析

### 根因 1：i18n 沒有元件化規則（最高優先）

**症狀**：`PassCardPreview` 勉強用 `cardBuilder` namespace，導致 `t('passCard.xxx')` 結構問題。

**根因**：`023-shared-package.mdc` 的 i18n 規範**從未定義元件化原則**。導致：
1. 新增 namespace 時，沒有判斷「放在 feature namespace 還是 component namespace」
2. 今天的 `passCard` namespace 其實是繞路：應該一開始就建立 component-bound namespace
3. `templateCard` namespace 從未建立，導致 `TemplateCardPreview` 可能也會踩同樣的坑

**修法**：
- 在 `023-shared-package.mdc` 加入「元件化原則」段落
- 明確定義「何時用 feature namespace vs component namespace」

### 根因 2：i18n key structure drift 無法在 unit test 發現

**症狀**：`passCard.zh-TW.ts` 是 flat key，但呼叫 `t('passCard.defaultName')`，變成 `passCard.passCard.defaultName`。

**根因**：
- Vitest + RTL 環境的 i18n 沒有正確初始化
- `src/test/i18n.ts` 缺少 `cardBuilder`、`cardEditor`、`passCard` 三個 namespace
- 導致 unit test 環境沒辦法抓到 drift

**修法**：
- 新增 `scripts/verify-i18n-keys.mjs` 在 CI 階段抓 drift
- 確保 `src/test/i18n.ts` 同步所有 namespace

### 根因 3：新增 namespace 沒有對照既有範例

**症狀**：`t('namespace.key')` vs `t('key')` 混淆。

**根因**：
- `023-shared-package.mdc` 沒有 checklist 強制對照既有範例
- Agent 每次都要自己摸索

**修法**：
- 在 namespace checklist 加入「對照 `auth`、`dashboard` 範例」

---

## 實作

### 1. 更新 `023-shared-package.mdc`

新增「元件化原則」段落與「新增 Namespace 的 Checklist」。

包含：
- 何時用 component namespace（跨 feature 重用）
- 何時用 feature namespace sub-key（單一 feature 專用）
- flat key 結構確認
- 同步 `src/test/i18n.ts`

### 2. 新增 `apps/frontend/scripts/verify-i18n-keys.mjs`

i18n smoke test script，檢測：
- namespace-prefixed values（HARD FAIL — 今天的根因）
- 缺少 locale 檔（HARD FAIL）
- cross-locale drift（WARN — 既有问题）

集成至 `package.json`：
```json
"verify:i18n": "node scripts/verify-i18n-keys.mjs",
"test": "node scripts/verify-i18n-keys.mjs && vitest run"
```

### 3. 新增 `025-vibe-coding-l2-checklist.mdc`

L2 元件建立清單，順序執行：
1. i18n（第一優先）
2. 元件結構
3. 測試覆蓋
4. Smoke Test

### 4. 普查既有 namespace

- `TemplateCardPreview` 已正確使用 `passCard` namespace ✅
- `cardBuilder`、`cardEditor` namespace 結構合理 ✅
- `src/test/i18n.ts` 已同步所有 namespace ✅

---

## 衍生待辦

- [x] `templateCard` namespace 缺失 → 確認已不需要（`TemplateCardPreview` 使用 `passCard`）
- [ ] `auth`、`landing`、`legal`、`passNotification`、`theme` namespace 的 cross-locale drift → 需後續整理

---

## 自問

- **下次怎麼不犯？**
  1. 建立 i18n 元件化規則（component-bound namespace）
  2. 新增 namespace 前對照既有範例（flat key）
  3. i18n smoke test 在 CI 階段抓 drift

- **哪條 rule 該補？**
  `023-shared-package.mdc` 的 i18n 段落，缺少「元件化原則」與「key structure checklist」。

- **哪個 test 該加？**
  i18n smoke test：驗證 production bundle 內每個 namespace 的 key 都可正確解析。

> 撰寫者：Cursor Agent ｜ 時間：2026-08-17
