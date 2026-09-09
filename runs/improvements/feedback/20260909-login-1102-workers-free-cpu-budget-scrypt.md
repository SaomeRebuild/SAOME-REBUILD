---
title: "2026-09-09 Login 1102 (CPU Exceeded) — Workers Free Plan × scrypt N=16384 不相容 + 一次性 hash migrate"
date: 2026-09-09
type: bug-trace
scope: auth/login-cpu-budget
status: resolved
severity: SEV-1
accounts_affected:
  - admin@saome.org
  - eason1989213@gmail.com
  - ppp@hotmail.com
related:
  - runs/improvements/feedback/20260727-backend-db-migrations.md
  - runs/improvements/feedback/20260728-admin-login-scrypt-mismatch.md
  - runs/improvements/feedback/20260808-admin-login-6-bug-chain-index.md
  - apps/backend/src/shared/lib/password.ts
  - apps/backend/scripts/hash-admin.mjs
---

# 2026-09-09 Login 1102 — Workers Free × scrypt N=16384

## TL;DR

Backend 跑在 **Cloudflare Workers Free plan**，每個 request **CPU 預算只有 10ms**。SAOME 從第一天起就用 `scrypt(N=16384, r=8, p=1)` 算 password hash，這組參數在 Workers V8 isolate 上**單次**就需要 **30-100ms**——任何嘗試 verify legacy hash 的 login request **100% 觸發 HTTP 1102 (CPU Exceeded)**，前端看到 CORS drop 等同「login 沒反應」。

修法（已執行）：直接 `UPDATE users SET password_hash = <new N=1024 hash>` 把 3 個現存帳號換成低 CPU 的 N=1024 hash。Login 走 fast path (~5ms CPU)，不再爆 1102。

**未根本解決**：未來任何 register 流程如果又把 hash 改成高 N、或有新的 legacy seed 進來，問題會復發。

---

## 症狀

| 觀察點 | 結果 |
|---|---|
| 前端送 POST `/api/auth/login` | Network tab 看 request 送出去，**沒 response**（silent CORS drop）|
| 後端 wrangler tail | 看不到這筆 request 進入 Hono（runtime 在進 fetch handler 前就 emit 1102）|
| Hyperdrive / DB `login_attempts` | 沒新增 row（request 沒到 loginService）|
| 已驗證的 3 個帳號 | 全部 1102（admin + 2 個 tenant）|
| 前端 dev console | `TypeError: Failed to fetch` 或 `net::ERR_FAILED` |

`login_attempts` 沒新增 row 是這次 trace 的關鍵線索：1102 在 worker runtime 層就 emit，**根本沒進 Hono middleware chain**。

---

## 根因 trace

### Workers Free Plan CPU 預算

| Plan | CPU limit / request | 月費 |
|---|---|---|
| **Free** | **10 ms** | $0 |
| Paid ($5/month 起) | 30 s | $5 + usage |

SAOME backend 跑 Free plan——這個選擇是 2026-08 那時做的（無 card 處理費用、預算控管）。**當時沒意識到 CPU-bound crypto 會撞牆**。

### scrypt 成本

```
N=16384, r=8, p=1
working set ≈ 128 * r * N = 128 * 8 * 16384 = 16 MiB
在 Workers V8 isolate 上單次呼叫：30-100 ms (看 cold/warm isolate)
```

```
N=1024, r=8, p=1
working set ≈ 128 * 8 * 1024 = 1 MiB
在 Workers V8 isolate 上單次呼叫：3-5 ms
```

### 為什麼 verifyPassword 的 legacy fallback 救不了 legacy hash？

`password.ts::verifyPassword` 設計是：

```typescript
// 1. 先試 N=1024 (current)
let actual = scryptSync(password, salt, KEY_LEN, SCRYPT_OPTS);  // ~5 ms
if (match) return true;

// 2. fallback 試 N=16384 (legacy)
let legacy = scryptSync(password, salt, KEY_LEN, SCRYPT_OPTS_LEGACY);  // ~50 ms
return match;
```

