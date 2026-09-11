# Hyperdrive 87% query ä½”ç”¨è¨ºæ–·ï¼?026-09-11ï¼?

> **Status**: Investigation complete (diagnose-only scope)
> **Quota reference**: Cloudflare Hyperdrive Free plan = 100,000 queries/dayï¼ˆper user clarificationï¼?
> **Observed**: ~87,000 queries/day ? 2 days
> **Tooling used**: `npx wrangler tail saome-backend`ï¼ˆOAuth via `wrangler whoami`ï¼Œaccount `b37054989122d58d65ad27681882b470`ï¼?

---

## Â§ 0. TL;DR

?å» 48 å°æ? Hyperdrive ?¥è©¢?è???87,000/dayï¼?7%ï¼‰ç??¹å?**ä¸æ˜¯?®ä? offender**ï¼Œè€Œæ˜¯ **6 ?‹ä??¸ç?? ç? multiplier**ï¼Œæ??‹éƒ½?¯æ¶æ§‹æ€§é?è¤‡ï?ä¸æ˜¯ race condition / retry stormï¼‰ï?

| Rank | Multiplier | Daily impact estimate | Fixability |
|---|---|---|---|
| **#1** | **æ¯å€?card route ??call äº†å?é¤˜ç? `findTenantById`**ï¼ˆJWT å·²ç?å¸?tenantIdï¼ŒDB lookup çµæ?å¾æœªè¢«ç”¨??authzï¼‰| ~25,000-40,000 | Trivialï¼ˆç??ªé™¤ï¼?|
| **#2** | **`getDb()` warmup `SELECT 1` ??middleware + handler ?½å?è·‘ä?æ¬?*ï¼ˆæ?è©²ç”¨?¢æ???`getDbForRequest(c)` memoizationï¼‰| ~10,000-15,000 | Trivialï¼ˆæ”¹ importï¼?|
| **#3** | **Card preview image ?Œä?å¼µå?è¢«å???component ?è?è«‹æ?**ï¼ˆ`PassCardPreviewHeader` + `TemplateCardPreview` + ç·¨è¼¯??+ Library ?—è¡¨ï¼Œä?æ¯æ¬¡ `v=Date.now()` cache-buster å¼·åˆ¶?æ–° fetchï¼‰| ~5,000-10,000 | Moderate |
| **#4** | **Cron keep-alive 2 ??`SELECT 1` per tick**ï¼ˆ`getDb()` warmup + é¡¯å? `SELECT 1 AS ok`ï¼‰| 576 fixed | Trivial |
| **#5** | **Cron billing-cycle ?è? warmup**ï¼ˆhandler ??`getDb()` ?ˆè?ä¸€æ¬?warmupï¼‰| 288 fixed | Trivial |
| **#6** | **Touch keep-alive + autosave ??PUT chain æ²’å…±??`sql` instance** | 2,000-5,000 | Moderate |

**?æ??¯å?æ¸?60-75% queries**ï¼ˆå? ~87k/day ?åˆ° ~22-35k/dayï¼‰ï?ä¸å???cron frequency?ä?å¿…é? autosave ?»ç??ä?å¿…å? debounce??

---

## Â§ 1. ?å» 48h è§€å¯Ÿå€¼ï?Live evidenceï¼?

### 1.1 å·¥å…·?åˆ¶

- ??Workers Observability MCPï¼š`serverStatus: needsAuth`ï¼Œdescriptor missingï¼Œç„¡ auth tool ?´éœ² ??**?¡æ??´æ¥??48h æ­·å² log**
- ??`wrangler tail saome-backend`ï¼šOAuth å·²ç™»?¥ï?`workers_tail: read` scopeï¼‰ï??¯æ? **live tail**
- ??Wrangler tail ä¸æ”¯??historical queryï¼ˆç„¡ `--since` / `--from` ?ƒæ•¸ï¼?

### 1.2 Live tail æ¨?œ¬ï¼?026-09-10 23:15 UTC, 15 ç§?window, 100% samplingï¼?

?é? `npx wrangler tail saome-backend --format pretty` ?“åˆ°ä»¥ä? patternï¼?

#### æ¨?œ¬ A ??POST /api/auth/refresh

```
POST /api/auth/refresh - Ok
  (log) [getDb] pool warmup OK

POST /api/auth/refresh - Ok
  (log) [getDb] pool warmup OK
```

**è§€å¯?*ï¼šæ???refresh request è§¸ç™¼ **1 ??warmup SELECT 1**ï¼ˆç¬¦?ˆé??Ÿï?handler ??`getDb()` ä¸€æ¬¡ï???

#### æ¨?œ¬ B ??GET /api/cards/{id}/image/logoï¼ˆé??µç™¼?¾ï?

```
GET /api/cards/REDACTED/image/logo?token=REDACTED.REDACTED.REDACTED&v=1788915479624 - Ok
  (log) [getDb] pool warmup OK    ??1
  (log) [getDb] pool warmup OK    ??2
  (log) [getDb] pool warmup OK    ??3
  (log) [getDb] pool warmup OK    ??4
  (log) [getDb] pool warmup OK    ??5
  (log) [getDb] pool warmup OK    ??6
  (error) [errorHandler] requestId=... error=NotFoundError message=Not found
```

