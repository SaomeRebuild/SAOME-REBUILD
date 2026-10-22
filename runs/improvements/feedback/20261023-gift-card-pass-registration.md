# 2026-10-23 — 贈品卡公開頁購買流程

> 實作 `runs/decisions/2026-10-23-gift-card-paid-registration.md` 的完整 trace。
> 本篇記錄「過程中撞到什麼、為什麼這樣改」，決策本身在 Decision Log。

## 起因

CardBuilder Step 6 的贈品卡設定（兌換率 + 四個上下限）早就存在，但公開頁 `/pass/:templateId` 從來沒有「購買」這個動作——填完四個交付欄位就送出。本次補上購買流程。

## 三個撞到的既有假設

### 1. 遷移 024 把贈品卡當「不需付款」

`20261018000001_024_add_not_required_payment_status.sql` 的註解把 gift 卡和 stamp / free reward / cashback / coupon / multipass / free-membership 並列，歸進 `not_required`。前端 `resolvePaymentFields` 照著回傳。

本次刻意只針對贈品卡推翻這個假設（會員卡、點數卡仍然不需付款），並且在 schema 加了 `purchasedPoints + not_required` 的交叉規則擋掉「免費買點數」的髒資料。

### 2. `currency` 只在 `is_paid` 分支輸出 → 公開頁死路

`getPublicService.ts` 原本長這樣：

```ts
...(row.is_paid
  ? { isPaid: true, currency: row.currency ?? 'TWD', membershipTiers: normalizeMembershipTiers(...) }
  : {}),
```

`currency` 被包在 `is_paid` 分支裡。贈品卡的 `is_paid` 是 `false`（它不是付費會員卡），所以前端永遠拿不到幣別 → 無從決定 Payfast 還是綠界 → 即使有購買 UI 也無法完成付款。

這不是「少做了一個功能」，是**公開頁在贈品卡上是一條死路**。修法是新增以 `cardType` 為鍵的獨立分支，並把 `currency` 搬出來。

### 3. Layer 1 契約檔根本不存在

`apps/backend/src/modules/pass-templates/schemas/request.ts` 的檔頭註解宣稱：

```
Layer 1: packages/shared/schemas/passHolder.ts (single source of truth)
```

但 `packages/shared/schemas/passHolder.ts` **從來沒有被建立過**。後端手刻了一份 zod，兩邊可以無聲漂移，註解是誤導。

本次建立該檔案並放進新的贈品契約，檔頭明確記錄「整份 payload 的遷移尚未完成」。這是局部修補，不是徹底遷移（見 Decision Log 決定五）。

## 過程中的兩個實作陷阱

### 陷阱 A：CTA 只檢查「能不能算價」，沒檢查上下限

第一版的 `PassHolderGiftCard` 是這樣決定 CTA 能不能按的：

```ts
// ❌ 只擋「算不出價格」
const derived = purchasedPoints === null ? null : pointsToAmount(purchasedPoints, config);
disabled={disabled || derived === null}
```

寫測試時被三條測試抓到：

- 50 點（rate 是 100元=10點）→ 5 個單位 → **算得出** 500 元，但低於 `checkoutMinPoints = 100`
- 20,000 點 → 算得出，但高於 `checkoutMaxPoints = 10,000`
- 505 點 → 50.5 單位，算不出

前三者裡只有 505 被擋住。50 點和 20,000 點會讓 CTA 可點，顧客按下去之後才吃一個後端 400——正是 inline 驗證要避免的「先點再報錯」死路。

改成用 `validateGiftCardPurchase` 的完整結果當闸門：

```ts
// ✅ 上下限 + 整除性一起擋
const validation = validateGiftCardPurchase(purchasedPoints, config);
const isPurchasable = validation !== null && validation.ok;
disabled={disabled || !isPurchasable}
```

**為什麼第一版會錯**：`pointsToAmount` 回傳 `null` 的語意是「算不出價格」，但「算得出價格且合法」跟「算得出價格但超出範圍」是兩件事。把前者當成完整的驗證結果，是把「型別安全」誤當成「業務正確」。

