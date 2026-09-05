# SAOME 2026-09-05 ~ 09-06 Bug + Tech Debt Batch Master Trace

## Metadata

- **日期**：2026-09-05 ~ 09-06
- **作者**：Josh（agent-assisted via Cursor）
- **範圍**：3 條並行 session 線交織 — (A) CardBuilder Step 4 + Slow-Network Baseline、(B) Auth Logout Critical Chain Hardening、(C) Phase 5 Long-Pending Tech Debt Batch（16 todos 全 ship）
- **Severity 範圍**：SEV-1（auth critical chain）+ SEV-2（無聲資料損毀）+ SEV-3（structural refactor）+ SEV-4（rule sedimentation）
- **規範層沉澱**：4 新 rules + 3 rule strengthenings + 1 SKILL update
- **總 commit 數**：~22 commits（Phase 1 → Phase 5 ship + 本次 retrospective）

---

## 三條並行 session 線

```mermaid
timeline
    title SAOME 2026-09-05 ~ 09-06 三條 session 線
    section A · CardBuilder Step 4
        Step 4 初版 · i18n + autosave           :完成
        i18n counter raw key                    :完成
        Slow-network baseline 洗 DB              :trace
        Validator 拆分 + textarea + phone fallback:trace
    section B · Auth Logout Critical Chain
        B1 前端 5xx retry                       :ship
        B2 CORS wrap-after-next                 :ship
        B3 Hyperdrive warmup cron               :ship
        B4 auth logout 全端                     :ship
        Phase 2 option B wire + 1h TTL          :ship
        Phase 3 P2 cleanup batch                :ship
    section C · Phase 5 Long-Pending Tech Debt
        5.1 name autosave baseline-arm          :ship
        5.7 unwrapCardSettings 抽 shared/       :ship
        5.8 non-ASCII round-trip tests          :ship
        5.13 Migration apply pipeline CI gate    :ship
        5.14 / 5.15 Rule 016 surface 9 + Rule 034  :ship
        5.16 i18n cross-locale drift audit      :ship
```

---

## Session A — CardBuilder Step 4 + Slow-Network Baseline

### Timeline

| 時間（UTC+8） | 事件 | 對應文件 |
|---|---|---|
| 09-05 上午 | Step 4 初版 i18n + autosave（含 `backFields.counter` 缺失、`useEffect` deps 漏 `JSON.stringify` snapshot guard）| `DEV/09-2026/0905-step4-i18n-counter-and-autosave.md` |
| 09-05 下午 | Slow-network baseline 洗 DB（1s debounce vs 1500ms fetch race）| `DEV/09-2026/0905-step4-autosave-slow-network-baseline.md` |
| 09-05 下午 | Phase 5.1 name autosave 套 `step4LoadSettledRef` pattern | (commit `5f99dba`) |
| 09-05 晚上 | 3 SOP rules sediment：Rule 030 / 031 / 032 | (commit `cd9a232`) |
| 09-05 晚上 | Round 2：BackFields vs Links validator 拆分 + textarea | `runs/.../20260905-step4-backfields-link-format-cross-contamination.md` |
| 09-05 晚上 | Round 2：`isValidUrl` phone/email fallback | `runs/.../20260905-step4-isvalidurl-phone-email-fallback.md` |
| 09-06 凌晨 | Master completion narrative | `DEV/09-2026/0905-step4-completion-master.md` |

### 核心 root cause

> **Effect 第一次 run + 長 timer + async fetch = silent data corruption 三角形**

- `useEffect(() => {...}, [cardId, description, backFields, links])`：第一次 run 跑在 `getById` resolve 之前
- `setTimeout` 1s debounce + fetch 1.5s resolve：timer 先 fire
- 後端 JSONB `||` merge：empty value silent overwrite 不 throw

三個獨立機制組合產生「寫 empty defaults 進 DB」的 silent bug。

### 規範層沉澱

| Rule | 強制條款 | Reference implementation |
|---|---|---|
| Rule 030 | `baselineArmedRef` 守「effect 第一次 run」不做事 | `CardBuilderEditor.tsx` Step 4 line 175-225 |
| Rule 031 | ≥1000ms autosave timer 必走 baseline-armed + slow-network regression test | `CardBuilderEditor.autosave.test.tsx` 7 case |
| Rule 032 | 後端 JSONB merge 是 silent killer：前端必 client-side validate + 後端必 zod parse + DB 必加 CHECK constraint 三層防護 | `updateTemplate()` + `TemplateSettingsSchema` |

