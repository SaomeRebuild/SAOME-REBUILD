# 假綠 conformance test：欄位集合比對擋不住約束漂移

> 日期：2026-10-26 ｜ 分類：測試紀律（Rule 019 / Rule 006）
> 相關 Decision：`runs/decisions/2026-10-26-card-schema-split-and-backend-convergence.md`

## 摘要

`packages/shared/schemas/card.ts`（1,099 行）與 `apps/backend/src/modules/cards/schemas/request.ts`（579 行）之間有一份 579 行的手寫鏡像。兩邊的 `templateSettingsSchema` **欄位集合完全一致（63 個 key，雙向零差異）**，但約束不同：

```ts
// shared（原 card.ts）
perSpendAmount: z.number().positive(),

// backend（原 request.ts）
perSpendAmount: z.number().positive().min(MULTIPASS_STAMPS_PER_SPEND_MIN), // 0.01
```

實測 `perSpendAmount: 0.005` → **shared 接受 / backend 拒絕**。

## 根因：守門測試只比對「欄位集合」，而且斷言選得剛好只會綠

`apps/backend/src/modules/cards/tests/schema-conformance.test.ts`（原 1,834 行）的守門方式是：

```ts
it('local schema has the same keys as the shared schema', () => {
  expect(Object.keys(localTemplateSettingsSchema.shape).sort())
    .toEqual(Object.keys(sharedTemplateSettingsSchema.shape).sort());
});
```

這條只能證明「兩邊有同樣的欄位名」，**證明不了欄位的約束相同**。

而真正 pin 住 `perSpendAmount` 邊界的那條測試，寫法是：

```ts
it('shared multipassTiers[*] perSpendAmount must be ≥ MULTIPASS_STAMPS_PER_SPEND_MIN=0.01', () => {
  expect(() => f.parse([{ ..., perSpendAmount: 0 }])).toThrow();
  expect(() => f.parse([{ ..., perSpendAmount: 0.01 }])).not.toThrow();
});
```

**`.positive()` 也滿足這兩條斷言**（`0` 拋錯 ✓、`0.01` 不拋錯 ✓）。測試標題宣稱驗證「≥ 0.01」，實際上只驗證了「> 0」。真正會被 `.positive()` 放行、但被 `.min(0.01)` 拒絕的值 —— `0.005` —— **一條斷言都沒涵蓋**。

於是這條測試長期全綠，而線上 backend 實際拒絕的 payload 範圍比 shared 大得多。**這是典型的假綠守門：測試名稱描述的語意 ≠ 測試實際覆蓋的語意。**

## 為什麼「欄位集合比對」這種守門方式在 zod 契約層根本不夠

zod schema 的約束存在於 schema **物件內部**（`_def.checks` / `_def.innerType` / `_def.values`），不在 key 名稱裡。要用「key 集合比對」偵察約束漂移，必須另外實作一份 zod introspection（本次為了驗證收斂的安全性，臨時寫了一支 `describeSchema()` 深度描述器，逐欄位序列化 checks 與 innerType 鏈）。

那支描述器是**一次性驗證工具**，不是長駐守門 —— 因為：

1. 維護成本高（zod 升版會改 `_def` 內部形狀）；
2. 它描述的是「實作細節」而非「行為」，一旦 zod 內部改版就會誤報；
3. 它無法覆蓋「superRefine / refine / transform」這類自訂約束。

**行為斷言（parse 然後看結果）永遠比結構斷言可靠**，因為它測的是契約對外承諾的行為，而不是 zod 的內部表示。

## 修法：reference identity + 行為斷言

後端收斂成純 re-export 之後，兩邊不再是「兩份契約」，而是**同一個物件**。守門方式因此可以從「比對兩份」升級成「證明只有一份」：

```ts
it('backend request.ts re-exports the very same schema object as shared (reference identity)', () => {
  expect(backendTemplateSettingsSchema).toBe(sharedTemplateSettingsSchema);
});
```

這條斷言的強度遠高於欄位比對：

| 守門方式 | 擋得住「欄位漂移」 | 擋得住「約束漂移」 | 擋得住「重新引入鏡像」 |
|---|---|---|---|
| 欄位集合比對（舊） | ✅ | ❌ | ✅ |
| zod 內部結構比對 | ✅ | ✅ | ✅（但脆弱 + 昂貴） |
| **reference identity（本次）** | ✅ | ✅ | ✅（且最便宜） |

**因為後端不可能「與 shared 相同但約束不同」—— 它 literally 就是同一個物件。** 約束漂移這個 bug 類別被從根上消除，不是被測試擋住。

同時把遺漏的邊界值補上：

```ts
// Regression (2026-10-26): the previous version of this assertion only
// checked `0` and `0.01`, which a bare `.positive()` also satisfies —
// it was a FALSE GREEN that hid the real constraint drift.
expect(() => f.parse([{ ..., perSpendAmount: 0.005 }])).toThrow();
expect(() => f.parse([{ ..., perSpendAmount: 0.01 }])).not.toThrow();
```

