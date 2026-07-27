# Feature Specification: 002 - Tenant Authentication (店家註冊 + 登入 + 角色分流)

**Feature Branch**: `002-tenant-auth`

**Created**: 2026-07-27

**Status**: Ready for Planning

**Input**: 建立店家註冊/登入系統,跨 3 個 repo:SAOME-REBUILD (前端)、新 saome-backend (Worker)、Supabase (DB via Hyperdrive);分前台 (app.saome.org) 與管理 (admin.saome.org) 兩個 shell page;JWT-based session + 雙語系 + 3-fail/10-min lockout。

## Clarifications

### Session 2026-07-27

- **Q1 多 domain 部署**: 採用相同 SPA,用 React Router 區分 `/app/*` 與 `/admin/*`,而不是額外開 subdomain → 已落實於 US1「自動登入 → /app/dashboard」、US2「依角色分流」、FR-022、FR-051、FR-052。
- **Q2 後端架構**: 新開 `saome-backend` repo,單一 Cloudflare Worker,內部分 modules(auth/pass/member/...),Hono + Hyperdrive → Supabase Postgres → 已落實於 Repository Layout(見 plan §2)與 FR-033 提及 JWT。
- **Q3 3-fail/10-min 鎖定**: 前端 UX lock(`useLoginLockout` + localStorage) **加上** 後端事實 lock(`login_attempts` 表計數)雙保險 → 已落實於 US4 全部 4 條、FR-040~FR-044、Edge Cases「繞過前端直接打 API,後端依然拒絕」、SC-008。
- **Q4 註冊後導向**: 註冊成功自動登入,跳轉 `/app/dashboard` 顯示「即將推出」殼 → 已落實於 US1「自動登入」Acceptance Scenario 2、US2 的角色導向、FR-008、Assumptions「/app/dashboard 與 /admin/dashboard 是即將推出殼」。
- **Q5 Session 策略**: access token 15 分鐘、refresh token 30 天、rotation;frontend 不接觸 refresh token(HttpOnly cookie) → 已落實於 US2 Acceptance Scenario 3、FR-024、FR-030~FR-034、Edge Cases「access token 過期 → refresh」。

### Coverage Summary

| Taxonomy Category | Status |
|---|---|
| Functional Scope & Behavior | Resolved(5 user story + Out of Scope) |
| Domain & Data Model | Resolved(3 entities User / Tenant / LoginAttempt,Key Entities 段) |
| Identity & Uniqueness Rules | Resolved(Email UK + taxId UK if not "0" + FR-006/FR-007) |
| Lifecycle/State Transitions | Resolved(session rotation + lockout 自動解除) |
| User Roles | Resolved(tenant / admin,FR-050,US5) |
| Interaction & UX Flow | Resolved(US1 兩步驟 + US2 login 流程 + US3 即時切換) |
| Error/Empty/Loading States | Resolved(通用錯誤訊息、SC-003 顯示時間、Edge Cases 處理重複送出與斷網) |
| Internationalization | Resolved(US3 + FR-060~FR-063) |
| Non-Functional(效能/擴展/可靠/觀測) | Resolved(SC-001~SC-008,observability 透過 login_attempts 表) |
| Security & Privacy | Resolved(FR-009 密碼雜湊、FR-023 不透露帳號、FR-040~FR-044 lockout、FR-050 JWT role) |
| Integration & External Dependencies | Resolved(Dependencies 區) |
| Edge Cases | Resolved(8 條) |
| Completion Signals | Resolved(DoD 寫於 plan,SC-006~SC-009 明確測量) |

> **No new clarifications required.** User 已透過 plan §13 預先回答;spec.md 沒有 NEEDS CLARIFICATION marker。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tenant Registration (P1) 🎯 MVP

一位尚未有帳號的台灣店家負責人第一次接觸平台。在 `/register` 頁填寫「店家資訊」(聯絡人姓名、市話、地址、統一編號或「無」、公司名稱、發票地址) 與「帳號資訊」(Email、密碼、確認密碼、行動電話、網站),按「建立帳號」後,系統自動建立店家與使用者,並直接登入導向 `/app/dashboard` 顯示「即將推出」殼頁。

