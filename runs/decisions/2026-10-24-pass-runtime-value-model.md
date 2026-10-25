# Decision：Pass runtime value 模型

- **日期**：2026-10-24
- **更新日期**：2026-10-25（追加「超額消費與時間語意」四條決定）
- **狀態**：已採用
- **影響範圍**：`packages/shared/logic/`、`packages/shared/schemas/`、`apps/backend/src/modules/pass-templates/`、`apps/backend/src/shared/lib/passcreator/`、`supabase/migrations/20261024000001_028_init_pass_events.sql`

## 背景

模板層早就鋪好了 `{balance}`、`{giftPoints}`、`{memberExpiry}` 等交叉引用，但 `issuePass()` 目前只送四個欄位：

```
memberName / phone / birthday / email
```

所以 Wallet 上真正代表 runtime value 的欄位（餘額、點數、到期日）**全部是空的**。這不是漏寫，而是從來沒有「持卡人 runtime value 這件事」的資料模型——`pass_holders` 只有交付欄位與 V3 發行結果欄位，沒有任何一個地方記錄「這個持卡人目前有多少點數」。

同時六份討論計畫提出了互相衝突的方向：獨立 counter table、獨立 balance table、preview 直接讀持卡人真值、`N − M` carryover 立即實作。每一個各自都合理，但合起來沒有單一 source of truth，會各自漂移。

另外有兩個必須先釐清的技術前提：

1. **Passcreator V3 的更新 endpoint 是 PATCH，不是 POST。** 官方 contract（`https://developer.passcreator.com/en/api/v3/pass`）明確寫著 PATCH 只更新提供的欄位，POST 會**刪除**未提供的資料。任何「更新既有 Pass」的方案如果誤用 POST，會把使用者的 Pass 清空。
2. **`packages/shared/logic/pass.ts::calculateExpirationDate()` 是死碼**（零 caller，且只回 `Date`）。它不能直接重用——runtime value 需要的是可序列化的字串格式（Passcreator 要 `Y-m-d H:i`），不是 `Date` 物件。

## 選項與決定

### 決定一：事件帳本為唯一 source of truth，快照只是衍生資料

- **選項 A**：建 `pass_holder_counters`（獨立計數表）＋ `pass_holder_balances`（獨立餘額表），每次更新都寫兩處。
- **選項 B**：建 append-only 的 `public.pass_events` 事件帳本；`pass_holders.pass_values_snapshot` 是可隨時重建的衍生快照。

**決定：選項 B。**

理由有三層。

第一層是**寫入語意**。餘額這類「目前值」用 counter table 表達，每次交易都要「讀 → 算 → 寫」，中間任何一次失敗就會留下不一致。而事件帳本是 append-only：事件進來就 append，狀態由事件重放得出。這讓「冪等」變成 DB 層的自然性質（唯一 idempotency key 約束），而不是應用層要小心翼翼維護的東西。

第二層是**可審計性**。餘額表只能回答「現在是多少」，回答不了「為什麼是這個數」。事件帳本兩者都能答，而且未來 Scanner 的每一筆交易（造訪、集章、換獎、退款）在帳本裡是同一種東西——不需要為每一種交易都改 schema。

第三層是**衝突迴避**。六份計畫裡有三份各自提議建表，三張表各自對「餘額」有不同定義。三張表同時存在時，「哪張是對的」是個無法回答的問題。單一帳本消滅這個問題。

**不建 counter / balance table** 這條也寫進 Scanner 後續計畫的封鎖條件——在 Scanner 語意確定前，任何額外的彙總表都只是猜測。

### 決定二：註冊初始值與未來事件共用同一套計算

- **選項 A**：`buildInitialValues()` 直接回傳最終 state；事件還原是另一條獨立路徑。
- **選項 B**：`buildInitialValues()` 產生一個 `registered` event，之後走**同一個** reducer。

**決定：選項 B。**

這看起來只差一行，但它是整個模型能不能長大的關鍵。如果註冊走 A、Scanner 事件走 B，兩條路徑的語意會在第一個真實 Scanner 事件進來時立刻分歧——而分歧的症狀會是「余額對不起來」，排查成本極高。

讓註冊也走事件，就得到一個不變式：**任何 snapshot 都能由事件重放得出**。這個不變式同時也是回填（backfill）安全的前提——回填既有 46 筆持卡人時，每筆補一個 `registered` event 後重放，就得到跟當初首次註冊完全一致的結果。