### Cross-link

- `DEV/09-2026/0905-step4-i18n-counter-and-autosave.md` — 初版 bug + autosave fix
- `DEV/09-2026/0905-step4-autosave-slow-network-baseline.md` — slow-network trace
- `DEV/09-2026/0905-step4-completion-master.md` — Round 1+2 master narrative
- `runs/.../20260905-step4-backfields-link-format-cross-contamination.md` — Round 2 validator 拆分
- `runs/.../20260905-step4-isvalidurl-phone-email-fallback.md` — Round 2 phone/email fallback
- `runs/.../20260906-rule-sediment-030-031-032.md` — Rule 030/031/032 sediment 本次 retrospective

---

## Session B — Auth Logout Critical Chain Hardening

### Timeline

| 時間（UTC+8） | 事件 | 對應文件 / commit |
|---|---|---|
| 09-05 凌晨 | Decision Log 三段式 option A/B/C | `runs/decisions/2026-09-05-auth-logout-revocation-strategy.md` |
| 09-05 早上 | B1 + B2 + B3 + B4 ship（4 batch critical chain） | commit `11b5f58` |
| 09-05 中午 | Production smoke test `(auth-logout.spec.ts)` | (follow-up Phase 1) |
| 09-05 下午 | Phase 2.2 option B wire（jti + DB check + pg_cron cleanup）| commit `c1dd57a` |
| 09-05 傍晚 | Phase 2.1 ACCESS_TOKEN_TTL 8h → 1h | commit `c1dd57a`（同 batch）|
| 09-05 傍晚 | Phase 2.3 httpClient.tryRefresh 包 withRefreshMutex | commit `c1dd57a`（同 batch）|
| 09-05 晚上 | Phase 3 P2 cleanup batch（5 todo）| commit `dcb8af1` + `5f99dba` |
| 09-05 晚上 | Phase 5.1 name autosave 套 `step4LoadSettledRef` | commit `5f99dba` |

### 核心根因

> **「It works but it looks wrong」+ 「後端 200 ≠ 通過」+ critical chain silent race**

| 層 | 問題 |
|---|---|
| UI | 按 Logout button 只清 `sessionStorage`，HttpOnly cookie 30 天持續有效 |
| F5 reload | AuthProvider 用 cookie refresh 自動登入 —「視覺登出實際還在線」|
| Multi-tab | `httpClient.tryRefresh` 與 `authService.refresh` 各跑各的 Promise → 多 tab 同時 401 時 race condition |
| 5xx burst | Worker cold start 撞 503，前端無 retry → 「curl 看起來通、瀏覽器不通」|
| CORS | `c.res` 在 `await next()` 前設定 header，被 handler 內 `new Response()` 蓋掉 |

### 規範層沉澱

| Rule | 規範 |
|---|---|
| `AGENTS.md § Auth flow 鐵律` #1-#5 | 強化：後端 200 ≠ 通過、SPA 必 client-side redirect、AuthGuard 對稱、forbidden class scan、useAuth 回傳 shape |
| `030 / 031 / 032` | 已在 Session A 列出 |
| `004-code-review.mdc` | Critical chain production smoke 自動升 L3 |
| 既有 rule | 加強 5xx retry + CORS wrap + Hyperdrive warmup cron 的 surface |

### Cross-link

- `runs/decisions/2026-09-05-auth-logout-revocation-strategy.md` — option A/B/C 三段式
- `runs/.../20260905-auth-logout-batch.md` — B1-B4 feedback
- `runs/.../20260906-auth-logout-followups.md` — Phase 2 option B wire + Phase 3 cleanup（本次新寫）

---

## Session C — Phase 5 Long-Pending Tech Debt Batch

### Timeline & Commit Map