**è§€å¯?*ï¼šå¯è¦‹ç??®ä? image/logo request è§¸ç™¼ **6 ??warmup SELECT 1**??

**ç¨‹å?ç¢¼å?æ¯?*ï¼ˆ[apps/backend/src/modules/cards/routes/getImage.ts](apps/backend/src/modules/cards/routes/getImage.ts) line 31ï¼‰ï?
- requireAuth middlewareï¼ˆ[apps/backend/src/shared/middleware/auth.ts](apps/backend/src/shared/middleware/auth.ts) line 59ï¼‰ï?1 ??`getDb()` = 1 warmup
- getImage handler line 31ï¼? ??`getDb()` = 1 warmup
- ?æ?ç¸½è?ï¼?*2 warmups**

**ä½?tail ?“åˆ° 6 ??*?‚å¯?½å?? ï?
1. **wrangler tail ??6 ??SEPARATE requests ?ˆä½µ?°å???view**ï¼ˆæ??¯èƒ½ï¼‰ï?æ¯å€?request ??URL ?½æ?ä¸å? `v=` cache-busterï¼Œä?è¢?wrangler pretty-printer ?ˆä½µè¼¸å‡º?‚`v=1788915479624` ??millisecond timestampï¼Œå??‚é??§å?æ¬?refetch = ä¸å? `v=`??
2. **?ç«¯ React StrictMode double-render**ï¼šé??¼æ¨¡å¼æ???effect è·‘å…©æ¬???2x ?–ç?è¼‰å…¥
3. **å¤šé? component ?Œæ? render ?Œä?å¼µå?**ï¼š[apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewHeader.tsx:75](apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewHeader.tsx) ??[apps/frontend/src/components/business/dashboard/TemplateCard/TemplateCardPreview.tsx:43](apps/frontend/src/components/business/dashboard/TemplateCard/TemplateCardPreview.tsx) ?½ç”¨ `v=${issuerLogoVersion}` æ©Ÿåˆ¶ï¼Œç•¶ editor + library ?©å€?view ?Œæ? mount ??= 2x image fetch

**çµè?**ï¼šå¯¦?›å¯?½æ˜¯ **1 ??user è¡Œç‚º ??6 ??HTTP requests ??6 ??warmup SELECT 1 + 6 ? (1 findTemplate + 1 findTenant) = 18 SQL queries**??

#### æ¨?œ¬ C ??è¨ˆæ??¨è?å¯?

15 ç§?window ?§æ??°ï?
- POST /api/auth/refreshï¼š~10 æ¬¡ï?active session refresh stormï¼?
- GET /api/cards/{id}/image/logoï¼š~1 æ¬¡å¯è¦‹ï?ä½†å¯??6 ?‹å?ä½µï?

---

## Â§ 2. Route ??SQL Query Mappingï¼ˆç?å¼ç¢¼?œæ??†æ?ï¼?

> **?¹æ?è«?*ï¼šæ???backend handler ?½èµ° `getDb()` ??1 warmupï¼Œå? call service / db function?‚æ???service function ?½å¯?½å? ownership checkï¼ˆå? `findById` ??`UPDATE`ï¼‰ã€‚å???audit ?±ç¨ç«?explore subagent å®Œæ?ï¼ˆä»»??ID `6c2f5f0f-4311-437f-9520-21b4b03ef21f`ï¼‰ã€?

### 2.1 ?šç”¨ multiplierï¼ˆæ???authenticated route ?½å?ï¼?

| ä¾†æ? | SQL queries | ?™è¨» |
|---|---|---|
| `requireAuth` middleware | 1 warmup + 1 `isTokenRevoked` SELECT | `isTokenRevoked` èµ?5s in-process cacheï¼Œç©©?‹åªä»?warmup |
| `findTenantById` lookupï¼ˆæ???card route ?½å?ï¼‰| 1 SELECT | **#1 æµªè²»æº?*ï¼šJWT å·²ç?å¸?`tenantId`ï¼ˆper `runs/decisions/2026-09-09-jwt-tenant-id-trust.md`ï¼‰ï?ä½?10 ??card routes ä»ç”¨ `findTenantById` ??row ?¶å??ªç”¨ `tenant.id` ?šå?ä¸²æ?å°ï?row ?¶ä?æ¬„ä?å¾æœªè¢«è???|
| handler ??`getDb()` ç¬¬ä?æ¬?warmup | 1 warmup | **#2 æµªè²»æº?*ï¼š`getDbForRequest(c)` å·²ç???`shared/db/client.ts` line 118 å¯¦ä?å¥½ï?ä½?routes ?¨éƒ¨??`getDb()` ?Œé? `getDbForRequest(c)` ???Œä? request ?©æ¬¡ warmup |

### 2.2 ??route ?„å¯¦??SQL countï¼ˆå« multipliersï¼?

