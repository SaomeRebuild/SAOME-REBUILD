# 2026-10-12 Step 8 v13 fix — 地理位置三欄位 + 會員卡 backFields 來源

> **對應 commits**: 待 user 驗證後 commit，跟 v9-v12 batched
> **日期**: 2026-10-12
> **類型**: bug fix（L2 Standard — 純 mapping 層，無跨模組/無 schema 變更）
> **根因**: v9 fix 寫 `locations[]` row 時只參考 Passcreator V2 describe response 的最小 schema (`{latitude, longitude, relevantText}`)，漏了三個 pass-level / per-row 欄位；會員卡 backFields 從未考慮過 cardType-specific 來源差異。

**對齊**:
- `runs/improvements/feedback/20261012-step8-passcreator-v9-structure-alignment.md` (v9 修 links / logoText / auxiliaryFields / 條件 locations)
- `runs/improvements/feedback/20261012-step8-passcreator-v10-link-scheme-normalization.md`
- `runs/improvements/feedback/20261012-step8-passcreator-v11-cross-reference-fields.md`
- `runs/improvements/feedback/20261012-step8-passcreator-v12-followup-primary-secondary.md`
- `runs/improvements/feedback/20261012-step8-passcreator-v12-data-driven-mapfieldtype.md`

---

## 1. 症狀

User 2026-10-12 把 v9-v12 修完部署後拿 3 張 production 模板實測 Step 8 push，發現 4 個 payload-level 問題：

### 1.1 地理位置 three fields 漏推

user 提供的 production 模板資料（template id `9e6abe2e-49f5-4e34-abd3-69c2b338ce65`）：

```json
"locations": [{
  "name": "asfasfasdfasfd",
  "latitude": 25.147231388482524,
  "longitude": 121.41076270166438,
  "relevantText": "dfasfdsafd"
}],
"initialMessage": "asfasf",
"locationsDisabled": false,
"locationsMaxDistance": 122
```

v9 推送後實際拿到的 Passcreator template：
- (a) `locations[].name` = **漏推** — 每個 row 沒有 user-facing label
- (b) `initialMessage` (top-level) = **整個 key 沒推** — 下載後的歡迎推播沒出現
- (c) `locationsMaxDistance` (top-level) = **整個 key 沒推** — 推播半徑用 PassKit 預設而非用戶設的 122 公尺
- (d) `locations[]` 本身有推（v9 fix 已對齊），但每個 row 缺 `name` 欄位

### 1.2 會員卡 back 全空

user 提供的 production 模板資料（template id `738d9a5e-7f25-414b-b0d9-0c3abce8cf52`）：

```json
"backFields": [{"label": "", "value": ""}],
...
"membershipTiers": [{
  "name": "嗯嗯",
  "rewards": [{"label": "ao6", "value": "huohoij"}],
  ...
}]
```

v9 / v12 推送後會員卡 `fields.backFields` = `[{label:"", value:""}]`（空殼）— 真正的 會員福利內容完全沒推到 Passcreator。

user 訊息原文：
> 「會員卡的backFields的填寫方式比較特別，他的標籤與值是在會員等級的row裡面... rewards 裡面的 label、huohoij 就是會員卡的 backFields，注意，這種作法只有在會員卡生效」

---

## 2. 根因

### 2.1 v9 對 `locations` row 漏了 `name`

`apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` v9 (line 752 區段)：

```ts
// 修前
locations: (s.locations ?? []).map((loc) => {
  const out: { latitude: number; longitude: number; relevantText?: string } = {
    latitude: loc.latitude,
    longitude: loc.longitude,
  };
  if (loc.relevantText != null && loc.relevantText.length > 0) {
    out.relevantText = loc.relevantText;
  }
  return out;
}),
```

註解還特別寫：

> Per Passcreator V2 contract (describes `locations` row shape): `{latitude, longitude, relevantText}`. The `name` field is SAOME-specific (Step 5 tenant-facing label) and is stripped before the push — Passcreator's V2 schema does not include `name` on the `locations` row.

