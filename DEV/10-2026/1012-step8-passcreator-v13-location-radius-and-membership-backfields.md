# 2026-10-12 — Step 8 v13 fix：地理位置 3 欄位 + 會員卡 backFields from tiers

> v9 → v12-followup deploy 到 staging 後 user 拿 3 張真實 production 模板實測 Step 8 push，發現 4 個 payload-level 漏推 / 漏源。本檔記錄 12-12 晚間單一會話從 user 回報 → root cause → TDD 修法 → 全綠的 trace。
>
> **完整根因 + 修法 + 18 條 test + 教訓**：見 `runs/improvements/feedback/20261012-step8-passcreator-v13-location-radius-initial-message-and-membership-backfields.md`（本 PR feedback — **必讀**）。
>
> **Step 8 整段 master view**：見 `1012-step8-passcreator-api-implementation-master-dev-log.md`（v4 → v13 全 13 輪迭代架構）。

## 一句話

把 v9 「`locations[]` 必推」粗略契約升級到 v13 「`locations[].name` + top-level `initialMessage` + top-level `locationsMaxDistance`」精準契約（4 個曾被忽略的欄位），並把會員卡 `backFields` 從統一的 `settings.backFields[]` 來源改成 cardType-aware switch（membership_card 攤平 `membershipTiers[].rewards[]`，其它 cardType 維持原行為）。**scope = 3 檔 src/test + 1 feedback + 1 DEV log + 1 INDEX entry**。

## Session timeline（UTC+8）

| 時間 | 事件 |
|---|---|
| 19:42 | user 拿 3 張 production 模板（`9e6abe2e / 738d9a5e / 07482c8d`）回報 v9-v12-deploy 後 Step 8 push 出 4 個 payload-level 漏：地理位置 name + initialMessage + locationsMaxDistance 三個 push 缺 / 會員卡 back 全空 |
| 19:43 | 開 task：L2 Standard（純 mapping 層，無 migration / 無 schema 變更 / 無跨模組），照 task-router 走 TDD 流程 |
| 19:45 | 讀 user 提供的 3 段 JSON 確認 4 個漏的 DB-side field 都已存在 (`settings.locations[].name`、`settings.initialMessage`、`settings.locationsMaxDistance`、`settings.membershipTiers[].rewards[]`)，shared schema 也有 (`packages/shared/schemas/card.ts`)，只缺 mapping 端讀 + push |
| 19:48 | 寫 feedback 開頭（症狀 1.1/1.2 + 根因 2.1/2.2/2.3 三段）+ 開始寫 4 個 describe block 的 RED 階段 |
| 19:52 | RED：4 describe × 18 條 test 全部 fail（confirm 原因：mapping 端 emit 缺欄位）|
| 19:55 | GREEN：`passcreator.ts` 介面加 3 optional + `passTemplateMapping.ts` 改 3 條（`locations[].name`、`initialMessage`、`locationsMaxDistance`）+ membership_card backFields 三向 source switch + empty-tiers fallback |
| 19:58 | 全測：35 files / 583 backend tests 全綠（從 565 升 18 條），typecheck exit 0 |
| 20:01 | conformance test 順手擴充：membership_card fallback 邊緣 case（tiers = [] + backFields 有料 → fallback）、非會員卡讀 `membershipTiers` 不應採（regression guard）|
| 20:03 | 完整 verify：typecheck + 583 tests + lint無新增 warning。**stop point**：等 user 確認 deploy + production 實測 |

## 4 個 payload-level 問題癥狀（user 直接回報）

| # | 問題 | user 端表現 | DB-side 欄位來源 |
|---|---|---|---|
| 1 | `locations[].name` 漏推 | iOS Wallet 推播顯示位置但每個 row 沒有 user-facing label | `settings.locations[].name` |
| 2 | top-level `initialMessage` 整個 key 沒推 | 下載後的歡迎推播沒出現 | `settings.initialMessage` |
| 3 | top-level `locationsMaxDistance` 整個 key 沒推 | 推播半徑用 PassKit 預設（非用戶設的 122 公尺）| `settings.locationsMaxDistance` |
| 4 | 會員卡 `backFields` 全空 | 會員卡詳細頁看不到會員福利內容 | `settings.membershipTiers[].rewards[]` |