## 5 條教訓

### 1. 守門測試的「名稱語意」≠「實際覆蓋的語意」是最危險的假綠

`must be ≥ 0.01` 這條測試最該做的是 pin 住「0.01 與下一個最小合法值之間的界」。它跳過了 0.005，只挑了 0 與 0.01 兩個**兩個實作都同意**的端點。**測試名稱說「驗證 0.01 下限」，實際驗證的是「不接受 0」**。

**未來寫邊界測試的檢查清單**：名稱裡出現的每個數字，都必須有一條以該數字為輸入的斷言；名稱裡的「≥ / ≤ / between」必須至少有一個「剛好差一格」的值被測（0.01 的下限 → 必測 0.005 或等價的「最近的可表達非法值」）。

### 2. 「欄位集合一致」是 zod 契約層最弱的守門形式

欄位名稱與約束是**兩個正交維度**。只比欄位集合的守門在「加欄位」時有效，在「改約束」時完全無效 —— 而**改約束比重加欄位更常發生也更危險**（加欄位兩邊都會忘記而造成 silent drop；改約束是一邊改了另一邊沒改）。

**未來任何「X 與 Y 必須一致」的守門，先問：這個守門覆蓋的是名稱維度還是約束維度？** 只覆蓋名稱的守門應該被標記為「部分防護」而不是「符合」。

### 3. 消除重複比驗證重複更強

既然後端可以 re-export，就不該有第二份契約。**「把第二份刪掉」永遠比「寫測試確保兩份一致」更可靠** —— 前者把 bug 類別從根上消除，後者只能在 bug 發生後攔截。

這也意味著 1,834 行的 conformance test 可以縮到 1,525 行、167 條縮到 125 條，**同時**防護強度提升。

### 4. 大檔案拆分的真正收益是「讓守門可以更便宜」

`card.ts` 1,099 行 → 22 個檔案（最大 252 行）。這讓 Rule 038 的切片閱讀紀律在這個檔案上重新可行，也讓「改一個欄位下限」不需要讀 1,099 行。

但**拆檔本身不修 bug**。本次是先修 shared 的真實漂移（Step 1）、再收斂鏡像（Step 4）、最後才拆檔（實際上拆檔在前，收斂在中）—— 順序的關鍵是：**先讓 source of truth 是真的對的，再讓它只有一份。**

### 5. 收斂前必做「深度結構比對」，否則「收斂」本身可能是行為變更

在把 backend 鏡像換成 re-export 之前，必須證明兩邊**逐欄位等價**（包含約束），否則收斂就是把「一個有 bug 的實作」換成「另一個有 bug 的實作」，或引入線上行為變更。

本次的做法：臨時寫一支 `describeSchema()` 深度描述器（序列化 checks / innerType / values / shape），對 63 個欄位逐一比對 + 比對 key 順序 + 比對 create/update payload。**結果**：欄位定義 63/63 完全一致，只有 `multipassTiers` 與 `multipassAccrualMode` 的 **key 順序**不同（不影響驗證行為，但確認了差異存在）。

驗證完就刪掉這支臨時工具 —— 它是一次性驗證工具，不是長駐守門（見上文「zod 內部結構比對」段落的三個理由）。

## Verification

- `npx tsc --noEmit`（shared / backend）+ `npx tsc -b --noEmit`（frontend）→ exit 0
- shared：30 檔 / 780 測試全綠
- backend：50 檔 / 772 測試全綠（23 skipped）
- frontend：153 檔 / 2,075 測試全綠
- `npx oxlint` → exit 0（0 new warning）
- `npm install --include=optional` 後 `package-lock.json` **無 diff**
- `node scripts/check-oneoff-scripts.cjs` → exit 0
- 拆分等價性：臨時 `describeSchema()` 深度比對 7/7 通過（symbol 清單 / key 集合 / key 順序 / 63 欄位逐欄描述 / create payload / update payload / tableCard），驗證後已刪除臨時檔

## 未來 invariant

1. **邊界測試必測「最近的可表達非法值」** —— 名稱裡的每個數字都要有以它為輸入的斷言。
2. **schema 契約層的守門必是 reference identity 或行為斷言**，不是欄位集合比對。
3. **收斂前必做深度結構比對**（含約束），收斂後刪除一次性驗證工具。
4. **shared schema 收斂成單一來源後，backend 不得再出現同契約的第二份實作**。
5. **`packages/shared/schemas/card/` 內每檔 < 300 行**（Rule 038 context 紀律）。

## 相關既有紀錄

- `runs/improvements/feedback/20260919-coupon-step6-no-backfill-backend-schema-drift.md` —— 同一族：coupon 欄位在 backend 鏡像缺漏導致 silent drop
- `runs/improvements/feedback/20260822-card-builder-draft-abandon-full-trace.md` —— `isPaid` extension drift，Rule 019 § 4.1 四層同步的起源
- `.cursor/rules/019-schema-contract-drift.mdc` —— 四層同步規範本體
