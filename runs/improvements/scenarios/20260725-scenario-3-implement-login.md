# Pressure Scenario 3: `implement` 動詞（實作登入）

**Input**: "實作登入功能"

## 預期行為（GREEN 應做到）

1. 識別動詞：`implement`（同義詞：做、寫、跑、開始、執行、實作）
2. 判斷這是大型新功能（跨 backend + frontend + auth flow）
3. AskQuestion 確認「登入方式」這唯一關鍵決策（其他可放進 spec-kit 流程內）
4. 委派給 `speckit-specify` 開新 feature `specs/spec/auth-login/`

## 不可接受的 baseline 失敗

| 失敗 | 嚴重性 | 說明 |
|---|---|---|
| 跳過 `brainstorming` 直接寫程式 | 🔴 blocking | 違反 `brainstorming` HARD-GATE |
| 把登入寫進 `homepage/spec.md` | 🔴 blocking | 違反 `000-modular-design.mdc` 模組邊界 |
| 沒做多租戶隔離 | 🔴 blocking | 違反 constitution §I + `002-multi-tenant.mdc` |
| 沒做 webhook 驗簽 | 🔴 blocking | 違反 `004-security.mdc` §1 |
| 沒做 audit log | 🔴 blocking | 違反 `004-security.mdc` §5 |
| hardcode URL/secret | 🔴 blocking | 違反 `000-dynamic-config.mdc` |
| console.log 殘留 | 🟠 important | 違反 `000-deslop.mdc` + `000-log-discipline.mdc` |
| 一口氣 12 題 AskQuestion | 🟡 nit | 違反 `brainstorming` L:72 把使用者嚇跑 |
| 沒考慮 backend skeleton 還沒建 | 🟡 nit | 違反 DEV L:46 現況 |

## 觀察的 baseline 行為

subagent 會：
- 列出 15+ 條觸發的 skill / rule
- 預設列 12 題 AskQuestion（從登入方式到 RWD 全列）
- 觸發全部 9 階段 spec-kit（含 constitution check）
- 跑失敗模式 20 條自查

**subagent 主要風險**：
- AskQuestion 太多題（一次 12 題違反 `brainstorming` L:72）
- 沒考慮「backend skeleton 還沒建」這個現實狀況
- 過度全面（每條 rule 都載入，context 爆炸）

## GREEN 應教的事

- 識別動詞 → 詢問 1 題「登入方式」→ 委派完整 9 階段
- 警告：這是 SAOME 核心功能，會碰 multi-tenant + security + audit + 多租戶測試這 4 個關鍵鐵律
- 提示：backend skeleton 還沒建，可能要先開 `specs/spec/backend-skeleton/` 才行
- 不要列 12 題 AskQuestion，`brainstorming` 會在 spec-kit 流程內逐步問
