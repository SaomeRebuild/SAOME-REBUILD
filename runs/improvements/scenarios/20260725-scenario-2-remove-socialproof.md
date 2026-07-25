# Pressure Scenario 2: `remove` 動詞（刪除 SocialProof）

**Input**: "把 SocialProof 那個 section 拿掉"

## 預期行為（GREEN 應做到）

1. 識別動詞：`remove`（同義詞：刪除、移除、拿掉、砍掉）
2. **不**直接走 deprecate 流程（必須先問）
3. AskQuestion 確認「拿掉」的精確定義（delete / deprecate / hide）
4. 識別這是 amend 既有 feature（已在 §2.1/§4.3.2 內）
5. 委派給 `speckit-specify` 帶 "amend" + 提醒「spec-kit 0.14.3 沒有現成 amend CLI，需手動改 + 標記」

## 不可接受的 baseline 失敗

| 失敗 | 嚴重性 | 說明 |
|---|---|---|
| 預設走 deprecate | 🔴 blocking | 違反 `011-dev.mdc`「不準刪除已寫入的紀錄」精神（spec 要標記但不能刪） |
| 直接 `Edit frontend/src/App.tsx` 不同步 spec | 🔴 blocking | 違反 `006-verification.mdc` 前端 PR DoD |
| 漏清 5 個 i18n key × 2 locale = 10 處殘留 | 🟠 important | 違反 `003-i18n.mdc` |
| 漏更新 `tasks.md` §3.2 | 🟠 important | 違反 `constitution.md` §III Test-First（spec 是 source-of-truth） |
| 漏更新 `homepage.feature` Gherkin | 🟠 important | 違反 spec-kit 雙向閉環 |
| 沒跑 `verification-before-completion` | 🟠 important | 違反 constitution §III |
| 沒填 DEV handoff | 🟡 nit | 違反 `011-dev.mdc` |
| 過度流程（跑 `/speckit.constitution` 檢查） | 🟡 nit | 沒改原則不需檢查 |

## 觀察的 baseline 行為

subagent 會：
- 預設判為「amend 既有 spec」 ✅
- 預設列 5 題 AskQuestion（拿掉定義/i18n/測試/spec/BDD）
- 預期用 `/speckit.clarify` 補「拿掉」定義後手動改 spec.md
- grep 出所有引用面（程式/i18n/規格/BDD）

**subagent 主要風險**：把「拿掉」誤判為 deprecate（但有 AskQuestion 擋下，可能 context-dependent）

## GREEN 應教的事

- 識別動詞 → 詢問 1 題「delete / hide / deprecate 三選一」→ 委派 amend
- 給出刪除影響面 checklist（程式/i18n/規格/BDD）
- 警告：spec-kit 沒有現成 amend CLI，需手動改 + 加 `<!-- Amended ... -->` 標記
- 不用 AskQuestion 5 題，1 題確認 + 1 題複雜度確認即可
