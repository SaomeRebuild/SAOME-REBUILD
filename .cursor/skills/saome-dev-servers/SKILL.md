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

先清除可能被佔用的端口：

```powershell
netstat -ano | findstr "5173"
netstat -ano | findstr "8787"
```

若發現程序，強制終止：
```powershell
taskkill /PID <PID> /F
```

### Step 2: 啟動 Frontend

```powershell
cd apps/frontend
npm run dev
```

等待 Vite 啟動完成，確認顯示 `Local: http://localhost:5173/`

### Step 3: 啟動 Backend

```powershell
cd apps/backend
npx wrangler dev --port 8787 --remote
```

等待 wrangler 啟動完成，確認顯示 `Ready on http://127.0.0.1:8787`

### Step 4: 確認結果

回報啟動狀態：

| 服務 | Port | URL | 狀態 |
|-----|------|-----|------|
| Frontend | 5173 | http://localhost:5173 | ✅ 運行中 |
| Backend | 8787 | http://127.0.0.1:8787 | ✅ 運行中 |

## 快速複製

```powershell
# 一次清除並啟動
netstat -ano | findstr "5173 8787" && taskkill /PID <PID> /F
cd apps/frontend; npm run dev &
cd apps/backend; npx wrangler dev --port 8787 --remote
```
