# SAOME-REBUILD Constitution

> 2026 年重建的 React 19 前端專案，採用 SDD/BDD/TDD 三層方法論。

## Core Principles

### I. SDD-First（必須）

所有功能必須先完成規格才能實作：

- 每個功能需經過 spec → plan → tasks 三階段
- 禁止在沒有 spec 的情況下直接寫 code
- 規格文件位於 `.specify/memory/specs/` 目錄
- 使用 `speckit-specify` / `speckit-plan` / `speckit-tasks` 工具

### II. BDD-Validated（必須）

所有業務邏輯必須有對應的行為測試：

- 從 spec.md 抽出 `.feature` 檔案
- Feature files 位於 `.specify/memory/specs/features/`
- Step definitions 位於 `packages/shared/bdd/steps/`
- 執行 `npm run test:bdd` 必須綠燈

### III. TDD-Mandatory（不可妥協）

實作前必須先寫失敗測試：

- 使用 `superpowers:test-driven-development` skill
- Red-Green-Refactor 循環嚴格執行
- Coverage 門檻：整體 ≥ 80%，業務邏輯 ≥ 90%
- 禁止在沒有失敗測試的情況下實作

### IV. Superpowers-Integrated（必須）

創意工作必須走完整流程：

- 開始新功能前使用 `superstorms:brainstorming`
- 實作前使用 `superpowers:writing-plans`
- 完工前使用 `superpowers:verification-before-completion`
- 使用 `superpowers:requesting-code-review` 進行審查

### V. Mobile-Future-Proof（必須）

所有決策必須能回答「換成 React Native 需要改什麼？」：

- 業務邏輯放在 `packages/shared/`
- Web-only 程式碼明確標示（`.web.ts` / `.web.tsx`）
- 禁止在 component 內寫業務邏輯
- 禁止直接使用 Web-only API（localStorage、IntersectionObserver）

---

## Development Workflow

### 三層流程

```
User Request
    ↓
brainstorming (Superpowers) → 確認需求
    ↓
speckit-specify → spec.md (SDD 入口)
    ↓
speckit-plan → plan.md, data-model.md
    ↓
speckit-tasks → tasks.md
    ↓
抽出 .feature → BDD 入口
    ↓
test-driven-development (Superpowers) → TDD 入口
    ↓
Implementation → 實作代碼
    ↓
run-smoke-tests (Superpowers) → 冒煙測試
    ↓
requesting-code-review (Superpowers) → Code Review
    ↓
verification-before-completion (Superpowers) → 最終驗證
    ↓
finishing-a-development-branch (Superpowers) → 完成分支
    ↓
saome-self-improvement (SAOME) → 流程反省
```

### 觸發條件矩陣

| 改動類型 | 必走 SDD | 必走 BDD | 必走 TDD |
|----------|----------|----------|----------|
| 新功能（多檔） | ✅ | ✅ | ✅ |
| 新功能（單檔） | ✅ | ❌ | ✅ |
| L1 UI 元件 | ❌ | ❌ | ✅ |
| L2 業務元件 | ✅ | ✅ | ✅ |
| Bug fix | ❌ | 視情況 | ✅ |
| Breaking refactor | ✅ | ✅ | ✅ |

---

## Quality Gates

### 測試覆蓋門檻

| 類型 | 門檻 |
|------|------|
| 整體 | ≥ 80% |
| 業務邏輯 | ≥ 90% |
| UI 元件 | ≥ 70% |

### 品質檢查清單

- [ ] 遵守 modular design（業務元件一個資料夾）
- [ ] 遵守 mobile-first RWD
- [ ] 所有 UI 字串走 i18n key
- [ ] 無 hard-code hex 色碼
- [ ] 無直接使用 Web-only API
- [ ] 有對應的 Storybook + test

---

## Governance

### 版本管理

- 宪法版本遵循 Semantic Versioning（MAJOR.MINOR.PATCH）
- MAJOR：破壞性變更（原則移除或重新定義）
- MINOR：新增原則或大幅擴展
- PATCH：澄清、措辭修正

### Amendment 流程

1. 在 `.specify/memory/constitution.md` 提出變更
2. 說明變更理由與影響
3. 更新 `runs/improvements/feedback/` 中的相關 feedback
4. Commit message 標明 `Self-improvement:`
5. 通過 code review 後合併

### 強制遵守

- 宪法優先於其他實踐
- 所有 PR/reviews 必須驗證遵守情况
- 複雜度必須有正當理由
- 使用 `.cursor/rules/` 中的 runtime guidance

### 觸發關鍵字

| 關鍵字 | 觸發流程 |
|--------|----------|
| 「新功能」「加功能」 | SDD + BDD + TDD + Review |
| 「修 bug」 | TDD + Review |
| 「改 UI」 | TDD + RWD + Review |
| 「加業務邏輯」 | SDD + BDD + TDD + Review |
| 「重構」 | SDD + TDD + Review |
| 「L2 元件」 | SDD + BDD + TDD + Review |

---

**Version**: 1.0.0 | **Ratified**: 2026-07-27 | **Last Amended**: 2026-07-27
