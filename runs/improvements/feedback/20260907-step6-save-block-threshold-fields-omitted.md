---
title: "2026-09-07 Step 6 Round-Trip Bug — handleNext Save Block Omitted 4 Accrual Threshold Fields"
date: 2026-09-07
type: bug-trace
scope: card-builder/step-6
status: resolved
severity: SEV-2
commits:
  - pending   # feat(card-builder): Step 6 save block forwards 4 accrual threshold fields
---

# 2026-09-07 Step 6 Round-Trip Bug — handleNext Save Block Omitted 4 Accrual Threshold Fields

## TL;DR

CardBuilder Step 6 完工後，使用者填的 `per_visit` / `per_spend` 模式的「來訪 / 消費」門檻數字（`stampsPerVisitCount`, `stampsPerVisitStamps`, `stampsPerSpendAmount`, `stampsPerSpendStamps`）**從未進到 DB**。使用者在 Step 6 看到自己的輸入，點下一步、儲存、重整頁面 → 數字全部消失。根因：`handleNext` Step 6 save block 的 `useCardBuilderStore.getState()` 解構漏 4 個 threshold 欄位，只送基本 5 個欄位（`stampAccrualMode, rewardName, rewardType, rewardValue, maxDiscountAmount`）出去。修法：補齊 4 個欄位到 save block、新增 2 條 round-trip regression 測試。

## 症狀（user-visible）

### 重現步驟

1. 開一個新 stamp_card template
2. Step 6 選 `per_visit` 模式
3. 輸入「每 3 次拜訪可獲得 2 個蓋章」（`stampsPerVisitCount = 3`, `stampsPerVisitStamps = 2`）
4. 點「下一步」進 Step 7
5. 回到 Step 6（或重新整理頁面 / 重開 tab）

### 預期 vs 實際

| 欄位 | 預期 | 實際 |
|---|---|---|
| `stampAccrualMode` | `'per_visit'` | `'per_visit'` ✓ |
| `rewardName` | 使用者輸入 | 使用者輸入 ✓ |
| `rewardType` | 使用者輸入 | 使用者輸入 ✓ |
| `rewardValue` | 使用者輸入 | 使用者輸入 ✓ |
| `maxDiscountAmount` | 使用者輸入 | 使用者輸入 ✓ |
| **`stampsPerVisitCount`** | `3` | **`null`（空欄位）** |
| **`stampsPerVisitStamps`** | `2` | **`null`（空欄位）** |
| `stampsPerSpendAmount` | `null`（per_visit 不適用） | `null` ✓ |
| `stampsPerSpendStamps` | `null`（per_visit 不適用） | `null` ✓ |

### 觸發條件

- 任何在 Step 6 走完整個 flow 的 draft
- `per_visit` 模式 → 4 個欄位中 `stampsPerVisit*` 2 個丟
- `per_spend` 模式 → 4 個欄位中 `stampsPerSpend*` 2 個丟
- `per_stamp` 模式 → threshold 為 null，丟 null 也沒差（所以測試用 per_stamp 通過 = base case 全綠）

### 對使用者的影響

- 集點卡設定的「每 N 次拜訪得 M 章」**無法持久化**
- 發出的 Apple Wallet pass 在 Passcreator 端**沒有 threshold** → 等於無效果
- 這是 silent data loss：UI 沒 error、console 沒 warning、DB 沒 reject

## 時間軸（trace）

| 時間 (UTC+8) | 事件 |
|---|---|
| 2026-09-07 ~22:00 | Step 6 完工（dispatcher + 6 sub-field + Step 6 integration test 11 cases 全綠）|
| 2026-09-07 ~22:25 | 使用者手動驗證 Step 6，發現 per_visit 模式下重整頁面 threshold 變空 |
| 2026-09-07 ~22:30 | DB JSON 顯示 threshold 4 個欄位沒進 → 鎖定 save block |
| 2026-09-07 ~22:35 | `git diff apps/frontend/.../CardBuilderEditorWorkspace.tsx` 確認解構只取 5 個欄位 |
| 2026-09-07 ~22:36 | 補齊 4 個欄位 + 修正既有測試（改 per_stamp 通過 gate）+ 新增 2 條 round-trip 測試 |
| 2026-09-07 ~22:40 | `npx vitest run CardBuilderEditorWorkspace.step6-integration.test.tsx` → 11/11 綠 |
| 2026-09-07 ~22:42 | `npx vitest run src/components/business/dashboard/CardBuilderEditor/` → 438/438 綠 |

## 根因

`apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorWorkspace.tsx::handleNext`（line 322-348）的 Step 6 save block：

```ts
// ❌ 原本只解構 5 個欄位
const {
  stampAccrualMode,
  rewardName,
  rewardType,
  rewardValue,
  maxDiscountAmount,
} = useCardBuilderStore.getState();
await onSave(cardId, {
  stampAccrualMode,
  rewardName,
  rewardType,
  rewardValue,
  maxDiscountAmount,
  // ❌ 漏：stampsPerVisitCount, stampsPerVisitStamps,
  //           stampsPerSpendAmount, stampsPerSpendStamps
});
```

