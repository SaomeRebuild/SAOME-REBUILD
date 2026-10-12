# 2026-10-12 Step 8 v8 fix — Passcreator V2 update 用 `POST` 不是 `PUT`

> **對應 commits**: 本次 fix 還未 commit（待 user 驗證後 commit）
> **根因**: `updatePassTemplate` 用 `PUT /api/v2/pass-template/:id`，但 Passcreator V2 全部 mutation 統一用 `POST`（V1 才是 `PUT /api/pass-template/[id]`）。這是把 V1 的 PUT 慣例誤抄到 V2 的 path — Passcreator 對不存在的 method+path route 回 nginx 的 404 HTML 頁 (`<html lang="de">`),User 在前端看到「service temporarily unavailable」。
> **日期**: 2026-10-12
> **類型**: bug fix (L2 Standard — critical chain 上的後續)
> **對齊**: `runs/improvements/feedback/20261011-step8-passcreator-push.md` (v6 fix) + `runs/improvements/feedback/20261012-step8-passcreator-create-id-parse.md` (id parse fix) + `runs/improvements/feedback/20261012-step8-passcreator-strip-additional-props.md` (v7 fix)

---

## 1. 症狀

User 2026-10-12 把 v7 fix（strip 圖 + additionalProperties）部署上去後,Step 8 publish 跳出:

```
Passcreator sync failed
Passcreator service is temporarily unavailable. Your card was saved
locally — please try again in a few minutes.

Error details · HTTP 404
non-JSON response:
<!DOCTYPE html>
<html lang="de" ...
```

**這個 404 是新症狀,在 v6 / id-parse fix / v7 fix 期間沒有**,所以 root cause 不是 v7 那兩個 fix (images.background 重命名 + additionalProperties build),而是 `updatePassTemplate` 自己長期帶著的 bug — 只是 v7 改完後第一次真的是 PUT 出去才被 user 撞到。

舊檔裡有一段錯的 doc comment:

```ts
/**
 * Update an existing Passcreator template by id.
 *
 * PUT semantics on Passcreator V2 (PATCH is also accepted; we use PUT
 * to match the "full template body" convention). Idempotent: a no-op
 * update (same body) returns 200 with the existing record.
 */
```

這段 comment 把 V1 的 PUT 慣例跟 V2 的 mutation 慣例混在一起 — 上一個 coder 沒對 V2 的實際 endpoint (`POST`) 就直接寫了「PUT is also accepted, we use PUT」。

---

## 2. 根因

### 2.1 V2 update 一定是 `POST`,不是 `PUT`

對照 `mu-plugins/Passcreator/V2 end point/Pass template/update-a-template.md` 第 3 行 + 第 21 行:

```text
## POST /api/v2/pass-template/{identifier}
Update an existing pass template.
```

跟旁邊 `pass-template-management.md` (create endpoint):

```text
### POST /api/v2/pass-template
Create a new pass template ...
```

跟 `create-apple-wallet-enhanced-event-tickets.md` (iOS 18 Enhanced Event Tickets doc):

```text
- Create template: POST /api/v2/pass-template
- Update template: PUT /api/v2/pass-template/{templateIdentifier}
  *(if your account setup uses a different update route, follow your
  account's documented update endpoint)*
```

**V2 全部 mutation 都用 POST** — V1 的 `PUT /api/pass-template/[id]` 在 V2 改寫成 `POST /api/v2/pass-template/:id`。

那份 iOS 18 doc 寫的 "PUT ... if your account setup uses a different update route" 是 YMMV 提示,但 SAOME 用的就是 canonical V2 path (`/api/v2/pass-template` + POST)。

只有 V1 文件 (`mu-plugins/Passcreator/V1 end point/Pass template/update-a-pass-template.md`) 是 `PUT`:

```text
## PUT /api/pass-template/[id]
```

**前一個 coder 把 V1 的 PUT 抄到 V2 的 URL path**,所以 Passcreator 對 `PUT /api/v2/pass-template/<uuid>` 沒對應 route,直接掉到 nginx default 404 (`<!DOCTYPE html><html lang="de">` = 部署在德國)。

### 2.2 為什麼這個 bug 沒被測試抓到

舊的 test 寫得跟 code 一樣錯:

```ts
it('uses PUT method (full template body convention)', async () => {
  ...
  expect(method).toBe('PUT');
});
```