對 **legacy hash 的帳號**（N=16384）來說：

1. 第 1 次 N=1024 嘗試 → 必然 fail（hash 格式對不上）→ **浪費 5 ms**
2. 第 2 次 N=16384 嘗試 → 必然成功 → **再加 50 ms**
3. 總計 **~55 ms**，**鐵定超 10 ms** → 1102

也就是說，**legacy fallback 在 Free plan 上本身就是個陷阱**——它讓 verifyPassword 「語意上能驗 legacy hash」，但 runtime 根本沒機會回傳 response。寫程式碼的人會覺得有 fallback 就安全，實際上 fallback 永遠跑不到 return statement。

### 為什麼 admin seed hash 是 N=16384？

追到 `20260728-admin-login-scrypt-mismatch.md` Bug-4b：

> `apps/backend/src/shared/lib/password.ts` 用 `N=131072 r=8 p=1` 但 seed migration `003_seed_admin.sql` 的 hash 是 `N=16384 r=8 p=1`，當時的修法是**改程式碼 match seed**（改用 N=16384），**不是改 seed match 程式碼**——因為 seed hash 是當下唯一能驗證 admin 能登入的方法。

之後所有 register 流程都沿用 N=16384，直到後來（2026-09 月初）有 commit 把 N 調到 1024，但**沒 rehash 任何現存帳號**——這就是現在的狀態。

---

## 修法（已執行）

### Step 1: 用 `hash-admin.mjs` 生成 N=1024 hash（每個帳號一個）

```bash
cd apps/backend
node scripts/hash-admin.mjs 'www123123'
# → scrypt$0a8a918ec8abe93e0d7cb1351de95953$fafdb22ebe... (168 chars)
node scripts/hash-admin.mjs 'www123123'
# → scrypt$c47cce808339b62bca318dd1f22e8ab8$1a0a70d4f5...  (每 run salt 不同)
node scripts/hash-admin.mjs 'Qwww123123!'
# → scrypt$35f3fe0bd0844280e5337e82d54c4f4a$07d9f6824d...
```

**為什麼 3 個 hash 都不一樣**：scrypt salt 每次 random 16 bytes，同密碼也會產出不同 hash。這是正確的——避免 hash collision 成為攻擊面。

### Step 2: 用 `saome_supabase-execute_sql` 直接 UPDATE（沒走 migration 檔）

```sql
UPDATE users SET password_hash = 'scrypt$0a8a918e...$...' WHERE email = 'eason1989213@gmail.com';
UPDATE users SET password_hash = 'scrypt$c47cce80...$...' WHERE email = 'ppp@hotmail.com';
UPDATE users SET password_hash = 'scrypt$35f3fe0b...$...' WHERE email = 'admin@saome.org';
```

**為什麼不走 `supabase/migrations/*.sql` 檔**：

| 考量 | 決定 |
|---|---|
| 這是 data backfill，不是 schema 變更 | 不應 commit 到 migration history |
| Hash 包含 password-derived bytes | 不應 commit 到 git（雖然是 hash 不是明文，但 DB 暴露 = offline brute force 風險）|
| 三個帳號都是一次性修 | migration 檔不可重跑（會覆寫未來 rehash 過的 hash）|

### Step 3: 驗證

```sql
SELECT email, substring(password_hash, 8, 8) AS salt_prefix
FROM users WHERE email IN ('eason1989213@gmail.com', 'ppp@hotmail.com', 'admin@saome.org');
```

Salt prefix 跟我生成的 3 個 hash 一致 → UPDATE 成功。

**前端測試**：用 3 組帳號 login → wrangler tail 看 CPU time < 10ms → 200 OK + Set-Cookie + JWT → 成功進 dashboard。

---

## 安全警告（重要）

**這次操作期間，使用者在 chat 貼了 3 組明文密碼**：

- `www123123`（eason, ppp）
- `Qwww123123!`（admin）

