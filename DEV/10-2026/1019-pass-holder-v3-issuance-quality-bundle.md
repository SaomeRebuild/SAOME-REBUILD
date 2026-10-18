# 2026-10-19 — Pass Holder V3 「user-visible quality」bug bundle（memberName + CTA platform icons + Tips + partial update + nonpaid wire-up + two-platform buttons）

> **Single entry point** for the four iterative bug-fix rounds that closed the Pass Holder V3 quality gaps between the d4ec81f + d348f14 commits and today's session. Scope = 1 backend service-layer contract drift + 1 backend partial-update silent killer + 1 backend wire-up drop + 1 frontend UX layer（platform CTA split + press-scale + visual baseline）。**本檔不重述 commit-level diff** — 4 個 feedback 已經是 detailed trace；本檔責任是「六條 user-visible bug 的根因分組 + cross-cutting 設計 + 給未來 session 的 invariant + 跟 d4ec81f / d348f14 的 lineage」。

## 一句話總結

**V3 issuance 的 backend wire 通了（d348f14 phase 2 closure）後，user 一打開 wallet App 看到 6 個 user-visible bug，全部在 10/19 當天收掉**：

| # | Bug 症狀 | 屬層 | 影響面 |
|---|---|---|---|
| 1 | 卡片上會員名字是空白 | backend wire shape | Apple Wallet / Google Wallet 內 holder name |
| 2 | iPhone / Android 看到同一個 icon + label 的下載按鈕 | frontend 渲染 | CTA 平台識別性 |
| 3 | Android Tips 說「請先裝 Passwallet」，沒提 Play Store 引導是正常現象 | i18n copy | Android UX 預期管理 |
| 4 | Production row 83d3139a 6 個 runtime 欄位 NULL | backend SQL partial update | 老 pass holder 拿不到下載鏈結 |
| 5 | 非付費模板註冊成功，下載頁空白（只看到「尚未發行」placeholder）| frontend wire-up drop | 整條 `/pass/{templateId}` 非付費流程 |
| 6 | 兩個下載按鈕內連結都一樣，文案都是 wallet 名，點下去沒反饋 | frontend CTA + a11y | 下載頁 UX |

六條都是「service 寫了 / wire 接了但下游收斂不到位」的 sibling bug — scope 集中在 Pass Holder V3，這個 session 全部 closure。

---

## Lineage（從 d4ec81f → d348f14 → 今日六條）

```
Phase 1 (2026-10-19 morning): d4ec81f
  ├─ V3 issuance / Passcreator `/api/v3/pass` 接線
  ├─ 4 層 schema sync (Rule 019 § 4.1)
  ├─ 7 column (pass_identifier / download_url / barcode_value / issued_at / issuance_error + placeholders for 2 URI)
  └─ ⚠ MCP apply 025 BLOCKED initially (Rule 037 regression family)

Phase 2 (2026-10-19 morning): d348f14
  ├─ MCP apply 025 recovered + append registry entry
  ├─ production barcode_value placeholder 清成 NULL + CHECK constraint (3 層 defense-in-depth)
  ├─ 補 2 column (iphone_uri / android_uri) → migration 026
  └─ 3 URI 全部 persist

Phase 3 (2026-10-19 afternoon): 本 session 四 round → 本 commit
  ├─ Round 3: Bug 1+2+3 (memberName wire shape + CTA 平台 icon + Tips 副本)
  ├─ Round 4: Bug 4 (Partial update + COALESCE + lost-data UI)
  ├─ Round 5: Bug 5 (Non-paid `onValidSubmit` propagate `result.issuance`)
  └─ Round 6: Bug 6 (Two-platform buttons split + press-scale + a11y baseline)
```

每條 bug 都 walk through 完整的 TDD RED → GREEN → REFACTOR 流程，符合 Rule 003 與 saome-card-save-load-pipeline SOP。

---

## Round 3 — Backend wire shape + Frontend CTA 平台分流 + i18n 副本 refresh（3-in-1 bug bundle）

3 條獨立但同 family（holder pass 在錢包 App 內的呈現品質）：

### Bug 1 — V3 payload `data.name` 跟 template placeholder `memberName` 不對齊

```
後端 wire shape (V3 docs 真實):
  data: { templateId, name, phone, birthday, email } ← docs說"name 欄位給 holder name"

SAOME template mapping:
  primaryFields[0].key: "memberName" ← v12 followup 2026-10-12 改的，不是 name

Passcreator placeholder 解析:
  {memberName} 只看 data.memberName，**不看 data.name**
```

**症狀**：user 在 Apple Wallet 打開 card，holder name 欄位**完全空白**。

**根因**：wire shape 跟 SAOME internal template placeholder key 不對齊，**沒有任何 test 抓到** — 因為 conformance test 都走 mock，沒有 user 真的在 wallet app 看過（Rule 040 live capture 的具體案例）。

**修法 4 件**：

1. `passcreator.ts::issuePass` V3 body 把 `name: holder.name` 改 `memberName: holder.name`
2. `PassIssueHolderData.name` docblock 補「**mapped to `data.memberName` on V3 wire**」
3. 同步 `capture-passcreator-v3.cjs::makeV3CreateBody` fixture（**capture script = fixture source-of-truth**，drift 等同 production drift）
4. 既有 `passcreator.test.ts` happy-path + non-ASCII round-trip test 改 pin 新欄位 + 2 條 v3-fix 新 test
   - ① happy path `data.memberName` 重命名驗證
   - ② capture fixture `v3-create-success.json` 對齊 wire shape 驗證

