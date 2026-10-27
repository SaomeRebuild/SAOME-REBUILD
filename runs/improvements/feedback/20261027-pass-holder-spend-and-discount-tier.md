# 折扣卡 Wallet 槽位恆空 — 四層缺陷疊加，以及 MCP 全域失效時的遷移備援

> 日期：2026-10-27 ｜ 分類：pass runtime value / 第三方契約 / 工作方法
> 相關 Decision：`runs/decisions/2026-10-27-pass-holder-spend-and-discount-tier.md`

## 摘要

折扣卡在 Wallet 上的四個顯示槽位（折扣等級 / 折扣級距 / 到下一級還差 / 累積消費）**永遠是空的**。實查發現是**四個獨立缺陷疊加**，缺一不可：

1. `templates.settings.discountTiers[]` 全 repo **沒有任何一行程式碼讀取它** → 等級從未被解析。
2. 累積消費只存在 `pass_values_snapshot` 的 JSONB 裡 → 沒有可查詢的欄位。
3. `FACE_FIELD_METRIC` 只映射 4 個數值 metric → `memberLevel` / `discountTierBracket` / `pointsToNextTierDiscount` **不在表內 = 從未送出**。
4. 三個折扣槽位宣告 `semanticType: 'number'` → 送「數值+單位」字串會被上游拒絕。

## 根因一：「不在 metric map 裡」的真實語意是「永遠不送」，不是「沒值」

`packages/shared/logic/passFieldFormatter.ts` 的 `FACE_FIELD_METRIC` 註解寫著「Tier-derived values（`pointsToNextTier`, `discountTierBracket`, `couponRemainingCount`）— they need the template's tier configuration, not just the holder's snapshot. They are a template-mapping concern.」

讀起來像「這些欄位是**別人**的責任」。實際上它們是**永遠不會被送出**——Wallet 上恆空，而且沒有任何錯誤、沒有 log、沒有失敗訊號。`memberLevel` 更是連續三個卡種（membership / stamp / reward / cashback / multipass / discount）都受影響。

**教訓**：一個「有名字但永遠不送」的欄位，觀察者只會看到「空白」，不會想到去查那個 map。要嘛在 map 旁邊列出「這些 key 尚未實作，誰負責」，要嘛在 formatter 輸出時對「已宣告但未實作」的 key 打一次 warning。

## 根因二：欄位型別是「runtime 決定模板」的反向約束

三個折扣槽位原本是 `semanticType: 'number'`。但它們的值必須是帶單位的字串（`10元` / `NT$ 10` / `R10` / `2%`）——因為**單位位置跟著模板的語言走**（en 用 `NT$` 前綴、zh-TW 用 `元` 後綴），裸數字承載不了單位。

而 `mapFieldType()` 是從 `semanticType` 推 Passcreator `type` 的 → 模板被推成 `type: 'number'` → Passcreator 會**用模板宣告的型別驗證 per-pass 值** → 字串被拒 → **整包 400**，連同一個 payload 裡的餘額 / 點數都一起停擺。

這不是推測：repo 在 2026-10-26 的 `∞` sentinel 決策已經記錄了完全同型的事故（`date` 型拒絕非日期字串 → 整包 400 → 用 `degraded` fallback 才救回其他欄位）。**同一個坑，隔一天換個欄位再踩一次**。

**教訓**：「runtime 要送什麼值」必須**回頭決定**「模板端宣告什麼型別」。這是雙向約束，單看任一側都看不出問題。

## 根因三：CREATE 路徑比 PATCH 更需要 fallback

`∞` sentinel 的 fallback 只做在 PATCH（`updatePassValues`）。但折扣槽位的字串同樣會讓 **CREATE** 整包 400 —— 而 CREATE 失敗的後果是**持卡人連卡都沒有**，比 PATCH 少幾個欄位嚴重得多。

所以本次在 `issuePass` 也補了同一套 drop-and-retry：上游 400 → 去掉那幾個 key 重試一次 → 卡照樣發出來（到期日 / 餘額完整），只是折扣槽位留空。

**教訓**：同一個「上游會拒絕某種值」的風險，**每個送出該值的路徑都要有降級方案**。PATCH 的降級語意（省略 = 保留舊值）跟 CREATE 的降級語意（省略 = 該槽位留空）不同，實作時要分開想，不能只做一個就以為涵蓋了。

## 工作方法教訓一：MCP dispatch 全域失效時，repo 已經備好正確的路徑

Rule 037 說明 `CallMcpTool` 對 pre-listed 工具會回 "MCP descriptor not found"。本次的實況是**更嚴重**：

- 直接工具名（`user-saome-supabase-execute_sql`）在 session 前半段可用，後半段回「not available in this version」；
- `CallMcpTool` 對**每一個** server 都回 descriptor not found（連 pre-listed 的 `cloudflare-bindings/workers_list` 也是）→ **session 層級的 dispatch 失效，不是 Supabase 特有**；
- `GetMcpTools` 卻完全正常（能列出 descriptor、server 狀態 connected）。

解法是 repo 早就寫在 `apps/backend/scripts/pass-runtime-values-backfill-worker.ts` docblock 裡的**先例**：DB 密碼只存在 Cloudflare 端 Hyperdrive 設定裡，本機 psql / postgres.js 連不上；**Worker 可以**。用一次性 `wrangler dev --remote` + Hyperdrive binding 就能對 production DB 執行 DDL。migration 028 就是這樣 apply 的（registry 記 `via: "wrangler-hyperdrive-worker"`）。