| Phase | 主題 | Commit | rule / migration / doc | Status |
|---|---|---|---|---|
| 5.1 | name autosave `step4LoadSettledRef` 守門 | `5f99dba` | (與 Step 4 同 pattern，見 Session A) | ✅ |
| 5.2 | CardBuilderEditor 外層 fetch delegate | `4929e7f`（隱性 refactor）| doc-comment 標明移除 | ✅ |
| 5.3 | Rule 030「Effect 第一次 run 不可信」 | `cd9a232` | `.cursor/rules/030-*.mdc` | ✅ |
| 5.4 | Rule 031「長 timer + async fetch 是雷區」 | `cd9a232` | `.cursor/rules/031-*.mdc` | ✅ |
| 5.5 | Rule 032「後端 JSONB merge silent killer」 | `cd9a232` | `.cursor/rules/032-*.mdc` | ✅ |
| 5.6 | Popover Sizing Pattern | `f79fbfd` | `.cursor/rules/033-*.mdc`（new）+ Rule 013 cross-link | ✅ |
| 5.7 | `unwrapCardSettings` 抽 `packages/shared/logic/cardSettings.ts` | `fa18ae9` | shared refactor | ✅ |
| 5.8 | `updateTemplate` non-ASCII round-trip regression | `121ecd9` | `templates.test.ts` +13 case | ✅ |
| 5.9 | `syncFocalFromOffset` + `srcSquareSize` 抽 shared/ | (already shipped) | bundled into `packages/shared/logic/imageCrop.ts` | ✅（檔名略不同） |
| 5.10 | `useImageCrop` Hook Split Pattern feedback | `e24352c` | `runs/.../20260830-use-image-crop-platform-split.md` | ✅ |
| 5.11 | LogoUploader 887 → 394 行 refactor feedback | `e24352c` | `runs/.../20260830-logouploader-887-line-refactor.md` | ✅ |
| 5.12 | BackgroundUploader 沿用 Crop Window Invariant + variant="background" | `09cd641 / ffcaf28` | (covered by 0901-background-uploader-implementation.md) | ✅ |
| 5.13 | Migration apply pipeline (CI gate) | `2aba443` | `.cursor/rules/035-*.mdc`（new）+ `check-migrations-applied.cjs` + `.applied-migrations.json` (14 backfill) + deploy.yml 新 job | ✅ |
| 5.14 | Rule 016 補第 9 surface（CI cache cache-dependency-path） | `3d65ca3` | `.cursor/rules/016-*.mdc` 加 § 9 | ✅ |
| 5.15 | Rule 034 CI Workflow Modification Checklist | `423a9ba` | `.cursor/rules/034-*.mdc`（new） | ✅ |
| 5.16 | i18n cross-locale drift audit + harden verify:i18n | `95e3cf6` + `ee6ac75` | `verify-i18n-keys.mjs` (regex → string-aware parser) + 17 namespaces 普查 | ✅ |

### 核心根因 cluster

> **「多個獨立技術債各自 ship 的累積，最終用 4 條同 pattern 規範沉澱」**

Session C 是「tech debt batch」典型案例：
- 16 條 todo 各自對應獨立 root cause（migration apply pitfall、CI cache drift、Cross-locale drift、shared logic 抽取…）
- 但同 pattern：**「沒有 CI gate 守護就會 silent 退化」**
- 最終沉澱 4 新 rules + 3 rule strengthenings + 1 SKILL update

### 規範層沉澱

| Type | 名稱 | 規範 |
|---|---|---|
| New rule | `.cursor/rules/030-effect-first-run-not-trustworthy.mdc` | baselineArmedRef pattern |
| New rule | `.cursor/rules/031-long-timer-async-fetch.mdc` | ≥1s timer + baseline-arm + slow-network regression test MANDATORY |
| New rule | `.cursor/rules/032-backend-jsonb-merge-silent-killer.mdc` | 三層防護（client zod + server zod + DB CHECK） |
| New rule | `.cursor/rules/033-popover-sizing-pattern.mdc` | Option A sizing + 嚴格空間檢查 + maxVisibleTop clamp + mock-rect test |
| New rule | `.cursor/rules/034-ci-workflow-modification-checklist.mdc` | 4 必查（cache key / Node / secret / workspace root） |
| New rule | `.cursor/rules/035-migration-apply-pipeline.mdc` | 8-section discipline + CI gate |
| Strengthened | `.cursor/rules/016-config-and-tsconfig-discipline.mdc` § 9 | CI cache cache-dependency-path surface |
| Strengthened | `.cursor/rules/013-rwd.mdc` | 補「Desktop Popover/Dropdown Placement」章節（cross-link Rule 033） |
| Skill | `.cursor/skills/saome-image-upload/SKILL.md` § 11.1 | Rectangular Crop Window + Stage Width Floor |

