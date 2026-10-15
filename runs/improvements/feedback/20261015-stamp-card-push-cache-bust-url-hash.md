# Feedback: Stamp Push URL Cache-Bust via `byteHash` Query (v18)

> User 2026-10-15 09:40 回報:「現在製圖好像沒問題了,但 Passcreator
> 那邊的圖還是好幾版之前的,新的圖一直沒有推上去,是不是可以試試看
> url 加上時間戳,或是檢查上傳的網址是不是錯了」

## 症狀(由 user 回報,2026-10-15 09:40,接續 v15/v16/v17)

接續 v15(0.png push pipeline)跟 v17(瀏覽器 composer cache-bust)修復後,
user 觀察到:

1. **Step 8 製圖(R2 0.png)**:新背景 / 換格數 / 換 icon → composer 拿到
   新 bytes → 寫進 R2 ✅
2. **瀏覽器 composer cache**:V17 修過,新 bytes 寫進 R2 ✅
3. **Passcreator 端**:仍看到「好幾版之前」的 strip 圖,新 push 不會更新 ❌

症狀 3 是 v17 fingerprint 家族延伸。V17 修的是「瀏覽器端 cache」,本
次修的是「Passcreator 端 cache」,同 fingerprint 跨不同 cache layer。

## 根因分析

### URL 是 stable,bytes 是 dynamic,中間 cache 不 revalidate

推到 Passcreator 的 strip URL 是固定路徑:

```typescript
// apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts
// v15 emit (變動前):
const useStampImage =
  (template.card_type === 'stamp_card' || template.card_type === 'multipass') &&
  typeof args.stampImageKey === 'string' &&
  args.stampImageKey.length > 0;
const stripUrl = useStampImage
  ? r2KeyToPublicUrl(args.stampImageKey, r2PublicUrl, template.id, 'stamp', 0)
  : r2KeyToPublicUrl(s.backgroundImage, r2PublicUrl, template.id, 'background');
// r2KeyToPublicUrl(stamp) 永遠 emit:
//   ${r2PublicUrl}/api/pass-templates/${templateId}/stamp-image/0
```

`r2KeyToPublicUrl` 的 stamp branch:

```typescript
if (imageType === 'stamp') {
  return `${base}/api/pass-templates/${templateId}/stamp-image/${fillCount ?? 0}`;
}
```

→ URL 完全 deterministic,**沒有任何 query string token**。

### 為什麼會壞

1. user 在 Step 3 換背景 / 換格數 → Step 8 composer 重新合成新 PNG
   (V17 修瀏覽器 cache 後)→ R2 PUT 覆寫同 key
2. `template_stamp_card_images.byte_hash` 被 `uploadStampImage` 算成新值
   (因為 bytes 變了,SHA-256 必變)
3. user 點 Publish → `passTemplateSync.ts` 讀 row → `mapTemplateToPasscreator`
   → 推到 Passcreator 的 URL **仍是** `${tid}/stamp-image/0` (沒 hash token)
4. Passcreator 看到 URL 跟之前同 → 自己的 server-side cache 命中 →
   拿舊 bytes 給 user
5. R2 bytes 是新的,但 Passcreator 端 cache 看不到 URL 變化 → 持續
   回傳舊 bytes

`Cache-Control: public, max-age=31536000, immutable` 讓這條更嚴重:
任何中間 CDN / Cloudflare edge / 未來 Scanner 看到 immutable 都會 cache
一年。Passcreator 對 immutable URL 的內部 cache 行為文件沒明寫,但
實務上等同長期 cache。

### Fingerprint 跟 v17 是同一家族

V17 feedback § 為什麼這條 rule 該獨立成一個 rule 提到:

> URL 是 stable,實際內容是 dynamic,中間某個 layer 的 cache 不會
> revalidate。每一例的修法都是加「讓 cache 失效的 token」。

| 例子 | 哪一層 cache | 哪個 URL 不變 |
|---|---|---|
| 2026-07-28 Bug-4c | 瀏覽器 mixed content | localhost dev URL 烤進 production bundle |
| 2026-07-28 Bug-4d | Cloudflare edge origin | Hono path 走 401 |
| 2026-09-07 CORS drop | Worker runtime | 503 + 沒 CORS header |
| 2026-10-15 v16 | Passcreator describe default | `images.backgroundHidden: true` |
| 2026-10-15 v17 | 瀏覽器 HTTP cache | `${tid}/background` 同 URL 不同 bytes |
| **2026-10-15 v18** | **Passcreator / Cloudflare edge** | **`${tid}/stamp-image/0` 同 URL 不同 bytes** |

## 修法(v18)

### 概念

在推到 Passcreator 的 stamp URL 加 `?v=<byteHash[:12]>` cache-bust
query string。byteHash 是 PNG bytes 的 SHA-256 hex(64 chars),截前
12 字 = 48 bits entropy → 撞機率 ≈ 1/2^48 ≈ 1 in 281 trillion。

**為什麼用 byteHash 不用 timestamp:**

