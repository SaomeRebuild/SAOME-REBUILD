# 2026-10-26 — Pass 無限期到期 slot：runtime 寫入 `∞` + 模板到期欄位型別降級

> 本檔是「Pass 無限期到期 slot」實作的 DEV LOG（實作層）。
> 決策層敘述見 `runs/decisions/2026-10-26-pass-unlimited-expiry-slot.md`（背景 / 選項與決定 / 影響）。
> 本檔責任是「改了什麼、驗證輸出、已知限制、後續 work item」。

## Metadata

- **日期**：2026-10-26
- **作者**：SAOME 開發者（Cursor agent session）
- **計畫**：`C:\Users\user\.cursor\plans\pass-unlimited-expiry-slot_32db6d68.plan.md`（6 個 todo）
- **狀態**：程式碼寫在 working tree，**尚未 commit**（本次 session 不 commit）
- **規則 / skill 觸發**：Rule 000（模組化設計）、Rule 001（方法論）、Rule 003（TDD）、Rule 006（完工前驗證）、Rule 011（開發紀錄）、Rule 019（schema contract drift —— 僅檢查，本次無 schema / DB 變更）、Rule 027（postgres / 非 ASCII）、Rule 038（context budget）、Rule 039（PowerShell-free authoring）、`saome-dev-logging` skill

---

## 一句話總結

**「無限期」卡在 Wallet 上拿不到 `∞`，是「模板端把到期欄位宣告成 `date`」＋「runtime 端無到期日時省略欄位（PATCH 省略 = 保留舊值）」兩處缺陷疊加造成的。本次把 sentinel 收斂成 shared 單一常數、模板端在無法保證每個持卡人都有到期日時把到期欄位降級成 `text`、runtime 端改成送出 `∞` 並在上游回 400 時退回重試。**

| 面向 | 改動 | 落地位置 |
|---|---|---|
| Sentinel 單一真值 | `∞` 從三份字面量收斂成一個常數 | `packages/shared/constants/headerSlots.ts` |
| 模板端 | 到期 slot 無法保證有日期時 → `'text'` | `apps/backend/.../passTemplateMapping.ts` |
| Runtime 端 | 無到期日時寫 `∞`（取代省略） | `packages/shared/logic/passFieldFormatter.ts` |
| Runtime 保險 | 上游 400 → 去掉 `∞` 重試 + `degraded` 旗標 | `apps/backend/src/shared/lib/passcreator/v3-pass.ts` |
| 前端預覽 | 折扣卡 fallback `'—'` → `∞` | `apps/frontend/.../passCardPreviewSlot.ts` |

---

## 已做變更

### 1. shared — `UNLIMITED_EXPIRY_VALUE` sentinel

`packages/shared/constants/headerSlots.ts` 新增：

```ts
export const UNLIMITED_EXPIRY_VALUE = '∞';
```

三個消費端共用同一份真值：runtime formatter（寫入 payload）、模板推送（決定欄位型別）、前端預覽（顯示）。舊的寫法是三份各自維護的字面量（前端 `∞` / `∞` / `'—'`），任何一邊漏改就是「編輯器顯示 `∞`、Wallet 顯示舊日期」。

### 2. shared — `resolveExpirySlotGuaranteesDate()`

`packages/shared/logic/passExpiry.ts` 新增純函式，回傳「這個 template 是否保證**每一位**持卡人都有到期日」。

- `membership_card` → 對 `{durationType: null}` / `monthly` / `yearly` 三種 holder context **逐一檢查**（付費級距是 holder 層級資料，template 層級判斷不到）
- 其他卡種 → 到期設定 card-wide，單一 context 即可
- 判定委派給既有的 `resolveExpiryDate()`，所以「天數 > 0」「合法 ISO 日期」等規則不重複實作；設定損壞自然降級為「不保證」（安全方向）
- 用固定 probe date `2026-01-01` 而非 `Date.now()` → 純函式、可測試

### 3. backend — 到期 slot 的欄位型別

`apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts::mapTemplateToPasscreator()`：

```ts
const headerSlot = getHeaderSlot(template.card_type);
const isExpirySlot = headerSlot !== null &&
  (headerSlot.kind === 'member_expiry' ||
   headerSlot.kind === 'discount_expiry' ||
   headerSlot.kind === 'coupon_expiry');
const expirySlotGuaranteesDate = isExpirySlot
  ? resolveExpirySlotGuaranteesDate(template.card_type, s)
  : true;
```

到期 slot 且「不保證有日期」→ `type: 'text'`；否則維持原本的 `mapFieldType(headerEntry.key)`。`buildAdditionalProperties()` 不動（到期 key 本來就轉 `text`）。

### 4. shared — runtime 寫 `∞`