### 為什麼發生（stack 已對齊，但 save block 沒在 stack 裡）

實作 Step 6 時，Rule 019 § 4.1「四層 binding」有確實對齊：

| 層 | 檔案 | Step 6 threshold 支援 |
|---|---|---|
| Layer 1 (shared schema) | `packages/shared/schemas/card.ts::templateSettingsSchema` | ✅ 4 個 threshold fields |
| Layer 2 (backend request) | `apps/backend/src/modules/cards/schemas/request.ts` | ✅ 4 個 threshold fields |
| Layer 3 (backend db) | `apps/backend/src/modules/cards/db/templates.ts::TemplateSettings` | ✅ 4 個 threshold fields |
| Layer 4 (backend service) | `apps/backend/src/modules/cards/services/cardService.ts` | ✅ 自動隨介面 |
| **Frontend save block** | `CardBuilderEditorWorkspace.tsx::handleNext` | ❌ **漏 4 個欄位** |
| Frontend store | `CardBuilderEditor.store.ts` | ✅ 4 個 threshold + 4 個 setter |
| Frontend `loadSettings` | `CardBuilderEditor.store.ts` | ✅ 4 個 defensive read |

Schema + store + loadSettings 都到位，但 **save block 沒在 Rule 019 § 4.1 的「四層」之內**——這是 Rule 設計的盲點。後續應擴 § 4.1 加「frontend save block 是隱性第五層」，避免「store 寫了、save 沒送」的 silent drift。

### 為什麼既有 Step 6 integration test 沒抓到

既有測試的最後一條（line 142-180）`handleNext calls onSave with Step 6 fields when cardId exists` 有兩個問題：

1. 用 `per_visit` 模式 + **不設 threshold fields** → `isStep6Valid()` 對 `per_visit` 要求 `stampsPerVisitCount !== null && > 0`，因此 **`handleNext` 早已 return** —— 此測試從未真正走到 `onSave` 段。
2. 預期的 payload 只含 5 個 base field —— **把現有 bug 鎖死成「expected behavior」**。

換句話說，此測試既是 always-fail 又是 always-pass 的 Pin the Bug 範例：
- 跑 `per_visit` → `handleNext` 早 return → `onSave` not called → `expect(onSave).toHaveBeenCalledTimes(1)` fail
- 改測 `per_stamp` → 通過 gate → 但 expected payload 沒 threshold → 若 save block 改了此測試會 fail，反而是個「stale 鎖死」

## 修法

### Code Fix（`CardBuilderEditorWorkspace.tsx` line 322-360）

```ts
// ✅ 修：完整 9 個欄位
const {
  stampAccrualMode,
  rewardName,
  rewardType,
  rewardValue,
  maxDiscountAmount,
  stampsPerVisitCount,
  stampsPerVisitStamps,
  stampsPerSpendAmount,
  stampsPerSpendStamps,
} = useCardBuilderStore.getState();
await onSave(cardId, {
  stampAccrualMode,
  rewardName,
  rewardType,
  rewardValue,
  maxDiscountAmount,
  stampsPerVisitCount,
  stampsPerVisitStamps,
  stampsPerSpendAmount,
  stampsPerSpendStamps,
});
```

注意：所有模式都送（non-stamp 送 `null`），讓 DB 永遠保持最新 store 狀態。`loadSettings()` 的 defensive coercion 會在 reload 時把 mismatch 的值正確清回 `null`。

### Conformance Test 修補 + 2 條 round-trip regression（`CardBuilderEditorWorkspace.step6-integration.test.tsx`）

```ts
// 既有測試修改：改 per_stamp（不需 threshold），預期 9 個欄位
it('handleNext calls onSave with Step 6 base fields when cardId exists (per_stamp — always valid)', async () => {
  ...
  useCardBuilderStore.setState({
    cardType: 'stamp_card',
    stampAccrualMode: 'per_stamp',
    rewardName: '10元折價',
    rewardType: 'amount_off',
    rewardValue: 10,
  });
  ...
  expect(onSave).toHaveBeenCalledWith('test-card-id', {
    stampAccrualMode: 'per_stamp',
    rewardName: '10元折價',
    rewardType: 'amount_off',
    rewardValue: 10,
    maxDiscountAmount: null,
    stampsPerVisitCount: null,
    stampsPerVisitStamps: null,
    stampsPerSpendAmount: null,
    stampsPerSpendStamps: null,
  });
});

// 新增 per_visit round-trip
it('handleNext forwards stampsPerVisitCount + stampsPerVisitStamps for per_visit mode', async () => {
  ...
  expect(onSave).toHaveBeenCalledWith('visit-card', {
    ...
    stampsPerVisitCount: 3,
    stampsPerVisitStamps: 2,
    stampsPerSpendAmount: null,
    stampsPerSpendStamps: null,
  });
});

// 新增 per_spend round-trip
it('handleNext forwards stampsPerSpendAmount + stampsPerSpendStamps for per_spend mode', async () => {
  ...
  expect(onSave).toHaveBeenCalledWith('spend-card', {
    ...
    stampsPerVisitCount: null,
    stampsPerVisitStamps: null,
    stampsPerSpendAmount: 100,
    stampsPerSpendStamps: 1,
  });
});
```