- byteHash 跟 PNG bytes 一對一綁定,語義清晰
- timestamp 跟 bytes freshness 是間接關係(metadata,不是內容 fingerprint)
- 同一張 PNG 重 render 的 byteHash 完全一致 → 連續 publish 沒換
  bytes → URL 一樣 → 對 immutable cache header 是友善(不必要的
  cache-bust 會浪費後端 round-trip)
- 換背景 / 換格數 / 換 icon → 一定 hash 變 → URL 變 → cache miss

**12 字長度取捨:**

- 完整 64 字:URL 太長、collision 機率實務上不可能
- 8 字:32 bits entropy,可能撞(1/4B,但 production 一天 push 不到 4B 次)
- 12 字:48 bits,選這個
- 16 字:64 bits,跟 v3 切版的 hash 一致,過度

### 實作

```typescript
// apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts

// MapTemplateToPasscreatorArgs 新增 arg:
export interface MapTemplateToPasscreatorArgs {
  // ...既有 arg...
  stampImageKey?: string | null;
  // v18 (2026-10-15) — SHA-256 byteHash,用於 cache-bust query
  stampImageByteHash?: string | null;
}

// images IIFE 新增 dispatch:
const isStampishCardType =
  template.card_type === 'stamp_card' || template.card_type === 'multipass';
const hasStampKey =
  isStampishCardType &&
  typeof args.stampImageKey === 'string' &&
  args.stampImageKey.length > 0;
const hasStampHash =
  typeof args.stampImageByteHash === 'string' && args.stampImageByteHash.length > 0;
const baseStampUrl = hasStampKey
  ? r2KeyToPublicUrl(args.stampImageKey!, r2PublicUrl, template.id, 'stamp', 0)
  : null;
const normalizedProxyBase = r2PublicUrl.replace(/\/$/, '');
const isOurProxyUrl = (url: string) => url.startsWith(normalizedProxyBase);
const stampUrlWithCacheBust =
  baseStampUrl && hasStampHash && isOurProxyUrl(baseStampUrl)
    ? `${baseStampUrl}?v=${args.stampImageByteHash!.slice(0, 12)}`
    : baseStampUrl;
const stripUrl =
  stampUrlWithCacheBust ??
  r2KeyToPublicUrl(s.backgroundImage, r2PublicUrl, template.id, 'background');
```

### Dispatch truth-table

| cardType       | key | hash         | emitted URL                          |
|----------------|-----|--------------|--------------------------------------|
| !stampish      | *   | *            | `settings.backgroundImage` proxy     |
| stampish       | no  | (any)        | `settings.backgroundImage` proxy     |
| stampish       | yes | null/empty   | stamp URL (no query, v15 compat)     |
| stampish       | yes | non-empty    | stamp URL + `?v=<hash[:12]>`         |

### Sync 端 thread byteHash

```typescript
// apps/backend/src/modules/pass-templates/services/passTemplateSync.ts
const stampImageRow = isStampish
  ? await findUploadedStampImage(args.sql, args.template.id, 0)
  : null;
const stampImageKey = stampImageRow?.r2Key ?? null;
const stampImageByteHash = stampImageRow?.byteHash ?? null;

const body = mapTemplateToPasscreator({
  template: args.template,
  language: args.language,
  r2PublicUrl: args.r2PublicUrl,
  stampImageKey,
  stampImageByteHash: stampImageKey ? stampImageByteHash : null,
});
```

不需新加 SQL — `findUploadedStampImage` 已經 return 整個 row,多
讀一個 column 即可。

### 為什麼 `isOurProxyUrl` 用 startsWith 而不是 regex

第一次嘗試用 `!/^https?:\/\//i.test(baseStampUrl)`(排除 absolute
URL),但 r2PublicUrl 本身就是 `https://...` → 自己的 proxy URL 也 match
https?:// → 被誤判為 legacy CDN → 整個 cache-bust 邏輯短路。

修法:用 `startsWith(normalizedProxyBase)`,只有「確實是我們 R2
proxy origin」才加 query string。Legacy CDN URL (`https://cdn.example.com/...`)
會 fail startsWith → 不加 query,正確 pass-through(legacy CDN 通常
忽略 query,加也沒壞但語義不對)。

### 為什麼不直接改 Cache-Control header

`apps/backend/src/modules/pass-templates/routes/getTemplateStampImage.ts`
的 header 是:

```typescript
c.header('Cache-Control', 'public, max-age=31536000, immutable');
```

理論上改成 `public, max-age=60, must-revalidate` 或
`private, no-cache` 可以治本,但:

