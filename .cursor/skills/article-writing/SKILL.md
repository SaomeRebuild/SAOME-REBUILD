# Article Writing Skill

> 觸發條件：使用者說「寫文章」「寫一篇」「開一篇」「草擬」「重寫」「polish」
> 「改寫成給人看」、或任何明示要產出 root-level 長文 markdown 時。

## 目的

把「給 AI 對話方便 vs 給讀者閱讀」這條 tension 變成可重複的 playbook。
對齊的規則見 `.cursor/rules/articles/001-article-style.mdc`。

## 何時必須觸發

下列任一情況發生時，**必須**立即引用此 skill：

1. 使用者明說「寫文章」「我要寫一篇」「來寫」
2. 使用者說「polish」「改寫成給人看」「給讀者用」
3. 使用者要決定要不要把現有 `*.md` 從 `status: draft` 升到 `status: published`
4. 使用者說「連載」「下一篇」「這篇文章太技術導向」

## 不該觸發

- ❌ **DEV LOG**（使用者說「DEV LOG」「開發日誌」「debug log」「事故記錄」「維運筆記」）
  —— DEV LOG 是給自己 / 未來的自己看的 trace，不是給讀者看的 article
  —— DEV LOG 有自己的 skill：`saome-dev-logging`
  —— DEV LOG 的紀律是「完整 raw data」「時間軸」「可 reproduce」，跟 article 的「讀者舒服」目標相反
- ❌ 修改 `apps/*/` 下的技術文件（README、API doc、plan.md）—— 那是 developer-facing，受 `000-modular-design` / `014-breakpoints` 等 rule 管
- ❌ 修改 spec / task / plan / config 文件 —— 那是 specs/artifacts，不是 article
- ❌ 修改 feedback、commit 訊息、PR 描述 —— 那些不是散文
- ❌ 修改個人 notebook / 純工作記錄 —— 屬 DEV LOG 範疇

## 與 Rule 的分工

| Skill 負責 | Rule 負責 |
|---|---|
| 何時進入寫作流程 | 寫作時必須遵守的紀律（表格、checkbox） |
| 從 topic → outline → draft → polish 的步驟 | 表格使用規則的 fine-grained 判斷 |
| 哪幾步要叫人 review | 排版檢查 checklist |
| 觸發關鍵字 | 觸發規則方式（glob / alwaysApply） |

**規則**：skill 永遠引用 rule，不重複。讀者在 skill 看到 checklist 提示，看到「完整規則見 rule」。rule 不會主動 push 觸發，只在被引用時載入。

## 流程

### Step 1 — Topic Framing

先問使用者三個問題（或自己內部釐清）：

- 受眾是誰？技術同業、後端工程師、PM、其他 vibe coder？
- 目的為何？教學、反思、reproduce、share finding？
- 讀者讀完要做什麼？改變心智模型、套用方法、純粹了解？

**不要假設「受眾 = AI」**。AI 對話方便 ≠ 讀者閱讀舒服。

### Step 2 — Outline First

寫滿 200 行的 markdown 之前**必須**先寫 outline。outline 用 H2 章節、每章一句話講章旨。

```markdown
# [Title]
> 一句話告訴讀者這篇在做什麼

## [H2 章節 1]
> 一句話講這章證明 / 主張什麼

## [H2 章節 2]
...

## 結論
> 讀者帶走什麼
```

**禁止**：直接寫完再回頭加 H2。改排版的成本會吃掉三分之一的 token。

### Step 3 — Draft with Reader First

寫的時候**主對話框**用「讀者導向」：

- 一個章節一個 H2，章節不超過 500 字
- 段落用 3–5 句，不要長段
- 列表 ≤ 7 項，超過拆段
- 程式碼用 code block 不嵌入表格
- 引用 rule 連到 rule，而不是 copy rule 內容

寫完一篇**強制性**：

- [ ] 表格 ≤ 5 個
- [ ] 每章 ≤ 500 字
- [ ] 沒有 2 行表格
- [ ] 流程用有序列表非表格
- [ ] 章節用 H2 非「| 章節 | 內容 |」表

完整 checklist 見 rule。

### Step 4 — Status Marker

每篇都有狀態：

| 狀態 | 含義 |
|---|---|
| `outline` | 只有 H2 + 章旨、內容未填 |
| `draft` | 寫了一半、還有占位 |
| `ready` | 寫完、尚待自己 review |
| `published` | 排版檢查 + 自校 + 標好 frontmatter |

**Frontmatter 範本**：

```markdown
---
title: [Article Title]
status: [outline|draft|ready|published]
audience: [developers|pms|other-vibe-coders]
series: [optional]
date: YYYY-MM-DD
---

> [One-sentence summary for readers]
```

### Step 5 — Pre-Publish Polish

從 `draft` / `ready` 升 `published` 前**必須**：

1. 重讀一次，假裝你是第一次讀的讀者
2. 跑 rule `001-article-style.mdc` 的完整 checklist
3. 檢查每個表格：B.1 規則轉換測試（要不要改成段落/列表）
4. 補 frontmatter
5. 把 frontmatter `status` 標 `published`

**禁止**：

- 從 `outline` 跳 `published`（中間少了 self-review）
- 直接 publish 沒跑 checklist

## 與其他 Skill 的關係

- `saome-self-improvement`：本 skill 處理「怎麼寫」
  它處理「寫完要不要 push feedback」
- `superpowers:brainstorming`：topic framing 階段可搭配
- `superpowers:verification-before-completion`：claim published 前必跑
- `writing-plans`：本文不是 plan，請勿誤觸

## 禁止

- ❌ 寫完直接 publish 不跑 checklist
- ❌ 在大檔案（> 1500 行）寫作而不先拆 outline
- ❌ 用大量表格偽裝結構清晰
- ❌ 把 check item 寫成 checklist 之外的散文（讀者掃不下去）
- ❌ 為了好讀硬砍技術精確度（必要時用 footnote）
- ❌ 跨主題合併多篇文章（> 2000 行）