### 決定三：issue 與 PATCH 共用同一份 formatter output

- **選項 A**：`issuePass()` 與 `updatePassValues()` 各自組 payload。
- **選項 B**：兩者消費同一份 `formatPassValues()` 的輸出。

**決定：選項 B。**

Passcreator V3 的 `POST /api/v3/pass`（建立）與 `PATCH /api/v3/pass/{identifier}`（更新）攜帶的是**同一種 payload**。若各自組裝，第一次簽發送出的值與後續 PATCH 送出的值就會有格式差異（例如一個送 `100`、一個送 `"100"`），而 Wallet 端對 number / string 的處理並不完全一致。共用 formatter 讓「首次簽發」與「事後更新」在 payload 層面完全同構。

**wire contract 明確為**（不是舊計畫的 `{headerFields, secondaryFields}` 抽象）：

```ts
interface PasscreatorPassValues {
  storedValue?: number;
  expirationDate?: string; // Passcreator: Y-m-d H:i
  properties: Record<string, string | number>;
}
```

`properties` 只包含模板**實際綁定**的 header／left／right key。不送未啟用欄位（會覆蓋使用者的既有資料），也不把 numeric 欄位轉成貨幣字串（`100` 保持 number，Passcreator 端的 number 型別有專門的顯示格式）。

### 決定四：Preview 維持模板示意，不承載持卡人真值

- **選項 A**：preview 讀取持卡人 runtime 真值。
- **選項 B**：preview 維持 demo 數值；真值只在首次簽發與後續 PATCH 時送出。

**決定：選項 B。**

Preview 是設計示意工具（租戶在 Step 1–7 選卡種時看效果），不是持卡人視圖。把持卡人真值塞進 preview 會讓 preview 變成「某個持卡人的卡」，與它的用途衝突；而且 preview 的資料源是編輯器 store（單一進行中的編輯 session），不是持卡人資料表——要接真值等於讓 preview 依賴一個它不需要的資料來源。

（此處保留 `pass-holder-counter-model_9fbdc4c7` 計畫中唯一有價值的一條：「preview 維持 demo、首次簽發送真值」。）

### 決定五：Scanner 事件契約本輪不實作

- **選項 A**：本輪一併定義 Scanner 的 canonical event variants（visit / stamp / points / spend / coupon redemption / refund）與冪等規則。
- **選項 B**：本輪只做 `registered` event；Scanner 契約留待後續計畫。

**決定：選項 B。**

Scanner 語意涉及四個尚未有答案的業務問題：同日重複消費要不要累計、request replay 怎麼去重、退款怎麼沖銷、`N − M` carryover 的 `M` 從哪來。這四個問題的答案會直接改變 event schema 的形狀。在沒有業務答案的情況下先寫 schema，等於把猜測固化成契約——之後要改就要動 migration。

因此本輪的 reducer 只處理 `registered` 與純粹的數值增減（`points_delta` / `spend_delta` 這類不涉及去重語意的事件），Scanner 特有的事件 variant 全部留到 blocked 計畫。

### 決定六：不重用既有的 `calculateExpirationDate()`

- **選項 A**：重用 `packages/shared/logic/pass.ts::calculateExpirationDate(startDate, durationDays): Date`。
- **選項 B**：新建 `packages/shared/logic/passExpiry.ts`，統一 membership / coupon / discount 三種期限規則，輸出可序列化字串。

**決定：選項 B。**

既有函式有兩個問題：它是死碼（零 caller，代表沒有經過實戰驗證），而且回傳 `Date` 物件——runtime value 必須可 JSON 序列化進 `pass_events.payload` 與 `pass_values_snapshot`，`Date` 物件在 JSONB 裡會變成 ISO 字串但型別資訊遺失。

新模組統一三種期限模式（`never` / `duration_days` / `specific_date`），並且**以 UTC 基準計算**以避免時區偏移——這是必須有測試釘住的不變式（「日期不因時區偏移」）。

### 決定七：同步失敗不回滾帳本

- **選項 A**：append event 與呼叫 Passcreator 在同一個 transaction；外部 API 失敗就 rollback。
- **選項 B**：transaction 內只做「append event → reduce → 寫 snapshot」；commit 後才呼叫 Passcreator PATCH。

**決定：選項 B。**

