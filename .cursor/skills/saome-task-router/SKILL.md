---
name: saome-task-router
description: 任務級距分流器 — 根據任務複雜度分流到對應深度的工作流程（L1 Trivial / L2 Standard / L3 Heavy / L3 Escape Hatch）。
---

# SAOME Task Router

> 任務級距分流器：避免簡單任務被當複雜任務處理，浪費 token 與時間。

## 目的

沒有「任務級距 → 流程深度」的路由器，L1 任務會被當 L3 處理。這個 skill 補上這個缺口。

## 四級分流表

| 等級 | 觸發條件 | 工作流程深度 |
|------|----------|--------------|
| **L1 Trivial** | 改 UI 元件屬性 / 修 typo / 改文案 / 加一行 console.log | 直接做 → lint → test |
| **L2 Standard** | 新 L1 元件 / 新 L2 業務元件 / 小 refactor / 一般 bug fix | TDD → Verification |
| **L3 Heavy** | 新功能涉及多模組 / 多層架構改動 / 跨 package 變更 / 需要架構決策 | Brainstorming → Decision Log → TDD → Review → Smoke |
| **L3 Escape Hatch** | L3 Heavy 但需求模糊 / 跨系統整合 / Breaking change | L3 Heavy + Spec-Kit 完整 spec/plan/tasks |

## 觸發時機

**任何新 session 開頭或收到新任務時，必須先跑 task-router**。

## Step-by-Step

### Step 1：分析任務複雜度

觀察任務的：
- 涉及檔案數量（1 個 vs 多個）
- 架構影響範圍（單層 vs 跨多層）
- 是否需要架構決策或 API 設計
- 是否涉及多人協作或跨團隊溝通

### Step 2：對照分流表

用 Step 1 的觀察結果對照四級分流表，選擇最合適的等級。

### Step 3：腦霧檢查（L1/L2 也適用）

即使任務看起來像 L1/L2，出現以下訊號時升級到 L3：
- 任務描述含糊（「做個好看的按鈕」）
- 涉及多個假設（「假設使用者會喜歡」）
- 任務描述時間明顯不足 5 分鐘
- 涉及商業邏輯或資料模型變更

### Step 4：標記級距

在回覆開頭明確標記：

```
[Task Level: L2 Standard]
```

### Step 5：例外升級

遇到以下情況，自動升級到 L3：
- 任務描述包含「新功能」「加功能」「做頁面」
- 任務涉及新 API endpoint 或 schema 變更
- 任務涉及多人協作或跨團隊溝通
- 任務時間估計超過 30 分鐘

## L1 Trivial 範例

- 「把 Button 的 variant 從 primary 改成 ghost」
- 「把『金牌會員』改成『金級會員』」
- 「修某個變數的 typo」
- 「加一行 console.log」

**做法**：直接實作 → lint → test

## L2 Standard 範例

- 「新增一個 L1 UI 元件」
- 「新增一個 L2 業務元件」
- 「修某個 function 的 bug」
- 「重構某個 service 的命名」

**做法**：TDD → Verification

## L3 Heavy 範例

- 「實作 LINE Pay 整合」
- 「新增會員等級系統」
- 「重構認證流程」
- 「實作多語系支援」

**做法**：
1. 寫 `runs/decisions/YYYY-MM-DD-<topic>.md`（三段式：背景 / 選項與決定 / 影響）
2. TDD
3. Code Review
4. Smoke Test

## L3 Escape Hatch 範例

- 「做一個電子商務平台」（需求含糊）
- 「實作 AI 推薦系統」（跨系統整合）
- 「把所有 API 改成 GraphQL」（Breaking change）

**做法**：L3 Heavy + Spec-Kit 完整流程（spec.md → plan.md → tasks.md）

## 禁止

- L1 任務跑完整 SDD → BDD → TDD 流程
- 不標記 Task Level 就開始實作
- 跳過 Brainstorming 直接跑 spec-kit（需求含糊時）
- L3 任務用 L1 的 shallow 處理（會欠技術債）

## 與其他 Skill 的關係

- `saome-methodology-bridge`：本 skill 是入口，決定走哪個流程深度
- `saome-self-improvement`：任何 session 結束前都要反省是否正確分流
- `brainstorming`：作為腦霧檢查的子工具，不是所有任務都要跑

## 參照

- `runs/improvements/feedback/20260729-bdd-removed.md` — 廢除 BDD 理由
- `AGENTS.md` — Task Router 入口段
