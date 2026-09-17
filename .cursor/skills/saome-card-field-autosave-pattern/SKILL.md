---
name: saome-card-field-autosave-pattern
description: CardBuilder 欄位「新增 → store → autosave effect → API save → 載入回填」5 層 pipeline SOP。當需求涉及 CardBuilderEditor 欄位 autosave、debounce、欄位製作、欄位儲存、欄位回填時使用。
---

# SAOME Card Field Autosave Pattern

> 觸發時機：寫任何 CardBuilder 欄位的「新增 → store → autosave effect → API save → 載入回填」流程。
> CardBuilderEditor.tsx 目前 5 個 autosave 實例（logoText / isPaid / Step 4 / Step 5 / Step 2）全部走同一個 SOP — 本 skill 把這套 SOP 標準化 + 給 copy-paste 模板。

## 為什麼這個 skill 存在

2026-09-05 Step 4 autosave 慢網路洗 DB 事故後，建立了 Rule 030 / 031 / 032 三條 SOP（baselineArmedRef / 長 timer 雷區 / JSONB merge silent killer）。但這 3 條 rule：
- 散落在 3 個檔案，缺統一 entry point
- 沒有 copy-paste hook template
- CardBuilderEditor.tsx 5 處實例各自重複 pattern → copy-paste drift 風險

本 skill 提供：5 層 pipeline + hook template + 3 條 conformance test 模板 + 5 處 reference impl line 索引。

---

## 5 層必經 Pipeline

```
Layer 1: Store (CardBuilderEditor.store.ts)
    ↓ 加 field + setter
Layer 2: 4-Layer Schema Sync (Rule 019 § 4.1)
    ↓ shared zod → backend request.ts → backend db interface → service
Layer 3: Autosave Effect (CardBuilderEditor.tsx)
    ↓ baselineArmedRef + loadSettledRef + JSON.stringify snapshot + useStore.getState()
Layer 4: Conformance Test (CardBuilderEditor.autosave.test.tsx)
    ↓ 基本 debounce + collapse + slow-network regression (MANDATORY)
Layer 5: loadSettings 回填 (CardBuilderEditor.store.ts)
    ↓ defensive unwrap（守 Rule 019）— 守 DB row 形狀可能漂移
```

| Layer | 檔案 | 必做 |
|-------|------|------|
| 1 | `CardBuilderEditor.store.ts` | 加 field + setter + `xxxVersion`（optional，cache busting 用） |
| 2 | `packages/shared/schemas/card.ts` + `apps/backend/src/modules/cards/schemas/request.ts` + `db/templates.ts` + `services/cardService.ts` | 4 層 zod / interface / service signature 同步（Rule 019 § 4.1） |
| 3 | `CardBuilderEditor.tsx` | 加 `useEffect` 套 baselineArmedRef + loadSettledRef + JSON.stringify snapshot diff |
| 4 | `CardBuilderEditor.autosave.test.tsx` 或新 `*.autosave.test.tsx` | 3 條 test：debounce / collapse / slow-network regression |
| 5 | `CardBuilderEditor.store.ts::loadSettings` | defensive unwrap 新欄位（fallback default value） |

---

## Hook 模板（copy-paste — 內嵌於 CardBuilderEditor.tsx）

