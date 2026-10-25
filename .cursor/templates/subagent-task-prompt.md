# Subagent Task Prompt 模板（可重複使用）

> 配套規則：`.cursor/rules/038-context-budget-discipline.mdc` § 4（subagent 派工紀律）
>
> 核心原則：**Task prompt 禁止貼檔案內容**，只給「路徑 + 行號範圍 + 要回答的具體問題」。

---

## 模板

```markdown
### 任務目標
<1–3 句。說清楚「要產出什麼」或「要回答什麼問題」。不要寫過程、不要寫背景故事。>

### 背景與關鍵決策
<= 10 行。只放 subagent 沒有它就會做錯的資訊。
- <關鍵決策 1 + 出處（Decision Log / DEV LOG 路徑）>
- <關鍵決策 2>
- <已知陷阱（如果有）>

### 相關檔案
只列路徑 + 行號範圍，不要貼內容。
- `apps/backend/src/modules/pass-templates/services/passValueService.ts:120-260`
- `packages/shared/logic/passExpiry.ts:280-420`

### 明確不做的事（out of scope）
- 不要讀整個 repo / 沒有列在上面的檔案不要 Read
- 不要修改任何檔案（除非本任務明確授權）
- 不要執行 `npm install` / `build` / `deploy`
- <任務特有的排除項>

### 預期回傳格式
- 回什麼：<例如「最多 5 條問題」/「一個 diff patch」/「一段 20 行內的結論」>
- 格式：<例如「每條：行號 → 問題 → 建議」/「一個 markdown code block」>
- 長度上限：<例如 30 行>

### 驗證方式
- 跑：`<指令>`（例如 `npm run test --workspace=apps/backend -- passValueService`）
- 貼：<例如「貼測試結果最後 10 行」/「貼 exit code」>
```

---

## 範例 A — Backend 服務實作類

```markdown
### 任務目標
在 `passValueService.ts` 新增 `computeRuntimeValues()` 函式，負責把模板的 runtime value 欄位（`validDays`、`isPaid`、`expiryDate`）依 `passExpiry` 規則算出實際值。

### 背景與關鍵決策
- 決策：runtime value 不在 DB 存，改由服務端即時計算。
  詳見 `runs/decisions/2026-10-24-pass-runtime-value-model.md`
- 決策：付費會員到期日 = 購買日 + `validDays`；免費卡沿用模板 `expiryDate`。
- 陷阱：`packages/shared/logic/passExpiry.ts` 已有 `calculateExpiry()`，不要重寫一份。
- 陷阱：後端 jsonb 更新一律用 `sql.json()`，不要手動 `JSON.stringify` + `::jsonb`
  （見 `.cursor/rules/027-postgres-dynamic-query-pattern.md`）。

### 相關檔案
- `apps/backend/src/modules/pass-templates/services/passValueService.ts:1-120`（既有 service 風格參考）
- `packages/shared/logic/passExpiry.ts:280-420`（到期規則實作，不要重寫）
- `packages/shared/schemas/passValues.ts:1-185`（zod 契約）

### 明確不做的事（out of scope）
- 不要修改 `packages/shared/` 下的任何檔案（只讀）
- 不要修改 `passExpiry.ts`
- 不要新增 DB migration
- 不要讀整個 repo
- 不要執行 `npm install` / `build` / `deploy`

### 預期回傳格式
- 回什麼：實作完成的 `computeRuntimeValues()` 函式 + 一份對應的 Vitest 測試檔
- 格式：修改摘要（檔案路徑 + 新增函式簽名 + 測試案例清單）+ 測試檔全文（≤ 120 行）
- 長度上限：150 行

### 驗證方式
- 跑：`npm run test --workspace=apps/backend -- passValueService`
- 貼：測試結果最後 10 行（含 `Test Files` / `Tests` 統計）
```

---

## 範例 B — Bug 調查類

```markdown
### 任務目標
調查「註冊流程在 validDays 為 0 時會算出不合理到期日」這個現象，找出根因是哪一行造成的。

### 背景與關鍵決策
- 現象：`registerService` 帶 `validDays: 0` 的模板註冊後，到期日變成 1970 年。
- 已知：`packages/shared/logic/passExpiry.ts` 對 `validDays <= 0` 的分支行為**未經確認**。
- 注意：不要順手修 bug —— 本任務只定位根因，修改授權由 parent agent 決定。

### 相關檔案
- `packages/shared/logic/passExpiry.ts:280-420`（到期日計算）
- `apps/backend/src/modules/pass-templates/services/registerService.ts:180-320`（註冊流程組裝處）
- `apps/backend/src/modules/pass-templates/tests/register.runtimeValues.test.ts:1-120`（既有測試涵蓋範圍）

### 明確不做的事（out of scope）
- 不要修改任何檔案
- 不要讀整個 repo / 不要讀 `node_modules/`
- 不要執行 `npm install` / `build` / `deploy`
- 不要提出與 validDays 相關以外的假設

### 預期回傳格式
- 回什麼：根因位置（檔案 + 行號）+ 觸發條件 + 建議修法
- 格式：3 段 —— `根因`（1–3 行）/ `證據`（引用具體行號與值，最多 5 行）/ `建議修法`（最多 5 行）
- 長度上限：40 行

### 驗證方式
- 跑：`npm run test --workspace=apps/backend -- register.runtimeValues`
- 貼：失敗測試名稱 + 期望值 vs 實際值（最多 10 行）
```

---

## 使用前檢查

派工前逐條確認：

- [ ] prompt 裡沒有貼任何檔案內容
- [ ] 每個檔案都附上行號範圍
- [ ] 任務是**單一封閉目標**（一個函式 / 一個假設 / 一個檔案）
- [ ] 有寫「不要讀整個 repo」
- [ ] 有寫「不要修改 X」（或明確授權）
- [ ] 預期回傳有**長度上限**
- [ ] 驗證指令明確指定（不是「跑測試看看」）
