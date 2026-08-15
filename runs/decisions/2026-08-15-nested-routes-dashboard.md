# Nested Routes Decision — Dashboard Sub-pages

## Metadata

- **日期**：2026-08-15
- **作者**：Josh（agent-assisted via Cursor）
- **觸發**：Dashboard 6 個子頁面（charts / card-builder / members / email / billing / settings）全部是 `ComingSoonView` placeholder，需要實作但先確認路由架構
- **規則 / skill 觸發**：`saome-dev-logging`、L2 Standard 任務分流

---

## 背景

2026-08-15 exploration subagent 發現：

- `/app/dashboard/*` 已有 6 條 nested routes（不含 `card-editor`）
- `AppDashboardPage` 是 shell 元件，目前 render 內容但**沒有** `<Outlet />`
- 6 個子頁面各別是獨立 `.tsx`，透過 flat route 掛在 `/app/dashboard` 下

**問題**：
1. 如果不在 `AppDashboardPage` 放 `<Outlet />`，nested routes 的子頁面**無法** render
2. 目前的 routing 看似 nested 但實際上只有 flat routes（6 個子頁面各自獨立，沒有共享 DashboardShell 的 sidebar nav）

---

## 選項

### 選項 A：保持 Flat Routes（现状）

把 6 個子頁面從 `<DashboardShell>` 內的 nested routes 移出，改成：

```tsx
<Route path="/app/dashboard" element={<DashboardShell>...</DashboardShell>} />
<Route path="/app/dashboard/charts" element={<ChartsPage />} />
```

**優點**：
- 實作簡單，不需要在每個子頁面處理 `<Outlet />`

**缺點**：
- 違反 React Router nested routes 語意
- 如果側邊欄要 highlight 當前 active 頁面，需要重複在每個子頁面處理
- 未來加 layout-level state（expanded sidebar、selected tab）時要在每個 route 同步

### 選項 B：採用 Nested Routes + `<Outlet />`

在 `AppDashboardPage` 內加 `<Outlet />`：

```tsx
// AppDashboardPage.tsx
export const AppDashboardPage = () => {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet /> {/* 子頁面 render 在這裡 */}
      </main>
    </div>
  );
};
```

**優點**：
- 符合 React Router nested routes 語意
- Layout-level state（sidebar expanded、active nav）在 shell 內管理
- Sidebar highlight current page 自然達成

**缺點**：
- 需要確保每個子頁面有 `<Outlet />` 才能 render
- 首個 `/app/dashboard` 需要 default child（如 `WelcomeView`）

---

## 決策

**選擇**：選項 B — Nested Routes + `<Outlet />`

**理由**：
1. Dashboard 的 sidebar nav 是一個 layout 元件，**應該**由 shell 管理
2. Nested routes 語意正確，未來加 tabs / breadcrumb / layout-level state 容易
3. `DashboardShell` 已經是 `DashboardShell navItems={[...]} children={<Outlet />}` 的形狀，語意對齊
4. `App.tsx` 第 84-91 行已經是 nested routes 格式，只差 `AppDashboardPage` 沒放 `<Outlet />`

---

## 實作規劃

| 步驟 | 說明 | 狀態 |
|---|---|---|
| 1. `AppDashboardPage` 加 `<Outlet />` | 把 children 換成 `<Outlet />` | ⏳ pending |
| 2. 確認 `/app/dashboard` index route | `WelcomeView` 或 `ComingSoonView` | ⏳ pending |
| 3. 6 個子頁面調整 | 移除重複的 DashboardShell wrapper | ⏳ pending |
| 4. Sidebar nav active state | 從 DashboardShell 內管理 | ⏳ pending |
| 5. Smoke test | 確認每個子頁面正確 render | ⏳ pending |

---

## 影響

- `AppDashboardPage`：從 render children 改為 render `<Outlet />`
- `DashboardShell`：保持不變
- 6 個子頁面（ChartsPage、CardBuilderPage、MembersPage、EmailPage、BillingPage、SettingsPage）：移除各自重複的 DashboardShell wrapper
- `card-editor/`：subagent 提到是孤兒目錄，需確認是否 wire-in 或刪除

---

## 衍生問題

1. **`card-editor/` 是孤兒目錄**：subagent 說 glob 找得到但 Read 拒絕，需要確認磁碟內容
2. **Sidebar active state**：需要在 `DashboardShell` 或 `AppDashboardPage` 管理，取決於 `navItems` 的型別
3. **未來 6 個子頁面的 layout**：目前的 placeholder 是 `ComingSoonView`，未來實作時需要注意與 sidebar 的互動

---

## 自問

- **下次怎麼不犯？**
  - 路由架構在第一個子頁面實作前確認，避免做到一半發現架構不對
- **哪條 rule 該補？**
  - `023-shared-package.mdc` 或 `AGENTS.md`：加 nested routes 實作規範（shell + `<Outlet />`）
- **哪個 test 該加？**
  - routing smoke test：驗證 `/app/dashboard/*` 的 7 條 routes 都能正確 render
