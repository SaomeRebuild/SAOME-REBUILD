# Decision：會員等級快照改為後端推導（涵蓋免費會員卡）

- **日期**：2026-10-27
- **狀態**：已採用
- **影響範圍**：`/pass/:templateId` 公開註冊頁、`POST /api/pass-templates/:id/register`、`public.pass_holders` 表、Passcreator V3 簽發

## 背景

前一版計畫（`plan_v3-pass_欄位值表現方式_—_拜訪次數單位_+_會員卡_member_level`）的 B 段假設：「免費會員卡沒有 tier snapshot，簽發時 fallback 到範本第一個 tier 名稱」。使用者指出這個假設本身是錯的：

> 免費會員的模板也是有填寫會員等級名稱的，雖然只會有一個層級，但還是有等級名稱。也就是說對於免費會員卡註冊而言，還沒有做 membership_tire_snapshot，這個要先做。

實際查證後確認，問題比「fallback 寫錯地方」更根本——**免費會員卡註冊從來沒有產生過任何 tier snapshot**。原因在三處串起來的限制：

1. **公開 DTO 不回傳免費卡的 tier 清單。** `apps/backend/src/modules/pass-templates/services/getPublicService.ts::projectOptionalFields` 只在 `row.is_paid` 為真時才回傳 `membershipTiers`；免費會員卡的 `settings.isPaid` 是 false／缺漏 → 公開頁的 `template.membershipTiers` 是 `undefined`。
2. **前端從不組 snapshot。** `PassHolderRegistration.helpers.ts::buildRegisterPayload` 只在 `opts.isPaidMembership` 為真時呼叫 `buildMembershipTierSnapshot` → 免費卡送出 `membershipTierSnapshot: undefined`。
3. **後端照單全收。** `registerService.ts` 把 `payload.membershipTierSnapshot` 直接透傳進 `upsertPassHolder` → 免費卡 DB 欄位 `membership_tier_snapshot` 是 NULL。

所以免費會員持有人的等級名稱從來沒有被記錄過。Wallet 上的 memberLevel 槽位（`{memberLevel}` placeholder）自然無值可填。

順帶查出一個既有弱點：**付費會員卡的 snapshot 也是前端自報的**。前端送 `name` / `durationType` / `paidAmount` / `currency`，後端的 `membershipTierSnapshotSchema` 只驗欄位形狀（型別、長度、enum），不跟範本重算——所以 client 可以自稱一個租戶從未開出的等級名稱，或報一個租戶從未設定的價格。這跟 2026-10-23 贈品卡決策「價格一律後端重算、不信 client」是同一個原則的兩次應用。

另外，`apps/backend/src/modules/pass-templates/schemas/request.ts` 的檔頭註解宣稱 Layer 1 是 `packages/shared/schemas/passHolder.ts`，但 `membershipTierSnapshotSchema` 從來只存在於後端——shared 套件有 TypeScript interface 卻沒有 runtime validator，兩邊可以無聲漂移。

## 選項與決定

### 決定一：snapshot 一律後端推導，client 只送 tier index

- **選項 A**：維持前端組 snapshot，後端照收。免費卡另開一條路徑讓前端補送。
- **選項 B**：後端從範本自己的 `settings.membershipTiers[]` 重算 snapshot，client 送的全部內容一律不採信。

**決定：選項 B。**

理由有三層：

**其一，消除 client 自稱價格的漏洞。** 這是 2026-10-23 贈品卡決策的同一條原則——「任何客戶端傳來的價格都是不能信的」。付費卡今天就是能自稱價格，這次一併收掉。

**其二，範本層是唯一真相。** snapshot 的存在目的就是「把註冊當下那一層級凍結成不可變的收據」。若 snapshot 的內容來自 client，它凍結成的是 client 說的話，不是租戶的設定。租戶在公開頁開著的那幾秒內改了等級名稱，server-derived 的 snapshot 記的是 DB 當下的值（真相），client-derived 記的是頁面載入時的舊值（stale）。

**其三，免費卡的路徑自然統一。** 免費卡與付費卡走同一條 `resolveMembershipTierSnapshot`，只是餵不同的 index（免費卡固定 0）與不同的 mode。沒有第二條需要維護的分支。

代價是前端必須停止送 snapshot——這是 breaking change，但只影響我們自己的前端與尚未升級的舊版部署前端。舊版前端仍會送該欄位，後端忽略即可（schema 保留該欄位但不使用其內容）。

### 決定二：免費卡的 snapshot 記 `durationType: null` + `paidAmount: null`

- **選項 A**：統一要求 `durationType` 為 `'monthly' | 'yearly'`，免費卡硬塞一個值。
- **選項 B**：放寬 `durationType` 為可 null，免費卡記錄「無週期、無價格」的真實狀態。

**決定：選項 B。**

免費會員卡的 tier 本來就沒有月／年週期——它的到期是卡級的（`membershipExpiryMode` / `membershipCustomExpiryDays` / `membershipSpecificExpiryDate`），不是 per-tier 的。硬塞 `'monthly'` 會讓 `membershipDurationTypeFromSnapshot` 回傳 `'monthly'`，進而讓 `membershipExpiryRule` 走錯分支。

