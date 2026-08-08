# Handoff：SAOME 文章系列全面更新計劃（接手 chat 入口）

> 建立日期：2026-08-08 20:53 UTC+8
> 前 chat 結束時間：2026-08-08 20:53 UTC+8
> 接手 chat 第一步：**讀完這個檔**

---

## 0. 30 秒看懂

前一個 chat 在這個 repo 完成了「文章系列全面更新計劃」的前半段。後半段因 PowerShell heredoc StrReplace timeout 沒做完，由你接手。

**前 chat 已完成的 3 件事**：

1. ✅ 建立 `runs/improvements/feedback/20260808-admin-login-6-bug-chain-index.md`（85 行，8 個 commit SHA 全驗證）
2. ✅ 在 `.cursor/rules/articles/001-article-style.mdc` 加 Step 4.5（CTA 必填）+ 發布前 checklist 增 4 條
3. ✅ 在 `.cursor/skills/article-writing/SKILL.md` 加 Step 5.5（CTA 區塊範本）+ Step 6（程式碼片段紀律）

**剩給你做的 2 件事**：

1. ⏳ Commit + push 上面這 3 個檔案（**拆 2 個 commit**，不要捆一起）
2. ⏳ 用 AskQuestion 問我要不要繼續做 VFR 3 篇重寫 + field-log-01 撰寫

---

## 1. 你必須先讀的檔案（依序）

| # | 路徑 | 為什麼 |
|---|------|------|
| 1 | `.cursor/plans/field-log_系列規劃_ca8ad2a8.plan.md` | 完整 plan（如果找得到） |
| 2 | `runs/improvements/feedback/handoff-20260808-article-series.md` | 你正在讀的（本檔） |
| 3 | `runs/improvements/feedback/20260808-admin-login-6-bug-chain-index.md` | 前 chat 新建，85 行 |
| 4 | `.cursor/rules/articles/001-article-style.mdc`（141 行） | 已有 Step 3.5 + Step 4.5 + checklist 增 4 條 |
| 5 | `.cursor/skills/article-writing/SKILL.md`（199 行） | 已有 Step 5.5 + Step 6 |
| 6 | `runs/articles/01-vfr-intro.md`（240 行） | 待重寫，status=`draft` |
| 7 | `runs/articles/02-vfr-tech-details.md` | 待重寫，status=`draft` |
| 8 | `runs/articles/03-vfr-validation.md`（300 行） | 待重寫，status=`outline`（**注意**：是 outline 不是 draft，缺內容最多） |
| 9 | `runs/improvements/feedback/20260728-admin-login-scrypt-mismatch.md`（308 行） | 6 連環 bug 的 Bug-4b 原始碼 |
| 10 | `runs/improvements/feedback/20260808-bug7-trial-banner-pass-state.md`（148 行） | 6 連環 bug 的 Bug-7 |

---

## 2. 規範層 rule 必讀（這專案的鐵律）

按觸發情境讀，不要一次全讀：

| 你要做的事 | 必讀 rule |
|----------|----------|
| 寫文章 / 改 article | `.cursor/rules/articles/001-article-style.mdc`（已加 Step 4.5） |
| 寫 DEV LOG | `.cursor/skills/saome-dev-logging/SKILL.md`（**注意**：DEV LOG 跟 article 是兩件事） |
| commit | `.cursor/rules/011-dev.mdc`（commit message 必填 Refs/Sync/Self-improvement footer） |
| commit 前 | `.cursor/rules/006-verification.mdc`（必跑驗證 + 改檔前必跑 git show） |
| build / deploy | `.cursor/rules/017-production-bundle-guard.mdc`（build 後 grep localhost） |
| 表單 / schema | `.cursor/rules/018-form-autofill-and-multi-step-state.mdc` + `.cursor/rules/019-schema-contract-drift.mdc` |
| 任何時候 | `AGENTS.md`（完整守則，特別是「Auth flow 鐵律」） |

---

## 3. 必跑的 skill（用 Read tool 載入）

| Skill | 何時用 |
|-------|-------|
| `.cursor/skills/saome-task-router/SKILL.md` | **任何任務開頭**判斷 L1/L2/L3 |
| `.cursor/skills/article-writing/SKILL.md` | 寫 article（已加 Step 5.5 + Step 6） |
| `.cursor/skills/saome-dev-logging/SKILL.md` | 寫 DEV LOG（跟 article 不同 skill） |
| `.cursor/skills/saome-self-improvement/SKILL.md` | commit 前的三層決策 |
| `.cursor/skills/saome-methodology-bridge/SKILL.md` | L3 Heavy 觸發時機 |

---