DB transaction 不能涵蓋外部 HTTP 呼叫——外部服務不在 transaction 控制範圍內，把 HTTP 放進 transaction 會讓 transaction 變成「等待網路」，且失敗時必須 rollback 已寫入的帳本，等於**因為下游故障而丟失真實事件**。這是事件帳本最不能接受的失敗模式。

正確的分界：帳本與快照是一個 atomic 單位（DB 保證），對外同步是 eventual consistency（重推保證）。重試時以 snapshot 重推，**不重複增加數值**——因為重推的是「目前狀態」，不是「增量」。

## 影響

### 新增

- `packages/shared/schemas/passValues.ts` — 事件 / 快照 Zod 契約
- `packages/shared/logic/passValueCalculator.ts` — `buildInitialValues()` / `reducePassValues()`
- `packages/shared/logic/passFieldFormatter.ts` — canonical state → `PasscreatorPassValues`
- `packages/shared/logic/passExpiry.ts` — 統一期限規則
- `packages/shared/constants/headerSlots.ts` — 8 卡種 header 歸屬單一來源
- `apps/backend/src/modules/pass-templates/db/passEvents.ts` — 事件帳本 SQL
- `apps/backend/src/modules/pass-templates/services/passValueService.ts` — 帳本 / 快照 / 同步 service
- `supabase/migrations/20261024000001_028_init_pass_events.sql` — `public.pass_events` + `pass_holders.pass_values_snapshot`

### 修改

- `apps/backend/src/shared/lib/passcreator/transport.ts` — method union 加入 `PATCH`
- `apps/backend/src/shared/lib/passcreator/v3-pass.ts` — 新增 `updatePassValues()`
- `apps/backend/src/shared/lib/passcreator/v3-pass-types.ts` — 新增 payload 型別
- `apps/backend/src/modules/pass-templates/db/passHolders.ts` — row interface / SELECT / RETURNING 加入 `pass_values_snapshot`
- `apps/backend/src/modules/pass-templates/db/templates.ts` — 修正過窄的 `settings` 型別（SQL 實際回傳完整 JSONB）
- `apps/backend/src/modules/pass-templates/services/registerService.ts` — 建立 `registered` event + 初始 snapshot；首次簽發帶初始值
- `packages/shared/i18n/fieldLabels.ts` + 兩個 locale — 改讀 header slot spec
- `apps/frontend/.../CardPreview/passCardPreviewSlot.ts` + `PassCardPreviewHeader.tsx` — 共用 resolver

### 不變

- 既有 `pass_holders` 欄位語意（`purchased_points` / `gift_card_snapshot` 等）不動
- 既有 `templates.settings` JSONB 結構不動（只修 TypeScript 型別讓它如實反映 SQL 回傳）
- Public DTO 暴露範圍不動
- Preview 渲染行為不動（Phase 1 只收斂重複實作）

### 已知限制

- **Scanner 事件語意未定** — 本輪的 reducer 只處理 `registered` 與純數值增減；Scanner 特有的去重 / 退款 / carryover 留待 blocked 計畫。
- **既有 46 筆持卡人沒有 runtime value** — backfill 必須先 dry-run，且**不應自動 bulk PATCH production Pass**。回填只補帳本與快照；對外同步要人工挑一張受控測試 Pass 先驗證。
- **Passcreator PATCH 失敗無自動重試佇列** — 本輪只保證「帳本不回滾 + 可重推」；queued retry / manual resync UI 屬 Scanner 計畫範圍。

## 補充：超額消費與時間語意（2026-10-25 追加）

本節記錄 2026-10-25 由產品負責人拍板的四條語意，補上 `2026-10-24` 決定一～七未涵蓋的空白：消費超額怎麼處理、哪些 metric 可以是負數、哪些 metric 可以是小數、事件時間戳怎麼比對。既有決定一～七不變。

### 背景

`2026-10-24` 的決定定義了事件帳本（append-only ledger）與純函式 reducer（`reducePassValues()`），但只回答了「怎麼存」與「怎麼重放」，沒有回答「什麼樣的事件不合法」。四個缺口：

