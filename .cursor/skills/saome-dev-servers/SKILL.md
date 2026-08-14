---
name: saome-dev-servers
description: 啟動 SAOME 前後端開發伺服器。當用戶說「開啟」、「啟動」、「重啟」、「開發環境」、「前後端」時使用此 skill。
---

# SAOME Dev Servers

## 環境架構

```
Cloudflare Workers (Backend)
         ↓
    Hyperdrive (連線池化)
         ↓
  遠端 PostgreSQL (雲端)
```

**重要：** Backend 透過 Hyperdrive 直接連到雲端資料庫，無需本地 DB。

## 工作流程

### Step 1: 清除佔用端口

先清除可能被佔用的端口（包含多個 Node 進程）：

```powershell
netstat -ano | findstr "5173"
netstat -ano | findstr "8787"
```

若發現程序，強制終止：
```powershell
taskkill /PID <PID> /F
```

**特別注意：** 多個 `node.exe` 進程可能同時占用同一端口，確認所有相關進程都已終止。

### Step 2: 啟動 Backend（先啟動）

Backend 啟動時需要上傳到 Cloudflare 預覽環境（約 10-20 秒）。

```powershell
cd apps/backend
npx wrangler dev --port 8787 --remote
```

等待 wrangler 顯示 `Ready on http://127.0.0.1:8787` 再繼續。

### Step 3: 啟動 Frontend

```powershell
cd apps/frontend
npm run dev
```

等待 Vite 顯示 `Local: http://localhost:5173/`

### Step 4: 確認結果

| 服務 | Port | URL | 狀態 |
|-----|------|-----|------|
| Backend | 8787 | http://127.0.0.1:8787 | ✅ 運行中 |
| Frontend | 5173 | http://localhost:5173 | ✅ 運行中 |

## 常見錯誤排查

### ECONNREFUSED 127.0.0.1:8787

**原因：** Frontend 先啟動，Backend 還在 deploy。

**解決：** 正常現象，等待 Backend 出現 `Ready on http://127.0.0.1:8787` 即可。

### 多個 node.exe 占用端口

**徵兆：** `netstat -ano | findstr "8787"` 出現多個 PID。

**原因：** 多個 Vite / wrangler 進程殘留，導致新進程無法綁定端口。

**解決：**
```powershell
taskkill /IM node.exe /F
```
殺掉所有 node.exe 後重新啟動。

### ECONNRESET（陸續多筆）

**原因：** Backend 在運行中被終止（crash / token 過期 / 手動關閉）。

**解決：** 重啟 Backend。

### wrangler "Failed to establish remote session"

```
[ERROR] Failed to establish remote session due to an authentication issue.
Your credentials may have expired or been revoked.
```

**原因：** Cloudflare wrangler 認證 token 過期（約 24 小時）。

**解決：**
```powershell
npx wrangler logout
npx wrangler login
```

然後重新啟動 Backend。

### wrangler 一直顯示 "Refreshing preview token..."

**原因：** 同上，token 即將過期或已過期，wrangler 在不斷重試。

**解決：** 立即執行 `wrangler logout && wrangler login` 並重啟 Backend。

## Wrangler 認證管理

### 檢查認證狀態
```powershell
npx wrangler whoami
```

### 更新認證
```powershell
npx wrangler logout
npx wrangler login
```

### 長時間開發建議

- Wrangler `--remote` mode 的 token 約 24 小時過期
- 過夜開發時，隔天可能需要重新 login
- Frontend (Vite) 可以一直運行，Backend 重啟後前端 proxy 會自動恢復連線

## 快速複製

```powershell
# 一次清除並啟動（先 backend 再 frontend）
netstat -ano | findstr "5173 8787" && taskkill /PID <PID> /F
cd apps/backend; npx wrangler dev --port 8787 --remote &
cd apps/frontend; npm run dev
```
