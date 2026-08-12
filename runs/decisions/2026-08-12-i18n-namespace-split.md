# i18n Namespace Split Decision

## Metadata

- **日期**：2026-08-12
- **作者**：Josh（agent-assisted via Cursor）
- **觸發**：Dashboard renewalReminder debug chain，發現 `en.json` 已達 479 行，單一 `translation` namespace 難以維護
- **規則 / skill 觸發**：`saome-dev-logging`、`saome-methodology-bridge`（L3 Heavy → Decision Log 先出）

---

## 背景

目前的 i18n 結構：
- `src/i18n/locales/en.json` — 479 行，single `translation` namespace
- `src/i18n/locales/zh-TW.json` — 479 行，single `translation` namespace
- `src/i18n/locales/auth.en.json` — 登入/註冊相關，獨立 namespace
- `src/i18n/locales/dashboard.en.json` — Dashboard layout，獨立 namespace
- `src/i18n/locales/passNotification.en.json` — 會員 Pass 通知，獨立 namespace
- `src/i18n/locales/theme.en.json` — 主題切換，獨立 namespace

`translation` namespace 的 479 行涵蓋：
- `nav`、`hero`、`socialProof`、`features`、`cardTypes`、`howItWorks`、`cta`、`pricing`、`footer`、`login`、`product`、`demo`、`pricingCompare`、`legal`

**問題**：
1. `translation` namespace 太龐大，單一檔案難以維護
2. 新增 key 時容易放錯位置（feature 相關的 key 放在 `translation` 而非對應 namespace）
3. `pass-notification` 檔名 vs resources key `passNotification` 的 mismatch（这次 bug 的根本原因之一）
4. 未來 React Native 化時，`translation` namespace 的龐大檔案難以拆分

---

## 決策

### 全面拆分（Full Migration）

**決定**：廢除 `translation` namespace，全面遷移至 feature-based namespace。

**遷移對照表**：

| 現有 top-level key（在 en.json 內） | 新 namespace | 新檔案 |
|---|---|---|
| `nav` | `nav` | `nav.en.json` |
| `hero` | `landing` | `landing.en.json` |
| `socialProof` | `landing` | `landing.en.json` |
| `features` | `landing` | `landing.en.json` |
| `cardTypes` | `landing` | `landing.en.json` |
| `howItWorks` | `landing` | `landing.en.json` |
| `cta` | `landing` | `landing.en.json` |
| `pricing` | `pricing` | `pricing.en.json` |
| `footer` | `landing` | `landing.en.json` |
| `login` | `auth` | `auth.en.json`（已有，可合併） |
| `product` | `landing` | `landing.en.json` |
| `demo` | `landing` | `landing.en.json` |
| `pricingCompare` | `pricing` | `pricing.en.json` |
| `legal` | `legal` | `legal.en.json` |

最終 namespace 清單：
- `auth` — 登入、註冊、表單驗證（已存在）
- `dashboard` — Dashboard layout（已存在）
- `landing` — 登入頁、Landing Page 所有內容
- `legal` — 服務條款、隱私權、DPA
- `passNotification` — Pass 通知（已存在，已修正命名）
- `pricing` — 定價相關
- `theme` — 主題切換（已存在）

---

## 命名規範（新增 Rule 章節）

根據 Decision Log，確定以下命名規範：

1. **namespace key**：必為 camelCase（如 `passNotification`、`landing`、`legal`）
2. **檔名格式**：`{namespace}.{locale}.json`（如 `passNotification.zh-TW.json`）
3. **禁止**：在 namespace key 使用 hyphen（如 `pass-notification`）
4. **檔案位置**：`apps/frontend/src/i18n/locales/`
5. **命名觸發**：任何新增 i18n namespace

---

## 待實作清單

| 項目 | 說明 | 狀態 |
|---|---|---|
| Decision Log | 本檔 | ✅ |
| Rule 更新 | `023-shared-package.mdc` 加 i18n convention | ⏳ pending |
| 遷移 `en.json` 479 keys | 分散至 `landing`、`pricing`、`legal`、`nav` namespace | ⏳ pending |
| 遷移 `zh-TW.json` 479 keys | 同步更新 | ⏳ pending |
| 更新 `i18n/index.ts` | 移除 `translation` namespace import | ⏳ pending |
| Audit component t('...') calls | 確認無殘留 `translation` namespace key | ⏳ pending |
| 同步 `auth.en.json` | 合併現有 `login.*` 和 `auth.*` | ⏳ pending |

---

## 自問

- **下次怎麼不犯？**
  - i18n namespace 命名寫進 rule，新增 namespace 時強制檢查命名
- **哪條 rule 該補？**
  - `023-shared-package.mdc` — 加 i18n namespace convention 章節
- **哪個 test 該加？**
  - i18n smoke test：驗證 production bundle 內每個 namespace 的 key 都可正確解析