### Bug 2 — CTA icon 不分平台

```
iPhone user 看到: <Download icon /> + "加入 Apple 錢包" → href=iPhoneUri
Android user 看到: <Download icon /> + "加入 Apple 錢包" → href=androidUri  ← 同一個 icon + 同一個 label
Desktop user 看到: <Download icon /> + "加入 Apple 錢包" → href=downloadPage ← 還是一樣
```

3 個平台同一個視覺、3 個不同 href。User 看到 iPhone 的「加入 Apple 錢包」按下去實際上是 `androidUri` deeplink，第一個反應「等等，這不是 Apple Wallet 吧？」

**根因**：`pickDownloadUri()` 一個 helper 處理 URI 的 UA 分流，但**渲染層的 icon + label 沒跟著分流**。

**修法 3 件**：

1. 拆 `pickPrimaryCtaType(userAgent): 'apple' | 'android' | 'universal'`（純 platform 偵測）+ `pickPrimaryHref(issuance, ctaType)`（URI fallback chain）
2. Icon + label 用 ctaType 走 lookup table（switch 顯式列舉）

   | ctaType | Icon | zh-TW label | en label | href source |
   |---|---|---|---|---|
   | `'apple'` | `<Apple />` | `加入 Apple 錢包` | `Add to Apple Wallet` | `iPhoneUri ?? downloadPage` |
   | `'android'` | `<Smartphone />` | `加入 Google 錢包` | `Add to Google Wallet` | `androidUri ?? downloadPage` |
   | `'universal'` | `<Download />` | `下載 .pkpass` | `Download .pkpass` | `downloadPage ?? iPhoneUri ?? androidUri` |

3. Primary CTA 加 `data-cta-type="apple|android|universal"` attribute（test 跟 debug 金本位）

### Bug 3 — Tips 副本缺「首次引導」UX 訊息

舊 body：「iPhone 內建 Apple 錢包可直接加入。Android 用戶請先安裝 Passwallet App，再點上方『下載 .pkpass』開啟。」

沒提「**首次會被自動引導至 Play Store**」這個被 V3 自動觸發的 UX 流程 → user 看到 Play Store 跳轉以為是 bug。

**修法**：`passHolder.{zh-TW,en}.ts` `passwalletReminder.body` 直接 replace 成新副本（「如果 Android 裝置沒有 Passwallet，首次安裝卡片時會被引導至 Play 商店安裝 Passwallet，這是正常現象」），既有 success-path test 加 1 條 body assertion lock `Passwallet` + `正常` 兩 term 防未來 copy drift。

### Round 3 Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit -p apps/backend/tsconfig.json` | exit 0 |
| `npx tsc --noEmit -p apps/frontend/tsconfig.app.json` | exit 0 |
| `npx vitest run apps/backend/src/shared/lib/passcreator.test.ts` | **81/81 passed**（+2 v3-fix wire-shape conformance） |
| `npx vitest run src/components/business/pass/PassHolderPassDownload` | 11/11 passed（既有 7 + 4 新 platform-icon test） |
| `npm run verify:i18n` | 21 namespace OK |
| `node -c apps/backend/scripts/capture-passcreator-v3.cjs` | syntax OK |

對應 feedback：[`20261019-pass-holder-v3-membername-cta-copy.md`](../runs/improvements/feedback/20261019-pass-holder-v3-membername-cta-copy.md)

---

## Round 4 — Production row 83d3139a 6 個欄位 NULL（Partial update + COALESCE fix）

### 症狀

User 反饋 production row `83d3139a-c3bb-4806-8900-5e9b759d0122`：

```
pass_identifier:  NULL
download_url:     NULL
issued_at:        NULL
iphone_uri:       NULL
android_uri:      NULL
issuance_error:   NULL
                   ↓
                   唯一有值：barcode_value
```

### Root cause

```ts
// apps/backend/src/modules/pass-templates/db/passHolders.ts
async function updatePassHolderIssuance(sql, id, input) {
  await sql`
    UPDATE pass_holders SET
      pass_identifier = ${input.passIdentifier ?? null},
      download_url    = ${input.downloadUrl ?? null},
      barcode_value   = ${input.barcodeValue ?? null},
      issued_at       = ${input.issuedAt ?? null},
      issuance_error  = ${input.issuanceError ?? null}    // ← 注意：這個故意不用 COALESCE
    WHERE id = ${id}
  `;
}
```

`attemptIssuance` success path 對**同一個 row 跑兩次**：

1. 第一次 CREATE-response 7 欄全寫（identifier / downloadPage / barcode 等）
2. 第二次 barcode backfill 只傳 `barcodeValue` → 沒傳的 6 欄被 `?? null` 變 NULL → `SET = null` 抹掉第一次寫的值

**為什麼前幾輪測試全綠**：`passcreator.test.ts` + `register.test.ts` 都 `mock updatePassHolderIssuance 為 vi.fn()` — spy on function call signature，**完全沒檢查 SQL 內部 SET 行為**。

SAOME 第四次「mock-driven silent green」同 family（8/21 dynamic UPDATE `\$N` / 8/31 workerd JSON.stringify / 9/05 jsonb `||` / 本次 `SET = null`）— 共同 fingerprint：「mock 函式被 spy 取代，spy 只看 function call signature 沒看 SQL 內部行為」。

### 修法 4 件