`packages/shared/logic/passFieldFormatter.ts::formatPassValues()` 的 `member_expiry | discount_expiry | coupon_expiry` 分支：

```ts
properties[spec.passcreatorKey] = formatted ?? UNLIMITED_EXPIRY_VALUE;
```

（原本是 `if (formatted !== null)` 才寫入 → 無到期日時整個欄位省略。）

pass-level 的 `result.expirationDate` **維持省略** —— 「pass 本身不設到期」與「header 到期欄位顯示 `∞`」是兩個不同語意。

### 5. backend — 400 fallback

`apps/backend/src/shared/lib/passcreator/v3-pass.ts::updatePassValues()`：

- 送出前記錄 payload 內哪些 key 的值是 sentinel
- 上游回 **400** 且 payload 內確實有 sentinel → 去掉那些 key **重試一次**，成功則 `degraded = true`
- 重試也失敗 → 拋**原本**的錯誤（那才是真正的上游拒絕原因）
- 非 400 → 原樣往上拋；payload 沒有 sentinel → 不重試

`apps/backend/src/shared/lib/passcreator/v3-pass-types.ts` 的 `PassUpdateResult` 加 `degraded?: boolean`（backend-only 型別）。

### 6. frontend — 預覽對齊 sentinel

`apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/passCardPreviewSlot.ts`：

- 折扣卡兩個到期設定都為 null 時的 fallback：`'—'` → `UNLIMITED_EXPIRY_VALUE`
- 會員 / 優惠券原本的 `'∞'` 字面量 → `UNLIMITED_EXPIRY_VALUE`

### 7. 測試補齊（本次 session）

| 檔案 | 補的內容 |
|---|---|
| `apps/frontend/.../passCardPreviewSlot.test.ts` | 既有測試「discount_card + 兩個欄位都 null → `'—'`」改為期望 `'∞'`（行為變更的必然調整） |
| `apps/frontend/.../PassCardPreviewHeader.test.tsx` | 同上：元件層的 discount `'—'` placeholder 斷言改為 `'∞'` |
| `apps/backend/src/shared/lib/passcreator/v3-pass-update.test.ts` | 新增「正常路徑 PATCH body 不變」測試：只發 1 次 PATCH、body 精確等於 `{ data: { balance, points } }`、不刪任何 key |

---

## 驗證輸出摘要

> 全部在 `C:\Users\user\Desktop\SAOME-REBUILD`（npm workspaces monorepo，Windows + PowerShell）執行。

| 指令 | Exit code | 結果 |
|---|---|---|
| `npm run typecheck`（root → frontend `tsc -b --noEmit`） | 0 | 無錯誤 |
| `npm run typecheck --workspace=apps/backend` | 0 | 無錯誤（`tsc --noEmit`） |
| `npm run typecheck --workspace=packages/shared` | 0 | 無錯誤 |
| `npm run lint`（root → frontend `oxlint`） | 0 | 0 error，僅既有 warning（`react(only-export-components)` / `exhaustive-deps` 等，皆為既有檔案） |
| `npm test --workspace=packages/shared` | 0 | **25 files / 776 tests 全部通過** |
| `npm test --workspace=apps/backend` | 0 | **50 files / 814 passed + 23 skipped（837）** |
| `npm test --workspace=apps/frontend` | 0 | **152 files / 2072 tests 全部通過** |

### 最終驗證輪次（2026-10-26 收尾 session）

程式碼完成後的收尾 session 重跑了上表全部 7 條指令，全部 exit 0、0 failed。額外單獨重跑 `apps/backend/src/shared/lib/passcreator/v3-pass-update.test.ts`：**1 file / 23 tests passed** —— 確認 todo 4 的 fallback regression test 在完整 suite 之外也獨立成立。

這一輪也重跑了 U+FFFD 掃描（見下方「編碼檢查」），確認 15 個檔案全部乾淨。

### 接手後重跑輪次（2026-10-26，v3-pass 400 fallback 驗證）

前一個 session 的 agent 在 context 溢出後中止，程式碼與測試都留在 working tree。本輪由新的 agent 接手，**只跑驗證、不改實作**，逐項結果如下：

| 驗證項 | 指令 | Exit code | 結果 |
|---|---|---|---|
| Fallback 單檔 | `npx vitest run src/shared/lib/passcreator/v3-pass-update.test.ts --root apps/backend` | 0 | 1 file / **23 tests passed** |
| Frontend typecheck | `npm run typecheck` | 0 | 無錯誤 |
| Backend typecheck | `npm run typecheck --workspace=apps/backend` | 0 | 無錯誤 |
| Shared typecheck | `npm run typecheck --workspace=packages/shared` | 0 | 無錯誤 |
| Lint | `npm run lint` | 0 | 0 error（僅既有 warning） |
| Shared tests | `npm test --workspace=packages/shared` | 0 | 25 files / **776 passed** |
| Backend tests | `npm test --workspace=apps/backend` | 0 | 50 files / **814 passed + 23 skipped（837）** |
| Frontend tests | `npm test --workspace=apps/frontend` | 0 | 152 files / **2072 passed** |
| U+FFFD 掃描 | 15 個改動檔（含 2 份新 markdown） | — | **0 命中** |

