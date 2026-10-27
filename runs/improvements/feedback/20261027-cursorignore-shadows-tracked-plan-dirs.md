# `.cursorignore` 的未錨定 pattern 會遮蔽 git 已追蹤的目錄 —— 讓 agent 讀不到自己的 repo

> 日期：2026-10-27 ｜ 分類：工具設定 / 協作方法
> 相關 Decision：無（工具設定修正，非架構決策）

## 摘要

本次「檢查還有沒有漏掉沒 commit 的檔案」的例行掃描，發現 `runs/plans/` 底下的 plan 檔**用 Cursor 的 Read / Write 工具讀寫時一律回 permission denied**，但用 `node` 讀寫同一個路徑完全正常。

**根因**：repo 根目錄的 `.cursorignore` 有一條未錨定的 pattern：

```
# Local plans (one-off plans during this session)
plans/
```

`.cursorignore` 的 `plans/` 沒有前導 `/`，因此**比對任意層級**的 `plans` 目錄 —— 不只 `.cursor/plans/`，連 git 已追蹤、屬於 team-shared 知識的 `runs/plans/` 也一併被遮蔽。`.cursorignore` 的檔頭註解明說它的用途是「prevent Cursor from sending personal state to its own indexes while still letting .cursor/ rules/ and skills/ be tracked by git as team-shared knowledge」—— 但 `plans/` 這條把「個人暫存計畫」和「團隊共享計畫」混為一談，連帶把後者也擋掉。

**實際影響**（本次實測）：

| 路徑 | git 狀態 | Cursor Read/Write | node 讀寫 |
|---|---|---|---|
| `runs/plans/*.md` | tracked（`runs/plans/` 在 `.gitignore` 裡被 `!runs/plans/` 明確解忽略）| ❌ permission denied | ✅ 正常 |
| `.cursor/plans/*.plan.md` | tracked | ❌ permission denied | ✅ 正常 |
| `runs/decisions/*.md` | tracked | ✅ 正常 | ✅ 正常 |
| `runs/improvements/*.md` | tracked | ✅ 正常 | ✅ 正常 |

修法：把 pattern 錨定到 repo 根的 `.cursor/plans/`（`/.cursor/plans/`），並在註解寫明「為什麼要錨定」。

## 為什麼這個 bug 會活到今天

三個條件同時成立才會產生這個盲區：

1. **`.cursorignore` 與 `.gitignore` 治理同一批檔案但機制不同** —— `.gitignore` 管 git 追蹤、`.cursorignore` 管 Cursor 自己的索引。兩者都叫 "ignore" 但作用面不同，而**「Cursor 工具讀不到」不會讓 git 或 CI 報錯** —— 唯一症狀是 agent 讀檔時 permission denied，而這個症狀很容易被誤判成「檔案不存在」或「路徑寫錯」。
2. **pattern 未錨定** —— `plans/` 與 `/.cursor/plans/` 在 Cursor 的比對語意下不等價。前者匹配全 repo 任意 `plans` 目錄。
3. **repo 同時存在兩個 `plans` 目錄、且兩者都被 git 追蹤** —— `.cursor/plans/`（2 個 plan 檔）與 `runs/plans/`（2 個 plan 檔）。如果只有其中一個，寫錯 pattern 也不會造成可見的損失。

**更麻煩的一層**：`runs/plans/` 這個目錄是 `.gitignore` 用 `!runs/plans/` 明確解忽略的 —— 也就是說**有人刻意表達過「這個目錄要進版本庫」**。但 `.cursorignore` 裡那條 `plans/` 把它對 agent 隱藏了。兩份設定對同一個目錄給出相反的訊號，而且**沒有任何一條 CI 或測試會發現**：git 照樣追蹤它、CI 照樣綠、只有 agent 的檔案工具讀不到。

## 4 條教訓

1. **「Cursor 工具讀不到」不等於「檔案不存在」** —— 同一路徑 node 讀得到、Read 工具讀不到時，該懷疑的是**工具層的索引/權限設定**，不是檔案。判別方式很便宜：同一路徑用 `node -e "console.log(require('fs').readFileSync(p,'utf8'))"` 試一次 —— 讀得到就是工具層問題。本次就是這樣一次交叉驗證直接定位到 `.cursorignore`。