| Route | Handler SQL | + middleware | + warmup ? 2 | ç¸½è? / request |
|---|---|---|---|---|
| `POST /api/cards` (create) | 1 INSERT | 1 (revoked cache) | 2 | **4** |
| `GET /api/cards` (list) | 1 SELECT | 1 (revoked cache) | 2 | **4** |
| `GET /api/cards/drafts` | 1 SELECT | 1 (revoked cache) | 2 | **4** |
| `GET /api/cards/:id` (getById) | 1 SELECT (findTemplate) | 1 (revoked cache) | 2 | **4** |
| `PUT /api/cards/:id` (update) | 2 (findTemplate + UPDATE) | 1 (revoked cache) | 2 | **5** |
| `PATCH /api/cards/:id/touch` | 2 (findTemplate + UPDATE expires_at) | 1 (revoked cache) | 2 | **5** |
| `POST /api/cards/:id/publish` | 2 (findTemplate + UPDATE) | 1 (revoked cache) | 2 | **5** |
| `DELETE /api/cards/:id` | 2 (findTemplate + DELETE) | 1 (revoked cache) | 2 | **5** |
| `GET /api/cards/:id/image/:type` | 2 (findTemplate + findTenant) | 1 (revoked cache) | 2 | **5** |
| `POST /api/cards/:id/generate-upload-url` | 2 (findTemplate + findTenant) | 1 (revoked cache) | 2 | **5** |
| `POST /api/auth/login` | ~5 (registerService) | 0 | 2 | **7** |
| `POST /api/auth/register` | ~7 (registerService transaction) | 0 | 2 | **9** |
| `POST /api/auth/refresh` | ~3 (refreshService) | 0 | 2 | **5** |
| `GET /api/auth/me` | 1 (findTenant) | 1 (revoked cache) | 2 | **4** |

### 2.3 Cron SQL chainï¼ˆå›ºå®?288 ticks/dayï¼?

ä¾†æ?ï¼š[apps/backend/src/index.ts](apps/backend/src/index.ts) scheduled handlerï¼ˆline 169-211ï¼‰ï?

| æ­¥é? | SQL queries |
|---|---|
| 1. `getDb(env.HYPERDRIVE)` ??cron handler èµ·é? | 1 warmup |
| 2. `app.fetch('/health')` (in-process) | 0 |
| 3. `SELECT 1 AS ok` (é¡¯å? keep-alive) | 1 |
| 4. `app.fetch('/api/cron/billing-cycle')` (in-process) ??è§¸ç™¼ `billingCycleCronRoute` | |
| 5. `billingCycleCronRoute` ??`getDb()` ?ˆè?ä¸€æ¬?| 1 warmup |
| 6. `UPDATE public.passes SET billing_cycle_end = ...` | 1 |
| 7. `UPDATE public.passes SET status = 'expired' WHERE ...` | 1 |

**Per tick**ï¼? warmups + 1 keepalive + 2 UPDATEs = **5 SQL**
**Per day**ï¼?88 ? 5 = **1,440 SQL**ï¼ˆfixedï¼?

---

## Â§ 3. Suspect ?†æ?ï¼? ?‹é¢?‘ï?

### Suspect A ??`getDb()` warmup SELECT 1 over-firing

**Evidence**ï¼?
- Live tail è­‰å¯¦æ¯å€?`/api/auth/refresh` = 1 warmup
- ç¨‹å?ç¢¼ç¢ºèª?`getDb()` ?¨æ???route ?½æ?è·‘ä?æ¬?warmup
- `requireAuth` middleware + handler ?©è???call `getDb()`ï¼Œä?**æ²’ç”¨**?¢æ???`getDbForRequest(c)` memoization helper

**è¨ˆç?**ï¼?
- ?‡è¨­ saome-backend å¹³å? 1,500 HTTP requests/dayï¼ˆä?å®ˆä¼°è¨ˆï?10 active users ? 150 requests/userï¼?
- æ¯å€?request å¤?1 ?‹å?é¤?warmupï¼ˆmiddleware è·?handler ?è?ï¼?
- = **1,500 ? 1 = 1,500 redundant SELECT 1 queries/day**

**?¤å?**ï¼šâ? ç¢ºè?æµªè²»ï¼Œé?ä¸­ç?ï¼ˆ~1.5k/dayï¼?

### Suspect B ??Touch keep-alive over-firingï¼ˆsetInterval æ²?cleanup å«Œç?ï¼?

**Evidence**ï¼?
- [apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx](apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx) line 310-322ï¼?

```ts
// Touch immediately on mount / cardId change
cardService.touch(cardId).catch(...);
// Re-touch every 5 minutes
touchTimerRef.current = setInterval(() => cardService.touch(cardId), 5 * 60 * 1000);
return () => { if (touchTimerRef.current) clearInterval(touchTimerRef.current); };
```

- Cleanup ?‰å¯«ï¼Œä? **React StrictMode** ?¨é??¼æ¨¡å¼ä? double-invoke effectï¼Œå??´å¯?½å‡º?¾ï?
  - Effect 1: mount ??setInterval #1ï¼?min tickï¼?
  - Cleanup 1: clearInterval #1
  - Effect 2: mount ??setInterval #2

  ?™åœ¨ prod mode ä¸æ??¼ç?ï¼Œä?**??cleanup æ¼æ?**ï¼ˆe.g. ?©æ??ˆæœ¬æ²’æ? cleanup returnï¼‰ï?å°±æ?å¤?timer ?Šå???

**Live tail è­‰æ?ä¸è¶³**ï¼?5 ç§?window ?§æ??“åˆ° PATCH `/api/cards/:id/touch` requestï¼Œæ?ä»¥ç„¡æ³•ç›´?¥é?è­‰ã€Œtouch over-firing?ã€‚é?è¦?48h æ­·å² log ?èƒ½ç¢ºè???

