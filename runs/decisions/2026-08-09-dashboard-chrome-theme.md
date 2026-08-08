# Decision Log：Dashboard Chrome + Theme System（RN-friendly）

**日期**：2026-08-09
**範疇**：Dashboard Shell 拆分 + 三狀態 Theme 系統
**決策者**：Agent（依使用者確認的四題決議）

---

## 背景

SAOME-REBUILD 的前端目前只有 marketing 版 Header/Footer（單一 global chrome）。即將擴充 admin/tenant dashboard，需要：
1. Dashboard 頁面不吃 marketing chrome
2. 支援日夜間模式切換，且 toggle 真的可運作
3. 未來 React Native 化時遷移代價最小

四題關鍵架構決策在 plan mode 階段完成。

---

## Q1：Header/Footer 拆分策略

### 選項

| 選項 | 說明 |
|---|---|
| (A) Route-based shell split | 在 `App.tsx` 用 `pathname` 條件 render MarketingShell / DashboardShell |
| (B) Nested `<Route layout>` | 用 React Router v6 nested layout 重組 route tree |
| (C) Replace global Header/Footer | 刪全域，每個 page 自己掛 layout |

### 決定：**(A) Route-based shell split**

**理由**：
- MarketingShell / DashboardShell 的 shell 概念在 RN 完全通用 — RN 化時只要重寫視覺層，業務邏輯零成本
- 條件式 render 不依賴 platform，React Native 化時只改底層 rendering engine
- (B) 的 nested layout 是 `react-router-dom` 專屬，RN 用 `react-navigation` 完全沒這個概念，整個 route tree 要打掉重寫
- (C) 違反 shell 集中管理原則，RN 化時 N 個地方都要改

**RN-friendly 評估**：✅ 最優。Shell 概念通用，未來 RN 化時業務邏輯不需改。

---

## Q2：Theme 系統範圍

### 選項

| 選項 | 說明 |
|---|---|---|
| (A) Dark-only tokens | 只加 light token，toggle 暫時不運作 |
| (B) CSS variables 兩模式（light/dark） | 真的可切換，scope 最小 |
| (C) 3-state system（light/dark/system） | (B) + 支援 OS 偏好偵測 |

### 決定：**(C) 3-state system（light/dark/system）**

**理由**：
- RN 化時 `system` 狀態直接對應 `useColorScheme()`，是 RN 上 OS 偏好的官方答案
- 現在多寫一個 `matchMedia` listener，RN 化時只把底層偵測從 `matchMedia` 換成 `Appearance.addChangeListener`，`useTheme` hook 介面完全不動
- (B) 現在 scope 最小，但 RN 化時要**再改一次** `useTheme`（加 `system` enum + OS 偵測），等於重複實作
- OS 偏好偵測的 React 層邏輯（`useEffect` + `addEventListener` + cleanup）在 web/RN 都可以直接搬

**RN-friendly 評估**：✅ (C) 優於 (B) — RN 化時底層偵測替換，上層介面契約不動。

---

## Q3：ui-ux-pro-max 的角色

### 選項

| 選項 | 說明 |
|---|---|---|
| (A) 補充 MASTER.md | 跑 script，輸出補充 light-mode token 章節，不覆寫已驗證章節 |
| (B) 整體重新生成 | 接受覆寫，高風險 |
| (C) 本輪先不跑 | 用 quick reference，手寫 token 對應 |

### 決定：**(A) 補充 MASTER.md**

**理由**：
- ui-ux-pro-max 的 token 輸出是**平台中立**的（color hex、spacing px、typography spec），跟 web/RN 無關
- 現有章節（typography、spacing、anti-patterns）已驗證通過，不應重洗
- (C) 缺設計語言支撐，未來 RN 上要再補
- (B) 覆寫風險太高，10 個章節漂移

**RN-friendly 評估**：✅ token 輸出是平台中立，RN 化時 token 物件 lookup 方式替換，token 值本身不改。

---

## Q4：Header 導航列日後擴充介面

### 選項

| 選項 | 說明 |
|---|---|---|
| (A) Slot prop + config-driven（`navItems: NavItem[]`） | Header props 帶 nav array，差異化在頁面層 |
| (B) NavContext provider | 用 React Context 跨多層共享 nav config |
| (C) 外部 composition | Header 不接 nav config，nav 放 Header 下方 |

### 決定：**(A) `navItems: NavItem[]` slot prop**

**理由**：
- `NavItem[]` 是**純資料結構**，RN 化時一樣能渲染（`<Pressable>` + `<Text>` + icon），零成本遷移
- dashboard 場景通常只有 top-level layout 跟 nav bar 兩層需要，**不需要** Context 額外複雜度
- (B) 的 Context provider 在 RN 化時多一個 provider 反而是 migration 阻力
- (C) 跟「抽出來」的要求衝突，且 RN 化時「誰擁有誰」的契約會變模糊

**RN-friendly 評估**：✅ NavItem 是純資料結構，RN 化零成本遷移。

---

## 最終決策組合

| # | 問題 | 決議 | RN-friendly |
|---|---|---|---|
| Q1 | Header/Footer 拆分策略 | **(A) Route-based shell split** | ✅ |
| Q2 | Theme 範圍 | **(C) 3-state system** | ✅ |
| Q3 | ui-ux-pro-max 角色 | **(A) 補充 MASTER.md** | ✅ |
| Q4 | Nav 擴充介面 | **(A) `navItems: NavItem[]` slot prop** | ✅ |

---

## 影響

| 影響範圍 | 說明 |
|---|---|
| `apps/frontend/src/App.tsx` | 重構 route，DashboardMarketingShell/DashboardShell 條件 render |
| `apps/frontend/src/index.css` | 拆 `[data-theme=dark]` / `[data-theme=light]` 兩套 token |
| `apps/frontend/src/main.tsx` | `<ThemeProvider>` 包 `<AuthProvider>` |
| `design-system/MASTER.md` | 新增 light-mode token 章節 |
| 新增 18 個檔案 | useStorage / useTheme / ThemeProvider / ThemeToggle / DashboardHeader / DashboardFooter / DashboardShell / MarketingShell |
| i18n | 新增 `theme.*` namespace |

---

## 未來 RN 化路徑

| 元件 | RN 化動作 |
|---|---|
| `useTheme` | `matchMedia` → `Appearance.addChangeListener`；`document.documentElement.dataset.theme` → `StatusBar.setBarStyle()` |
| `useStorage` | `localStorage` → `@react-native-async-storage/async-storage` |
| `DashboardHeader` | 替換 `lucide-react` icon 為 `lucide-react-native`；移除 `window.scrollY` listener（無此 API） |
| CSS token | 從 `var(--color-*)` 替換為 JS token 物件 lookup（token 值不變） |
| Shell 結構 | `<View>` 替代 `<div>`，其餘結構不變 |