2. **ignore 檔的 pattern 必須錨定，尤其當同一 basename 在 repo 裡有多個目錄時** —— `plans/` 與 `/.cursor/plans/` 在多數人眼裡「一樣」，但前者會匹配 `runs/plans/`。寫 ignore pattern 的當下應該問「這個 repo 裡還有沒有第二個同名目錄」。

3. **`.gitignore` 與 `.cursorignore` 是兩份需要對帳的設定** —— 兩者治理重疊的檔案集合但互不知情。`.gitignore` 裡的 `!runs/plans/`（明確要求進版本庫）與 `.cursorignore` 裡的 `plans/`（明確要求對 agent 隱藏）直接矛盾，而這個矛盾**不會被任何既有檢查抓到**。至少要有一顆「對帳」心智模型：改了其中一份就該確認另一份。

4. **自訂工具的權限/索引層錯誤沒有 CI 守門** —— 這類 bug 靠的是「agent 換個工具讀就繞過了」或「人工點開才發現」才會浮現。可以主動做的是：**每次發現某個目錄讀不到，先確認不是工具層問題**（步驟 1），而不是假設檔案不存在然後改用 shell 繞過 —— 繞過會讓真正的設定 bug 永遠留在原地。

## 同 session 的其他發現（順帶記錄）

本次掃描同時確認了幾件與「漏掉沒 commit 的檔案」直接相關的事：

- **`runs/plans/2026-08-09-billing-cycle.md` 一直沒被 commit** —— 它的 Decision Log（`runs/decisions/2026-08-09-billing-cycle-hybrid.md`）早在 `54d2099` 就進了版本庫，但計畫本體漏在 worktree 外。`.gitignore` 裡 `!runs/plans/` 表明這個目錄本來就該被追蹤，所以這是**純粹的漏 commit**，不是刻意的排除。
- **`runs/plans/` 裡兩份計畫都缺「狀態」欄位** —— 現有 2 份計畫的開頭格式（`- **日期**：` / `- **狀態**：` / `- **影響範圍**：`）是本 repo 的既定慣例，但 `2026-08-09-billing-cycle.md` 沒有狀態行。本次補上，並在補之前先實查 production DB 確認 `paid_at` / `billing_cycle_end` 兩欄確實存在（`information_schema.columns` 查詢），再對照 backend `passes.ts` 的 lazy update SQL 與 `billingCycleCron.ts` 的 cron route，確認 Phase 1-4 真的落地了才寫「已實作」。**狀態欄位必須實查後填，不可憑印象。**
- **`.cursorignore` 本身是被 git 追蹤的**（`git ls-files .cursorignore` 有它）—— 這代表修正它本身就是一個可 review、可回溯的變更，不會變成只有本機生效的個人設定。

## Verification

- `git check-ignore` 對 `runs/plans/` 與 `.cursor/plans/` 兩個目錄的行為在修正前後一致（git 追蹤層面未受影響，本次只動 `.cursorignore`，`.gitignore` 完全未動）
- 修正後 Cursor Read 工具對 `runs/plans/2026-08-09-billing-cycle.md` 讀取成功（修正前為 permission denied）
- `node scripts/check-oneoff-scripts.cjs` exit 0
- `npm run check:migrations --workspace=apps/backend` exit 0（28 migrations registered as applied）
- typecheck ×3 exit 0；shared 843 / backend 806（23 skipped）/ frontend 2076 全綠

## scope

- 1 改檔（`.cursorignore`：`plans/` → `/.cursor/plans/` + 註解）
- 2 改檔（`runs/plans/` 兩份計畫：補狀態欄位 / 新增 visit count 計畫）
- 0 migration、0 shared schema 變更、0 原始碼變更、0 CI 變更

## 參照

- `.cursorignore`（本次修正的檔案本身）
- `.gitignore`（`!runs/plans/` 這條解忽略規則，與 `.cursorignore` 的 `plans/` 直接矛盾）
- `runs/plans/2026-10-24-pass-scanner-event-semantics.md`（同目錄既有計畫的狀態欄位格式範例）
