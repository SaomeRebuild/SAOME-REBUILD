# Decision：贈品卡公開頁購買流程

- **日期**：2026-10-23
- **狀態**：已採用
- **影響範圍**：`/pass/:templateId` 公開頁、`POST /api/pass-templates/:id/register`、`public.pass_holders` 表

## 背景

CardBuilder Step 6 的贈品卡設定（`giftCardAmount` / `giftCardPoints` 與四個上下限欄位）一直存在，但從來沒有被「消費」——公開頁只填四個交付欄位就完成註冊，購買點數這個動作根本不存在。

要補上購買流程，先撞到三個既有假設：

1. **遷移 024 把贈品卡歸類為「不需要付款」。** `20261018000001_024_add_not_required_payment_status.sql` 的註解明確把 gift 卡列為 `not_required`，前端 `resolvePaymentFields` 也照著回傳 `not_required`。這是本次要推翻的核心假設：贈品卡是「要花錢買點數」，只是它不是「付費會員卡」。

2. **`currency` 只在 `is_paid` 分支輸出。** `getPublicService` 把 `currency` 與 `isPaid` / `membershipTiers` 綁在一起，贈品卡走不到那條分支，所以前端永遠拿不到幣別，Payfast／綠界無從選擇——公開頁是一條死路。

3. **全庫沒有任何點數欄位或點數帳本。** 連一筆「買了多少點」都沒有地方記。

另外，`apps/backend/src/modules/pass-templates/schemas/request.ts` 的檔頭註解宣稱 Layer 1 是 `packages/shared/schemas/passHolder.ts`，但那個檔案從來不存在——後端手刻了一份 zod，兩邊可以無聲漂移。

## 選項與決定

### 決定一：贈品卡走獨立分支，不併入 `is_paid`

- **選項 A**：`cardType === 'gift_card'` 時把 `isPaid` 也設成 `true`，重用會員分支。
- **選項 B**：新增以 `cardType` 為鍵的獨立投影分支，與 `is_paid` 分支互斥。

**決定：選項 B。**

`isPaid` 在既有程式碼裡的語意是「這張卡有會員等級清單，要選等級才能買」。硬塞給贈品卡會產生兩個後果：`PassHolderMembershipTiers` 會拿到空的 tier 清單（前端因此渲染空的 radiogroup），而且 `resolvePaymentFields` 會要求一個根本不存在的 `selectedTierIndex`。用 `cardType` 當分支鍵，語意乾淨：會員卡看 `isPaid`，贈品卡看 `cardType`。

代價是 `projectOptionalFields()` 要同時處理兩條分支，且 `currency` 必須從 `is_paid` 分支裡搬出來（原本只有付費會員卡拿得到）。

### 決定二：輸入點數，金額唯讀換算

- **選項 A**：讓顧客輸入金額，系統換算點數。
- **選項 B**：讓顧客輸入點數，金額唯讀顯示。

**決定：選項 B。**

贈品卡賣的東西就是點數，讓顧客填金額等於多一個他沒有理由填的欄位。更重要的是：填金額的話，前端就會送出「價格」這個欄位，而任何客戶端傳來的價格都是不能信的。改成輸入點數之後，payload 裡只有一個「數量」欄位，價格永遠由後端從模板自己的設定推導——這讓「後端重新計算」從防禦性措施變成結構上的必然。

### 決定三：點數存成 `purchased_points` 欄位，不建點數帳本表

- **選項 A**：建 `pass_holder_points_ledger`（每筆充值／消費一列），`pass_holders` 存目前餘額。
- **選項 B**：只在 `pass_holders` 加一欄 `purchased_points` 記錄「這次買了多少」。

**決定：選項 B。**

完整的點數帳本需要餘額、交易類型、原子扣減、對帳——那是另一個 L3 Heavy 的工作量，而且要有真實的付款回調才有東西可記。現在連 Payfast／綠界都還是模擬的，記帳只會產生一個永遠對不上的假餘額（模擬付款可以無限重複，帳本會被灌爆）。

`purchased_points` 記錄的是「購買事實」，不是「餘額」，語意不會誤導。等真實金流上線、有了回調冪等性再做帳本。

### 決定四：兌換率凍結成 JSONB 快照

- **選項 A**：只存 `purchased_points` + `paid_amount`，事後顯示時用模板當下的設定重算。
- **選項 B**：額外存 `gift_card_snapshot` JSONB，凍結購買當下的兌換率與上下限。

**決定：選項 B。**

商家隨時可以在 Step 6 改兌換率。只存金額的話，三週後才 render 的收據會顯示一個顧客當初沒有同意過的價格。快照讓 DB row 自足——`amount === (points / unitPoints) * unitAmount` 這個等式可以只用 row 裡的資料重算，不需要讀模板（`giftCardPurchase.test.ts` 有 pin 這個契約）。

這個寫法沿用既有的 `membership_tier_snapshot` 模式，不是新發明。

### 決定五：不整份遷移註冊 payload，只補新的 Layer 1 契約

`packages/shared/schemas/passHolder.ts` 從不存在，但後端 `request.ts` 宣稱它是 Layer 1。

- **選項 A**：把整份 `passHolderRegisterPayloadSchema` 搬進 shared。
- **選項 B**：只把這次新增的贈品契約放進 shared，既有 payload 維持後端手刻。

**決定：選項 B。**

整份搬遷會碰到全部既有的註冊測試（四個交付欄位 + 五個付費欄位的每一條 cross-field 規則），風險與本次功能無關。但這次新增的 `purchasedPoints` 契約若繼續手寫在後端，就等於放任新的漂移點。所以補上 shared 檔案、放新的契約進去，並在檔頭明確記錄「既有 payload 的遷移尚未完成」。

## 影響

- **遷移 024 的分類**：贈品卡不再是 `not_required`。既有資料沒有受影響（沒有贈品卡真的走過註冊），但「gift = not_required」這條規則現在只適用於「未設定兌換率且卡別不是 gift_card」的情況。
- **`paid_amount` / `currency` 從未被寫入**：這兩欄自 migration 023 就存在，但沒有任何程式碼路徑寫過它們。本次第一次讓它們有值——所以歷史資料的 `paid_amount` 全是 NULL 是正常的，不是 bug。
- **`resolvePaymentFields` 未改**：仍回傳 `not_required` 給非付費卡。贈品卡走的是另一條路徑（`buildRegisterPayload` 帶著已付款的 `paymentState` 進 `onCtaClick`）。
- **公開頁 DTO 多一個欄位**：`PublicPassTemplate.giftCard`。`getPublic.test.ts` 的 conformance 測試同時 pin 住 shared type 與後端 DTO 的欄位集合，任一邊單獨加欄位都會讓測試紅。
- **前端主組件重構**：付款編排從 `PassHolderRegistration.tsx` 抽到 `usePassHolderPayment`（`PassHolderRegistration.payment.hooks.ts`）。既有 `PassHolderRegistration.test.tsx` 一行未改、71 個測試全綠，作為重構無行為變更的證據。
- **不在本次範圍**：真實 Payfast／綠界串接、完整點數帳本、把整份註冊 payload 遷進 shared。

## 相關

- `supabase/migrations/20261023000001_027_add_pass_holder_gift_card_purchase_fields.sql`
- `packages/shared/logic/giftCardPurchase.ts` — 匯率換算與上下限（前後端共用）
- `packages/shared/schemas/passHolder.ts` — Layer 1 契約
- `runs/improvements/feedback/20261023-gift-card-pass-registration.md`