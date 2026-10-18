# Pass Holder 下載 CTA — 兩個按鈕各自帶獨立平台 URI（split-two-platform-buttons）

**日期**：2026-10-19
**作者**：SAOME-REBUILD agent session
**scope**：L2 Standard（1 component 改檔 + 2 i18n 改檔 + 2 test 改檔 + 1 stories mirror + press-scale + brightness 視覺效果）
**plan**：[split_download_ctas_into_two_platform-specific_buttons_23b004aa.plan.md](../../../.cursor/plans/split_download_ctas_into_two_platform-specific_buttons_23b004aa.plan.md)

---

## Summary

User 報「下載頁兩個按鈕裡面的連結都是下載頁連結，他們應該分別是安卓下載連結、ios 下載連結」，加上按鈕文案要改成「For Android / For iOS」以及點擊要有動態視覺效果。

| # | 改動 | 修法 |
|---|---|---|
| 1 | 兩個 CTA 都沒有平台專屬 URL — 當 V3 只回 universal `downloadPage` 或 platform-specific URI 缺失時，兩顆按鈕 collapse 到同一個 URL，user 無法分辨 | 移除 UA-keyed `pickPrimaryHref` / `PrimaryCtaType` 機制，改成 **兩顆獨立 anchor 並排渲染**（`...-cta-ios-${id}` + `...-cta-android-${id}`），各自帶專屬 URI fallback chain（`iPhoneUri ?? downloadPage ?? null` / `androidUri ?? downloadPage ?? null`），button 各隱藏若 native URI 跟 universal fallback 兩者皆不存在 |
| 2 | 按鈕文案是 wallet 平台名（「加入 Apple 錢包」/「加入 Google 錢包」），難以擴充到不同 wallet app | 文案改成「For iOS」/「For Android」(`download.forIos` / `download.forAndroid`)，i18n 兩 locale 同步（zh-TW 全中文「給 iPhone 用戶」/「Android 用戶」，品牌名 verbatim 寫）— 以後 wallet 廠商變動不會 hit 按鈕文案 |
| 3 | 按鈕點下去沒有視覺反饋，只有 `transition-colors` | 加 `transition-all duration-150` + `hover:brightness-110` + `active:scale-[0.97]` + `active:brightness-90` + `focus-visible:ring-2 focus-visible:ring-offset-2`，無新依賴（Tailwind utilities only） |

---

## Symptom

[apps/frontend/src/components/business/pass/PassHolderPassDownload/PassHolderDownloadButton.tsx](../../apps/frontend/src/components/business/pass/PassHolderPassDownload/PassHolderDownloadButton.tsx) 之前 render 兩顆按鈕：

| 按鈕 | 從前行為 |
|---|---|
| Primary CTA | 用 `navigator.userAgent` 偵測平台 → iPhone 走 `iPhoneUri`、Android 走 `androidUri`、Desktop 走 `downloadPage`；icon + label 也跟 UA flip（Apple +「加入 Apple 錢包」/ Smartphone +「加入 Google 錢包」/ Download +「下載 .pkpass」）|
| Secondary CTA | **永遠** `downloadPage`，標籤「下載 .pkpass」，fallback icon (Smartphone) — 用途是「device 偵測錯誤時的 escape hatch」 |

常見失敗鏈：

| 觸發 | 結果 |
|---|---|
| Backend 只回 `downloadPage`（older template 還沒 push platform URI）| Primary 跟 Secondary collapse 到同一個 URL — user 看到兩顆按鈕但實際上點哪個都一樣 |
| iPhone 裝置但 V3 沒回 `iPhoneUri` | Primary 的 href 退回 `downloadPage`，跟 Secondary 同一 URL |
| jsdom default UA（desktop）跑測試 | Primary 的 href 永遠是 `downloadPage`，平台-specific 邏輯被 mock DOM 隱藏 |

按鈕視覺上沒有按壓感，滑鼠/手指按下沒反饋，使用者摸不出「有按到」。

## Root cause

1. **「Primary vs Secondary」是隱含層級，UI 上沒標記** — Primary 的 icon + label 跟 Secondary 視覺上沒差別，user 不知道哪顆是 platform 專屬、哪顆是 universal fallback。
2. **UA detection 是 device-shame 邏輯** — 桌機幫別人註冊、Android 註冊了轉 AirDrop 給 iPhone 朋友，這些合理 use-case 都被 UA-keyed 邏輯拒絕（桌機看不到 iPhone button / Android 看不到 iOS button）。
3. **`transition-colors` 是設計 token 沒打到 transform 與 brightness**，所以即使加了 hover、active 也只能變色，沒縮放、沒亮度變化。

## Fix（5 件 + 1 視覺效果）

