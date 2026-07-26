# 2026-07-27 Supabase Init Schema (Plan D.4)

## Plan
- `saome_monorepo_結構計畫_cd254153` Phase D.4

## 任務
Supabase MCP 跑 init migration，建立 SAOME 業務 schema。

## 探勘結果
- `public` schema 完全空（從未建過）
- `auth.users` 已存在（Supabase built-in）
- `auth.sessions` 已存在
- 既有的 `feat/users-table` branch 自建 `public.users`，owner 確認為實驗用，**本 migration 改用 `public.profiles` 模式**

## Init Schema 設計

### 3 個表

| 表 | 用途 | 跟 auth.users 關係 |
|---|---|---|
| `public.profiles` | 業務 profile（display_name、company_id、role、locale、metadata） | 1:1 FK，trigger 自動建立 |
| `public.app_sessions` | 業務級 sessions（多裝置、user_agent、ip、revoked） | 多對一 FK |
| `public.audit_log` | 業務審計（action / resource / metadata） | nullable FK |

### 命名決策
- 不用 `public.users`（保留給 feat/users-table 實驗）
- 不用 `public.sessions`（避免跟 auth.sessions 混淆）
- `profiles` 為 Supabase 慣例

### 自動 trigger
- `on_auth_user_created`：auth.users INSERT → 自動建 profile
- `set_profiles_updated_at`：UPDATE profiles → 自動更新 updated_at

### RLS（9 條 policy）
| 表 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | self | self | self | — |
| app_sessions | self | self | self | self |
| audit_log | super_admin | self | — | — |

## Verification

```
[✓] 3 tables: profiles (9 cols), app_sessions (9 cols), audit_log (9 cols)
[✓] RLS enabled on all 3
[✓] 9 policies active
[✓] 2 triggers: on_auth_user_created + set_profiles_updated_at
```

## 待辦（之後再做）
- [ ] 跑 `get_advisors` 看有沒有 security warning
- [ ] 跑 `get_logs` 看 migration log 沒 error
- [ ] 測試 signup → 自動建 profile
- [ ] 整合到 `supabase/config.toml` 讓本地 dev 也能用

## 與其他工作項關係
- D.5（第一次完整 deploy）會需要這個 schema 才能跑 auth 流程
- feat/users-table 仍待處理（owner-agent 私房實驗）