但 user 2026-10-12 確認 **Passcreator V2 確實有 `locations[].name` 欄位**（optional string, human-readable label）— v9 是基於對 V2 describe response 的「最小 schema 解讀」就決定 strip，沒去驗證完整 schema。

### 2.2 `initialMessage` 與 `locationsMaxDistance` 從來不在 mapping 待辦清單

v9 的 location 區塊只處理了 `locations[]` + `locationsDisabled` toggle。`initialMessage` 與 `locationsMaxDistance` 是 PassKit / Apple Wallet 概念，存在 shared schema (`packages/shared/schemas/card.ts`) 跟 DB (`templates.settings` JSONB) 內，但 mapping 沒去讀。

這跟 v6 `colors` regex 漏了 `#` prefix、v9 `images.strip` 漏推 — 同類 bug：**對 V2 contract 沒做端到端 schema 對照，只看到局部就寫 code**。

### 2.3 會員卡 backFields 來源被忽略

`settings.backFields`（Step 4 自訂 back fields）跟 `settings.membershipTiers[].rewards[]`（Step 6 會員卡專用 tier rewards）是 **兩個不同的資料來源**。但 v9 / v12-followup 的 mapping 一律從 `s.backFields` 讀，沒區分 cardType。

會員卡編輯流程是：
- Step 4 給空殼 `backFields = [{label:'', value:''}]`（預設佔位，使用者不會編輯）
- Step 6 編輯 membershipTiers 與每個 tier 的 rewards sub-rows

所以會員卡真正要推到 Passcreator 的 back 內容 = `membershipTiers[].rewards[]` 攤平，而不是 `backFields[]`。

這個 source 差異是 v9 / v12-followup 從來沒考慮過的 — 因為 Step 4 / Step 6 的 editor 是分開的、Step 4 的 zod schema 對 backFields 用 `.optional()`（沒強制非空）、Step 6 的 membershipTiers 是另一個 zod schema 分支（`z.array(z.object({...rewards...}))`），mapping 層沒去看 cardType 對資料來源的影響。

---

## 3. 修法

### 3.1 Type 介面擴充

`apps/backend/src/shared/lib/passcreator.ts::PasscreatorTemplateBody` 加 3 個 optional 欄位：
- `locations[].name?: string`（per-row human-readable label）
- `initialMessage?: string`（top-level, push-notification body after download）
- `locationsMaxDistance?: number`（top-level, pass-level notification radius in meters）

### 3.2 mapping 邏輯 — `mapTemplateToPasscreator`

- `locations[]` row 擴充：把 `name` 加進 type 與 emit 條件（empty 時不 emit，避免上游 UI 渲染空 label）
- 新增兩個 conditional spread：empty `initialMessage` / null `locationsMaxDistance` → omit key
- `const backFields = ...` 改為三向 source 邏輯：
  1. `cardType === 'membership_card'` → 攤平 `membershipTiers[].rewards[]`（每 row 變一個 backField row，tier name **不**帶進 label — per user 確認「rewards 裡面的 label、value 就是會員卡的 backFields」）
  2. 其它 cardType → 維持 `settings.backFields[]`（v9 行為）
  3. 邊緣 fallback：會員卡 + `membershipTiers` 是空 + `settings.backFields[]` 非空 → 退回 `settings.backFields[]`（保護 transition state — 用戶可能先建 backFields 再建 tier）
- 把下游 `fields.backFields` 與 `buildAdditionalProperties` 的 `backFields` 參照都改用 `finalBackFields` 變數

### 3.3 Conformance Test

`apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts` 加 4 個 describe block，共 18 條 test：

| describe block | test 數 | 覆蓋 |
|---|---|---|
| `locations[].name (v13)` | 4 | name 推送 / name empty 省略 / name 為空時不渲染 / locationsDisabled=true 時整個 array 省略（v9 contract 保留）|
| `initialMessage (v13)` | 3 | 推送 / empty 省略 / undefined 省略 |
| `locationsMaxDistance (v13)` | 4 | 推送 / null 省略 / undefined 省略 / 邊界值 1000 透傳 |
| `membership_card backFields from tiers (v13)` | 6 | user 提供的真實資料 1:1 還原 / 多 tier + 多 reward 攤平 / 跳過空 row / 邊緣 fallback / 空全空 / 非會員卡仍用 backFields（v9 行為 regression guard）|

