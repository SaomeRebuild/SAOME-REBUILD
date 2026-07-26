# 2026-07-27 Cloudflare Pages 設定修正

## 觸發
Cloudflare Pages dashboard 訊息：
> Wrangler configuration file changed
> 在您的存放庫中更新 `wrangler.jsonc`，以保持一致的設定。
> `"name": "saome-frontend"`

意思是 — CF Pages project name `saome-frontend` 跟檔案裡 `SAOME-REBUILD` 不一致，請同步。

## 修的檔案
`wrangler.jsonc`（repo root）：

| 欄位 | 改前 | 改後 | 理由 |
|---|---|---|---|
| `name` | `SAOME-REBUILD` | `saome-frontend` | 跟 CF Pages project 一致 |
| `compatibility_flags` | `["nodejs_compat"]` | （移除） | 純前端 SPA 不需 Node compat |
| `assets.directory` | `./apps/frontend/dist` | 同 | 維持（CLI 從 root 跑仍正確） |
| `assets.not_found_handling` | `single-page-application` | 同 | React Router 需要 |
| `compatibility_date` | `2026-07-26` | 同 | 維持 |

## CF Pages Dashboard 應填（給 owner-agent 在 UI 點）

| 欄位 | 值 |
|---|---|
| Project name | `saome-frontend`（已建） |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `apps/frontend` |
| Node version | `20` |
| Environment variables | （無，純前端） |

**為什麼 `Build output = dist` 但 wrangler.jsonc 寫 `./apps/frontend/dist`**：
- Dashboard 的 Build output 是**相對** Root directory 的路徑
- Root dir = `apps/frontend`，所以 build output = `dist`（在 apps/frontend/dist 底下）
- wrangler.jsonc 寫絕對路徑 `./apps/frontend/dist`，給 CI / 直接跑 `wrangler pages deploy` 從 root 用的場景

兩個不衝突，看從哪個 entry point 跑。

## 驗證
- `npm run build` in `apps/frontend` → 產出 dist/ ✓
  - index.html (653B)
  - assets/index-DN15KfE2.css (24.87 kB)
  - assets/index-dI-ZpywL.js (415.76 kB)
  - assets/stampCardLiviing-...png (196 kB)
  - favicon.svg + icons.svg + pic/
- 1846 modules transformed
- 1.54s build time

## Commit
`fix(pages): align wrangler.jsonc name with CF Pages project (saome-frontend)`
