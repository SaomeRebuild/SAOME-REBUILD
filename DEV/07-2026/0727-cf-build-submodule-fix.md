# 2026-07-27 CF Pages build 失敗修復 (Plan D.5 推進)

## 觸發
> Failed: error occurred while updating repository submodules

## 根因
- `mu-plugins/` 在 git index 是 gitlink (mode 160000) 指向 commit `3362cda91e...`
- 但 `.gitmodules` 檔案**不存在**
- CF Pages build container 嘗試 `git submodule update --init` 時 fail

## Owner-agent 決定
刪除 mu-plugins / SAOME-REBUILD 是新 Vite SPA，不需要 WordPress mu-plugin。

## 處理
- `git rm --cached mu-plugins`（取消 tracking）
- `Remove-Item -Recurse mu-plugins`（清 working tree 殘留）
- `.gitignore` 仍保留 `mu-plugins/` line（防殘留）

## Commit
- `e9af751` fix(build): remove broken mu-plugins submodule reference
  - 1 file changed, 1 deletion(-)
  - delete mode 160000 mu-plugins

## 預期效果
- CF Pages 下次 build 應能通過 submodule 階段
- 進入實際 build 階段（npm run build）
- 之後才是 deploy

## Plan 進度
- D.4 ✅（Supabase init migration）
- D.3 ⚠️（CF Dashboard 連線 — owner-agent 手動）
- D.5 ⏳ → 現在等 D.5 重新 build 通過 → 之後驗證 saome-frontend.pages.dev