1. **`updatePassHolderIssuance` SQL 改 partial update pattern**
   - 6 個 runtime 欄位（identifier / download / barcode / issued_at / iphone_uri / android_uri）用 `COALESCE(${input.X ?? null}, <col>)` 包裝
   - `COALESCE(NULL, col) = col` 保留 pre-existing
   - `issuance_error` **故意不用 COALESCE**：success 想清空 stale 錯誤、failure 想覆寫新 key，兩個相反期待不能靠 COALESCE

2. **4 條 partial update conformance test**（`passHolders.test.ts` 新檔，用 smart mock SQL dispatcher）

   | # | scenario | 驗證 |
   |---|---|---|
   | 1 | 5/6 欄位 omit → 5 個保留 pre-existing、1 個 NULL-write（barcode 是 null） | COALESCE pattern 對 5欄 OK |
   | 2 | 1/6 欄位 omit（identifier 漏） → 5 個新值、identifier 保留 | COALESCE pattern 對單欄 OK |
   | 3 | `issuanceError: undefined` → 清空舊值 | 不走 COALESCE 是對的（兩相反期待） |
   | 4 | `issuanceError: 'new error'` → 覆寫舊值 |  |

   first-round regex fail：`issued_at` 加了 `::timestamptz` cast 變 `COALESCE($4::timestamptz, issued_at)`，原本 regex `^COALESCE\(\$([0-9]+),\s*${col}\)` 沒考慮 cast。修成 `^COALESCE\(\$([0-9]+)(?:::[^,)]+)?,\s*${col}\)` 允許 optional cast。

3. **既有 8 條 register test 重跑 0 regression** — V3 success / barcode backfill / failure path 3 段都對 partial update 語意 idempotent

4. **Frontend lost-data fallback UI**（給 production 84d3139a 不可逆欄位的 recovery path）
   - `PassHolderLostDataBanner.tsx`（新 sub-component，主組件拆解後 ≤ 100 行符合 Rule 000 § A.1）
   - `PassHolderPassDownload` 加 `hasBarcodeButNoUri` state 分支（`hasError > hasAnyUri > hasBarcodeButNoUri > pre-launch` 4 階）
   - `passHolder.{zh-TW,en}.ts` `lostData.{title, body, contactCta}` 4 new keys

   為什麼 user-facing：V3 LIST 沒 identifier / iPhoneUri / androidUri 不可逆，UI 必給 user 明確 recovery path（聯絡客服 + barcode 保留），不是 silent 「尚未發行」copy。

5. **一次性 backfill script** `apps/backend/scripts/backfill-pass-holder-download-url.cjs`
   - dry-run 印 blast radius（30 行 affected）
   - `--apply` 模式 best-effort V3 LIST match → UPDATE `download_url` + `pass_identifier`
   - unique candidate 才 UPDATE（barcode string equality，V3 LIST 沒 email/phone 對應欄位）
   - `iphone_uri` / `android_uri` / `issued_at` 不可逆 user 必須重 register

### Round 4 Verification

| Check | Result |
|---|---|
| `npx tsc -b apps/{backend,frontend}/tsconfig*.json --noEmit` | exit 0 |
| `npm test --workspace=apps/backend` | 41 檔 / 730 tests 全綠（+4 partial update） |
| `npm test --workspace=apps/frontend` | 148 檔 / 1945 tests 全綠（+2 lost-data） |
| `npm run verify:i18n` | 21 namespace OK |
| `node -c apps/backend/scripts/backfill-pass-holder-download-url.cjs` | syntax OK |
| `npm run check:migrations` | 24 migrations OK（026 apply done in d348f14） |

對應 feedback：[`20261019-pass-holder-v3-partial-update-bug.md`](../runs/improvements/feedback/20261019-pass-holder-v3-partial-update-bug.md)

---

## Round 5 — Non-paid `onValidSubmit` 漏 propagate `result.issuance`

### 症狀

User 完成註冊（`/pass/{templateId}` 走非付費模板）轉到「下載 Pass」畫面，**只看到一行「尚未簽發 Pass，請稍候」placeholder**。沒有平台下載 CTA、沒有 barcode、沒有 Android Tips。

### Root cause

```ts
// PassHolderRegistration.tsx (修正前)
async function onValidSubmit(values) {
  try {
    setSubmitted(true);
    await passHolderService.register(values);   // ← await 但沒接 result！
    onSubmit();
  } finally { ... }
}

// docblock 註解誤導：「We snapshot in both paths to keep the contract uniform」
// 實際上只有 onCtaClick（付費）跟 onRetryIssuance（retry）有呼叫 setLastIssuance
```

修法後需要：

```ts
const result = await passHolderService.register(values);
setLastIssuance(result.issuance ?? null);   // ← 新增這兩行
setSubmitted(true);
```

**為什麼 test 沒抓到**：mock factory `vi.hoisted({register: vi.fn().mockResolvedValue({ok: true, passHolderId: 'mock-123'})})` 沒回 `issuance`；既有 13 條 test 「switches to Success view」只 assert `pass-holder-download` testid 存在（container mount 證據），沒 assert「**孩子 CTA / barcode / Tips 真的有 render**」（functional 證據）。

SAOME 第五次「mock-driven silent green」同 family（9/30 partial migration / 10/03 Passcreator schema / 10/16 paid 投影 / 10/19 V3 contract / 本次 wire-up silent green）。

### 修法 5 件

