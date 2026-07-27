# Data Model: 002 - Tenant Authentication

**Source**: [spec.md](spec.md) §Key Entities + [plan.md](plan.md) §Project Structure
**Scope**: Postgres schema in Supabase(透過 Hyperdrive → saome-backend Worker)

---

## Entities 總覽

```mermaid
erDiagram
  USERS ||--o| TENANTS : owns
  USERS ||--o{ LOGIN_ATTEMPTS : has
  USERS {
    uuid id PK
    text email UK
    text password_hash
    text role
    boolean is_active
    timestamp created_at
  }
  TENANTS {
    uuid id PK
    uuid owner_user_id FK
    text name
    text contact_name
    text phone_city
    text address
    text tax_id
    text invoice_address NULL
    text mobile NULL
    text website NULL
    text email
    timestamp created_at
  }
  LOGIN_ATTEMPTS {
    bigserial id PK
    uuid user_id FK NULL
    text email_attempted
    boolean success
    timestamp attempted_at
  }
```

### 規則細節

| 規則 | 套用 |
|---|---|
| 一個 user 一個帳號 | `users.email` 為 unique key(FR-006) |
| 一個 user 一個 tenant | `tenants.owner_user_id` 必填且 unique(`UNIQUE(owner_user_id)`),預留子帳號但 MVP 不開放(Out of Scope) |
| 統一編號唯一 | 若 `tax_id != '0'`,則 `UNIQUE(tax_id)`(FR-007) |
| "0" 表示無統編 | 多個 user 可同時用 "0"(個人戶/工作室) |

---

## Entity 細節

### 1. `users`(使用者身份,登入用)

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary Key |
| `email` | `text` | NOT NULL | — | UK;登入用的 email;後端在建立前先 SELECT 驗證 NOT EXISTS |
| `password_hash` | `text` | NOT NULL | — | Argon2id or PBKDF2 hash(SAOME-13 決定);**絕不存明文** |
| `role` | `text` | NOT NULL | `'tenant'` | `'tenant' \| 'admin'`;未來 superadmin 預留 |
| `is_active` | `boolean` | NOT NULL | `true` | 軟刪除旗標;預留停用帳號流程(Out of Scope for MVP) |
| `created_at` | `timestamptz` | NOT NULL | `now()` | 註冊時間;ClientTZ 中性 |

**Indexes**
```sql
CREATE UNIQUE INDEX users_email_uk ON users (LOWER(email));
CREATE INDEX users_role_idx ON users (role) WHERE is_active = true;
```

**DB row schema**:`saome-backend/src/modules/auth/schemas/db.ts` 的 `usersRowSchema`(內部用;前端**不**直接讀 row 形狀)

---

### 2. `tenants`(店家商業實體)

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary Key |
| `owner_user_id` | `uuid` | NOT NULL | — | FK → `users.id`;MVP 1:1,預留多 user 共享 |
| `name` | `text` | NOT NULL | — | 公司 / 店家名稱 |
| `contact_name` | `text` | NOT NULL | — | 聯絡人姓名 |
| `phone_city` | `text` | NOT NULL | — | 市話(含區碼,例:02-1234-5678) |
| `address` | `text` | NOT NULL | — | 公司登記地址 |
| `tax_id` | `text` | NOT NULL | — | "0" 或 8 碼數字 |
| `invoice_address` | `text` | NULL | — | 發票寄送地址;若 NULL 則預設同 `address`(預設邏輯寫前端註冊表單,不存 NULL) |
| `mobile` | `text` | NULL | — | 行動電話 |
| `website` | `text` | NULL | — | 網站 URL |
| `email` | `text` | NOT NULL | — | 商業聯絡 Email;與 `users.email` 解耦,允許獨立編輯(Out of Scope 編輯 UI) |
| `created_at` | `timestamptz` | NOT NULL | `now()` | 註冊時間 |

**Constraints / Indexes**
```sql
ALTER TABLE tenants ADD CONSTRAINT tenants_owner_fk
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX tenants_owner_uk ON tenants (owner_user_id);
CREATE UNIQUE INDEX tenants_tax_id_uk ON tenants (tax_id) WHERE tax_id <> '0';
CREATE INDEX tenants_email_idx ON tenants (LOWER(email));
```

**對應 zod schema**:`packages/shared/schemas/auth.ts` 的 `tenantInfoSchema` + `taxIdSchema`(refiner 接受 "0" 或 8 碼數字)

---