### Cross-link

- `runs/.../20260906-rule-sediment-030-031-032.md` — Phase 5.3-5.5（本次新寫）
- `runs/.../20260906-phase5.13-migration-pipeline.md` — Phase 5.13（本次新寫）
- `runs/.../20260906-phase5.7-unwrap-card-settings-shared.md` — Phase 5.7（本次新寫）
- `runs/.../20260906-phase5.16-i18n-audit.md` — Phase 5.16（本次新寫）

---

## Cross-link Index（哪個 doc 在哪）

| 主題 | DEV LOG | Feedback / Decision | Rule / Skill |
|------|--------|---------------------|--------------|
| CardBuilder Step 4 i18n + autosave 初版 | `DEV/09-2026/0905-step4-i18n-counter-and-autosave.md` | — | — |
| Slow-network baseline 洗 DB | `DEV/09-2026/0905-step4-autosave-slow-network-baseline.md` | — | Rule 030 / 031 / 032 |
| Step 4 Round 2 validator 拆分 | — | `runs/.../20260905-step4-backfields-link-format-cross-contamination.md` | — |
| Step 4 Round 2 phone/email fallback | — | `runs/.../20260905-step4-isvalidurl-phone-email-fallback.md` | — |
| Step 4 master completion | `DEV/09-2026/0905-step4-completion-master.md` | — | — |
| Auth logout B1-B4 critical chain | — | `runs/decisions/2026-09-05-auth-logout-revocation-strategy.md` + `runs/.../20260905-auth-logout-batch.md` | AGENTS § Auth flow + Rule 025/030/031 |
| Auth logout Phase 2 + Phase 3 follow-ups | — | `runs/.../20260906-auth-logout-followups.md`（本次）| — |
| Phase 5.7 unwrapCardSettings shared | — | `runs/.../20260906-phase5.7-unwrap-card-settings-shared.md`（本次）| Rule 023 shared validation |
| Phase 5.13 Migration apply pipeline | — | `runs/.../20260906-phase5.13-migration-pipeline.md`（本次）| Rule 035 |
| Phase 5.14 / 5.15 Rule 016 / 034 | — | — | Rule 016 § 9 + Rule 034 |
| Phase 5.16 i18n audit | — | `runs/.../20260906-phase5.16-i18n-audit.md`（本次）| — |
| Rule 030 / 031 / 032 sediment | — | `runs/.../20260906-rule-sediment-030-031-032.md`（本次）| — |
| BackgroundUploader L2 | `DEV/08-2026/0901-background-uploader-implementation.md` | 3 feedbacks in INDEX | Rule 028 § 11.1 / 12.1 / 16 |
| Color Picker L2 | `DEV/09-2026/0903-color-picker-implementation.md` | `runs/.../20260903-color-picker-popover-option-a.md` | Rule 013 / Rule 033 |
| LogoUploader 887 → 394 refactor | `DEV/08-2026/0830-logouploader-p0p1-refactor-rule-sedimentation.md` | `runs/.../20260830-logouploader-887-line-refactor.md` | Rule 000 § A.3 |

---

## 規範層沉澱總覽

### 4 新 rules

| # | Rule | 主題 |
|---|---|---|
| 030 | `effect-first-run-not-trustworthy.mdc` | baselineArmedRef SOP |
| 031 | `long-timer-async-fetch.mdc` | ≥1s timer + regression test |
| 032 | `backend-jsonb-merge-silent-killer.mdc` | 三層防護 |
| 033 | `popover-sizing-pattern.mdc` | Option A + clamp |
| 034 | `ci-workflow-modification-checklist.mdc` | 4 必查 |
| 035 | `migration-apply-pipeline.mdc` | 8-section discipline + CI gate |

### 3 rule strengthenings

| Rule | 加強處 |
|------|--------|
| 016-config-and-tsconfig-discipline | § 9 CI cache cache-dependency-path |
| 013-rwd | Desktop Popover/Dropdown Placement 章節（cross-link Rule 033）|
| 023-shared-package | i18n 元件化 + shared validation i18n key |

