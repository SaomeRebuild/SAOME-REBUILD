# Scanner Event Semantics（blocked）

- **日期**：2026-10-24
- **狀態**：**BLOCKED** — 不可啟動實作
- **影響範圍**：`packages/shared/schemas/passValues.ts`、`packages/shared/logic/passValueCalculator.ts`、`apps/backend/src/modules/pass-templates/`、Scanner 模組（尚未建立）

## 這份計畫為什麼是 blocked

本輪的 Pass runtime value 模型（事件帳本 + 快照 + Passcreator 同步）已經就位，但 **Scanner 端的業務語意還沒有答案**。Scanner 的每一筆交易要怎麼算，會直接改變 `pass_events` 的 event schema 形狀。在業務答案確定之前先寫 schema，等於把猜測固化成契約 —— 之後要改就要動 migration，而 migration 已經 apply 到 production 了。

因此本計畫只列出「必須先回答的問題」與「答案會怎麼影響資料模型」，**不含實作**。

解除 blocked 的條件：下列 6 個問題全部有明確的業務答案，並寫成 Decision Log。

## 必須先回答的 6 個問題

### Q1 — Scanner 的 canonical event variants 有哪些？

已知的可能型態：

| 變體 | 觸發 | 影響的 metric |
|---|---|---|
| visit | 到店掃碼 | `visitCount` |
| stamp | 集章 | `stampCount` |
| points | 消費賺點 | `pointsBalance` |
| spend | 消費金額累計 | `spendAccumulated` |
| coupon_redemption | 折價券核銷 | （待定）|
| refund | 退款沖銷 | （待定）|

**需要決定**：哪些變體進 `passEventSchema`（`packages/shared/schemas/passValues.ts` 的 discriminated union），哪些是同一個 `metric_delta` 的不同參數。`metric_delta` 已經是通用的（metric 名 + delta），但 refund 的語意可能不是「加一個負數」那麼簡單（它可能需要沖銷一筆特定的 earn，而不只是抵減總額）。

### Q2 — 同日重複要不要累計？

同一個持卡人同一天掃碼兩次：

- **全部累計**（每次造訪都算）
- **當日只計第一次**（同日重複不累計）
- **由商家決定**（Scanner 請求帶一個 flag）

**為什麼重要**：這決定了 Scanner 端需要多少狀態。「當日只計第一次」需要知道「這個人今天已經算過了嗎」—— 那是 per-holder-per-day 的狀態，而事件帳本是 per-holder 的 append-only 串流。要從事件串流裡重播出「今天已經有沒有算過」，需要事件裡帶足夠的資訊（日期 + 業務類型），或者接受重播成本。

### Q3 — request replay 怎麼去重？

網路重試、Scanner App 重送、使用者快速連點，都可能讓**同一筆交易**被送兩次。

**需要決定**：

- idempotency key 用什麼？（外部 transaction id？Scanner 產生的 request id？兩者組合？）
- key 的 scope 是 per-holder 還是全域？

ledger 已經有 `UNIQUE (pass_holder_id, idempotency_key)` 這個約束，**key 的內容定義好之後就只是填值**。但 key 的產生規則決定了「同一筆交易」在系統裡怎麼被辨識 —— 這個規則一旦上線就不能改（改了會讓新舊事件對不上）。

### Q4 — `N − M` carryover 的正式 event 與 reducer 是什麼？

`balance-carryover-semantics_64a14f71` 那份舊計畫提出的規則是「在一個期間內 grant N 點、用了 M 點，期末 carryover = N − M」。這需要回答：

- 期間的邊界是什麼？（自然月？會員週期？滾動 30 天？）
- 期間結束時，是「把剩餘的搬到下期」還是「每期重新計算」？
- 期間內的 `pointsBalance` 顯示什麼？（總餘額？當期剩餘？）

`carryoverBalance` 這個 metric 欄位**已經在 schema 裡佔好位**（`passValuesMetricsSchema`），所以 state shape 不需要改。但它的 event 語意還沒定義。

### Q5 — cashback 是否退出 `balance` 槽位？

現在 `cashback_card` 的 header `balance` 槽位放的是 `spendAccumulated`（累計消費金額）。這個安排有點怪 —— 「餘額」槽位顯示「已消費多少」。

**需要決定**：

- 保留現狀（`balance` 槽位 = 累計消費）
- 改成 `balance` 槽位 = 折價券剩餘張數（另一個 metric）
- cashback 卡改用不同的 header kind