**Why this priority**: 沒有註冊就沒有店家、沒有 tenant,整個產品不成立。Saas 的所有價值從這裡開始。

**Independent Test**: 在 `/register` 頁填一組合法資料後送出,能在 `users` 與 `tenants` 表看到對應記錄、瀏覽器導向 `/app/dashboard`、Header 出現登出按鈕。

**Acceptance Scenarios**:

1. **Given** 我在 `/register` 頁 **And** Step 1 「店家資訊」全部欄位合法填寫 **When** 我點「下一步」 **Then** 進入 Step 2 「帳號資訊」表單。
2. **Given** Step 1 已通過 **And** Step 2 「帳號資訊」全部合法填寫 **When** 我點「建立帳號」 **Then** 瀏覽器導向 `/app/dashboard` 並顯示「即將推出」殼頁。
3. **Given** 註冊成功 **Then** 系統使用 `HttpOnly` cookie 設定 session 並刷新頁面仍保持登入。
4. **Given** 我重新整理 `/register` 頁 **When** 我已登入 **Then** 系統直接跳到 `/app/dashboard`,不讓我看見註冊表單。
5. **Given** 我以「統一編號 = 0」(無統編) 註冊 **Then** 系統接受並通過驗證。

---

### User Story 2 - Tenant Login (P1) 🎯 MVP

一位已經註冊過的店家負責人回到 `/login` 頁,輸入 email 與密碼按「登入」。若資料正確,系統依角色導向:tenant 角色 → `/app/dashboard`、admin 角色 → `/admin/dashboard`。

**Why this priority**: 跟 US1 同等關鍵 — 沒有登入就沒辦法回訪。Saome 平台 100% 的回訪流量從這條走。

**Independent Test**: 在 `/login` 填已註冊帳號,送出後正確導向 `/app/dashboard`(tenant)或 `/admin/dashboard`(admin)。

**Acceptance Scenarios**:

1. **Given** 我在 `/login` 頁 **And** 我輸入合法且未鎖定的 email/密碼 **When** 我點「登入」 **Then** 系統導向我該去的 dashboard。
2. **Given** 我輸入錯誤密碼 **When** 我點「登入」 **Then** 系統顯示錯誤訊息「帳號或密碼錯誤」,**不**透露是帳號不存在還是密碼錯。
3. **Given** 我的帳號被鎖定(3 次失敗起算 10 分鐘) **When** 我嘗試登入 **Then** 系統顯示倒數計時與「帳號已被暫時鎖定」訊息,**不**接受我送出表單。
4. **Given** 我已登入 **And** 我回到 `/login` 頁 **Then** 系統直接跳到我的 dashboard,不讓我重複登入。
5. **Given** 我點 Header 的「登出」 **Then** 系統清除 session 與 UI,把我導向 `/login` 頁。

---

### User Story 3 - Tenant Bi-lingual UI (P2)

使用者切換介面語系:繁體中文、English。所有頁面、所有錯誤訊息、所有 placeholder、所有 button label 都要在切換後改變。

**Why this priority**: SAOME 是 B2B SaaS 給台灣店家,zh-TW 是預設語系;en 是國際鋪路。版本零先 zh-TW + en,後續再視需要擴充。

**Independent Test**: 在 `/login` 頁切到 English,所有文字變英文;再切回 zh-TW,變回中文。

**Acceptance Scenarios**:

1. **Given** 我在 `/login` 頁(預設 zh-TW) **When** 我點語言切換到 English **Then** 表單 label、placeholder、按鈕文字、錯誤訊息全部變英文。
2. **Given** 我在英文版 `/login` 頁 **When** 我輸入錯誤密碼並送出 **Then** 錯誤訊息是英文。
3. **Given** 我已切到 English **And** 我重新整理頁面 **Then** 語系保留(寫入 localStorage)。

---

### User Story 4 - Account Lockout Protection (P2)

連續 3 次登入失敗,系統鎖定該帳號 10 分鐘,防止暴力破解。鎖定期間所有登入嘗試(不論密碼正不正確)都立即拒絕並顯示剩餘時間。

**Why this priority**: 安全基線。沒做這個等於沒有任何 anti-brute-force 機制,在 auth 系統上是不可接受的弱點。

