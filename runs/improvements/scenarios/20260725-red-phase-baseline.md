# Red Phase Baseline：3 個 Pressure Scenarios 失敗記錄

> **建立於 2026-07-25**，saome-intent-router skill 尚未存在時的 baseline 測試。
> 依 `writing-skills` skill Iron Law：NO SKILL WITHOUT A FAILING TEST FIRST。

## 目的

在建立 `saome-intent-router` 之前，先觀察 subagent 在沒有這個 skill 時，面對 8 個動詞（add/remove/exclude/implement/amend/migrate/refactor/deprecate）的自然語言任務會怎麼處理，找出常見失敗模式。

## 3 個 Pressure Scenarios

| # | 動詞 | 輸入 | 記錄 |
|---|---|---|---|
| 1 | add | "幫我加個 FAQ accordion 到 homepage" | [scenario-1-add-faq.md](20260725-scenario-1-add-faq.md) |
| 2 | remove | "把 SocialProof 那個 section 拿掉" | [scenario-2-remove-socialproof.md](20260725-scenario-2-remove-socialproof.md) |
| 3 | implement | "實作登入功能" | [scenario-3-implement-login.md](20260725-scenario-3-implement-login.md) |

## Baseline 觀察摘要

### Subagent 已有的保護閘門（無需 intent-router 也能擋下）

1. `using-superpowers` → `brainstorming` HARD-GATE（L:13-14）
2. `001-methodology.mdc` L:58 + constitution §III（spec-kit 強制）
3. `saome-skill-router` L:118（模式選擇強制）

→ 3 個情境**都被擋下**，subagent 不會直接動工。
→ 不會直接編輯 `specs/spec/homepage/spec.md`，會用 `/speckit.specify` 或 `/speckit.clarify` 取代。

### Subagent 沒犯的錯誤（已驗證）

- ✅ 不直接編輯既有 spec.md
- ✅ 不跳過 AskQuestion 直接動工
- ✅ 不把「拿掉」預設為 deprecate（除非 context 暗示，會先問）
- ✅ 不把「加 FAQ」誤判為 amend（會傾向判為新 feature，但會先問）

### Subagent 仍會犯的失敗（intent-router 要解決的）

| 失敗 | 影響情境 |
|---|---|
| **AskQuestion 太多題**（5-12 題） | 1, 2, 3 — 違反 `brainstorming` L:72「one question per message」 |
| **過度流程** | 2 — 跑 `/speckit.constitution` 檢查但其實不需要 |
| **沒考慮現有架構就緒度** | 3 — backend skeleton 還沒建就開新 spec |
| **沒給 user 退路** | 1, 2, 3 — 沒有「如果你知道答案，直接告訴我」 |
| **沒在動詞識別階段明示 spec-kit 流程** | 1, 2, 3 — 直接跳進 brainstorm 但沒說明 |

### Subagent 沒預期但意圖相關的 8 個動詞

| 動詞 | 觸發詞 | 對映 |
|---|---|---|
| `add` | 加、加上、新增、加個 | speckit-specify (new 或 amend) |
| `remove` | 刪除、移除、拿掉、砍 | brainstorming → speckit-specify amend |
| `exclude` | 排除、不算、不包含、跳過 | amend 流程，標記 excluded |
| `implement` | 實作、做、寫、跑、開始 | speckit-implement |
| `amend` | 改、修正、調整、換成、改成 | speckit-specify amend |
| `refactor` | 重構、整理、拆開、合併、統一 | refactor skill + verification-before-completion |
| `migrate` | 遷移、搬過來、對應（從 mu-plugins） | migrate-from-wp workflow |
| `deprecate` | 暫停、標 deprecate、留著但不用 | brainstorming → speckit-specify amend |

## 結論

1. **現有閘門已能擋下大部分重大錯誤**，intent-router 不是「為了擋 X 行為」而設計
2. **intent-router 真正價值**：
   - 統一 8 個動詞的識別 → 對映到 spec-kit 流程
   - 控制 AskQuestion 數量（最多 1-2 題確認）
   - 給 user 退路（知道答案就直接走）
   - 提示現有架構就緒度（避免「backend 還沒建就開 spec」）
3. **GREEN phase 應教的核心**：
   - 動詞識別 → 1 題確認 → 委派
   - 完整 8 動詞 → 對映 spec-kit 流程
   - 移除「過度流程」與「題海」兩個反模式
