# Feedback：Playwright-first Debugging（2026-08-22）

## 背景

這次 session debug CardBuilder 的幾個問題：

1. **IssuerName 預填失敗**：`useAuth()` 回傳形狀錯誤
2. **`isPaid` extension schema drift**：後端介面漏了 `isPaid`
3. **Step 2 issuerName runtime 行為**：sessionStorage 有 token 但 `tenant` 是 `undefined`

在定位這些問題時，前後改了 3-4 個檔案才看到有效訊息。後來一次 Playwright smoke test 直接看到 runtime 行為（`tenant: undefined` console log），比改 5 次 code 都有效。

## 觀察

### 靜態 code review 看不到什麼

- `useAuth()` 內部 state 形狀（`{ tenant }` vs `{ state: { tenant } }`）
- auth refresh 完成時機（token 存在但 `tenant` 尚未 load）
- API response 實際內容（哪些 field 有值、哪些是 `null`）
- React component 在特定 DOM state 下的 console output

### Playwright probe 比 code change 更有效

| 方式 | 速度 | 資訊量 | 準確度 |
|------|------|--------|--------|
| 改 code（加 console.log）| 慢（改完要重 build）| 有限（只能看到改的那個點）| 低（猜的） |
| Playwright probe | 快（直接截 runtime）| 高（整個 call stack + DOM state）| 高（真實行為） |

## 建議：Playwright-first Debugging Heuristic

定義 heuristic：**同一個 bug，改了 5+ 個檔案仍未定位根因 → 立即寫 Playwright probe**。

理由：
- 改 2-3 個檔案可能是運氣不好（運氣問題）
- 改 5+ 個檔案說明方向完全錯了（方法問題）
- 這時候繼續改只會浪費時間

## 這次驗證

`IssuerNameField` 的 `useAuth()` bug，Playwright probe 直接截到：

```
[CONSOLE LOGS]:
  [log] [IssuerNameField] useEffect run, issuerName: "" tenant: undefined
```

如果一開始就跑 smoke probe，根因立即可見。`IssuerNameField.tsx` 的 `const { tenant } = useAuth()` 解構錯誤是第 1 個探針就能確定的。

## 衍生

詳見 `.cursor/rules/frontend/026-playwright-first-debugging.mdc`（Rule）。

## 自問

- **下次怎麼不犯？** 同一個 bug，改了 3+ 個檔案就停下來，先跑 smoke probe。
- **哪個 test 該加？** `tests/probe/card-builder-issuer-debug.spec.ts` 作為 smoke test 保留，下次 regression 時直接用。
