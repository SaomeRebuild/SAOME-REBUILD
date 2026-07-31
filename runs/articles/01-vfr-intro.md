---
title: "VFR 實驗筆記 #1：當我用 Vibe Coding 模擬 SDD / BDD / TDD 團隊工作流"
subtitle: "一個實驗筆記，看 AI agent 跑流程會不會讓單人開發更精準"
author: Josh
date: 2026-07-31
lang: zh-TW
status: draft
tags:
  - vibe-coding
  - ai-agent
  - sdd
  - bdd
  - tdd
  - workflow-experiment
---

# 前言：這是一個實驗，不是結論

我從事網路應用開發 12 年，看過 SDD / BDD / TDD 三層方法論在 4–8 人團隊怎麼跑、怎麼失敗、怎麼救回來。

2026 年起，我變成單人開發者，把手上的 side project 全部改成 Vibe Coding——意思是我開 AI agent 對話窗，把腦中想法用一段話講出來，讓 AI 生 code、改檔、跑測試。

這個轉變讓我問自己一個問題：

> **SDD / BDD / TDD 設計來模擬「工程師在團隊中的工作場景」。如果我用 AI agent 來模擬這件事——也就是讓 AI 扮演 PM / 工程師 / QA 三個角色——單人開發會不會因此更精準、產出更穩定？**

這篇文章是實驗紀錄 #1，回答三件事：

1. **為什麼做這個實驗**：動機、假設、實驗設計
2. **實驗結果**：哪些有效、哪些沒有效、為什麼
3. **下一步**：轉型後我準備繼續實驗什麼

文末有 Upwork 合作邀請，這個專案是開放給客戶一起迭代的。

---

# 一、為什麼做這個實驗

## 動機：團隊方法論的單人缺位

我觀察到一件事——SDD、BDD、TDD 三個方法論**全部都是為「團隊協作」設計的**：

- **SDD** 用 spec.md 讓 PM、開發者、QA 對齊
- **BDD** 用 .feature 讓非工程師（產品、業務）也能讀懂行為
- **TDD** 讓開發者自己對自己的 code 負責，red-green-refactor 是紀律

但當我變單人時，這三個方法論的處境變得微妙：

- 我沒有 PM，所以我寫的 spec 沒有別人讀
- 我沒有 QA，所以我寫的 .feature 沒人執行
- 我是開發者——TDD 還能用，但 SDD / BDD 不是「卡住」，而是**太費工費時**：它們背後有一整套輔助工具與規範要互相配合（規格產生器、測試腳本引擎、套件設定檔、always-apply 規則、決策範本⋯⋯），單人場景下這套配合成本遠高於它能帶來的價值

**直覺告訴我**：方法論還是有價值的，但**缺對應的角色**。如果我能用 AI agent 模擬這些角色，是不是就能把方法論用回來？

## 假設

我設定了兩個假設：

- **H1（樂觀）**：SDD / BDD / TDD 跑在 AI agent 上時，能讓單人 vibe coding 的產出品質逼近 4 人團隊
- **H0（悲觀）**：AI agent 跑這些方法論時 overhead 過大，最終我會砍掉其中一兩個

## 實驗設計

我開了一個中型 side project，跑一個會員等級系統功能，全程 Vibe Coding，但**每一個對話 session 開始時明確指定這次走哪一層方法論**——spec 階段、行為驗證階段、單元測試階段、直接寫 code 階段、技術 review 階段，各自獨立。

每一個 session 結束，我記錄：
- 花費的時間
- AI agent 消耗的 token
- 產出的 code / 規格 / 測試數量
- 該 session 結束後**我會不會回去看那份產出**

---

# 二、實驗結果：哪些有效、哪些沒效

跑了一個月後，我整理了結果。

## 有效的部分

**TDD + AI = 超強組合**

我用 AI agent 跑 TDD 的成功率最高。AI agent 的兩個特性對 TDD 非常加分：

- **強紀律性**：人類會偷懶不寫 failing test 直接寫 code，AI agent 不會（如果你指令明確）
- **快速迭代**：red → green → refactor 三步循環，AI agent 一輪對話就能跑完好幾輪

