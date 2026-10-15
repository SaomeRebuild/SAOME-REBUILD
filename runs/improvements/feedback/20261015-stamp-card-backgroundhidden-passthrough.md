# Feedback: Stamp / Multipass 0.png `backgroundHidden` Bug Fix (v16)

> v15 修完後,user 再回報 Passcreator 模板的「不用背景圖」checkbox 仍是打勾,
> 導致 deployed pass 看不到 strip 圖。

## 症狀(由 user 回報,2026-10-15,接續 v15)

Stamp_card 模板的 0.png 已在 R2 正確上傳,`passTemplateMapping.ts`
(v15) 也有 emit `images.background = <public proxy URL>`。但 user 在
Passcreator 模板設定 UI 看到:

- 「不用背景圖」checkbox 仍是打勾狀態
- Deployed pass 沒有顯示 strip 圖(包含 grid 與租戶上傳的背景)

換言之,**我們送了 URL 但 Passcreator 把它隱藏了**。

## 根因分析

### Passcreator V2 describe response 預設值

依官方 API 文件的 describe response
(https://developer.passcreator.com/en/api/v2/pass-template):

```json
"images": {
    "logo": null,
    "logoHidden": true,            // ← 預設 true
    "background": null,
    "backgroundHidden": true,      // ← 預設 true
    "backgroundDifferentForEachPass": false,
    "thumbnail": null,
    "thumbnailHidden": false,
    ...
}
```

`backgroundHidden` 與 `logoHidden` **預設都是 `true`**。

### Mapping 之前只送 URL,沒送 false flag

`apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts`
的 `images` IIFE(v14 引入 + v15 修 stamp dispatch):

```ts
if (iconUrl) out.icon = iconUrl;
if (logoUrl) out.logo = logoUrl;
if (stripUrl) out.background = stripUrl;
out.backgroundDifferentForEachPass = true;  // v14 加的
return out;
```

只有 `images.background = '<url>'` 一個欄位,**沒**有 emit
`images.backgroundHidden: false`。Passcreator 收到 payload 後,
欄位不存在 → 套 describe response 預設 → `backgroundHidden: true` →
「Hide background image」checkbox 維持打勾 → deployed pass 沒背景圖。

同樣 issue 影響 `logoHidden`(預設 `true`),只是 user 還沒回報 logo
也被藏。

### 為什麼 v15 沒抓到

v15 是純 mapping 變更,unit test 只驗證「有 emit `images.background`
URL」。沒有人驗證 Passcreator 那邊對應的 hidden flag 行為 —— 屬於
「curl 看起來通、上游 UI 不通」的經典 fingerprint
(2026-07-28 Bug-4c 同源 pattern)。

## 修法(v16)

### 修改檔案

| 檔案 | 修改內容 |
|---|---|
| `apps/backend/src/shared/lib/passcreator.ts` | `PasscreatorTemplateBody.images` 介面新增 `backgroundHidden?: boolean` + `logoHidden?: boolean`(附 v16 註解說明 user report + Passcreator 預設 `true` 行為)|
| `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` | `images` IIFE 改為:有 `images.background` URL 就 emit `backgroundHidden: false`;有 `images.logo` URL 就 emit `logoHidden: false`;兩個都缺就不 emit 對應 flag |

### emit 規則

| 條件 | emit 內容 |
|---|---|
| `images.background` 有 URL | `images.background = url` + `images.backgroundHidden = false` |
| `images.background` 沒 URL | 兩個欄位都不 emit(讓 Passcreator「沒圖 ⇒ 預設隱藏」自然套用) |
| `images.logo` 有 URL | `images.logo = url` + `images.logoHidden = false` |
| `images.logo` 沒 URL | 兩個欄位都不 emit |

`backgroundDifferentForEachPass = true`(v14 default-on)保留 — 與
v16 共存:per-pass override 仍可用,但 deployed pass 預設就看得到背景。

## Conformance Tests(9 條)

### `passTemplateMapping.test.ts`(5 條,新增在 `images` describe 內)

1. 有 background URL → `body.images.backgroundHidden === false`
2. 有 logo URL → `body.images.logoHidden === false`
3. 沒 background URL → 不 emit `backgroundHidden`
4. 沒 logo URL → 不 emit `logoHidden`
5. v14 + v16 coexist:`backgroundHidden: false` 與
   `backgroundDifferentForEachPass: true` 同時存在

### `passTemplateMapping.stamp-image.test.ts`(4 條,新增在 stamp dispatch describe 內)

6. stamp_card + stampImageKey → `backgroundHidden: false`
7. multipass + stampImageKey → `backgroundHidden: false`
8. stamp_card 走 fallback `settings.backgroundImage` → 仍 emit
   `backgroundHidden: false`(只要 images.background 有 URL)
9. stamp_card 兩個來源都空 → 不 emit `backgroundHidden`(graceful)

## 設計取捨

| 選擇 | 原因 |
|---|---|
| 兩個來源(stamp-0.png / settings.backgroundImage)都套同一規則 | v15 已經統一 `base` 不變;v16 只加 flag,不動 dispatch 邏輯 |
| logo 也順便修(`logoHidden: false`) | 同源 bug,describe 預設同樣 `true`;現在修避免 user 再回報一次 |
| 沒 URL 時不 emit flag(而非 emit `true`) | 「沒圖 ⇒ 隱藏」是合理預設行為,emit `true` 反而可能蓋掉 Passcreator 上其他路徑設定的 un-hide |
| 不發新版 plan | 範圍 = 1 個 mapping IIFE + 1 個介面新增 2 個 optional 欄位,屬 Rule 001 L2 Standard 範圍,不入 Decision Log |

## Self-Improvement Action Items

| # | Action | Priority |
|---|---|---|
| 1 | 觀察後續 Passcreator push 是否還有「我送 URL 但 Passcreator 不顯示」案例;若有,優先看是否還有 default-on 的 hidden flag(例如 `thumbnailHidden` / `artworkHidden` 等)需要顯式 emit `false` | P2 |
| 2 | 把「Passcreator hidden flag 預設值」做成新 unit test fixture,讓未來新增 image 欄位時自動檢查對應 hidden flag 是否需要 un-hide | P3 |
| 3 | 把 v15 feedback 標的「curl 看起來通、上游 UI 不通」fingerprint 擴大到 Passcreator push 上游驗證 SOP;deploy 後的 curl 矩陣除了 `background` URL 也應確認 Passcreator GET 回傳的 `backgroundHidden` 是 `false` | P2 |