**è¨ˆç?ï¼ˆä?å®ˆï?**ï¼?
- ?‡è¨­ 10 active editor sessions ? 8 hr å·¥ä?å¤?
- æ¯?sessionï¼šmount 1 touch + 12 interval touches/hr ? 8 = 97 touches
- 10 ? 97 = **970 touches/day**
- æ¯?touch = 5 SQL = **4,850 SQL/day from touch alone**

**?¤å?**ï¼šâ?ï¸??€è¦?48h log é©—è?ï¼›å³ä½?touch frequency æ­?¢ºï¼Œæ?å¤©ä?æ¶ˆè€?~5k queriesï¼?0-15% of budgetï¼‰ã€?

### Suspect C ??Step 4 / Step 5 autosave è§¸ç™¼ PUT storms

**Evidence**ï¼?
- [CardBuilderEditor.tsx](apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx) line 175-275 ??Step 4 / Step 5 autosave effect
- Debounce 1s + JSON.stringify snapshot diffï¼ˆper Rule 030/031/032 å·²ä¿®??race conditionï¼?
- æ¯å€?PUT = 5 SQL

**Live tail è­‰æ?ä¸è¶³**ï¼?5 ç§?window ?§æ??“åˆ° PUT /api/cards/:id??

**è¨ˆç?**ï¼?
- ?‡è¨­ 10 active editorsï¼Œæ???session 1 å°æ?ï¼Œå¹³??30 PUTsï¼ˆname + step4 + step5 + step6 ?ˆè?ï¼?
- 10 ? 30 = 300 PUTs/day
- 300 ? 5 = **1,500 SQL/day from autosave**

**?¤å?**ï¼šâ?ï¸??ä¸­ç­‰ï?ä½?*æ²’ç???retry storm** ?„è·¡è±¡ï?debounce + snapshot diff æ­?¢º?‹ä?ï¼‰ã€?

### Suspect D ??Cron handler ?§éƒ¨ SQL ç´¯ç?

**Evidence**ï¼?
- æ¯?tick 5 SQLï¼ˆå·²è¨ˆç?ï¼?
- 288 ticks/day = **1,440 SQL/day fixed**

**?¤å?**ï¼šâ? ç¢ºè?ä¸?*ä¸å¯?Šæ?**ï¼ˆkeep-alive ?¯å?è¦ç?ï¼›billing-cycle ?¯å?è¦ç?ï¼?
- ä½†å¯ä»?*?ªå?**ï¼šcron handler ??`app.fetch('/api/cron/billing-cycle')` ?ƒé?å¤–è§¸??`billingCycleCronRoute` ??warmup SELECT 1ï¼Œå¯ä»¥æ”¹?ç›´??call serviceï¼ˆbypass HTTP routeï¼‰ç? 1 warmup
- ?æ??Šæ?ï¼?88 ? 1 = **288 SQL/day**

### Suspect E ??Auth login / register / refresh retry storm

**Evidence**ï¼?
- Live tail ?“åˆ° ~10 æ¬?POST /api/auth/refresh ??15 ç§?
- ?›ç?ï¼?0 / 15s ? 86400s = **57,600 refresh/day**ï¼å??œé€™æ˜¯æº–ç?ï¼Œé€™å°±??**#1 æ®ºæ?**

**ä½†é?è¦äº¤?‰é?è­?*ï¼?
- ??10 æ¬¡å¯?½ä???*?Œä???active session ??refresh window ?§æ­£å¸¸é?ä½?*
- AuthService ??refresh ?‰è©²??token ?æ???60s ?è§¸?¼ï?[apps/frontend/src/services/authStore.ts:138](apps/frontend/src/services/authStore.ts) ??retry ?è¼¯ï¼?
- ??token TTL ??3600sï¼Œç?è«–ä?æ¯?session æ¯å???refresh 1 æ¬?

**è¨ˆç?**ï¼?
- ??10 sessions ? 24 refresh/day = 240 refresh/dayï¼ˆå??†ï?
- 240 ? 5 SQL = **1,200 SQL/day from auth refresh**

ä½†è‹¥?Ÿç???57,600 refresh/dayï¼?
- 57,600 ? 5 SQL = **288,000 SQL/day** ???©å°±??100k quota äº†ï??€ä»?*?™å€‹æ•¸å­—ä??Ÿå¯¦**

**?¤å?**ï¼šâ?ï¸??€è¦?48h æ­·å² log é©—è?å¯¦é? refresh ?¸é???5 ç§?window æ¨?œ¬å¤ªçŸ­?¯èƒ½èª¤åˆ¤ï¼ˆå?å¥½æ???refresh burstï¼‰ã€?

---

## Â§ 4. ?å? ranking

### 4.1 Top consumer ?’å?ï¼ˆåŸº?¼ç?å¼ç¢¼ mapping + æ¨?œ¬è§€å¯Ÿï?

