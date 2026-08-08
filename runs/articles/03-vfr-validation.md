---
title: "VFR 實驗筆記 #3：真實工作流實戰 — 4 小時修完一條斷掉的鏈"
subtitle: "一個任務分成 4 個等級，不同等級跑不同流程。這一天的真實案例：L2 任務在一條 critical chain 上，跑了 4 小時，修完 8 個 commit，更新了 4 條工作流規範"
author: Josh
date: 2026-08-08
lang: zh-TW
status: draft
series: vfr-experiment
series_number: 3
    10|predecessor: 02-vfr-tech-details
cta_type: external-engineer
client_facing: true
problem_impact: "任務不分級，每個都跑完整流程 → 小任務浪費 30 分鐘，大任務沒跑該跑的步驟 → production bug"
solution_value: "四級分流 + critical chain bridge + 4 條工作流新規範 = 未來每個 auth session 可減少 30 分鐘浪費 + 避免 6 種 failure mode"
tags:
  - vibe-coding
  - workflow-experiment
  - decision-log
  - auth-flow
    20|  - production-smoke
  - bug-chain
---

# 前言：這一篇的前提

建議先讀：

- [**實驗筆記 #1**](01-vfr-intro.md)：VFR 是什麼、我的假設是什麼
- [**實驗筆記 #2**](02-vfr-tech-details.md)：四級分流、Decision Log 格式、system prompt 怎麼寫

這一篇是一個真實案例：2026-08-08 這一天，我接到一個任務，修的過程中發現工作流因此長出了 4 條新規範。

---

# 一個工作流的前提：任務要分大小

我以前的工作方式：

接到任何任務——無論是「改了 3 行 CSS」還是「重寫整個 auth 流程」——都跑同一套流程：brainstorming → spec → plan → test → review → smoke test。

後來我發現這樣太浪費了。

**改了 3 行 CSS 跑 brainstorming？浪費 30 分鐘。**  
**critical chain 的 bug 只跑 smoke test 就上線？production 用戶集體登入失敗。**

我開始把任務分成 4 個等級：

- **L1（小任務）**：改了 1 行、修了錯字、換了文案。直接做，測一下，結束。
- **L2（一般任務）**：新增一個元件、修一個 bug。跑 TDD（先寫測試再寫 code）。
- **L3（大型任務）**：新功能、多個模組、架構改動。跑完整流程：brainstorming → plan → test → review → smoke test。
- **L3 逃脫版**：L3 但需求模糊、或跨系統整合。跑最完整的流程。

每個等級跑的步驟不同。**大任務跑完整，小任務只做必要的。**

這叫做「任務分流」。

---

# 2026-08-08 的真實案例

任務描述：「admin 登入頁修好」。

看起來是 L2（小任務）。

實際上，這個任務在一條 critical chain 上。什麼意思？

auth 流程有 6 個環節：使用者輸入帳號密碼 → 後端驗證 → 瀏覽器收到 cookie → 畫面跳轉到正確頁面 → 顯示會員名稱 → 部署到正式環境。

**這 6 個環節，壞了 6 個地方。**

---

# 6 個問題，白話版

## 1. 密碼比對參數設太嚴，伺服器跑不動

**發生了什麼**：使用者輸入正確密碼，但畫面說「登入失敗」。

**真正的原因是**：驗證密碼的程式參數設得太高，伺服器記憶體不夠用，直接崩潰。

---

## 2. 打包時把「本地測試網址」打進了正式網站

**發生了什麼**：deploy 完成，但登入還是失敗。curl 測試正確，但瀏覽器用戶登入不了。

**真正的原因是**：工程師在開發時，程式裡寫了一個「預設值」——`http://localhost:8787`（本地測試用的網址）。Deploy 時這個網址跟著一起被打包進去了。瀏覽器認為 HTTPS 網站 fetch HTTP 網址是危險的，直接把請求丟掉。

---

## 3. 瀏覽器預檢查通過了，但真正請求被吃掉

**發生了什麼**：DevTools 顯示「預檢查成功」，但實際的登入請求從來沒發出去。

**真正的原因是**：後端只允許一個網址（`https://josh1989213.workers.dev`），但使用者從另一個網址進來（`https://saome-frontend.josh1989213.workers.dev`）。瀏覽器認為這是「不同網站」的請求，靜靜拒絕掉。

---

## 4. 登入成功，但畫面沒跳轉

**發生了什麼**：程式收到「登入成功」了，但使用者還是盯著登入頁看。

**真正的原因是**：`login()` 函式把「已登入」寫進了狀態，但從來沒叫「跳轉」這個動作。

修好的關鍵片段：

```tsx
// 之後（修好）
navigate(ROLE_HOME_PATH[role], { replace: true }); // 多了這一行
```

---

## 5. 深色背景上放了白底卡片，看不見字

**發生了什麼**：登入成功，頁面跳轉了，但卡片是白底，背景是深色，字體也是白色——等於看不見任何東西。

**真正的原因是**：工程師用了預設的白色模板，但背景是自己設計的深色。兩邊沒對上。

---

## 6. 回傳的使用者資料不完整

**發生了什麼**：畫面右上角應該顯示「張先生您好」，但顯示不出來。

**真正的原因是**：後端回傳了 3 個欄位，但前端用了 6 個欄位。少了 3 個。

---

# 修完後發現：工作流有 4 個盲點

修完 6 個 bug 後，我回頭看這次 session，發現工作流有 4 個地方以前從來沒寫進檢查清單：

- **以前以為「後端說成功 = 真的成功」**：但後端 200 不代表瀏覽器真的收到了、也不代表畫面真的顯示了。要有 smoke test（瀏覽器端的快速測試）才算。

- **以前以為「build 完成就 push」**：但 build 後要再多一步——檢查 bundle 裡有沒有不該有的網址（比如 localhost）。如果忘記檢查，localhost 就會被包進正式網站。

- **以前只檢查「未登入的人不能進後台」**：但忘了檢查「已經登入的人不該再看到登入頁」。這兩端要對稱，back button 才能正常運作。

- **以前只看 typecheck（型別檢查）**：但 typecheck 通過了不代表後端回傳的資料形狀和前端用的形狀一致。要加一個 conformance test 來斷言兩邊的欄位數量對得上。

---

# 改善了什麼

**時間**：這次 session 4 小時，修完 6 個 bug、跑了 CI/CD、更新了工作流規範文件。

**節省了多少**：

- 沒有重跑 brainstorming（因為任務分流判斷是 L2） → 省了約 30 分鐘
- 沒有每次 commit 都重跑完整 smoke test（只有 L3 才跑完整版） → 省了重複等待時間
- smoke test 在每個 commit 都跑 → 及早發現問題，不用等使用者回報

**4 條新規範**：

- **Auth flow 規範 1**：後端 200 不等於成功。必須 next screen 有內容才算。
- **Bundle guard**：build 完成後要多一步檢查，確認 bundle 裡沒有 localhost URL。
- **Auth redirect 對稱**：未登入 guard 加上已登入 redirect，back button 才正常。
- **Schema conformance test**：後端回傳的形狀和前端用的形狀，必須有測試斷言兩邊一致。

---

# 結語

這 6 個 bug 在同一個 session 爆出來，表面上是運氣不好。實際上是因為它們在同一條 chain 上——一個壞了，後續 5 個遲早會被觸發。

修完之後，這條 chain 未來再壞，可以更快抓出來——因為我知道這 6 個 failure mode 是怎麼串起來的。

這是工作流改善的價值：不是「這一次省了多少時間」，是**未來同一條 chain 的問題都能更快被發現和修復**。

---

## 名詞解釋

- **工作流規範**：我在這次 session 過後寫進 codebase 的工作原則，用 Markdown 格式存在 `.cursor/rules/` 目錄裡。目的是讓下一個 session 的 AI agent 自動知道「critical chain 上的 bug 要升級處理」「build 完成後要檢查 bundle URL」之類的檢查事項。
- **Decision Log**：每個重要取捨的三段式記錄——背景、選項與決定、影響。目的是讓未來回頭看時，能記得「當時為什麼選 A 而不是 B」。
- **Smoke test**：在瀏覽器端（不是 curl）快速跑一遍核心功能，確認從頭到尾都能 work。目的是抓「curl 測試看起來正確、但瀏覽器因為 Mixed Content 或 CORS 問題實際上失敗」的陷阱。

---

## 連載狀態

- **#1**：動機、假設、概念版結果
- **#2**：技術細節（四級分流、Decision Log、system prompt）
- **#3**：本文——演化實錄：4 小時修完一條斷掉的鏈 + 4 個工作流盲點
- **#4**：每個 decision 的「為什麼選 A 不選 B」（3 個濃縮版）
- **#5**：規劃中

---

# 我接的案子是什麼

這幾篇實驗筆記是**我的工作方法側寫**——我在做什麼、怎麼想的、哪些地方踩過坑。

**我的正業是接全端開發案，不是 VFR 顧問**。VFR 系列只是我優化自己工作流的過程記錄。

如果你有以下需求，我可以幫你：

- 把模糊的想法變成能跑的 web app
- 重寫既有系統的某個 module（PHP / jQuery → React / TypeScript）
- 處理智 auth / payment / session recovery 的 critical chain
- 既有系統的硬技術問題（CI/CD、Cloudflare Workers、第三方整合）

---

> 本文是實驗筆記系列 #3。轉載請保留原文連結。