**Independent Test**: 在 `/login` 同一個 email 連續輸入錯誤密碼 3 次,第 4 次起系統顯示鎖定訊息與剩餘時間;10 分鐘後自動解除。

**Acceptance Scenarios**:

1. **Given** 我對同一個 email 連續輸入錯誤密碼 2 次 **And** 我第三次輸入正確密碼 **Then** 登入成功(累計失敗次數歸零)。
2. **Given** 我對同一個 email 連續輸入錯誤密碼 3 次 **And** 我第四次(無論密碼對錯)送出 **Then** 系統顯示「帳號已被暫時鎖定」並開始倒數 10 分鐘。
3. **Given** 我的帳號被鎖定中 **When** 我等待 10 分鐘後再嘗試正確密碼 **Then** 系統成功登入(不再計入鎖定)。
4. **Given** 我的帳號正在鎖定中 **Then** 即使我用前端 lockout 騙過瀏覽器、繞過前端直接打 API,後端依然拒絕並回傳 lockout 狀態。

---

### User Story 5 - Role-based Landing (P2)

登入後,系統根據使用者角色自動選擇正確的 dashboard 路徑。Tenant 角色進 `/app/dashboard`、Admin 角色進 `/admin/dashboard`。

**Why this priority**: 這是核心 user-facing 行為,不是 nice-to-have — 沒有這個使用者根本不知道要往哪走。

**Independent Test**: 分別以 tenant 帳號、admin 帳號登入,前者導向 `/app/dashboard`、後者導向 `/admin/dashboard`。

**Acceptance Scenarios**:

1. **Given** 我是 tenant 角色 **And** 我登入成功 **Then** 瀏覽器導向 `/app/dashboard`。
2. **Given** 我是 admin 角色 **And** 我登入成功 **Then** 瀏覽器導向 `/admin/dashboard`。
3. **Given** 我是 tenant 角色 **When** 我手動輸入 `/admin/dashboard` 網址 **Then** 系統拒絕存取(顯示 403 或自動導回 `/app/dashboard`)。
4. **Given** 我是 admin 角色 **When** 我手動輸入 `/app/dashboard` 網址 **Then** 系統可以進入(管理員能看前台佈局 — 預留設計彈性,本 MVP 導回 `/admin/dashboard` 也接受)。

---

### Edge Cases

- 我在註冊 Step 1 離開頁面 → 我回來時表單資料需不需要保留?(MVP 預設 **不**保留,使用者重新填;後續可加 localStorage draft)
- 我註冊用的 Email 已經被另一位使用者用過 → 註冊顯示「此 Email 已被使用」,**不**透露帳號是否存在(相同於登入錯誤訊息原則)
- 我連續送出表單(按 Submit 兩次) → 表單鎖定,第二次點擊不再觸發 API 請求
- 我的網路斷線 → 表單顯示「網路連線異常」,不要白屏或無訊息
- 我的 session token 過期(閒置 15 分鐘+) → 下一個 API 請求自動重試 refresh;refresh 失敗就跳回 `/login` 頁
- Admin 登入後看到 `/admin/dashboard` 是「即將推出」殼(MVP 階段),實作內容留給未來 spec
- 在 `taxId = "0"` 之外的字串(含空字串、純英文、超過 8 碼) → 註冊表單擋下,顯示對應錯誤
- 統一編號已被另一個租戶使用 → 註冊擋下,顯示「此統一編號已被使用」

## Requirements *(mandatory)*

### Functional Requirements

#### Tenant Registration

