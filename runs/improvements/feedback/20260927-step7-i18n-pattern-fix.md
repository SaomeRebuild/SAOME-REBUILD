# 2026-09-27 — Step 7 i18n pattern 統一修（commit 前發現）

## 一句話總結

`apps/frontend/src/i18n/locales/tableCard.{en,zh-TW}.ts` 在 Step 7 Round 2 落地時用了跟 repo 其餘 17 個 namespace 不一樣的 pattern（`const tableCard = {...}; export default tableCard;` 而非 `export default {...};`），導致 `verify:i18n-keys.mjs` 在 commit 前 CI gate 拋出 38 keys false-positive drift。本 commit 把兩個 locale 檔改成跟其他 namespace 一致的 pattern，verify-i18n-keys 18/18 namespace 全綠。

## 觸發時間

2026-09-27 23:30（commit 前 verify gate，per Rule 006 verification-before-completion）

## 症狀

```
$ npm test --workspace=apps/frontend -- src/components/business/dashboard/CardBuilderEditor/Step7TableCard
> frontend@0.0.0 test
> node scripts/verify-i18n-keys.mjs && vitest run src/components/business/dashboard/CardBuilderEditor/Step7TableCard

 FAIL: [tableCard] keys present in en but missing in zh-TW (38):
       bringForward, bringToFront, delete, elementTypeLabel, elementTypeLabel.ariaLabel,
       elementTypeLabel.blobError, elementTypeLabel.cancelButton, elementTypeLabel.confirmButton, …+30 more
 verify-i18n-keys: FAIL — fix the issues above
```

## 排查

1. **手動 diff** 兩個 locale 檔，所有 38 個 missing key 在 zh-TW 檔**實際都有對應 key**（手動看 file 內容可證實）。
2. 跑另一個 indenter-based parser（regex 對 indent 抓 key）：
   ```
   EN: 136 ZH: 136
   Only EN: 0
   Only ZH: 0
   ```
   兩檔完全對稱。
3. 對 `verify-i18n-keys.mjs` 的 `tryParse()` 與 brace tracker fallback 抽絲剝繭：`tryParse` 預期 input 形如 `export default { ... }`，看到 `const tableCard = { ... }` 開頭就 JSON.parse 失敗 → fallback 到 `collectKeyPathsBraceTracker`。
4. Brace tracker 對 `const x = { ... }; export default x;` pattern 的**第一個外層 `{`**處理有 bug（tracker 在第一個 key 之後會以為遇到 outer scope close brace），導致它抓到的 EN key 比實際少（只抓 84 個），抓到的 ZH key 比實際多（120 個），但方向恰好相反，讓兩邊 set 對比時誤報「EN 多 38 個」。

## 修法

兩個 locale 檔改成跟其餘 17 個 namespace 一致的 `export default { ... };` pattern：

```diff
- const tableCard = {
+ export default {
    pageTitle: '...',
    canvas: { ... },
    ...
- };
-
- export default tableCard;
```

`grep -l "^const" apps/frontend/src/i18n/locales/*.ts` 確認 repo 內只剩這兩個檔有 `const x = ...` pattern，**已全部修正**。

## 為什麼這是本 PR 的 bug，不算 pre-existing

| 立場 | 證據 |
|---|---|
| **本 PR 引入** | Step 7 在 Round 2（2026-09-27 早上）才建立這兩個 locale 檔；git log 上這兩個檔從未進 main |
| **本 PR 修好** | master DEV LOG 原本寫「38 keys drift pre-existing」（**錯誤**），本 commit 把它改成「修 `const x = {...}; export default x;` pattern 後 18/18 namespace 全綠」 |
| **風險** | 如果先 commit 進 main，下次 PR 跑 verify-i18n-keys 還是會 fail（即使兩個 locale 實際對稱），會誤導後人以為 i18n 不對稱 → 花時間改翻譯 → 沒有幫助 |

> **教訓**：i18n locale 檔建立時**必用** `export default { ... }` pattern（與其餘 namespace 對齊），不要先 `const x = { ... }` 再 `export default x`。verify-i18n-keys 的 brace tracker fallback 對非 standard pattern 不友善。

## Verification

```
$ npm test --workspace=apps/frontend -- src/components/business/dashboard/CardBuilderEditor/Step7TableCard
> frontend@0.0.0 test
> node scripts/verify-i18n-keys.mjs && vitest run src/components/business/dashboard/CardBuilderEditor/Step7TableCard

verify-i18n-keys: OK — 18 namespace(s) passed (36 locale files)

 RUN  v3.2.7 ...
 Test Files  6 passed (6)
      Tests  133 passed (133)
   Duration  7.58s
```

## Future invariant

| Invariant | 為什麼 |
|---|---|
| **任何新增的 `src/i18n/locales/<ns>.{en,zh-TW}.ts` 一律用 `export default { ... }` pattern**（不要 `const x = {...}; export default x;`）| verify-i18n-keys.mjs 的 brace tracker fallback 對 `const x =` prefix 不友善，會誤報 false-positive drift |
| **若 verify-i18n-keys 報某 namespace 大量 key drift，先用別的工具驗證（手動 diff、indenter-based parser、TypeScript 編譯）再下結論** | 本 PR 證明 verify-i18n-keys 不是 ground truth，是「合理但有邊角的檢查」 |
| **CI gate fail 但手動驗證對稱 → 立刻修 pattern，不要 commit fail 進 main** | 會誤導後人 |

## 跟既有 rule 的關係

- `.cursor/rules/006-verification.mdc` — 完工前必跑 verify 指令，看到 fail 不該 commit
- `.cursor/rules/011-dev.mdc` — feedback 同 commit；本 feedback 跟 source 改動同 PR
- `.cursor/rules/frontend/023-shared-package.mdc` § 1 i18n 元件化判斷 — locale 檔結構與既有 namespace 對齊
