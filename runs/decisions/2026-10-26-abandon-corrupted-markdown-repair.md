# Decision：放棄修復損毀的 markdown（corrupted-markdown repair）

- **日期**：2026-10-26
- **狀態**：已採用
- **影響範圍**：`runs/improvements/feedback/20260911-hyperdrive-query-spike-investigation.md`（保留現狀）、`runs/plans/2026-08-09-billing-cycle.md`（保留現狀）、`scripts/.repair-hyperdrive/`（已刪除）、repo 根目錄 `.tmp*` 暫存檔（已刪除）

## 背景

2026-10-25 的一場 session 企圖修復兩份已被 U+FFFD（mojibake）污染的 markdown。

第一份是 `runs/improvements/feedback/20260911-hyperdrive-query-spike-investigation.md`。這是 git 追蹤中的檔案，記錄 Hyperdrive 87% query 佔用的診斷調查。實測該檔在 UTF-8 解碼後有 **1,273 個 U+FFFD**，內容在「Hyperdrive 87% query 佔用診斷」標題與內文多處已不可逆地遺失。第二份是 `runs/plans/2026-08-09-billing-cycle.md`，**未**被 git 追蹤（`git ls-files -- runs/plans/` 只列出另外兩個 2026-10-24 的計畫檔），實測有 **192 個 U+FFFD**；它的修改時間是 2026-08-08，早於這次修復工作，因此不屬於本次任務產物。

該 session 為尋找乾淨版本做了幾件事：

- 從 commit `69d2528`（`fix(backend): Hyperdrive 87% query spike — Phase 1-4 fix batch`）與 `bfc0454`（`docs(feedback): Hyperdrive 87% query spike investigation (diagnose-only)`）挖掘 git blob。實測 `git show 69d2528:...` 為 25,156 bytes / 1,273 U+FFFD，`git show bfc0454:...` 為 22,545 bytes / 389 U+FFFD，**兩個候選 blob 本身也都含 U+FFFD**，都不是乾淨來源。
- 以 CP950 / UTF-8 等編碼重新解碼，產出解碼副本與損壞分析 dump 於 `.tmp_enc/`。
- 從先前的 agent transcript 中挖掘第 10 節的乾淨副本，並在 `scripts/.repair-hyperdrive/` 下建立多支腳本（`find-clean-markers.cjs`、`test-transform.cjs`、`verify-spec-and-search.cjs`、`find-sec10-source.cjs`、`scan-fragment-refs.cjs`、`extract-payloads.cjs`、`search-blobs.cjs`、`resolve-head-and-hunt.cjs` 等）、`extracted/` 片段匯出（1,000 筆以上）與 `sec10-candidates/` 候選清單。

過程中另外發現：本次修復工作**不是**由背景常駐程序造成的。清理期間觀察到 `scripts/.repair-hyperdrive/` 內仍有檔案被寫入（檔案數由 1,000 增至 1,001，mtime 前進），追查後確認來源是**另一個仍在執行的 Cursor chat session**（transcript `b2478636-b30d-44eb-9eff-b27447387aa2`），其 subagent 仍在執行 `node scripts/.repair-hyperdrive/recent-transcripts.cjs`。先前的清理之所以會看到目錄「重生」，根因是那一場 session 尚未結束，而非孤兒程序。

## 選項與決定

- **選項 A**：繼續法證式修復——持續挖掘 git blob、窮舉編碼轉換組合、比對歷史 transcript，直到能還原乾淨正文為止。
- **選項 B**：停止修復，保留已損毀的文字作為歷史證據，並清掉本次任務產生的所有腳本與暫存檔。

**決定：選項 B。**

理由依據使用者明確指示：這兩份 markdown 的修復沒有實質下游價值——沒有任何 runtime、schema、migration 或產品行為依賴它們。這兩份檔案都是**文件性質**的紀錄（診斷調查與計畫），不是契約、不是設定、不是資料來源；它們的內容在需要時仍可從 git history 取得（`bfc0454` 保留了 389 U+FFFD 的較早版本，`69d2528` 與 `HEAD` 一致為 1,273 U+FFFD），因此「保留損毀狀態」並不會讓資訊不可復原。

相較之下，選項 A 的成本是持續產出新的暫存腳本與候選檔（本次任務已累積 1,000+ 檔案、約 1.4 MB 於 `scripts/.repair-hyperdrive/`），而成功率取決於是否存在從未被污染的來源——實測兩個候選 blob 都已污染，乾淨來源的搜尋方向已趨於窮盡。繼續投入不符合效益。

## 影響

### 已刪除的本次任務產物

以下清單對應本次清理前的實測稽核（size 為刪除前、`mtime` 為最後修改時間）：

