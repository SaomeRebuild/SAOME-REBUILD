# Step 4 i18n raw key + 欄位未保存

**日期**：2026-09-05
**類型**：bug（DOM 顯示 raw key + 資料儲存缺失）
**影響範圍**：CardBuilderEditor Step 4（描述 / 背面欄位 / 連結）

---

## 症狀

DOM 顯示 `step4.backFields.counter` 而非「1 / 10」／「0 / 10」等計數字串。同時，Step 4 三個欄位（description、backFields、links）即便使用者填寫後也未保存到後端，重新整理或切換 Step 後資料消失。

---

## 根因 1 — i18n raw key

`LabelValueListField.tsx` 的計數字串呼叫：

```ts
const counterText = t(counterKey, { count: rows.length });
// counterKey 為 step4.backFields.counter（來自 BackFieldsField / LinksField）
```

但 `cardEditor.zh-TW.ts` 與 `cardEditor.en.ts` 的 `step4.backFields` 物件**缺少 `counter` 這個 key**。`links.counter: '{{count}} / 4'` 存在，但 `backFields.counter` 從未補上。react-i18next 在 key 缺失時 fallback 回吐原始字串，因此 DOM 顯示 raw key。

`Step4CardInfo.test.tsx` 既有斷言（`screen.getByText('step4.backFields.counter')`）永遠綠，因為測試把 `t()` mock 成「回傳 key 當 text」—— 看不到 raw key 的失敗訊號。

---

## 根因 2 — 欄位未保存

`CardBuilderEditorWorkspace.handleNext` 只在「`step === 4 && cardId && onSave`」分支把 Step 4 欄位送出去，且 `handleNext` 開頭先檢查 `isStep4Valid()`，若描述空或 backFields 任一 value 空就 return，**完全不觸發 onSave**。

意思是：
- 使用者填一半想跳 Step 5 → 按下一步 → isStep4Valid 失敗 → return → 不存 → 切不過去
- 使用者只填 description 沒填 backField value → 同上
- 使用者填完整想切別的 Step → 是會存 → 但**這條路只在「按下一步」時觸發**

沒有 autosave。沒有「未儲存」指示。沒有弱儲存（partial save）。

後端 wrangler 日誌也印證：8 次 PUT 200 OK 但 settings 都不含 `description / backFields / links` —— Step 4 的儲存路徑從未被走到。

`loadSettings` 本身是健康的（既有 store 測試涵蓋），所以**真正缺的是寫入時機**，不是回填。

---

## 修復

### i18n

```diff
// apps/frontend/src/i18n/locales/cardEditor.zh-TW.ts
   backFields: {
     ...
     maxReached: '最多 10 組背面欄位',
+    counter: '{{count}} / 10',
     labelLabel: '標籤',
     valueLabel: '內容',
   },

// apps/frontend/src/i18n/locales/cardEditor.en.ts
   backFields: {
     ...
     maxReached: 'Maximum 10 back fields',
+    counter: '{{count}} / 10',
     ...
   },
```

並加 `Step4CardInfo.i18n.test.ts` 守住：`backFields.counter` 必須存在於 zh-TW 與 en，且 shape 對稱。

### Autosave

在 `CardBuilderEditor.tsx` 加 useEffect，跟既有的「name auto-save」同一模式：

```tsx
const step4SaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const lastStep4SnapshotRef = useRef<string>('');

const description = useCardBuilderStore((s) => s.description);
const backFields = useCardBuilderStore((s) => s.backFields);
const links = useCardBuilderStore((s) => s.links);

useEffect(() => {
  if (!cardId) return;

  const snapshot = JSON.stringify({ description, backFields, links });
  // 第一次 effect run 設 baseline 之後才算變更
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

#### Snapshot guard 為什麼必要

Zustand 的 `useCardBuilderStore((s) => s.backFields)` selector 每次都回傳當下 array reference（immer 不 reuse）。useEffect 直接依賴 `backFields` 會在每個 render 觸發，產生大量寫入。`JSON.stringify` snapshot + ref 比對，過濾掉「內容沒變但 reference 變了」的情形，只對真正的編輯計時器。

#### 為什麼選 1 秒

跟既有的 name auto-save 一致（CardBuilderEditor.tsx 內）。避免在快速打字時每 keystroke 都 PUT。

---

## 驗證

- `Step4CardInfo.i18n.test.ts`：4 個測試全綠
- `CardBuilderEditor.autosave.test.tsx`：6 個測試全綠（涵蓋 description / backField value / link value / debounce collapse / cardId null 不寫 / 使用者衍生 rows）
- `npm --workspace=apps/frontend run typecheck`：exit 0
- `npm --workspace=apps/frontend run lint`：僅 pre-existing 警告（與本次變更無關）
- `npm --workspace=apps/frontend run verify:i18n`：17 namespace / 34 locale files OK
- `npm --workspace=apps/frontend run test`：547 passed / 0 failed

backend / shared 的 7 個失敗為 pre-existing（`sql.json` mock 缺失、`mobile` 欄位驗證）—— 已用 `git stash` 回到 baseline 重跑確認。

---

## 後續

- `isStep4Valid()` 的「通過才儲存」邏輯保留（Apple EULA 要求至少一個 backField value 非空）；autosave 對 partial 資料會 PUT 但 preview 仍正常顯示
- 未來 L3 Heavy：把儲存狀態指示（unsaved / saving / saved）加進 UI，讓使用者看得到進度
- 既有 `Step4CardInfo.test.tsx` 對 raw key 沒抓到的盲點已用檔案掃描測試（`Step4CardInfo.i18n.test.ts`）補上 —— 該測試讀 locale 檔而非 mock `t()`

---

## Sync 狀態

- **狀態**：✅ 已推送至 `main`
- **查 SHA**：`git log --oneline -1`（最新 commit 即本筆）
- **Push 時 GitHub 警告**：6 個 dependabot vulnerabilities（pre-existing，與本次變更無關）