1. `onValidSubmit` 加 `const result = await passHolderService.register(...)` + `setLastIssuance(result.issuance ?? null)` 在 `setSubmitted(true)` 之前
2. docblock 換成 truth 版本（標 BOTH paths 都 propagate）
3. 2 條 conformance test（`PassHolderRegistration.test.tsx`）：
   - mock register 回 `issuance: { downloadPage, iPhoneUri, androidUri, barcodeValue }` → submit 後 `pass-holder-download-cta-demo-cafe` 出現 + `pass-holder-download-not-ready` 不出現 + textContent 不含「尚未簽發」（wire-up contract 端到端）
4. Defensive counterpart test：mock register 不回 `issuance` → submit 後 `pass-holder-download-not-ready` 出現 + 平台 CTA 不出現（防 over-correction）
5. feedback + INDEX row

### Round 5 Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit -p apps/frontend/tsconfig.app.json` | exit 0 |
| `npx vitest run PassHolderRegistration.test.tsx` | **35/35**（+2 新 conformance） |
| `npm test --workspace=apps/frontend` | 148 檔 / **1951** tests 全綠（1949 → 1951，+2 新） |
| `npm run verify:i18n` | 21 namespace OK |

對應 feedback：[`20261019-pass-holder-nonpaid-issuance-capture.md`](../runs/improvements/feedback/20261019-pass-holder-nonpaid-issuance-capture.md)

---

## Round 6 — Two-platform buttons split + press-scale + a11y baseline（capstone）

### 症狀

User 投訴三件（user-visible 互動品質）：

1. **「下載頁兩個按鈕裡面的連結都是下載頁連結」** — 兩顆 button 都 collapse 到同一個 URL
2. **「按鈕文案應該改成 For Android/For iOS」** — 當前文案是 wallet 名（"加入 Apple 錢包"），難以擴充
3. **「按鈕點擊要有一點動態的視覺效果」** — 點下去沒反饋，跟 feedback round 3 的 CTA icon 沒擴充 press-scale

### Root cause

`PassHolderDownloadButton` 之前 render Primary + Secondary 兩顆 CTA：
- Primary 用 `navigator.userAgent` 偵測平台分流 href（iPhone → iPhoneUri / Android → androidUri / Desktop → downloadPage）
- Secondary 永遠 `downloadPage`

問題在「**Primary vs Secondary 是隱含層級，UI 上沒標記**」 — 看起來一樣 user 不知道哪顆是 platform 專屬、哪顆是 universal fallback。當 V3 只回 `downloadPage` 或 platform-specific URI 缺失時，兩顆 button collapse 到同一個 URL。

UA detection 是 device-shame 邏輯 — 桌機幫人註冊、Android 註冊了轉 AirDrop 給 iPhone 朋友，這些合理 use-case 都被拒絕（桌機看不到 iPhone button / Android 看不到 iOS button）。

`transition-colors` 是設計 token 沒打到 transform 與 brightness，所以即使加了 hover、active 也只能變色，沒縮放、沒亮度變化。

### 修法 5 件

1. **重構 `PassHolderDownloadButton` render path**：移除 UA 整合層（`pickPrimaryHref` / `PrimaryCtaType` / `useMemo`），改成兩顆獨立 anchor 並排渲染（`...-cta-ios-${id}` + `...-cta-android-${id}`）

   ```tsx
   const iosHref = pickIosHref({ iPhoneUri, downloadPage });        // iPhoneUri ?? downloadPage ?? null
   const androidHref = pickAndroidHref({ androidUri, downloadPage }); // androidUri ?? downloadPage ?? null
   if (!iosHref && !androidHref) return null;   // 三 URI 全缺 → pre-launch branch

   {iosHref && <a href={iosHref} ...icon={Apple} label="For iOS" testid={`${testId}-cta-ios-${templateId}`} />}
   {androidHref && <a href={androidHref} ...icon={Smartphone} label="For Android" testid={`${testId}-cta-android-${templateId}`} />}
   ```

   Outer 是 `flex flex-col gap-3 md:flex-row` 容器；mobile 直排、desktop 並排。

2. **i18n key 重命名**（en + zh-TW 雙檔）：

   | Removed | Added (en) | Added (zh-TW) |
   |---|---|---|
   | `download.appleWallet: 'Add to Apple Wallet'` | `download.forIos: 'For iOS'` | `download.forIos: '給 iPhone 用戶'` |
   | `download.androidWallet: 'Add to Google Wallet'` | `download.forAndroid: 'For Android'` | `download.forAndroid: 'Android 用戶'` |
   | `download.directDownload: 'Download .pkpass'` | (removed) | (removed) |
   | `download.iosHint: 'iPhone users can add directly to Apple Wallet'` | (removed) | (removed) |

   zh-TW 嚴格遵守 Rule 023 § 翻譯書寫紀律 — 全中文，品牌名（`iPhone` / `Android`）verbatim 寫。

3. **Press-scale + brightness 視覺效果**（零成本、無新依賴）：

   ```tsx
   className="... transition-all duration-150
              hover:brightness-110
              focus-visible:ring-2 focus-visible:ring-offset-2
              active:scale-[0.97] active:brightness-90"
   ```

   - `transition-all` 取代 `transition-colors` — 涵蓋 transform 跟 brightness 過渡
   - `duration-150` — 比預設 200ms 稍快，按壓感更即時
   - `hover:brightness-110` — 雙字節 brand color 也吃得到 brightness 變化
   - `active:scale-[0.97]` — 3% scale 提供物理性「按下去」反饋，比 scale-95 細微、適合每次都按的 CTA
   - `focus-visible:ring-2 focus-visible:ring-offset-2` — 鍵盤 Tab 可達性（`focus-visible` UA-aware：滑鼠點不會觸發，鍵盤 Tab 才會 — 符合螢幕閱讀器 + 鍵盤使用者期待）
   - 沒加 `framer-motion` / `motion-one` / `motion` 等 lib — Tailwind utilities 跟既有 codebase 一致

