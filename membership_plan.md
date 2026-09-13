---
name: 修正 Membership Card Strip/Back/isPaid 三項問題
overview: 修正會員卡的預覽 strip 顯示、卡片背面渲染、與 step2 isPaid 自動儲存。涉及 CardBuilderEditorPreview、PassCardPreviewStrip、PassCardPreviewBack、CardBuilderEditor 四個檔案的修改。
todos:
  - id: "1"
    content: 改 CardBuilderEditorPreview 的 isMembership 計算邏輯
    status: completed
  - id: "2"
    content: 改 PassCardPreviewStrip 的 isMembership value 顯示邏輯
    status: completed
  - id: "3"
    content: 改 PassCardPreviewBack：移除 Section 1.5，把會員獎勵搬到 Section 4
    status: completed
  - id: "4"
    content: 加 isPaid autosave effect 到 CardBuilderEditor
    status: completed
  - id: "5"
    content: 補 i18n key membershipRewardsEmpty
    status: completed
  - id: "6"
    content: 跑 typecheck + 既有 CardBuilderEditor 相關測試
    status: completed
isProject: false
---

# Membership Card 預覽與儲存修正

## 問題分析

| # | 問題 | 根因 |
|---|------|------|
| 1 | Strip 在用戶選 membership 卡時就該顯示會員姓名 + 預設名（不是只有勾「需收費」後才顯示）；預設名不應被 logo text 覆蓋 | `CardBuilderEditorPreview.tsx` 的 `isMembership = cardType === 'membership_card' && isPaid === true` 把 isPaid 綁進 strip 條件；`PassCardPreviewStrip.tsx` 用 `name \|\| defaultName` 邏輯，logoText 一旦填寫就會覆寫預設名 |
| 2 | 卡片背面的「會員獎勵」應出現在背面欄位（Section 4）位置，而不是目前覆寫在描述區下方的 Section 1.5 | `PassCardPreviewBack.tsx` 的 Section 1.5 邏輯寫在 description 之後，正確位置應在 Section 4（取代背面欄位），因為會員卡的背面欄位語意就是會員獎勵 |
| 3 | Step 2 「需收費」checkbox 似乎沒儲存狀態或回填 | `CardBuilderEditor.tsx` 沒有 isPaid 的 autosave effect，使用者切換 checkbox 後若未點「下一步」就離開，變更就丟失；即使有點 Next 也只靠該次 PUT，無後續 debounced 保護 |

## 修改清單

### 修改 1 — Strip 在選 membership 卡時就顯示會員姓名 + 預設名

**檔案 1**：[apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorPreview.tsx](apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorPreview.tsx) line 154

把
```ts
const isMembership = cardType === 'membership_card' && isPaid === true;
```
改成
```ts
// 2026-09-13 fix: strip 會員姓名 layout 只要 cardType 是 membership_card
// 就該顯示，不論是否付費。isPaid 仍由 MembershipCardLogic 決定 Step 6 是否
// 顯示付費 tier editor，與預覽 strip 無關。
const isMembership = cardType === 'membership_card';
```

保留 `isPaid` 變數供其他判斷使用（目前 CardBuilderEditorPreview 只用於 isMembership 計算，但保留以便日後需要時不必重新拉 store）。

**檔案 2**：[apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewStrip.tsx](apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewStrip.tsx) line 195-198

把
```tsx
<span className={...}>
  {name || t('fieldPreview.memberName.value')}
</span>
```
改成
```tsx
{/* 2026-09-13 fix: 預設名（王大明 / Thabo Mokoena）固定來自 i18n，
    不再被 logo text (`name` prop) 覆寫。Logo text 是 pass header 文字，
    跟持有人姓名是不同的語意槽位。 */}
<span className={...}>
  {t('fieldPreview.memberName.value')}
</span>
```

`name` prop 此時在 strip 的 isMembership 分支完全沒用，可保留 prop 簽章以免破壞其他呼叫端，但 strip 內部已不讀它。

---

### 修改 2 — 背面欄位（Section 4）改顯示會員獎勵

**檔案**：[apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewBack.tsx](apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewBack.tsx)

刪除現有 Section 1.5（line 94-122）：
```tsx
{/* Section 1.5: 會員獎勵 (membership card only, 2026-09-13) */}
{isMembership && filteredMembershipRewards.length > 0 && (
  <div className="rounded-lg bg-white p-3" data-testid="membership-rewards">
    <h3>...</h3>
    <ul>...</ul>
  </div>
)}
```

同時刪除 `filteredMembershipRewards` 的計算（line 53-57），因為 Section 4 會自己處理。

修改 Section 4（line 169-200 附近），當 `isMembership` 時渲染會員獎勵取代原本的 backFields：

