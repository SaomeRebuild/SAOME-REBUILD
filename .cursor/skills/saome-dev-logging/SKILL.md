# SAOME DEV LOG Skill

> 觸發條件：使用者說「DEV LOG」「開發日誌」「debug log」「事故記錄」
> 「寫個 trace」「留個記錄」、或任何明示要把這次修 bug / debug chain /
> 決策過程寫下來、寫進 `DEV/MM-YYYY/` 時。

## 目的

把 SAOME 已經在用的 DEV LOG 格式（見 `DEV/07-2026/`、`DEV/08-2026/`、
`runs/improvements/feedback/`）沉澱成可重複的 playbook。

**DEV LOG 標準位置**：`DEV/MM-YYYY/DD-topic.md`
- 月份用 2 位數（`07-2026`、`08-2026`）
- 日期用 2 位數（`0726-`、`0731-`、`0808-`）
- topic 用 kebab-case 簡述（例：`0731-register-form-chain.md`）
- 跟既有 12 個歷史檔（`DEV/07-2026/`）的命名一致

**對齊的對象**：
- 規則：`.cursor/rules/articles/001-article-style.mdc`（DEV LOG **不適用**該 rule 的表格紀律）
- 鄰居 skill：`saome-self-improvement`（寫完要不要 push feedback）
- 鄰居 skill：`saome-form-integrity`（debug autofill / schema drift 時的 probe 樣板可參考）

## 何時必須觸發

下列任一情況發生時，**必須**立即引用此 skill：

1. 使用者說「DEV LOG」「開發日誌」「事故記錄」「debug log」「trace」
2. debug chain 修完，要留 reproduction
3. 決策做完（rule 改、schema 改、config 改），要記錄為什麼
4. commit 前要寫 commit body、發現有 raw data / 探針 / 證據沒留下

## 不該觸發

- ❌ **公開 article / blog / 教學文** —— 那走 `article-writing` skill
- ❌ 修改 spec / plan / task / config 文件 —— 那是 specs/artifacts
- ❌ 修改 README / API doc —— 那是 developer-facing 文件，受其他 rule 管
- ❌ 純粹的 commit message / PR 描述 —— 那是 git metadata，不是 DEV LOG

## 與 Article 的差別

| 維度 | DEV LOG（本 skill） | Article（`article-writing`） |
|---|---|---|
| 受眾 | 自己、未來的自己 | 公開讀者 |
| 目的 | 留 trace、留 reproduce 證據 | 教學、分享 |
| 結構 | chronological、raw data 優先 | narrative、有結論 |
| 表格 | 可寬鬆（個人查閱優先） | ≤ 5 個、禁 2 行 |
| 程式碼 | 內嵌也行 | 必須 code block |
| 排版檢查 | 不必跑 article-style checklist | 必跑 checklist |

## 結構

```markdown
# [一句話標題]

## Metadata

- **日期**：YYYY-MM-DD
- **作者**：[committer / debug owner]
- **commit hash**：[本地 + remote]
- **規則 / skill 觸發**：[相關 rule / skill 名]

## 症狀

> 一句話講發生什麼。讀者（=未來的自己）第一秒就知道這篇在 trace 什麼。

- 環境：[production / staging / dev / 本地]
- 觸發條件：[哪個動作 / 哪個 endpoint / 哪個表單]
- 觀察到的錯誤：[使用者看到的、log 看到的、UI 看到的]
- 預期 vs 實際：[expected vs actual]

## 探針 / 重現

怎麼讓未來的自己**重做一次**這個 bug。

- 命令 / curl / Playwright probe / 手動步驟
- 探針輸出（JSON tree / log 截錄 / screenshot）
- 環境變數、seed data、configuration

## 根因

> 一句話結論。

- 真正原因是什麼（**不是**症狀）
- 為什麼之前測試沒抓到
- 證據連結（commit / log / probe 結果）

## 修法

- diff 摘要（**不必**貼完整 diff，只列哪些檔 / 哪些行）
- commit hash
- 相關 rule / skill / feedback 連結

## 衍生

- 影響的其他檔案、其他 dev log、其他 feedback
- 需要後續追的事項（migrations、tests、docs）

## 自問

- 下次怎麼不犯？
- 哪條 rule 該補？
- 哪個 test 該加？

---

> 撰寫者：[committer] ｜ 時間：[YYYY-MM-DD]
```

## 流程

### Step 1 — Capture the moment

修 bug 的**當下**寫，不要事後補。事後記憶會失真。

允許的最小顆粒：

- 先寫「症狀」「探針」兩段
- 「根因」「修法」可以在 commit 前補

### Step 2 — Trace with evidence

不要寫「我覺得是 X」。寫「我跑了 Y probe，輸出 Z，結論是 X」。

可用的證據形式：

- Playwright probe JSON（從 `tests/probe/` 引用）
- `console.log` tree 截錄
- `curl -i` 的 request / response headers
- git diff 範圍
- DB row dump（`psql -c "..."` 或 D1 query）

### Step 3 — Commit & Push

DEV LOG 應該跟**修法的 commit**同步。如果修法的 commit 已經 push，DEV LOG 用同個 commit hash。

如果 DEV LOG 是事後補的、用「純記錄」commit，commit message 用：

```
docs(feedback): trace [bug title] incident

Refs: [原 commit hash]
```

### Step 4 — Cross-link

把 DEV LOG 跟：

- 相關 `runs/improvements/feedback/*.md`
- 相關 rule / skill（如果這次事故沉澱出新規則）
- `runs/improvements/INDEX.md`（加一條 reference）

…建立連結。SAOME 的好處是「同一個 bug 不會第二次犯」——靠的就是這些 link。

## 寫作紀律（DEV LOG 自己的）

跟 article-style rule **相反**，DEV LOG 的紀律是：

✅ 表格可寬鬆（raw data 該用 table）
✅ code block 不必包進段落
✅ 時間軸 / 順序用有序列表
✅ 多 raw data、多 log、多 JSON
✅ 重複不重要（完整優先於精簡）

❌ 不必追求 narrative flow
❌ 不必每段都有 H2
❌ 不必給「讀者帶走什麼」結論
❌ 不必跑 article-style checklist

## 與其他 Skill 的關係

- `article-writing`：公開文章走那個，本 skill 排除它
- `saome-self-improvement`：寫完要不要 push feedback 看它
- `saome-form-integrity`：debug autofill / schema drift 時的 probe 樣板可參考
- `superpowers:systematic-debugging`：找不到根因時用
- `superpowers:verification-before-completion`：claim 修好前必跑

## 禁止

- ❌ 修完不寫 DEV LOG 直接關掉
- ❌ DEV LOG 寫成 narrative（會跟 article 混淆）
- ❌ DEV LOG 沒附 reproduce 證據
- ❌ 結論寫「應該是 X」沒給 probe / log 證據
- ❌ DEV LOG 跟 commit 不同步（hash 對不上）
- ❌ DEV LOG 跑 article-style checklist（不是它的紀律）
- ❌ 在 DEV LOG 引用尚未 push 的 commit hash 卻沒註記「local-only」