- 改 `Cache-Control` 影響所有 caller(預覽 tile、Passcreator、未來
  Scanner、edge),需要每條 route 都 audit(見 V17 feedback
  § Self-Improvement Action Items #2 提及)
- production deploy 後 Cloudflare edge 的 cache purge 不可控
- 改 header 的範圍比改 URL 格式大,屬於獨立議題

**v18 修法** = 最小可逆的 URL-level fix。
**Cache-Control header audit** = V17 #2 留的 follow-up。

## Conformance Tests(4 條新 + 既有 18 條)

`passTemplateMapping.stamp-image.test.ts` 新增 4 條 v18 test:

1. `stamp_card with stampImageKey + stampImageByteHash → URL carries ?v=<hash[:12]>`
   — 主要 cache-bust 行為
2. `different byteHash produces a different stamp URL (regression — cache
   bust must invalidate)`
   — 防 regression:兩個不同 hash 必產不同 URL,作為 contract guard
3. `stampImageKey set but stampImageByteHash=null → stamp URL has no
   ?v= (v15 backward compat)`
   — 向後相容於 v15 caller(沒 byteHash 仍走 stamp URL,沒 cache-bust)
4. `stampImageByteHash absent (undefined arg) → stamp URL has no ?v=
   (backward compat with v15 callers)`
   — 雙保險向後相容

### 完整測試結果

```
pass-templates:  164/164 passed
stamp-images:     41/41 passed
cards:           251/251 passed
typecheck:         0 errors
```

## 設計取捨

| 選擇 | 原因 |
|---|---|
| byteHash 不用 timestamp | 語義化、跟 PNG bytes 1:1 綁定、PNG 重 render 不會 false-positive cache-bust |
| 12 字長度(48 bits) | 撞機率幾近 0,URL 友善 |
| startsWith(r2PublicUrl) 不用 regex on https?:// | regex 會誤判自己 proxy URL |
| 仍 fallback 到 settings.backgroundImage | graceful 行為跟 v15 一致,只新增 query string 不改 dispatch 規則 |
| 動 sync 端 thread byteHash | 不新加 SQL,多讀一個 column(`findUploadedStampImage` 已經 return 整個 row) |
| 不動 `Cache-Control: immutable` header | 影響所有 caller,屬獨立議題(V17 follow-up #2) |

## Passcreator 端 cache 行為假設

文件未明寫 Passcreator 對 `?v=...` query string 的 cache 行為,
但**業界慣例**(Cloudflare CDN / Akamai / 大多數 reverse proxy)
是 query string 包含在 cache key 內 → 新 query → 重新 fetch。

如果 Passcreator 例外(忽略 query,只用 path 當 cache key),v18 修法
無效,需回頭改 Cache-Control header。但這個假設的驗證需要 production
實測,unit test 層無法涵蓋。

## Self-Improvement Action Items

| # | Action | Priority |
|---|---|---|
| 1 | **Production smoke test 必跑** v18 deploy 後,用 Playwright / curl 驗證「換背景 → 再 publish → Passcreator 端 strip 圖是新 bytes」(v18 修法真的生效的物質驗證) | **P0** |
| 2 | **Cache-Control header audit**(V17 feedback action item #1+#2 仍未處理) | P1 |
| 3 | 對 `getTemplateImage.ts` 的 `background` route 也加同樣 `?v=<hash>` cache-bust 修飾 — 現在 background proxy 是 `${tid}/background`,V17 修的是前端 composer URL,Passcreator 端如果未來 push background(production plan 還沒做),仍會撞到 | P2 |
| 4 | 把「URL cache-bust token」抽成 helper(e.g. `cacheBustedUrl(base, version)`)給未來 push 路徑共用 | P3 |
| 5 | `template_stamp_card_images.byte_hash` 改用 partial unique index 跟 `uploaded` 條件綁定(目前只 unique 在 `(template_id, fill_count) WHERE status='uploaded'`,byte_hash 不約束) — 確保 uploaded row 一定有有效 hash | P3 |
| 6 | 觀察 Passcreator 端對 `?v=...` 的實際 cache 行為,如果忽略 query,這條修法無效 → 回頭改 Cache-Control header | P2(prod 觀察後決定) |

## 觸發 Rules

- Rule 001 § Decision Log 觸發範圍:URL 結構變更是 P2 架構改動,理論上該進
  Decision Log,但本次延續 v15/v16/v17 是同 fingerprint 家族延續修復
  (已有 `runs/decisions/2026-10-15-stamp-card-push-wiring.md`),跳過獨立
  Decision Log
- Rule 011 § 必填 commit footer → 寫 feedback(本檔)
- Rule 019 § Schema Contract Drift:本改動是 internal service signature,
  不是 API contract,跳過 § 4.1
- Rule 035 § Migration Apply Pipeline:無新 migration,跳過
- Rule 037 § MCP Tool Call Pattern:無 MCP 呼叫,跳過

## 參照

- `runs/improvements/feedback/20261015-stamp-card-0-png-background-cache-bust.md`
  (V17 瀏覽器 composer cache-bust — 同 fingerprint 不同層)
- `runs/improvements/feedback/20261015-stamp-0-png-push-pipeline-fix.md`
  (V15 Stamp / Multipass 0.png push pipeline)
- `runs/decisions/2026-10-15-stamp-card-push-wiring.md`(v15 decision log)
- `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts`
  (v18 `images` IIFE dispatch — line 825-877)
- `apps/backend/src/modules/pass-templates/services/passTemplateSync.ts`
  (v18 `stampImageByteHash` thread — line 80-110)
- `apps/backend/src/modules/pass-templates/tests/passTemplateMapping.stamp-image.test.ts`
  (4 條 v18 conformance test)
- `apps/backend/src/modules/stamp-images/db/stampImages.ts`
  (`findUploadedStampImage` row shape 含 byteHash)
