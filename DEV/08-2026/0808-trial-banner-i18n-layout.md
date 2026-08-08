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

## 根因

**i18n 問題**：两个独立原因叠加：
1. `TrialBanner.tsx` 用 `useTranslation('auth')` 但 dashboard 翻译实际在 `auth.zh-TW.json` 的 `dashboard.trialBanner.*` nested key 下（flat JSON 无 nesting）
2. 后续在 `auth.zh-TW.json` 追加 `dashboard` block，但 `auth` namespace 的 flat JSON 格式导致 `t('trialBanner.title')` 找不到 `dashboard.trialBanner.title`

**根本解法**：
- 创建独立 `dashboard.zh-TW.json` + `dashboard.en.json`（dashboard namespace）
- `TrialBanner.tsx` 改用 `useTranslation('dashboard')`
- `i18n/index.ts` 加入 dashboard namespace 载入

**layout 問題**：`Header.tsx` 是 `position: fixed; top-0; z-50`，`AppDashboardPage` 最外层无 top padding，内容被 Header 覆盖。

## 修法

| 檔案 | 變更 |
|------|------|
| `src/i18n/locales/dashboard.zh-TW.json` | **新建** — dashboard namespace 繁中翻译 |
| `src/i18n/locales/dashboard.en.json` | **新建** — dashboard namespace 英文翻译 |
| `src/i18n/index.ts` | 加入 `dashboard` namespace 载入 |
| `TrialBanner.tsx` | `useTranslation('auth')` → `useTranslation('dashboard')` |
| `auth.zh-TW.json` | 移除多餘的 `dashboard` block |
| `auth.en.json` | 移除多餘的 `dashboard` block |
| `AppDashboardPage.tsx` | `p-4` → `p-4 pt-16`（给 fixed Header 腾空间） |
| `AdminDashboardPage.tsx` | 加入 `<div className="p-4 pt-16">` 包装（同样问题） |

## 衍生

- `AdminDashboardPage` 有同样的 Header overlay 问题，已一并修复
- 用户截图显示 13 天试用期 banner + Header + ComingSoonCard 三层正确堆叠

## 自問

- **下次怎麼不犯？**
  - i18n namespace 必须与文件路径对齐 —— `TrialBanner` 在 `components/business/dashboard/` 下，翻译文件应为 `dashboard.zh-TW.json`，非混在 `auth.zh-TW.json`
  - 新增 i18n key 前先检查 namespace 现状，避免 flat JSON nesting 问题
- **哪條 rule 該補？**
  - `frontend/023-shared-package.mdc` 应补充 i18n namespace 拆分规则：feature 相关翻译必须独立 namespace 文件
- **哪個 test 該加？**
  - `TrialBanner.test.tsx` 应加 i18n rendering 测试，验证 key 翻译而非显示原始 key

---

> 撰寫者：cursor-agent ｜ 時間：2026-08-08
