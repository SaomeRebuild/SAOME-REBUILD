# SAOME — 多租戶會員忠誠平台

> **SaaS Loyalty Platform for SMBs** — 讓每家店用 Apple / Google Wallet 經營自己的會員點數、印章、優惠與多租戶後台。

SAOME 是一套多租戶 SaaS，提供：

- **店家後台**：會員管理、卡片設計、印章 / 點數規則、優惠券、報表
- **掃碼面板**：店家員工快速掃碼、發點、扣點、驗證會員
- **消費者 Pass**：Apple Wallet / Google Wallet 內的可重用會員卡
- **Email 整合**：Mailgun 支援 `support_<company_id>@saome.org` 路由
- **付款**：Line Pay 金流（每家公司獨立 channel）
- **多租戶隔離**：每家公司擁有獨立資料、template、API key、cache

目前處於 **前端 MVP 階段**：landing page + i18n 雙語 + 法律頁面（GDPR / Privacy / Terms）已上線。

---

## 線上環境

| 環境 | URL |
|---|---|
| Production（舊版） | https://saome-frontend.josh1989213.workers.dev |
| Branch Preview | https://feat-legal-pages-i18n-saome-frontend.josh1989213.workers.dev |

> Production 部署流程：push 到 `main` → Cloudflare Workers build → 自動 promote 到 production traffic。

---

## 技術棧

| 層 | 技術 |
|---|---|
| Frontend | React 19 + Vite + TypeScript (strict) |
| Styling | Tailwind CSS v4（design token 驅動） |
| i18n | react-i18next（zh-TW + en） |
| Testing | Vitest + React Testing Library |
| Linting | Oxlint |
| Hosting | Cloudflare Workers（`saome-frontend`） |
| Backend | Hono + Cloudflare Workers（規劃中） |
| Database | Supabase Postgres（規劃中） |

---

## Repo 結構

```
SAOME-REBUILD/
├── frontend/                ← React 19 SPA（landing page + 法律頁面 + i18n）
│   ├── src/
│   ├── public/pic/          ← 靜態圖片
│   ├── dist/                ← build 產物（git ignore）
│   ├── package.json
│   ├── wrangler.jsonc       ← 已廢棄，改用 root 版本
│   └── .github/workflows/   ← 第二份 CI workflow（npm-based）
├── backend/                 ← Hono backend（規劃中，目前空）
├── shared/                  ← 共用業務邏輯、types、i18n（規劃中，目前空）
├── design-system/           ← Design tokens MASTER.md
├── specs/                   ← SDD/BDD/TDD 規格
│   ├── features/            ← Gherkin .feature 檔
│   └── spec/<feature>/      ← spec.md + tasks.md
├── DEV/<MM-YYYY>/           ← 每次 session 的開發紀錄
├── .github/workflows/       ← CI workflow（pnpm-based，root）
├── .cursor/
│   ├── rules/               ← Agent rules
│   └── skills/              ← Agent skills
├── runs/                    ← 執行紀錄、改善回饋
├── wrangler.jsonc           ← Cloudflare Workers 設定
└── README.md                ← 本檔
```

---

## 開發流程（給開發者）

```bash
# 安裝
cd frontend
npm install

# 開發（localhost:5173）
npm run dev

# 跑測試
npm test

# Type check
npx tsc --noEmit

# Build
npm run build        # 產出 frontend/dist/

# Deploy（透過 Cloudflare Dashboard，不需手動）
git push origin main
```

---

## 規範與流程

所有變更必須走：

1. **SDD** — `specs/spec/<feature>/spec.md` + `tasks.md`
2. **BDD** — `specs/features/<feature>.feature`（Gherkin 繁中）
3. **TDD** — Vitest 先寫 failing test，再寫 production code
4. **Verification** — `tsc --noEmit` + `vitest run` + 多租戶測試
5. **Cleanup** — Deslop（AI 痕跡黑名單）+ Log 紀律

詳見 `AGENTS.md` + `.cursor/rules/`。

---

## License

Proprietary — © 2026 SAOME