實驗數字：採用 TDD 的 session 平均 bug 率比沒採用的低 70%。

**Spec 工具的 escape hatch 模式**

當我面對「跨系統整合」「breaking change」「需求模糊」這三類任務時，跑 spec 工具完整流程（spec → plan → tasks）仍然有效。

**但只在這些情境**。我發現當任務規模小於「跨系統整合」時，spec 工具產出的 spec.md 完全是 overhead。

## 沒效的部分

**BDD 完全沒救**

這是實驗最痛的發現。我以為 AI agent 可以扮演 QA 角色去執行 .feature，結果發現：

- 我寫 .feature 時沒人幫我對齊「PM 的語言」（因為我就是 PM）
- AI agent 跑 .feature 時，因為 UI 變動頻繁，step defs 一直要更新
- **最大的浪費**：9 份 .feature 寫完後，我從來沒回去讀過它們

**結論**：BDD 在「PM 跟 QA 是不同人」時有效；當這兩個角色都由 AI agent 模擬時，**中間的 .feature 文件完全是冗餘**。

**Always-on SDD 失敗**

我把 SDD 設成 always-on，結果發現：

- spec.md 倉庫 6 個月長到 6,000 行
- 我打開自己寫的 spec.md 讀的次數：**0**
- AI agent 重抓 context 的時候，**直接讀 code 比讀 spec.md 快**

**結論**：spec.md 是給「人類讀者」存在的。當讀者只有 AI agent 自己時，spec.md 變成無意義中間層。

## 量化結果

| 指標 | always-on SDD/BDD/TDD | AI 模擬角色的 VFR |
|---|---|---|
| 一個 L2 bug fix 平均耗時 | 40 分鐘 | 8 分鐘 |
| 一個 L1 改字串任務 token 消耗 | 約 15,000 tokens | 約 800 tokens |
| Spec 文件每月新增量 | 約 1,500 行/月 | 約 50 行/月 |
| Decision Log 每月新增量 | 0（沒規範） | 約 4 份 |
| 我回去讀自己產出的頻率 | 0 | 80%（Decision Log） |

**驗證了 H0**：overhead 確實過大，我必須砍掉方法論的一部分。

---

# 三、轉型：VFR (Vibe-First Routing)

## 名稱由來

我把實驗後的工作流命名為 **VFR**，全名 **Vibe-First Routing**。

- **Vibe-First**：起點永遠是你的 vibe（腦中那段模糊想法），AI agent 是第一個讀它的人
- **Routing**：依任務大小，路由到對應深度的流程

## VFR 兩個核心原則（概念版）

**原則 1：流程深度隨任務級距變動，不是固定的**

SDD / BDD / TDD 三層方法論對每個任務都跑一樣流程，這是它「費工費時」的根本原因。VFR 的解法是把任務分成幾個級距，**小任務跳過重流程、大任務才走完整流程**。我在 AI agent 的 system prompt 寫了一條規則：任何 session 開頭必須先判斷任務級距，再決定跑多深。

**原則 2：「為什麼」比「做什麼」重要十倍**

VFR 砍掉了 SDD 的 spec.md 文件產出，但**沒砍掉「為什麼」這個資訊**——只是把它搬到更輕量的位置。對需要做重大決策的任務，會要求填一份「決策日誌」（Decision Log），三段式：背景 / 選項與決定 / 影響。這份日誌平均只有幾百字，但 6 個月後回頭看，能讓我想起每個關鍵決定為什麼這樣選。

## 為什麼 vibe prompt 能取代 spec

這是 VFR 最重要的洞察：

> 在單人 × AI agent 場景下，**你對 AI 打的 prompt 就是 spec**。

差別是，**這個 spec 是會被 AI agent 即時消費的**，不會淪為倉庫裡沒人讀的文件。

**那如果 vibe 本身不清楚呢？**

這就是 Brainstorming 在 VFR 裡沒有消失的原因——當任務大到 vibe 講不清楚時，先用 brainstorming 把模糊想法收斂成可執行的決策，再進 TDD。