- **FR-001**: System MUST 提供 `/register` 頁,分兩步驟收集資料
- **FR-002**: System MUST 在 Step 1 「店家資訊」收集:聯絡人姓名 (`contactName`)、市話 (`phoneCity` 含區碼)、公司地址 (`address`)、統一編號 (`taxId`)、公司名稱 (`companyName`)、發票地址 (`invoiceAddress`)
- **FR-003**: System MUST 在 Step 2 「帳號資訊」收集:登入 Email、密碼、確認密碼、行動電話(`mobile`,選填)、網站(`website`,選填)、商業聯絡 Email(`email`,與登入 Email 可不同)
- **FR-004**: System MUST 接受 `taxId = "0"` 表示「無統一編號」(個人戶/工作室)
- **FR-005**: System MUST 接受 `taxId` 為 8 碼數字
- **FR-006**: System MUST 在使用者送出後確認 Email 尚未被註冊
- **FR-007**: System MUST 在使用者送出後確認 `taxId`(若非 "0") 尚未被註冊
- **FR-008**: System MUST 在成功註冊後自動登入,並把使用者導向 `/app/dashboard`
- **FR-009**: System MUST 將密碼以單向雜湊儲存(絕不存明文)
- **FR-010**: System MUST 在註冊時建立一筆 `users` 記錄(role = `tenant`)與一筆對應 `tenants` 記錄(owner = 該 user)
- **FR-011**: System MUST 把 mobile 與 website 視為選填欄位
- **FR-012**: System MUST 將行動電話、網站、商業聯絡 Email 區分為「店家商業資訊」(`tenants` 表),不是「使用者登入資訊」(`users` 表)

#### Tenant Login

- **FR-020**: System MUST 提供 `/login` 頁,輸入 Email 與密碼送出
- **FR-021**: System MUST 在送出後比對雜湊密碼
- **FR-022**: System MUST 在登入成功後依角色把使用者導向 `/app/dashboard`(tenant)或 `/admin/dashboard`(admin)
- **FR-023**: System MUST 在登入失敗時回傳通用錯誤訊息,「帳號或密碼錯誤」,**不**透露帳號是否存在
- **FR-024**: System MUST 在登入成功後,透過 `HttpOnly; Secure; SameSite=Lax; Domain=.saome.org` cookie 設定 session

#### Session Management

- **FR-030**: System MUST 簽發「access token」(短期,15 分鐘) 與「refresh token」(長期,30 天,rotation)
- **FR-031**: System MUST 在 access token 過期後,前端 refresh 用 refresh token 換發新 access token,並 rotation refresh token
- **FR-032**: System MUST 在 refresh 失敗(過期、被撤銷)時,前端清 session 並把使用者導向 `/login`
- **FR-033**: System MUST 在每次需要登入的請求帶上 access token 證明身份
- **FR-034**: System MUST 在使用者登出後,撤銷該 refresh token(server-side blacklist 或資料表註記)

#### Account Lockout

- **FR-040**: System MUST 在連續 3 次登入失敗後鎖定該 email 10 分鐘
- **FR-041**: System MUST 將每次登入嘗試(成功或失敗)記錄到 `login_attempts` 表
- **FR-042**: System MUST 在鎖定期間,即使密碼正確也拒絕登入並回傳 lockout 狀態
- **FR-043**: System MUST 在 10 分鐘後自動解除鎖定(下次嘗試時重新計算)
- **FR-044**: System MUST 同時有「前端 UX lock」(localStorage 計數,避免使用者一直嘗試) 與「後端事實 lock」(DB 計數,防止繞過前端)

#### Role-based Access

- **FR-050**: System MUST 在 JWT 的 `role` claim 帶上 `tenant | admin`
- **FR-051**: System MUST 在使用者存取 `/admin/*` 路由時,角色必須是 `admin`,否則拒絕(403)
- **FR-052**: System MUST 在使用者存取 `/app/*` 受保護頁時,角色必須是 `tenant` 或 `admin`,否則導向 `/login`

#### Internationalization

- **FR-060**: System MUST 支援 zh-TW(預設) 與 en 兩種語系
- **FR-061**: System MUST 在使用者切換語系時,即時變更所有頁面文字
- **FR-062**: System MUST 將使用者的語系偏好持久化(localStorage),重新整理頁面後保留
- **FR-063**: System MUST 在錯誤訊息、表單 label、placeholder、按鈕文字全面支援兩語系

### Key Entities

