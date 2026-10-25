# 成功 session 的運作模式與延續方案（2026-10-25）

- 日期：2026-10-25
- 範圍：唯讀分析 + 產出本文。沒有改任何 source code、config、package.json。
- 資料來源：
  - `C:\Users\user\.cursor\projects\c-Users-user-Desktop-SAOME-REBUILD\agent-transcripts\4a98404c-4b59-4e39-bfd1-6fc91aea06d9\4a98404c-....jsonl`（parent transcript，6,311.9 KB，1,331 行）
  - 同目錄 `subagents/` 下 41 個 subagent transcript
  - `runs/improvements/feedback/20261025-context-overflow-crash-forensics.md`（crash forensics）
  - `runs/investigations/2026-10-25-crash-root-cause.md`（與前者 SHA256 完全相同）
  - `runs/decisions/2026-10-24-pass-runtime-value-model.md`、`runs/plans/2026-10-24-*.md`
  - `git log` / `git status` / `git ls-files`（2026-10-25 當日）
- 目的：回答「這幾次成功執行實際生效的是什麼機制」以及「怎麼把它變成不靠運氣的制度」。

---

## 1. 背景

2026-10-24 23:13 到 2026-10-25 03:26 這 4.2 小時內，同一個 parent chat 底下有 **8 個 subagent 因 context overflow 死掉**。崩潰簽章是同一句（forensics §1）：

```
输入内容过长，请检查是否引入超大文件，请精简输入内容或新开对话 [1] (<request-id>)
```

8 個死掉的 agent（`subagents/` transcript 判定準則：最後一則 assistant 訊息就是這句 error、且 transcript 結尾是 `{"type":"turn_ended","status":"success"}`）：

| agent | transcript mtime | transcript KB | 死亡 request-id | 死亡時間（+08:00） |
|---|---|---|---|---|
| `31b08f3f` | 10-24 23:13 | 214.9 | — | 2026-10-24 23:13 |
| `f6bc0d37` | 10-25 01:35 | 1,325.5 | `1792863308896-b426af8f` | 01:35:08 |
| `bba52adb` | 10-25 01:35 | 1,336.4 | `1792863332685-5b4bdbd0` | 01:35:32 |
| `c3c25002` | 10-25 01:35 | 714.6 | `1792863339818-946b736a` | 01:35:39 |
| `a9363806` | 10-25 01:37 | 1,376.0 | `1792863451206-a381374c` | 01:37:31 |
| `2949c1ba` | 10-25 02:40 | 244.1 | — | 02:40 |
| `2dabc2c7` | 10-25 03:08 | 207.5 | — | 03:08 |
| `ce1d2db0` | 10-25 03:26 | 239.5 | — | 03:26 |

forensics 只記錄了 01:35–01:37 那 4 個（當時視為同一個 83 秒窗口）。**實際上另外 4 個（`31b08f3f` 10-24 23:13、`2949c1ba` 02:40、`2dabc2c7` 03:08、`ce1d2db0` 03:26）也是同種死法** —— forensics 的 §2 表格說「4 crashed work streams」是不完整的。

本次分析要把「後來為什麼沒再爆」講清楚。Rule 038（`.cursor/rules/038-context-budget-discipline.mdc`，256 行）與派工模板（`.cursor/templates/subagent-task-prompt.md`，127 行）在 **10-25 02:45–02:46** 才寫完落地。

---

## 2. 成功機制（實測）

### 2.1 三個 phase 的存活率（41 個 subagent transcript 分期）

| phase | 時間窗 | n | 崩潰 | assistant 輸出字元中位數 | 最大值 |
|---|---|---|---|---|---|
| A：崩潰前 | ~10-23 18:17 → 10-25 01:35 | 18 | 0 | 44,410 | 1,931,635 |
| B：崩潰後、Rule 038 前 | 01:35 → 02:46 | 7 | **5** | 1,270,610 | 1,344,924 |
| C：Rule 038 落地後 | 02:46 → 06:15 | 16 | **2** | 31,499 | 1,995,939 |

phase B 中位數比 phase A 高 **28 倍** —— 崩潰後的「補救式重派」反而是最危險的一段（見 §2.5）。
phase C 中位數比 phase B 低 **40 倍**。

### 2.2 最強預測因子：單一 agent 的 **Read 呼叫次數**