更關鍵的是**過期資料的陷阱**：編輯器把一張卡從付費切到免費時，`setHasExpiry(false)` 只清 `durationType`，`monthlyCost` / `yearlyCost` / `lifetimeCost` 都被保留。所以一張「曾經是付費卡」的免費卡，其 tier row 上可能還留著 `durationType: 'monthly'` 與 `monthlyCost: 200`。若照抄 tier row，免費持有人會被記成「月付 200 元」——一個他們從未支付過的價格。

因此 `resolveMembershipTierSnapshot` 有一個明確的 `mode: 'paid' | 'free'` 參數：`'free'` 時 `durationType` 與 `paidAmount` 一律為 null，與 tier row 殘留什麼無關。

`durationType` 放寬為 nullable 需要四層同步（Rule 019 § 4.1）：shared type → shared zod → backend request schema → DB row interface。`MembershipTierSnapshot`（shared types）與 `membershipTierSnapshotSchema`（shared zod）都改；backend request schema 改為引用 shared 版本，刪掉本地重複定義（順帶修掉 Layer 1 缺 validator 的老問題）。

### 決定三：免費卡的 `payment_status` 強制為 `not_required`

- **選項 A**：沿用 client 送的值。
- **選項 B**：server 強制寫 `not_required`，並清掉 `payment_provider`。

**決定：選項 B。**

免費卡沒有付款概念，`not_required` 是唯一誠實的值（migration 024 已把 DB CHECK 放寬到四值）。讓 client 自稱 `'completed'` 會在 DB 留下一筆「已付款」的免費卡——正是那類語意垃圾。與 tier snapshot 同一個「server 決定」立場。

## 影響

### 受影響的檔案

| 檔案 | 變更 |
|---|---|
| `packages/shared/types/passHolder.ts` | `MembershipTierSnapshot.durationType` 放寬為 nullable；`PassHolderPayload.membershipTierSnapshot` 註明不再由 client 送出 |
| `packages/shared/schemas/passHolder.ts` | 新增 `membershipTierSnapshotSchema`（持久化形狀）與 `membershipTierSnapshotInputSchema`（client 輸入形狀） |
| `packages/shared/logic/membershipTier.ts` | 新增 `resolveMembershipTierSnapshot` 與 `membershipTierNameFromSnapshot` 純函式 |
| `apps/backend/.../schemas/request.ts` | 改引用 shared schema，刪除本地重複定義 |
| `apps/backend/.../services/registerService.ts` | 新增 `deriveMembershipTierSnapshot`；`selectedTierIndex` / `membershipTierSnapshot` / `paymentStatus` 全改由 server 推導 |
| `apps/backend/.../passcreator/v3-pass-types.ts` | `PassIssueHolderData` 新增 `memberLevel?` |
| `apps/backend/.../passcreator/v3-pass.ts` | `data.memberLevel` 於有值時才送出 |
| `apps/frontend/.../PassHolderRegistration.helpers.ts` | 移除 `buildMembershipTierSnapshot`；`buildRegisterPayload` 不再組 snapshot |
| `apps/frontend/src/i18n/locales/passHolder.{zh-TW,en}.ts` | 新增 `membershipTierRequired` / `membershipTierInvalid` |

### 資料庫

**不需要 migration。** `membership_tier_snapshot` / `selected_tier_index` 欄位早在 migration 023 就存在，本次只改寫入內容。

### 行為變更

- 免費會員卡註冊現在會寫入 `membership_tier_snapshot`（含 tier 名稱）與 `selected_tier_index = 0`；`payment_status` 強制 `not_required`。
- 付費會員卡的 snapshot 內容改由範本重算，client 送的值不再被採信。同一組 tier 設定下，結果與 client 原本送的值相同（前端 `buildMembershipTierSnapshot` 就是照同一組欄位組的）——所以既有付費卡的路徑是行為等價的，差別只在「誰說了算」。
- `selectedTierIndex` 越界或付費卡缺 `selectedTierIndex` → 400（`membershipTierRequired` / `membershipTierInvalid`）。這是新的拒絕路徑：原本付費卡缺 index 會靜默寫 NULL snapshot。
- 非會員卡（stamp / reward / cashback / coupon / gift / multipass / discount）完全不受影響：不寫 snapshot、不寫 `selected_tier_index`。

### 已知限制

- **已註冊的舊持有人不會補快照。** 2026-10-27 之前註冊的免費會員持有人，`membership_tier_snapshot` 仍是 NULL，`data.memberLevel` 不會有值。要補需要 backfill + 受控 re-push（Wallet 側的舊 pass 不會自動更新），另案處理。
- **`memberLevel` 只在簽發當下送出一次。** 它是持有人資料（跟 `memberName` / `phone` / `email` 同路徑），不進 runtime metrics 的 PATCH 契約。