### 陷阱 B：後端 vitest alias 對「值」import 會失敗

`registerService.ts` 第一次引入 `import { buildGiftCardSnapshot } from '@saome/shared/logic/giftCardPurchase'` 時，後端測試直接炸：

```
Error: Cannot find module '@saome/shared/logic/giftCardPurchase'
```

原因：`apps/backend/vitest.config.ts` 對 `@saome/shared/logic/` 只有一條**帶斜線**的泛用 alias，而既有檔案（如 `logic/cardSettings`）另外都補了一條指到 `.ts` 檔的明確條目。`import type` 在編譯期就被抹掉，所以泛用條目對它永遠夠用；`import { 具名值 }` 才會真的走到解析。

修法是補兩條明確條目，且**必須宣告在泛用條目之前**（Rule 016：vite alias 是前綴比對，先命中者勝）：

```ts
'@saome/shared/schemas/passHolder':   '.../schemas/passHolder.ts',
'@saome/shared/logic/giftCardPurchase': '.../logic/giftCardPurchase.ts',
```

`apps/frontend` 的 `vite.config.ts`（surface 3）與 `vitest.config.ts`（surface 4）同樣各補一條。

**教訓**：monorepo 裡新增一個 `@saome/shared` 的**值**import，要同時確認三個地方（tsconfig `paths` 靠 `*` 通配已經 OK、vite alias、vitest alias）。tsconfig 綠不代表 runtime 解析得到。

## 為什麼抽出 `usePassHolderPayment`

加上贈品卡分支之後，`PassHolderRegistration.tsx` 會超過 400 行。Rule 000 § A.2 要求主組件 ≤ 100 行，且 JSX 超過 50 行就該拆。

把付款編排（tier / points / 支付狀態機 / refs / `onCtaClick` / `onRetryIssuance` / `submitBlocked` / submit-error state）整組搬到 `usePassHolderPayment`。搬的時候順手把三份幾乎一樣的 payload literal（表單送出 / 付款 CTA / 重試簽發）合併成一個 `buildRegisterPayload()`——原本三份各自組裝，新增欄位時必然漏掉其中一份。

**驗證方式**：既有 `PassHolderRegistration.test.tsx` **一行未改**，71 個測試全綠。重構沒有行為變更這件事，是由那 71 個測試保證的，不是用肉眼看。

新的贈品卡測試另開一個檔案（`PassHolderRegistration.giftCard.test.tsx`），刻意不動既有檔案，避免「新增測試順便改舊測試」掩蓋重構迴歸。

## 安全性：價格永遠不接受客戶端輸入

這是整個功能最重要的性質，用三層釘死：

1. **前端**只送 `purchasedPoints`（數量）。`PassHolderPayload` 沒有金額欄位，`buildRegisterPayload` 也不組出金額。
2. **後端** `deriveGiftCardPurchase()` 從模板自己的 `settings.giftCard*` 重新推導金額，payload 裡就算塞了 `paidAmount` / `amount` / `giftCardSnapshot` 也完全不讀。
3. **快照寫入 JSONB 前**再過一次 `giftCardSnapshotSchema.parse()`（Rule 032 § 1：應用層先擋，不靠 DB constraint）。

測試 `register.test.ts` 有一條專門餵髒資料：

```ts
it('ignores a client-supplied price — the amount is always re-derived', async () => {
  await registerService(sql, env, id, { ...giftPayload, paidAmount: 1, amount: 1, giftCardSnapshot: { amount: 1 } });
  expect(input?.paidAmount).toBe(5000);   // 不是 1
});
```

## 測試與驗證

| 套件 | 結果 |
|---|---|
| `packages/shared` | 18 files / 544 tests 綠 |
| `apps/backend` | 45 files / 769 tests 綠（新增 27） |
| `apps/frontend` | 152 files / 2007 tests 綠（新增 36） |
| `npx tsc -b --noEmit`（前後端） | exit 0 |
| `npm run lint`（frontend） | exit 0 |
| `npm run verify:i18n` | OK，21 namespaces / 42 locale files |
| `npm run build` | exit 0 |
| build 後 bundle grep（Rule 017） | 無 localhost；production API URL 命中 3 處 |