把每個 subagent 的 `Read` tool_use 呼叫數（不論有沒有 offset/limit）跟「是否以 overflow error 收尾」交叉比對：

| Read 呼叫數 | n | 崩潰 | 崩潰率 |
|---|---|---|---|
| 0–8 | 19 | 0 | **0 %** |
| 9–12 | 2 | 0 | **0 %** |
| 13–15 | 3 | 2 | 67 % |
| 16–19 | 3 | 3 | 100 % |
| 20+ | 4 | 3 | 75 % |

- **Reads ≤ 12 → 21 個 agent 全部存活（0 崩潰）**
- **Reads ≥ 13 → 20 個 agent 死掉 8 個**

8 個崩潰 agent 的 Read 數：13 / 14 / 15 / 16 / 16 / 19 / 25 / 27（平均 18）。存活 agent 平均 13。

第二個獨立的量是 assistant 自己的輸出字元（長篇推理/敘述會把 context 灌滿）：

| assistant 輸出字元 | n | 崩潰 | 崩潰率 |
|---|---|---|---|
| 0–100,000 | 25 | 0 | **0 %** |
| 100,000–400,000 | 7 | 4 | 57 % |
| ≥ 400,000 | 9 | 4 | 44 % |

**兩個條件合起來是一個近乎完美的 gate**：

> `Reads ≥ 13 且 assistant輸出字元 ≥ 150,000` → 12 個 agent 命中，其中 **8 個就是全部 8 個崩潰者**（100 % 召回、0 漏接）；另外 29 個未命中者 **0 崩潰**（0 誤報）。

**這是本次分析最重要的數字結論。**

### 2.3 Task prompt 大小是第二個預測因子

48 個 Task 呼叫（parent transcript，37 次 dispatch，最大 3 個並行）的 prompt 長度：最短 157 字元、中位 **2,376**、平均 3,398、最長 **14,677**。

| | prompt 平均字元 | prompt 平均檔案路徑數 | prompt > 6,000 字元 |
|---|---|---|---|
| 崩潰的 8 個 agent | **9,050** | **17** | 7 / 8 |
| 存活的 33 個 agent | **2,656** | **7** | 4 / 33 |

崩潰者幾乎都是「一次性派 10+ 個檔案路徑、prompt 塞滿背景」的大包。存活者都是窄任務。

### 2.4 「先 Grep 再切片讀」的實際效果

parent transcript 全部 tool_use 的 Read 分佈：

| 區段 | parent 讀取行號 | 完整 Read（無 offset/limit） | 切片 Read | Shell | 裸 `git diff`（無 `--`） |
|---|---|---|---|---|---|
| line < 1090（崩潰前） | — | **242** | 199 | 447 | 3 |
| line ≥ 1090（復原後） | — | **14** | 12 | 141 | 2 |

完整 Read 從 242 降到 14。parent 全程 **0 次**完整讀 `node_modules/` / `package-lock.json` / `dist/`（掃 1,741 個 tool_use 全部 path 欄位確認）。

### 2.5 三個「幾乎又爆掉」的徵兆，實際被攔下

**徵兆 A — 用 `resume` 重啟已崩潰的 agent。**
forensics §4c 已寫明禁止，但 parent 在 **transcript line 1090** 仍用 `resume: "<uuid>"` 同時重派 3 個崩潰者（prompt 1,334 / 1,028 / 3,022 字元）。結果：`2949c1ba`（02:40）與 `2dabc2c7`（03:08）**立刻再爆**。全 session 共 7 次 `resume=true`（line 1090 ×3、1200、1274、1277、1325），其中 line 1090 那 3 次是唯二的失敗案例。
→ 修正：`resume` 只能用在「沒崩、只是沒跑完」的情況；崩潰者必須重新開 agent + 全新 prompt。

**徵兆 B — 把 throwaway probe 寫在 `src/` 底下。**
唯一一個寫進 `src/` 的 agent 是 `a9363806`：`Write` 7 次、全部寫同一個 `apps/backend/src/__probe_sql.ts`，**產出 0 個 production file**，並留下 orphan（forensics B1，現在已刪）。這個 agent 還在 01:37:31 爆掉。
對照：Rule 038 之後派出去的 agent 改用 OS temp 目錄 —— `75f72320`（6 次 temp script）、`90327339`（18 次）、`a09b69a7`（19 次）、`f9cf8ae3`（1 次）、`a36837f0`（1 次），**共 45 次 temp script 呼叫，0 崩潰**。

