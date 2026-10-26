# Decision：card schema 拆分為目錄 + 後端鏡像收斂

> 日期：2026-10-26 ｜ 分類：架構層（跨 package 契約重構）

## 背景

`packages/shared/schemas/card.ts` 單檔 1,099 行，其中 `templateSettingsSchema` 佔 654 行 / 63 個 top-level key。

**檔案太大帶來兩個實際問題**：

1. **代理讀取成本高** — 為修改一個小問題（例如 multipass 的一個欄位下限）必須讀完整份檔案；Rule 038 的 300 行切片閱讀紀律在這個檔案上直接失效。
2. **維護成本高** — 同一份契約在 repo 裡有**兩份**：shared 的 `card.ts` 與後端 `apps/backend/src/modules/cards/schemas/request.ts`（579 行手寫鏡像）。

**鏡像已經漂移，而且漂移被一個假綠的測試蓋住**：

| 位置 | `multipassTiers[].perSpendAmount` 約束 |
|---|---|
| shared `card.ts` | `z.number().positive()` — 接受任何 `> 0` 的值 |
| backend `request.ts` | `.positive().min(MULTIPASS_STAMPS_PER_SPEND_MIN)` — 要求 `≥ 0.01` |

實測 `perSpendAmount: 0.005` → shared 接受 / backend 拒絕。

現存的 conformance test 名為「shared perSpendAmount must be ≥ 0.01」，但只斷言 `0` 拋錯、`0.01` 不拋錯 —— `.positive()` 同樣滿足這兩條，**測試是假綠的**，真正的約束漂移從未被任何測試捕捉到。

線上 runtime parse 只發生在 `routes/create.ts:27` 與 `routes/update.ts:28`，兩者吃的都是**後端鏡像**；shared schema 當時僅供型別推導與測試使用，不是線上驗證者 —— 這代表「先收緊 shared、收斂後端」對線上行為零影響。

## 選項與決定

### 選項 A：只把 `card.ts` 拆成目錄，後端鏡像維持手寫

- **優點**：改動面小，只動 shared。
- **缺點**：鏡像仍在，漂移的根因（兩份契約）沒被消除；下一個 agent 加欄位時照舊要同步兩個檔案。**不採用。**

### 選項 B：拆目錄 + 後端收斂成純 re-export（✅ 採用）

1. **`packages/shared/schemas/card/`**（目錄 + `index.ts` barrel）取代單檔：
   - `enums.ts`（cardType / barcode / currency / language / templateStatus / cardFieldKey）
   - `tableCard.ts`（Step 7 表格卡）
   - `templateSettings/`（`index.ts` 以 `.extend()` 組出扁平 63-key 物件 + `base` / `stamp` / `giftCard` / `reward` / `membership` / `cashback` / `discount` / `coupon` / `multipass` 十個分區）
   - `templateCrud.ts` / `templateDto.ts`
   - barrel 匯出與舊檔**完全相同的 symbol 清單** → 對外路徑 `@saome/shared/schemas/card` 不變，約 60 個呼叫端零修改。
2. **先修 shared 的真實漂移**：把 `perSpendAmount` 收緊成 `.positive().min(MULTIPASS_STAMPS_PER_SPEND_MIN)`，並改用 `packages/shared/constants/multipass-card` 的常數取代硬編碼 bounds（40 / 0 / 999 / 5）。補 `0.005` 必拋錯的測試。
3. **後端 `request.ts` 收斂成純 re-export**（579 → 68 行）：只保留 `export { ... } from '@saome/shared/schemas/card'`，移除 zod import 與四組 constants import。匯出的 symbol 名稱與 import 路徑（`../schemas/request`）完全不變。
4. **conformance test 改寫**：把「local vs shared 欄位逐一比對」換成 **reference identity 斷言**（`expect(backendTemplateSettingsSchema).toBe(sharedTemplateSettingsSchema)`），這是最強形式的防漂移 —— 一旦有人重新寫了一份鏡像，斷言立刻失敗，不需要任何欄位比對。刪除重複的「local 版」鏡像斷言，保留所有 shared 行為斷言，補上 `0.005` 斷言。

