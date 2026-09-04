# Step 4 autosave 空值覆寫 DB（round 2 — 慢網路下 description / backFields 被清空）

**日期**：2026-09-05
**類型**：bug（autosave 把 empty default 寫回 DB）
**影響範圍**：CardBuilderEditor Step 4 — 描述 / 背面欄位
**前情**：0905 step4 i18n + autosave 初版（commit `3b8038f`）

---

## 症狀

打開既有 draft，Step 4 一開始正確回填（description、backFields、links 都有資料）。**幾秒後只剩 links 欄位有資料，description 變空、backFields 變回預設的單列空 row。** 重新整理後資料又出現（DB 還在），但過幾秒又只剩 links。

使用者貼出的 DB JSONB 同時包含三個欄位（並非 DB 自己壞掉）：

```json
{
  "description": "紅甘隨人，歡喜做甘願乾、嬤嬤哈哈阿機機機機機機",
  "backFields": [ { "label": "哈哈哈哈", "value": "..." }, ... 5 rows ],
  "links": [ { "label": "網址", "value": "http://hup.com" } ],
  ...
}
```

重點：**DB 沒被洗空**。意思是使用者看到的「只剩 links」是 in-memory 狀態壞掉，不是 DB 真的被覆寫——但既然 DB 還在，下次 reload 又會完整回填，然後過幾秒又壞掉。

---

## 根因

0905 初版 autosave 的 effect 第一版：

```ts
const description = useCardBuilderStore((s) => s.description);
const backFields = useCardBuilderStore((s) => s.backFields);
const links = useCardBuilderStore((s) => s.links);

useEffect(() => {
  if (!cardId) return;

  const snapshot = JSON.stringify({ description, backFields, links });
  if (snapshot === lastStep4SnapshotRef.current) return;   // ← baseline 比對
  lastStep4SnapshotRef.current = snapshot;                  // ← 立刻把 baseline 設成當前 snapshot

  if (step4SaveTimerRef.current) clearTimeout(step4SaveTimerRef.current);
  step4SaveTimerRef.current = setTimeout(() => {
    cardService.update(cardId, { settings: { description, backFields, links } });
  }, 1000);
  ...
}, [cardId, description, backFields, links]);
```

外層 `useEffect`（CardBuilderEditor.tsx 的 mount effect）順序是：

1. `templateId` 變 → 跑 `reset()`（store 清空為 defaults：`description=''`, `backFields=[{empty}]`, `links=[]`）
2. `setCardId(templateId)` → 觸發 re-render
3. **Step 4 autosave effect 第二次跑**（deps 的 `cardId` 從 `null` 變成 `xxx`）
   - 此時 store 還是 reset 後的 empty defaults
   - `snapshot = JSON.stringify({description:'', backFields:[{empty}], links:[]})`
   - 跟 baseline（init `''`）不同 → 立刻把 baseline 設成這個 empty snapshot，**並 schedule 1 秒後的 PUT**
4. `cardService.getById(templateId)` async resolve（本地開發瞬間完成；但 production 走 Cloudflare Worker edge，可能慢）
5. `.then` 跑 `loadSettings(template.settings)` → store 更新成 DB 的真實資料
6. Effect re-run → snapshot 是真實資料、跟 baseline 不同 → schedule 新 timer，**但舊的 1s timer 也還沒被 cancel 乾淨**

**慢網路情境（getById > 1s）**：

- T = 0：mount、`reset()`、`setCardId(xxx)`、autosave schedule T1（PUT empty defaults）
- T = 1100：T1 還沒被 cancel 乾淨（因為 loadSettings 還沒 resolve，effect 還沒 re-run 過）→ **PUT 帶 empty defaults**
- T = 1500：getById 終於 resolve、loadSettings 把 store 更新成 DB 真實值
- 但 PUT 已經把 `description=''`、`backFields=[{empty}]` 寫進 DB（merge 在 DB 端做，empty 覆寫 real）

為什麼 **links** 看似存活？實測時 links 通常是空的或只有一筆，後端 merge 後看起來跟原狀差不多（特別是當使用者只刪掉了一筆 link，但 description / backFields 是全新內容）—— 所以使用者主觀認為「只有 links 留下來」，其實是 description / backFields 被洗空、links 因為本來就少 / 空所以視覺上看起來「沒變」。

---

## 寫一條 failing test 重現 bug

`CardBuilderEditor.autosave.test.tsx` 加一個慢網路情境：