1. **重構 `PassHolderDownloadButton` render path**：移除 `pickPrimaryCtaType` / `pickPrimaryHref` / `PrimaryCtaType` / `primaryCtaLabelKey` / `useMemo` 等 user-agent 整合層（**`isIOSUserAgent` / `isAndroidUserAgent` 仍 export** 作為未來 helper）。Render 直接兩顆 anchor block：

   ```tsx
   // iOS CTA
   const iosHref = pickIosHref({ iPhoneUri, downloadPage });  // iPhoneUri ?? downloadPage ?? null
   if (iosHref) {
     <a href={iosHref} ... icon={Apple} label={t('download.forIos')} testid={`...-cta-ios-${id}`} />
   }

   // Android CTA
   const androidHref = pickAndroidHref({ androidUri, downloadPage });  // androidUri ?? downloadPage ?? null
   if (androidHref) {
     <a href={androidHref} ... icon={Smartphone} label={t('download.forAndroid')} testid={`...-cta-android-${id}`} />
   }
   ```

   Outer 是 `flex flex-col gap-3 md:flex-row` 容器；每顆按鈕 `flex-1`，mobile 直排、desktop 並排；none-of-uri 時整個 component 回 `null`（不是 defanged `<a>`）。

2. **i18n key 重命名（兩 locale 同步）**：

   | Removed | Added |
   |---|---|
   | `download.appleWallet: 'Add to Apple Wallet'` | `download.forIos: 'For iOS'` |
   | `download.androidWallet: 'Add to Google Wallet'` | `download.forAndroid: 'For Android'` |
   | `download.directDownload: 'Download .pkpass'` | (removed) |
   | `download.iosHint: 'iPhone users can add directly to Apple Wallet'` | (removed) |

   zh-TW 全中文（Rule 023 § 翻譯書寫紀律），品牌名 verbatim 寫（`iPhone` / `Android`）。

3. **Press-scale + brightness 視覺效果**（無新依賴）：

   ```tsx
   className="... transition-all duration-150
              hover:brightness-110
              focus-visible:ring-2 focus-visible:ring-offset-2
              active:scale-[0.97] active:brightness-90"
   ```

   設計理由：
   - `transition-all` 取代 `transition-colors` — 涵蓋 transform 跟 brightness 過渡
   - `duration-150` — 比預設 200ms 稍快，按壓感更即時
   - `hover:brightness-110` — 雙字節 brand color 也吃得到 brightness 變化
   - `active:scale-[0.97]` — 3% scale 提供物理性「按下去」反饋，比 scale-95 細微、適合每次都按的 CTA
   - `focus-visible:ring-2 focus-visible:ring-offset-2` — 鍵盤 Tab 可達性（`focus-visible` UA-aware：滑鼠點不會觸發 ring，鍵盤 Tab 才會 — 符合螢幕閱讀器 + 鍵盤使用者期待）
   - 沒加 `framer-motion` / `motion-one` / `motion` 等 lib — Tailwind utilities 就夠；既有 codebase 也是走這個 style

4. **Test contract 改寫**（`PassHolderPassDownload.test.tsx` + parent `PassHolderRegistration.test.tsx`）：

   - 新增 `press-scale visual` conformance test — 兩顆 anchor 都 pin `transition-all` / `duration-150` / `hover:brightness-110` / `active:scale-[0.97]` / `focus-visible:ring-2` class，鎖定未來 refactor 不能悄悄拔掉視覺效果
   - 新增「`BOTH CTAs render on every user-agent (regression — no UA gating)`」— 顯式 iPhone UA 跑測，verify 兩顆 button 都 render，鎖定 UA 不能決定 visibility
   - 新增「`renders only Android CTA when only androidUri is set`」 + 「`renders only iOS CTA when only iPhoneUri is set`」 — defensive 對稱 fallback 行為（hide-not-fallback when no native + no universal）
   - 既有 iOS UA / Android UA / iPhoneUri-missing fallback / all-URIs-missing / failure-path / pre-launch / lost-data 7 條 test 全部更新成新 testid (`...-cta-ios-${id}` / `...-cta-android-${id}`) + 新 label assertion
   - `PassHolderRegistration.test.tsx` 兩個 `pass-holder-download-cta-demo-cafe` reference 改成 `pass-holder-download-cta-ios-demo-cafe`（行為不變，只是 testid 變平台-specific）

5. **`PassHolderPassDownload.stories.tsx` mirror i18n** — `passHolderZhTW` 內嵌資源拿掉 `appleWallet` / `directDownload` / `iosHint`，換 `forIos` / `forAndroid`。

## Verification

| # | Check | Command | Result |
|---|---|---|---|
| 1 | typecheck | `npx tsc --noEmit -p apps/frontend/tsconfig.app.json` | exit 0 |
| 2 | vitest 該兩檔 | `npx vitest run PassHolderPassDownload.test PassHolderRegistration.test` | 16 + 35 tests 全綠（PassHolderPassDownload 從 11 → 16 = +5 新 conformance） |
| 3 | full frontend suite | `npm test --workspace=apps/frontend` | 148 files / **1956 tests** 全綠（1949 → 1956，+7 含 split-two-platform-buttons + 上一輪 nonpaid-issuance-capture） |
| 4 | i18n smoke | `npm run verify:i18n --workspace=apps/frontend` | 21 namespaces OK，`forIos` / `forAndroid` 在 en + zh-TW 兩 locale 都解析得到 |
| 5 | lint | `npm run lint --workspace=apps/frontend` | exit 0，pre-existing warnings 數量不變 |

