# 完整範例：8 個動詞的處理流程

每個範例包含：input、識別動詞、AskQuestion 確認、委派動作。

## 範例 1: `add` — 「幫我加個 FAQ accordion 到 homepage」

### ❌ 錯誤處理（不要這樣）

```
Agent: 好的，我來幫你加 FAQ accordion。
       1. 內容來源是？ 2. 項目數？ 3. 預設展開狀態？ 4. 位置？
       5. 視覺風格？ 6. 主題？
[不問了直接動工 → 違規]
```

### ✅ 正確處理

```
Agent: 我識別到你的意圖是「add」 FAQ accordion。

這個改動我需要先問 1 個問題：

Q1: 你的「加 FAQ」是指？
   A. 新 feature（建立 specs/spec/homepage-faq/spec.md）
   B. Amend 既有 homepage（修 specs/spec/homepage/spec.md §4.3 加 FAQ section）
   C. 其他（請說明）

如果選 A：我會走完整 9 階段 spec-kit 流程
如果選 B：我會用 amend 模式更新既有 spec
```

User 回答 A（或 B）後：

```
Agent: 收到，走 [A/B] 路線。我會：

1. 建立 specs/spec/homepage-faq/（或 amend homepage/spec.md）
2. 跑 speckit-specify 產 spec.md
3. 跑 speckit-clarify 補完細節
4. 跑 speckit-plan 產 plan.md
5. 跑 speckit-tasks 拆解任務
6. 跑 speckit-implement 搭配 TDD 實作

⚠️ 提醒：FAQ 是前端 UI 元件，需先跑 ui-ux-pro-max 評估樣式。
⚠️ 提醒：i18n 雙語（zh-TW + en）必備。

要繼續嗎？
```

## 範例 2: `remove` — 「把 SocialProof 那個 section 拿掉」

### ❌ 錯誤處理

```
Agent: 好的，deprecate SocialProof（保留程式碼但標廢棄）。
[預設 deprecate → 🔴 失敗：未先問]
```

### ✅ 正確處理

```
Agent: 我識別到你的意圖是「remove」 SocialProof section。

我有 2 個問題：

Q1: 「拿掉」是指？
   A. 刪除（從畫面、程式碼、spec、test、BDD、i18n 全清）
   B. 隱藏（display: none 或 feature flag，可隨時復活）
   C. Deprecate（保留程式碼但標廢棄，未來移除）

Q2: 改動影響範圍？
   A. 只前端（homepage）
   B. 跨後端（不可能，SocialProof 是純前端）
   C. 跨 DB（不可能）
```

User 回答 A + A 後：

```
Agent: 收到，刪除 SocialProof 全清。

這個改動我會用 amend 模式處理：

1. 跑 brainstorming 確認刪除影響面（已 grep 過：5 個 i18n key × 2 locale、3 個 vitest 檔、1 個 Gherkin scenario）
2. 跑 speckit-specify amend homepage/spec.md
   - §2.1 In Scope 移除 SocialProof
   - §4.3.2 移除 SocialProof section
   - §7.2 移除對應驗收
   - §2.3 差異表不變（這次是「符合規格」的修改）
3. 跑 speckit-tasks 更新 tasks.md §3.2 標 [x] cancelled
4. 跑 speckit-implement 執行程式碼變更
5. 跑 verification-before-completion（tsc + 84→80 vitest + build）

⚠️ 提醒：spec-kit 0.14.3 沒有現成 amend CLI，需手動改 spec.md + 加 `<!-- Amended ... -->` 標記。

要繼續嗎？
```

## 範例 3: `exclude` — 「排除 RWD 測試」

```
Agent: 我識別到你的意圖是「exclude」 RWD 測試。

Q1: 「排除」是指？
   A. Scope 排除（這個 feature 不做 RWD 測試）
   B. Implementation 排除（不寫 RWD test code，但 spec 仍列出）

⚠️ 兩者差別：A 會讓 spec 把 RWD 列入 Out of Scope；B 會留 spec 但不實作。
```

User 回答 A 後：

```
Agent: 收到，scope 排除 RWD 測試。

1. 跑 speckit-specify amend homepage/spec.md §2.2 Out of Scope 加 RWD 測試
2. 跑 speckit-tasks 更新 tasks.md 移除 RWD 測試相關任務
3. 跑 speckit-analyze 確認 spec/plan/tasks 一致

要繼續嗎？
```

## 範例 4: `implement` — 「實作登入功能」

### ❌ 錯誤處理

```
Agent: 好的，實作登入。我問 12 題：
1. 登入方式？ 2. 角色分流？ 3. passwordless？ 4. session 儲存？
5. multi-tenant 登入？ 6. 錯誤訊息？ 7. rate limit？ 8. audit log？
9. PII 處理？ 10. 忘記密碼？ 11. RWD？ 12. Scanner Panel？

[一次 12 題 → 🟡 違反 brainstorming L:72]
```

### ✅ 正確處理