這條 test 把 code 的錯誤行為當作 contract 鎖起來,所以 PUT 永遠綠、`POST` 永遠紅 — 反向的 regression guard。

### 2.3 為什麼 manual / curl probe 也沒抓到

`apps/backend/scripts/probe-real-payload.cjs` 跟 `capture-passcreator-errors.cjs` 是拿來 debug「V2 拒絕我們的 body」(kind: `upstream_rejected`) 的 — 它們只會 probe **正確 endpoint** (`POST /api/v2/pass-template`),不會主動去戳 update 端的不存在 method。所以 PUT 4xx/HTML 404 從沒被 capture 過。

---

## 3. 修法

### 3.1 改 `passcreator.ts::updatePassTemplate` 一行

```diff
-    { method: 'PUT', body },
+    { method: 'POST', body },
```

加上一段長 comment 解釋為什麼是 POST (避免下一個 coder 又把它 flip 回 PUT)。Comment 引用 V2 doc 原文跟這次事故日期。

### 3.2 改既有 test 從「pin 錯行為」變「pin 對行為」

**修前** (`passcreator.test.ts`):

```ts
it('uses PUT method (full template body convention)', async () => {
  ...
  expect(method).toBe('PUT');
});
```

**修後**:

```ts
it('uses POST method (V2 endpoint convention — regression 2026-10-12)', async () => {
  // Passcreator V2 update is `POST /api/v2/pass-template/{identifier}`,
  // NOT PUT. The V1 API used `PUT /api/pass-template/[id]` which we
  // mistakenly carried over into the V2 path — Passcreator's edge /
  // nginx returned a 404 + lang="de" HTML page (route does not exist
  // for PUT), surfaced to the SAOME user as "Passcreator sync failed
  // (service temporarily unavailable)". This test pins POST.
  ...
  expect(method).toBe('POST');
  // Pin path + method together so a future refactor that flips PUT
  // back doesn't silently regress.
  expect(url).toBe('https://app.passcreator.com/api/v2/pass-template/pc-1');
});
```

**修前** (`passcreator.test.ts`):

```ts
it('extracts errors[] from PUT 400 (updatePassTemplate)', async () => {
  // Same envelope as POST — verify the extraction works for both verbs.
```

**修後**:

```ts
it('extracts errors[] from update 400 (POST updatePassTemplate — regression 2026-10-12)', async () => {
  // V2 update uses POST. Same envelope shape as create — verify the
  // extraction works for the update verb.
```

### 3.3 改其他模組的 docstring

- `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` line 6-9:
  修前寫「`POST /api/v2/pass-template` and `PUT /api/v2/pass-template/:id`」,
  修後寫「`POST /api/v2/pass-template` (create) and `POST /api/v2/pass-template/:id` (update).
  NOTE: V2 update is `POST`, NOT `PUT` — V1 used PUT, V2 standardized
  on POST for all mutations. See `passcreator.ts::updatePassTemplate`
  for the regression trace (2026-10-12).」
- `apps/backend/src/modules/pass-templates/services/passTemplateSync.ts` line 86:
  「Idempotent update — Passcreator PUT semantics」→
  「Idempotent update — Passcreator V2 uses `POST /api/v2/pass-template/:id`
  (NOT PUT; V1 was PUT, V2 standardized on POST for all mutations).」

### 3.4 沒做的事

- ❌ **不**動 `createPassTemplate` (已經用 POST,正確)
- ❌ **不**動 `fetchPassTemplate` (已經用 GET,正確)
- ❌ **不**動 SAOME 自己的 `/api/cards/:id PUT`(這是 SAOME 內部 API,跟 Passcreator 的 method 慣例無關)
- ❌ **不**重寫 `passcreator.test.ts` 整套 test — 只動有問題的 2 條 + 1 條 inline comment

---

## 4. 驗證

```text
$ npm test --workspace=apps/backend -- --run passcreator
 ??src/shared/lib/passcreator.test.ts (46 tests) 582ms
 ??src/modules/cards/tests/updateTemplate.passcreator.test.ts (5 tests) 93ms

 Test Files  2 passed (2)
      Tests  51 passed (51)

$ npm test --workspace=apps/backend -- --run
 Test Files  35 passed (35)
      Tests  600 passed (600)     ← 沒 regression

$ npm run typecheck --workspace=apps/backend
> tsc --noEmit
(無 output, exit 0)
```

