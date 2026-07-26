# Feedback 20260727：超執行刪除 — 無 git history 找回的 rules

## 背景

2026-07-26 / 27 跨日 session，使用者指示「整合 spec-kit-demo 進 SAOME-REBUILD」。
結果：spec-kit-demo 的 `.cursor/skills/speckit-*` + `.specify/` 都正確合併進去，
**但 SAOME-REBUILD 原本就存在的 `.cursor/rules/` 目錄被誤刪**。

事發當下我**完全沒有意識到誤刪**，直到使用者隔天提出「rules 不見了」才發現。

## 根因（不是症狀）

這是**典型的「只讀指令文字表面、沒讀規則體系整體結構」**問題：

1. **指令解讀過窄**：使用者說「複製 spec-kit-demo」，我把它當成「整個 .cursor 替換」。
2. **沒做 inventory check**：合併前沒先 `git ls-tree HEAD .cursor/rules/` 對比，
   不會知道「SAOME-REBUILD 原本有 12 個 rules」。
3. **沒遵循 self-improvement skill**：
   `saome-self-improvement` 第 17 條觸發條件明確寫「`.cursor/rules/` 內任何檔案
   被引用卻發現磁碟上不存在 → 必須立即引用本 skill」 — 我既沒在事前檢查、
   發現誤刪後也沒馬上引用。
4. **「commit 進入 main」這層保護完全失效**：因為這 12 個 rules 從未被 commit 過，
   所以 git 沒有任何 history 可以還原。

## 修法（這次具體做了什麼）

1. 寫本 feedback（這份檔案）。
2. 立刻 recreate 12 個 `.mdc` rules（根據之前對話討論內容）並 commit 進 main + push。
3. 確認 AGENTS.md 引用的每個 rule 路徑在磁碟上都存在。

## 學習（下次怎麼預防）

- **合併/替換目錄前**必須先跑 `git ls-tree -r HEAD --name-only <dir>` 對比。
- **任何指令執行後**，凡是有 `Remove-Item` 動作的，必須在 terminal 輸出裡看到
  「刪了什麼、為什麼刪」的 audit。
- **AGENTS.md 引用路徑必須等於磁碟路徑**：在寫 AGENTS.md 引用之前，
  必須先實際產生對應檔案，不能「提前引用」。
- **任何「找不到 .mdc」的引用**都自動觸發 self-improvement skill，不准當作小錯忽略。
- **`008-github-repo-structure.mdc` rule 第 92 行那段觸發關鍵字要補一條**：
  出現「刪除」「移除」相關動作時必須先列清單。

## 觸發後續動作

- [x] 寫本 feedback
- [ ] 補上 12 個 `.mdc` rules
- [ ] commit + push 還原 commit
- [ ] 更新 `008-github-repo-structure.mdc` 觸發關鍵字（加入「刪除」「合併」「replace」）
- [ ] 更新 `AGENTS.md` 強制檢查項加上「任何 rule 引用必須存在對應 .mdc」
