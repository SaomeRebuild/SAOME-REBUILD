# 動詞 → spec-kit 對映表

完整 8 個動詞的對映規則。每個動詞列：同義詞、典型輸入、對映 slash command、產出位置、特殊情況。

## `add` — 新增

**典型輸入**：「加個 FAQ accordion」、「新增 dark mode」、「加上任務搜尋功能」

| 項目 | 內容 |
|---|---|
| 對映 slash command | `speckit-specify` |
| 旗標 | 通常為 `new`（除非偵測到既有 feature 內的小擴充） |
| 產出位置 | `specs/spec/<feature_id>/spec.md` |
| 必跑前置 | `speckit-constitution` 檢查（無變更可跳過） |
| 必跑後置 | `speckit-clarify` → `speckit-plan` → `speckit-tasks` → `speckit-implement` |

**特殊情況**：
- 偵測到 input 內含既有 feature 名稱（例如「加 FAQ 到 homepage」）→ 改走 `amend` 路徑
- 涉及 UI 元件 → 提醒「需先跑 `ui-ux-pro-max` 評估」

## `remove` — 刪除

**典型輸入**：「把 SocialProof 拿掉」、「刪掉 Hero 區塊」、「移除舊版 API」

| 項目 | 內容 |
|---|---|
| 對映 slash command | `speckit-specify`（amend 模式） |
| 必跑前置 | `brainstorming`（確認 delete / deprecate / hide 三選一） |
| 必跑後置 | `speckit-tasks`（更新 tasks.md）→ `speckit-implement`（執行程式碼變更）→ `speckit-analyze` |

**特殊情況**：
- 「拿掉」必先問**精確定義**（刪除程式碼 / 隱藏 / deprecate 三選一），不可預設
- 影響面檢查：程式 / i18n / 規格 / BDD / DEV 紀錄 5 個地方同步清理
- 規格上的「delete」對應 spec.md 段落標記為「Removed via /speckit.specify amend <date>」而非真的刪檔（依 `011-dev.mdc` 精神）

## `exclude` — 排除

**典型輸入**：「排除這個 section」、「不算 RWD 測試」、「不包含 OAuth 登入」

| 項目 | 內容 |
|---|---|
| 對映 slash command | `speckit-specify`（amend 模式） |
| 必跑前置 | AskQuestion 確認「exclude」是 scope 排除還是 implementation 排除 |
| 必跑後置 | `speckit-plan` / `speckit-tasks`（更新） |

**特殊情況**：
- 與 `remove` 不同：`exclude` 不刪程式碼，只是「不在這個 feature 內做」
- 規格上標記為「Out of Scope（excluded via /speckit.specify <date>）」

## `implement` — 實作

**典型輸入**：「實作登入功能」、「做個 dashboard」、「寫 scanner panel」

| 項目 | 內容 |
|---|---|
| 對映 slash command | `speckit-implement` |
| 前提 | `spec.md` 與 `tasks.md` **必須**已存在 |
| 必跑後置 | `verification-before-completion`（必跑） |

**特殊情況**：
- 若 `spec.md` 不存在 → 退回 `add` 路徑（先 `speckit-specify`）
- 涉及後端 / DB / RLS → 提醒「多租戶 + 安全 + audit log 三條鐵律必踩」
- 涉及前端 UI 元件 → 提醒「需先跑 `ui-ux-pro-max` 評估」

## `amend` — 修改

**典型輸入**：「改一下 Hero 標題顏色」、「把 Login 換成 OAuth」、「修正 i18n key」

| 項目 | 內容 |
|---|---|
| 對映 slash command | `speckit-specify`（amend 模式） |
| 旗標 | `amend` |
| 必跑後置 | `speckit-tasks`（更新）→ `speckit-implement`（執行程式碼變更） |

