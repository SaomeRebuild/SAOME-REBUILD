# Feedback: 0.png Composer Background Cache-Bust Bug Fix (v17)

> user 2026-10-15 09:10 回報：換背景圖 / 換 grid 格數 → R2 裡 o.png 背景
> 仍是舊的,Passcreator 模板 strip 圖持續顯示「好幾版之前」。

## 症狀(由 user 回報,2026-10-15 09:10,接續 v15/v16)

三件症狀合在一起看：

1. **「換背景圖,R2 裡 o.png 背景還是沒變」** — User 在 Step 3 上傳新背景,
   publish 後,直接到 R2 看 `tenants/.../templates/.../stamp-0.png`,
   畫面打開仍是舊背景。
2. **「換 grid 格數,背景還是沒變,只有格子變了」** — 換 `stampGridRows`
   (4×5 / 3×5 / 2×5 / 1×5) 後再 publish,R2 o.png 的 grid 數對了,
   但背景仍是舊的。
3. **「Passcreator 模板 strip image 持續顯示『好幾版之前』的圖」** —
   Passcreator 模板後台的 strip image preview 始終停留在某個舊版本。

## 根因分析(全部是同一條 fingerprint)

### 受害者是 composer 那條 fetch,不是 preview 那條

`Step8Save.hooks.ts` 的 `resolveBackgroundImageUrl` 把
`state.backgroundImage` (R2 key) 轉成 public proxy URL:

```ts
return `${apiBaseUrl()}/api/pass-templates/${templateId}/background`;
```

而 backend route `apps/backend/src/modules/pass-templates/routes/
getTemplateImage.ts::createGetTemplateImageRoute` 在 background
proxy 的 response header 上加:

```ts
c.header('Cache-Control', 'public, max-age=31536000, immutable');
```

### 為什麼會壞

User 在 Step 3 上傳新背景時:

1. R2 在同一個 key (`{tenantId}/{templateId}/background.png`) 覆寫 —
   URL 不變