## 3 future invariants

(a) **「One button per platform」** — `PassHolderDownloadButton` 永遠 iOS + Android 兩顆並存，不應再退回單一 universal CTA。Universal fallback (`downloadPage`) 只用於 *隱藏 native URI 的 button 的 href*，不是第三顆按鈕。

(b) **「Hide, not fallback, when both URIs are absent」** — 一顆 button 沒 native URI 也沒 universal fallback 就 hide 整顆，不是 render defanged `<a>` 或塞別的 URL。三 URI 全缺 → 整個 component 回 `null`（讓 parent 走 pre-launch 分支）。

(c) **「CTA 視覺效果 baseline」** — 任何 L2 component 的 `<a>` / `<button>` 互動元素都應該有 press-scale + brightness + transition-all + focus-visible 一整套；少了任一條（含 `:focus-visible`）= silent accessibility regression（鍵盤 user 看不到 focus ring）。新增 cross-component CTA 元件必沿用這套 class string。

## 4 follow-up

(P2) Payment flow 內的 `PassHolderPaymentButton` 也是 anchor-like 互動元素，可順手套同一套 class string 統一視覺節奏（現在只有 `bg-primary` 切換，沒 press 反饋，桌機/RWD 一致性會差）。

(P2) `downloadPage` universal fallback 在「只有 iPhoneUri 沒有 androidUri」的場景下，Android button 點下去實際上是 universal landing page（Passcreator 端 device-sniffing）— UX 訊息要在 button label 標清楚，或在 button 加 helperText 說明「找不到 Passwallet 時使用」。目前 i18n key 是中性「Android 用戶」，user 點下去才發現是 landing page 跳轉，UX 上仍有模糊。

(P3) `data-cta-type` attribute 已移除（UA-keyed attribute 失去語義）。未來若要再加測試/debug-friendly attribute 應改 `data-platform="ios|android"`（per-button 固定，跟 UA 無關）。

(P3) `isIOSUserAgent` / `isAndroidUserAgent` helper 仍 export 但 component 內已無呼叫 — 未來若有 unit test 想獨立驗證 UA detection 仍可用。

## Scope

**6 改檔 / 1 新 feedback / 1 INDEX row**：

- `apps/frontend/src/components/business/pass/PassHolderPassDownload/PassHolderDownloadButton.tsx`（重寫 render path + press-scale class）
- `apps/frontend/src/i18n/locales/passHolder.en.ts`（rename 4 keys）
- `apps/frontend/src/i18n/locales/passHolder.zh-TW.ts`（rename 4 keys，全中文）
- `apps/frontend/src/components/business/pass/PassHolderPassDownload/PassHolderPassDownload.test.tsx`（重寫 URL/label test + 新增 press-scale + UA-gating conformance）
- `apps/frontend/src/components/business/pass/PassHolderPassDownload/PassHolderPassDownload.stories.tsx`（mirror i18n）
- `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.test.tsx`（2 處 testid reference 改為 platform-specific）
- `runs/improvements/feedback/20261019-pass-holder-split-two-platform-buttons.md`（本檔）
- `runs/improvements/INDEX.md`（1 row prepended）

**Backend scope 0**（純前端 UX polish + i18n + 測試）。未涉及 migration / DB / API contract，符合 Rule 035 排除條件。

## 4 條教訓

1. **「Primary vs Secondary」是容易被 user 誤讀的隱含層級** — 對 component 來說有意義（哪一顆優先 render），對 user 來說無意義（兩顆看起來一樣就不知道哪顆做什麼）。修法是直接 render 同層級兩個 platform-specific button，讓 user 決定（而不是 component 用 UA 猜）。
2. **Press-scale + brightness 是零成本高 UX 投資** — Tailwind utilities 一行 class 就有觸感反饋；過去 `transition-colors` 是最低設計 baseline，沒打到 transform/brightness 兩維度。Code review checklist 必掃「互動元素的 class string 是否涵蓋 transform + brightness + focus-visible 一整套」。
3. **`focus-visible:` 是 keyboard accessibility 的必要 token** — `:focus` 滑鼠點也會觸發，破壞視覺；`:focus-visible` 只在鍵盤 Tab / 螢幕閱讀器輔助時觸發。任何 CTA / button / link 必用 `focus-visible:ring-2`，別用 `focus:ring-2`。
4. **「新增 cross-component CTA pattern 要抽 shared variant」**（TODO，見 P2 follow-up）— `PassHolderDownloadButton` 跟 `PassHolderPaymentButton` 兩顆 CTA 視覺節奏若不同，會讓 user 在 form 內部感到「按下去反饋不一致」。未來 3+ 顆 CTA 出現時要抽 `useCtaProps()` 或 `<PrimaryCta>` shared component。
