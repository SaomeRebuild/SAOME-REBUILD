# Methodology Trigger Checklist

> SDD/BDD/TDD 方法論觸發條件速查手冊

## 觸發條件速查

### 新功能開發（完整流程）

| 情境 | 關鍵字 | 必需流程 | Skills |
|------|--------|----------|--------|
| 新功能（多檔） | 新功能、加功能、做頁面 | SDD + BDD + TDD + Review | brainstorming, speckit-specify, test-driven-development, run-smoke-tests, requesting-code-review |
| 新功能（單檔） | 新功能、做頁面 | SDD + TDD + Review | brainstorming, speckit-specify, test-driven-development, requesting-code-review |
| L2 業務元件 | L2 元件、業務元件 | SDD + BDD + TDD + Review | brainstorming, speckit-specify, test-driven-development, requesting-code-review |

### Bug Fix（精簡流程）

| 情境 | 關鍵字 | 必需流程 | Skills |
|------|--------|----------|--------|
| Bug fix | 修 bug、修復、fix | TDD + Review | test-driven-development, requesting-code-review |
| 複雜 bug | 修 bug、修復 | TDD + Review | test-driven-development, requesting-code-review |

### UI 開發（精簡流程）

| 情境 | 關鍵字 | 必需流程 | Skills |
|------|--------|----------|--------|
| L1 UI 元件 | L1 元件、UI 元件 | TDD + Review | test-driven-development, requesting-code-review |
| 改 UI | 改 UI、切版、rwd | TDD + RWD + Review | test-driven-development, requesting-code-review |

### 重構（視情況）

| 情境 | 關鍵字 | 必需流程 | Skills |
|------|--------|----------|--------|
| Breaking refactor | 重構、refactor、breaking | SDD + TDD + Review | speckit-plan, test-driven-development, requesting-code-review |
| 非破壞性重構 | 重構、改善 | TDD + Review | test-driven-development, requesting-code-review |

### Deploy 上線

| 情境 | 關鍵字 | 必需流程 | Skills |
|------|--------|----------|--------|
| Deploy | deploy、部署、上線 | Smoke Test | run-smoke-tests |
| Pre-deploy | 部署前、上線前 | Smoke Test | run-smoke-tests |

---

## 快速入口

| 環節 | Skill | 位置 |
|------|-------|------|
| 創意發想 | `superpowers:brainstorming` | 必須 |
| 寫 spec | `speckit-specify` | 必須 |
| 澄清 | `speckit-clarify` | 可選 |
| 規劃 | `speckit-plan` | 必須 |
| 任務 | `speckit-tasks` | 必須 |
| 分析 | `speckit-analyze` | 可選 |
| BDD | `.cursor/rules/012-bdd-workflow.mdc` | 必須 |
| TDD | `superpowers:test-driven-development` | 必須 |
| Smoke Test | `superpowers:run-smoke-tests` | 必須 |
| Code Review | `superpowers:requesting-code-review` | 必須 |
| 驗證 | `superpowers:verification-before-completion` | 必須 |
| 完成分支 | `superpowers:finishing-a-development-branch` | 必須 |

---

## 觸發關鍵字對照表

| 關鍵字 | 觸發流程 | 說明 |
|--------|----------|------|
| 「新功能」 | SDD + BDD + TDD + Review | 多檔新功能 |
| 「加功能」 | SDD + BDD + TDD + Review | 同上 |
| 「做頁面」 | SDD + BDD + TDD + Review | 同上 |
| 「修 bug」 | TDD + Review | Bug 修復 |
| 「修復」 | TDD + Review | 同上 |
| 「fix」 | TDD + Review | 同上 |
| 「改 UI」 | TDD + RWD + Review | UI 修改 |
| 「切版」 | TDD + RWD + Review | 同上 |
| 「rwd」 | TDD + RWD + Review | 同上 |
| 「加業務邏輯」 | SDD + BDD + TDD + Review | 業務功能 |
| 「重構」 | SDD + TDD + Review | 破壞性重構 |
| 「refactor」 | SDD + TDD + Review | 同上 |
| 「L1 元件」 | TDD + Review | UI 元件 |
| 「L2 元件」 | SDD + BDD + TDD + Review | 業務元件 |
| 「業務元件」 | SDD + BDD + TDD + Review | 同上 |
| 「deploy」 | Smoke Test | 部署 |
| 「部署」 | Smoke Test | 同上 |
| 「上線」 | Smoke Test | 同上 |

---

## 三系統驗證層次

| 系統 | 驗證什麼 | 工具 | 產出 |
|------|----------|------|------|
| SDD | 規格是否完整正確 | Spec-Kit | spec.md, plan.md, tasks.md |
| BDD | 行為是否符合預期 | Cucumber | *.feature, step definitions |
| TDD | 實作是否通過測試 | Vitest + RTL | *.test.tsx |
| Smoke | 核心功能是否正常 | Playwright | smoke test report |

---

## 觸發決策樹

```
收到使用者請求
    ↓
請求包含「新功能」「加功能」？
    ├── 是 → 走完整流程（SDD + BDD + TDD + Review）
    └── 否
        ↓
    請求包含「修 bug」「fix」？
        ├── 是 → 走 TDD + Review
        └── 否
            ↓
        請求包含「改 UI」「切版」？
            ├── 是 → 走 TDD + RWD + Review
            └── 否
                ↓
            請求包含「deploy」「部署」？
                ├── 是 → 走 Smoke Test
                └── 否
                    ↓
                請求包含「重構」？
                    ├── 是 → 走 SDD + TDD + Review
                    └── 否 → 默認走完整流程
```

---

## 憲法參照

本檢查清單基於以下規範：

- `.specify/memory/constitution.md` — 宪法原則 I-V
- `001-methodology.mdc` — Development Workflow
- `saome-methodology-bridge` skill — 完整觸發矩陣
