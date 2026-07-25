# BDD 場景對應整合測試

> 對應 `specs/features/homepage/homepage.feature` 的 Gherkin 場景。
> 執行位置：`frontend/src/test/bdd/homepage.test.tsx`
> 執行指令：`cd frontend && npm test -- src/test/bdd`

## 為什麼 test 在 frontend/src 內

因為 `specs/tests/` 需要獨立的 tsconfig + 路徑 alias 設定，目前 workspace 結構是 `frontend/` 為單一 vitest 根目錄。為了避免複雜化，將 BDD 場景對應的整合測試放在 `frontend/src/test/bdd/`。

## 對應關係

| Gherkin 場景 | 測試 ID | 內容 |
|-------------|---------|------|
| Header 桌面顯示 | sc01 | Logo + 三個導航 + 登入 + 開始使用 |
| Header 手機 Hamburger | sc02 | Open menu 按鈕 |
| Logo 導航回首頁 | sc03 | Logo href="/" |
| 「開始使用」→ /register | sc04 | CTA href="/register" |
| 滾動顯示陰影 | sc05 | scroll event 觸發 |
| 手機選單鎖定 scroll | sc06, sc07 | body overflow 切換 |
| Hero Badge + 標題 + CTA | sc08 | 所有 Hero 元素 |
| Features 4 cards | sc09 | 4 個 Feature Cards |
| HowItWorks 3 步驟 | sc10 | 3 個 Step Cards |
| Pricing 3 方案 | sc11, sc12 | 3 個 PricingCard + CTA |
| CTA Section | sc13 | 標題 + 副文字 + CTA |
| Footer 完整 | sc14, sc15 | 5 links + Email + 3 social + 3 legal |
| i18n 預設繁中 | sc16 | Footer 文字為繁體中文 |

## 後續行動

未來若要跑 cucumber 框架（Gherkin 原生），可：
1. 升級 `frontend/package.json` 加入 `@cucumber/cucumber`
2. 設定 vitest cucumber 整合（如 `vitest-cucumber`）
3. 將 `homepage.test.tsx` 轉成 `homepage.steps.ts`（cucumber step defs）