1. **超額消費在契約裡無法表示。** `packages/shared/schemas/passValues.ts` 的 `metric_delta` 事件只帶 `metric` 與 signed `delta`（負數＝扣減），契約層沒有任何欄位表達「這次扣減超過持卡人餘額」。reducer 目前的行為是 `metrics[metric] + delta`，不做任何 domain validation——超額消費會靜靜把 metric 折成負數，而事件一旦寫入帳本就不可撤回。
2. **負數的邊界沒有唯一來源。** `carryoverBalance` 語意是 `N − M` 差值，中間值為負是它要表達的狀態；其餘 metric 是累加器，負數只代表資料錯了。若不把「哪些 metric 允許負值」寫成單一清單，schema 層與 reducer 層會各自猜測。
3. **小數的邊界不能由呼叫端自行 round。** 點數、集章數、造訪次數是計數，小數是 bug；`spendAccumulated` 是累計消費金額（currency amount），`199.99` 是正常值。這個差別必須是契約的一部分。
4. **混合時區 offset 會錯排帳本。** `passEventTimestampSchema` 以 `z.string().datetime({ offset: true })` 接受帶 offset 的 ISO-8601，但 reducer 目前以字串比較排序（`a.at < b.at`）。`2026-10-24T23:00:00+08:00` 與 `2026-10-24T16:00:00Z` 是同一時刻，字串比較卻會排出錯誤先後，快照因此取決於 offset 寫法而非真實時間先後。

### 選項與決定

#### 決定八：超額消費拒絕，不寫帳本

- **選項 A**：clamp 到零並寫入事件（超出餘額的部分消失）。
- **選項 B**：允許餘額為負，代表債務。
- **選項 C**：以 domain error 拒絕該事件，且不寫入帳本。

**決定：選項 C。**

一個會把非負 metric 推低於零的消費事件，以 `PassValueDomainError` 拒絕：事件**不寫入**帳本、持卡人餘額**不 clamp** 到零、且持卡人之後仍可再次消費。這條規則必須同時落在 schema 層與 reducer，並以 `PassValueDomainError` 呈現。

理由：選項 A 讓帳本與餘額不一致——事件記錄扣了 300，餘額只少了 100，之後任何重放都無法對齊，使用者也看不出少了一筆消費。選項 B 把「額度用盡」變成「欠款」，但本模型沒有債務語意，runtime value 也沒有單一通用 `balance` 欄位（per-metric 拆分理由見 `packages/shared/schemas/passValues.ts` 檔頭說明）；負餘額會一路流進 Passcreator payload 與 Wallet 顯示。選項 C 讓帳本維持 append-only 且事實正確：被拒絕的消費從未發生，因此沒有事件、沒有扣款、餘額不動，呼叫端收到明確的 domain error（而非 500），可以回覆「餘額不足」並讓持卡人再次嘗試。

#### 決定九：只有 carryoverBalance 可以是負數

- **選項 A**：只有 `carryoverBalance` 允許負值。
- **選項 B**：沒有任何 metric 允許負值。
- **選項 C**：`carryoverBalance` 與 `balance` 都允許負值。

**決定：選項 A。**

`carryoverBalance` 是 `N − M` 差值，中間值為負屬於它的定義；其餘 metric（`giftPoints`、`pointsBalance`、`spendAccumulated`、`visitCount`、`stampCount`）全部非負。選項 B 讓 `N − M` 差值無法表達中間狀態；選項 C 的 `balance` 在本模型中不存在（runtime value 沒有單一通用餘額欄位），允許一個不存在的 metric 為負沒有語義。

#### 決定十：只有 spendAccumulated 的 delta 可以是小數

- **選項 A**：只有 `spendAccumulated` 的 `delta` 可以是小數。
- **選項 B**：所有 metric 的 `delta` 都必須是整數。

**決定：選項 A。**

`spendAccumulated` 是累計消費金額，小數是正常業務值；其餘 metric 是計數語意，小數只會是資料錯誤。選項 B 在還原貨幣金額時會產生取整損失，也把「計數」與「金額」兩種語意壓成同一條規則。

#### 決定十一：接受任何帶 offset 的 ISO-8601，排序前正規化為 UTC

- **選項 A**：只接受 UTC（`Z`）。
- **選項 B**：接受任何帶 timezone offset 的 ISO-8601 datetime，reducer 在排序前把 timestamp 正規化為 UTC。
- **選項 C**：接受任何帶 timezone offset 的 ISO-8601 datetime，但不做正規化。

**決定：選項 B。**