### 3.4 Schema drift 守門

4 層 schema 同步（Rule 019 §4.1）已對齊：
- Layer 1 `packages/shared/schemas/card.ts` — `initialMessage`, `locationsMaxDistance`, `locations[].name`, `membershipTiers[].rewards[]` 都已存在
- Layer 2 `apps/backend/src/modules/cards/schemas/request.ts` — 自動透過 `Partial<TemplateSettings>` 涵蓋
- Layer 3 `apps/backend/src/modules/cards/db/templates.ts::TemplateSettings` — 都已存在
- Layer 4 service signature — 自動

本次純 mapping 層讀欄位，**沒**新增 schema / migration / request field，無 4 層同步問題。

---

## 4. 教訓

### 4.1 對 V2 API contract 要做端到端 schema 對照

v9 跟 v6 (`colors` `#` prefix)、v9 (`images.strip` → `images.background`)、v9 (V2 POST vs V1 PUT) 都同類 — 對 upstream contract 沒做端到端驗證。

**修法 SOP**：寫任何 mapping 之前，先用 `GET /describe` endpoint 拿一份真實回應，把所有 present key 對照 mapping emit 的 key 一次。describe response 的 `data` 物件就是 contract 的黃金標準 — 用真實 response 對，不要靠 docs example 對（docs example 是 illustrative subset，不是 full schema）。

### 4.2 cardType-specific 資料來源要分開讀

`membershipTiers[].rewards[]` 跟 `backFields[]` 對 membership_card 而言是互斥的，但對其它 cardType 而言 `membershipTiers` 根本不存在或不該讀。mapping 層用 `cardType` 分流 source 是必要的。

**修法 SOP**：當資料 source 在 settings JSONB 內有多個 zod schema branch（如 membership vs backField），mapping 必須以 cardType 為 switch — 寫「哪個 cardType 讀哪個 source」的 explicit 矩陣（見 `cardType` 表格加在 `passTemplateMapping.ts` 檔頭 docstring）。

### 4.3 邊緣 fallback 寫在 mapping 層 vs 寫在 DB migration

會員卡 `membershipTiers = []` + `backFields = [有資料]` 的邊緣情境，理論上應該寫一個 DB migration 把舊的 backFields 轉到 membershipTiers — 但這條邊緣 case 的 trigger 條件太複雜（要判斷 cardType + 兩個 array 都有意義），mapping 層加 fallback 比較實際。

**修法 SOP**：邊緣 case 走 mapping 層 fallback（不 throw、不丟資料、不留 silent error），同步在 conformance test 加一條保護。

---

## 5. 跟 v9-v12 batched commit 的策略

User 偏好「feedback 在實作當下 commit」（Rule 011）。這次 v13 修法跟 v9-v12 同性質（mapping layer bug fix），**同 commit batched**：
- commit footer 列 migration 不適用（沒 migration）
- 一次 commit 含：
  - `feat(pass-templates): push locations[].name + initialMessage + locationsMaxDistance + membership-tier backFields (v13)`
  - 對應 `runs/improvements/feedback/20261012-step8-passcreator-v13-*.md`（本檔）

如果 user 想要獨立 commit 也可以分開 — 但 dev log 的 feedback 一定要跟 code 同 commit（per Rule 011）。

---

## 6. 預期部署後驗證

deploy 到 staging 後用同一張 production 模板重 push，預期拿到：
- `locations[0].name = "asfasfasdfasfd"` ✓
- top-level `initialMessage = "asfasf"` ✓
- top-level `locationsMaxDistance = 122` ✓
- membership_card 模板 `fields.backFields` 含 `[{"key":"","type":"text","label":"ao6","value":"huohoij"}]` ✓

可手動 curl `GET /api/v2/pass-template/{id}/describe` 比對回應 — 4 個新欄位都應 present。