### 3. `login_attempts`(登入嘗試稽核)

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `bigserial` | NOT NULL | `nextval('login_attempts_id_seq')` | Primary Key |
| `user_id` | `uuid` | NULL | — | FK → `users.id`;若失敗時查無 user 為 NULL |
| `email_attempted` | `text` | NOT NULL | — | 即使 user 沒找到也要記錄,做 rate-limit 決策 |
| `success` | `boolean` | NOT NULL | — | true/false |
| `attempted_at` | `timestamptz` | NOT NULL | `now()` | 嘗試時間(用於 10-min window) |

**Indexes**
```sql
CREATE INDEX login_attempts_email_time_idx ON login_attempts (LOWER(email_attempted), attempted_at DESC);
CREATE INDEX login_attempts_user_time_idx ON login_attempts (user_id, attempted_at DESC) WHERE user_id IS NOT NULL;
```

**Lockout 查詢**(後端實作):
```sql
SELECT count(*) AS failures
FROM login_attempts
WHERE LOWER(email_attempted) = LOWER($1)
  AND success = false
  AND attempted_at > now() - interval '10 minutes';
-- if failures >= 3 → 鎖定
```

---

### 4. JWT Claims(無 DB;簽在 token 內)

```typescript
{
  sub: '<user uuid>',     // 使用者 PK
  email: '<email>',
  role: 'tenant' | 'admin',
  iat: <unix>,             // issued at
  exp: <unix>              // access: +15min, refresh: +30day
}
```

對應 zod:`packages/shared/schemas/auth.ts` 的 `jwtPayloadSchema`,前後端共用驗證。

---

## Migration 順序

> 依 plan §3 的單一 Worker 多模組 SOP 規則:每個 migration 編號遞增,執行順序嚴格。

| File | 內容 |
|---|---|
| `001_init_users_tenants.sql` | 建立 `users`、`tenants` 表、index 與 constraints |
| `002_init_login_attempts.sql` | 建立 `login_attempts` 表與 index |
| `003_seed_admin.sql` | **手動**(僅 SAOME 時一次)插入 admin 帳號;email/密碼透過 `.env`(SAOME-11 後由使用者提供) |

---

## Entity ↔ Spec FR 對照

| Spec FR | 對應 Entity / Column |
|---|---|
| FR-006(Email 唯一) | `users.email` UK + `LOWER(email)` index |
| FR-007(taxId 唯一) | `tenants.tax_id` partial UK(`WHERE tax_id <> '0'`) |
| FR-008(成功自動登入) | 註冊 transaction 同時建 `users` + `tenants`,立刻 `signAccessToken` |
| FR-009(密碼雜湊) | `users.password_hash` 用 argon2id or PBKDF2 |
| FR-010(建 user 與 tenant 記錄) | 兩表 insert in transaction |
| FR-012(商業資訊與登入資訊分表) | `tenants.mobile/website/email` vs `users.email` |
| FR-024(HttpOnly cookie) | signRefreshToken + Set-Cookie header + Domain=.saome.org |
| FR-030(access/refresh) | jose sign HS256 access(15min) / refresh(30day) |
| FR-031(refresh rotation) | refresh 換發新 refresh,舊的寫入 revoked_tokens 黑名單(本 spec Out of Scope,後續 spec 加) |
| FR-040~FR-044(lockout) | `login_attempts` 表 + 上面 SQL 查詢 |
| FR-050(JWT role claim) | `sub` + `email` + `role` 在 JWT payload |

---

## 設計備註

- **為什麼 `tenants.email` 不 UK?** 商業聯絡 email 是公開資訊,可能會變動(Out of Scope 編輯 UI),改成 INDEX 而非 UNIQUE。
- **為什麼 `tenants.owner_user_id` 是 UNIQUE?** MVP 不支援子帳號,但 FK 改為複合 UNIQUE 後,未來加子帳號只需砍此 UNIQUE。
- **為什麼 `tax_id` 是 text 不是 bigint?** "0" 是合法值;"0" 不能 parse 成 bigint。
- **為什麼 `password_hash` 用 `text`?** 不同 hash 演算法長度差異大,text 最簡潔;Postgres 也沒原生 password 類型。
- **為什麼 `login_attempts` user_id 容許 NULL?** 失敗時查不到 user(Email 不存在),必須記錄「有人嘗試這個 email」以防 enumeration attack;此時 user_id 為 NULL,只靠 `email_attempted` 識別。
- **為什麼不存 revoked refresh tokens?** MVP 內 refresh 沒有主動撤銷 UI,token 自然 30 天過期即可;Out of Scope log out all devices / change password invalidates sessions(後續 spec 加)。