4. **Test contract 改寫**（`PassHolderPassDownload.test.tsx` + parent `PassHolderRegistration.test.tsx`）：

   - **新增 press-scale visual conformance test** — 兩顆 anchor 都 pin `transition-all` / `duration-150` / `hover:brightness-110` / `active:scale-[0.97]` / `focus-visible:ring-2` class，鎖定未來 refactor 不能悄悄拔掉視覺效果
   - **新增「BOTH CTAs render on every user-agent (regression — no UA gating)」** — 顯式 iPhone UA 跑測，verify 兩顆 button 都 render，鎖定 UA 不能決定 visibility
   - **新增 defensive fallback** — 「renders only Android CTA when only androidUri is set」 + 「renders only iOS CTA when only iPhoneUri is set」（hide-not-fallback when no native + no universal）
   - **既有 7 條 test 全部更新**成新 testid + 新 label assertion（`...-cta-ios-${id}` / `...-cta-android-${id}`）
   - `PassHolderRegistration.test.tsx` 兩個 `pass-holder-download-cta-demo-cafe` reference 改成 `pass-holder-download-cta-ios-demo-cafe`（testid 變平台-specific，行為不變）

5. **`PassHolderPassDownload.stories.tsx` mirror i18n** — `passHolderZhTW` 內嵌資源拿掉 `appleWallet` / `directDownload` / `iosHint`，換 `forIos` / `forAndroid`

### Round 6 Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit -p apps/frontend/tsconfig.app.json` | exit 0 |
| `npx vitest run PassHolderPassDownload.test PassHolderRegistration.test` | **16 + 35 tests** 全綠（PassHolderPassDownload 從 11 → 16，+5 新 conformance） |
| `npm test --workspace=apps/frontend` | 148 檔 / **1956 tests** 全綠（1951 → 1956，+5 新 = Round 5 的 2 wire-up + Round 6 的 5 visual contract = 7） |
| `npm run verify:i18n` | 21 namespace OK（`forIos` / `forAndroid` 兩 locale 都解析得到） |
| `npm run lint` | pre-existing warnings 數量不變（無 new warnings） |

對應 feedback：[`20261019-pass-holder-split-two-platform-buttons.md`](../runs/improvements/feedback/20261019-pass-holder-split-two-platform-buttons.md)

---

## 6 條 bug 的根因分組（給未來 session 看的 cross-cutting view）

| family | bug count | SOP（Rule reference） |
|---|---|---|
| **Mock-derived silent green**（mock 進 mock 出 → production 行為漂移）| 4 / 6 | Rule 019 §4.1 補強：conformance test 必走 live-captured fixture（d86b55e capture script + parser fix SOP） |
| **UA-keyed hidden layer**（`navigator.userAgent` 偵測讓 component 對 user 不可控）| 2 / 6 | Rule 013 / i18n 規範：user-facing 行為不該依賴 UA；改成 explicit two-platform render |
| **a11y baseline 缺失**（`focus:` vs `focus-visible:` + transition-colors 沒覆蓋 transform/brightness）| 1 / 6 | Rule 033 CTA baseline：互動元素必 `focus-visible:ring-2` + transition-all + press-scale + brightness |
| **Stale docblock**（code claim 跟 implementation drift）| 1 / 6 | Code review checklist 必掃「docblock vs implementation gap」 |

詳細 cross-cutting 教訓見各 feedback 末段；本檔只列「家族 fingerprint」。

---

## 架構全景（4 round 後的 `/pass/{templateId}` flow）