新增測試分佈：

- `shared/logic/giftCardPurchase.test.ts`（18）— 匯率換算、整除性、上下限優先序
- `shared/schemas/passHolder.test.ts`（13）— Layer 1 zod 契約與 i18n key 一致性
- `backend/.../getPublic.test.ts`（+22）— 贈品卡投影、`normalizeGiftCardConfig` 純函式
- `backend/.../register.test.ts`（+5 淨）— 價格重導、上下限拒絕、非贈品卡不受影響
- `frontend/.../PassHolderGiftCard.test.tsx`（27）— 區塊渲染、幣別路由、金額換算、CTA 閘門、無障礙
- `frontend/.../PassHolderRegistration.giftCard.test.tsx`（9）— 分支互斥、payload 內容、非法值不發請求

### 一次平行跑測試造成的假失敗

`apps/backend` 與 `packages/shared` 同時跑時，backend 的 `sql-count-baseline.test.ts` 8 條全紅；單獨跑全綠，`git stash` 後跑 HEAD 也全綠。

原因是兩套 workerd 測試同時啟動 miniflare runtime 搶同一批 temp 目錄（stderr 有 `EBUSY: resource busy or locked`）。**workerd 測試套件必須序列執行**，不能平行。

## 待辦（未完成）

- **遷移 027 尚未 apply。** 本次工作階段無法呼叫 Supabase MCP：
  1. 起初 `saome-supabase` MCP 回報 `needsAuth`、`tools: []`。
  2. 恢復連線後 `GetMcpTools` 可以列出 `apply_migration`（`serverStatus: connected`，schema 完整），但 `CallMcpTool` 對 `user-saome-supabase` / `saome-supabase` / `user-saome_supabase` 三種 server id 一律回 `MCP descriptor not found`——該工具沒有以可直接呼叫的函式形式出現在本 session 的工具集裡。

  依 Rule 035 § 4（MCP 失敗時**不可** commit workaround、不可先 commit SQL 再等），本次**沒有**：
  - 用 psql / Supabase CLI 手動改 DB
  - 在 `.applied-migrations.json` 補一筆假的 entry

  migration 檔已寫好但**未登記**。`npm run check:migrations` 目前會紅，這是**預期且正確**的行為——它擋下的正是「DB 還沒套就 deploy」這個 production 500 的成因。

  恢復可呼叫的 MCP 工具後依序執行：
  1. `apply_migration` 套用 `20261023000001_027_add_pass_holder_gift_card_purchase_fields.sql`
  2. 在 `supabase/migrations/.applied-migrations.json` 補 entry（`applied_by: gift-card-paid-registration`, `via: saome_supabase-mcp`）
  3. 重跑 `npm run check:migrations --workspace=apps/backend` 確認 exit 0

  在此之前**不可** deploy backend，否則第一筆贈品卡 POST 會因缺 `purchased_points` / `gift_card_snapshot` 欄位而 500。

  **附带发现（Rule 037 的补充）**：現有 `037-mcp-tool-call-pattern.mdc` 只涵蓋「pre-listed 工具被 `CallMcpTool` 包起來會失敗」。本次撞到的是**反向**情況——工具不在 `<mcp_meta_tools>`（runtime discover），`GetMcpTools` 查得到 descriptor，但 `CallMcpTool` 的 runtime dispatch 同樣查不到。建議在該 rule 加第三種情境：**`GetMcpTools` 能列出 ≠ `CallMcpTool` 能派發**。

## 相關

- `runs/decisions/2026-10-23-gift-card-paid-registration.md`
- `supabase/migrations/20261023000001_027_add_pass_holder_gift_card_purchase_fields.sql`
- `apps/backend/src/modules/pass-templates/services/registerService.ts::deriveGiftCardPurchase`
- `packages/shared/logic/giftCardPurchase.ts`
- `apps/frontend/src/components/business/pass/PassHolderGiftCard/`