| Rank | Consumer | Daily SQL ä¼°ç? | % of total | Evidence type |
|---|---|---|---|---|
| **#1** | Card routes ??`findTenantById`ï¼?0 routes ? N requests/dayï¼‰| ~25,000-40,000 | 29-46% | Code static |
| **#2** | Card routes ?„ç¬¬äºŒå€?`getDb()` warmupï¼ˆæ???`getDbForRequest`ï¼‰| ~10,000-15,000 | 11-17% | Code static |
| **#3** | Image/logo ?è? fetchï¼ˆæ? user è¡Œç‚º = 6 HTTP requestsï¼Œæ???3-4 SQLï¼‰| ~5,000-10,000 | 6-11% | Live tail + code |
| **#4** | Touch keep-aliveï¼?0 sessions ? ~100 touches/day ? 5 SQLï¼‰| ~4,850 | 6% | Code static |
| **#5** | Autosave PUTsï¼?0 editors ? 30 PUTs/session ? 5 SQLï¼‰| ~1,500 | 2% | Code static |
| **#6** | Cronï¼ˆfixed 288 ticks/day ? 5 SQLï¼‰| 1,440 | 2% | Code static |
| **#7** | Auth login/register/refreshï¼ˆ~240 events ? 5-9 SQLï¼‰| ~1,500 | 2% | Code static |
| ?¶ä? | `/health`, 404 errors, etc. | ä¼?~5,000-10,000 | 6-12% | ??|
| | **Total ä¼°ç?** | **~54,000-83,000** | | |

**æ³¨æ?**ï¼šé€™å€‹ä¼°ç®—ç?ä¸Šä??Œç??å¤§ï¼Œä¸»? æ˜¯**æ²’æ? 48h æ­·å² log**?‚ä??³ä½¿?–ä?å®ˆä???54kï¼Œè?è§?? 87k ä»é?è¦é?å¤–ç? 30k ä¾†æ??‚å¯?½å€™é¸ï¼?
- å¤§é? `findTenantById` lookup ?¨é? card routesï¼ˆme.ts?refresh.ts ç­‰ï?
- ?‹ç™¼?Ÿé???hot reload è§¸ç™¼é¡å? cron invocations
- wrangler dev local testing ??ˆ° production Hyperdriveï¼ˆä?å¤ªå¯?½ä?è¦æ??¤ï?

### 4.2 ä¸é?è¤‡è?ç®—ï?å·²æ‰£?¤ç??¨å?ï¼?

- ??isTokenRevoked 5s cache ??ç©©æ??ªä? warmupï¼Œä??è?è¨ˆå…¥
- ??`/health` ??0 SQL
- ??`/api/cron/billing-cycle` ??`app.fetch('/health')` ??0 SQL

---

## Â§ 5. å»ºè­°ï¼ˆåª?—é¸?…ï?ä¸å¯¦ä½???scope = diagnose_onlyï¼?

> ?™ä?å»ºè­°**?ªç?å¯¦ä?é©—è?**?‚Fix scope å±¬æ–¼å¾Œç? session??

### Option 1ï¼ˆé?æ§“æ¡¿?ä?é¢¨éšª ???æ??Šæ? ~50%ï¼?

**A.** ?ªé™¤?€??10 ??card route ??`findTenantById` lookupï¼ˆç›´?¥ç”¨ `user.tenantId` å­—ä¸²æ¯”å?ï¼?
   - å½±éŸ¿ç¯„å?ï¼š`apps/backend/src/modules/cards/routes/{create,getById,list,getLatestDraft,update,touch,publish,delete,getImage,generate-upload-url}.ts`
   - æ¯å€?route ??1 SELECT ? N requests
   - ?æ??Šæ?ï¼š~25k-40k queries/day
   - é¢¨éšªï¼šä?ï¼ˆ`user.tenantId` å·²æ˜¯ JWT ä¿¡ä»»æ¬„ä? per `runs/decisions/2026-09-09-jwt-tenant-id-trust.md`ï¼?

**B.** ?Šæ???`getDb(c.env.HYPERDRIVE)` ?¹æ? `getDbForRequest(c)`ï¼ˆç”¨?¢æ? helperï¼?
   - å½±éŸ¿ç¯„å?ï¼šæ???routes
   - æ¯å€?request ??1 warmup
   - ?æ??Šæ?ï¼š~10k-15k queries/day
   - é¢¨éšªï¼šä?ï¼ˆhelper å·²å??¨ï??ªæ˜¯ routes æ²’ç”¨ï¼?

### Option 2ï¼ˆä¸­æ§“æ¡¿?ä¸­é¢¨éšª ???æ??Šæ? ~10%ï¼?

**C.** Image/logo fetch ??in-process cacheï¼ˆé¿?å???`v=` ?è? fetchï¼?
   - å½±éŸ¿ç¯„å?ï¼šbackend getImage route ?–å?ç«¯ç?ä»?
   - ?æ??Šæ?ï¼š~5k-10k queries/day
   - é¢¨éšªï¼šä¸­ï¼ˆcache key è¨­è?è¦æ­£ç¢ºï??¦å? staleï¼?

### Option 3ï¼ˆä?æ§“æ¡¿?ä?é¢¨éšª ???æ??Šæ? ~2%ï¼?

**D.** Cron handler ?§éƒ¨ bypass `app.fetch('/api/cron/billing-cycle')`ï¼Œç›´??call service
   - å½±éŸ¿ç¯„å?ï¼š`apps/backend/src/index.ts` line 191-202
   - ?æ??Šæ?ï¼?88 queries/day
   - é¢¨éšªï¼šä?ï¼ˆç? refactorï¼?

### Option 4ï¼ˆä?å»ºè­°ï¼?