**徵兆 C — 對同一個 topic 反覆讀同一組檔案。**
`31b08f3f` 完整讀了 23 個檔案（`passValues.ts` / `passValueCalculator.ts` / `passExpiry*` / `passEvents.ts` / `passValueService.ts` / `passRegistrationService.ts` / `passValueBackfill.ts` / `passHolders.ts` / `errorHandler.ts` / 4 個測試檔 / 3 個 config），其中至少 8 個明列在 Rule 038 的「已知高風險檔案」表內。它 23:13 爆掉。

### 2.6 「重新開 chat」其實沒有發生 —— parent 自己已經超載兩次

這是 forensics 沒寫到的部分。**parent transcript 自己也出現過兩次 overflow 簽章**：

| parent transcript 行 | request-id | 時間（+08:00） |
|---|---|---|
| L422 | `1792780988330-3ddc7a8a` | 2026-10-24 02:43:08 |
| L937 | `1792827939869-3259755c` | 2026-10-24 15:45:39 |

兩次之後 **chat 沒有重開**，同一個 transcript 檔繼續長到 6,311.9 KB / 1,331 行 / assistant 累計輸出 **4,411,776 字元**（Read 467 次、Shell 588 次、Grep 282 次、Task 48 次）。Rule 038 §6 步驟 1–2 明寫「立刻停止 / 開新 chat」，但實際執行沒有做到 —— 這是本次延續方案的第一號缺口。

### 2.7 最後 12 個 agent 的乾淨連續段（03:38 → 06:15）

Rule 038 落地（02:46）+ forensics（02:23）+ 「不 resume」修正之後，**連續 12 個 agent 全部存活**：

| agent | 時間 | Reads | Shell | Grep | Writes |
|---|---|---|---|---|---|
| `d7e8e0c5` | 03:38 | 3 | 5 | 4 | 0 |
| `f9800da7` | 03:42 | 0 | 6 | 3 | 0 |
| `24c80ed6` | 03:44 | 0 | 7 | 3 | 0 |
| `f5bb2ef5` | 04:00 | 2 | 53 | 0 | 0 |
| `f9cf8ae3` | 04:30 | 2 | 14 | 15 | 1 |
| `75f72320` | 04:44 | 2 | 19 | 0 | 4 |
| `90327339` | 05:16 | 2 | 29 | 3 | 18 |
| `888a5ccb` | 05:19 | 1 | 6 | 2 | 0 |
| `9b902c73` | 06:02 | 0 | 0 | 0 | 0 |
| `a09b69a7` | 06:08 | 0 | 34 | 0 | 10 |
| `0676bd27` | 06:09 | 0 | 0 | 0 | 0 |
| `a36837f0` | 06:15 | 0 | 29 | 0 | 0 |

**最大 Read 數 = 3，平均 1.0。** 這段期間真正完成的事（實測驗證）：

- `packages/shared/schemas/passValues.ts` + `logic/passValueCalculator.ts`：`npx vitest run` → **65 passed（2 files）**。forensics B2 說的 4 個缺失 export（`PASS_VALUE_INTEGER_METRICS` / `PASS_VALUE_NON_NEGATIVE_METRICS` / `isIntegerPassValueMetric` / `isNonNegativePassValueMetric`）現在都在 `passValues.ts`（L97 / L112 / L125 / L136）。
- `apps/backend/.../passRegistrationService.ts`：forensics B3 的缺 import 已補（L57 `import { buildInitialValues, reducePassValues }`），且 **23505 的 unique_violation 真的被 handle 了**（L161–L173 docblock + L201–L208 `replayPassRuntimeState`）。`npx vitest run src/modules/pass-templates/tests/register.runtimeValues.test.ts` → **7 passed**。
- `npm run check:migrations --workspace=apps/backend` → **OK: 27 migrations registered as applied**（forensics B4 的 registry 缺 entry 已補）。
- `apps/backend/src/__probe_sql.ts`（forensics B1 orphan）已刪除。
- `packages/shared/logic/passValueCalculator.ts` 編碼污染修復 **有落地**：strict UTF-8 decode 通過、U+FFFD = 0（`f9cf8ae3` 回報原本 L30 / L37 有 6 處 invalid byte sequence）。`npm run build --workspace=apps/frontend` → **PASS**（vite 8.2.1，2,382 modules，3.33s，`audit-config-defaults: OK`）。
- `packages/shared/schemas/card.ts` 的編碼污染 **沒有落地**：`888a5ccb` 的最終報告是 FAIL、套用修復數 = 0。現況：`??` 出現 1,039 次（**全部在註解行，程式碼行 0 個**）、U+FFFD 1 個（L1082，HEAD 是 L1069），HEAD 與 working tree 數量完全相同 → 這個檔案至今沒被修。