## 根因（3 條獨立鏈，跟 v6/v7/v8/v9/v10/v11/v12 同家族的 contract-misread bug）

### 2.1 v9 對 `locations` row 漏了 `name`（對 V2 describe response 解讀不全）

v9 mapping 的 `locations[]` emit 用「最小 schema 解讀」只推 `{latitude, longitude, relevantText}`，docstring 還特別寫「Passcreator V2 schema 不含 `name`」 — 但 user 2026-10-12 確認 Passcreator V2 確實有 `locations[].name` 欄位。

**同家族前例**：v6 `colors` regex 漏 `#` prefix、v9 `images.strip` → `images.background` 重命名、v9 (V2 POST vs V1 PUT) — 全部都是「對 V2 contract 沒做端到端 schema 對照，只看到局部就寫 code」。

### 2.2 `initialMessage` 與 `locationsMaxDistance` 從來不在 mapping 待辦清單

mapping 是按「先看到 doc / example 寫什麼欄位」linear 推進，DB-side 跟 shared schema 已有的欄位如果沒在 doc 出現就跳過。`initialMessage` 與 `locationsMaxDistance` 是 PassKit 概念，**在 v2 doc 沒顯式提到，但 Passcreator V2 會接受**（user 端看到欄位在 Save 成功 → Passcreator V2 拿到但 mapping 沒 emit → wire-format 缺欄位）。

### 2.3 會員卡 backFields 來源被忽略

`settings.backFields[]`（Step 4 自訂 back）跟 `settings.membershipTiers[].rewards[]`（Step 6 tier rewards）是**兩個不同資料來源**對**同一個 wire-format 槽位**「PassKit `backFields`」的競爭。會員卡的 editor 設計是「Step 4 給空殼佔位 + Step 6 編輯 tier rewards」，但 mapping 統一從 `settings.backFields[]` 讀。

這是 v9 / v12-followup 從沒考慮的 cardType-specific source 差異。

## 修法（4 件）

### 3.1 `PasscreatorTemplateBody` 介面擴充（`apps/backend/src/shared/lib/passcreator.ts`）

| 欄位 | 必填 | 來源 | 備註 |
|---|---|---|---|
| `locations[].name?: string` | optional | `settings.locations[].name` | 為 v9 漏推補償；empty → omit |
| `initialMessage?: string` | optional | `settings.initialMessage` | empty → omit |
| `locationsMaxDistance?: number` | optional | `settings.locationsMaxDistance` | null → omit |

### 3.2 `mapTemplateToPasscreator` 3 條修改

| 修改 | 細節 |
|---|---|
| `locations[]` row 加 `name` 欄位 emit | 條件 `loc.name && loc.name.length > 0`，對齊 v9 「empty 不渲染」精神 |
| top-level `initialMessage` conditional spread | empty string omit key |
| top-level `locationsMaxDistance` conditional spread | `null` omit key |

### 3.3 會員卡 `backFields` 三向 source switch

```ts
const backFields = template.card_type === 'membership_card'
  ? (s.membershipTiers ?? []).flatMap((tier) =>
      (tier.rewards ?? [])
        .filter((r) => r.label.length > 0 || r.value.length > 0)
        .map((r) => ({ key: '' as const, type: 'text' as const, label: r.label, value: r.value })),
    )
  : (s.backFields ?? []).map((row) => ({ /* ... */ }));
```

**設計 SOP**（3 條矩陣）：

| cardType | 來源 |
|---|---|
| `membership_card` | `settings.membershipTiers[].rewards[]` 攤平 |
| 其他（discount / stamp / reward / cashback / coupon / gift / multipass）| `settings.backFields[]`（v9 行為）|
| membership_card 邊緣：tiers = [] + backFields 有料 | fallback 回 `settings.backFields[]`（不丟資料）|

**關鍵設計決策** — tier name **不**帶進 label：per user 2026-10-12 「rewards 裡面的 label、value 就是會員卡的 backFields」，所以 `rewards.label = "ao6"` + `rewards.value = "huohoij"` → 直接 emit 為一個 `backFields` row，沒有 prefix。

### 3.4 Conformance test 4 describe block × 17 條

