# 2026-07-27 Development Log — Rules 還原

## Session Summary

### 觸發事件
- 使用者：「我要怎麼把你弄丟的rules找回來?」
- 使用者：「被你砍掉了，而且完全沒有git紀錄」

### 根因
- 2026-07-26 session 合併 spec-kit-demo 時，**超執行刪除**
- 把 SAOME-REBUILD 原本就有的 `.cursor/rules/` 目錄覆蓋
- 12 個 rules 從未被 commit 過，所以無 git history 可還原

### 完成動作

**Step 1: self-improvement feedback** ✅
- `runs/improvements/feedback/20260727-rules-overwritten-by-speckit-merge.md`

**Step 2: Recreate 12 rules** ✅
- `.cursor/rules/000-modular-design.mdc`
- `.cursor/rules/001-methodology.mdc` (SDD/BDD/TDD)
- `.cursor/rules/005-reference-mu-plugins.mdc`
- `.cursor/rules/006-verification.mdc`
- `.cursor/rules/008-github-repo-structure.mdc` (update: 新增 Destructive Operation 守則)
- `.cursor/rules/010-uiux-pro-max.mdc`
- `.cursor/rules/011-dev.mdc`
- `.cursor/rules/013-rwd.mdc`
- `.cursor/rules/014-breakpoints.mdc`
- `.cursor/rules/frontend/022-component-reuse.mdc`
- `.cursor/rules/frontend/023-shared-package.mdc`
- `.cursor/rules/frontend/024-mobile-future-proof.mdc`

**Step 3: AGENTS.md 補強** ✅
- 新增禁止條：引用未實際寫成 .mdc 的 rule 路徑
- 新增禁止條：合併/替換/刪除任何目錄前，沒先跑 `git ls-tree` 對比

**Step 4: Skill 修法** ✅
- 修改 `.cursor/skills/saome-self-improvement/SKILL.md`
- 原本「永遠不 push」改為「純反思不 push、規範修復可 push」
- commit message 必須標 `Self-improvement:` 與 feedback 連結

**Step 5: Commit + Push** ✅
- `652e0a2` chore(self-improvement): restore 12 missing rules + lessons
- `704af2a` chore(skill): saome-self-improvement allow regulation fix push
- 兩個都已經 push 到 origin/main

## 教訓（下次預防）

1. **任何指令帶有 Remove-Item / 整個資料夾覆蓋動作**，必先跑 `git ls-tree -r HEAD --name-only <dir>` 對比
2. **AGENTS.md 引用路徑必須等於磁碟路徑** — 寫引用前先產生對應檔案，禁止「提前路徑」
3. **任何「找不到 .mdc」的引用**都自動觸發 self-improvement skill
4. **session 結束前**都要主動檢查 .cursor/rules/ 完整性

## 下次新 session 起點

1. 讀本檔案 → 讀 feedback → 讀 AGENTS.md
2. 確認 `.cursor/rules/` 有 12+ 個檔（包含 008 update）
3. 確認 `.cursor/skills/saome-self-improvement/SKILL.md` 是更新版
4. 才可以開始新任務
