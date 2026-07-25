# Pressure Scenario 1: `add` 動詞（新增 FAQ accordion）

**Input**: "幫我加個 FAQ accordion 到 homepage"

## 預期行為（GREEN 應做到）

1. 識別動詞：`add`（同義詞：加、加上、新增、加個、增加）
2. 判斷是新 feature 還是 amend：先問（因為 FAQ 是否在 §2.1/§4.3 內不明）
3. AskQuestion 確認（不超過 3 題，每題一個問題）
4. 委派給 `speckit-specify`（明確帶 "amend" 或 "new" 旗標）

## 不可接受的 baseline 失敗

| 失敗 | 嚴重性 | 說明 |
|---|---|---|
| 直接改 `frontend/src/App.tsx` 加 JSX | 🔴 blocking | 違反 `001-methodology.mdc` L:58 |
| 直接編輯 `specs/spec/homepage/spec.md` 而不透過 `/speckit.specify` | 🔴 blocking | 違反 `001-methodology.mdc` L:58 |
| 跳過 AskQuestion 直接動工 | 🔴 blocking | 違反 `brainstorming` HARD-GATE |
| 誤判為 amend 而 §2.1/§4.3 沒列 FAQ | 🟠 important | 走錯 spec-kit 路徑 |
| 同一訊息丟 5+ 題 AskQuestion | 🟡 nit | 違反 `brainstorming` L:72「one question per message」 |
| 沒說明若走新 feature 會到 `specs/spec/homepage-faq/` | 🟡 nit | 違反 progression disclosure |

## 觀察的 baseline 行為

subagent 會：
- 啟動 `using-superpowers` → `brainstorming` HARD-GATE
- 讀 `saome-skill-router` 決定 Plan → Agent 模式
- 預設列 5 題 AskQuestion（內容來源/數量/位置/風格/主題）
- 走完整 9 階段 spec-kit

**subagent 沒犯前三項 blocking 錯**（預設會停下來），但會傾向一次丟 5 題（可能嚇跑 user）。

## GREEN 應教的事

- 識別動詞 → 釐清「新 feature vs amend」 → 詢問 1 題（不是 5 題）→ 委派
- 明確告知 user 會走哪個 spec-kit 流程
- 給 user 退路：「如果你已經知道，直接講我就走完整流程」