```
Agent: 我識別到你的意圖是「implement」 登入功能。

這個改動我需要先問 1 個關鍵問題：

Q1: 登入方式是？
   A. Email + Password
   B. Email Magic Link
   C. OAuth（Google / Apple / Line）
   D. Phone OTP
   E. 全部都要（這會讓 spec 變很大，建議拆 spec）

⚠️ 提醒：SAOME 是多租戶 SaaS，登入可能涉及：
- 店家員工登入後台（company_token）
- 平台管理者登入（admin_token）
- 消費者登入拿 Pass（consumer_token）
三種角色 + token kind 不同，需在 spec 內說明。

⚠️ 提醒：backend skeleton 還沒建（DEV 紀錄顯示），可能要先開 backend-skeleton spec 才能走 implement。

要繼續嗎？
```

## 範例 5: `amend` — 「改一下 Hero 標題顏色」

```
Agent: 我識別到你的意圖是「amend」 Hero 標題顏色。

Q1: 「改顏色」是指？
   A. 改 design token（走 ui-ux-pro-max 評估）
   B. 改 inline style（不建議，違反 000-dynamic-config.mdc）
   C. 換顏色變數名稱（重構）

⚠️ 提醒：依 000-dynamic-config.mdc，顏色必須走 CSS 變數，不可 hardcode。
```

## 範例 6: `refactor` — 「重構 Header 元件」

```
Agent: 我識別到你的意圖是「refactor」 Header 元件。

Q1: 「重構」是指？
   A. 拆檔案（依 000-modular-design.mdc 拆分）
   B. 抽出 hooks（依 022-component-reuse）
   C. 改進效能（依 web-perf）
   D. 改進型別（型別強化）

⚠️ 提醒：refactor 必須先有測試保證（test-driven-development）。
⚠️ 提醒：refactor 完成後必跑 verification-before-completion。
```

## 範例 7: `migrate` — 「把 mu-plugins 的會員邏輯搬過來」

```
Agent: 我識別到你的意圖是「migrate」 會員邏輯從 mu-plugins。

這個改動我會走 `.cursor/workflows/migrate-from-wp.md`：

1. 確認 mu-plugins 對應 Engine（SAOME-Member-Engine）
2. 讀舊 PHP 邏輯（只讀 if-then 規則，不讀程式碼）
3. 確認 column 業務語意（不照搬 schema）
4. 跑 brainstorming 設計新 spec
5. 跑 speckit-specify 產新 spec（spec §8 標「來源：SAOME-Member-Engine」）
6. 跑 speckit-implement TDD 重寫

⚠️ 提醒：依 005-reference-mu-plugins.mdc，不可直接複製 PHP 程式碼、UI 風格、CSS class。

⚠️ 提醒：SAOME-Member-Engine 內的 file 路徑請提供，否則我會先用 Grep 找。

要繼續嗎？
```

## 範例 8: `deprecate` — 「deprecate 舊版 API」

```
Agent: 我識別到你的意圖是「deprecate」 舊版 API。

Q1: 「deprecate」是指？
   A. 標 JSDoc @deprecated（保留程式碼）
   B. 加 HTTP Deprecation header（依 RFC 8594）
   C. 移除前端使用但保留後端
   D. 全部三項

⚠️ 提醒：deprecate 不刪程式碼，只標記日後移除。
⚠️ 提醒：spec 段落標「Deprecated」而非刪除（依 011-dev.mdc 精神）。
```

## 範例 9: User 預填詳細需求 — 「加 FAQ，內容來源從 marketing 抄，5 題，預設全部收合」

### ✅ 正確處理

```
Agent: 我識別到你的意圖是「add」 FAQ accordion，並預填了 5 個細節。

Q1: 你的「加 FAQ」是指？
   A. 新 feature（建立 specs/spec/homepage-faq/spec.md）
   B. Amend 既有 homepage（修 specs/spec/homepage/spec.md §4.3 加 FAQ section）

⚠️ 已預填的細節（不再重問）：
- 內容來源：marketing 抄
- 題數：5 題
- 預設展開：全部收合

如果選 A：我會用 5 題建立新 spec
如果選 B：我會用 5 題 amend 既有 spec

要繼續嗎？
```

**不要重問已預填的細節**（違反 progression disclosure + 浪費 user 時間）。

## 範例 10: Debug 類短請求 — 「加個 console.log 確認 foo 變數值」

### ❌ 不要用本 skill

```
Agent: 我識別到你的意圖是「add」 console.log ...
[錯誤：這是 debug，不是 8 動詞之一]
```

### ✅ 正確處理

```
Agent: 這是 debug 類短請求，請改走 `systematic-debugging` skill。
- 不在本 skill 職責
- 詳見 systematic-debugging/SKILL.md
```

## 通用失敗模式對照

| 場景 | 錯誤做法 | 正確做法 |
|---|---|---|
| User 說「加個 XX」 | 直接開新檔、改程式 | AskQuestion 確認是 add 還是 amend |
| User 說「拿掉 XX」 | 預設為 deprecate | AskQuestion 三選一 |
| User 說「實作 XX」 | 一次 12 題 AskQuestion | 1 題關鍵決策，細節走 brainstorming |
| User 說「改 XX」 | 預設為 refactor | 識別動詞，若是 amend 走 spec-kit |
| User 說「deprecate XX」 | 走 remove 流程 | 走 deprecate 流程（保留程式碼） |
| User 訊息含多個動詞 | 全部一起處理 | 拆成多個 intent 依序處理 |
| User 訊息不明確 | 預設一個動詞 | AskQuestion 釐清 |