**決定理由**：
- 兩份契約是漂移的**結構性根因**；只做檔案拆分（選項 A）保留了這個根因。
- Reference identity 是比「欄位集合比對」更強的守門：欄位比對會漏掉**約束**漂移（本次的真實 bug 正是約束漂移，欄位集合完全一致），identity 斷言則根本排除「有第二份」這個前提。
- 對外 import 路徑不變 → 零呼叫端修改 → 零 migration → production 行為零變動。

### 選項 C：順便刪掉 `packages/shared/schemas/cardBuilder.ts` 的死碼

`cardBuilder.ts` 有第三份 `perSpendAmount: z.number().positive()` 副本（`cardTypeExtensions`，約 243 行，全庫零呼叫者）。

- **優點**：一次清掉三份副本。
- **缺點**：刪檔需要走 `git ls-tree` audit 且是獨立的破壞性變更，混在本次重構裡會讓 diff 難以審查；且 `barcodeTypeSchema` / `BARCODE_IMAGES` 仍有人用，不能整檔刪。**本次不動，列為後續 PR。**

### 選項 D：拆檔但不動後端（= 選項 A）——使用者已明確選擇 Option A（改目錄）

檔案佈局方面使用者已拍板「改成目錄」（Option A），本決策在此基礎上補上後端收斂（使用者在問題 1 的說明中已收到並認可 Option B 為推薦方案）。

## 影響

### 契約層

- **對外路徑不變**：`@saome/shared/schemas/card` 仍可用，約 60 個呼叫端零修改。
- **5 個解析面必須同步**（Rule 016）：`packages/shared/package.json` exports map、frontend `vite.config.ts`、frontend `vitest.config.ts`（`cardBuilder` 必須排在 `card` 之前，字串 alias 為 prefix matching）、backend `vitest.config.ts`、backend `backfill-pass-runtime-values.cjs` 腳本 alias。tsconfig 的 `paths` wildcard 與 `packages/shared/schemas/index.ts` 的 `export * from './card'` 在 Bundler moduleResolution 下**自動解析到目錄 index**，不需改（已實測）。
- **Step 3 必須排在 Step 4 之前**：後端改成 re-export 的那一刻，`@saome/shared/schemas/card` 必須已經解析到 `card/index.ts`，否則 backend 在 vitest / build 期直接解析失敗。

### 後端

- `apps/backend/src/modules/cards/schemas/request.ts`：579 → 68 行。
- `db/templates.ts` 的 `TemplateSettings` interface（Rule 019 layer 3）**不需改動**：欄位集合與推導型別皆未變。
- `services/cardService.ts`（layer 4）**不需改動**。

### Production

- **行為零變動**：Step 1 收緊的是尚未上線的 shared；Step 4 收斂後 backend 的驗證嚴格度與今日完全相同（backend 本來就要求 `≥ 0.01`）。
- 0 migration、0 DB schema 變更、0 lockfile 變更（`npm install --include=optional` 後 lockfile 無 diff）。

### 測試

- `apps/backend/src/modules/cards/tests/schema-conformance.test.ts`：1,834 → 1,525 行，167 → 125 條測試（刪除 42 條重複的 local 鏡像斷言）。
- shared 側原 `card.test.ts`（566 行）拆成 6 個 per-section 測試檔（`base` / `step4` / `step5` / `membership` / `coupon` / `multipass`），全部保留原有斷言。

### 後續（不在本次範圍）

- `packages/shared/schemas/cardBuilder.ts` 的 `cardTypeExtensions`（約 243 行死碼，含第三份 `perSpendAmount` 副本）→ 刪檔需另走 `git ls-tree` audit。
- `packages/shared/schemas/pass-templates/schemas/request.ts` 內的 `passHolderCurrencySchema` 是第四份 currency enum 副本 → 可在後續收斂到 `currencySchema`。