```tsx
{/* Section 4: 背面欄位 / 會員獎勵 (membership card 把會員獎勵當作背面欄位) */}
<div className="rounded-lg bg-white p-3">
  {isMembership ? (
    filteredMembershipRewards.length > 0 ? (
      <ul className="flex flex-col">
        {filteredMembershipRewards.map((row, idx) => (
          <li
            key={idx}
            className={cn(
              'flex flex-col items-start gap-0.5 py-2 text-neutral-700',
              compact ? 'text-xs' : 'text-sm',
              idx > 0 && 'border-t border-neutral-200'
            )}
          >
            <span className="text-neutral-500">{row.label}</span>
            <span className="whitespace-pre-wrap break-words">{row.value}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className={cn('text-neutral-500', compact ? 'text-xs' : 'text-sm')}>
        {t('preview.backSide.membershipRewardsEmpty')}
      </p>
    )
  ) : filteredBackFields.length > 0 ? (
    /* 原本的 backFields 渲染 ... */
  ) : (
    /* 原本的 placeholder ... */
  )}
</div>
```

i18n 新增 key：
- `apps/frontend/src/i18n/locales/cardEditor.zh-TW.ts` 的 `preview.backSide` 加 `membershipRewardsEmpty: '尚未新增會員獎勵'`
- `apps/frontend/src/i18n/locales/cardEditor.en.ts` 同位置加 `membershipRewardsEmpty: 'No member rewards yet'`

`filteredMembershipRewards` 的計算改回放在 Section 4 內部（只引用一次），或保留為 memo。

---

### 修改 3 — isPaid checkbox 加 autosave

**檔案**：[apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx](apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx)

在現有 `logoTextSaveTimerRef` 附近（約 line 158-178）新增：

```tsx
// ============================================================
// Auto-save: isPaid toggle (Step 2 需收費 checkbox) → debounced PUT
//
// 2026-09-13 fix: 原本 isPaid 只在 Step 2 的「下一步」handleNext 內被送出，
// 使用者切換 checkbox 後若未點 Next 就離開 Step 2，變更會丟失。改用
// 與 logoText 同樣的 baseline-armed + debounce pattern，讓 checkbox
// 一變更就 debounce 1s 後 PUT，避免依賴「點 Next 才存」的 UX 假設。
// ============================================================
const isPaidSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const isPaid = useCardBuilderStore((s) => s.isPaid);
const isPaidBaselineArmedRef = useRef(false);

useEffect(() => {
  isPaidBaselineArmedRef.current = false;
}, [cardId]);

useEffect(() => {
  if (!cardId) return;
  if (!step4LoadSettledRef.current) return;

  if (!isPaidBaselineArmedRef.current) {
    isPaidBaselineArmedRef.current = true;
    return;
  }

  if (isPaidSaveTimerRef.current) clearTimeout(isPaidSaveTimerRef.current);
  isPaidSaveTimerRef.current = setTimeout(() => {
    cardService.update(cardId, { settings: { isPaid } }).catch((err) => {
      console.warn('[CardBuilderEditor] isPaid auto-save failed:', err);
    });
  }, 1000);

  return () => {
    if (isPaidSaveTimerRef.current) clearTimeout(isPaidSaveTimerRef.current);
  };
}, [cardId, isPaid]);
```

注意 `step4LoadSettledRef` 在現有程式已用於保護 logoText autosave 共用同樣的載入時間軸，這裡繼續沿用避免引入新 ref。

---

## 影響範圍檢查

| 既有測試 | 預期結果 |
|---|---|
| `PassCardPreviewStrip.test.tsx` (若存在) | isMembership branch 改為不再依賴 `name` prop，需更新 mock |
| `PassCardPreviewBack.test.tsx` (若存在) | Section 1.5 移除後，原本斷言 `data-testid="membership-rewards"` 的測試要改為斷言 Section 4 的獎勵列表 |
| `MembershipExtensionField.test.tsx` (若存在) | 切換 checkbox 後無 Next 也會 autosave，需確認現有測試不依賴「必須點 Next 才儲存」假設 |
| `CardBuilderEditor.autosave.test.tsx` | 新增 isPaid autosave 測試：toggle 後 1s 觸發 PUT /api/cards/:id payload 內 `settings.isPaid === true` |
| `CardBuilderEditorWorkspace.step6-integration.test.tsx` | 不受影響（Step 6 邏輯不變） |

---

## 不修改的部分

- Step 6 `MembershipCardLogic` 的 tier / rewards 編輯器與 isPaid 切換後續邏輯保持不變
- `MembershipHasExpiryToggle` 切換按鈕設計保持不變（先前已修過背景色）
- `PassCardPreviewBody` 的左右欄位（會員等級 / 金級）保持不變
- 後端 schema（`isPaid: z.boolean().optional()` 已在 `templateSettingsSchema`）與 db migration 保持不變

## 驗證

```bash
# 修改後必跑
npm run typecheck
npm test -- --run apps/frontend/src/components/business/dashboard/CardBuilderEditor
npm run verify:i18n
```

## 觸發規範

- 修改 `CardBuilderEditorPreview.tsx` 屬於改既有 L2 元件，PR 描述需註明影響範圍
- 修改 `PassCardPreviewStrip.tsx` / `PassCardPreviewBack.tsx` 同屬改既有 L2 業務元件，註明下游依賴（`PassCardPreview`）
- 行為變更需要更新對應 `.stories.tsx`（若存在）