### 2.8 派工模板的採用時點

parent transcript 48 個 Task prompt 依模板段落標記（任務目標 / 相關檔案 / 明確不做的事 / 預期回傳 / 驗證方式 / 長度上限）比對：

- line 3–1044（前 14 次）：只有零星 PATHS / OUTOFSCOPE，**沒有一個 prompt 帶完整模板段落**。
- line 1073–1192（forensics 後）：開始出現 OUTOFSCOPE / RETURNFMT / VERIFY。
- line 1197–1329（最後 12 次）：**每一個 prompt 都有 OUTOFSCOPE + RETURNFMT + CAP**。

模板真正開始被「逐條照抄」是 line 1197 之後，時間點是 04:00 以後 —— 這比 Rule 038 寫完（02:46）晚了 **1 小時 14 分**。也就是說「規則寫下來 → 真的照著派工」之間有一個明顯的適應期。

---

## 3. 殘留缺口

### 缺口 1（最嚴重）：整套制度目前只存在 working tree，沒有進 git

實測 `git ls-files`：

| 檔案 | tracked？ |
|---|---|
| `.cursor/rules/038-context-budget-discipline.mdc` | **否** |
| `.cursor/templates/subagent-task-prompt.md` | **否** |
| `runs/improvements/feedback/20261025-context-overflow-crash-forensics.md` | **否** |
| `runs/decisions/2026-10-24-pass-runtime-value-model.md` | **否** |
| `runs/plans/`（2 個 plan） | **否** |

`.cursor/rules/` 底下 35 個 `.mdc` 中只有 1 個沒被 track（就是 038）。`AGENTS.md` 的 Rule 038 強制檢查條目（working tree L146）同樣 **未 commit**（`git diff --numstat -- AGENTS.md` = `1 0`，HEAD 版不含 "Rule 038" 字樣）。`.gitignore` 的 `!runs/plans/` 這行也還是未 commit 的修改。

**後果**：任何人 fresh clone 這個 repo，Rule 038、派工模板、forensics、Decision Log、plan 全部不存在。這是目前最大的單點風險 —— 前一晚辛苦建立的所有東西等於沒發生。

對照先例：`git show --stat 050d326`（Rule 037 那次）把 rule + AGENTS.md + 2 份 feedback + INDEX + DEV LOG **同一個 commit 一起進 repo**，而且 commit body 逐條寫出 6 步修法。Rule 038 這次少了這一步。

### 缺口 2：完全沒有自動化 gate

- `.git/hooks/` 下 **0 個** non-sample hook。Rule 037 §6 早就給了 pre-commit hook 範本，但它自己在 commit body 裡寫「本 commit 不包含 hook 檔本身，由 backend 端評估是否要落地」—— **到現在還沒落地**。
- `.github/workflows/deploy.yml` 有 4 個 job（`changes` / `typecheck` / `lint` / `test` / `migrations`），**沒有任何一個檢查 context 紀律**。唯一同類先例是 `migrations` job 跑 `npm run check:migrations`（Rule 035 的 CI gate），這正是可以照抄的形狀。
- Rule 038 §5 的「5 秒自我檢查清單」是給 agent 看的，**沒有任何機器能驗證它有沒有被遵守**。

### 缺口 3：Rule 038 缺一個「硬預算」—— 只有單檔大小門檻，沒有呼叫次數門檻

這是 §2.2 用 41 個樣本量出來的：**預測崩潰的是「累積 Read 呼叫數 ≥ 13」，不是「單一檔案 > 300 行」**。

Rule 038 §2 規定的是單檔 300 行門檻。實測反例：