2. React preview 那邊 fetch 是 `${api.paths.cardImage(...)}?token=...&v=${backgroundImageVersion}`
   (auth'd + version cache-bust) → **新 bytes** 顯示 OK
3. 但 `state.backgroundImageVersion` 雖被 `setBackgroundImage` 自動 bump,
   `resolveBackgroundImageUrl` 沒用到它 — URL 還是沒 query string

User 點 Publish:

1. Composer 在 user 瀏覽器 fetch `${templateId}/background` 這個 public URL
2. 瀏覽器看 cache:URL 一樣、response header 說「immutable, max-age=1y」 →
   **cache hit** → 拿舊 bytes
3. Canvas 畫「新的 grid + 舊的背景」 → 上傳到 R2
4. Passcreator 拉 `${templateId}/stamp-image/0` → 拿 R2 這張新 o.png →
   看到「舊背景 + 新 grid」

### 為什麼 v15 沒抓到

v15 修的是「Passcreator push 帶 `images.background` URL」,但沒驗證
那個 URL 後面對應的 bytes 是新還是舊。同樣 v16 修 `backgroundHidden: false`
也只管 flag,沒管 URL → bytes 的 freshness。

unit test 層都是 mock composer,根本沒碰真實的 fetch → cache 行為
在 test 完全不可見。

### Fingerprint

「**URL 不變、bytes 變了、但前端被 cache 騙了**」是 SAOME 自 2026-07-28
Bug-4c 起的家族 pattern(curl 看起來通、瀏覽器不通)。這次是
「production 部署後看似通、上游 UI 不通」,跟 v16 修的
`backgroundHidden` 是同一類;只是 v16 在 Passcreator 那邊,
這次在 composer 的瀏覽器 cache 這層。

## 修法(v17)

### 修改檔案

| 檔案 | 修改內容 |
|---|---|
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step8Save/Step8Save.hooks.ts` | `resolveBackgroundImageUrl` 介面加 `backgroundImageVersion: number` 參數,輸出 URL 從 `${...}/background` 改成 `${...}/background?v=${version}`;`buildZeroFillStampInput` 從 `state.backgroundImageVersion` 帶入 |
| `apps/frontend/src/components/business/business/dashboard/CardBuilderEditor/Step8Save/Step8Save.backgroundCacheBust.test.tsx` | 4 條 conformance test 釘住 wire format |

### 為什麼 `backgroundImageVersion` 是對的 token

`CardBuilderEditor.store.ts::setBackgroundImage` 內:

```ts
setBackgroundImage: (backgroundImage) => set({
  backgroundImage,
  backgroundImageVersion: Date.now(),
}),
```

`MediaAssetUploader::handleApplyCrop` 在 R2 PUT 成功 + DB 更新後
呼叫 `setStoreField(key)`(background variant → `setBackgroundImage`),
所以**每次上傳新背景** → `Date.now()` → 跟舊值差幾十 ms 以上 →
URL 的 `?v=...` 跟著變 → 瀏覽器 cache miss → fetch 新 bytes。

跟 `CardBuilderEditorPreview.tsx` 的 preview cache-bust 走同一個
`state.backgroundImageVersion`,react 跟 composer 兩邊 invalidate
時機一致。

### 為什麼不放 `?t=${Date.now()}`(每次 publish 都新)

`backgroundImageVersion` 是「**背景圖被換過的時間**」,比「現在是幾點」
精準。如果 user 連續點 publish 兩次沒換背景,`Date.now()` 會 bump
兩次 → URL 變 → 瀏覽器 cache miss → 多一次後端 round-trip。
`backgroundImageVersion` 沒 bump → URL 一樣 → 瀏覽器 cache hit
(`immutable` 仍然有效) → 直接拿上一次 compose 已經取過的 bytes →
省一次 fetch,合 `Cache-Control: immutable` 的語意。

## Conformance Tests(4 條)

`Step8Save.backgroundCacheBust.test.tsx`:

1. **Wire format**:已知 `backgroundImageVersion=1734567890123` →
   composer mock 收到 `background.url === "${apiBaseUrl}/api/pass-templates/.../background?v=1734567890123"`
2. **Re-upload bump**:`setBackgroundImage` 後 → 新 version → 第二輪
   publish 的 URL 跟第一輪**不同**(否則 cache invalid 失敗 → 整條
   修復鏈破掉)
3. **Color-only path**:`state.backgroundImage = ''` → 不 emit background URL,
   background union 走 `type: 'color'`,沒 `?v=0` 殘留
4. **No token leak**:URL 沒 `?token=` / `authorization`(public proxy
   不需 auth,Passcreator 與未來 Scanner 都要拿這條 URL)

## 為什麼這條 rule 該獨立成一個 rule

這條是 2026-07-28 Bug-4c 起的 family 第四例(curl 通瀏覽器不通):

| 例子 | 哪一層 cache | 哪個 URL 不變 |
|---|---|---|
| 2026-07-28 Bug-4c | 瀏覽器 mixed content | localhost dev URL 烤進 production bundle |
| 2026-07-28 Bug-4d | Cloudflare edge origin | Hono path 走 401 |
| 2026-09-07 CORS drop | Worker runtime | 503 + 沒 CORS header |
| 2026-10-15 v16 | Passcreator describe default | `images.backgroundHidden: true` |
| **2026-10-15 v17** | **瀏覽器 HTTP cache** | **`${templateId}/background` 同 URL 不同 bytes** |

共同 fingerprint:**URL 是 stable,實際內容是 dynamic,中間某個 layer
的 cache 不會 revalidate**。每一例的修法都是加「讓 cache 失效的 token」。

## Self-Improvement Action Items

| # | Action | Priority |
|---|---|---|
| 1 | 把 `getTemplateImage.ts` 的 `Cache-Control: immutable` 拿掉,改用 `private, no-cache`,或加 `stale-while-revalidate=0`。理由:這條 route 的 bytes 不 immutable — 同 key 會被覆寫,但 cache header 假設不會。改 header 比改每個 consumer 加 cache-bust 更治本 | P1 |
| 2 | 對每一條 `apps/backend/src/modules/pass-templates/routes/*` 設的 `Cache-Control: public, max-age=31536000, immutable` 做 audit,確認是不是每條都有理由「bytes 真 immutable」(e.g. stamp image 的 server 端 keyed,`uploadStampImage` 寫死同 key — 也會被覆寫,所以也不 immutable) | P1 |
| 3 | 在 frontend services 層加一個 `api.versioned(url, version)` helper,把所有 public proxy 加上 query string。集中管理,避免下一個 caller 又忘記加 cache-bust | P2 |
| 4 | 加 e2e smoke test:用 Playwright 開真實瀏覽器、實際上傳背景、再 fetch `${tid}/background`、assert 收到新 bytes 而非 cache hit | P2 |
| 5 | 把 v16 feedback 的「Passcreator hidden flag 預設值」清單擴大:Passcreator 還有 `thumbnailHidden` / `artworkHidden` 等 default-on 的 hidden flag,也要 `?v=1734567890123` 那種顯式 un-hide 過一輪 audit | P3 |