```typescript
// ─── Refs（CardBuilderEditor function body 內）───
const xxxBaselineArmedRef = useRef(false);
const xxxLoadSettledRef = useRef(false);
const xxxLastSnapshotRef = useRef('');
const xxxSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// ─── Outer-fetch effect: reset refs on cardId 變動 ───
useEffect(() => {
  if (!cardId) return;
  xxxBaselineArmedRef.current = false;
  xxxLoadSettledRef.current = false;
  xxxLastSnapshotRef.current = '';
  if (xxxSaveTimerRef.current) {
    clearTimeout(xxxSaveTimerRef.current);
    xxxSaveTimerRef.current = null;
  }
}, [cardId]);

// ─── (Option A) 共用 outer-fetch timeline ───
// 若同 timeline（跟 Step 4 / logoText 同一 fetch），複用 step4LoadSettledRef
// 不必各自 fetch。例：isPaid / logoText 跟 Step 4 共用。
//
// (Option B) 獨立 outer-fetch timeline
// 若 fetch 內容跟既有 timeline 不重疊（例 Step 2 跟 Step 4 載入的 settings 範圍不同），
// 各自獨立 ref。

// ─── Inner autosave effect ───
useEffect(() => {
  if (!cardId) return;

  const snapshot = JSON.stringify({
    xxxField: useCardBuilderStore.getState().xxxField,
    // ... 其他 fields
  });

  // 第一次 run：純粹 seed baseline，不排 timer
  if (!xxxBaselineArmedRef.current) {
    xxxBaselineArmedRef.current = true;
    xxxLastSnapshotRef.current = snapshot;
    return;
  }

  // fetch 還沒完成 → 不 schedule（防半空 PUT）
  if (!xxxLoadSettledRef.current) {
    xxxLastSnapshotRef.current = snapshot;
    return;
  }

  // snapshot 沒變 → 不做事（Zustand selector reference churn 防禦）
  if (snapshot === xxxLastSnapshotRef.current) return;
  xxxLastSnapshotRef.current = snapshot;

  // client-side validation（Rule 032 § 2 — 防 silent overwrite）
  const parsed = xxxSchema.safeParse(/* ... */);
  if (!parsed.success) {
    console.warn('[CardBuilderEditor] xxx autosave blocked — invalid state:', parsed.error.issues);
    return;
  }

  // Schedule debounced PUT
  if (xxxSaveTimerRef.current) clearTimeout(xxxSaveTimerRef.current);
  xxxSaveTimerRef.current = setTimeout(() => {
    // 讀最新值（不 capture 閉包變數）
    const s = useCardBuilderStore.getState();
    cardService.update(cardId, /* payload shape: 視 schema 決定 */);
  }, 1000);

  // Cleanup 顯式清 timer
  return () => {
    if (xxxSaveTimerRef.current) {
      clearTimeout(xxxSaveTimerRef.current);
      xxxSaveTimerRef.current = null;
    }
  };
}, [cardId, /* store value selectors */]);

// ─── flip xxxLoadSettledRef on loadSettings complete ───
// 在既有 outer-fetch 的 `.then(template => { loadSettings(...); xxxLoadSettledRef.current = true; })` 加這一行
```

### 變體：A 共用 outer-fetch timeline（推薦）

`logoText` / `isPaid` / Step 4 都跟同一個 `getById(cardId)` 抓同一份 template，共用 `step4LoadSettledRef`：

```typescript
// CardBuilderEditor.tsx 的 outer fetch effect 內
cardService.getById(cardId).then((template) => {
  loadSettings(template.settings);
  step4LoadSettledRef.current = true;  // ← 同一行，3 個 autosave effect 共用
});
```

3 個 inner effect 各自檢查 `step4LoadSettledRef.current` 即可。

### 變體：B 獨立 outer-fetch timeline

`Step 5` / `Step 2` 因為吃不同 settings 範圍（或更早期實作、各自 fetch），各自獨立 `xxxLoadSettledRef`：

```typescript
// Step 5 / Step 2 各自有一個 mini outer-fetch effect（或跟既有 outer-fetch 共用 fetch 但各自 flip ref）
```

---

## Conformance Test 模板（3 條必備）