```
[User] /pass/{templateId}?via=...
  ├─ GET /api/pass-templates/:id/public (public template metadata + tier snapshot)
  │   └─ Tier list + cost + currency
  │
  └─ POST /api/pass-templates/:id/register (PassHolderRegistration)
      ├─ zod parse (request.ts) → age >= 13 + email + phone checks
      ├─ db/passHolders.ts::upsertPassHolder (idempotent on UNIQUE(template_id, email))
      │   └─ pass_holders.partial unique index on pass_identifier (Race-free double-issue)
      │
      ├─ services/registerService.ts::attemptIssuance
      │   ├─ existing-row skip (pass_identifier already set)
      │   ├─ pre-launch skip (template settings missing v3 templateId)
      │   └─ Passcreator V3 /api/v3/pass?async=false { data: { templateId, memberName, phone, birthday, email } }
      │       ├─ V3 envelope or legacy flat shape → extractPassIssueData
      │       ├─ barcode placeholder normalize (BARCODE_VALUE_PLACEHOLDERS set)
      │       ├─ error entries normalize (V3 string[] → {property, message} wrap)
      │       └─ Result { identifier, downloadPage, iPhoneUri, androidUri, barcodeValue, issuedAt }
      │
      ├─ db/passHolders.ts::updatePassHolderIssuance (COALESCE pattern)
      │   ├─ 6 runtime 欄位 (identifier / download / barcode / issued_at / iphone_uri / android_uri)
      │   │   └─ SET = COALESCE($N, <col>)  ← partial-safe
      │   └─ issuance_error 故意不用 COALESCE（success 清空 vs failure 覆寫 兩相反期待）
      │
      ├─ response 200 with { ok: true, passHolderId, issuance: {...} | null }
      │   └─ issuance 為 null → 重 register 失敗但 row 已建（graceful degradation）
      │
      └─ React state 設置
          ├─ onCtaClick (付費): setLastIssuance(result.issuance)
          ├─ onValidSubmit (非付費): setLastIssuance(result.issuance ?? null)  ← Round 5 fix
          └─ onRetryIssuance: setLastIssuance(result.issuance)

[PassHolderPassDownload] 4-state branch order locked
  ├─ hasError > hasAnyUri > hasBarcodeButNoUri > pre-launch
  │
  ├─ hasError: <PassHolderDownloadErrorBanner /> 重試 / contact CTA
  │
  ├─ hasAnyUri (iPhoneUri / androidUri / downloadPage 任一存在):
  │   ├─ <PassHolderDownloadButton ios={...} android={...} /> (Round 6 split)
  │   ├─ <PassHolderBarcodeDisplay /> (if barcodeValue)
  │   └─ <PassHolderAndroidReminder /> (Android 首次安裝 Play Store 引導是正常現象)
  │
  ├─ hasBarcodeButNoUri (barcodeValue 存在但 0 URI — 不可逆 lost-data):
  │   └─ <PassHolderLostDataBanner supportEmail={...} /> 聯絡客服 + barcode 保留
  │
  └─ pre-launch (issuance 還沒回): 「尚未發行」 + polling CTA

[PassHolderDownloadButton] 兩顆 anchor 並排 (mobile flex-col / desktop flex-row)
  ├─ iOS CTA: Apple icon + 「For iOS」 + iPhoneUri ?? downloadPage ?? null (hidden when null)
  └─ Android CTA: Smartphone icon + 「For Android」 + androidUri ?? downloadPage ?? null (hidden when null)
     └─ Press-scale baseline: transition-all duration-150 hover:brightness-110 active:scale-[0.97] active:brightness-90 focus-visible:ring-2 focus-visible:ring-offset-2

[V3 DB CHECK constraint] 3 層 defense-in-depth
  ├─ Frontend guard: pickDownloadUri() 不 accept 4 placeholder string
  ├─ Backend parser: BARCODE_VALUE_PLACEHOLDERS normalize via set
  └─ DB CHECK: pass_holders_barcode_value_no_placeholder_chk (Reject any future attempt)
```

---

## Cross-cutting 設計 invariant（給未來 session）

### 1. COALESCE pattern 是「partial-update 的唯一安全路徑」

| 別寫 | 寫這個 |
|---|---|
| `SET foo = ${input.foo ?? null}` | `SET foo = COALESCE(${input.foo ?? null}, foo)` |

**例外**：當你想要「success 清空 stale / failure 覆寫」兩個相反期待（`issuance_error` 就是這個），`COALESCE` 只能「保留」不能「清空」 — 這種欄位故意不用 COALESCE。

未來任何 partial update 多欄位 helper 必走這個 pattern。

### 2. Mock 函式 spy 必看 emitted SQL，不只看 call signature

`vi.fn()` mock 看 call count 看 args，但**對 SQL 內部 SET 行為 0 覆蓋**。

修法：smart mock SQL dispatcher — parse SET clause 子句、識別 `COALESCE($N, <col>)` 跟 `=$N` 兩種 pattern、套對應語意（NULL-preserve vs NULL-overwrite）。

未來抽 `@/shared/lib/test` 共用這 pattern。

### 3. Wire-up contract test 必加（不只是 mock call count）

```ts
// ❌ 弱：mock service 被 call 1 次
expect(updateSpy).toHaveBeenCalledWith(cardId, expect.any(Object));

// ✅ 強：service 回 X → render tree 出現 Y
expect(screen.getByTestId('pass-holder-download-cta-ios-demo-cafe')).toBeInTheDocument();
expect(screen.queryByTestId('pass-holder-download-not-ready')).not.toBeInTheDocument();
```

mock-call test 不能 cover wire-up drift — 必加 render tree assertion。

### 4. submit handler 必走 `try/catch/finally` 三件式

```ts
// ❌ try/finally 沒 catch = throw escape
try { await service.register(...); onSubmit(); } finally { cleanup(); }

// ✅ 三件式
try {
  await service.register(...);
  onSubmit();
} catch (err) {
  setSubmitError(toSubmitErrorState(err));   // ← 一定要接
} finally {
  cleanup();
}
```

`useCallback` 包 async function 的 throw 不會被 React error boundary 接住 — promise rejection escape 變 unhandled rejection。Round 5 是這個 family 的第 5 例。

### 5. Frontend V3 wire shape 必跟 `passcreator.ts::issuePass` 同步

每個 V3 column rename / 新增 / 刪除：

1. `passcreator.ts::issuePass` body 改
2. **`capture-passcreator-v3.cjs::makeV3CreateBody` fixture 同步改（capture script 是 fixture source-of-truth）**
3. 既有 `passcreator.test.ts` happy-path + non-ASCII round-trip test 改 pin 新欄位
4. 2 條 conformance test：① happy path 直接 pin ② capture fixture pin 對齊

漏任何一步 = live-capture drift family（Rule 040 draft 升 rule）。