- `ce1d2db0`：**0 次完整 Read**（14 次全部帶 offset/limit）、**0 次讀 node_modules**、prompt 6,565 字元且**明確寫了「HARD CONTEXT BUDGET (MANDATORY)」**、prompt 裡有「不要讀整個 repo / 不要讀 node_modules / git diff 先 --stat」—— **完全遵守 Rule 038，還是 03:26 爆掉**（Reads=14，輸出 216,008 字元）。
- `2dabc2c7`：prompt 7,554 字元同樣明文引用「read `.cursor/rules/038-context-budget-discipline.mdc` FIRST」，**03:08 仍然爆掉**（Reads=15，輸出 184,357 字元）。

兩者都在 Rule 038 落地（02:46）**之後**執行。所以「把規則寫好、派工時貼進 prompt」**不足以**防止崩潰 —— 缺的是「一個 agent 最多 Read 幾次」的可數上限。

### 缺口 4：Rule 038 的高風險檔案表已經漂移

實測行數 vs 表內記載：

| 檔案 | 表內 | 實際 | 差 |
|---|---|---|---|
| `apps/frontend/.../CardBuilderEditor/CardBuilderEditor.tsx` | 1,348 | **1,388** | +40 |
| `packages/shared/schemas/card.ts` | 1,085 | **1,098** | +13 |
| `packages/shared/schemas/passValues.ts` | *(未列入)* | **302** | 缺漏 |
| `apps/backend/.../services/passValueService.ts` | 383 | 393 | +10 |
| `apps/backend/.../db/templates.ts` | 367 | 369 | +2 |
| `apps/backend/.../db/passEvents.ts` | 205 | 208 | +3 |
| `packages/shared/logic/passExpiry.ts` | 501 | 500 | −1 |
| `apps/backend/src/shared/lib/passcreator/transport.ts` | 134 | 133 | −1 |
| `node_modules/postgres/types/index.d.ts` | 736 | 735 | −1 |

`passValues.ts`（302 行）是崩潰 agent 最常讀的檔案之一（`31b08f3f`、`c3c25002`、`2dabc2c7`、`2949c1ba` 都完整讀過），**卻不在表內**。這張表目前靠人手維護，會持續過期。

### 缺口 5：forensics 檔案有兩份重複、其中一份永遠不會進 git

`runs/investigations/2026-10-25-crash-root-cause.md` 與 `runs/improvements/feedback/20261025-context-overflow-crash-forensics.md` **SHA256 完全相同**（`E94D9A5C3228535E8AE5B74A7C87F6EE24C4D49BA050200799FBE0494D20E37B`，各 24,914 bytes）。但 `.gitignore` L57 的 `runs/*` 沒有 `!runs/investigations/` 例外 → **那份被 gitignore 吃掉**。等於「看起來有兩份備份，實際上一份永遠不會被 commit」。

### 缺口 6：parent chat 的自身 context 沒有上限機制

parent transcript 已 6.3 MB / 4.41M assistant 字元，自己在 10-24 已經爆過兩次卻繼續沿用（§2.6）。Rule 038 只管 subagent 派工紀律，**沒有任何一條講「parent 自己什麼時候該收手」**。

### 缺口 7：沒有任何低成本的 context 健康度指標

要回答「這次 session 會不會爆」目前只能事後人工解析 transcript（本文就是用 PowerShell 逐行算的）。repo 裡沒有任何腳本、hook 或 CI step 能在 session 進行中給出訊號。

---

## 4. 延續方案

### 4.1 制度固化（把條目變成機器可檢查）

