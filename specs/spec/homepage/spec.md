# spec: Homepage

> SAOME 官網首頁（靜態行銷頁，無後端 API）

---

## 0. Metadata

| 欄位 | 值 |
|---|---|
| Feature | Homepage |
| Owner | `@agent` |
| Status | Implemented |
| Created | 2026-07-26 |
| Spec-Kit Tag | - |
| Mu-Plugins 追溯 | N/A（純行銷頁，無商業邏輯） |

---

## 1. 設計原則檢查（Phase 0）

### 1.1 模組化
- 各元件行數皆低於 200 行上限
- Hero.tsx（163 行）、SocialProof.tsx（59 行）、Features.tsx（106 行）、HowItWorks.tsx（67 行）、CardTypes.tsx（156 行）、CTASection.tsx（43 行）、PricingSection.tsx（152 行）
- folder-per-feature：所有元件在 `components/home/` + `components/pricing/`
- 跨模組依賴：shared（i18n、constants）← frontend，無反向

### 1.2 動態化
- 所有 UI 文字走 i18n key，無 hardcode
- 無店家可自訂常數（N/A，公開行銷頁）
- 無系統統一常數（N/A）
- 無 env 變數（N/A）

### 1.3 依賴方向
- frontend → shared（i18n）✅
- frontend ↔ backend ❌（無後端依賴）
- 可共用邏輯已走 shared ✅

---

## 2. EARS 需求

### 2.1 Functional Requirements
- UBIQUITOUS：系統根據目前語言設定（zh-TW / en）正確渲染所有 UI 文字
- UBIQUITOUS：系統依賴 design tokens（CSS variables）渲染所有視覺樣式
- UBIQUITOUS：所有 CTA 按鈕正確連結至對應頁面（/register、/demo、/pricing/compare）

### 2.2 Non-Functional Requirements
- 效能：首屏 LCP < 2.5s（純靜態，無 API）
- 安全：無 API、無資料蒐集，無安全影響
- 多租戶：N/A（公開頁面）
- i18n：zh-TW + en 雙語完整

### 2.3 Out of Scope
- 會員註冊流程（→ /register）
- 會員登入流程（→ /login）
- 實際影片播放（DemoPage 尚未實作）

---

## 3. I/O 契約

### 3.1 Input
| 欄位 | 型別 | 來源 | 必填 |
|---|---|---|---|
| 目前語言 | 'zh-TW' \| 'en' | i18n context | ✅ |

### 3.2 Output
N/A（純客戶端渲染，無 API）

### 3.3 Error Codes
N/A

---

## 4. 多租戶影響

N/A（公開行銷頁，無多租戶資料隔離需求）

---

## 5. i18n 影響（MANDATORY）

| Key | zh-TW | en |
|---|---|---|
| `hero.*` | ✅ 完整 | ✅ 完整 |
| `socialProof.*` | ✅ 完整 | ✅ 完整 |
| `features.*` | ✅ 完整 | ✅ 完整 |
| `cardTypes.*` | ✅ 完整 | ✅ 完整 |
| `howItWorks.*` | ✅ 完整 | ✅ 完整 |
| `cta.*` | ✅ 完整 | ✅ 完整 |
| `pricing.*` | ✅ 完整 | ✅ 完整 |
| `nav.*` | ✅ 完整 | ✅ 完整 |
| `footer.*` | ✅ 完整 | ✅ 完整 |

---

## 6. 商業邏輯來源

N/A（純行銷頁，無商業邏輯引擎對應）

---

## 7. BDD 場景對應（MANDATORY）

對應 `frontend/src/test/bdd/homepage.test.tsx`：

| 場景 ID | 場景名稱 | 對應 vitest file | 對應 it() |
|---|---|---|---|
| sc01 | 桌面顯示 Logo + 三個導航連結 + 登入 + 開始使用 | Header.test.tsx | `sc01: 桌面顯示 Logo...` |
| sc02 | 手機裝置只顯示 Logo 與 Hamburger | Header.test.tsx | `sc02: 手機裝置...` |
| sc03 | 點擊 Logo 導航回首頁 | Header.test.tsx | `sc03: 點擊 Logo...` |
| sc04 | 點擊 Header 開始使用導航至 /register | Header.test.tsx | `sc04: 點擊 Header...` |
| sc05 | 滾動時顯示陰影與半透明白色背景 | Header.test.tsx | `sc05: 滾動時...` |
| sc06 | 開啟手機選單後 body overflow 鎖定 | Header.test.tsx | `sc06: 開啟手機選單...` |
| sc07 | 關閉手機選單後 body overflow 恢復 | Header.test.tsx | `sc07: 關閉手機選單...` |
| sc08 | 顯示 Badge + 標題 + 副標題 + 雙 CTA | Hero.test.tsx | `sc08: 顯示 Badge...` |
| sc09 | 顯示標題 + 4 個 Feature Cards | Features.test.tsx | `sc09: 顯示標題...` |
| sc10 | 顯示標題 + 4 步驟 | HowItWorks.test.tsx | `sc10: 顯示標題...` |
| sc11 | 顯示 3 個定價方案卡片 | PricingSection.test.tsx | `sc11: 顯示 3 個定價方案...` |
| sc12 | 3 個 CTA 按鈕皆連結到 /register | PricingSection.test.tsx | `sc12: 3 個 CTA...` |
| sc13 | 顯示標題 + 副文字 + CTA 按鈕 | CTASection.test.tsx | `sc13: 顯示標題...` |
| sc14 | 顯示完整頁尾資訊 | Footer.test.tsx | `sc14: 顯示完整頁尾資訊` |
| sc15 | 點擊 Footer 隱私權政策導航至 /privacy | Footer.test.tsx | `sc15: 點擊 Footer...` |
| sc16 | 預設語言為繁體中文（zh-TW） | homepage.test.tsx | `sc16: 預設語言為繁體中文...` |

---

## 8. 模組化邊界（MANDATORY）

| 檔案類型 | 數量 | 位置 | 備註 |
|---|---|---|---|
| React component | 9 | `components/home/` + `components/pricing/` | 每檔 < 200 行 |
| Vitest test | 8 | `components/*/*.test.tsx` + `test/bdd/` | |
| i18n keys | 9 namespaces | `frontend/src/i18n/locales/` | zh-TW + en |

---

## 9. 動態化策略

| 寫死嫌疑 | 改為 |
|---|---|
| 所有 UI 文字 | `t('i18n.key')` ✅ 已實作 |
| 所有顏色/間距 | `var(--color-*)` ✅ 已實作 |
| 路由字串 | `to="/register"` ✅ 已實作 |

---

## 10. 安全影響

N/A（無 API、無資料處理）

---

## 11. 任務拆解

| Phase | Task | 預估時間 |
|---|---|---|
| - | 建立 spec.md + tasks.md | 15 min |
| - | 建立 BDD homepage.test.tsx | 20 min |
| - | 建立各元件 unit test | 30 min |
| **總計** | | **~65 min** |

---

## 12. Verification 計畫

- [x] `tsc --noEmit` 0 error
- [x] `vitest run` 全綠
- [x] i18n 雙語完整
- [x] Deslop 檢查

---

## 13. 變更紀錄

| 日期 | 作者 | 變更 |
|---|---|---|
| 2026-07-26 | @agent | 初版建立（對齊既有實作） |