無 timezone 的 datetime 與 date-only 值一律拒絕。選項 A 迫使 Scanner 與所有事件來源在寫入前先換算時區，把時區轉換責任推給呼叫端；選項 C 正是目前 reducer 的行為——以字串比較排序，混合 offset 會錯排。選項 B 把「接受什麼格式」與「如何排序」分開：格式由 schema 層定義，排序正確性由 reducer 保證，正規化後混合 offset 的帳本排序與全 UTC 帳本排序完全一致。

### 影響

- **共享 zod schema**（`packages/shared/schemas/passValues.ts`）：`metric_delta` 的合法範圍（超額拒絕、負值 metric 白名單、小數白名單）與 `at` 的接受格式需反映在契約層。schema 層規則是 reducer 層規則的子集——它擋掉「單看 delta 就能判斷非法」的情況，而「delta 本身合法、但套用後會把目前值推成負數」只能由 reducer 在重放時判斷。`PASS_VALUE_NON_NEGATIVE_METRICS` 與 `PASS_VALUE_INTEGER_METRICS` 兩個白名單已存在，決定九／十的 metric 範圍由它們表達；待補的是 `metric_delta` 的 delta 層驗證。`at` 的接受格式（帶 offset 必填、無 timezone 與 date-only 拒絕）已由 `passEventTimestampSchema` 落實。
- **reducer**（`packages/shared/logic/passValueCalculator.ts`）：`reducePassValues()` 套用 `metric_delta` 前需檢查結果值，超額時拋 `PassValueDomainError` 且不變更任何狀態；排序需改為以 UTC 正規化後的時間戳比較，取代目前對 `a.at` / `b.at` 的字串比較。
- **domain error 契約**（`packages/shared/logic/passValueErrors.ts`）：`PassValueDomainError` 已提供 `passValue.error.negativeMetric` 這個 i18n-key-shaped code 與結構化 `details`，決定八的拒絕直接沿用它，不新增 error code。
- **後端註冊服務**（`apps/backend/src/modules/pass-templates/services/registerService.ts`）：註冊產生的 `registered` 事件帶初始 metrics，須滿足非負與整數規則；domain error 需映射成 4xx 業務錯誤，不得逸出成 500。
- **backfill worker**（`apps/backend/scripts/pass-runtime-values-backfill-worker.ts`）：回填既有持卡人時會重放歷史事件。若歷史事件觸發 domain error，worker 須將其視為該筆資料異常、記錄後跳過，不得靜默改寫數值，也不得因此阻塞整批回填。
- **Passcreator PATCH payload 形狀**（`packages/shared/logic/passFieldFormatter.ts` → `apps/backend/src/shared/lib/passcreator/v3-pass.ts`）：payload 形狀不變（仍是 `storedValue` / `expirationDate` / `properties`），但送出的值因決定八／九而保證非負；`carryoverBalance` 為負時的呈現沿用既有 formatter 規則。
- **Conformance tests**（`packages/shared/schemas/passValues.test.ts`、`packages/shared/logic/passValueCalculator.test.ts`、`apps/backend/src/modules/pass-templates/tests/passValues.conformance.test.ts`）：需新增或更新下列案例。

決定八（reducer 以 domain error 拒絕超額消費）與決定十一（排序前 UTC 正規化）的**實作由另一個 work item 進行**；本節只記錄語意與驗收條件。

實作完成後必須存在的 conformance tests：

1. reducer 拒絕會把非負 metric 推低於零的消費事件，拋出 `PassValueDomainError`，且帳本狀態完全不變。
2. `carryoverBalance` 可以是負值；其餘所有 metric 不可為負。
3. `spendAccumulated` 接受小數 `delta`；其餘所有 metric 拒絕小數 `delta`。
4. `at` 拒絕 date-only 與無 timezone 的值、接受任何帶 offset 的值；reducer 對混合 offset 帳本排出的順序與 UTC 正規化後的順序完全一致。

## 參照

- `runs/plans/2026-10-24-pass-runtime-values-roadmap.md` — Roadmap 索引與六份舊計畫的取代關係
- `runs/plans/2026-10-24-pass-scanner-event-semantics.md` — blocked 的 Scanner 後續計畫
- `runs/decisions/2026-10-19-pass-holder-v3-issuance.md` — V3 發行流程與 runtime 欄位
- `runs/decisions/2026-10-23-gift-card-paid-registration.md` — 贈品卡購買（`purchased_points` 來源）
- https://developer.passcreator.com/en/api/v3/pass — PATCH 只更新提供的欄位；POST 會刪除未提供的資料
