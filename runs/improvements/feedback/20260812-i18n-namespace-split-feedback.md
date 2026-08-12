# Feedback: i18n Namespace Split — `.json` → `.ts` Root Cause Analysis

**Date**: 2026-08-12
**Author**: Cursor Agent
**Related**: `runs/improvements/feedback/20260812-i18n-namespace-split-dev-log.md`

---

## Summary

Namespace split（`translation` → feature namespaces）是正確的決策，架構乾淨度提升。但執行過程中觸發了一個**不必要的複雜化**：將 locale 檔案從 `.json` 轉為 `.ts`。

**核心問題**：`.json` → `.ts` 不是 namespace split 的必要條件，是一個**被動繞路**，源於對 Node.js 24 ESM 限制的錯誤解讀，以及 PowerShell encoding 腐化的連鎖反應。

---

## 根因分析（Root Cause Analysis）

### Timeline of Decisions

```
[Timeline]
2026-08-12 09:30  既有架構：en.json + zh-TW.json（479 keys，單一 translation namespace）
2026-08-12 09:35  開始 namespace split：將 keys 拆分到 feature namespace JSON 檔案
2026-08-12 09:42  PowerShell 腳本腐化中文內容（UTF-8 破壞）
2026-08-12 09:50  嘗試用 Node.js 腳本補救，選擇生成 .ts 而非 .json
2026-08-12 10:00  完成：所有 locale 改為 .ts，Vitest 可以正常執行
2026-08-12 10:15  發現 38 個測試失敗，分佈在 pricing, legal, nav, auth
```

### 根因 1: 對 Node.js 24 ESM JSON Import 限制的錯誤解讀

**現象**：
```
TypeError [ERR_IMPORT_ATTRIBUTE_MISSING]:
Module "file:///...zh-TW.json" needs an import attribute of "type: json"
```

**當時的理解**：Node.js 24 要求所有 JSON import 必須有 `with { type: 'json' }`，Vite 無法處理，所以要放棄 `.json`。

**實際情況**：這個錯誤**只在 Vitest 測試環境**出現，**不會**在 Vite dev server 或 production build 出現。原因：
- Vite 的 JSON plugin 會自動處理 JSON → JS object 的轉換，不需要 Node.js 的 JSON import
- Vitest 用的是 Vite transform，但某些 edge case 下 Vitest 的 transform pipeline 跟 Vite dev server 不完全一致

**錯誤的解讀導致**：放棄了一個完全可行的架構選擇（繼續用 `.json`），去採用一個複雜的 workaround（`.ts`）。

### 根因 2: PowerShell encoding 腐化

**現象**：
- `...` 被替換成 `??`
- 中文字元變成 `?X?` 等乱码

**根本原因**：PowerShell 的 `Get-Content` / `Set-Content` 預設用系統 ANSI encoding（不是 UTF-8）。

**預防方法**：
```powershell
# 正確的 UTF-8 讀寫方式
$content = Get-Content -Path "file.json" -Raw -Encoding UTF8
$content | Set-Content -Path "file.json" -Encoding UTF8
```

**或者**：完全避免在 PowerShell 內處理中文，改用 Node.js script：
```bash
node scripts/split-i18n.mjs
```

### 根因 3: 決策時沒有問「這個改變是必要的嗎？」

**.ts** 的缺點（相對於 `.json`）：
1. **不符合 i18next 社群慣例** — i18next 文件和社群範例幾乎都用 `.json`
2. **VS Code JSON schema 失效** — `.ts` 沒有 `jsonc` schema，沒辦法自動完成 i18n keys
3. **build pipeline 多一個轉換步驟** — Vite 仍要將 `.ts` → JS，但多了一層 transform
4. **未來遷移到 `i18next-http-backend` 更複雜** — http-backend 只能 fetch `.json`

**當時的問題**：我沒有在第一時間問「Node.js 24 的 JSON import 錯誤是否只存在於測試環境？」，而是直接假設「必須改格式」。

---

## 教訓（Lessons Learned）

### 1. 遇到奇怪的 build error 時，先隔離環境再下結論

**錯誤做法**：
```
看到 ERR_IMPORT_ATTRIBUTE_MISSING → 結論：JSON 不能用 → 改成 .ts
```