### 4.1 受影響的測試

| 測試 | 修法 |
|---|---|
| `uses PUT method (full template body convention)` | 改寫成「uses POST method (V2 endpoint convention — regression 2026-10-12)」+ assert POST + pin 完整 URL `https://app.passcreator.com/api/v2/pass-template/pc-1` |
| `extracts errors[] from PUT 400 (updatePassTemplate)` | 改寫成「extracts errors[] from update 400 (POST updatePassTemplate — regression 2026-10-12)」 |
| `falls back to existing id when success envelope has data: []` | inline comment「PUT succeeds」→「update succeeds」(純文字) |

---

## 5. Out of scope（這次沒做、user 沒要求）

- ❌ **不在 controller / service 加「resolve unknown html 404 as BadGatewayError」的修正**:既有的 `passcreatorFetch` 已經會把 non-JSON body 包成 `BadGatewayError { kind: 'invalid_response' }`（連 404 + HTML 都進去了）,這次只是 URL+method 對了,前端那邊的「service temporarily unavailable」banner 自然會改成「sync 成功」的 happy path。
- ❌ **不**加 capture-passcreator-errors 的 PUT probe:這個 script 是 debug V2 upstream_rejected 用的,加一條 PUT probe 不會抓到 PUT 撞 404 的 CSS namin pattern,反而把 script 設計搞複雜。
- ❌ **不**動 i18n 的 banner copy:前端 banner 的 i18n key 已經對應到 `badGateway.kind === 'invalid_response'`、「service temporarily unavailable」是某個 fallback 文案 — 這個文案在 v6 + id-parse + v7 期間證明是對的方向(只是 backend fail 因為 method 不對才看到),不需要重寫。

---

## 6. 給 user 的訊息（重 deploy 後）

1. ✅ **Step 8 publish 上不去了**:這次改完 `updatePassTemplate` 用 `POST`,V2 update endpoint 接到正確 request 後會回 200 + success envelope,把 `data.identifier` 帶回 SAOME DB。
2. ✅ **deploy 上去後,既存 templates 會被這次 push 重新更新一次**(因為 mapper 還是產完整的 v7 body):正常,只是把既有 template 的 v7 設定 sync 上 Passcreator。
3. ℹ️ **「service temporarily unavailable」的 banner 文案暫時不動**:這個文案 v6 fix 之後就是 fallback — body mapping 有問題的時候才會跳出來。現在 backend 對了,banner 就消失在 happy path。

---

## 7. 參照

- 根因 V2 endpoint 結構:
  - `mu-plugins/Passcreator/V2 end point/Pass template/update-a-template.md` line 3, line 21, line 74 — V2 update 是 `POST`
  - `mu-plugins/Passcreator/V2 end point/Pass template/pass-template-management.md` line 9, line 33 — V2 create 也是 `POST`
  - `mu-plugins/Passcreator/V2 end point/Pass template/create-apple-wallet-enhanced-event-tickets.md` line 11-12 — 有個 YMMV 提示提到 `PUT /api/v2/pass-template/{id}` 的 fallback,但 canonical V2 是 `POST`
  - `mu-plugins/Passcreator/V1 end point/Pass template/update-a-pass-template.md` line 3 — V1 是 `PUT` ← 這是這次 bug 真正混到的來源
- 前置修復:
  - `runs/improvements/feedback/20261011-step8-passcreator-push.md` (v6 fix — colors / type / fields)
  - `runs/improvements/feedback/20261012-step8-passcreator-create-id-parse.md` (data.identifier parse fix)
  - `runs/improvements/feedback/20261012-step8-passcreator-strip-additional-props.md` (v7 fix — images.background + additionalProperties)
- 程式碼:
  - `apps/backend/src/shared/lib/passcreator.ts::updatePassTemplate` — 一行改 (`PUT` → `POST`) + 改寫 doc comment 解釋 V2 慣例
  - `apps/backend/src/shared/lib/passcreator.test.ts` — 2 條 test 改寫 (method assert, 400 envelope test)
  - `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` line 6-9 — docstring 修
  - `apps/backend/src/modules/pass-templates/services/passTemplateSync.ts` line 86 — inline comment 修