- **User(使用者)**: 登入身份。一個 email 對應一個帳號。擁有 `id`、`email`、`password_hash`、`role`(`tenant` | `admin`)、`is_active`、`created_at`。
- **Tenant(店家)**: 商業實體。每個 tenant 由一位 user 擁有(`owner_user_id` 必填,但預留子帳號擴充)。擁有基本商業資訊:`name`、`contact_name`、`phone_city`、`address`、`tax_id`、"0" 或 8 碼數字)、`invoice_address`(選填或預設同 `address`)、`mobile`、`website`、`email`(商業聯絡 email)。
- **LoginAttempt(登入嘗試記錄)**: 安全稽核軌跡。`id`、`user_id`(nullable,因為失敗時可能查無 user)、`email_attempted`、`success`、`attempted_at`。每次登入嘗試都新增一筆,用於計算連續失敗次數與 lockout 決策。
- **AuthSession**: 客戶端的 session 物件(`access_token`、使用者資訊)。refresh token 本身只活在 HttpOnly cookie,前端永遠不接觸。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 新使用者可在 3 分鐘內完成註冊(從進入 `/register` 到看到 `/app/dashboard`)
- **SC-002**: 已註冊使用者可在 30 秒內完成登入(從進入 `/login` 到看到對應 dashboard)
- **SC-003**: 連續 3 次登入失敗後,系統在 1 秒內顯示倒數計時
- **SC-004**: 已登入的 tenant 嘗試存取 `/admin/dashboard` 時,瀏覽器在 500ms 內導回 `/app/dashboard` 或顯示 403
- **SC-005**: 切換 zh-TW ↔ en 之後,所有可見文字(包括錯誤訊息)100% 切換
- **SC-006**: 前後端的 unit test + BDD feature + Playwright smoke 涵蓋五大 user story,All Green
- **SC-007**: 系統覆蓋率(frontend 與 backend)≥ 80%
- **SC-008**: 在 3-fail/10-min lockout 期間,即使前端 UX 鎖定被繞過(例如直接打 API),後端依然拒絕
- **SC-009**: 新增「下一個業務模組」(例如 pass)時,可直接拿本次建立的共用元件(L1 表單元件、httpClient、AuthProvider)而不需重寫,驗證方式:用「開新模組 5 步 SOP」流程跑通一次,確認步驟 ≤ 5 行新檔案

## Assumptions

- 假設前端 SPA 已部署在 `app.saome.org` 與 `staging.saome.org`, HTTPS 已配好
- 假設後端將透過 Cloudflare Custom Domain 在 `api.saome.org` 對外,需要 Hyperdrive binding 連線到 Supabase Postgres
- 假設 admin 帳號透過 Supabase seed migration 注入,**不**經由註冊流程建立
- 假設 session cookie 的 `Domain=.saome.org` 屬性僅在 production 設定;staging 與 dev 不設
- 假設 refresh token 的 rotation 機制:每次 refresh 都換發新 refresh token,舊的失效
- 假設密碼至少 8 字元;後續若需更嚴格可在 spec 003 加
- 假設 email 格式由 zod 驗證,不需要額外 SMTP 驗證流程(本 MVP 不做)
- 假設 admin 帳號會由 seed migration 建立,但首登強制改密碼功能(MVP 之後)由未來 spec 加
- 假設「/app/dashboard」「/admin/dashboard」在 MVP 階段都是「即將推出」殼,實作的內容留給後續 spec(例如 spec-003-product-page、spec-004-admin-page)

## Out of Scope (本 spec 不處理)

- Email 驗證流程(註冊後、忘記密碼)
- 忘記密碼 / 重設密碼
- 方案選擇 + 信用卡綁定(Stripe 整合)
- 多店家子帳號管理 UI(`tenants.owner_user_id` 預留 FK,但不實作)
- Admin 建立其他 admin 的 UI(只透過 seed)
- TOTP / WebAuthn 多因素
- Social login(Google / LINE)
- audit log dashboard(我們有 `login_attempts` 表做安全稽核,但不做查詢 UI)
- 商業聯絡地址自動推論(發票地址預設同地址,要讓使用者可以編輯)
- 密碼強度規則細節(本 MVP 只驗「≥ 8 字元」)
- 自動 i18n 完整性檢查 script(未來 spec 再加)

## Dependencies

- 前端 React 19 + Vite SPA + react-i18next(i18n)
- 後端 Cloudflare Workers + Hono + Hyperdrive + Supabase Postgres
- 通用:Vitest + RTL、Cucumber.js(BDD)、Playwright(smoke)
- 前端 lucide-react icons、Tailwind CSS(設計 token)
- 前後端共享:`packages/shared`(schemas、types、logic、constants、i18n)
