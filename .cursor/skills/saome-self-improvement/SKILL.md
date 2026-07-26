# SAOME Self-Improvement Skill

> 觸發條件：任何一次 session 結束前、或是同一個錯誤/盲點第二次出現時，必須引用此 skill。

## 目的

讓每次 session 的「教訓」真的會累積，避免 agent 重複犯同一個錯。
這條 skill 是「補上 AGENTS.md 列的 SAOME 鐵律實際只有一部分存在於磁碟」的斷裂點。

## 何時必須觸發

下列任一情況發生時，**必須**立即引用此 skill：

1. session 結束、要關掉 cursor 之前
2. 同一個結構性問題第二次出現（root cause 重複）
3. 使用者明確要求「反省」「檢討」「改善」「self-improvement」「今天學到什麼」
4. `.cursor/rules/` 內任何檔案被引用卻發現磁碟上不存在
5. `runs/improvements/feedback/` 內有同日多於 1 個 feedback

## 流程

### Step 1：寫 feedback
新增檔案 `runs/improvements/feedback/YYYYMMDD-<topic>.md`，至少包含：
- 背景（什麼情境）
- 根因（不是症狀）
- 修法（這次具體做了什麼）
- 學習（下次怎麼預防）

### Step 2：決定要不要 sync 到 rules/skills
如果根因是「規範本身缺失或過時」：
- 在 `.cursor/rules/` 新增或更新對應的 `.mdc`
- 或在 `.cursor/skills/` 新增對應的 `SKILL.md`
- 同步更新 `AGENTS.md` 的索引段

如果根因是「agent 沒照規範做」：
- 加強觸發關鍵字（讓規範更容易被自動引用）
- 或在 `AGENTS.md` 的強制檢查清單加上對應條目

### Step 3：commit（不 push）
SAOME-REBUILD 是 owner-agent 私房，self-improvement **純反思性**改動（feedback、debug log、
skill 自我改進）commit 在本地，不推任何 remote。

**例外**：當 fix 補上是「補回原本被誤刪的共用規範」（例如遺失的 .cursor/rules/ 補齊、
被誤覆蓋的 AGENTS.md 重要章節還原）→ 屬於規範本身的修復，**可 push**，但是 commit
message 必須明確標 `Self-improvement:` 並連到本 feedback。

```bash
# 純反思（不 push）
git add .cursor/skills/saome-self-improvement/ runs/improvements/
git commit -m "chore(self-improvement): reflect ..."

# 規範修復（可 push）
git add .cursor/rules/000-modular-design.mdc AGENTS.md
git commit -m "chore(self-improvement): restore ..."
git push origin main
```

### Step 4：建立下一個 session 的起點
把這次 session 的關鍵決策寫進 `DEV/YYYY-MM/<MM>-dev.md`，讓下次開新 session 第一件事就是讀這份。

## 與其他 skill 的關係

- `saome-github-deploy`：本 skill 處理「deploy 後的反省」，它處理「deploy 本身」
- `saome-new-repo`：本 skill 與它互補——一個管反省、一個管 SOP
- `AGENTS.md`：本 skill 是它的執行延伸——AGENTS.md 列規範，本 skill 補規範缺失

## 禁止

- 寫得太長（AI 痕跡風險）
- 寫進 emoji
- 純反思 commit 推任何 remote（owner-agent 私房）
- 規範修復 push 卻沒標 `Self-improvement:` 與 feedback 連結
- 跳過 Step 1 直接改 rules