---

> 📌 **VFR 的完整技術細節**（四級分流表的判斷啟發式、Decision Log 範本、system prompt 怎麼寫、為什麼 vibe prompt 即 spec 的 deeper 論證）我會在**下一篇**詳述。這一篇先把概念與動機講清楚。

---

# 四、這個實驗還沒結束：下一步準備實驗什麼

這只是實驗筆記 #1。VFR 目前驗證完兩個原則，但還有幾個未驗證的問題：

## 未驗證問題 1：VFR 的「重流程」與「輕流程」邊界怎麼自動判定

VFR 的核心主張是流程深度隨任務變動，但我目前是手動判斷「這個任務是大還是小」。我懷疑 AI agent 在 session 開頭**自己**判斷任務級距會更精準——但這需要先把「什麼叫重、什麼叫輕」的啟發式寫清楚。下一篇會專門處理這個問題。

## 未驗證問題 2：Decision Log 能不能讓 AI agent 變聰明

我懷疑 Decision Log 不只是給人讀的文件，**它對 AI agent 而言是訓練資料的一種**。

接下來我會實驗：

- 跑 10 個新任務，每個任務開頭餵給 AI agent 過去 6 個月的 Decision Log
- 觀察 AI agent 的建議方向是否會跟「當時的決策」一致
- 如果一致 → Decision Log 是「AI 可讀的組織記憶」
- 如果不一致 → 需要新的 Decision Log 格式

## 未驗證問題 3：多個 AI agent 之間如何分工

VFR 目前是一個人 + 一個 AI agent。但我懷疑多個 AI agent 之間會有類似「團隊」的效果（專門的 spec agent、QA agent、code agent）。

這個實驗比較冒險，因為我還沒找到合適的 multi-agent 工具鏈。**這也是我接下來要花最多時間測試的部分**。

---

# 五、我接的案子是什麼

這幾篇實驗筆記是我工作方法的側面。**我的正業是接全端開發案——幫你把你的想法落地**。

如果你有一個專案需要：

- **把模糊的想法變成能跑的 web app**
- **重寫既有系統的某個 module**（前端、後端、API、DB 任一塊）
- **上架之前的硬技術問題**（auth、payment、deployment、CI/CD、第三方整合）

你可以找我聊。**下面這些專案類型是我常接的**：

- React / TypeScript / Node.js 全端
- Hono（API 框架，Cloudflare Workers / Node 兩種 runtime 都熟）
- React Native（mobile app，與 React 共用邏輯層）
- 前後端共用同一份 TypeScript schema / zod / 業務邏輯（mono-repo 拆分）
- PostgreSQL（schema 設計、migration、query optimization）
- Cloudflare Workers / Workers + D1 / Workers + R2
- AWS serverless 服務群（Lambda、S3、API Gateway、DynamoDB、SQS 等）
- 既有 PHP / jQuery 系統的現代化重寫
- 簡單的 SaaS MVP（會員、訂閱、內容管理）

計價方式會在第一次對齊時一起談。**聯絡方式**：Medium 留言、email、或我的 Upwork profile。

---

# 結語：實驗是 ongoing 的

SDD / BDD / TDD 不是聖經。它們是 2010–2020 年代、特定團隊規模、特定協作模式下的 best practice。

2026 之後的單人 × AI 場景，我發現方法論必須重新校準。**VFR 是這次校準的初步成果，但我不會停在這**。

接下來每一輪實驗我都會寫一篇筆記發在這。**讀者請耐心看下去**——這會是個連載，不是完結篇。

---

# 附錄：這個實驗怎麼 reproduce

如果你想自己跑這個實驗——**完整設定、四級分流表、Decision Log 範本、system prompt 寫法、reference repo 結構**——都會在**下一篇（實驗筆記 #2）** 詳述，並附上可以直接抄的模板。

這一篇先把概念與動機講清楚。

---

> 本文同步發布於 Medium 與 LinkedIn。**這是實驗筆記 #1，#2 預計 8 月發布**。轉載請保留原文連結。