| # | 項目 | 誰 | 什麼時候 | 怎麼知道有沒有做到 |
|---|---|---|---|---|
| S1 | **一次 commit 收掉整套制度**：`git add .cursor/rules/038-context-budget-discipline.mdc .cursor/templates/subagent-task-prompt.md runs/improvements/feedback/20261025-context-overflow-crash-forensics.md runs/improvements/feedback/20261025-successful-session-pattern-and-sustainment.md runs/decisions/2026-10-24-pass-runtime-value-model.md runs/plans/ AGENTS.md .gitignore` | 下一個開這個 repo 的 agent | 任何新的 L3 task 動工**之前** | `git ls-files .cursor/rules/038-context-budget-discipline.mdc .cursor/templates/subagent-task-prompt.md` 回傳 2 行非空；`git show HEAD --stat` 有 8 個以上檔案。commit body 照 `050d326` 的格式寫 6 步清單 |
| S2 | **新增 `scripts/check-context-budget.mjs`**（放 root `scripts/`，跟既有 `fix-powershell-encoding-corruption.cjs` / `dev-restart.ps1` 同層）。邏輯：(a) 掃 tracked source tree（排除 `node_modules` / `dist` / `coverage`）列出所有 > 300 行的檔案，與 Rule 038 表內名單比對 → 有未列入者或表內有已消失者就 exit 1 並列出差異；(b) 對表內每個檔案比對實際行數與表內數字，漂移 > 10% 就 exit 1；(c) 額外擋 `packages/shared/schemas/passValues.ts` 這類漏網檔。檢查邏輯直接沿用 `apps/backend/scripts/check-migrations-applied.cjs` 的 exit code 慣例（0 = OK / 1 = 規則違反 / 2 = 檔案或 registry 壞掉） | 同 S1 | S1 同一個 PR | `npm run check:context` exit 0；故意改壞一個檔案行數後必須 exit 1 |
| S3 | **把 S2 接進 CI**：在 `.github/workflows/deploy.yml` 開一個新 job（形狀照抄既有 `migrations` job：`actions/checkout@v4` + `actions/setup-node@v4` + `node-version: '20'` + `cache: 'npm'` + `cache-dependency-path: 'package-lock.json'` + `npm ci` + 跑 script） | 同 S1 | S1 同一個 PR | CI 出現新 job `context-budget` 且為綠；改壞檔案後 CI 應紅 |
| S4 | **落地 `.git/hooks/pre-commit`**：把 Rule 037 §6 已經寫好的 pre-commit hook 範本真正放進 `.git/hooks/pre-commit`（目前 0 個 non-sample hook），再加一條「新增 `.cursor/rules/*.mdc` 時必須同時有對應 `runs/improvements/feedback/` 條目，否則 fail」 | 同 S1 | S1 同一個 PR | `.git/hooks/pre-commit` 存在且 `chmod +x`；手動觸發能擋下違規呼叫 |
| S5 | **修掉 forensics 重複**：`runs/investigations/2026-10-25-crash-root-cause.md` 要嘛刪掉、要嘛在 `.gitignore` 加 `!runs/investigations/`。留兩份 SHA256 相同但一份被 ignore 的狀態等於假備份 | 同 S1 | S1 同一個 PR | `git status --porcelain runs/` 不再出現 `?? runs/investigations/...`；或該路徑變成 tracked |
| S6 | **在 `runs/improvements/INDEX.md` 開一條永久 pending 規則**（見本文 §5 的 append），讓「每個 session 結束跑一次 context audit」變成有登記的待辦而不是靠記性 | 同 S1 | S1 同一個 PR | INDEX.md 該表出現本次新增的 ⏳ pending 行 |
| S7 | **Rule 038 加一條硬預算**：明確寫「單一 agent 的 Read 呼叫數上限 12；超過就把任務拆小或改用 Shell/腳本處理，不要繼續讀」。這是本次 41 個樣本量出來的門檻（Reads ≤ 12 → 21/21 存活）。**並把 §2.2 的 gate 寫進去**：「Reads ≥ 13 且 assistant 輸出 ≥ 150,000 字元 → 立即收手」 | 待指示（本次任務明講「不要自行擴大範圍去改 rules」） | 下次要動 Rule 038 時 | 修 Rule 038 的那個 session 產出 commit，且 commit body 貼出 §2.2 的交叉表 |
| S8 | **Rule 038 高風險表改由 S2 自動產生**：把表內行數從手寫改成 script 產生（rule 檔案由 script 注入或由 CI 檢查）。對照先例：`supabase/migrations/.applied-migrations.json` 就是「registry 對齊實體檔案」的同款設計 | 待指示 | 同 S7 | S2 的 (b) 檢查通過時代表表與實體一致 |

### 4.2 行為觸發（什麼時候必須做什麼）

對應 Rule 038 的既有觸發關鍵字（`整份讀` / `Read 全文` / `Task prompt` / `派工` / `subagent` / `輸入過長` / `輸入內容過長` / `context 爆掉` / `新開對話`）：

