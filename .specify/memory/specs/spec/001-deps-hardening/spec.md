# Spec 001：依賴硬化

## 目標
- 讓 `package-lock.json` 永遠含全平台 native binding metadata
- 消除 Dependabot 5 個 open alert（#7、#8、#9、#10、#11）
- self-improvement push 政策從二極化改為「規範/操作/私人」三層分級

## 範圍

IN SCOPE：
- `apps/frontend/package.json`（overrides + react-router bump）
- `package-lock.json` 重新生成
- `.github/dependabot.yml`（新增）
- `.github/workflows/*.yml`（加 audit step）
- `.cursor/rules/015-cloudflare-pages-deploy.mdc`（補強跨平台 binding 錯誤表象）
- `.cursor/rules/006-verification.mdc`（補強 package.json/lockfile SOP 列）
- `.cursor/rules/016-config-and-tsconfig-discipline.mdc`（新增第 8 surface）
- `.cursor/skills/saome-github-deploy/SKILL.md`（前置 audit + 3 條 binding 錯誤表象）
- `.cursor/skills/saome-self-improvement/SKILL.md`（trigger #6 + Step 3 三層決策表）
- `runs/improvements/INDEX.md`（新增）

OUT OF SCOPE：
- `packages/shared/*`（本次不動）
- 其他 saome-* repo（saome-backend / saome-api 等）
- `constitution.md` 原則層（不變更）
- `apps/frontend/src/components/business/*` 元件層（不動）

## 驗收標準
- [ ] `npm audit --audit-level=high`：0 vulnerabilities
- [ ] `npm install --include=optional` 在 Windows 與 Linux 都成功
- [ ] `node scripts/audit-lockfile-bindings.cjs` exit 0（10 個關鍵 Linux binding 全 present）
- [ ] GitHub Actions lint + test + build 全綠
- [ ] Cloudflare Pages deploy 成功
- [ ] Dependabot 自動 PR 設定啟用（至少 `npm` ecosystem weekly）
- [ ] `.cursor/rules/015-cloudflare-pages-deploy.mdc` 含「跨平台 native binding 缺失」錯誤表象表
- [ ] `.cursor/skills/saome-self-improvement/SKILL.md` Step 3 含三層決策表
- [ ] `.gitignore` 鎖住私人層（DEV / projects / .cursor 個人狀態）
- [ ] `runs/improvements/INDEX.md` 列出本週全部 feedback
