# TrialBanner i18n namespace + layout overlay Bug

## Metadata

- **日期**：2026-08-08
- **作者**：cursor-agent
- **觸發**：用户在 dashboard 看到 TrialBanner 文字显示原始 key（「trialBanner.title」）而非翻译中文，且 Banner 被 Header 压住

## 症狀

- **環境**：dev (localhost:5173)
- **觸發條件**：登录后进入 `/app/dashboard`，租户 `pass.plan === 'green'`
- **觀察到的錯誤**：
  1. i18n — DOM 内显示 `trialBanner.title`、`trialBanner.subtitle`、`trialBanner.cta` 等原始 key，非翻译文字
  2. 样式 — Yellow TrialBanner 与绿色 Header 完全重叠，文字被 Header 挡住
- **預期 vs 實際**：
  - 预期：显示「試用期還剩 13 天」等中文
  - 实际：显示 `trialBanner.title`

## 探針 / 重現

```bash
node tests/probe/probe-trial-banner.mjs
```

**probe 输出（修复前）**：
```
✅ FOUND! aria: trialBanner.ariaLabel 2026-08-20T23:15:38.040Z
   text: trialBanner.title |  | trialBanner.subtitle |  | trialBanner.cta
```

**probe 输出（修复后）**：
```
✅ FOUND! aria: 試用期剩餘 13 天 2026-08-20T23:15:38.040Z
   text: 試用期還剩 13 天 |  | 完成驗證並綁定信用卡，避免試用期結束後服務中斷 |  | 立即驗證並綁定信用卡
```

## 根因（2026-08-08 補充）

**i18n + layout**：見上方原始記錄。

**pass 狀態未寫入 AuthProvider**：
1. `useAuth.refresh()` 呼叫 `authService.refresh()`（有回傳 `pass`），但只寫了 `accessToken` / `expiresAt` 到 state，`pass` 完全被忽略
2. page reload → AuthProvider mount → 跑 mount-time `refresh()` → state 仍然是 `pass: null` → TrialBanner 看不見 pass → `visible = false`
3. commit `c76d992` 修了 `useAuth.refresh()` 加 `pass: refreshed.pass ?? s.pass`

**TrialBanner 商業邏輯錯誤**：
- `useTrialBanner.visible` 原本只接受 `plan === 'green'`
- `ppp@hotmail.com` 是 `gold` plan → 邏輯上「正確」地被隱藏
- 但商業邏輯：所有 plan 都有 14 天試用期 → 改為接受 `green | gold | platinum`
- commit `a39a379` 修了這條

## 修法

### i18n + layout（2026-08-08 上午）

| 檔案 | 變更 |
|------|------|
| `src/i18n/locales/dashboard.zh-TW.json` | **新建** — dashboard namespace 繁中翻譯 |
| `src/i18n/locales/dashboard.en.json` | **新建** — dashboard namespace 英文翻譯 |
| `src/i18n/index.ts` | 加入 `dashboard` namespace 載入 |
| `TrialBanner.tsx` | `useTranslation('auth')` → `useTranslation('dashboard')` |
| `auth.zh-TW.json` | 移除多餘的 `dashboard` block |
| `auth.en.json` | 移除多餘的 `dashboard` block |
| `AppDashboardPage.tsx` | `p-4` → `p-4 pt-16`（給 fixed Header 騰空間） |
| `AdminDashboardPage.tsx` | 加入 `<div className="p-4 pt-16">` 包裝（同樣問題） |

### pass state + 商業邏輯（2026-08-08 上午）

| 檔案 | 變更 | commit |
|------|------|--------|
| `apps/frontend/src/hooks/useAuth.tsx` | `refresh()` 加 `pass: refreshed.pass ?? s.pass` | `c76d992` |
| `apps/backend/src/contracts/auth.ts` | `RefreshResponseDto` 加 `pass?: PassDto \| null` | `c76d992` |
| `useTrialBanner.ts` | `visible` 接受 `green \| gold \| platinum` | `a39a379` |
| `TrialBanner.types.ts` | 移除 `plan` 必填欄位 | `a39a379` |
| `AppDashboardPage.tsx` | 移除 `<TrialBanner plan="green">` 改為不傳 plan | `a39a379` |

## 衍生

- `AdminDashboardPage` 有同样的 Header overlay 问题，已一并修复
- 用户截图显示 13 天试用期 banner + Header + ComingSoonCard 三层正确堆叠

## 自問

- **下次怎麼不犯？**
  - i18n namespace 必须与文件路径对齐 —— `TrialBanner` 在 `components/business/dashboard/` 下，翻译文件应为 `dashboard.zh-TW.json`，非混在 `auth.zh-TW.json`
  - 新增 i18n key 前先检查 namespace 现状，避免 flat JSON nesting 问题
  - **pass state**：任何在 `authService.*()` 回傳了某個 field，但 consumer 只用了部分時，要立刻懷疑「有沒有漏寫 state」。建議：每次改 `authService` 回傳值時，同步檢查 `useAuth.tsx` 內所有使用它的地方。
  - **商業邏輯假設**：寫 component 前要先跟使用者確認「所有 plan 都適用的商業邏輯」是什麼，而不是自己推斷。
  - **DB data probe**：遇到「邏輯看起來沒問題但就是不行」，立刻用 Supabase MCP `execute_sql` 查 DB 實際資料，別猜。
- **哪條 rule 該補？**
  - `frontend/023-shared-package.mdc` 应补充 i18n namespace 拆分规则：feature 相关翻译必须独立 namespace 文件
  - `000-modular-design.mdc` 應補充：Hono service 回傳的 DTO，每個 field 都必須被 consumer 實際使用；unused field = drift 訊號。
- **哪個 test 該加？**
  - `TrialBanner.test.tsx` 应加 i18n rendering 测试，验证 key 翻译而非显示原始 key
  - `useAuth.test.tsx`：加 `refresh()` 更新 `pass` 的測試，驗證 `pass` 在 `refresh()` 後正確寫入 state（用 mock `authService.refresh()`）
  - `useTrialBanner.test.tsx`：加 `gold` / `platinum` plan 的 `visible = true` 測試

---

> 撰寫者：cursor-agent ｜ 時間：2026-08-08