這些密碼已經暴露在：
- Cursor terminal log
- MCP SQL call log
- 模型 context window

**即使已經換 hash，明文密碼也算洩漏**。建議**立即**：

1. 強制改這 3 組密碼（透過前端 "forgot password" 流程——目前 backend 沒實作，可走 DB 直接 UPDATE）
2. 監看這 3 個 email 是否被異常登入
3. 把「明文密碼不要貼 chat」加到 `.cursor/rules/AGENTS.md` 或 operator SOP

---

## 衍生觀察：為什麼這次炸得這麼徹底

### 1. Free plan × CPU-bound crypto 是定時炸彈

Workers Free plan 對 CPU-bound 操作幾乎**沒有容錯空間**：

| 操作 | Workers Free 預算 | 風險 |
|---|---|---|
| `crypto.scrypt(N=16384)` | 30-100ms / call | **直接 1102** |
| `crypto.scrypt(N=1024)` | 3-5ms / call | OK |
| `crypto.pbkdf2(100k iter)` | 15-30ms / call | **直接 1102** |
| `argon2` | 沒綁進 workerd | 不適用 |
| 任何 5+ 次 DB round-trip | 累積可能 >10ms | 接近邊緣 |

**結論：Free plan 上不能用任何 OWASP 2023 推薦的 scrypt/pbkdf2 參數**。這個 trade-off 在 `password.ts` 的 comment 有寫，但沒寫進任何 operator-facing 決策文件。

### 2. verifyPassword 的 legacy fallback 在 Free plan 是反 pattern

直覺上「先試 N=1024，再 fallback N=16384」是穩健設計，但實際上：
- 對 legacy hash 帳號：第 1 次 fail 浪費 5ms，第 2 次 50ms，總 55ms → **永遠 1102**
- 對 N=1024 帳號：第 1 次 match → 5ms → OK（第 2 次不會跑）

也就是 legacy fallback **只在 Paid plan（30s limit）有意義**，在 Free plan 是**永遠跑不到的 dead code**。

更好的設計（Free plan）：**legacy fallback 直接 return false**（fail closed），不要嘗試 verify。不過那樣 legacy 帳號就登不進來——需要先 rehash。**這就是 rehash-on-login 機制存在的理由**。

### 3. 沒人發現這 1102 直到真的試著登入

| 觀察 | 為什麼沒抓到 |
|---|---|
| `login_attempts` 沒新增 row | 測試都打 DB（繞過 1102）|
| CI 沒有 login 整合測試 | 只跑 unit test，verifyPassword 層沒碰 workerd |
| 開發用 `wrangler dev` | 本地沒 10ms CPU 限制（Node.js 直接跑 scrypt）|
| 生產 deployed 但沒人測過 login | register 流程可以走通（registerService 寫 hash 完就 JWT sign 返回，不需 CPU 重的 verify）；只有 login 才會 trigger legacy verify |

**結論：CPU budget 類的 bug 一定要在 production 環境手動驗過一次才會發現**。

---

## Open follow-ups（沒做，待後續 session）

### 1. rehash-on-login 機制（最優先）

在 `loginService` 內 verifyPassword 成功後，背景 rehash 並 UPDATE DB：

