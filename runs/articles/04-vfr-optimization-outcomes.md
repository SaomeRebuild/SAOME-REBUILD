---
title: "VFR 實驗筆記 #4：6-Bug Chain 的 3 個關鍵取捨"
subtitle: "每個 decision 只記三件事：背景、選項與決定、影響"
author: Josh
date: 2026-08-08
lang: zh-TW
status: draft
series: vfr-experiment
series_number: 4
    10|predecessor: 03-vfr-validation
cta_type: internal-pm
client_facing: true
problem_impact: "每個 session 的取捨如果不記下來，未來在類似情境裡會重蹈覆轍"
solution_value: "3 個 decision 的完整思路 = 未來每個 auth session 的 reference checklist"
tags:
  - vibe-coding
  - decision-log
  - auth-flow
  - bug-chain
    20|  - workflow-experiment
---

# 前言：什麼是 Decision Log

建議先讀：

- [**實驗筆記 #1**](01-vfr-intro.md)：VFR 是什麼
- [**實驗筆記 #2**](02-vfr-tech-details.md)：四級分流、Decision Log 格式
- [**實驗筆記 #3**](03-vfr-validation.md)：2026-08-08 這一天發生的事

Decision Log 不是 bug report。Bug report 寫「壞了什麼」。Decision Log 寫「我選了 A 方案而不是 B 方案，這是為什麼」。

格式只有三段話：**背景**、**選項與決定**、**影響**。

---

# Decision 1：密碼參數，要「更安全」還是要「立刻能用」

## 背景

admin 的密碼 hash 是用舊參數（`N=16384`）算出來的。程式裡寫的是新參數（`N=131072`，號稱「更安全」）。兩邊湊不起來，所以登入一直失敗。

## 選項與決定

- **選項 A**：把程式改成舊參數（`N=16384`），配合既有的 admin 密碼
- **選項 B**：重新算出新參數的 hash，但所有既有 admin 要重設密碼
- **選項 C**：兩個參數都支援，先 try 舊的、再 try 新的

決定：**選 A**。

理由：`N=16384` 不是「不安全」——它是 2015 年的 NIST 標準。`N=131072` 是「未來可以升級」的目標，不是今天必須做到的事。這個專案處於 recovery 階段，還沒有其他用戶，沒有「重設密碼」的成本問題。

## 影響

- **立即**：admin login 恢復
- **未來**：當這個專案進入 production、開始有用戶之後，密碼 migration 要在同一個 PR 裡同時升級 hash 參數 + 通知用戶重設密碼

---

# Decision 2：程式打包時把 localhost 網址包進去了，怎麼修

## 背景

`apiBaseUrl` 的預設值寫的是 `http://localhost:8787`（本地測試用）。Deploy 時這個網址跟著一起被打包進去了。瀏覽器認為 HTTPS 網站 fetch HTTP 網址是危險的，直接把請求丟掉。

## 選項與決定

- **選項 A**：在程式裡用一個 flag（`import.meta.env.PROD`）判斷環境，自動切換預設值
- **選項 B**：另外寫一個 `.env.production` 檔案，deploy 前手動設定正確的網址
- **選項 C**：兩個都做，A + B

決定：**選 C**。

理由：Cloudflare Pages 的 flag 行為有時不可靠（`VITE_` 開頭的變數有時候在 build 時沒被正確替換）。`.env.production` 是明確的覆寫，繞過 flag 問題。兩層都做代價不高，但確保不管哪層壞了，另一層能頂上。

## 影響

- **立即**：`env.ts` 改成 flag 切換，加上 `.env.production` explicit override
- **未來**：所有新增的 API 網址都要同步更新 `.env.production`，不能只改 code

---

# Decision 3：登入成功了，但畫面沒跳轉——怎麼修

## 背景

`LoginForm` 的 `onSubmit` 叫了 `login()` 函式，把「已登入」寫進了狀態，但從來沒叫「跳轉到下一頁」這個動作。`RegisterForm` 有跳轉，但 `LoginForm` 沒有。兩邊行為不一致。

## 選項與決定

- **選項 A**：在 `LoginForm.onSubmit` 成功後加一行 `navigate()` 跳轉
- **選項 B**：在 `LoginPage` 和 `RegisterPage` mount 時檢查「如果已經登入就 redirect」
- **選項 C**：寫一個 hook，讓任何 auth form 頂部自動監聽「已登入」狀態，自動跳轉

決定：**選 C + B 同時做**。

理由：選項 A 的問題是「每個 form 自己要記得加跳轉」，遲早又會漏。選項 B 處理「直接輸入網址進來」的情境。選項 C 是最佳實踐：狀態改變時自然跳轉，不需要每個 component 自己管理。架構上已經有一個 `useAuthRedirect` hook 只是還沒接上——這次把它接上。

修好的關鍵片段：

```tsx
// LoginForm 頂部加這一行
useAuthRedirect();
```

## 影響

- **立即**：`LoginForm` 頂部加 `useAuthRedirect()`，Page 層加 back-button guard
- **未來**：所有新 auth form 預設用 `useAuthRedirect`，不需要手動加跳轉

---

# 結語

這 3 個 decision 是 6-bug chain 裡最核心的 3 個取捨。

每一個 decision 的共同點是：**症狀是一件事，根因是另一件事**。

- 密碼參數：表面是「hash 湊不起來」，根因是「schema migration 和 code migration 沒綁在一起」
- localhost 網址：表面是「build 打包錯誤」，根因是「沒有分層的 env default 架構」
- 畫面沒跳轉：表面是「少了一行 navigate」，根因是「沒有狀態驅動的 auth redirect 機制」

修症狀可以讓程式暫時 work，但寫工作流規範才能讓未來同一類問題不再發生。

Decision Log 的目的就是這個：記下「為什麼這樣修」，半年後回頭看還能記得。

---

## 名詞解釋

- **Critical chain**：一段不能斷的功能鏈。auth 流程就是一條 critical chain——任何一個環節壞了，整個登入體驗都會掛。這次修的 6 個 bug 全部在 auth 這條 chain 上，所以每一個都要當成大任務處理，不能當小 bug 修。

---

## 連載狀態

- **#1**：動機、假設、概念版結果
- **#2**：技術細節（四級分流、Decision Log、system prompt）
- **#3**：演化實錄：4 小時修完一條斷掉的鏈 + 4 個工作流盲點
- **#4**：本文——3 個關鍵 decision 的完整思路
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

> 本文是實驗筆記系列 #4。轉載請保留原文連結。
