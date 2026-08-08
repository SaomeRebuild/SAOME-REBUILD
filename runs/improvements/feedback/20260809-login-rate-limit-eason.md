# Login Rate Limit — eason1989213@gmail.com 被鎖

**日期**：2026-08-09
**類型**：feedback
**範圍**：auth / login / rate-limit
**嚴重性**：SEV-3（不擋 flow，有 workaround）

---

## 背景

`eason1989213@gmail.com` 使用者回報：密碼輸入正確但仍出現「嘗試次數過多，請稍後再試」警告。其它帳號切換正常。

---

## 根因

**不是「多處登入」限制**。這是 **per-email login rate limit（登入頻率限制）**，設計用來防止暴力破解。

### 運作邏輯

每次 `/login` 請求，rate limit middleware 先查 `login_attempts` table：

```sql
SELECT count(*)::int AS count
  FROM login_attempts
 WHERE LOWER(email_attempted) = LOWER($1)
   AND success = false
   AND attempted_at > now() - make_interval(secs => 600);
```

| 常數 | 值 |
|---|---|
| `LOCKOUT_THRESHOLD` | **3 次** |
| `LOCKOUT_WINDOW_SECONDS` | **600 秒（10 分鐘）** |

- **10 分鐘內同一 email 失敗 3 次** → 回 `429 Too Many Requests` + 警告訊息
- **等待 10 分鐘後自動解除**，不需要管理員介入

### 觸發這次的 DB 記錄

```
id=123  false  2026-08-08 21:06:06 UTC
id=122  false  2026-08-08 21:05:52 UTC
id=121  false  2026-08-08 21:05:52 UTC
```

id 121 和 122 只差 0.6 秒，很可能是 **連點了兩下登入按鈕**。第三筆記錄在 14 秒後寫入，湊滿 3 次觸發 lockout。

---

## 自問

### 下次怎麼不犯？

1. **Login button 沒有 `disabled` 狀態**：連點兩下時，第一個請求結果還沒回、第二個請求已經發出，導致兩個 `success=false` 在 1 秒內寫入。建議加上 `isLoading` 禁用。
2. **Threshold 3 次太嚴格**：正常使用者打錯密碼一次、沒注意大小寫鎖、再錯一次就觸發。建議評估調整為 5 次。

### 建議改善

| 項目 | 說明 |
|---|---|
| Login button 加 `disabled` | 點下去後立即 `disabled`，等 response 回來再解除 |
| Threshold 評估 | 3 → 5 次，降低正常使用者觸發率 |
| 管理員解鎖 | 未來加 admin dashboard「解除 lockout」功能 |