## 為什麼 typecheck / lint / 單元測試都沒抓到

| 工具 | 為什麼沒抓到 |
|---|---|
| TypeScript | `{ ... 5 fields ... }` 是合法型別；4 個 threshold 沒寫 → TS 不會 complain「缺欄位」 |
| Lint | 同上，語法合法 |
| Vitest | 既有 Step 6 integration test 用 `per_visit` 但**沒設 threshold** → validation gate 提早 return → 測試根本沒跑到 `onSave` 段 |
| db JSON dump | 需人工比對 DB JSON 才看得出來（使用者回報後才發現） |

## 自問

**Q：為什麼 Rule 019 § 4.1 的「四層」沒涵蓋 frontend save block？**
A：原本的設計是「契約層（schema）+ 落地層（db/service）」的對齊，沒意識到 frontend 的 save block 是「契約 → 落地」的最終段（前端把 store → API contract）。這次修應擴 § 4.1 加一條：「frontend save block 是 schema 對齊的隱性第五層」。

**Q：為什麼 `loadSettings` 的 defensive coercion 不會 catch 這個？**
A：`loadSettings` 從 DB 讀，DB 沒寫就不會讀到——它只負責「讀對」，不負責「寫有」。silent write miss 是必須在 save 階段攔截的。

**Q：可以加 warning console 嗎？**
A：可以（store → onSave 之間），但**這是治標**。本 bug 的根本是「schema 對齊沒把 save block 列進 stack」。下次同類 bug 會出現在另一個 Step 的 save block（Step 5 的 `setLocationsDisabled` 動的連鎖就是前例）。

**Q：Vibe Coding / Agent workflow 應該怎麼防？**
A：寫新 Step 的 save block 時，**必跑 4-step checklist**：
1. 列出此 step 在 schema 內**所有** top-level field
2. 跟 `useCardBuilderStore.getState()` 解構欄位比對
3. 跟 `onSave(cardId, payload)` 的 payload object literal 比對
4. 若任一缺漏，加進去 + 加 round-trip test 驗證 load 回來 = save 出去

未來這條 SOP 應進 AGENTS.md 或 frontend L2 checklist 作為 mandatory step。

## 規範層影響

| 規範 | 動作 | 原因 |
|---|---|---|
| `.cursor/rules/019-schema-contract-drift.mdc` § 4.1 | **擴充**：加 § 4.2「frontend save block 是 schema 對齊的隱性第五層」 | Rule 設計缺漏；save block 是 schema → DB 的最終段 |
| `.cursor/rules/frontend/025-vibe-coding-l2-checklist.mdc` | 加 § 6：save block 4-step checklist | Agent SOP 預防下次同類 bug |
| 後續每次新增 Step 既有 4 層 binding | 必走 5 層 binding（含 save block）| 範式擴展 |

## 學習

| 項目 | 說明 |
|---|---|
| Save block 是 schema contract 對齊的隱性端 | store 寫了不代表 DB 寫了；要驗證就要 round-trip test |
| TypeScript 不能 catch 缺漏欄位 | `{ a, b, c }` 是合法 literal；缺 d 通過 typecheck |
| 「validation gate 早 return」讓測試 silently fail | 既有測試用 `per_visit` 但不設 threshold → 沒走到 onSave 段，expect 卻 expect called once |
| Round-trip test 是唯一能抓 silent drift 的工具 | 既要 verify save 出去 = 預期 payload，也要 verify reload 後 store = 原 store |
| Rule 沒寫進的盲點要靠 user feedback 才會發現 | 這次要不是使用者手動驗證，threshold 不見的 bug 會持續到 production |

## 參照

- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorWorkspace.tsx` line 322-360（handleNext Step 6 save block）
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorWorkspace.step6-integration.test.tsx`（3 條 round-trip test）
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts::loadSettings`（4 個 threshold defensive read）
- `packages/shared/schemas/card.ts::templateSettingsSchema`（4 個 threshold schema）
- `apps/backend/src/modules/cards/schemas/request.ts::templateSettingsSchema`（4 個 threshold mirror）
- `apps/backend/src/modules/cards/db/templates.ts::TemplateSettings`（4 個 threshold interface）
- `DEV/09-2026/0907-step6-stamp-card-logic-completion.md`（本次 master DEV）
- `.cursor/rules/019-schema-contract-drift.mdc`（待擴 § 4.2）
- `.cursor/rules/frontend/025-vibe-coding-l2-checklist.mdc`（待加 § 6）
