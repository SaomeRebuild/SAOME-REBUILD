# Feedback 20260727：Dependabot 5 個漏洞 deferred

## 背景

PR #62（commit `80a97b7`）push 後，GitHub Security 跳出 5 個 open alert：

| # | 嚴重度 | 套件 | 漏洞類型 |
|---|--------|------|----------|
| #7 | High | react-router-dom | RSC CSRF |
| #8 | Low | tmp | symlink arbitrary write |
| #9 | Moderate | uuid | v3/v5/v6 buffer bounds |
| #10 | High | tmp | Path Traversal |
| #11 | High | brace-expansion | DoS |

## 決定

本次 session **不處理**，deferred 至 `SPEC-002-dependabot-triage.md`（待開）。

## 為什麼可以暫緩（攻擊面分析）

- **#8 #10**：tmp 是 dev-only transitive（`vitest → jsdom → css-color → tmp`），不進 production bundle。
- **#11**：brace-expansion 同上，DoS 需餵含 `{...}` 字串進 build process，CI 不接受外部輸入。
- **#9**：uuid 同 dev-only transitive。
- **#7**：react-router RSC CSRF — SAOME 是純 SPA，**未啟用 RSC**，攻擊面 = 0；但若日後開啟 React Server Components 會立即受影響。

## 復工觸發條件（任一即可）

- 計畫開啟 RSC mode 或 SSR
- Dependabot 新增 production-only 漏洞
- CI 加入 `npm audit --audit-level=high` fail 機制
- 季度例行安全審查時

## 解封時要做的事

照 `SPEC-002` 草稿（見 `PLAN-deps-hardening.md` 內 Phase 2~4 區段）：

1. **PR-A**：npm `overrides`（`tmp` / `brace-expansion` / `uuid`）→ 修 #8 #9 #10 #11
2. **PR-B**：`react-router-dom` bump `^7.18.1` → `^7.18.2` → 修 #7
3. **PR-C**：Dependabot 啟用 + CI audit step → 預防未來新增 alert

每步驗證 SOP 已在 PLAN 內，無需重寫。

## 學習

- **規範修復可以 deferred，但 deferred 本身必須有 trace**（feedback + 解封條件）。
- 「攻擊面 = 0」不等於「可忽略」；audit hygiene 仍應做。
- Dependabot 5 alert 其實只需 2~3 個 PR，是 deferred 而非 frozen。
- 規範修法與補救改動應分開 commit：規範層（rule / skill / INDEX）獨立，PR-A / PR-B 獨立，避免一個 PR 同時改文件又改 package.json。