```ts
it('does NOT autosave empty defaults when getById resolves slowly (regression — 2026-09-05)', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });

  // Override default mock to simulate slow network (resolve after 1500ms).
  vi.mocked(cardService.cardService.getById).mockImplementationOnce(
    () => new Promise((resolve) => setTimeout(() => resolve({
      id: 'test-template-id',
      settings: FULL_SETTINGS,
    }), 1500)),
  );

  renderWithRouter();

  // Drive past the 1s autosave debounce BEFORE the fetch resolves.
  await act(async () => { vi.advanceTimersByTime(1100); });

  // The bug: this assertion FAILS — autosave fired with empty defaults.
  const emptyPayloads = updateCalls.filter((u) => {
    const s = (u.payload as { settings?: Record<string, unknown> })?.settings ?? {};
    return s.description === '' && Array.isArray(s.backFields) &&
      (s.backFields as unknown[]).length === 1 &&
      ((s.backFields as { value: string }[])[0]!.value === '') &&
      Array.isArray(s.links) && (s.links as unknown[]).length === 0;
  });
  expect(emptyPayloads).toHaveLength(0);  // FAILS without the fix
});
```

Baseline（修補前）：測試紅燈 —— `expect(emptyPayloads).toHaveLength(0)` 拿到 1，PUT 確實帶著 empty defaults 出去。

---

## 修復

加一個 `step4BaselineArmedRef` flag，把「第一次 effect run」當作純 baseline seeding，不排 timer：

```tsx
const step4BaselineArmedRef = useRef(false);

// Reset the armed flag whenever cardId changes — new session = needs fresh baseline.
useEffect(() => {
  step4BaselineArmedRef.current = false;
  lastStep4SnapshotRef.current = '';
}, [cardId]);

useEffect(() => {
  if (!cardId) return;

  const snapshot = JSON.stringify({ description, backFields, links });

  // First run after cardId is set / changed: seed baseline, no PUT scheduled.
  // The current values may be reset() defaults if loadSettings hasn't landed.
  if (!step4BaselineArmedRef.current) {
    step4BaselineArmedRef.current = true;
    lastStep4SnapshotRef.current = snapshot;
    return;
  }

  if (snapshot === lastStep4SnapshotRef.current) return;
  lastStep4SnapshotRef.current = snapshot;

  if (step4SaveTimerRef.current) clearTimeout(step4SaveTimerRef.current);
  step4SaveTimerRef.current = setTimeout(() => {
    const s = useCardBuilderStore.getState();
    cardService.update(cardId, {
      settings: {
        description: s.description,
        backFields: s.backFields,
        links: s.links,
      },
    }).catch((err) => {
      console.warn('[CardBuilderEditor] Step 4 auto-save failed:', err);
    });
  }, 1000);

  return () => {
    if (step4SaveTimerRef.current) clearTimeout(step4SaveTimerRef.current);
  };
}, [cardId, description, backFields, links]);
```

### 為什麼這個寫法是對的

| 情境 | 舊行為（0905 初版） | 新行為（round 2 fix） |
|------|---------------------|------------------------|
| mount + getById 在 1s 內 resolve | baseline 從 '' 改成 empty snapshot；T1 在 1s 後用 empty snapshot 排程；loadSettings 再 schedule 一個 T2 把 T1 cancel → 安全 | 第一次 run 只設 baseline、arm flag；loadSettings 後第二次 run 跟 baseline 比較、schedule T2 → 安全 |
| mount + getById > 1s resolve | baseline 從 '' 改成 empty snapshot；T1 schedule；1s 後 **T1 帶 empty defaults PUT** → DB 被洗 | 第一次 run 只設 baseline、arm flag；T1 **從未 schedule**；1s 後什麼都沒發生 → DB 安全 |
| 使用者在 Step 4 編輯 | 第二次 run 看到 snapshot 不同 → schedule timer | 第二次 run 看到 snapshot 不同 → schedule timer |
| cardId 從 xxx 變 yyy（導航到別的 draft） | 沒有 reset baseline，新 cardId 第一次 run 拿到的 snapshot 可能是前一個 card 的資料，誤 schedule PUT | reset effect 把 flag 跟 baseline 清掉，新 cardId 的第一次 run 純粹 seed baseline |

### CardBuilderEditor 外層 effect 的 reset()

