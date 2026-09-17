# Step 2 autosave 完工 — 第 5 次同 pattern 實例 + Skill / Rules Consolidation 觸發

## Metadata

- **日期**：2026-09-18
- **作者**：Josh（agent-assisted via Cursor）
- **範圍**：`apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx` Step 2 autosave + 9 條 regression test
- **嚴重度**：SEV-1（silent data corruption — 同 pattern 第 5 次重複）
- **規範層 push**：✅ Yes（與 skill + rule 補強同 commit）

---

## 背景

2026-09-05 Step 4 autosave 慢網路洗 DB 事故後，建立了 Rule 030 / 031 / 032 三條 SOP（[`runs/improvements/feedback/20260906-rule-sediment-030-031-032.md`](file:///c:/Users/user/Desktop/SAOME-REBUILD/runs/improvements/feedback/20260906-rule-sediment-030-031-032.md)）。**這三條 rule 把「不能寫空」、「不能 race」、「後端要驗」三個機制沉澱**。

但 CardBuilderEditor.tsx 之後每次新欄位 autosave 都是同 SOP 拷貝：

| 階段 | 實例 | line 範圍 | 共用 outer-fetch ref |
|------|------|-----------|---------------------|
| Phase 5.1（9/05） | `cardName`（logoText） | 150-225 | `step4LoadSettledRef` |
| Phase 5.5（9/05） | `isPaid` | 192-220 | `step4LoadSettledRef` |
| Round 1（9/05） | **Step 4**（description / backFields / links） | 285-328 | `step4LoadSettledRef` |
| Phase 5.14（9/06） | **Step 5**（locations / locationsDisabled） | 380-411 | `step5LoadSettledRef` |
| **Phase 5.16（9/18）** | **Step 2**（cardName / issuerName / barcodeType / passValidDays / expiryDate / currency / language） | **544-584** | **`step2LoadSettledRef`** |

**Step 2 是第 5 次重複**。

---

## 症狀（為什麼這次要寫 feedback）

每次新欄位 autosave，agent / 開發者都要重新翻 3 條 rule：

1. Rule 030：baselineArmedRef pattern
2. Rule 031：≥1s timer + slow-network regression test
3. Rule 032：client-side validation + 後端 JSONB merge silent overwrite

這造成幾個問題：

### 1. 認知負擔高

3 條 rule 散落 3 個檔案，沒統一 entry point。每次都要：
- 確認「這個欄位需不需要 baselineArmedRef？」
- 確認「debounce 是幾秒？」
- 確認「需不需要 client-side validation？」
- 確認「後端 SQL 有沒有過 zod？」
- 確認「4-layer schema sync 做了沒？」

5 個問題，每個要對應不同 rule。**5 次重複 = 5 次同樣 5 個問題**。

### 2. Copy-paste drift 風險

雖然每次實作都對齊既有 pattern（commit 都全綠），但 5 處實作的微差異已浮現：

| 差異 | 影響 |
|------|------|
| Step 2 的 `cardName` 寫 SQL `templates.name`（top-level column） vs Step 4 的 `description` 寫 `settings.description`（JSONB nested） | payload shape 不同，client-side validation schema 不同 |
| `loadSettledRef` 共用 / 獨立決策不一致（3 共用 vs 2 獨立） | 未來 Step N 想共用 Step 4 的 ref，要先確認 5 處哪幾處可以共用 |
| cleanup 顯式清 timer 的位置有的在 `useEffect` body，有的在 return | 看似一致但實際位置飄移，code review 抓不到 |

若繼續累積，第 6、第 7 次實作時 drift 風險會指數上升。

### 3. 缺統一 hook → 缺 refactor SOP

理論上 5 處可以抽出 `useCardFieldAutosave` shared hook（signature 約 60 行 + 3 ref + cleanup），消除 ~150 行 boilerplate。但目前沒人知道：
- 何時抽（threshold 是什麼？）
- 怎麼抽（5 處 payload shape 不一致怎麼辦？）
- 怎麼驗證（5 處既有 200+ regression test）

**未來抽 hook 風險太高**，所以一直沒人敢做。

---

## 三角形破口（為什麼 SOP 必須 3 件一起做）

```
        Effect 第一次 run
        (useEffect 內讀 store 值)
                ↓
        [Rule 030 守門：baselineArmedRef]
                ↓
        ≥1s timer (autosave debounce)
                ↓
        [Rule 031 守門：loadSettledRef + slow-network regression test]
                ↓
        async fetch race (getById 解析時間不定)
                ↓
        [Rule 030 + 031 必須同時守]
                ↓
        JSONB merge (silent overwrite)
                ↓
        [Rule 032 三層防護：client-side zod + backend zod + DB CHECK]
```

**3 個機制各處理一塊 — 缺一就壞**。這也是為什麼之前建立 3 條獨立 rule 而非 1 條綜合 rule（見 [20260906 feedback § 為什麼是 3 條獨立 rule 而不是 1 條](file:///c:/Users/user/Desktop/SAOME-REBUILD/runs/improvements/feedback/20260906-rule-sediment-030-031-032.md)）。

但**3 條獨立 rule 在「單一 SOP 視角」看就分裂了** — 開發者 / agent 觸發時不知道先讀哪條。這是本批觸發 skill 的根本原因。

---

## 本批決議

### 決議 A：新增 Skill `.cursor/skills/saome-card-field-autosave-pattern/`

**理由**：
- 5 個實例 = 結構抽象的最低 threshold（cross-cutting pattern：≥3 次重複 = 結構抽象的 trigger）
- Skill 比 rule 更適合「5 層 pipeline + copy-paste hook template」的載體
- Skill 可以 cross-reference 3 條 rule 而不重複內容

**內容**（詳見 [skill SKILL.md](file:///c:/Users/user/.cursor/skills/saome-card-field-autosave-pattern/SKILL.md)）：
- 5 層必經 pipeline（Store → 4-Layer Schema → Effect → Test → loadSettings）
- Hook template（內嵌 copy-paste 程式碼）
- 3 條 conformance test 模板
- Reference Implementation Index（5 處 live line numbers）
- Step-by-step Checklist（8 步）
- 共用 vs 獨立 outer-fetch ref 變體決策表

### 決議 B：補強 Rule 030 / 031 / 032（cross-reference + line numbers）

**理由**：不改既有 SOP 內容（rule 已 stable），只加 quick-reference cross-link 段落：
- 「§ 與 Skill 關係」段落（NEW）— 指向 skill
- 「§ Reference Implementation Index」— 5 處 line numbers
- 「§ 與其他 rule 的關係」— 互相 cross-link（Rule 030 → 031、Rule 031 → 030）

### 決議 C：不解 `useCardFieldAutosave` shared hook

**理由**（獨立 session 風險）：
- 5 處同時 refactor 風險高（破壞既有 200+ regression test）
- 5 處 payload shape 不一致（top-level `cardName` vs JSONB `settings.xxx`）→ hook signature 複雜
- 5 處共用 / 獨立 loadSettledRef 混用 → hook signature 難 design
- 收益（5 處減少 ~150 行 boilerplate）vs 風險（5 處 regression test 全重跑）不對等

**Future invariant**：未來抽 hook 必走獨立 session + L3 Heavy 流程（涉及 schema sync 5 處 + test 200+ + 5 處呼叫站同時改）。skill 內有「抽 shared hook 的考量」段落，明寫這個 trade-off。

### 決議 D：INDEX.md 新增 entry

照 2026-09-06 feedback row 格式，新增 2026-09-18 entry。

---

## 涵蓋的 Step 2 欄位

| 欄位 | 寫入目標 | 既有依賴 |
|------|----------|----------|
| `cardName` | SQL `templates.name`（top-level payload） | Header 顯示用 + Step 2 CardNameField |
| `issuerName` | JSONB `settings.issuerName` | IssuerNameField |
| `barcodeType` | JSONB `settings.barcodeType` | BarcodeSelector |
| `passValidDays` | JSONB `settings.passValidDays` | PassValidDaysField |
| `expiryDate` | JSONB `settings.expiryDate` | ExpiryDateField |
| `currency` | JSONB `settings.currency` | CurrencyField |
| `language` | JSONB `settings.language` | LanguageField |

`cardName` 寫 top-level、其他 6 個寫 JSONB settings — 這個 payload shape 不一致正是決議 C 不抽 hook 的原因之一。

---

## 9 條新 Step 2 Regression Test

`CardBuilderEditor.autosave.test.tsx` 從 928 → 1121 行（+193 行 / +9 case）：

1. `cardId 變動觸發 Step 2 autosave 初始化`
2. `setCardName debounce 1100ms 後 PUT 1 次`
3. `setIssuerName 連續輸入 collapse 為單一 PUT`
4. `setBarcodeType 切換觸發 PUT（含 default 值）`
5. `setPassValidDays 改數字觸發 PUT`
6. `setExpiryDate 改 ISO 字串觸發 PUT`
7. `setCurrency + setLanguage 兩個欄位同時改 → 一個 PUT 含兩個欄位`
8. `reset() 到 default → 不觸發 PUT`
9. `slow-network regression（getById 1500ms 內不 PUT）` ← **MANDATORY**

---

## 教訓

### 1. 5 次同 pattern = 結構抽象的最低 threshold

cross-cutting pattern：≥3 次症狀 fix 還沒清 = 結構假設錯（見 2026-08-30 logo uploader feedback）。對 autosave 來說，≥3 次實作同 SOP = 結構抽象的 trigger。本批是第 5 次，剛好。

### 2. Rule 散落是「規範成熟期」必經

建立 rule 階段（Rule 030 / 031 / 032 第一次寫）需要獨立、互不污染。rule 穩定後（大量實例已證明 pattern 通用），就會自然演化出 skill / index，把分散的 rule 收斂成 single entry point。

### 3. 「不做」的決議同樣要寫

決議 C（不解 shared hook）跟決議 A、B 一樣重要。如果不寫，未來有人看到 5 處重複就會想抽 hook，然後踩到風險。明寫「為什麼不解」才能阻擋後續衝動。

### 4. Skill 跟 Rule 互補不衝突

- **Rule** = 規範（MANDATORY / 禁止 / 觸發關鍵字）— 給 code review / agent 引用
- **Skill** = SOP（5 層 pipeline / copy-paste template / reference impl）— 給開發者 / agent 實作

Skill 內 cross-reference 3 條 rule，rule 內 cross-reference skill。兩者不重複內容，但互相補強。

### 5. Reference Implementation Index 是 SKILL 的核心

5 處 live line numbers + 共用 / 獨立 loadSettledRef 決策 → 開發者 / agent 一查就知道「我這個新欄位該用哪個 outer-fetch ref」。這個 index 是把「抽象 pattern」落地到「真實程式碼」的橋樑。

---

## 影響

| 範圍 | 影響 |
|------|------|
| `CardBuilderEditor.tsx` Step 2 line 544-584 | 第 5 個 reference impl（共 5 處） |
| `CardBuilderEditor.autosave.test.tsx` | +9 條 conformance case（總 16 條） |
| `.cursor/skills/saome-card-field-autosave-pattern/SKILL.md` | NEW — 5 層 pipeline + copy-paste hook template + 5 處 reference impl line numbers |
| `.cursor/rules/030-*.mdc` / `031-*.mdc` / `032-*.mdc` | 各加「§ 與 Skill 關係」cross-link 段落 |
| `runs/improvements/INDEX.md` | 新增 2026-09-18 entry row |

---

## 未來 invariant

| Invariant | 必做 |
|-----------|------|
| 新增 CardBuilder 欄位 autosave | 必讀 SKILL `saome-card-field-autosave-pattern` + Rule 030/031/032 |
| 解 `useCardFieldAutosave` shared hook | 獨立 session + L3 Heavy 流程（schema sync 5 處 + test 200+ + 5 處呼叫站同時改） |
| 任何新的 autosave 場景（非 CardBuilder） | 參考 skill 結構，但**不直接套用** — 驗證 SOP 是否需要調整 |
| 任何回填失敗（DB row 形狀漂移） | 檢查 skill § 5 層 pipeline Layer 5（loadSettings defensive unwrap） |

---

## 參照

- [`.cursor/skills/saome-card-field-autosave-pattern/SKILL.md`](file:///c:/Users/user/.cursor/skills/saome-card-field-autosave-pattern/SKILL.md) — NEW
- [`.cursor/rules/030-effect-first-run-not-trustworthy.mdc`](file:///c:/Users/user/.cursor/rules/030-effect-first-run-not-trustworthy.mdc) — 補強 cross-link
- [`.cursor/rules/031-long-timer-async-fetch.mdc`](file:///c:/Users/user/.cursor/rules/031-long-timer-async-fetch.mdc) — 補強 cross-link
- [`.cursor/rules/032-backend-jsonb-merge-silent-killer.mdc`](file:///c:/Users/user/.cursor/rules/032-backend-jsonb-merge-silent-killer.mdc) — 補強 cross-link
- [`.cursor/rules/019-schema-contract-drift.mdc` § 4.1](file:///c:/Users/user/.cursor/rules/019-schema-contract-drift.mdc) — 4-layer schema sync
- [`.cursor/rules/027-postgres-dynamic-query-pattern.mdc` § workerd JSON.stringify](file:///c:/Users/user/.cursor/rules/027-postgres-dynamic-query-pattern.mdc) — jsonb 注入 pitfall
- [`runs/improvements/feedback/20260906-rule-sediment-030-031-032.md`](file:///c:/Users/user/Desktop/SAOME-REBUILD/runs/improvements/feedback/20260906-rule-sediment-030-031-032.md) — 3 條 rule 沉澱原始 trace
- [`apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx`](file:///c:/Users/user/Desktop/SAOME-REBUILD/apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx) — 5 處 reference impl
- [`apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.autosave.test.tsx`](file:///c:/Users/user/Desktop/SAOME-REBUILD/apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.autosave.test.tsx) — 9 條 Step 2 + 7 條 Step 4 conformance test
- `DEV/09-2026/0905-step4-autosave-slow-network-baseline.md` — 完整事故 trace
- `runs/improvements/INDEX.md` — 新增 2026-09-18 entry

---

## Commit 計畫

規範層（必須 push，per `saome-self-improvement` Step 3 三層決策表）：

```
docs(feedback): add 20260918-step2-autosave-5th-instance-skill-needed.md
docs(skill): add saome-card-field-autosave-pattern
docs(rules): 030/031/032 cross-link to new skill + 5 reference impl line numbers
docs(index): append 2026-09-18 entry
```

footer：
```
Self-improvement: runs/improvements/feedback/20260918-step2-autosave-5th-instance-skill-needed.md
Sync: https://github.com/SaomeRebuild/SAOME-REBUILD commit <待 commit>
```