### 6. CTA platform split 必走「render both anchors」而不是「UA-keyed primary」

| 方案 | UA 不準 | 桌機幫人註冊 | Android → AirDrop iPhone |
|---|---|---|---|
| UA-keyed primary (❌) | silent fallback | 桌機看不到 iOS button | Android 看不到 iPhone button |
| **Render both anchors (✅)** | 不依賴 UA | 兩顆都看得到 | 兩顆都看得到 |

未來任何「device-or-platform 分流」的 CTA / Link / Button 必走「**two-anchor 顯式 render**」而不是「**primary UA-keyed**」。

### 7. Press-scale + brightness a11y baseline 是 L2 component 互動元素必套

```tsx
className="... transition-all duration-150
           hover:brightness-110
           focus-visible:ring-2 focus-visible:ring-offset-2
           active:scale-[0.97] active:brightness-90"
```

少任一條 = silent accessibility regression（鍵盤 user 看不到 focus ring / 滑鼠 user 摸不到按壓）。

未來任何 `<a>` / `<button>` / `<Link>` 互動元素必套這整套。

### 8. PickByType 多型別 split 是 backend partial-update 必然

```ts
// ❌ 一個 UPDATE 寫所有 6 個 runtime 欄位 → 第二次 UPDATE 必 wipe 第一次
async function updatePassHolderIssuance(sql, id, input) {
  await sql`UPDATE pass_holders SET
    pass_identifier = ${input.passIdentifier ?? null},
    ...
  `;
}

// ✅ 用 COALESCE 模式讓欄位「存在就更新、缺就保留 pre-existing」
async function updatePassHolderIssuance(sql, id, input) {
  await sql`UPDATE pass_holders SET
    pass_identifier = COALESCE(${input.passIdentifier ?? null}, pass_identifier),
    ...
  `;
}
```

未來多 runtime 欄位 partial update 必走這個 pattern。

### 9. 不可逆資料必給 user recovery path

V3 LIST 缺 identifier / iPhoneUri / androidUri → lost data 不可逆。UI 必：

- `<PassHolderLostDataBanner />` 明確 contact CTA
- 不是 silent 「尚未發行」copy
- backend backfill script dry-run 先估 blast radius 然後 unique-match 才 `--apply`

未來任何「partial-update silent killer production hit」場景都要產一份 backfill script + lost-data banner。

### 10. i18n key rename 必兩 locale 同步

`download.appleWallet` → `download.forIos` 是 zh-TW + en 雙檔同步。任何 i18n rename 必：

- 前端 i18n locale 兩檔同時改
- 既有 test `body assertion` 必更新（防 future drift auto-detect）

漏一檔 = i18n drift silent green（verify:i18n 會抓，但 test 不會）。

### 11. Docblock self-claim 必跟 implementation 對齊

```ts
// ❌ docblock misleading — implementation 部分 drift
// "We snapshot in both paths to keep the contract uniform"
// 但實際上 onValidSubmit 漏 setLastIssuance

// ✅ docblock 是 contract 的一部分
// onValidSubmit / onCtaClick / onRetryIssuance 三個 submit path 必都 propagate
// result.issuance 到 setLastIssuance (Round 5 invariant)
```

code review checklist 必掃「docblock claims vs implementation gap」。

---

## 衍生

### 衍生 1 — production smoke test 仍 deferred（multiple follow-up）

4 round 都各自列 P0「production smoke test 跑 Playwright `/pass/{templateId}` flow verify 7 欄都填 + 二次 register 不 wipe」，但**沒實跑過 production**。production 一鍵 smoke test 是 shared 仍 P0 項目（Rule 005 + Rule 036 必跑）。

### 衍生 2 — Rule 040「TDD Red 必須碰真實 contract」從草案 → rule

2026-10-18 capture feedback 草案，10/19 Round 4 partial update + Round 3 wire shape **再次印證同一個 fingerprint**。本 session 結束後 Rule 040 應該正式從草案升 rule — capture-passcreator-v3 + parser fix + partial-update test 三件 SOP 共用同一個 contract。

### 衍生 3 — Rule 033「CTA Baseline」必抽出共用 component

3 條 cross-component CTA pattern（`PassHolderDownloadButton`、`PassHolderPaymentButton` P2、未來 `PassHolderLostDataBanner` contact CTA）共用同一個 class string（press-scale + brightness + focus-visible 一整套）。未來抽 `<PrimaryCta>` shared component 統一 visual rhythm，避免 form 內不同 CTA 視覺節奏分裂。

### 衍生 4 — Lost data backfill script 是 SAOME family 第一次「best-effort」cleanup

`backfill-pass-holder-download-url.cjs` 用 V3 LIST unique-match 啟發式（barcode string equality），不是 1-to-1 完整 match。V3 upstream 未來如果加 email/phone 對應欄位必改用 1-to-1 match 取代啟發式。

### 衍生 5 — `pass_identifier` partial unique index 已 enforce，但 race window 仍存在

`UPDATE WHERE id = ${id}` 在 SQL 層 atomic，但 `INSERT/UPSERT` race 仍可能。production 應該加 row-level lock 或 `SELECT ... FOR UPDATE`，但本 session scope 外。

### 衍生 6 — JSONB consolidation Hybrid refactor 留 next L3 Heavy

