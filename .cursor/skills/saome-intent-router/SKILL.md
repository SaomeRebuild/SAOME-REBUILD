---
name: saome-intent-router
description: Use when the user expresses intent to add, remove, exclude, implement, amend, refactor, migrate, or deprecate a feature in natural language (e.g., "新增 FAQ accordion", "把 SocialProof 拿掉", "排除這個 section", "實作登入功能", "重構 Header", "從 mu-plugins 遷移會員邏輯", "deprecate 舊版 API"). Detects intent, confirms via AskQuestion, then routes to the matching spec-kit slash command or workflow.
---

# SAOME Intent Router

## 核心原則

這個 skill **不改程式碼、不生成 spec.md**。它做的三件事：

1. **識別動詞語意**（8 個動詞）
2. **AskQuestion 確認理解**（最多 1-2 題）
3. **委派給對應的 speckit-* / saome-* / workflow-* skill**

識別規則與對映表在 [references/verb-mapping.md](references/verb-mapping.md)。完整範例在 [examples.md](examples.md)。

## 為什麼需要

依 `constitution.md` L:118「禁止直接從 Agent 模式開始寫新功能」與 `001-methodology.mdc` L:58「必須用對應 slash command 產出 spec」，使用者一句話（「加個 FAQ / 拿掉 SocialProof / 實作登入」）必須被翻譯成 spec-kit 流程。

**沒有這個 skill 的失敗模式**（見 [RED baseline 記錄](runs/improvements/scenarios/20260725-red-phase-baseline.md)）：

- 5-12 題 AskQuestion 一次丟（違反 `brainstorming` L:72「one question per message」）
- 過度流程（把 amend 走成完整 9 階段）
- 沒考慮現有架構就緒度（backend skeleton 還沒建就開 auth spec）

## 觸發動詞（8 個）

| 動詞 | 繁中同義詞 | 對映 skill |
|---|---|---|
| `add` | 新增、加上、加個、增加、多一個 | speckit-specify（new 或 amend） |
| `remove` | 刪除、移除、拿掉、砍掉 | speckit-specify amend（先 brainstorming） |
| `exclude` | 排除、不算、不包含、跳過 | speckit-specify amend |
| `implement` | 實作、做、寫、跑、開始、執行 | speckit-implement |
| `amend` | 改、修正、調整、換成、改成 | speckit-specify amend |
| `refactor` | 重構、整理、拆開、合併、統一 | refactor skill + verification-before-completion |
| `migrate` | 遷移、搬過來、對應（從 mu-plugins） | migrate-from-wp workflow |
| `deprecate` | 暫停、標 deprecate、留著但不用 | brainstorming → speckit-specify amend |

完整對映見 [references/verb-mapping.md](references/verb-mapping.md)。

**debug 類短請求**（如「加個 console.log 確認 foo」）不適用本 skill，請走 `systematic-debugging` skill（Superpowers），本 skill 只處理 8 個動詞。

**user 預填詳細需求時**（如「加 FAQ，內容來源從 marketing 抄，5 題，預設全部收合」），仍要走 1 題 AskQuestion 確認「new / amend」，但**其餘需求直接採用** user 已提供的細節，不重問。

## AskQuestion SOP

**最多 1 題確認**（必要時第 2 題是「複雜度分級」）。絕對不超過 3 題。

### 問 1 題（基本）

```
Q1: 你的 [動詞] 是指？
- A. 新 feature（建立 specs/spec/<feature>/）
- B. Amend 既有 feature（[偵測到的 feature 名稱]）
- C. 其他（請說明）
```

### 問 2 題（動詞不明確時）

```
Q1: 「拿掉」是指？(delete / hide / deprecate 三選一)
Q2: 這個改動影響範圍？(只前端 / 跨後端 / 跨 DB)
```

### 絕對禁止

- ❌ 一次丟 5+ 題（違反 `brainstorming` L:72）
- ❌ 跳過 AskQuestion 直接動工（違反 `brainstorming` HARD-GATE）
- ❌ 列舉所有可能選項讓 user 從中挑選（違反 progression disclosure）
- ❌ 在 AskQuestion 內重述 spec-kit 流程（user 不用知道「spec-kit 是什麼」）

## 委派路由

**識別完動詞、AskQuestion 確認後**，委派給：

| 動詞 | 委派給 |
|---|---|
| `add` / `amend` | `speckit-specify`（帶 `amend` 或 `new` 旗標） |
| `remove` / `deprecate` | `brainstorming`（先）→ `speckit-specify` amend（後） |
| `exclude` | `speckit-specify` amend |
| `implement` | `speckit-implement`（前提：spec.md 與 tasks.md 已存在） |
| `refactor` | `refactor` skill + `verification-before-completion` |
| `migrate` | `.cursor/workflows/migrate-from-wp.md` |
| 未知動詞 | `AskQuestion` 釐清（不算 AskQuestion 用量） |

### 委派時的標準訊息

```
我識別到你的意圖是 [動詞] → [feature 名稱]。

這個改動會走以下流程：
1. [step 1]
2. [step 2]
...

如果你已經決定好要怎麼做，直接告訴我具體內容，我就照做。
如果你還沒決定，我可以陪你走 brainstorming 階段（一題一題問）。

要繼續嗎？
```

## 邊界（這個 skill 不做什麼）

- ❌ 不直接寫程式碼
- ❌ 不直接生成 spec.md（那是 speckit-specify 的職責）
- ❌ 不跳過 AskQuestion 直接動工
- ❌ 不取代 `saome-skill-router`（skill-router 管領域路由，intent-router 管動詞識別）
- ❌ 不覆蓋「看 / 解釋 / 為什麼」這類純問答（走 saome-skill-router 的 Ask 模式）

## 失敗模式（給 Self-Check 用）

| 失敗 | 嚴重性 | 應對 |
|---|---|---|
| 一次問 5+ 題 | 🔴 | 重寫成 1-2 題確認 |
| 跳過 AskQuestion 直接動工 | 🔴 | 永遠先問 |
| 沒識別動詞直接走 brainstorming | 🔴 | 先識別動詞 |
| 預設「拿掉」為 deprecate | 🔴 | 必須先問 |
| 預設「加」為 amend | 🟠 | 必須先問 |
| 走 `/speckit.constitution` 檢查無變更 | 🟡 | 沒改原則不需檢查 |
| 沒給 user 退路 | 🟡 | 永遠問「要繼續嗎？」 |
| 處理 debug 類短請求（`console.log` / `trace`） | 🔴 | 走 `systematic-debugging`，不是本 skill 職責 |
| user 預填詳細需求時重問所有細節 | 🟠 | 只問「new / amend」確認，其餘直接採用 user 已知 |

## 與相關 skill 的邊界

- **`saome-skill-router`**：管領域路由（提到 React 走 ui-ux-pro-max，提到 Hono 走 hono-skill）。**不動詞識別**。
- **`brainstorming`**（Superpowers）：管 HARD-GATE（必須先設計批准才能動工）。**不管動詞識別**。
- **`speckit-specify`**（spec-kit）：管 spec.md 產出。**不管動詞識別**。
- **`saome-intent-router`**（本 skill）：**只管動詞識別 + 確認 + 委派**。

## 強制規則（除非 user 明確反對，否則必須遵守）

- 識別動詞後**必須** AskQuestion 確認（不可預設）
- AskQuestion 最多 1-2 題（不可 5+ 題）
- 委派時**必須**明示會走的 spec-kit 流程（讓 user 知情）
- 委派時**必須**問「要繼續嗎？」（給 user 退路）
