---
title: "VFR 實驗筆記 #2：完整技術細節 — 任務分流、Decision Log、system prompt 寫法"
subtitle: "把 #1 的 VFR 概念展開成可以直接抄的實作模板"
author: Josh
date: 2026-08-15
lang: zh-TW
status: draft
series: vfr-experiment
series_number: 2
predecessor: 01-vfr-intro
tags:
  - vibe-coding
  - ai-agent
  - workflow-experiment
  - decision-log
  - task-routing
---

# 前言：這一篇接手 #1 的技術細節

如果你先看到這一篇，建議先讀 [**實驗筆記 #1**](01-vfr-intro.md)——那篇解釋了 VFR 為什麼存在、實驗怎麼設計、結果是什麼。

這一篇只負責**技術細節**：

1. **四級分流表的判斷啟發式**：什麼任務走 L1、什麼任務走 L3 Escape Hatch
2. **Decision Log 範本**：三段式 + 真實決策例子
3. **system prompt 怎麼寫**：讓 AI agent 在 session 開頭自動判斷任務級距
4. **vibe prompt 即 spec 的 deeper 論證**：為什麼在單人 × AI 場景下 prompt 本身就能取代規格文件
5. **附錄：reproduce 設定**：所有可以直接抄的模板

---

# 一、四級分流表：判斷啟發式

> 這對應 #1 第三章原則 1 的「流程深度隨任務級距變動」。

## 任務級距定義

| 級距 | 判斷啟發式（heuristic） | 典型任務 |
|---|---|---|
| **L1 Trivial** | 改單一字串 / 單一屬性、不涉及邏輯變更、跑 lint 即可驗證 | 修 typo、改文案、調 padding |
| **L2 Standard** | 新增單一元件、修單一 bug、不跨模組、有明確 acceptance | 新 L1 元件、修一般 bug |
| **L3 Heavy** | 跨多模組、改架構、跨 package、影響既有 API | 新功能涉及 ≥3 檔案、架構調整 |
| **L3 Escape Hatch** | 需求模糊 / breaking change / 跨系統整合 / 安全敏感 | 砍掉舊功能、新付費方案整合、auth 改 OAuth |

## 啟發式的三個問句

判斷時，我會自問（或讓 AI agent 自問）這三個問題：

1. **這個任務涉及幾個檔案？** 1 → L1/L2；3+ → L3 起跳
2. **這個任務有「對外承諾」嗎？** API 介面變更、文件行為變更、SLA 變更 → 必走 L3
3. **這個任務如果做錯，可以 rollback 嗎？** 不能 rollback 或 rollback 成本高 → 升一級

**核心原則**：**不確定的，寧可升一級**。L1 誤判成 L2 的成本遠小於 L3 誤判成 L2 的成本。

## VFR 流程對應表

| 級距 | 流程 |
|---|---|
| L1 Trivial | 直接做 → lint → test |
| L2 Standard | TDD → Verification |
| L3 Heavy | Brainstorming → Decision Log → TDD → Review → Smoke |
| L3 Escape Hatch | L3 Heavy + 完整規格流程（spec / plan / tasks） |

---

# 二、Decision Log 範本

> 這對應 #1 第三章原則 2 的「為什麼比做什麼重要十倍」。

## 三段式範本

```markdown
# 背景
為什麼要做這個決定（什麼痛點 / 什麼信號 / 什麼風險）

# 選項與決定
列舉選項 2–3 個、最終選擇及理由

# 影響
這個決定影響哪些現有系統、誰要知道
```

## 什麼時候必填

- **L3 Heavy 任務**：每個重大決策填一份
- **L3 Escape Hatch**：每個判斷點填一份
- **L2 Standard**：不用填，但程式碼內的「為什麼」必須寫在 commit message
- **L1 Trivial**：不用填

## 真實決策例子（VFR 本身的形成）

```markdown
# 背景
2026-07-29 session 中，每個任務都跑 brainstorming → 完整規格流程 → 行為測試 → 單元測試，
token 消耗為「應該值」的 3–5 倍。三個月後發現 9 份行為測試文件沒人讀過。

# 選項
A. 維持現狀並強迫自己讀行為測試文件（失敗率 100%）
B. 砍掉行為測試整套、把規格流程降級為 L3 Escape Hatch（VFR 方案）
C. 只砍行為測試文件但保留測試引擎設定（半砍）

# 決定
B。理由：行為測試在單人 × AI 場景下 ROI 為負，測試引擎設定若保留會讓 AI 仍誤以為要走行為測試流程。

# 影響
- 我自己的方法論整合文件重寫（從三層方法論改為四級分流）
- 配套的方法論橋接文件內容改為「已廢除」
- 兩個 always-apply 的方法論規則檔刪除
```

這份 Decision Log **172 字**。比之前 612 行的規格文件少一百倍，但我半年後回頭看一樣能記得為什麼。

---

# 三、system prompt 怎麼寫

> 這對應 #1 第三章的「AI agent 必須先判斷任務級距」。

## 給 AI agent 的 system prompt 範本

```markdown
# 你的工作模式

你是一個負責在 vibe coding 場景下，自動判斷任務級距並選擇對應流程的 AI agent。

## 任何 session 開頭的必做動作

1. 讀使用者給的 prompt
2. 用下方「任務級距啟發式」判斷這個任務屬於哪一級
3. **先告訴使用者你判斷的結果**，再開始動手
4. 例：「我判斷你的任務是 L2，我會跑 TDD」

## 任務級距啟發式

- **L1 Trivial**：改單一字串 / 單一屬性、不涉及邏輯變更
- **L2 Standard**：新增單一元件、修單一 bug、不跨模組、有明確 acceptance
- **L3 Heavy**：跨多模組、改架構、跨 package、影響既有 API
- **L3 Escape Hatch**：需求模糊 / breaking change / 跨系統整合 / 安全敏感

## 升級原則

不確定的，寧可升一級。
L1 誤判成 L2 的成本遠小於 L3 誤判成 L2 的成本。

## 對應流程

| 級距 | 流程 |
|---|---|
| L1 Trivial | 直接做 → lint → test |
| L2 Standard | TDD → Verification |
| L3 Heavy | Brainstorming → Decision Log → TDD → Review → Smoke |
| L3 Escape Hatch | L3 Heavy + 完整規格流程 |

## 對應產出

| 級距 | 必填文件 |
|---|---|
| L1 Trivial | 無 |
| L2 Standard | commit message（內含「為什麼」） |
| L3 Heavy | Decision Log（每個重大決策點） |
| L3 Escape Hatch | Decision Log + 規格文件 |

## 不要做的事

- ❌ 沒有先判斷級距就直接動手
- ❌ L2 以上任務跳過 Decision Log
- ❌ L3 Escape Hatch 不寫規格文件就動手
```

## 為什麼這個 prompt 有效

**它做了三件事**：

1. **明確角色定位**：AI agent 不再是「聽命工程師」，而是「流程路由器」
2. **明確判斷準則**：四級啟發式是公開的，AI agent 與人類共享同一張表
3. **明確產出**：不同級距對應不同必填文件，避免「overhead 過大」或「overhead 不足」

---

# 四、vibe prompt 即 spec 的 deeper 論證

> 這對應 #1 第三章最後那段「為什麼 vibe prompt 能取代 spec」。

## 論點 1：spec.md 是給人類讀者存在的文件

傳統 SDD 流程之所以要寫 spec.md，**是因為 spec.md 的讀者是 PM、開發者、QA 三種角色**——他們需要同一份文件對齊「這個功能要做什麼」。

但單人 × AI 場景下，**讀者只有 AI agent 自己**。spec.md 的「對齊功能」被閱讀的頻率是 0。

## 論點 2：vibe prompt 本身就是 spec 的「活版」

當你對 AI agent 打的 prompt 是這樣：

```
「我想做一個會員等級系統：會員有 bronze / silver / gold 三個等級，
根據累計消費金額自動升級，等級會顯示在個人頁面頭像旁邊。
升級時發 email 通知。後台可以手動調整等級。」
```

這段 prompt 已經包含：
- **背景**：會員等級系統
- **功能描述**：三個等級、升級條件、顯示位置
- **通知邏輯**：升級時 email
- **後台操作**：手動調整

如果把這段 prompt 翻譯成 SDD 的 spec.md，**大約就是 200 行**。但 prompt 100 字就講完了。

差別在哪？**AI agent 能即時消費 prompt**——它在你的對話中、它在你下一句指令的 context 裡。spec.md 是被推到文件倉庫後**就死掉了**。

## 論點 3：「vibe 不清楚」是 spec 救不了的部分

有人會反駁：「vibe 不清楚的時候，prompt 還是會不清楚啊」。

對。但這時候的解法**不是寫一份更詳細的 spec.md**，而是：

1. **Brainstorming**：用對話把模糊想法收斂
2. **決策收斂**：把 brainstorm 的結果寫成 Decision Log
3. **再進 vibe prompt**：把 Decision Log 餵回 AI agent，產生可執行的 prompt

這條路徑比「先寫 spec.md 再給 AI agent 讀」**更快、更輕、更不容易過時**。

## 論點 4：為什麼 BDD 在這個場景徹底失敗

BDD 的核心是「讓非工程師讀懂行為」——產品、業務可以用 .feature 檔驗收。

但單人 × AI 場景下，**沒有非工程師讀者**。.feature 變成只有 AI agent 自己讀、自己執行——而 AI agent 直接讀 vibe prompt 也能執行。

更糟的是，**AI agent 跑 .feature 之前要先把 .feature 翻譯成 vibe prompt 的等價物**——這層翻譯的 overhead 完全是浪費。

**結論**：BDD 在「PM 跟 QA 是不同人」時有效；當這兩個角色都由 AI agent 模擬時，中間的 .feature 文件完全是冗餘。

---

# 五、附錄：直接抄的模板

## 5.1 任務級距判斷 checklist

開任何 session 前，把這個 checklist 跑一次：

- [ ] 這個任務涉及幾個檔案？（1 → L1/L2；3+ → L3 起跳）
- [ ] 這個任務有對外承諾嗎？（API / 文件 / SLA → 必走 L3）
- [ ] 這個任務如果做錯，可以 rollback 嗎？（不能 → 升一級）
- [ ] 我不確定的，寧可升一級

## 5.2 Decision Log 範本（直接複製）

```markdown
# 背景
<!-- 為什麼要做這個決定（什麼痛點 / 什麼信號 / 什麼風險）-->

# 選項與決定
<!-- 列舉選項 2–3 個、最終選擇及理由-->

# 影響
<!-- 這個決定影響哪些現有系統、誰要知道 -->
```

## 5.3 system prompt 範本（直接複製到 AI agent）

見本文第三章。

## 5.4 vibe prompt 範本（給 L3 Heavy 任務）

```markdown
# 任務背景
<!-- 為什麼要做這個任務 -->

# 期望產出
<!-- 做完之後使用者會看到什麼 -->

# 限制條件
<!-- 哪些事情不能做 / 哪些既有系統不能動 -->

# 成功標準
<!-- 怎麼算「做完了」 -->
```

---

# 結語：連載進行中

這一篇把 #1 的概念展開成可以直接抄的模板。我在用自己的工作流跑的過程中把細節記錄下來，供有興趣的讀者參考。

**VFR 系列不是顧問服務，是我個人工作流的側寫。**

---

## 連載狀態

- **#1**：動機、假設、概念版結果
- **#2**：本文——技術細節（四級分流、Decision Log、system prompt）
- **#3**：演化實錄：4 小時修完一條斷掉的鏈 + 4 個工作流盲點
- **#4**：每個 decision 的「為什麼選 A 不選 B」（3 個濃縮版）
- **#5**：規劃中

---

# 我接的案子是什麼

這幾篇實驗筆記是**我的工作方法側寫**——我在做什麼、怎麼想的、哪些地方踩過坑。

**我的正業是接全端開發案，不是 VFR 顧問**。VFR 系列只是我優化自己工作流的過程記錄，不是對外提供的服務。

如果你有以下需求，我可以幫你：

- **把模糊的想法變成能跑的 web app**
- **重寫既有系統的某個 module**（PHP / jQuery → React / TypeScript）
- **處理智 auth / payment / session recovery 的 critical chain**（用同一個工作流把所有 failure mode 找出來，附 regression test）
- **既有系統的硬技術問題**（CI/CD、Cloudflare Workers、第三方整合）

**下面這些是我常接的專案類型**：

- React / TypeScript / Node.js 全端
- Hono（API 框架，Cloudflare Workers / Node 兩種 runtime 都熟）
- React Native（mobile app，與 React 共用邏輯層）
- 前後端共用同一份 TypeScript schema / zod / 業務邏輯（mono-repo 拆分）
- PostgreSQL（schema 設計、migration、query optimization）
- Cloudflare Workers / Workers + D1 / Workers + R2
- AWS serverless 服務群（Lambda、S3、API Gateway、DynamoDB、SQS 等）
- 既有 PHP / jQuery 系統的現代化重寫
- 簡單的 SaaS MVP（會員、訂閱、內容管理）

計價方式在第一次對齊時一起談。**聯絡方式**：Medium 留言、email、或我的 Upwork profile。

---

> 本文是實驗筆記系列 #2。轉載請保留原文連結。