**關鍵**：那支一次性 Worker 腳本要放 **OS temp 目錄**、用完即刪（Rule 040 § 決策樹第 3 條），不進版本庫。

**教訓**：MCP 全域失效時不要空轉重試。**先查 repo 裡有沒有前人走過同一條路**（migration 028 的 registry entry 就是索引）。

## 工作方法教訓二：Hyperdrive 的查詢快取會讓「剛剛做過的事」看起來沒發生

用上面的 Worker 路徑 apply 完 DDL 後，驗證查詢回報**欄位不存在**。

真相是 **Hyperdrive 對重複的查詢字串做了快取**：同一段 `information_schema` SQL 第二次跑，回的是**快取裡的舊結果**。加上每次請求帶一個唯一 nonce（`/* probe <timestamp> <random> */`）之後，欄位立刻出現。

**教訓**：對**有快取層**的資料庫做「剛寫完就讀回」的驗證時，查詢字串必須唯一，否則你會在「其實成功了」和「其實沒成功」之間挑一個自己信的。這一次如果沒有驗證步驟，就會誤以為 migration 失敗，然後去改一個已經生效的 schema。

## 工作方法教訓三：`git stash` 在共享工作樹上是危險操作

為了確認前端測試失敗是不是自己造成的，我用了 `git stash push --include-untracked` 跑 baseline。**這個工作樹裡同時有另一個 session 的未完成工作**（會員級距 snapshot 功能：改動 `shared/schemas/passHolder.ts` / `shared/types/passHolder.ts` / backend `registerService.ts` / `request.ts` + 新檔 `shared/logic/membershipTier.ts`）。`--include-untracked` 把**別人的工作也一起掃進去了**。

`git stash pop` 還**部分失敗**了（untracked 檔案衝突），工作樹變成半還原狀態。復原的正確做法：

- `git checkout "stash@{0}" -- .` 取回 tracked 檔案（+ `git reset` 取消 staging）；
- untracked 檔案用 `git checkout "stash@{0}^3" -- <path>` 或直接從 stash 的第三個 parent 取出；
- **驗證用 `git diff "stash@{0}" -- <paths>` 比「內容」，不要比 blob hash** —— repo 設了 `core.autocrlf=input`，working tree 是 CRLF、stash object 是 LF，hash 必然不同但內容完全相同（這次 5 個檔案 hash DIFFER 但 diff 為空）。

**教訓**：共享工作樹裡做 baseline 比對，**不要用 `git stash`**。正確做法是把「自己改的檔案」逐一 `git checkout HEAD --` 暫時還原（記得清單），跑完再還原；或用獨立 worktree。`stash --include-untracked` 會把不屬於你的工作一起收走，而 pop 的衝突復原成本遠高於逐檔還原。

## 工作方法教訓四：平行負載下的測試失敗是 flake，不是 regression

前端 153 個 test 檔平行跑時，`LoginForm` / `RegisterForm` / `PassHolderRegistration` / `Step3CardFields` 失敗 10 條；同樣的組合**單獨跑全綠**。其中 `PassHolderRegistration.giftCard.test.tsx` 自己的註解就寫著它用 real timers + 6 秒 `waitFor` 容差。

基線（stash 掉全部改動）跑同一組合是綠的 → 一度以為是自己造成的。實際上是**背景還有其他 test job 在跑**，把機器壓滿了。

判定流程（這次走完一輪才確認）：

1. 單檔跑 → 綠 → 排除邏輯錯誤。
2. 同一組合重跑（沒有背景 job）→ 綠 → 確認是負載 flake。
3. 用 `git diff` 確認工作樹完整（stash 事故後必須先做這一步）。

**教訓**：前端這類 real-timer 測試在負載下會 flake。**判定「是不是我造成的」之前，先確認沒有其他 test job 在背景跑**；而且 baseline 比對要在**乾淨的機器狀態**下做，否則 baseline 自己也會 flake，得出「baseline 綠 = 我的改動造成」的反向錯誤結論。

## 6 條 future invariants

1. **「已宣告但未實作」的欄位要能被看見** —— `FACE_FIELD_METRIC` 缺席的 key 永遠不送；新增卡種槽位時必須同時決定「誰產生這個值」，否則 Wallet 恆空且沒有任何錯誤訊號。
2. **runtime 要送的值決定模板端宣告的型別** —— 送字串的槽位 `semanticType` 必是 `'text'`；型別改動是**模板端**的變更（要重推），不是純 runtime 變更。
3. **每個送出該值的路徑都要有降級方案** —— PATCH 省略 = 保留舊值；CREATE 省略 = 槽位留空。兩種語意都要實作。
4. **有快取層的資料庫，讀回驗證的查詢必須唯一** —— 否則會把成功誤判成失敗。
5. **MCP 全域失效時走 repo 既有先例** —— 一次性 `wrangler dev --remote` + Hyperdrive binding，腳本放 OS temp 目錄、用完即刪。
6. **共享工作樹裡不做 `git stash`** —— baseline 比對逐檔 `git checkout HEAD --`，並用 `git diff`（不是 blob hash）驗證還原完整性。

## Out of scope

- Scanner 消費事件後重算等級（`runs/plans/2026-10-24-pass-scanner-event-semantics.md` 仍 blocked）。
- 現金回饋卡等級（`cashbackTiers` 形狀相同、resolver 可共用，語意與 label 不同，另案）。
- 既有模板自動重推（上游模板變更必須 tenant 觸發，與 `∞` 決定一致）。
