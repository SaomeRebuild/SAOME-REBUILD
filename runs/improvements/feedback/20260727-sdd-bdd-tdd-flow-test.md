# Feedback: SDD/BDD/TDD 流程補全測試結果

**日期**: 2026-07-27
**類型**: Self-Improvement

## 背景

執行「SDD/BDD/TDD 流程補全計畫」的 Phase 7 測試，以「會員等級顯示」功能為假開發目標，完整跑過：

```
brainstorming → speckit-specify → speckit-plan → speckit-tasks → BDD → TDD → Smoke Test → Code Review → Verification
```

## 結果

### 流程可運作 ✅

完整流程順利執行，產出了：
- spec.md, plan.md, data-model.md, tasks.md
- member-badge.feature
- step definitions
- MemberBadge.tsx + test + stories
- smoke test
- code review 報告
- verification 報告

### 流程可改善 ⚠️

Code Review 發現 14 個問題：
- **3 個 Critical**：C-1 (邏輯層硬編碼), C-2 (i18n 違反), C-3 (BDD step 缺失)
- **11 個 Important**：I-1 至 I-11
- **10 個 Minor**

## 根因分析

### 根因 1: 業務邏輯層誤放 i18n 字串

**症狀**: `getTierDisplayName('bronze')` 返回 `'金牌'` 而非 `'銅牌'`

**根因**:
- 沒有清晰劃分「業務邏輯」與「展示邏輯」
- shared/logic 應該是 locale-agnostic，但放進了硬編碼中文字串
- 缺少 i18n 的 rule 規範

**修法**:
- 刪除 `getTierDisplayName` from `shared/logic/`
- UI 字串必須走 `packages/shared/i18n/`
- 業務邏輯層不允許任何字串常值

**預防**:
- 新增 rule：`business-logic-agnostic.mdc`
- 在 `001-methodology.mdc` 加上明確的邊界
- 在 Code Review checklist 加入這項檢查

### 根因 2: BDD feature 與 step definition 不同步

**症狀**: "切換等級" 場景的 step pattern 沒有對應 definition

**根因**:
- 寫 feature 時沒有先檢查現有 step
- 沒有 BDD 驗證流程

**修法**:
- 修正 feature 改用現有 step
- 加 BDD 驗證到 constitution 流程

**預防**:
- BDD 必須先跑一遍驗證所有 step 都有對應
- 加入 CI/CD 跑 BDD test

### 根因 3: Code Review 在實作後才執行

**症狀**: Critical 問題到最後才發現

**根因**:
- Review 時機太晚
- 沒有在每個 task 完成後立即 review

**修法**:
- Code Review 應該在每個 task 完成後立即執行
- 不只是最後才 review

**預防**:
- 更新 `004-code-review.mdc` 強調「每個 task 完成後 review」
- 改用 subagent-driven-development 流程

## 學習

### 學習 1: 三層流程需要明確的契約

- **SDD** 定義「要什麼」
- **BDD** 定義「行為如何」
- **TDD** 定義「實作如何」
- 三者之間的契約必須清晰

### 學習 2: i18n 不是後續工作

- 從一開始就要走 i18n
- 不要在 shared/logic 放硬編碼字串
- 任何 UI 字串都要先在 i18n 註冊

### 學習 3: Code Review 是持續活動

- 不是「最後檢查」
- 是「每個 task 完成後」
- Critical 問題必須立即修復

## 改進建議

### 短期（本週）

1. ✅ 修正已發現的 3 個 Critical 問題
2. ⏳ 修正 I-5 (sm size 觸控目標)
3. ⏳ 為重要問題建立 follow-up issues

### 中期（下週）

1. 新增 `business-logic-agnostic.mdc` rule
2. 整合 Code Review 到每個 task
3. 為 BDD 加入 CI/CD 驗證

### 長期（未來）

1. 自動化 Code Review（每個 commit）
2. i18n 自動檢查工具
3. Spec 與 code 一致性驗證

## 相關檔案

- `.specify/memory/specs/spec/001-member-badge/verification.md` — 完整 verification 報告
- `.cursor/skills/saome-methodology-bridge/SKILL.md` — 流程整合
- `001-methodology.mdc` — 方法論總覽
