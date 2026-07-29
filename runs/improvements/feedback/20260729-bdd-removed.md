# BDD 移除回顧（2026-07-29）

## 背景

2026-07-29 session 中，單人 vibe coding 場景下發現三個並發痛點：

1. **Token 燃燒速率過快**：每個任務無差別跑 brainstorming → speckit-specify → speckit-plan → speckit-tasks → 寫 `.feature` → step definitions → TDD，估計 token 消耗為「應該值」的 3–5 倍。

2. **簡單任務被當 L3 處理**：「把 Button 的 primary 改成 ghost」「把『金牌』改成『金級會員』」這種 L1 任務，也會走完整流程。

3. **單人場景下 BDD ROI 為負**：.feature 內容是 Given-When-Then 行為描述，不是歷史決策紀錄。

## 根因

SAOME 流程設計時參考了團隊導向方法論，沒對應到實際的單人 + AI agent 場景：

- 跨人溝通：團隊協作時 .feature 是共同語言；單人 vibe coding 時 vibe prompt 即溝通
- 跨 session 持久：團隊時 .feature 比 spec.md 詳細；單人時 spec.md + plan.md 已足
- UI 變動維護：團隊時 QA 同步 step defs；單人時沒人會同步 step defs
- ROI：團隊時高（多人共用）；單人時低（只給自己看）

## 修法

### 變更群 A：新增 Task Router skill

建立 `.cursor/skills/saome-task-router/SKILL.md`，含四級分流表：

| 等級 | 觸發條件 | 工作流程深度 |
|------|----------|--------------|
| L1 Trivial | 改 UI 屬性 / 修 typo | 直接做 → lint → test |
| L2 Standard | 新 L1/L2 元件 / bug fix | TDD → Verification |
| L3 Heavy | 新功能涉及多模組 | Brainstorming → Decision Log → TDD → Review → Smoke |
| L3 Escape Hatch | L3 + 需求含糊 | L3 Heavy + Spec-Kit 完整流程 |

### 變更群 B：砍 BDD 全套

刪除：
- `.cursor/rules/002-bdd.mdc`
- `.cursor/rules/012-bdd-workflow.mdc`
- 9 個 `.feature` 檔
- `packages/shared/bdd/` 目錄（含 Playwright 整合、Step Definitions）
- `test:bdd` / `test:bdd:watch` npm scripts
- `.cucumber.js` 設定檔

### 變更群 C：AGENTS.md 改寫

- 新增 Task Router 入口段（四級分流表）
- 新增已廢除項目清單
- 改寫 SDD/TDD 方法論整合段（移除 BDD 引用）

### 變更群 D：方法論規則更新

- `.cursor/rules/001-methodology.mdc`：從 SDD/BDD/TDD 改為 task-router 分流
- `.cursor/skills/saome-methodology-bridge/SKILL.md`：L3 Heavy 觸發時機

## 學習

1. **方法論要對應使用情境**：不是越完整越好，要對應實際的單人/團隊場景
2. **任務級距分流是剛需**：沒有 router，L1 任務會被當 L3 處理
3. **BDD ROI 與團隊規模成正比**：單人場景下 vibe prompt 即 BDD，不需要 `.feature`

## 影響

- 簡單任務不再被 BDD 拖慢
- Token 消耗預計降低 3–5 倍
- Step definitions 維護負擔消失
- Spec-Kit 流程從 always-on 改為 L3 Escape Hatch

## 附錄：刪除的檔案清單

| 檔案 | 大小 | 說明 |
|------|------|------|
| `.cursor/rules/002-bdd.mdc` | 1938 bytes | BDD 工作流程規則 |
| `.cursor/rules/012-bdd-workflow.mdc` | 3315 bytes | BDD 詳細流程 |
| `.specify/memory/specs/features/*.feature` | 5 個檔 | 行為描述（非決策紀錄） |
| `.specify/memory/specs/spec/002-tenant-auth/features/*.feature` | 5 個檔 | 行為描述（非決策紀錄） |
| `packages/shared/bdd/` | 12 個檔 | Cucumber config + step definitions + Playwright 整合 |
| `test:bdd` script | - | dryRun-only，實際不跑 |
| `test:bdd:watch` script | - | 空殼 echo |
| `.cucumber.js` | 1437 bytes | Cucumber 設定檔 |
