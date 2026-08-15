# 0815-PassTier-Schema-Drift

## Metadata

- **日期**：2026-08-15
- **作者**：Josh（agent-assisted via Cursor）
- **commit hash**：local（尚未 commit）
- **規則 / skill 觸發**：`saome-dev-logging`、`019-schema-contract-drift`

---

## 背景

2026-08-15 早上 exploration subagent 探索 `/app/dashboard` 6 個子頁面結構時，發現一個 P0 schema drift 問題：

| Schema | 值 |
|---|---|
| `packages/shared/schemas/pass.ts` 的 `passTierSchema` | `basic / premium / enterprise` |
| `packages/shared/schemas/auth.ts` 的 `planSchema` | `green / gold / platinum` |
| DB `004_init_passes.sql` CHECK constraint | `green / gold / platinum` |

`passTierSchema` 跟 DB 不一致——這會導致後端 insert/update passes 時，schema 允許的值 DB 不接受，或反過來。

---

## 探針

```bash
# grep 整個 codebase，找誰用 passTierSchema
rg "passTierSchema|pass\.tier|pass\.plan"

# 結果：
packages/shared/schemas/pass.ts:9
  export const passTierSchema = z.enum(['basic', 'premium', 'enterprise']);

apps/backend/src/modules/pass/db/passes.ts:139,150
  plan: pass.plan,

apps/backend/src/modules/pass/routes/confirmPayment.ts:38
  plan: pass.plan,

apps/frontend/src/components/business/dashboard/TrialBanner/useTrialBanner.ts:45
  (pass.plan === 'green' || pass.plan === 'gold' || pass.plan === 'platinum')

packages/shared/logic/pass.ts:73-75
  basic: '基本版',
  premium: '進階版',
  enterprise: '企業版',

packages/shared/i18n/zh-TW.ts:106-108
  basic: '基本版',
  premium: '進階版',
  enterprise: '企業版',

packages/shared/i18n/en.ts:106-108
  basic: 'Basic',
  premium: 'Premium',
  enterprise: 'Enterprise',
```

**DB migration**：

```sql
-- apps/backend/migrations/004_init_passes.sql
plan text NOT NULL CHECK (plan IN ('green', 'gold', 'platinum')),
```

**結論**：`passTierSchema` 是啞巴——只有 2 個地方引用它（`schemas/pass.ts` 自己 + `logic/pass.ts` 的 `getPassTierDisplayName`），而實際 runtime 全部走 `pass.plan` + `auth.ts` 的 `planSchema`。

---

## 根因

**一個 schema、兩個命名**：

- `schemas/auth.ts` 有 `planSchema = z.enum(['green', 'gold', 'platinum'])`，對應 `planSchema` type alias `Plan`
- `schemas/pass.ts` 有 `passTierSchema = z.enum(['basic', 'premium', 'enterprise'])`，對應 `PassTier`

兩者**是同一個東西**，但 enum 值完全不同。

`passTierSchema` 從未被 runtime 實際使用過（backend 沒引用它，frontend 沒引用它），所以 typecheck 一直過，只有 DB migration 會在 runtime fail。

---

## 修法

### 1. 同步 `passTierSchema` 與 DB

```ts
// packages/shared/schemas/pass.ts
// 改前
export const passTierSchema = z.enum(['basic', 'premium', 'enterprise']);

// 改後
export const passTierSchema = z.enum(['green', 'gold', 'platinum']);
```

### 2. 同步 `types/pass.ts`

```ts
// packages/shared/types/pass.ts
// 改前
export type PassTier = 'basic' | 'premium' | 'enterprise';

// 改後
export type PassTier = 'green' | 'gold' | 'platinum';
```

### 3. 同步 `logic/pass.ts` display names

```ts
// packages/shared/logic/pass.ts — getPassTierDisplayName
// 改前
const names: Record<PassTier, string> = {
  basic: '基本版',
  premium: '進階版',
  enterprise: '企業版',
};

// 改後
const names: Record<PassTier, string> = {
  green: '綠卡',
  gold: '金卡',
  platinum: '白金卡',
};
```

### 4. 同步 i18n

```ts
// packages/shared/i18n/zh-TW.ts — pass.tier
// 改前
tier: { basic: '基本版', premium: '進階版', enterprise: '企業版' }
// 改後
tier: { green: '綠卡', gold: '金卡', platinum: '白金卡' }

// packages/shared/i18n/en.ts — pass.tier
// 改前
tier: { basic: 'Basic', premium: 'Premium', enterprise: 'Enterprise' }
// 改後
tier: { green: 'Green Card', gold: 'Gold Card', platinum: 'Platinum Card' }
```

### Verification

| 檢查 | 結果 |
|---|---|
| `npx tsc -b packages/shared` | ✅ exit 0 |
| `npx tsc -p apps/frontend/tsconfig.app.json` | ✅ exit 0（只有 2 個預存在的 unused import 警告） |

---

## 衍生

### 影響的上下游

| 檔案 | 說明 |
|---|---|
| `packages/shared/schemas/pass.ts` | 修正 enum 值 |
| `packages/shared/types/pass.ts` | 同步修正 type |
| `packages/shared/logic/pass.ts` | display names 同步 |
| `packages/shared/i18n/zh-TW.ts` | i18n key 同步 |
| `packages/shared/i18n/en.ts` | i18n key 同步 |
| `auth.ts` 的 `planSchema` | **保持不變**（已正確） |

### 為什麼 `passTierSchema` 之前沒被發現？

因為它**從未被 runtime 引用**——backend 的 `db/passes.ts` 直接拿 DB row 自己組 object，沒有用 `passTierSchema` 做 parse 或 validate。frontend 也沒有用 `PassTier` type 做任何業務邏輯。

這是典型的「定義了但沒使用」的技術債累積。

### 建議後續

- [ ] 搜尋 `PassTier` / `passTierSchema` 的 runtime 使用，確認業務邏輯沒有斷裂
- [ ] 在 `schemas/pass.ts` 加 comment 說明 `passTierSchema` 等同於 `auth.ts` 的 `planSchema`，避免未來又 drift
- [ ] 考慮加一個 shared 常數 `PASS_TIERS = ['green', 'gold', 'platinum'] as const`，讓 `passTierSchema` 和 `planSchema` 都從同一個 source of truth derive

---

## 自問

- **下次怎麼不犯？**
  - DB migration 跑完後，立即 grep schema 定義是否跟 migration 的 CHECK constraint 對齊
  - `passTierSchema` 從未被使用說明：**沒有 coverage = 測試沒有覆蓋**。未來新增 schema 要跑 conformance test。
- **哪條 rule 該補？**
  - `019-schema-contract-drift.mdc`：加一條「DB CHECK constraint 必同步到 zod enum」的強制檢查
- **哪個 test 該加？**
  - `packages/shared/schemas/pass.test.ts`：`passTierSchema` 的 enum 值必須等於 DB CHECK constraint
  - 或在 `019-schema-contract-drift` 的 conformance test 範本裡加這條檢查