`pass_identifier` / `issuance_error` / `issued_at` 三 column 永遠 native type（防 double-issue safety net 必須留 native）。4 column（`download_url` / `barcode_value` / `iphone_uri` / `android_uri`）理論上可以塞進 JSONB `pass_runtime`，但本 session 不 ship — Decision Log `2026-10-19-pass-holder-v3-jsonb-consolidation.md` 留著等下次。

---

## 自問

### 下次怎麼不犯？

- **mock-driven silent green** 已經是 SAOME 第五次同 family — **必加 smart mock dispatcher** 而不是 `vi.fn()` spy。未來抽 `@/shared/lib/test` 把 `createPartialUpdateMockSql` 變共用 helper
- **`try/finally` ≠ `try/catch`** — submit handler 必走三件式。Sweep 表單（CardBuilder editor 等）sweep submit handler 都有 catch
- **UA-keyed hidden layer** — 任何 device/platform 分流必走「render both anchors」顯式而不是 UA-keyed primary + invisible fallback
- **i18n key 同步** — backend throws i18n key 必跟 frontend locales 同步；rename 必兩 locale 同步。`verify:i18n` + body assertion 雙保險

### 哪條 rule 該補？

- **Rule 040 升 rule**：從「Live capture is mandatory after mock-derived conformance」草案升正式 rule
- **Rule 033 補強**：CTA baseline 抽出 `<PrimaryCta>` shared component pattern，cross-component 視覺節奏一致
- **Rule 019 §4.1 補強**：JSONB `||` merge pattern + SQL `SET = ${... ?? null}` partial-update pattern 同源，都是「caller 漏傳欄位 silent overwriter」家族

### 哪個 test 該加？

- **Production smoke test 必實跑**（Rule 005 + 036）：Playwright `/pass/{templateId}` flow verify 7 欄位都填 + 二次 register 不 wipe + 平台 CTA 各自 UA 分流 + Tips 副本正確顯示
- **End-to-end V3 Live capture**：conformance test 應該用 `fetch('https://api.passcreator.com/v3/pass')` 做過真實 integration test，而不是只 mock fetch（Rule 040 SOP）
- **Race-condition test**：concurrent register on same `(template_id, email)` pair，驗 UNIQUE constraint 真的擋下 double-issue
- **V3 backfill regression test**：把 script 跑出來的 row dump 寫進 test fixture，未來重跑 script 時驗 output 一致

---

## Cross-reference

### 對應 feedback（detailed traces）

| Round | Bug | Feedback file |
|---|---|---|
| 3 | memberName + CTA icons + Tips | `runs/improvements/feedback/20261019-pass-holder-v3-membername-cta-copy.md` |
| 4 | Partial update + COALESCE + lost-data | `runs/improvements/feedback/20261019-pass-holder-v3-partial-update-bug.md` |
| 5 | Non-paid wire-up | `runs/improvements/feedback/20261019-pass-holder-nonpaid-issuance-capture.md` |
| 6 | Two-platform buttons + press-scale | `runs/improvements/feedback/20261019-pass-holder-split-two-platform-buttons.md` |

### Lineage commits（已 push）

| Commit | Phase | 摘要 |
|---|---|---|
| `d4ec81f` | Phase 1 | V3 issuance + V3 contract root-cause fix（downloadPage / iPhoneUri / androidUri）+ migration 025 |
| `d348f14` | Phase 2 closure | Production cleanup + iPhoneUri/androidUri persist + barcode_value placeholder 清 + migration 026 + 3 URI 持久化 |

### Trigger SKILL / RULE references

| Skill/Rule | 觸發點 |
|---|---|
| `superpowers:test-driven-development` (Rule 003) | All 4 rounds walk Red-Green-Refactor |
| `superpowers:verification-before-completion` (Rule 006) | Round completion 必跑 typecheck + vitest + verify:i18n + lint + check:migrations |
| `Rule 011` dev.mdc | Feedback 同 commit + footer 必填 verification output |
| `Rule 019` schema-contract-drift.mdc § 4.1 | 4 層 sync + shared → request.ts → db → service |
| `Rule 025` vibe-coding-l2-checklist.mdc | i18n first + 元件結構 + test 覆蓋 |
| `Rule 027` postgres-dynamic-query-pattern.mdc | `${sql.json(...)}` for jsonb + `${...}` tagged template injection |
| `Rule 032` backend-jsonb-merge-silent-killer.mdc | Partial update COALESCE pattern（jsonb `||` merge 同源） |
| `Rule 033` popover-sizing-pattern.mdc（類比）| CTA transition-all + brightness baseline |
| `Rule 035` migration-apply-pipeline.mdc | Migration 025/026 registry entries（d4ec81f / d348f14 commit） |
| `Rule 036` worker-runtime-cors-defense.mdc | 3 層 CORS defense（背景運維，沒直接觸發） |
| `Rule 037` mcp-tool-call-pattern.mdc | Pre-listed MCP tool call pattern — 10/19 d4ec81f 第 3 次 regression 後修法 |
| `Rule 040`（草案升 rule 級）| Live capture is mandatory after mock-derived conformance |
| `saome-self-improvement` skill | Session end 必 invoke |

---

> 撰寫者：Josh（SAOME-REBUILD agent session） ｜ 時間：2026-10-19
> 觸發本 dev log 的 commit 群：1 commit（code + tests + i18n + fixtures + 4 new feedback + master DEV log + INDEX rows，per Rule 011/025 對齊）
> 本檔是 10/19 Pass Holder V3 quality bug bundle 的 master narrative；detailed 4 round traces 見對應 feedback