`reset()` 把 store 清空 → `description='', backFields=[{empty}], links=[]`，這正是 round 2 fix 想避開的「baseline 起點」。第一次 effect run 在這個時間點把 baseline 設成 empty snapshot、arm flag，**沒有排 timer**，所以即使 getById 慢也不會把 empty 寫進 DB。當 loadSettings 真的 resolve 後會再觸發一次 effect run，這次 baseline 已經 armed，直接 schedule 一個帶真實資料的 timer。

### Step 2 / Step 3 的「下一步」onSave 不受影響

`handleNext` 的 step 2 / 3 / 4 onSave 是另一條路（user-triggered、await 同步），跟這條 autosave timer 完全獨立。autosave 只在 description / backFields / links 真的有改動時 PUT，不影響 onSave。

---

## 驗證

- `CardBuilderEditor.autosave.test.tsx`：7 個測試全綠（含新加的慢網路 regression test）
  - ✅ `autosaves description after the user pauses typing for 1s`
  - ✅ `collapses multiple typing bursts into a single debounced PUT`
  - ✅ `autosaves when a backField value changes`
  - ✅ `autosaves when a link value changes`
  - ✅ `does NOT autosave when cardId is null (new-draft mode before first save)`
  - ✅ `persists user-derived backField rows`
  - ✅ `does NOT autosave empty defaults when getById resolves slowly (regression — 2026-09-05)`
- `npm --workspace=apps/frontend run typecheck`：exit 0
- `npm --workspace=apps/frontend run lint`：無新警告（pre-existing 警告與本次無關）
- `npm --workspace=apps/frontend run verify:i18n`：17 namespace / 34 locale files OK
- `npm --workspace=apps/frontend run test`（全跑）：547 passed / 1 failed / 5 skipped。1 個 failed 為 `RegisterForm.test.tsx` 內 mobile field 測試 timeout，與本次變更無關（pre-existing）

---

## 教訓

1. **Effect 的「第一次 run」不可信**。當 effect 依賴外部資源（這裡是 store 來自 async fetch），第一次 run 拿到的值可能是 stale 的 reset 後 default。**第一個 run 應該只做 baseline seeding、不做事**。
2. **長 timer + async fetch 是雷區**。1s 看起來很短，但 production edge / cold Worker / mobile 網路都可以突破。一旦 timer 跟 fetch 結束時間重疊，就會拿 stale 資料寫出去。
3. **JSONB merge 是 silent killer**。後端 merge 用 `||` operator，**empty 值會覆寫 real 值**而不會 throw。所以前端寫 empty PUT 下去不會 500，但 DB 默默被洗空。**前端必須在寫之前保證資料是有效的**，後端的 merge 是純粹的「鍵值覆寫」，不負責資料完整性。
4. **slow-network regression test 應該是這類 effect 的標配**。本來 6 個 test 全綠，沒有覆蓋「fetch 比 debounce 慢」這個時序。一旦時序交錯就壞。

---

## 衍生（follow-up actions）

- [ ] `CardBuilderEditor` 的 name auto-save（CardBuilderEditor.tsx 第 113 行附近）有同樣 pattern 但少了 baseline-arm 機制。確認是否也會在 mount 時拿 `name=''` schedule 一個 1s 後的 PUT（getById 慢的話）→ 大部分時候 name 是空字串不會觸發 PUT，但保險起見也要走同一個 armed-baseline pattern。
- [ ] `CardBuilderEditorWorkspace` 也有自己的 `getById` + `loadSettings` effect（CardBuilderEditorWorkspace.tsx 第 67 行）。它跟 CardBuilderEditor 的 outer fetch 是雙保險，但同時也代表「mount 時 loadSettings 會跑兩次」。下一輪可以考慮移除外層的 fetch（如果 Workspace 那層已經拿得到），把單一資料來源原則貫徹。
- [ ] 把這次教訓寫進 `runs/improvements/feedback/20260905-step4-autosave-slow-network-baseline.md`（如果有 Saome-self-improvement 流程的話，這個 feedback 該落地）。
- [ ] production smoke test：開一條 PR smoke test，模擬「getById 故意延遲 5s」然後確認前端 store 在這 5s 內不會 schedule 任何 PUT。

---

## Sync 狀態

- **狀態**：✅ 已 commit 至 working tree（未推送）
- **查 SHA**：`git log --oneline -1`（最新 commit 即本筆，等使用者 push）
- **相依 commit**：`3b8038f`（0905 初版 autosave）