```typescript
import { render, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardBuilderEditor } from './CardBuilderEditor';
import { useCardBuilderStore } from './CardBuilderEditor.store';

// (auth / i18n mocks 同 Step 4 autosave.test.tsx)

describe('CardBuilderEditor — <Xxx> autosave', () => {
  beforeEach(() => { /* setup */ });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('debounces <Xxx> input and triggers single PUT after 1s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithRouter();
    await seedFetch();

    act(() => { useCardBuilderStore.getState().setXxx('NEW_VALUE'); });

    await act(async () => { vi.advanceTimersByTime(1100); });

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith(cardId, expect.objectContaining({ /* shape */ }));
  });

  it('collapses consecutive <Xxx> inputs into single PUT (debounce behavior)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithRouter();
    await seedFetch();

    act(() => { useCardBuilderStore.getState().setXxx('A'); });
    act(() => { useCardBuilderStore.getState().setXxx('AB'); });
    act(() => { useCardBuilderStore.getState().setXxx('ABC'); });

    await act(async () => { vi.advanceTimersByTime(1100); });

    // 只有最後一次的 PUT
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT autosave before async fetch resolves (regression — 2026-09-05)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // 模擬 getById 延遲 1500ms（cloudflare edge / mobile 4G / cold worker）
    vi.mocked(cardService.getById).mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve({
        id: 'test-template-id',
        settings: FULL_SETTINGS,
      }), 1500)),
    );

    renderWithRouter();

    // 推進 1.1s — 比 debounce（1s）稍長，但 fetch 還沒 resolve
    await act(async () => { vi.advanceTimersByTime(1100); });

    // 關鍵斷言：debounce 已經過、但 fetch 還沒回 → 沒有 PUT
    expect(updateSpy).not.toHaveBeenCalled();

    // 等 fetch resolve
    await act(async () => { vi.advanceTimersByTime(500); });
    // 第二次 debounce cycle 才允許 PUT（帶真實資料）
    await act(async () => { vi.advanceTimersByTime(1100); });

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith(cardId, expect.objectContaining({
      /* real settings payload */
    }));
  });
});
```

沒這 3 條 test → 不可 ship。

---

## Reference Implementation Index（5 處 live 實例）

`apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx`：

| 階段 | 實例 | 欄位 | Line | 共用 outer-fetch ref |
|---|---|---|---|---|
| Phase 5.1 (9/05) | `cardName`（logoText） | `logoText` | 150-225 | `step4LoadSettledRef` |
| Phase 5.5 (9/05) | `isPaid` | `isPaid` | 192-220 | `step4LoadSettledRef` |
| Round 1 (9/05) | **Step 4** | `description` / `backFields` / `links` | 285-328 | `step4LoadSettledRef` |
| Phase 5.14 (9/06) | **Step 5** | `locations` / `locationsDisabled` | 380-411 | `step5LoadSettledRef` |
| Phase 5.16 (9/18) | **Step 2** | `cardName` / `issuerName` / `barcodeType` / `passValidDays` / `expiryDate` / `currency` / `language` | 544-584 | `step2LoadSettledRef` |