- `scripts/.repair-hyperdrive/` — 目錄，1,408,480 bytes，稽核時 1,001 個檔案、刪除當下 1,004 個檔案，mtime 2026-10-25T16:21:09Z。內含 `find-clean-markers.cjs`、`test-transform.cjs`、`verify-spec-and-search.cjs`、`find-sec10-source.cjs`、`scan-fragment-refs.cjs`、`extract-payloads.cjs`、`search-blobs.cjs`、`resolve-head-and-hunt.cjs`、`extracted/`（1,000+ 片段匯出）、`sec10-candidates/`（25 個候選檔）。
- `.tmp_enc/` — 目錄，110,381 bytes，13 個檔案，mtime 2026-10-25T13:35:46Z。內含 `a.md`、`b.md`、`c.md`、`an1.txt`、`an2.txt`、`an3.txt`、`damage.txt`、`dmg2.txt`、`_a_decoded.md`、`_plan_decoded.md`、`_scan2.txt`、`_scan3.txt`、`_scan_big.txt`。
- `.commit-msg-batch1.tmp` — 432 bytes，mtime 2026-10-25T14:52:09Z。
- `.tmp-encoding-probe.mjs` — 1,083 bytes，mtime 2026-10-25T12:43:35Z。
- `.tmp-encoding-inventory.mjs` — 1,045 bytes，mtime 2026-10-25T12:44:16Z。
- `.tmp-encoding-runs.mjs` — 1,922 bytes，mtime 2026-10-25T12:45:07Z。
- `.tmp-git-versions.mjs` — 1,075 bytes，mtime 2026-10-25T12:46:43Z。
- `.tmp-diff-versions.mjs` — 1,086 bytes，mtime 2026-10-25T12:47:19Z。
- `.tmp-rev-69d2528.bin` — 25,156 bytes，mtime 2026-10-25T12:47:03Z。
- `.tmp-rev-bfc0454.bin` — 22,545 bytes，mtime 2026-10-25T12:47:03Z。
- `.tmp_ffd_scan.txt` — 109 bytes，mtime 2026-10-25T13:58:06Z。
- `.tmp_s10.txt` — 2,808 bytes，mtime 2026-10-25T13:59:26Z。
- `.tmp_trial.md` — 26,619 bytes，mtime 2026-10-25T14:05:07Z。
- `.tmp_q.txt` — 3,692 bytes，mtime 2026-10-25T14:05:26Z。
- `.tmp_v1.md` — 25,156 bytes，mtime 2026-10-25T14:08:39Z。
- `.tmp_v2.md` — 22,545 bytes，mtime 2026-10-25T14:08:39Z。
- `.tmp_sec11.txt` — 47,402 bytes，mtime 2026-10-25T14:46:22Z。
- `.tmp_bfc.txt` — 39,358 bytes，mtime 2026-10-25T14:46:38Z。
- `.tmp_clean.txt` — 20,067 bytes，mtime 2026-10-25T14:47:21Z。
- `.tmp_out.txt` — 2,093 bytes，mtime 2026-10-25T14:47:44Z。
- `.tmp_counts.json` — 138 bytes，mtime 2026-10-25T14:52:59Z。
- `.tmp_marks.txt` — 7,754 bytes，mtime 2026-10-25T14:54:02Z。
- `.tmp_bfc0454.md` — 39,358 bytes，mtime 2026-10-25T15:56:32Z。

上述 23 個目標在刪除前皆**未被 git 追蹤**（`git ls-tree -r HEAD --name-only -- scripts/.repair-hyperdrive` 與 `-- .tmp_enc` 回傳空結果；`git ls-files -- '.tmp*' '.commit-msg-*'` 回傳空結果；`.tmp*` 與 `*.tmp` 另受 `.gitignore` 第 89、94 行規則涵蓋）。

### 未受影響的部分

- **沒有動到任何 source code、schema、migration 或 CI 設定。** 本次清理僅刪除未追蹤的暫存產物，並新增本決策紀錄一個檔案。
- `runs/improvements/feedback/20260911-hyperdrive-query-spike-investigation.md` 保持已提交的損毀狀態不變（1,273 U+FFFD，與 `HEAD` 一致）。它仍可從 git history 取得較早版本（`bfc0454` 為 389 U+FFFD），必要時可另行決定如何處理。
- `runs/plans/2026-08-09-billing-cycle.md` 維持未追蹤且仍帶 192 U+FFFD 的狀態，待使用者另行裁決。
- `runs/decisions/2026-08-09-billing-cycle-hybrid.md`（已追蹤，3,086 bytes，0 U+FFFD）內容完整，billing cycle 的決策內容保留於該處，未受本次清理影響。
- 下列既有檔案未刪除亦未修改：`scripts/dev-restart.cmd`、`scripts/dev-restart.ps1`、`scripts/health-check.ps1`、`scripts/fix-corrupted-regex-broader.cjs`、`scripts/fix-missing-paren.cjs`、`scripts/fix-powershell-encoding-corruption.cjs`（皆為已追蹤的既有檔案）、`.dev-restart.pids.tmp`（dev server 執行期檔案）、`apps/backend/scripts/probe-real-payload.cjs`（另一任務的舊 probe）。
- `C:\Users\user\Desktop\mu-plugins` 為獨立 repo，本次作業完全未觸碰。

### 後續

- 本決策**不隱含任何後續程式工作**。若日後需要還原上述 markdown，屬於新的獨立任務，需重新評估資料來源。
- 需留意：若仍有一場舊的 Cursor chat session 在跑，該 session 可能再次寫入 `scripts/.repair-hyperdrive/`。根因是並行的 chat session 未結束，而不是孤兒程序。

## 已知陷阱

在本主機（Windows PowerShell）透過 `Set-Content` / `Out-File` / `Add-Content` / here-string / pipeline 重導來寫含中文的檔案，會被 console code page 編碼成 U+FFFD 替換字元，寫入過程**不會報錯、exit code 仍為 0**。本次涉及的檔案全部改用 Cursor `Write` 工具或 Node `fs.writeFileSync(..., 'utf8')` 寫入，以避開此問題。詳見 `.cursor/rules/039-powershell-free-code-authoring.mdc`。

---

Refs: runs/decisions/2026-10-26-abandon-corrupted-markdown-repair.md