### 1 SKILL 補強

`.cursor/skills/saome-image-upload/SKILL.md` § 11.1 Rectangular Crop Window + § 12.1 Stage Width Floor（cross-ref Rule 028 § 11.1 / § 12.1 / § 16）

---

## 整體教訓（8 條 takeaways）

1. **「Effect 第一次 run + 長 timer + async fetch」三角形是 silent data corruption 的標準 SOP 破口** — 三者各處理一塊（baselineArmedRef / timer 重新設計 / valid 資料架構），缺一就壞
2. **Auth 是 critical chain 上的 silent bug**：視覺登出實際還在線 → production smoke test 是 mandatory 不是 optional
3. **CI gate 比 memo 更可靠**：migrations CI gate、verify-i18n hard-fail、rule 016 § 9 cache path 都是同 pattern「沒 CI 守就會 silent 退化」
4. **Vitest 沒抓到 workerd pitfall 因為 test 在 Vite pool**：必須做 vitest + wrangler dev 雙重 coverage
5. **Cross-locale i18n drift 的「regex 解析」天生不準**：regex 會 catch 到翻譯值內的 identifier 當 key false positive；必須升級為 string-aware + JSON round-trip
6. **Decouple 在 shared/ 是 SAOME RN 化策略的核心**：`unwrapCardSettings` 抽 `packages/shared/logic/` 證明 backend + frontend + RN 共用同一 source of truth
7. **Decision Log 三段式在 L3 Heavy 是 mandatory 不是 nice-to-have**：option A/B/C 三條路權衡讓後續 Phase 2.2 wire 有清晰 anchor
8. **「It works but it looks wrong」仍是 P0**：每個 placeholder / L1 元件 must 跑 forbidden-class scan；Auth 鐵律 #4

---

## 給未來 session 的提醒（5 條）

1. 新增 `useEffect` 內含 `setTimeout/setInterval` ≥1s，且 effect 依賴 async fetch 來的 store 值 → **必** reference Rule 030 + Rule 031 + 寫 conformance test
2. 新增 `supabase/migrations/*.sql` → **必** reference Rule 035 完整 8-section + `npm run check:migrations` 通過
3. 新增後端 UPDATE/INSERT 涉及 jsonb → **必** reference Rule 032 三層防護 + `sql.json()`（禁用 `${JSON.stringify(x)}::jsonb`）
4. 改 `.github/workflows/*.yml` → **必** reference Rule 034 4 必查（cache key、Node、secret、workspace root）
5. 新增任何 i18n key → **必** 同步兩個 locale + `npm run verify:i18n` 通過（hard-fail CI gate）

---

## 觸發關鍵字

> 「effect 第一次 run」「debounce」「autosave」「baselineArmedRef」「step4LoadSettledRef」「slow-network」「JSONB silent overwrite」「empty 寫 DB」「migration apply pipeline」「cache-dependency-path」「CI workflow」「popover mid-band」「cross-locale drift」「auth logout critical chain」「option B wire」「jti claim」「pg_cron cleanup」「revoked_tokens」**必引本檔**。

---

## 參照

- `runs/improvements/INDEX.md`（本次同步更新 row）
- `.cursor/rules/030-031-032-033-034-035-*.mdc`（本次 ship）
- `.cursor/rules/016-config-and-tsconfig-discipline.mdc` § 9（本次 ship）
- `.cursor/skills/saome-image-upload/SKILL.md` § 11.1（cross-ref Rule 028）
- `runs/decisions/2026-09-05-auth-logout-revocation-strategy.md`
- `runs/.../20260905-auth-logout-batch.md`
- `runs/.../20260905-step4-isvalidurl-phone-email-fallback.md`
- `runs/.../20260905-step4-backfields-link-format-cross-contamination.md`
- `runs/.../20260830-use-image-crop-platform-split.md`
- `runs/.../20260830-logouploader-887-line-refactor.md`
- `DEV/09-2026/0905-step4-*.md`（4 份 Step 4 DEV LOG）
- `DEV/08-2026/0830-logouploader-p0p1-refactor-rule-sedimentation.md`
- `apps/backend/scripts/check-migrations-applied.cjs`
- `supabase/migrations/.applied-migrations.json`（14 backfill）
- `.github/workflows/deploy.yml`（新 `migrations` job）
