---
title: "VFR 實驗筆記 #3：用 AI agent 自己判斷任務級距、跑 Decision Log 餵回、測 multi-agent 分工"
subtitle: "把 #2 留下來的未驗證問題實際跑一遍——看哪些假設成立、哪些要砍"
author: Josh
date: 2026-09-01
lang: zh-TW
status: outline
series: vfr-experiment
series_number: 3
predecessor: 02-vfr-tech-details
tags:
  - vibe-coding
  - ai-agent
  - workflow-experiment
  - decision-log
  - task-routing
  - multi-agent
---

# 前言：這一篇是 #2 留下來的未驗證問題

如果你先看到這一篇，建議先讀：

- [**實驗筆記 #1**](01-vfr-intro.md)：VFR 為什麼存在、實驗怎麼設計
- [**實驗筆記 #2**](02-vfr-tech-details.md)：四級分流、Decision Log、system prompt 怎麼寫

#2 結尾提了 3 件下一階段要實驗的事，這一篇就是實驗結果。

| 未驗證問題 | 本篇覆蓋 |
|---|---|
| 1. AI agent 自己判斷任務級距準不準 | ✅ 詳寫 |
| 2. Decision Log 能不能讓 AI agent 變聰明 | ✅ 詳寫 |
| 3. 多個 AI agent 之間如何分工 | ✅ 詳寫 |

---

# 一、未驗證問題 1：AI agent 自己判斷任務級距準不準

## 實驗設計

- **樣本數**：5 個 L3 任務
- **方法**：每個任務開新 session，第一句只給 vibe prompt（例如「我想做一個 X 功能」），不告訴 AI agent 級距
- **測量**：AI agent 第一輪回覆裡寫的「我判斷你的任務是 L_」是哪一級 → 對照我事後人工判斷的級距 → 計算一致性
- **約束**：AI agent 的 system prompt 用 #2 第三章那個範本，沒改

## 實驗結果（占位）

### 任務清單

| # | 任務描述（簡述） | AI agent 判斷 | 人工判斷 | 一致？ |
|---|---|---|---|---|
| 1 | （待補） | （待補） | （待補） | （待補） |
| 2 | （待補） | （待補） | （待補） | （待補） |
| 3 | （待補） | （待補） | （待補） | （待補） |
| 4 | （待補） | （待補） | （待補） | （待補） |
| 5 | （待補） | （待補） | （待補） | （待補） |

### 一致性統計（占位）

- **整體一致性**：x / 5
- **誤判類型分布**：
  - 升一級（AI 判重於人工）：x 例
  - 降一級（AI 判輕於人工）：x 例
  - 跨級距誤判（L1 ↔ L3）：x 例
- **失準成本估算**：誤判造成的後續補救時間

### 觀察到的有趣現象（占位）

- AI agent 對「改既有 API 介面」特別敏感——幾乎都判 L3+
- AI agent 對「跨 package 變更」容易判輕——這是漏報最多的類型
- 模糊 vibe prompt 時，AI agent 偏好判重（保守傾向）

## 結論（占位）

- 假設成立 / 不成立：________
- 啟發式要不要改：________
- 改了哪些：________

---

# 二、未驗證問題 2：Decision Log 能不能讓 AI agent 變聰明

## 實驗設計

- **樣本數**：10 個新任務
- **方法**：每個任務開新 session，第一句只給 vibe prompt，**但 session context 內附上過去 6 個月的 Decision Log**（前 N 篇）
- **對照組**：另外 10 個任務，不附 Decision Log
- **測量**：
  - AI agent 給的方案方向是否跟「當時的決策」一致（定性）
  - 產出 code 的「為什麼」是否寫對 Decision Log 引用過的脈絡
- **約束**：Decision Log 餵的方式用 RAG（取最相關 5 篇）而非全塞 context

## 實驗結果（占位）

### 一致性觀察（占位）

- 附 Decision Log 的 session：AI agent 引用歷史決策的比例是 x/10
- 不附的 session：AI agent 從零開始的比例是 x/10
- 最有共識的決策類型：________
- 最容易被 AI agent 推翻的決策類型：________

### RAG vs 全塞 context 的取捨（占位）

- 全塞 context：tokens 爆量，但 AI agent 引用率最高
- RAG：tokens 省 80%，但引用率掉到 __%
- **折衷方案**：________

### 意外發現（占位）

- AI agent 不只引用決策，**還會指出「這份決策過時了」**——這是預期外的行為
- 某些決策的「影響」段被 AI agent 用作 future-proofing 提醒

## 結論（占位）

- 假設成立 / 不成立：________
- Decision Log 格式要不要改：________
- 改了哪些：________

---

# 三、未驗證問題 3：多個 AI agent 之間如何分工

## 為什麼這個實驗最冒險

前兩個問題都是「AI agent 自己判斷 / 自己讀歷史」，是單 agent 場景的延伸。

第三個問題是「**多個 AI agent 能不能重現團隊效果**」——這需要工具鏈支援，而且結果可能跟我預期完全相反。

## 工具鏈選擇（占位）

| 工具 | 嘗試原因 | 結論 |
|---|---|---|
| Cursor 多視窗 + 不同 persona | 最簡單，零基礎設施 | （待補） |
| LangGraph | 圖形化 state machine，適合多角色 workflow | （待補） |
| CrewAI | 內建 role-based agent pattern | （待補） |
| AutoGen | 微軟出品，擅長多 agent 對話 | （待補） |
| 自建 CLI 多 session | 最笨但最可控 | （待補） |

## 實驗設計

- **場景 1**：spec agent（生成 vibe）→ coder agent（產出 code）→ reviewer agent（檢查）
- **場景 2**：三個同質 coder agent 各自給方案 → 一個 reviewer agent 評分
- **場景 3**：完全沒分工，單 agent 全做（對照組）

每個場景跑 3 個任務，觀察：
- 產出品質（reviewer agent 給分）
- 總 token 消耗
- **是否真的分工**（還是退化成單 agent 拖拉）

## 實驗結果（占位）

### 場景 1：流水線式

- 優點：________
- 缺點：________
- spec agent 的產出比單 agent 的 vibe prompt 好嗎？________

### 場景 2：三方案投票

- 優點：________
- 缺點：________
- 三方案真的有差異嗎？還是 AI agent 都給一樣的答案？________

### 場景 3：對照組

- 確認 baseline：________

### 跨場景觀察（占位）

- **多 agent 沒有顯著提升**：這個結論如果成立，會推翻 #1 假設（用 AI agent 模擬團隊）
- **分工真的有效**：________

## 結論（占位）

- 假設成立 / 不成立：________
- VFR 要不要擴展到 multi-agent：________
- multi-agent 在哪些場景值得用：________

---

# 四、整合：VFR 經過三輪實驗後的修正

> 這個章節是把 #1 + #2 + #3 的結果整合，回頭修 VFR 的 system prompt 與流程表。

## 4.1 任務級距啟發式的修正（占位）

如果未驗證問題 1 發現某些判斷失準，會列出修正後的啟發式：

```markdown
（修正後的啟發式，待補）
```

## 4.2 Decision Log 格式的修正（占位）

如果未驗證問題 2 發現某些欄位沒用或缺欄位，會列出修正後的格式：

```markdown
（修正後的 Decision Log 範本，待補）
```

## 4.3 VFR 要不要擴展到 multi-agent（占位）

如果未驗證問題 3 結果為「multi-agent 沒顯著提升」，**VFR 維持單 agent + 流程分流**。

如果結果為「分工有效」，VFR 加一層 L4：multi-agent 編排。

---

# 結語：連載狀態

| 篇 | 狀態 | 主題 |
|---|---|---|
| #1 | 已發布（draft） | 動機、實驗、結果（概念版） |
| #2 | 已發布（draft） | 技術細節（四級分流、Decision Log、system prompt、vibe 即 spec） |
| #3 | 本文（outline） | 三個未驗證問題的實驗結果 |
| #4 | 規劃中 | （依 #3 結果決定） |
| #5 | 規劃中 | （依 #3 結果決定） |

---

# 我接的案子是什麼

> ⚠️ 本文目前是 outline，實驗結果尚未填入。以下 CTA 是**占位**——實驗填完後會按實驗結論調整，但主軸不會變：我接的是全端開發案，不是 VFR 顧問。

**我的正業是接全端開發案——幫你把你的想法落地**。

如果三個未驗證問題的實驗結果都成立，#1 #2 #3 寫 VFR 的方法論最終要回答的問題是：**怎麼讓單人開發像個小團隊**。這個問題的回答方式很多，**VFR 只是我的其中一種**。我能接的案子不限於有跑 VFR 的客戶。

如果你有：

- **全端 web app 開發**（前端 + 後端 + database + deployment）
- **既有系統重寫**（PHP / jQuery 現代化、React migration、API 設計）
- **production 等級的硬工**（auth、payment、CI/CD、Cloudflare Workers）

**下面這些專案類型是我常接的**：

- React / TypeScript / Node.js 全端
- Hono（API 框架，Cloudflare Workers / Node 兩種 runtime 都熟）
- React Native（mobile app，與 React 共用邏輯層）
- 前後端共用同一份 TypeScript schema / zod / 業務邏輯（mono-repo 拆分）
- PostgreSQL（schema 設計、migration、query optimization）
- Cloudflare Workers / Workers + D1 / Workers + R2
- AWS serverless 服務群（Lambda、S3、API Gateway、DynamoDB、SQS 等）
- 既有 PHP / jQuery 系統的現代化重寫
- 簡單的 SaaS MVP（會員、訂閱、內容管理）

都可以找我聊。**聯絡方式**：Medium 留言、email、或我的 Upwork profile。

---

# 附錄 A：這個 outline 要怎麼填

填 #3 的時候，建議照這個順序：

1. **先跑實驗**：照每章的「實驗設計」跑一次
2. **填實驗結果**：照占位位置填實際數字
3. **回頭修 #2 的模板**：把修正後的啟發式 / Decision Log 寫進第四章
4. **決定連載路線**：在「連載狀態」表補 #4 / #5 的主題

# 附錄 B：發布前的讀者導向排版檢查

> 這份清單在 #1 #2 #3 都進入 `status: published` 階段、正式發布前**必須**跑一次。
> 目的：把「為了在 AI 對話裡寫得清楚」轉成「給真讀者讀得舒服」。

完整的 article 寫作紀律（表格使用規則、排版 checklist、frontmatter 規範）已搬到：

- **Skill**（觸發 + 流程）：`.cursor/skills/article-writing/SKILL.md`
- **Rule**（紀律 + checklist）：`.cursor/rules/articles/001-article-style.mdc`

本文只列**這三篇專屬**的已知待清項目，不再重複通用規則。

## B.1 #1 #2 #3 audit 結果（2026-08-01）

> 套用 article-style rule 跑 audit，**全部通過**——下面紀錄的是 audit 中看到的「事實」，不是「待清項目」。

### #1（vfr-intro）

- 表格數：1（量化結果表）
- 評估：A 對 B 對照，符合保留條件
- 結論：通過，不需改

### #2（vfr-tech-details）

- 表格數：4（四級分流啟發式、流程對應、system prompt 流程、system prompt 產出）
- 評估：每個都是「級距 ↔ 對應 X」的 A 對 B 對照，全部符合保留條件
- 結論：通過，不需改

### #3（本文）

- 表格數：4（前言覆蓋表、實驗任務清單、工具鏈選擇、連載狀態）
- 評估：佔位性質的清單（任務清單、工具鏈選擇）目前是 5 行 × 5 列 — 實驗跑完填入後仍是對照性質，不超過規則
- 結論：通過，佔位填入後複查一次

> 這個 audit 是通用 rule + 三篇專屬規則的最後一次掃描。
> 三篇都還沒進 `status: published`，等實驗填完、複查後才升 status。

---

> 本文是實驗筆記系列 #3。轉載請保留原文連結。