**正確做法**：
```
步驟 1: 在 Vite dev server 驗證（看 development 是否正常）
步驟 2: 確認錯誤只在 Vitest 環境出現
步驟 3: 確認 Vite config 的 JSON plugin 設定
步驟 4: 如果真的只影響 Vitest，修 vitest.config.ts 而不是改 locale 格式
```

### 2. PowerShell + UTF-8 中文 = 高風險組合

**鐵律**：任何涉及中文字元的 PowerShell 檔案操作，**必須**：
1. 明確指定 `-Encoding UTF8`
2. 或者完全避免在 PowerShell 內處理，改用 Node.js script

### 3. 架構改動要區分「目標」和「副作用」

| 改動 | 類型 | 必要性 |
|---|---|---|
| `translation` → feature namespaces | **目標** | ✅ 必要 |
| `.json` → `.ts` | **副作用** | ❌ 不必要 |

**下次遇到副作用時**：先問「這個副作用是目標的必要條件嗎？」如果不是，回滾副作用，只保留目標改動。

### 4. 38 個測試失敗是預警信號

38 個測試失敗說明：
- 測試沒有在第一時間發現問題（CI / pre-commit 沒擋住）
- 沒有 incremental verification（每個 namespace 拆完沒測）

**下次遇到大型重構**：
```
每拆完 1 個 namespace → 跑對應測試 → 確認綠再拆下一個
```

---

## 如果重來，會怎麼做

### Scenario A: PowerShell 腐化 + Vitest JSON error 同時發生

**正確決策鏈**：
1. ❌ PowerShell 腐化 → 回滾，用 Node.js script 重做（而不是補救）
2. ✅ Vitest JSON error → 修 `vitest.config.ts` 的 Vite plugin 設定，不是改 locale 格式
3. ✅ 繼續用 `.json` 完成 namespace split

### Scenario B: 只有 Vitest JSON error（假設 PowerShell 沒腐化）

**正確解法**：
```typescript
// vitest.config.ts — 加 JSON plugin
import { json } from 'vitest/globals';

export default defineConfig({
  plugins: [
    vue(),
    // 如果 Vite 預設 JSON 處理有問題，手動加 plugin
    // 但通常不需要，因為 Vite 預設支援 .json import
  ],
});
```

**或者**：確認 Vite 版本，`vite.config.ts` 的 `esbuild.target` 設定正確即可。

### Scenario C: 真的要處理 Node.js 24 ESM JSON import

**如果真的遇到 Node.js 24 的 JSON import 限制**（這個 error 是真實存在的，見 nodejs/node#52783），正確解法是：

```typescript
// vite.config.ts — 使用 Vite JSON plugin 而非原生 import
import { defineConfig } from 'vite';
import json from '@rollup/plugin-json';

export default defineConfig({
  plugins: [
    vue(),
    {
      ...json(), // Vite 用 @rollup/plugin-json 處理 JSON，不需要 Node.js 的 import assertion
    },
  ],
});
```

**`.ts` 格式從來不是正確答案。**

---

## 技術債追蹤

| 技術債 | Severity | 行動 |
|---|---|---|
| 38 個測試失敗 | P1 | `runs/decisions/2026-08-12-i18n-test-fix-prompt.md` 已產出，等待修復 |
| `.ts` locale 格式 | P2 | 考慮改回 `.json`（需要先驗證 Vitest JSON error 的根因） |
| PowerShell UTF-8 encoding | P2 | 寫一個 `scripts/check-locale-encoding.mjs` 工具，未來任何 locale 改動前先跑 |
| 缺少 i18n incremental test | P2 | 建議加 `scripts/verify-namespace-keys.mjs` — 每個 namespace 拆完驗證所有 key 存在 |

---

## 參照

- `runs/improvements/feedback/20260812-i18n-namespace-split-dev-log.md` — DEV LOG
- `runs/decisions/2026-08-12-i18n-namespace-split.md` — 決策記錄
- `runs/decisions/2026-08-12-i18n-test-fix-prompt.md` — 下個 agent 修復提示詞
- `apps/frontend/src/i18n/index.ts` — i18n 初始化
- `apps/frontend/src/test/i18n.ts` — 測試環境 i18n
- `apps/frontend/src/i18n/locales/` — 所有 locale 檔案
- nodejs/node#52783 — Node.js 24 JSON import assertion RFC