**特殊情況**：
- 涉及 design token / 顏色 / 字型 → 改走 `ui-ux-pro-max` 評估（不直接 amend spec）
- 涉及商業邏輯（VIP 門檻、點數轉換率）→ 改走 `000-business-constants.mdc`（店家可自訂走 DB）
- 涉及 hardcode（URL、ID、數字）→ 提醒「需走 `000-dynamic-config.mdc`」

## `refactor` — 重構

**典型輸入**：「重構 Header 元件」、「整理 i18n locale」、「拆開 PricingSection」

| 項目 | 內容 |
|---|---|
| 對映 skill | `refactor` skill（Superpowers） |
| 必跑前後 | `test-driven-development`（先有測試保證）→ `verification-before-completion`（後） |
| 規格變更 | 輕微（檔案結構變更），通常不需 amend spec.md |

**特殊情況**：
- 涉及 module 拆分 → 提醒「需檢查 `000-modular-design.mdc` 檔案大小上限」
- 涉及 i18n locale 拆檔 → 提醒「需檢查 `003-i18n.mdc` 1000 行上限」
- 涉及功能變更（不只是結構）→ 退回 `amend` 路徑

## `migrate` — 遷移

**典型輸入**：「把 mu-plugins 的會員邏輯搬過來」、「從 PHP 轉成 TypeScript」、「對應舊版 API」

| 項目 | 內容 |
|---|---|
| 對映 workflow | `.cursor/workflows/migrate-from-wp.md` |
| 必跑前置 | 確認 `mu-plugins` 對應 Engine 與檔案 |
| 必跑後置 | `speckit-specify`（產出新 spec）+ `speckit-implement`（TDD 重寫） |

**特殊情況**：
- 不可直接複製 PHP 程式碼（依 `005-reference-mu-plugins.mdc`）
- 必須從 `000-glossary.mdc` 確認專業術語對應
- 商業邏輯需 spec.md §8 標「來源：<Engine 名稱>」

## `deprecate` — 標記廢棄

**典型輸入**：「deprecate 舊版 API」、「暫停這個 section」、「留著但不用」

| 項目 | 內容 |
|---|---|
| 對映 slash command | `speckit-specify`（amend 模式） |
| 必跑前置 | `brainstorming`（確認 deprecate 與 delete 的差異） |
| 必跑後置 | `speckit-tasks`（標 §X.Y 為 deprecated）→ 不刪程式碼 |

**特殊情況**：
- 程式碼**保留**（不刪），但加 `/** @deprecated since <date> */` JSDoc tag
- 規格段落標「Deprecated」而非刪除（依 `011-dev.mdc` 精神）
- 未來移除時走 `remove` 流程

## 跨動詞的特殊旗標

| 旗標 | 適用動詞 | 說明 |
|---|---|---|
| `NEW` | `add` | 建新 feature 資料夾 |
| `AMEND` | `add` / `remove` / `amend` / `deprecate` | 改既有 feature |
| `EXCLUDE` | `exclude` | scope 排除 |
| `BRAINSTORM` | `remove` / `deprecate` | 先 brainstorming |
| `TDD` | `implement` / `refactor` | 強制 TDD 流程 |
| `WORKFLOW` | `migrate` | 用 workflow 不用 slash command |
| `UI_EVAL` | `add` / `amend` | 需先跑 `ui-ux-pro-max` |
| `BACKEND_READY` | `implement` | 需先確認 backend skeleton 已建 |

## 使用方式

在 `speckit-specify` 內呼叫此 skill：

```bash
# 範例 1: 使用者說「加個 FAQ accordion」
# 1. 識別動詞：add
# 2. AskQuestion 確認：新 feature 還是 amend homepage
# 3. 委派：speckit-specify 帶 "new feature: homepage-faq" 或 "amend: homepage"

# 範例 2: 使用者說「把 SocialProof 拿掉」
# 1. 識別動詞：remove
# 2. AskQuestion 確認：delete / hide / deprecate
# 3. 委派：brainstorming → speckit-specify amend
```