## 4. 目前 git 狀態（前 chat 結束時）

```
M  .cursor/rules/articles/001-article-style.mdc   (已加 Step 4.5 + checklist 4 條)
M  .cursor/skills/article-writing/SKILL.md         (已加 Step 5.5 + Step 6)
?? runs/improvements/feedback/20260808-admin-login-6-bug-chain-index.md  (新建)
?? apps/frontend/.env.development                  (不是我建的，不動)
?? tests/probe/local-login-test.cjs                (不是我建的，不動)
?? tests/probe/probe-trial-banner.mjs              (不是我建的，不動)
```

⚠️ **3 個 untracked 的 `tests/probe/*` 與 `apps/frontend/.env.development`** —— **不是我建立的**，**不要 commit 到我的 commit 內**。commit 前先用 `git diff <file>` 確認它們內容；如果跟我任務無關，就在 `git add` 時排除。

---

## 5. Commit 流程（拆 2 個 commit，不是一個）

### Commit 1：`docs(feedback): admin-login 6-bug chain consolidated index`

只 add 1 個檔案：
- `runs/improvements/feedback/20260808-admin-login-6-bug-chain-index.md`

**理由**：這是 feedback 類（規範層的歷史事實歸檔），跟 article 系列無關。按 saome-self-improvement「規範層 commit 必須 push」。

Commit message 範本（按 rule 011-dev）：

```
docs(feedback): admin-login 6-bug chain consolidated index

- Consolidate Bug-4b → 4c → 4d → 5 → 6 → 7 into single index page
- 8 commit SHA cross-verified against git history
- Frontmatter: chain=[bug-4b..bug-7], commits_total=8
- Future field-log-01 article references this index

Refs: runs/improvements/feedback/20260728-admin-login-scrypt-mismatch.md,
      runs/improvements/feedback/20260808-bug7-trial-banner-pass-state.md
Sync: https://github.com/SaomeRebuild/SAOME-REBUILD commit <待 push 後填>
```

### Commit 2：`chore(articles): article-style rule + article-writing skill — add CTA + 精簡紀律`

只 add 2 個檔案：
- `.cursor/rules/articles/001-article-style.mdc`
- `.cursor/skills/article-writing/SKILL.md`

**理由**：規範層（rules/skills），按 saome-self-improvement「規範層 commit 必須 push」。

Commit message 範本：

```
chore(articles): article-style rule + article-writing skill — add CTA + 精簡紀律

- 001-article-style.mdc:
  - Add "精簡原則（draft 階段必跑）" section (Step 3.5):
    禁廢話 / 禁罐頭 / 精簡該要 / 程式碼片段 ≤ 15 行
  - Add "CTA 必填（所有長文 / 連載）" section (Step 4.5):
    3 段式範本 + cta_type 選項 (external-engineer/internal-pm/client-vendor)
    frontmatter 必填 cta_type + client_facing + problem_impact + solution_value
  - Extend 發布前 checklist with 4 new items:
    [ ] 沒有 > 15 行片段
    [ ] 沒有「在這篇文章中」「讓我們一起」鋪墊
    [ ] 文末有 CTA 區塊
    [ ] frontmatter 含 cta_type + client_facing + problem_impact + solution_value

- article-writing SKILL.md:
  - Add "Step 5.5 — CTA 區塊（必填）": 3 段式範本
  - Add "Step 6 — 程式碼片段紀律": ≤ 15 行小片段、適合放的 4 種場景表

Refs: runs/improvements/feedback/handoff-20260808-article-series.md Part 1.1 + Part 1.2
Sync: https://github.com/SaomeRebuild/SAOME-REBUILD commit <待 push 後填>
```

### Push

2 個 commit 都 commit 完後，**必須 push 到 main**（規範層 commit 必須 push，這是 saome-self-improvement 的鐵律）：

```bash
git push origin main
```

如果 push 失敗，**不要**用 `--force`，先看錯誤訊息。

這個 handoff 檔本身（`runs/improvements/feedback/handoff-20260808-article-series.md`）**也要 commit + push**，是 Commit 1 的一部分。改 Commit message 的 Refs 為：

```
Refs: runs/improvements/feedback/20260728-admin-login-scrypt-mismatch.md,
      runs/improvements/feedback/20260808-bug7-trial-banner-pass-state.md,
      runs/improvements/feedback/handoff-20260808-article-series.md
```

---

## 6. Commit 之後的決策（用 AskQuestion 問我）

VFR 3 篇重寫 + field-log-01 撰寫是 plan Part 2 + Part 3，**這部分請先問我**：

