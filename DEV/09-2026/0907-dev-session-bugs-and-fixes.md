# DEV LOG

## 2026-09-07 Session Summary

### Bug 1：多個 workerd 程序僵屍進程導致 503

**問題**：wrangler dev server 跑著跑著變成多個 workerd 進程卡在系統，導致後端 API 全回 503。

**根因**：Cursor AI agent 會自動重啟 dev server。當手動 kill 一個 workerd，Cursor 又生出新的，變成一個迴圈：kill → respawn → kill → respawn。

**解法**：
- 用 `Get-CimInstance Win32_Process` 查出每個 workerd 的父程序
- 父程序是 Cursor IDE 本身（Powershell 子進程），Cursor 內建會自動重啟
- 殺掉 Cursor 的 Powershell 子進程樹（包含 wrangler/node）
- 確認 port 完全乾淨後再重啟
- 最終建立 `scripts/dev-restart.ps1` script 來自動化清理

**詳細時序**：
```
PID 1480, 5492, 7504, 9156, 10636, 11660, 15900, 15948, 21116, 21500, 22552, 25556, 28256, 28564, 28020
→ 一口氣全部砍掉
→ 確認 port 8787 完全乾淨 (no LISTENING)
→ 重新啟動 wrangler dev --port 8787 --remote
```

**預防**：`scripts/dev-restart.ps1` 已有干淨重啟邏輯。

---

### Bug 2：authService.login() 帶舊 Authorization header

**問題**：使用者嘗試登入，但一直失敗。DevTools Network 面板看到 POST /api/auth/login 帶了 `Authorization: Bearer <old_token>`。

**根因**：`httpClient.ts` 會自動給所有請求加 `Authorization: Bearer <token>`（如果 sessionStorage 裡有舊 token）。當使用者再次登入時，舊 token 已經在 authStore，httpClient 把舊 token 加到 login 請求，後端邏輯可能因此混亂。

**解法**：在 `authService.login()` 和 `authService.register()` 一開始就先清除舊 token：

```typescript
// apps/frontend/src/services/authService.ts
async login(creds: LoginCredentials): Promise<AuthSessionWithTenant> {
  // Clear any existing tokens before login to prevent stale tokens
  // from being sent with the login request (httpClient auto-adds Authorization header)
  setAccessToken(null);
  setRefreshToken(null);
  const session = await httpClient.post<AuthSessionWithTenant>(api.paths.login, creds);
  syncTokens(session);
  return session;
}
```

**同步修復** `register()` 同樣邏輯。

**預防**：未來所有需要清除 auth state 的地方（logout / session expired / 切換用戶）都應該用同樣 pattern。

---

### Bug 3：Workerd CPU time limit crash

**問題**：wrangler dev 跑了 59 秒後回 `Error: Worker exceeded CPU time limit`，後端直接掛。

**根因**：workerd runtime 的 CPU 配額限制。可能是某個 endpoint 有無窮迴圈或計算量過大。

**解法**：重啟 wrangler dev session 即可，runtime 重新初始化。

**預防**：未來需要追蹤哪個請求或哪段程式碼觸發 CPU limit。建議在 `wrangler.jsonc` 設定 `limits.cpu_ms` 或加 log 追蹤。

---

### Bug 4：Vite proxy 對瀏覽器回 503，curl 正常

**問題**：curl 測試 POST /api/auth/login 回 401（正常），但瀏覽器 DevTools 顯示 503。

**觀察**：
- 直接 curl 到 `http://127.0.0.1:8787` → 正常
- curl 到 `http://localhost:5173` (Vite proxy) → 正常
- 瀏覽器 fetch → 503

**根因**：不確定。可能是：
1. CORS preflight OPTIONS 沒過（但 curl OPTIONS 回 204）
2. Vite proxy 對特定 header 組合處理異常
3. 舊的 workerd 程序仍佔著 port，新舊混淆

**解法**：清理所有舊 workerd，確保只有一個乾淨的 wrangler process。

**預防**：建立乾淨重啟 SOP，每次遇到 503 先確認只有一個 wrangler/listener 在跑。

---

### Feature 1：Step 6 集點卡模組化實作（Dispatcher + StampCardLogic）

**Scope**：Card Builder Step 6 (cardLogic) 抽出 generic dispatcher 架構，實作第一個子模組 `StampCardLogic`。

**設計決策（已確認）**：
1. **架構**：Generic dispatcher + 子模組（`Step6CardLogic` 依 `cardType` 分派，目前只 render `StampCardLogic`）
2. **獎勵設定範圍**：三種蓋章模式（基於蓋章/來訪/消費）都顯示（與 mu-plugins `_stamp_reward_tiers_json` 一致）
3. **Storage**：只擴 `template_settings JSONB`，零 migration

**7 個 Phase**：
- Phase 1：schema/constants 同步（4 層：shared → backend request.ts → backend db/templates.ts → backend service）
- Phase 2：i18n keys（`cardEditor.step6.*`）
- Phase 3：Zustand store 擴充（5 新欄位 + 5 setters + sanitizer + reset）
- Phase 4：L2 dispatcher + StampCardLogic 7 個 sub-component
- Phase 5：CardBuilderEditorWorkspace 整合
- Phase 6：TDD unit tests
- Phase 7：Final verification

**觸發規則**：
- Rule 019：Schema Contract Drift（四層同步）
- Rule 023：i18n namespace 元件化
- Rule 000：L2 結構（主組件 ≤ 80 行）
- Rule 003：TDD

---

### Feature 2：Step 3 新增 stamp 卡專用 display field 選項

**Scope**：當 `cardType ∈ {stamp_card, multipass}` 時，Step 3 左右欄位的下拉選單多 3 個選項。

**使用者確認需求**：
1. 這 3 個選項只在 stamp_card / multipass 顯示（非 stamp 卡種不顯示）
2. `PassCardPreviewBody` 接 `stampGridRows` prop，用於 interpolation

**新選項**：

| Key | Dropdown label (zh-TW) | Preview value (zh-TW) |
|---|---|---|
| `availableRewards` | 可用獎勵 | 2 次 |
| `totalStamps` | 總印章數 | 3/N (N = rows × 5) |
| `stampsRemaining` | 還差幾個章 | 6個 |

**實作重點**：
- `CARD_FIELDS` 加 `group: 'common' | 'stamp'` discriminator
- `Step3CardFields` 依 `cardType` filter `CARD_FIELDS`
- `totalStamps` 預覽值用 i18n `{{rows}}` interpolation，但 N = `rows × 5`（每列 5 顆印章）
- 範例：1 列 = 5, 2 列 = 10, 3 列 = 15

**驗證輸出**：
- `tsc -b --noEmit` exit 0
- vitest 62/62 passed
- `verify:i18n-keys` OK — 17 namespaces, 34 locale files

---

## 衍生事項（待追蹤）

| Item | Priority | Owner |
|------|----------|-------|
| Step 6 的 stamp/reward 欄位進 backend schema request.ts | P0 | — |
| `verify-i18n-keys` 的 Latin-mixed 警告 (`auth/zh-TW`, `landing/zh-TW`) | P2 | — |
| wrangler CPU limit crash 根因追蹤（哪個 endpoint 觸發？） | P2 | — |
| `dev-restart.ps1` script 納入正式 SOP | P1 | — |
| httpClient Authorization header 清理 pattern 納入 auth SOP | P1 | — |