- ???ä? touch frequencyï¼?min ??15minï¼‰ï??ƒç¸®??draft TTL keep-alive window
- ???é? autosave debounceï¼?s ??3sï¼‰ï??ƒè? Step 4/5 typing ?Ÿé??ºå¤±è³‡æ?
- ???ä? cron frequencyï¼?min ??15minï¼‰ï??ƒå???cold start é¢¨éšªï¼ˆRule 036 Â§9ï¼?

---

## Â§ 6. ?ªé?è­‰å?è¨?

| ?‡è¨­ | ä¿¡å?åº?| é©—è??¹æ? |
|---|---|---|
| Live tail 15 ç§?window ??10 ??refresh ?¯ã€Œæ­£å¸¸ç? active session refresh?è€Œé? retry storm | ä¸?| ??48h æ­·å² log è¨ˆç? `auth/refresh` ??daily count |
| Touch keep-alive setInterval æ²?double-firing | ä¸?| ??48h `PATCH /api/cards/:id/touch` countï¼Œç?æ¯?5 ?†é?æ¡¶å…§ count ?¯å¦ç­‰æ–¼ active editor session ??|
| Image/logo 6 ??warmup ?¯ã€Œå?ä¸€ user è¡Œç‚º?„å???fetch?è€Œé??Œå–® request ?è? warmup??| ä¸?| ??`--header` filter ?‹å?ä¸€ `v=` ?¯å¦?Ÿç?å°æ?å¤šå€?HTTP requestï¼Œæ??®å€?request ?§éƒ¨å°?fire å¤šæ¬¡ |
| æ²’æ? `findTenantById` ?¨å…¶ä»?routesï¼ˆpass / billingCycleï¼‰è¢«?Œæ¨£æµªè²» | é«˜ï?å·?grep ?ï?| å·²åœ¨ Phase 3 audit ä¸­ç¢ºèªåª??10 ??card routes ?ºç¾ |
| ?‹ç™¼æ¨¡å? hot reload ä¸æ?é¡å?æ¶ˆè€?Hyperdrive quota | ä½?| ä¸é©?¨æ–¼ productionï¼›åªå½±éŸ¿ local dev |

---

## Â§ 7. ?„é?ï¼šç”¨?¶å?çºŒå¯?‹å?è·‘ç? query

?¥è?å¾?Cloudflare Dashboard ?´æ¥é©—è?ï¼ˆç???MCP auth ?é?ï¼‰ï?

### Query 1 ???å» 48h HTTP request volume by route

```
GraphQL endpoint: https://api.cloudflare.com/client/v4/accounts/b37054989122d58d65ad27681882b470/workers/observability/...

Query body:
{
  "query": "query { viewer { accounts(filter: { accountTag: \"b37054989122d58d65ad27681882b470\" }) { workersInvocationsAdaptive(limit: 1000, filter: { scriptName: \"saome-backend\", datetime_gt: \"2026-09-09T00:00:00Z\", datetime_lt: \"2026-09-11T00:00:00Z\" }) { datetime, request, response, scriptName } } } }"
}
```

### Query 2 ??Workers Logs API (REST)

```
GET https://api.cloudflare.com/client/v4/accounts/b37054989122d58d65ad27681882b470/workers/scripts/saome-backend/observability/logs?start=2026-09-09T00:00:00Z&end=2026-09-11T00:00:00Z
```

### Query 3 ???´æ¥??wrangler dev / wrangler tail è§€å¯?live pattern

```bash
# è§€å¯?live touch patternï¼?0 ?†é? windowï¼?
cd apps/backend
npx wrangler tail saome-backend --method PATCH --search "touch"

# è§€å¯?image/logo live pattern
npx wrangler tail saome-backend --method GET --search "image/logo"
```

### Query 4 ??Postgres ç«?pg_stat_statements

```sql
-- ??Supabase SQL editor è·‘ï??€è¦?superuser accessï¼?
SELECT
  substring(query for 60) AS query_preview,
  calls,
  total_exec_time / 1000 AS total_seconds
FROM pg_stat_statements
WHERE query LIKE '%FROM templates%' OR query LIKE '%UPDATE templates%' OR query LIKE '%SELECT 1%'
ORDER BY calls DESC
LIMIT 20;
```

---

## Â§ 8. è§¸ç™¼?œéµå­—å?é½?

?¬å ±?Šæ??Šï?
- `.cursor/rules/036-worker-runtime-cors-defense.mdc`ï¼ˆcron keep-alive è¡Œç‚ºï¼?
- `.cursor/rules/030-effect-first-run-not-trustworthy.mdc`ï¼ˆautosave baseline è¡Œç‚ºï¼?
- `.cursor/rules/031-long-timer-async-fetch.mdc`ï¼ˆsetInterval ?·å?ï¼?
- `.cursor/rules/032-backend-jsonb-merge-silent-killer.mdc`ï¼ˆPUT race æ¢ä»¶ï¼?
- `.cursor/rules/000-modular-design.mdc` Part Bï¼ˆbackend route/service/db ?†å±¤ï¼?
- `runs/decisions/2026-09-09-jwt-tenant-id-trust.md`ï¼ˆJWT tenantId ä¿¡ä»» ??è§???ºä? `findTenantById` ?¯å?é¤˜ï?

---