本輪另外補上的收尾（純文件，未動程式碼）：

1. `runs/improvements/INDEX.md` 加 2026-10-26 一行 pending action（Rule 011 要求 DEV LOG 寫完後的 pending 追蹤；內容含 4 條教訓 + 5 個後續 work item）。
2. plan `pass-unlimited-expiry-slot_32db6d68` 的 6 個 todo 全部標 `completed`。

程式碼仍**未 commit**（維持前一 session 的狀態）。

### 前端第一次跑是紅的（已修）

首次 `npm test --workspace=apps/frontend` 結果：`3 failed | 149 passed (152)` files、`4 failed | 2068 passed (2072)` tests。

- **2 個是我們的變更造成的**：`passCardPreviewSlot.test.ts` 與 `PassCardPreviewHeader.test.tsx` 仍期待折扣卡 fallback 是 `'—'`。這是刻意的行為變更（`'—'` → `∞`），已更新兩處斷言。
- **另外 3 個是既有 flaky**：`src/components/business/pass/PassHolderRegistration/PassHolderRegistration.giftCard.test.tsx`（2 個）與 `PassHolderRegistration.test.tsx`（1 個）。這兩個檔案**沒有引用** `resolveHeaderRightSlot` / `UNLIMITED_EXPIRY_VALUE`，且**單獨跑 5 個檔案 80 個測試全綠** → 判定為 full-suite 平行負載下的 timeout 型 flaky，與本次變更無關。修完 2 個斷言後重跑 full suite：`152 passed (152)` files、`2072 passed (2072)` tests，全綠。

### 已知既有問題（非本次造成）

`npm run lint --workspace=packages/shared` → exit 1，錯誤為 `'eslint' 不是可識別的指令`。原因是 **repo 根本沒安裝 `eslint`**（`node_modules/.bin/eslint.cmd` 不存在、`require.resolve('eslint/package.json')` 失敗）；repo 事實上的 lint 工具鏈是 frontend 的 `oxlint`（root `npm run lint` → exit 0）。`packages/shared` 的 `lint` script 是一個壞掉的既有 script，本次未觸碰該 script 或新增 eslint 相依。

### 編碼檢查

13 個被修改的檔案全數掃過 U+FFFD（`\uFFFD` replacement character）：**0 個命中**。本次新增的兩份 markdown 以 Cursor `Write` 工具寫入，未經過 PowerShell 的 `Set-Content` / here-string（Rule 039）。

---

## 已知限制

1. **已發行的卡不會自動變成 `∞`**。template 端必須由 tenant 重新推送 Step 8，runtime 才會在下一次 PATCH 送出 `∞`（計畫明確排除 retroactive 重新推送）。
2. **舊 template（仍是 `date` 型別）會撞 400** → 由 fallback 降級：其他欄位照常同步、到期欄位維持原狀、`degraded: true`。
3. **`degraded` 尚未轉成使用者可見提示**。旗標目前只停留在 `PassUpdateResult`，backend service 還沒把它轉成前端 banner 訊息。
4. **會員卡的判定偏保守**：沒有明確 `membershipExpiryMode` 時一律視為「不保證」→ 到期欄位降級成 `text`。`text` 仍能正常顯示日期字串，所以對 Wallet 顯示無影響，但 template 的欄位型別描述不再標示為「日期」。

## 後續 work item

- [ ] 把 `PassUpdateResult.degraded` 接到 backend service / frontend banner，讓「到期欄位未套用」在使用者看得到（例：同步結果列顯示部分失敗）。
- [x] 在 `runs/improvements/INDEX.md` 加 pending action（Rule 011 要求 DEV LOG 寫完後的 pending 追蹤）—— 2026-10-26 接手 session 已補。
- [ ] 需要 Passcreator API key 的手動 probe（計畫標為選做）：推一個無限期 template → 對無到期日 holder PATCH `∞` → 確認上游 200 且 read-back 回 `∞`；再對有到期日 holder PATCH 確認日期欄位不受影響。
- [ ] `packages/shared` 的 `lint` script 目前無法執行（eslint 未安裝）—— 要嘛補上 eslint devDependency，要嘛把 script 改指向 repo 實際使用的 `oxlint`。**需走 Rule 016 的 9 個 surface 同步檢查**（package.json / lockfile / CI workflow cache-dependency-path）。
- [ ] 對既有（已發行的）template 做一次型別盤點，評估是否需要主動通知 tenant 重新推送 Step 8。