```typescript
// loginService.ts 內 verifyPassword 成功後
if (verified && isLegacyHash(storedHash)) {
  ctx.waitUntil(
    hashPassword(password).then(newHash =>
      sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${user.id}`
        .catch(err => console.warn('[rehash] failed:', err))
    )
  );
}
```

**前提**：需要 Workers Paid plan（30s CPU limit）才能在 request 內 verify legacy hash 不爆 1102。

**意義**：未來任何 legacy hash 帳號登入一次 → 自動升級 → 下次登入走 fast path。**自癒型系統**。

### 2. Workers Free plan 的 crypto 限制寫進 SOP

把這次教訓加到 `.cursor/rules/` 或 `AGENTS.md`：

```
Backend 跑 Cloudflare Workers Free plan，CPU 預算 10ms/request。
禁止在 production code 用以下 crypto 參數（會 1102）：
- scrypt N >= 4096
- pbkdf2 iter >= 10000
- 任何 > 5ms 的同步 crypto
例外：升 Paid plan 後可放寬。
```

### 3. CI 加 login 整合測試（用 workerd runtime）

`apps/backend/vitest.config.ts` 已經用 workerd，但 `auth/tests/login.test.ts` 看起來是 mock DB。建議加一個**真的打 workerd** 的 login 測試，斷言：

- POST `/api/auth/login` with valid creds → 200 + accessToken
- POST `/api/auth/login` with invalid creds → 401
- POST `/api/auth/login` 觸發 verifyPassword → **CPU time < 10ms**（用 `cf.cacheTtl` 或 worker metrics 量）

### 4. 監看 1102 發生率

Cloudflare Observability 加 alert：

```
query: events where $metadata.error.code = 1102 and $metadata.service = saome-backend
threshold: > 0 in 5 min
action: page on-call
```

1102 應該永遠是 0。任何出現都是 P0（crypto 參數錯、CPU-bound bug、或該升 Paid plan）。

### 5. seed migration 003 hash 改 N=1024（環境重建時）

未來如果重新 bootstrap DB（reset all data），`003_seed_admin.sql` 的 admin hash 應該改成 N=1024（用當前 `hash-admin.mjs` 生）。**避免下次 reset 又掉進同一個坑**。

需要同步：
- `apps/backend/migrations/003_seed_admin.sql` — UPDATE 內的 hash 字串
- `apps/backend/scripts/hash-admin.mjs` — 加 `--for-migration` flag 輸出 deterministic salt（讓 migration 可重跑）

### 6. "明文密碼不要貼 chat" 加到 operator SOP

這次 chat 內出現明文密碼是 operator 失誤。建議加：

```
.cursor/rules/AGENTS.md 或 runs/SOPs/operator-security.md：
- 永遠不要把 production password / API key / JWT secret 貼到 chat
- 需要 rehash 帳號時：用 operator 自己的 hash-admin.mjs，本地生成，再 chat 給 hash 字串
- hash 本身雖然不是明文，但 DB 暴露 = offline brute force 風險（特別是弱密碼）
```

---

## 驗證 checklist

- [x] 3 個 UPDATE 都成功（SELECT 確認 salt prefix 一致）
- [x] 前端用 3 組帳號登入都成功（wrangler tail 顯示 CPU < 10ms）
- [ ] rehash-on-login 機制（見 Open #1）—— **沒做**，需要 Workers Paid plan
- [ ] CI login 整合測試（見 Open #3）—— **沒做**
- [ ] 1102 monitoring alert（見 Open #4）—— **沒做**
- [ ] 明文密碼 SOP（見 Open #6）—— **沒做**
- [ ] **強制改 3 組密碼**（見 Security 警告）—— **owner 自行處理**

---

## Refs

- 原始 scrypt 參數決策：`apps/backend/src/shared/lib/password.ts` 的 comment
- 2026-07-28 Bug-4b：`runs/improvements/feedback/20260728-admin-login-scrypt-mismatch.md`（N=131072 vs seed mismatch，導致 500 Scrypt failed）
- 2026-07-27 migration bootstrap：`runs/improvements/feedback/20260727-backend-db-migrations.md` "Open: Password algorithm" 章節（提到 production 應該用 Argon2id/PBKDF2，但**沒量化 Free plan 的 CPU 限制**）
- 6 連環 admin-login index：`runs/improvements/feedback/20260808-admin-login-6-bug-chain-index.md`（沒收錄這次 1102，因為當時 Free plan 還沒成瓶頸——seed admin 都用 N=16384 但只有 admin 一個帳號，沒觸發 Free plan 的 10ms 牆）
- Cloudflare Workers limits：https://developers.cloudflare.com/workers/platform/limits/#cpu-time