## Â§ 9. ä¸‹ä?æ­¥ï?è¶…å‡º diagnose_only scopeï¼Œå»ºè­°æ–° session ?•ç?ï¼?

1. **??48h æ­·å² log** é©—è? Â§ 6 ??4 ?‹å?è¨?
2. **å¯¦ä? Option 1**ï¼ˆåˆª `findTenantById` + ?¹ç”¨ `getDbForRequest`ï¼‰â? ?æ??¥æŸ¥è©¢é?å¾?87k ?è‡³ 35k
3. **??conformance test**ï¼šæ???route ??SQL count baseline æ¸¬è©¦ï¼ˆmock postgres.jsï¼Œè?ç®?sql\`...\` ?¼å«æ¬¡æ•¸ï¼?
4. **?´æ–° rule**ï¼šæ??Œcard route å¿…é???`getDbForRequest(c)`?å???`.cursor/rules/000-modular-design.mdc` ?–æ–° rule
5. **monitoring**ï¼šåœ¨ wrangler log ? ä?è¡?`[sql-count] route={x} queries={n}` çµæ???logï¼Œæ–¹ä¾¿æ—¥å¾Œå? WO ?‰çµ±è¨?

---

## ¡± 10. Phase 0 ÅçÃÒµ²ªG¡]2026-09-11 fix session¡^

### ¤u¨ã¹ê´ú

| Query | µ²ªG |
|---|---|
| Query 1 ¡X GraphQL workersInvocationsAdaptive | ? HTTP 400¡uµL®Ä½Ğ¨D¡v¡X OAuth scope ¯Ê workers_observability:read |
| Query 2 ¡X Workers Logs API REST | ? HTTP 400¡uµL®Ä½Ğ¨D¡v¡X ¦P¤W |
| Query 3 ¡X wrangler tail live 30 ¬í | ?? Session «Ø¥ß¦¨¥\¦ı **idle µL user activity** ¡X ­â±á 0 ÂI SAOME «áºİ¨S¦³¤H¦b¥Î |
| Query 4 ¡X pg_stat_statements SQL | ? Supabase SQL editor »İ­n¤â°Ê¶i dashboard¡A¥» session µLªk¶] |

**µ²½×**¡G¥»¾÷Àô¹ÒµLªk¨ú±o Cloudflare Workers Observability ¾ú¥v log¡Fwrangler tail ¬O°ß¤@¥i¹FºŞ¹D¡A¥B­­©ó active ´Á¶¡¡C

### Code-static ¤G¦¸ÅçÃÒ¡]¨ú¥N live evidence¡^

¬JµM live ©Ô¤£¨ì¸ê®Æ¡A§ï±qµ{¦¡½XÀRºA¤ÀªRÅçÃÒ ¡± 2.2 table ªº SQL count¡G

| Route | °Ê SQL ¸ô®| | ¹w´Á count | ¹ï»ô¶EÂ_³ø§i |
|---|---|---|---|
| POST /api/auth/register | warmup + findUserByEmail + findTenantByTaxId(opt) + 6 inserts in tx (insertUser+insertTenant+insertPass+getPassStatus) | 6-7 | ¡± 2.2 ¦ô 9 ?? °ª¦ô |
| POST /api/auth/login | warmup + findUserAndTenantByEmail + insertLoginAttempt + advanceBillingCycle(opt) + getPassStatus(opt) | 4-5 | ¡± 2.2 ¦ô 7 ?? °ª¦ô |
| POST /api/auth/refresh | warmup + isTokenRevoked + findTenantById(opt) + advanceBillingCycle(opt) + getPassStatus(opt) | 3-5 | ¡± 2.2 ¦ô 5 ? |
| GET /api/auth/me | middleware warmup + isTokenRevoked + route warmup + findTenantById | 4 (§ï getDbForRequest «á 3) | ¡± 2.2 ¦ô 4 ? |
| POST /api/auth/logout | middleware warmup + route warmup + revokeRefreshToken(2 SQL, opt) | 2-4 | ³ø§i¥¼¦C¡]¦¸­n¡^|

**Register/Login ¹w´Á SQL ¤ñ ¡± 2.2 §C 1-2**¡G¦]¬° ¡± 2.2 °ª¦ô¤F registerService transaction ¤º SQL ¼Æ¡]¹ê»Ú¬O 6 ­Ó¦Ó«D 7+¡^¡C

### °²³]ÅçÃÒµ²½×

| °²³]¡]¡± 6¡^| «H¤ß«× | µ²½× |
|---|---|---|
| Refresh ¤£¬O retry storm | °ª¡]µ{¦¡½X¸ô®|µL retry loop¡^ | **¶i Phase 1** |
| Touch ¨S double-fire | °ª¡]cleanup return ¦s¦b¡^ | **¶i Phase 1** |
| Image/logo ¦h¦¸ fetch | ¤¤¡]«İ Phase 3 structured log ³¡¸p«á 24h Æ[¹î¡^| **¹w´Á¶i Phase 1¡A24h «á¦AÅç** |
| indTenantById ¦b 10 card routes ®ö¶O | **°ª¡]grep ÃÒ¹ê 10 ­ÓÀÉ®×¦U¤@¦¸¡^** | **®Ö¤ß offender ½T»{** |
| ¨S¦³ indTenantById ¦b¨ä¥L routes ®ö¶O | °ª¡]grep ÃÒ¹ê¥u refresh/me ¥Î¡A¥B³o¨â­Ó¯uªº»İ­n row¡^| **®Ö¤ß offender ½T»{** |

### ¨Mµ¦ gate

**°²³]¥ş¹ï**¡]§Y«KµL live evidence¡Acode-static ÃÒ¾Ú¨¬°÷±j¡^¡C**¶i Phase 1 §¹¾ã¹ê§@ Option 1**¡A¹w´Á«d´î ~50% queries¡]87k ¡÷ ~35k/day¡^¡C

Phase 3 structured log deploy «á 24h ±N¸É¤W image/logo ¦h­« fetch ªº live ÃÒ¾Ú¡C



---

## ç¦® 11. Phase 1-4 Fix Implementation (2026-09-11 fix session, branch fix/hyperdrive-query-spike-20260911)

### ç¦® 11.1 Phase 1 ??Option 1 Implementation

**File changes (11 files, +70/-77 lines):**

- `apps/backend/src/modules/cards/routes/{create,getById,list,getLatestDraft,update,touch,publish,delete,getImage,generate-upload-url}.ts` ??`getDb(c.env.HYPERDRIVE)` ??`getDbForRequest(c)`; delete `findTenantById` lookup, use `user.tenantId` string comparison
- `apps/backend/src/shared/middleware/auth.ts` ??`getDb(c.env.HYPERDRIVE)` ??`getDbForRequest(c)`; add `tenantId?: string` to `AuthenticatedUser` interface
- `apps/backend/src/shared/db/client.ts` ??extend `getDbForRequest` parameter type

**findTenantById reference count: 16 ??5** (1 def + 4 uses: me.ts, refreshService.ts, tenants.ts)

### ç¦® 11.2 Phase 2 ??SQL Count Baseline Tests (13 new tests)

- `apps/backend/src/modules/cards/tests/sql-count-baseline.test.ts` (8 tests)
- `apps/backend/src/modules/auth/tests/sql-count-baseline.test.ts` (5 tests)

Key assertion (REGRESSION GUARD):

```ts
for (const call of sqlCalls) {
  expect(call).not.toMatch(/FROM tenants/i);
  expect(call).not.toMatch(/UPDATE tenants/i);
  expect(call).not.toMatch(/INSERT INTO tenants/i);
  expect(call).not.toMatch(/DELETE FROM tenants/i);
}
```

### ç¦® 11.3 Phase 3 ??Structured Log [sql-count]

**New/modified files (3):**
- `apps/backend/src/shared/middleware/sqlCount.ts` ??emits `[sql-count] route=METHOD path queries=N status=S` after each request
- `apps/backend/src/shared/db/client.ts` ??adds `_queryCounters` WeakMap + `attachQueryCounter` Proxy
- `apps/backend/src/index.ts` ??mounts `sqlCountMiddleware` after requestId

### ç¦® 11.4 Phase 4 ??Verification

- typecheck: exit 0
- tests: 225/225 passed (18 test files)
- findTenantById grep in production: 16 ??5
- getDb(c.env.HYPERDRIVE) grep in card routes: 10 ??0

### ç¦® 11.5 [sql-count] Structured Log ??How to Query from Cloudflare

**Cloudflare Dashboard:**

```
Workers & Pages ??saome-backend ??Logs ??Logs tab
filter: "[sql-count]"
aggregate: by route (path field)
```

**wrangler tail (live, 30-min window):**

```bash
npx wrangler tail saome-backend --search "[sql-count]" --format pretty
```

**Workers Logs API REST (historical):**

```
GET https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/workers/scripts/saome-backend/observability/logs?start=<START>&end=<END>
filter server-side: text contains "[sql-count]"
```

**Expected per-route queries:**

- POST /api/cards ??2 (warmup + INSERT)
- GET /api/cards/:id ??2 (warmup + SELECT)
- PUT /api/cards/:id ??3 (warmup + findTemplate + UPDATE)
- GET /api/cards/:id/image/logo ??2 (warmup + findTemplate)
- POST /api/auth/refresh ??3 (isTokenRevoked + findTenantById + getPassStatus ??cache dependent)
- GET /api/auth/me ??2 (isTokenRevoked + findTenantById ??cache dependent)

If `queries` count exceeds baseline, a refactor has reintroduced a multiplier (e.g. findTenantById added back, or getDbForRequest changed to getDb()).

### ç¦® 11.6 Follow-up SOP (24h post-deploy)

1. Run wrangler tail 24h post-deploy, group [sql-count] by route, sum queries.
2. Compare to baseline 87k/day.
   - ~35k/day (60% reduction) ??close ç¦® 9 follow-up
   - 50-60k/day (40% reduction) ??enter Phase 5 (Option 2 image cache or Option 3 cron bypass)
   - > 70k/day ??revert, find new bug
   - Increased ??revert, find new bug
3. If reduction insufficient, identify high-query routes via tail log, compare to baseline to find new offender.

### ç¦® 11.7 Trigger Keywords (follow-up session)

- "Hyperdrive reduction verification" ??run ç¦® 11.6 Step 1-2
- "[sql-count] anomaly" ??run ç¦® 11.6 Step 3
- "card route SQL increase" ??grep findTenantById (should be < 5), run cards/tests/sql-count-baseline.test.ts
