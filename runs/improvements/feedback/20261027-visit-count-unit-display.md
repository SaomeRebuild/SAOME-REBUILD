# 2026-10-27 — 拜訪次數槽位改送「數值+單位」打包字串（預覽與 Wallet 共用 formatter）

> 實作 `runs/decisions/2026-10-27-visit-count-unit-display.md` 的完整 trace。
> 本篇記錄「過程中撞到什麼、為什麼這樣改」，決策本身在 Decision Log。

## 起因

`/pass/{templateID}` 註冊後的 Wallet pass，綁了 `visitCount` 槽位時顯示的是**裸數字**——`0`、`5`、`12`。讀者看到「5」不知道這是 5 次消費、5 個點、還是 5 元。

而**編輯器預覽**顯示的卻是 `5 次` / `5 times`。也就是說預覽承諾的東西，Wallet 沒有兌現：預覽與 Wallet 是兩個獨立的來源，可以各自漂移。

折扣等級線（`runs/decisions/2026-10-27-pass-holder-spend-and-discount-tier.md`）已經把整個形狀建好了——`spendTier.ts` formatter + semanticType 降級 + 400 fallback。本次沿用同一形狀，只是換一個槽位。

## 為什麼值一定要變成字串

第一個念頭是「裸數字 `5` 也沒錯啊，單位由 label 負責」。但 label 是**欄位名稱**（「拜訪次數」），不是**值的單位**。Wallet 正面是一個 label/value 配對，讀者一眼掃過去的是 value；`5` 配「拜訪次數」其實還好——但一旦這張卡的語言是英文，label 變成 "Visit Count"、value 還是 `5`，而 preview 說的是 `5 times`，兩邊對不上。

更關鍵的是：`templates.settings.language` 是**模板層級**的屬性。一張英文模板的讀者可能根本不懂中文。`5 次` 對他們沒有任何意義——他們需要 `5 times`。所以單位**必須**跟著模板語言走，而「數值 + 語言相關單位」這件事，一個裸數字做不到。

## 三個實作陷阱

### 1. `FACE_FIELD_METRIC` 的語意是「裸 metric 讀取」

第一版想留著 `visitCount: 'visitCount'` 在 `FACE_FIELD_METRIC`，只在後面覆寫成打包字串。這跟 2026-10-27 折扣線遇到的問題**完全同型**：generic loop 先寫裸數字，專用分支再覆寫成打包字串——兩處都要維護，而且中間任何一次 refactor 都可能讓順序反轉，裸數字就會漏出去。

修法跟折扣線一致：**從 `FACE_FIELD_METRIC` 移除 `visitCount`**，讓拜訪次數分支成為唯一寫入點。

### 2. `language` 原本是 discount 分支的區域變數

`formatPassValues` 裡 `const language = input.language ?? 'zh-TW'` 原本寫在 discount 分支內。拜訪次數分支也需要它——但把同樣的 `const language = ...` 寫兩份，就是未來的 drift 點（改預設值時只改到一個分支）。

修法：**提升到函式層級**，兩個分支共用同一個值。

### 3. 事件 PATCH 路徑根本沒帶語言

`applyPassEvent` 的 `PassEventSyncTarget` 只有 `env` / `passIdentifier` / `cardType` / `boundFieldKeys`——**沒有** `language` 也沒有 `currency`。

所以事件 PATCH 落到 formatter 的 `zh-TW` 預設。一張英文卡的**初次發行**寫 `5 times`，**事件更新**卻寫 `5 次`。同一張卡的兩個請求形狀不同——而共用 formatter 的整個目的就是讓這件事不可能發生。

這跟 2026-10-27 折扣線補上 `discountTier` 是同一個道理：**PATCH 路徑必須重現發行路徑的每一個輸入**，否則同一個 formatter 會算出不同的結果。

修法：`PassEventSyncTarget` 加 `language` / `currency`，`applyPassEvent` 轉傳。

## 順帶修掉的一個命名失真

`DISCOUNT_TYPE_DOWNGRADED_FIELDS` 這個名字在加入 `visitCount` 之後會**主動誤導**——它說「discount」，但 `visitCount` 是 common 欄位，每種卡種都會綁。

改名為 **`TYPE_DOWNGRADED_TEXT_FIELDS`**，描述這個集合**是什麼**：值是 text payload、而舊的 `number` 模板會拒絕它。

這是 Rule 011 說的「程式碼與文件要同步」——名字本身是文件。

## 影響面比折扣槽位大

折扣槽位只影響 `discount_card`。`visitCount` 是 **common 欄位**，所有綁了它的模板都算——所以「舊模板要重推 Step 8」這件事的影響面比折扣線大得多。

既有模板在重推 Step 8 前：拜訪次數槽位走 400 fallback 被丟棄（degraded），**其餘槽位照常同步**。這是 `TYPE_DOWNGRADED_TEXT_FIELDS` 這組 fallback 存在的理由——沒有它的話，一個舊模板的 400 會把整包 payload 帶下去，連餘額 / 點數都一起停擺。