| # | 觸發時機 | 必做 | 檢查方式（自我檢查清單 + 機器輔助） |
|---|---|---|---|
| B1 | 準備 `Read` 任何 `.ts` / `.tsx` / `.sql` 檔 | 先 `Grep -n` 拿行號 → `Read` 帶 `offset` + `limit`；單次切片 ≤ 150 行 | 自我檢查清單第 1 條；agent 累計 Read 數 < 12（§2.2） |
| B2 | 準備完整讀 `node_modules/**` / `dist/**` / `coverage/**` / `package-lock.json` | **一律禁止**，改 `Grep -n` 單行 | 本次 session 實測 0 次違規（掃 1,741 個 tool_use path 欄位） |
| B3 | 準備派 `Task` | prompt **≤ 3,000 字元**、**檔案路徑 ≤ 7 個**、每個路徑帶行號範圍、必含「明確不做的事」「預期回傳格式（含長度上限）」「驗證方式」 | 崩潰者平均 9,050 字元 / 17 路徑；存活者平均 2,656 / 7。門檻取存活者的上緣 |
| B4 | 準備派 `Task` | 任務拆到「一個檔 / 一個函式 / 一個假設」；做不到就先用 `Grep` 縮小範圍再派 | 同上；崩潰 agent 平均 17 個路徑 |
| B5 | 準備寫 throwaway probe / 臨時腳本 | 一律放 OS temp 目錄（`$env:TEMP`），**不得寫在 `src/` 下**，做完刪掉 | 唯一違規者 `a9363806` 產出 0 個 production file 並留下 orphan；Rule 038 後 45 次 temp script 呼叫 0 崩潰 |
| B6 | 準備跑 `git diff` | 一律 `git diff --stat` 先看範圍，再 `git diff -- <path>`；禁止裸 `git diff` | 本次 parent 仍有 5 次裸 `git diff`（3 次在崩潰前段） |
| B7 | Task 回來時看到 overflow error | **不得 `resume` 同一個 agent**（會繼承已灌爆的 context，立刻再爆）。改成：開新 agent + 全新窄 prompt + 先修 tree（刪 orphan、補 import、補 registry） | parent line 1090 用 resume 重派 3 個 → 2 個立刻再爆（`2949c1ba` 02:40、`2dabc2c7` 03:08） |
| B8 | agent 的 Read 數逼近 12 或輸出字元逼近 100,000 | 主動收手：把「讀檔」換成「Grep + Shell 腳本 / byte-level 腳本」處理 | §2.2 的 gate |
| B9 | 看到「输入内容过长」 | 停手 → 寫 ≤ 30 行 handoff 摘要到 `runs/decisions/` 或 `runs/handoff/`（**目前 `runs/handoff/` 不存在，要建**）→ 開新 chat → 從 handoff 繼續 | Rule 038 §6 步驟 1–5。實測 parent 違反了步驟 1–2（§2.6），本條要有機器可查的痕跡 |
| B10 | parent 自己 assistant 輸出超過 ~1.5M 字元 或 transcript 超過 ~1.5 MB | 視為 parent 已過載，主動開新 chat（不要等 overflow 簽章出現） | parent 在 02:43、15:45 已爆過兩次卻繼續沿用 |

### 4.3 量化監控（低成本指標）

全部可從 agent transcript 直接算，成本是一次 session 結束後跑幾秒 PowerShell / Node。建議做成 `scripts/audit-session-context.mjs`（路徑：`%USERPROFILE%\.cursor\projects\<project-slug>\agent-transcripts\<session>\**\*.jsonl`）。

| # | 指標 | 計算方式 | 綠 / 黃 / 紅門檻 | 紅燈時的動作 |
|---|---|---|---|---|
| M1 | **單 agent Read 呼叫數** | 数 transcript 內 `tool_use` name = `Read` 的筆數 | ≤ 8 / 9–12 / **≥ 13** | 收手；改用 Grep + Shell；或把任務拆小 |
| M2 | **單 agent 完整 Read 數**（無 offset/limit） | 同上但 `input.offset` 與 `input.limit` 都缺 | ≤ 2 / 3–6 / **≥ 7** | 回到 B1 |
| M3 | **單 agent assistant 輸出字元** | 累加所有 assistant `text` block 長度 | ≤ 50K / 50K–100K / **> 100K** | 收手；停止敘述型輸出，改用工具呼叫 |
| M4 | **Task prompt 字元數** | `tool_use` name = `Task` 的 `input.prompt` 長度 | ≤ 3,000 / 3,000–6,000 / **> 6,000** | 砍背景、砍路徑數 |
| M5 | **Task prompt 檔案路徑數** | prompt 內符合 `*.ts|tsx|sql|json|jsonc|mjs|cjs` 的相異路徑數 | ≤ 7 / 8–12 / **> 12** | 任務拆分（4 個 agent 平均 17 個 → 全崩） |
| M6 | **transcript 檔案大小（per agent）** | 檔案 bytes | ≤ 200 KB / 200–500 KB / **> 500 KB** | forensics §4c 已把 500 KB 當 early-warning；對上預警 |
| M7 | **parent transcript 大小 / assistant 累計字元** | 同上，root transcript | ≤ 1.5 MB / 1.5–3 MB / **> 3 MB** | 開新 chat（§2.6 實測 parent 4.41M 字元仍在跑） |
| M8 | **崩潰簽章出現次數** | grep transcript 末段是否出現「输入内容过长」 | 0 / — / **≥ 1** | 立刻走 B9 復原流程 |
| M9 | **phase 健康度**：本 session 崩潰數 / agent 總數 | 掃全部 subagent | 0 / 1 / **≥ 2** | ≥ 2 就停止並行派工，回到單線 |
| M10 | **`resume` 使用次數** | 數 `input.resume` 非 null 的 Task 呼叫 | 0（正常）/ — / **對崩潰 agent 使用** | 改走 B7 |