| describe block | 條數 | 覆蓋 |
|---|---|---|
| `locations[].name (v13)` | 4 | name 推送 / empty 省略 / 有值時渲染 / `locationsDisabled=true` 時 array 整個省略（v9 contract 保留）|
| `initialMessage (v13)` | 3 | 推送 / empty 省略 / undefined 省略 |
| `locationsMaxDistance (v13)` | 4 | 推送 / null 省略 / undefined 省略 / 邊界值 1000 透傳 |
| `membership_card backFields from tiers (v13)` | 6 | user 真實資料 1:1 / 多 tier + 多 reward / 跳過空 row / 邊緣 fallback / 全空 / 非會員卡仍用 backFields |

## 4 層 schema 同步（Rule 019 §4.1）

純 mapping 層讀欄位，**沒**新增 schema / migration / request field，4 層皆已存在：

| 層 | 是否已對齊 |
|---|---|
| 1. `packages/shared/schemas/card.ts` | ✅ `initialMessage`, `locationsMaxDistance`, `locations[].name`, `membershipTiers[].rewards[]` 都已存在 |
| 2. `apps/backend/src/modules/cards/schemas/request.ts` | ✅ 自動透過 `Partial<TemplateSettings>` 涵蓋 |
| 3. `apps/backend/src/modules/cards/db/templates.ts::TemplateSettings` | ✅ 都已存在 |
| 4. service signature | ✅ 自動 |

> 觸發 4 層檢查：**沒**（純 mapping bug fix）。但確認 4 層都已對齊是**必跑**步驟（v12-followup `isPaid` extension drift 教訓，2026-08-22 修 Rule 019 §4.1）。

## Verification（Rule 006）

| 驗證項 | 指令 | 結果 |
|---|---|---|
| typecheck | `npm run typecheck --workspace=apps/backend` | ✅ exit 0 |
| unit test | `npm test --workspace=apps/backend -- --run` | ✅ **35 files / 583 tests passed**（從 565 + 18 升 583）|
| i18n | n/a | 純 mapping，無 i18n 變更 |
| schema conformance | n/a | 純 mapping，無 schema 變更，4 層已對齊確認完成 |
| build | n/a | 本次未跑 `wrangler deploy`，deploy 由 user 排程 |
| cost / 可觀測性 | n/a | mapping 函式無新增副作用 |

## 跟 v9-v12 batched commit 的策略

| Commit | 包含 |
|---|---|
| 本 commit | 本檔（DEV log）+ feedback + INDEX row + 3 檔 src/test 變更 = **6 檔** |

User 已確認「成功就 commit + push」(2026-10-12 20:03 user message) — 走 Rule 011 同 commit 路徑。

## 教訓（4 條，跟 v6-v12 整串 contract-misread bug 家族連續）

### T1 對 V2 API contract 必做端到端 schema 對照（v13 第 N 次修同家族）

v6 colors / v7 strip image / v8 V2 POST vs PUT / v9 locations top-level / v10 link scheme / v11 cross-reference / v12 data-driven mapFieldType / **v13 locations[].name + initialMessage + locationsMaxDistance + membership source switch** — 全部都是「對 V2 contract 沒做端到端 grep 對照」。

**修法 SOP**：寫 mapping 前先用 `GET /describe` endpoint 拿真實回應（不在 doc 改變、是真實 response），把所有 present key 對照 mapping emit 的 key **一次**。describe response 的 `data` 物件就是 contract 黃金標準。

**對應 master DEV LOG**：見 `1012-step8-passcreator-api-implementation-master-dev-log.md` §「5 條跨 12 輪的設計 invariant」第 1 條 canonical V2 describe response 必做端到端 grep。

### T2 cardType-specific 資料來源要分開讀

`settings.backFields[]` 跟 `settings.membershipTiers[].rewards[]` 對 membership_card 而言是**同一個 wire-format 槽位**的兩個來源，但對其它 cardType 而言後者根本不存在或不該讀。Mapping 必須以 `cardType` 為 switch。

**修法 SOP**：當 settings JSONB 內有多個 zod schema branch（membership tier vs backField），mapping 必須以 cardType 分流 source — 寫「哪個 cardType 讀哪個 source」的 explicit 矩陣（檔頭 docstring 明寫 3 條對照表）。

### T3 邊緣 fallback 寫在 mapping 層 vs 寫在 DB migration