**注意**：這個決定會動到 `packages/shared/constants/headerSlots.ts` 的 `HEADER_SLOT_KIND_SPECS`，而那個 spec 同時被 frontend preview、backend template push、runtime formatter 三邊共用。所以改這裡是三處同步的事。

### Q6 — Scanner API、交易入庫與 event append 的原子邊界是什麼？

Scanner 交易會同時觸碰：交易入庫 + `pass_events` append + `pass_holders.pass_values_snapshot` 更新 + Passcreator PATCH。

**需要決定**：

- 哪些在同一個 DB transaction 裡？（append + snapshot 已經是同一個 —— `applyPassEvent` 的既有設計）
- 交易入庫跟 event append 是同一個 transaction 嗎？
- Passcreator PATCH 失敗時，交易算成功還是失敗？（現在的設計：帳本不回滾，sync 是 eventual consistency）

## 這些答案會怎麼影響資料模型

| 問題 | 影響 |
|---|---|
| Q1 | `passEventSchema` 的 union 成員；migration 028 的 `event_type` CHECK 約束要擴寬 |
| Q2 | event payload 要帶的資訊；reducer 的冪等性語意 |
| Q3 | `idempotency_key` 的產生規則（DB 層不用改，約束已存在）|
| Q4 | 可能需要新的 metric + 新的 event variant；`carryoverBalance` 的 reducer 邏輯 |
| Q5 | `headerSlots.ts` spec + frontend preview + backend template push + runtime formatter（四處同步）|
| Q6 | 可能需要新的 service / 新的 DB transaction 邊界 |

## 解除 blocked 後的第一批工作（預估，不含實作細節）

1. **Decision Log**：`runs/decisions/YYYY-MM-DD-pass-scanner-event-semantics.md`，把 Q1–Q6 的答案寫成三段式決策。
2. **擴寬 migration**：`pass_events.event_type` 的 CHECK 約束加上新的 event variant（依 Q1 的答案）。
3. **擴充 shared schema**：`passEventSchema` 的 union 成員（依 Q1）。
4. **擴充 reducer**：`reducePassValues` 學會 fold 新的 variant（依 Q1 + Q4）。
5. **Scanner API**：新的 backend module（routes / services / db / schemas）—— 目前還沒有 Scanner 模組。
6. **Sync 失敗的重試佇列**：現在只有「帳本不回滾 + 可重推」，沒有 queued retry，也沒有 manual resync UI。

## 封鎖期間的禁令

在 Q1–Q6 全部有答案之前，**不得**：

- ❌ 新增 `pass_holder_counters` / `pass_holder_balances` 這類彙總表（Decision Log § 決定一已封鎖）
- ❌ 在 preview 顯示持卡人的 runtime 真值（Decision Log § 決定四已封鎖）
- ❌ 在 `passEventSchema` 裡猜測 Scanner 的 event variant
- ❌ 擴寬 migration 028 的 `event_type` CHECK 約束

## 已就位、本計畫可以直接用到的基礎設施

| 基礎設施 | 位置 | 說明 |
|---|---|---|
| 事件帳本 | `public.pass_events` | append-only，UNIQUE (holder, idempotency_key) |
| 快照快取 | `pass_holders.pass_values_snapshot` | 可由帳本重播重建 |
| Reducer | `packages/shared/logic/passValueCalculator.ts::reducePassValues` | 純函式，事件 → 快照 |
| Formatter | `packages/shared/logic/passFieldFormatter.ts::formatPassValues` | 快照 → Passcreator payload |
| Transaction 邊界 | `apps/backend/src/modules/pass-templates/services/passValueService.ts::applyPassEvent` | append + replay + snapshot 在同一個 transaction；PATCH 在 commit 之後 |
| Metric 分離 | `packages/shared/schemas/passValues.ts::PASS_VALUE_METRICS` | `giftPoints` / `pointsBalance` / `carryoverBalance` / `spendAccumulated` / `visitCount` / `stampCount` 各自獨立 |

## 參照

- `runs/decisions/2026-10-24-pass-runtime-value-model.md` — 決定一（帳本為唯一 source of truth）、決定五（Scanner 契約本輪不實作）
- `runs/plans/2026-10-24-pass-runtime-values-roadmap.md` — 六份舊計畫的取代關係
- `C:/Users/user/.cursor/plans/balance-carryover-semantics_64a14f71.plan.md` — `N − M` carryover 的原始提案（本計畫 Q4 的來源）
- `C:/Users/user/.cursor/plans/pass-holder-counter-model_bdec14f8.plan.md` — 獨立 counter table 提案（已 superseded）
