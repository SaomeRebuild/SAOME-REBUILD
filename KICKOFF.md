# KICKOFF — 專案首次認識（一次性）

> **只有 Agent 首次進入此專案時讀一次。**
> 之後每次進入都走 AGENTS.md 的「啟動序列」，不再讀這個檔案。
>
> 持續性資訊（目前狀態、待辦、下一步）都在 `DEV/`、`specs/` 裡。

---

## 專案是什麼

**SAOME-REBUILD**：將 WordPress/mu-plugins 商業邏輯遷移到新架構。

| 層 | 技術 |
|----|------|
| Frontend | React + Vite + Tailwind + shadcn |
| Backend | Hono + Cloudflare Workers |
| Database | Supabase（Postgres + Auth + RLS） |
| ORM | Drizzle ORM |

## 必讀順序（首次）

```
1. AGENTS.md（第 1 行開始）
   ↓
2. DEV/README.md → 最新一篇 DEV 紀錄
   ↓
3. specs/ 看有沒有正在進行中的 spec
   ↓
4. 開始工作
```

## 核心方法論

| 方法 | 檔案 / 工具 | 說明 |
|------|------|------|
| SDD | [GitHub spec-kit](https://github.com/github/spec-kit) 9 個 slash command（見 `.cursor/skills/saome-skill-router/SKILL.md` 的「Spec-kit 流程（MANDATORY）」段） | `/speckit.constitution` → `/speckit.specify` → … → `/speckit.converge` |
| 測試 | Superpowers `test-driven-development` skill（透過 `using-superpowers` 自動載入） | Red → Green → Refactor + 紅綠 `git log` 證據 |
| Cleanup | Superpowers `verification-before-completion` + `.cursor/skills/deslop` | PR 開啟前必跑 |

> ⚠️ **2026-07-25 重整**：SAOME 於 2026-07-25 將原本自製的 SDD → BDD → TDD 4 階段（`.cursor/rules/specs/007-sdd.mdc` / `008-bdd.mdc` / `009-tdd.mdc`）**全部刪除**，改為完全依賴 spec-kit 9 個 slash command + Superpowers 配套。詳見 `.cursor/skills/saome-skill-router/SKILL.md` 與 `.specify/memory/constitution.md`（v1.0.0）。

## 關鍵架構決策

| 日期 | 決策 |
|------|------|
| 0725 | Agent 自我改進迴圈建置完成 |
| 0725 | 採用 Hono + Cloudflare Workers 後端 |
| 0725 | 採用 React + Vite + shadcn 前端 |
| 0725 | 採用 Supabase + Drizzle ORM |
| 0725 | 採用 spec-kit 9 個 slash command + Superpowers 配套（取代 SAOME 自製 SDD/BDD/TDD） |

## 還沒有程式碼

目前只有：
- ✅ Rules + Skills（方法論 + 工具鏈）
- ✅ Supabase migration（users table 已建立）
- ✅ DEV 紀錄
- ❌ frontend/（空）
- ❌ backend/（空）
- ❌ specs/（尚無 spec）

**第一個任務是建立第一個功能的 spec 並走完 SDD → BDD → TDD。**

---

## 之後怎麼繼續

每次新 session 進入，不用再讀這個檔案。走 `AGENTS.md` 的「啟動序列」：

1. `DEV/README.md` → 最新一篇
2. 最新 `DEV/MM-YYYY/MMDD-dev.md` → 了解目前狀態
3. `specs/` → 看有沒有進行中的 spec
4. 開始工作