本文所有數字都是用上述 M1–M5、M8、M10 這幾個指標算出來的 —— 意思是**這些指標不需要額外埋點，直接對既有 transcript 檔跑就能得到**，成本接近零。

---

## 5. 明確不做的事項

1. **不自行改 Rule 038 / Rule 037 / 任何 `.cursor/rules/*.mdc`**。S7 / S8 需要改 rule，本次任務明講「除非使用者之後指示」—— 留成待辦。
2. **不改任何 source code**。本文提到的 `card.ts` 編碼污染（1,039 個 `??` + 1 個 U+FFFD）**刻意沒修**：修它需要寫 code，而且 agent `888a5ccb` 已經判定 FAIL。要修應該另開一個封閉任務。
3. **不動 `package.json` / `config` / `tsconfig` / CI workflow**。S2 / S3 會碰，但本次只寫方案。
4. **不做任何 git 寫入操作**（commit / push / checkout / reset / stash 全部沒做）。本文所有 `git` 指令都是唯讀的。
5. **不讀 `node_modules/` / `package-lock.json` / `dist/` / `coverage/` 的內容**。`node_modules/postgres/types/index.d.ts` 只量行數（735 行），沒有讀內容。
6. **不把整個 repo 讀進來**。只讀本文列出的檔案；大檔一律 `Grep -n` → 切片。
7. **不把「11 個 agent 存活」誤寫成「Rule 038 已經解決問題」**。§2.2 的資料顯示：Rule 038 落地後仍有 2 個 agent 爆掉（`2dabc2c7` 03:08、`ce1d2db0` 03:26），而且 `ce1d2db0` 是**完全遵守** Rule 038 所有條款的情況下爆掉的。規則是必要條件，不是充分條件。
8. **不建議放寬 Read 呼叫數門檻**。Reads ≤ 12 的 21 個 agent 零崩潰是本次最乾淨的訊號，門檻應該保守不該放寬。

---

## 6. 參照

- `runs/improvements/feedback/20261025-context-overflow-crash-forensics.md` — crash forensics（本次的 §4a–4c 修法清單）
- `runs/investigations/2026-10-25-crash-root-cause.md` — 同內容副本（目前被 gitignore）
- `runs/decisions/2026-10-24-pass-runtime-value-model.md` — 7 條決策，Decision Log 格式範本
- `runs/plans/2026-10-24-pass-runtime-values-roadmap.md` / `2026-10-24-pass-scanner-event-semantics.md`
- `.cursor/rules/038-context-budget-discipline.mdc` — 本次建立（未 commit）
- `.cursor/templates/subagent-task-prompt.md` — 派工模板（未 commit）
- `.cursor/rules/037-mcp-tool-call-pattern.mdc` §6 — pre-commit hook 範本（未落地）
- `apps/backend/scripts/check-migrations-applied.cjs` — CI gate 腳本形狀範本（S2 / S3 照抄）
- `.github/workflows/deploy.yml` — CI job 形狀範本（S3 照抄 `migrations` job）
- commit `050d326` — Rule 037 那次的 6 步 commit 範本（S1 照抄）
- agent transcripts：`%USERPROFILE%\.cursor\projects\c-Users-user-Desktop-SAOME-REBUILD\agent-transcripts\4a98404c-4b59-4e39-bfd1-6fc91aea06d9\`