```
選項 1：先暫停，等我想清楚再開新 plan（推薦）
選項 2：繼續在同一 chat 做完整個 plan
選項 3：只做 VFR 3 篇，field-log-01 另開新 plan
選項 4：只做 field-log-01，VFR 3 篇另開新 plan
```

**強烈建議選項 1** 的理由：

- VFR #3 從 outline 補成完整版需要實驗數據（plan todo vfr3-fill-outline 寫了 3 個實驗，但**實驗結果還沒跑**）
- field-log-01 需要先給我列 8 章節 outline sign-off（plan todo field-log-01-outline-confirm）
- 前 chat PowerShell heredoc StrReplace timeout 過一次——環境不穩定
- 新 chat 開新 plan 比在這個 chat 硬撐乾淨

---

## 7. 任務級距評估

| 子任務 | 等級 | 流程 |
|-------|------|------|
| commit + push 2 個 commit | L1 Trivial | 直接做 → git status 確認 → push |
| 規劃「是否繼續 VFR + field-log」 | L2 Standard | AskQuestion → 等 sign-off → 開新 plan |
| VFR 3 篇重寫 | L3 Heavy | brainstorming → decision log → outline sign-off → review |
| field-log-01 撰寫 | L3 Heavy | outline sign-off → 寫 → review |

---

## 8. 不要做的事

- ❌ 不要把 3 個 untracked 的 `tests/probe/*` / `apps/frontend/.env.development` 加到 commit
- ❌ 不要把規範層 commit 跟 article 變動捆成 1 個 commit
- ❌ 不要在沒看到驗證輸出就說完成（按 rule 006）
- ❌ 不要直接動 `runs/articles/` 內的 VFR 3 篇——它們的 status 改變是 commit 前的最後一步，等我 sign-off
- ❌ 不要用 `Write` 覆蓋既有檔——必須 `Read` + `StrReplace`（rule 006）
- ❌ 不要跳過 AskQuestion 直接做 VFR + field-log——等我回答再開新 plan

---

## 9. 如果遇到問題

| 症狀 | 處置 |
|------|------|
| 找不到某個檔案 | 先用 `Glob` 確認路徑 |
| commit SHA 找不到 | 先用 `git log --all --oneline \| Select-String -Pattern "<sha>"` 確認 |
| 想跳過 AskQuestion 直接做 | 停下來，先 AskQuestion |
| StrReplace timeout | PowerShell heredoc 在大檔案不穩定，改用 `Write` 整檔覆寫（**只限新建檔**）；改既有檔必須 StrReplace |
| push 失敗 | **不要** `--force`，先看錯誤訊息 |
| git status 出現 .pnpm / extraneous 警告 | 那是 lockfile 問題，參考 rule 015-cloudflare-pages-deploy.mdc |

---

## 10. 前 chat 結束時的工作摘要

| 工作 | 狀態 | 備註 |
|------|------|------|
| `20260808-admin-login-6-bug-chain-index.md` 建立 | ✅ | 85 行，8 個 commit SHA 全驗證 |
| `001-article-style.mdc` Step 4.5 + checklist 4 條補入 | ✅ | 檔案從 112 → 141 行 |
| `article-writing SKILL.md` Step 5.5 + Step 6 補入 | ✅ | 檔案從 150 → 199 行 |
| `handoff-20260808-article-series.md` 建立 | ✅ | 就是本檔 |
| commit | ⏸ 留給你 | 上面 Part 5 有完整流程 |
| push | ⏸ 留給你 | 規範層 commit 必 push |
| VFR 3 篇重寫 + field-log-01 | ⏸ 留給我 sign-off | 先 AskQuestion |

---

## 11. 前 chat 為什麼沒做完

最後一個 `StrReplace` 操作（更新 `article-writing/SKILL.md`）在 346 秒後 timeout。PowerShell heredoc 在 PowerShell 進程內不穩定。內容**已經成功寫入**（檔案從 150 → 199 行驗證過），只是工具層 timeout。

之後使用者說「我打算把工作帶去別的 chat」，所以這個 handoff 才被建立。

---

## 12. 一句話總結

> SAOME 文章系列全面更新計劃（field-log 系列規劃）。前 chat 完成：建立 admin-login 6 連環 index（驗證 8 個 commit SHA）+ 加 CTA 區塊 + 精簡原則到 rule/skill + 建立 handoff 檔。新 chat 接手做 2 個 commit + push，並評估是否繼續 VFR 3 篇重寫 + field-log-01 撰寫。

---

**新 chat 第一步**：跑 `git status --short` 確認 working tree 跟我離開時一致（見 Part 4），然後照 Part 5 流程做 commit。注意 handoff 檔本身要進 Commit 1。
