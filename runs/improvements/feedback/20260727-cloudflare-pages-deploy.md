# Feedback 20260727：Cloudflare Pages Deploy — npm workspace + lockfile 衝突

## 背景

2026-07-27，嘗試將前端（`apps/frontend`）部署至 Cloudflare Workers，過程遇到多個錯誤表象。

## 根因分析（重要！）

**真正的根因不是 TypeScript 程式碼錯誤，而是 npm workspace + lockfile 衝突**：

| 層面 | 問題 |
|------|------|
| lockfile 格式衝突 | 根目錄 `package-lock.json` 含 `.pnpm/... link entries`，但 CI 用 npm 10 |
| 雙 lockfile | 同時存在 `root/package-lock.json` + `apps/frontend/package-lock.json` |
| workspace 邊界模糊 | npm 在 workspace 子目錄執行時，向上識別 workspace root |
| 安裝結果不可用 | npm 宣稱 "added X packages"，但 `.bin/tsc` 未建立 |

## 三種錯誤表象

| 平台 | 錯誤訊息 | 實際原因 |
|------|----------|----------|
| GitHub Actions | `Cannot read properties of undefined (reading 'extraneous')` | npm Arborist 分析損壞的 dependency tree |
| Cloudflare | `sh: 1: tsc: not found` | `.bin/tsc` 未建立 |
| Cloudflare (降級 TS5.7) | `error TS2688: Cannot find type definition file for 'node'` | TypeScript 存在但 @types/node 位置錯誤 |

## 修法

| 檔案 | 改動 | 說明 |
|------|------|------|
| `apps/frontend/package.json` | `wrangler deploy` → `npx wrangler deploy` | wrangler 不在 Cloudflare Pages 全域 PATH |
| `apps/frontend/wrangler.jsonc` | `"assets": { "binding": "ASSETS", "source": "./dist" }` → `"assets": { "directory": "./dist" }"` | Pages 格式不適用於 Worker-only 專案 |
| Cloudflare Pages 設定 | 加入 `SKIP_DEPENDENCY_INSTALL=true` | 避免 Cloudflare 自動 npm install 衝突 |
| **核心修法（待做）** | 統一 lockfile 策略 | 移除 pnpm-style entries，確保單一 lockfile |

## 學習（下次怎麼預防）

- ❌ **不要**在 build script 裡刪 `node_modules/typescript`（只是清症狀）
- ❌ **不要**用 `node ../../node_modules/typescript/bin/tsc`（繞過問題）
- ❌ **不要**單純升降 TypeScript 版本（沒解決根本問題）
- ✅ **真正需要回答**：「此 repository 由哪一份 lockfile、在哪一個 workspace root、使用哪一種 package manager」
- ✅ **未來遇到 `tsc: not found` / `npm Arborist crash`**：優先檢查 lockfile 是否含 pnpm-style entries

## 觸發後續動作

- [x] 寫本 feedback
- [ ] 建立新規範 `.cursor/rules/015-cloudflare-pages-deploy.mdc`
- [ ] 更新 `saome-github-deploy/SKILL.md` 加入 Cloudflare Pages 檢查表
- [ ] 統一 lockfile 策略（长期问题，需要额外 spec）