不做 bulk PATCH 補發：重推模板必須人工受控（上游模板在 Passcreator 那一側，本 repo 改不到）。

## 驗證

```
npm run typecheck --workspace=packages/shared   → exit 0
npm run typecheck --workspace=apps/backend      → exit 0
npm run typecheck --workspace=apps/frontend     → exit 0
npm test --workspace=packages/shared            → 854 passed (33 files)
npm test --workspace=apps/backend               → 815 passed / 23 skipped (50 files)
npm test --workspace=apps/frontend              → 2075 passed (153 files)
npm run check:migrations --workspace=apps/backend → OK: 28 migrations
npm run check:oneoff                             → OK
npm run verify:i18n --workspace=apps/frontend    → OK: 21 namespaces (42 locale files)
npm run lint --workspace=apps/frontend          → exit 0 (pre-existing warnings only)
```

新增/更新的測試：

- `packages/shared/logic/visitCount.test.ts` — 6 條：zh-TW / en / 0 / 多位數 / 非有限值 / 負數
- `packages/shared/logic/passFieldFormatter.test.ts` — 拜訪次數改為字串、`FACE_FIELD_METRIC` key 集合由 3 降為 2、語言跟隨模板、預設 zh-TW、**每一種卡種**都送得出來
- `packages/shared/constants/card-fields.test.ts` — semanticType 分布 text 8→9 / number 12→11、拜訪次數是 text、降級集合涵蓋所有帶單位的槽位
- `apps/backend/.../register.runtimeValues.test.ts` — 4 條：初次發行帶 `0 次` / `0 times` / 非零值 / 未綁定則不送
- `apps/backend/.../passValueService.test.ts` — 事件 PATCH 期望值改字串 + 模板語言 case
- `apps/backend/.../v3-pass-update.test.ts` — 400 fallback 涵蓋 `visitCount`
- `apps/backend/.../passTemplateMapping.test.ts` — 3 條：模板推送把拜訪次數宣告為 `text`（slot + additionalProperty）+ **每個 CARD_FIELDS key 都以它宣告的 semanticType 推送**（data-driven drift guard）
- `apps/frontend/.../PassCardPreviewBody.test.tsx` — ZAR 污染回歸測試改為斷言 formatter 輸出 + 補 en 語系 case

### 補上的一條先前漏掉的防線

`passTemplateMapping.ts` 的 docblock 宣稱「New 'v12 data-driven' describe block iterates every CARD_FIELDS key」，但那個測試檔其實**只 import 了 `CARD_FIELDS` 而完全沒用**（順帶產生一個 unused-import lint warning）。也就是說：**模板推送端「用 CARD_FIELDS 宣告的型別」這件事從來沒有被任何測試釘住**。

這次把整條鏈路的末端補上了：一條 data-driven 測試 iterate 每個 `CARD_FIELDS` entry、斷言推送出去的 `secondaryFields[].type` 等於它宣告的 `semanticType`。它同時涵蓋三件事：

1. `visitCount` 必須是 `text`（本次降級的目標）
2. 未來新增欄位時，自動被這條測試覆蓋
3. 誰把 `mapFieldType` 改回 hard-coded switch，測試會立刻紅

## 自問

1. **這個「數值+單位」的形狀會不會再出現第三次？** 會——`availableRewards`（「2 次」）/ `stampsRemaining` / `currentPoints`（「23點」）/ `couponRemainingCount` 都還沒處理。目前各自另案處理是對的（語意不同：有些是 runtime metric、有些是模板衍生值、有些根本沒有 runtime 來源），但如果第三次再撞到同一個形狀，就該把「單位 formatter」抽成一個更通用的模組，而不是再複製一個 leaf module。
2. **`TYPE_DOWNGRADED_TEXT_FIELDS` 會不會漏？** 目前測試 pin 住「所有帶單位的槽位都在集合裡」。但未來新增一個帶單位的槽位時，誰來提醒我加進去？——測試只 pin 住「已知的幾個」，不是「所有帶單位的」。這是**已知的 drift 風險**，留待下一次出現同型槽位時再處理（到時候可能會改成從 `CARD_FIELDS` 推導）。
3. **事件 PATCH 路徑的 `currency` 也是同樣漏的嗎？** 是——`currency` 同樣不在 `PassEventSyncTarget` 裡，本次一併補上了。但 `discountTier` 仍然缺（留待 Scanner 計畫，因為它需要 tier ladder + spend 解析）。
4. **`passTemplateMapping.ts` 的 docblock 宣稱有 data-driven 測試，但實際上沒有。** 這次補上了（iterate 每個 `CARD_FIELDS` entry）。但 docblock 描述與實作不符這件事本身是個訊號：**docblock 提到「測試涵蓋什麼」時，應該偶爾實查一次**。這不是本次的重點（下次有人改那個檔案時會看到），但它說明 docblock 裡的「已測」敘述會過期。