會員卡 `membershipTiers = []` + `backFields = [有資料]` 的邊緣情境，理論上應該寫 DB migration 把舊的 backFields 轉到 membershipTiers — 但邊緣 case 的 trigger 條件複雜（要判斷 cardType + 兩個 array 都有意義）。

**修法 SOP**：邊緣 case 走 mapping 層 fallback（不 throw、不丟資料、不 silent error），同步在 conformance test 加一條保護。

### T4 「同 source 多欄位 emit」時 docstring 要顯式列 raw key 集合（v9 漏 `name` 的再次提醒）

v9 mapping docstring 寫「Per Passcreator V2 contract: {latitude, longitude, relevantText}」反而把這個誤判**鎖進文件** — 未來 contributor 讀 docstring 會誤信「`name` 不存在」。

**修法 SOP**：mapping emit docstring 必寫「對 V2 describe response raw key 集合」而不只寫「我們 emit 哪些 key」。v13 docstring 已改寫為「`name` (optional human-readable label for the location)」對齊 V2 contract。

## Future invariant（給未來 session）

| Invariant | 為什麼 |
|---|---|
| `locations[].name` 必 emit 當且僅當 `loc.name` 非空 | 對齊 V2 contract + 不渲染空 label |
| top-level `initialMessage` empty → omit | 對齊 V2 「empty 視為 no welcome notification」語意 |
| top-level `locationsMaxDistance` null → omit | PassKit 取 pass-type default；不顯式推 0 |
| membership_card backFields 來源 = `membershipTiers[].rewards[]` 攤平 | per user 2026-10-12 確認 |
| membership_card tiers=[] + backFields=有 → fallback | 保護 transition state |
| 其它 cardType backFields 來源 = `s.backFields[]`（v9 行為）| 不讀 membershipTiers 即使欄位存在 |
| tier name **不**帶進 reward label | per user「rewards 裡面的 label、value 就是會員卡的 backFields」|

## 待辦（next session，v14+）

- [ ] **production smoke test**：deploy v13 到 staging，用 3 張 production 模板各 push 一次，verify 4 個新欄位都出現在 `GET /describe` 回應 — owner: user deploy + production 實測後回報
- [ ] **`passTemplateMapping.ts` 已逼近 1000 行 refactor trigger** — Rule 000 § A.3 規範，當前行數待清點（v12 結束時 952 行 → v13 +80/-? 估 1030）。下個 session 跑 hook extraction：`mapTemplateToPasscreator` / `mapFieldType` / `buildAdditionalProperties` / normalizers 分離
- [ ] **rule 019 §4.1 新增一條嚴格觸發條件**：「當 mapping 改完 emit 欄位變更，先 grep `runs/improvements/feedback/` 是否在最近 N 個 session 內有同 family contract-misread bug（v6/v7/v9/v10/v13 已 5 次），命中則 mapping 端必加 source-driven test coverage」 — 把 T1 教訓機化為 rule
- [ ] **mapping emit 端的 docstring SOP**：所有 mapping emit 區塊的 docstring 必寫「V2 describe raw key 集合」（v13 T4 教訓落實）

## Cross-ref

- 主 feedback（必讀）：[`runs/improvements/feedback/20261012-step8-passcreator-v13-location-radius-initial-message-and-membership-backfields.md`](../improvements/feedback/20261012-step8-passcreator-v13-location-radius-initial-message-and-membership-backfields.md)
- Step 8 master DEV log：[`1012-step8-passcreator-api-implementation-master-dev-log.md`](./1012-step8-passcreator-api-implementation-master-dev-log.md)
- v9 (locations top-level)：[`runs/improvements/feedback/20261012-step8-passcreator-v9-structure-alignment.md`](../improvements/feedback/20261012-step8-passcreator-v9-structure-alignment.md)
- v12-followup (backFields 不鏡像)：[`runs/improvements/feedback/20261012-step8-passcreator-v12-followup-primary-secondary.md`](../improvements/feedback/20261012-step8-passcreator-v12-followup-primary-secondary.md)
- Rule 019 §4.1（4 層 schema 同步）：`.cursor/rules/019-schema-contract-drift.mdc`
- Rule 006（完工驗證）：`.cursor/rules/006-verification.mdc`
- Rule 011（commit 規範）：`.cursor/rules/011-dev.mdc`（feedback 同 commit）