對應測試：[`CardBuilderEditor.autosave.test.tsx`](file:///c:/Users/user/Desktop/SAOME-REBUILD/apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.autosave.test.tsx) — 928 → 1121 行（9 條 Step 2 regression test）。

---

## Step-by-step Checklist（8 步）

新增 CardBuilder 欄位 autosave 時，逐項確認：

```
□ Step 1: CardBuilderEditor.store.ts 加 field + setter
   - 確認有 defensive default value（避免 reset 後是 undefined）
   - 若有 derived selector（如 getter），加進 store

□ Step 2: 4-Layer Schema Sync（Rule 019 § 4.1）
   - packages/shared/schemas/card.ts 加 optional field
   - apps/backend/src/modules/cards/schemas/request.ts 同步
   - apps/backend/src/modules/cards/db/templates.ts::TemplateSettings interface 加 field
   - apps/backend/src/modules/cards/services/cardService.ts 參數型別同步
   - 加 conformance test 驗證（schema-conformance.test.ts）

□ Step 3: CardBuilderEditor.tsx 寫 autosave effect
   - 加 4 個 ref: baselineArmedRef + loadSettledRef + lastSnapshotRef + saveTimerRef
   - 加 outer-fetch effect 的 ref reset（cardId 變動時）
   - 加 inner autosave effect：baseline check → loadSettled check → snapshot diff → schedule → cleanup
   - 決定共用 / 獨立 outer-fetch timeline

□ Step 4: 決定 payload shape（Rule 032 § 1）
   - 若寫 top-level SQL column → payload = { xxx: value }
   - 若寫 JSONB settings → payload = { settings: { xxx: value } }
   - 後端 SQL 必須用 sql.json() 注入（Rule 027）

□ Step 5: 加 client-side validation（Rule 032 § 2）
   - autosave timer fire 之前用 zod safeParse
   - parse fail → console.warn + return（不 schedule PUT）

□ Step 6: 加 conformance test（3 條必備 + 該欄位特殊 case）
   - 基本 debounce
   - 連續輸入 collapse
   - slow-network regression（MANDATORY）
   - 該欄位特殊 case（如 required / unique / cross-field rule）

□ Step 7: loadSettings defensive unwrap
   - CardBuilderEditor.store.ts::loadSettings 加新欄位 defensive read
   - fallback default value（避免舊 contract 沒這個欄位時 undefined）

□ Step 8: 跑驗證 SOP
   - npx tsc -p apps/frontend/tsconfig.app.json --noEmit
   - npm test --prefix apps/frontend （含新 conformance test）
   - npm run verify:i18n（若新欄位有 i18n key）
```

---

## 禁止

- ❌ 跳過 baselineArmedRef（Rule 030 P0 violation）
- ❌ 跳過 loadSettledRef（半空 PUT 風險）
- ❌ 跳過 client-side validation（Rule 032 § 2 — silent overwrite 風險）
- ❌ 閉包捕獲 store value（必用 `useStore.getState()` 在 timer fire 內讀最新值）
- ❌ 用 `===` / `Object.is` 比 array / object（Zustand selector reference churn）
- ❌ cleanup 漏寫 `clearTimeout`（unmount 時 timer 仍跑 → memory leak）
- ❌ 不寫 slow-network regression test 直接 ship（≥1s debounce 必備）
- ❌ 直接 `${JSON.stringify(x)}::jsonb` 注入 jsonb（workerd pitfall，Rule 027 § workerd JSON.stringify）
- ❌ 把 `req.body.settings` 直接透傳給 SQL 沒先過 zod（Rule 032 § 1）

---

## 變體模式：共用 vs 獨立 outer-fetch ref

| 場景 | 共用 ref | 獨立 ref |
|---|---|---|
| 欄位都在同一份 `template.settings` JSONB 內 | ✅ 共用 `step4LoadSettledRef` | — |
| 欄位 fetch 範圍跟既有 timeline 完全一致 | ✅ 共用 | — |
| 欄位 fetch 來自不同 endpoint / 範圍 | — | ✅ 獨立 `xxxLoadSettledRef` |
| 欄位跟 Step N 緊密耦合，但 Step N 還沒實作 | — | ✅ 獨立（等 Step N 實作再共用） |

SAOME 目前 5 處實例的決策：
- logoText / isPaid / Step 4 → 共用 `step4LoadSettledRef`（同一個 fetch timeline）
- Step 5 → 獨立 `step5LoadSettledRef`（Phase 5.14 實作時 Step 4 已是 stable，新 timeline 不強耦合）
- Step 2 → 獨立 `step2LoadSettledRef`（Phase 5.16 實作，跟 Step 4 settings 範圍有重疊但獨立）

---

## 抽 shared hook 的考量（**未實作，獨立 session 風險**）

CardBuilderEditor.tsx 5 處實例都是相同 pattern，理論上可抽出 `useCardFieldAutosave` shared hook：

```typescript
// 未來（不建議這次做）
function useCardFieldAutosave<T>(opts: {
  sessionKey: string | null;
  fields: T;
  schema: z.ZodSchema<T>;
  loadSettledRef: { current: boolean };
  payloadBuilder: (fields: T) => Record<string, unknown>;
}): void { /* ... */ }
```

**為什麼不在這次抽**：
- 5 處同時 refactor 風險高（破壞既有 200+ regression test）
- 5 處 payload shape 不一致（top-level `cardName` vs JSONB `settings.xxx`）
- 5 處共用 / 獨立 loadSettledRef 混用 → hook signature 複雜
- 收益（5 處減少 ~150 行 boilerplate）vs 風險（5 處 regression test 全重跑）不對等

Future invariant：未來抽 hook 必走獨立 session + L3 Heavy 流程（涉及 schema sync 5 處 + test 200+ + 5 處呼叫站同時改）。

---

## 與既有 rule 的關係

| Rule / Skill | 角色 |
|---|---|
| [`.cursor/rules/030-effect-first-run-not-trustworthy.mdc`](file:///c:/Users/user/.cursor/rules/030-effect-first-run-not-trustworthy.mdc) | baselineArmedRef + snapshot diff 完整規範 |
| [`.cursor/rules/031-long-timer-async-fetch.mdc`](file:///c:/Users/user/.cursor/rules/031-long-timer-async-fetch.mdc) | ≥1s debounce + async fetch race 是 silent data corruption 雷區 |
| [`.cursor/rules/032-backend-jsonb-merge-silent-killer.mdc`](file:///c:/Users/user/.cursor/rules/032-backend-jsonb-merge-silent-killer.mdc) | PostgreSQL `\|\|` silent overwrite + 前端 / 後端 zod 三層防護 |
| [`.cursor/rules/019-schema-contract-drift.mdc` § 4.1](file:///c:/Users/user/.cursor/rules/019-schema-contract-drift.mdc) | DB ↔ zod ↔ backend contract 四層同步 |
| [`.cursor/rules/027-postgres-dynamic-query-pattern.mdc` § workerd JSON.stringify](file:///c:/Users/user/.cursor/rules/027-postgres-dynamic-query-pattern.mdc) | jsonb column 必用 `sql.json()`，禁止手動 stringify |
| [`runs/improvements/feedback/20260906-rule-sediment-030-031-032.md`](file:///c:/Users/user/Desktop/SAOME-REBUILD/runs/improvements/feedback/20260906-rule-sediment-030-031-032.md) | 三條 rule 沉澱的原始 trace |
| [`runs/improvements/feedback/20260918-step2-autosave-5th-instance-skill-needed.md`](file:///c:/Users/user/Desktop/SAOME-REBUILD/runs/improvements/feedback/20260918-step2-autosave-5th-instance-skill-needed.md) | 第 5 次同 pattern 實作 → 本 skill 觸發原因 |

---

## 參照

- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx` — 5 處 reference impl
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.autosave.test.tsx` — 9 條 Step 2 regression test + 7 條既有 Step 4 conformance test
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts::loadSettings` — defensive unwrap 範例
- `apps/backend/src/modules/cards/db/templates.ts::updateTemplate` — DB 層 merge 實作範本（line ~232）
- `apps/backend/src/modules/cards/schemas/request.ts::TemplateSettingsSchema` — 後端 zod schema
- `packages/shared/schemas/card.ts::templateSettingsSchema` — shared zod schema
- `DEV/09-2026/0905-step4-autosave-slow-network-baseline.md` — 完整事故 trace

---

## 觸發關鍵字（給未來 agent / Cursor 自動引用）

「autosave」、「debounce」、「欄位製作」、「新增欄位」、「欄位儲存」、「欄位回填」、「baselineArmedRef」、「loadSettledRef」、「slow-network」、「CardBuilderEditor」、「template_settings」、「settings」、「setTimeout」、「reset store」**必須**引用本 skill。

「CardBuilderEditor 新增欄位」、「Step 2 欄位」、「Step 4 欄位」、「Step 5 欄位」、「欄位改完沒保存」、「欄位消失」→ 必引本 skill + Rule 030/031/032。
