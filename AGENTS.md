# Frontend Agent 守則

> 繼承根目錄 `AGENTS.md` 全部規則，本檔只列補充。

## Self-Improvement（MANDATORY）

任何 session 結束前、同樣的錯第二次出現、或使用者要求反省時，必須引用 `.cursor/skills/saome-self-improvement/SKILL.md`。詳見該 skill。

## New Repo SOP（MANDATORY）

任何新建 saome-* repo（saome-backend / saome-api-worker / saome-postgresql …）時，必須引用 `.cursor/skills/saome-new-repo/SKILL.md`，遵守路徑規則、必含檔案、defensive .gitignore 範本、禁止清單。

## ⚠️ 關於 mu-plugins 的 UI

**禁止沿用 mu-plugins 的任何 UI 內容**：
- ❌ 視覺風格（顏色、字型、版面、互動模式）
- ❌ CSS class 命名（.saome-* 等）
- ❌ jQuery / WP 互動模式
- ❌ shadcn / UI lib 元件選擇（必須透過 ui-ux-pro-max 評估後才能定）
- ❌ Tailwind class 組合（必須等 design token 規範）

UIUX 風格尚未定案，所有 UI 元件必須：
1. 先跑 `.cursor/rules/uiux/010-uiux-pro-max.mdc` 流程
2. 等 design system 完成後才能開始寫元件

詳見 `.cursor/rules/005-reference-mu-plugins.mdc`。

## ⚠️ Design System

所有 UI 決策以 `design-system/MASTER.md` 為源頭。

## 技術棧
- React 19 + Vite + TypeScript（strict）
- Tailwind CSS + shadcn/ui + Radix UI（需 ui-ux-pro-max 評估後才能定）
- TanStack Query（server state）
- Zustand（client state，僅小範圍）
- react-i18next（zh-TW + en）
- Storybook（元件文件）
- Vitest + React Testing Library（單元測試）

## 5 層元件分層（MANDATORY）

| Level | 位置 | 範例 |
|-------|------|------|
| L1 UI 元件 | `frontend/src/components/ui/` | `<Button>`, `<TextField>`, `<Modal>` |
| L2 業務元件 | `frontend/src/components/business/<scope>/<Name>/` | `<MemberCard>`, `<LinePayCheckoutButton>` |
| L3 Layout | `frontend/src/components/layout/` | `<Header>`, `<Sidebar>`, `<PageShell>` |
| Hooks | `frontend/src/hooks/` | `useAuth`, `usePermission`, `useTableQuery` |
| 服務層 | `frontend/src/services/`（BFF 用） | `passService`, `emailService` |

## 模組化結構（MANDATORY）

每個業務元件是**一個資料夾**：

```
components/business/<scope>/<Name>/
├── index.ts
├── <Name>.tsx              ← 主組件（<= 100 行，只做組裝）
├── <Name>Header.tsx        ← sub-component
├── <Name>Stats.tsx
├── <Name>Actions.tsx
├── <Name>Skeleton.tsx
├── <Name>.types.ts
├── <Name>.hooks.ts
├── <Name>.test.tsx
└── <Name>.stories.tsx
```

詳見 `.cursor/rules/000-modular-design.mdc` 與 `.cursor/rules/frontend/022-component-reuse.mdc`。

## Config 結構（MANDATORY）

```
apps/frontend/src/config/
├── index.ts            ← 對外暴露
├── env.ts              ← 環境變數 + zod 驗證
├── api.ts              ← API 設定
├── routes.ts           ← 路由常數
├── features.ts         ← feature flags
├── limits.ts           ← 業務限制
└── constants.ts        ← 角色、狀態、事件
```

詳見 `.cursor/rules/000-dynamic-config.mdc`。

## shared Package 邊界（MANDATORY）

apps/frontend/ **只能放 Web 特定內容**。所有可共用的程式碼必須在 `packages/shared/`：
- ✅ TypeScript 介面、zod schemas、業務邏輯純函式、常數、API contracts、i18n 翻譯檔
- ❌ 禁止在 apps/frontend/ 內寫任何可共用的業務邏輯
- ❌ 禁止在 apps/frontend/ 直接呼叫 `fetch` / `localStorage`
- 詳見 `.cursor/rules/frontend/023-shared-package.mdc`

## Mobile Future-Proof（MANDATORY）

為未來 React Native 化預先準備。每個 PR 必須能回答「換成 RN 需要改什麼？」：
- 業務邏輯在 packages/shared/，RN 化零成本遷移
- ❌ 禁止在 component 內寫業務邏輯
- ❌ 禁止直接使用 Web-only API（localStorage、IntersectionObserver 等）
- 詳見 `.cursor/rules/frontend/024-mobile-future-proof.mdc`

## RWD（MANDATORY）

所有 UI 必須 mobile-first：
- 預設 mobile 樣式，用 Tailwind breakpoint 增強
- 觸控目標 ≥ 44pt（mobile）
- 文字 ≥ 14px（mobile）
- DataTable 在 mobile 改用卡片列表
- 詳見 `.cursor/rules/uiux/013-rwd.mdc` 與 `014-breakpoints.mdc`

## 強制檢查
- ✅ 任何 UI 字串必走 i18n key，禁止 hard-code
- ✅ 任何互動元件必有對應 Storybook + test
- ✅ 任何 icon 必用 Lucide SVG，禁用 emoji
- ✅ 任何顏色 / spacing 必用 design token，禁用 hard-code hex
- ✅ 任何新 UI 必須先檢查 `components/ui/` 與 `components/business/` 是否有可重用元件
- ✅ 禁止在 component 內寫業務邏輯（拆到 hook 或 service）
- ✅ 禁止跨層引用（L2 不可直接修改 L1；改成變體擴充）

## 變更既有元件
- L1（shadcn 元件）可改，但改完更新 `design-system/MASTER.md`
- L2（業務元件）需在 PR 描述說明影響範圍
- 任何 breaking change 必須走 `001-methodology.mdc` 的 SDD 流程

## 禁止
- ❌ 沿用 mu-plugins 的 UI 風格（**重複強調**）
- ❌ 寫死任何顏色 / 字型 / 間距值
- ❌ 跳過 ui-ux-pro-max 直接寫 UI 元件
