# Tasks: Legal Pages Full i18n Refactor

> 追蹤 [spec.md](spec.md) 的實作進度。

---

## Phase 1：SDD 文件

- [x] T1.1 建立 `specs/spec/legal-pages-i18n/spec.md`
- [x] T1.2 建立 `specs/spec/legal-pages-i18n/tasks.md`（本文件）

---

## Phase 2：BDD 場景

- [x] T2.1 建立 `specs/features/legal-pages-i18n.feature`，含 10 個 Gherkin 場景

---

## Phase 3：i18n keys 補齊

### 3.1 zh-TW.json

- [ ] T3.1.1 補 `legal.gdpr.parties.*`（4 個 keys：controller.label/.address, processor.label/.address）
- [ ] T3.1.2 補 `legal.gdpr.scope.*`（8 個 keys：tableHeader.item/.desc + 6 row keys）
- [ ] T3.1.3 補 `legal.gdpr.obligations.*`（13 個 keys）
- [ ] T3.1.4 補 `legal.gdpr.termination.*`（2 個 keys）
- [ ] T3.1.5 補 `legal.privacy.controller.table.*`（6 個 keys）
- [ ] T3.1.6 補 `legal.privacy.collection.*`（12 個 keys：3 表頭 + 9 cells）
- [ ] T3.1.7 補 `legal.privacy.processor.body`（1 個 key）
- [ ] T3.1.8 補 `legal.privacy.sharing.*`（2 個 keys）
- [ ] T3.1.9 補 `legal.privacy.rights.*`（14 個 keys：1 intro + 6 權利 × 2 fields）
- [ ] T3.1.10 補 `legal.privacy.retention.*`（2 個 keys）

### 3.2 en.json（同樣結構）

- [ ] T3.2.1 補 `legal.gdpr.parties.*` 英文
- [ ] T3.2.2 補 `legal.gdpr.scope.*` 英文
- [ ] T3.2.3 補 `legal.gdpr.obligations.*` 英文（採法律術語：DSR / DPIA / Article 32 / SCCs）
- [ ] T3.2.4 補 `legal.gdpr.termination.*` 英文
- [ ] T3.2.5 補 `legal.privacy.controller.table.*` 英文
- [ ] T3.2.6 補 `legal.privacy.collection.*` 英文（GDPR Article 6(1)(b)/(c)/(f) 對應）
- [ ] T3.2.7 補 `legal.privacy.processor.body` 英文
- [ ] T3.2.8 補 `legal.privacy.sharing.*` 英文（Cloudway / DigitalOcean / SCCs）
- [ ] T3.2.9 補 `legal.privacy.rights.*` 英文（Access / Rectification / Erasure / Restriction / Data Portability / Objection）
- [ ] T3.2.10 補 `legal.privacy.retention.*` 英文

---

## Phase 4：Component 重寫（TDD：Red → Green → Refactor）

### 4.1 GDPRPage

- [ ] T4.1.1 RED：寫 `GDPRPage.test.tsx`，先斷言新 keys（中英）存在
- [ ] T4.1.2 GREEN：重寫 `GDPRPage.tsx`，把硬編碼中文換成 `t(...)`
- [ ] T4.1.3 REFACTOR：檢查 ≤ 200 行上限、移除多餘變數

### 4.2 PrivacyPage

- [ ] T4.2.1 RED：寫 `PrivacyPage.test.tsx`，先斷言新 keys（中英）存在
- [ ] T4.2.2 GREEN：重寫 `PrivacyPage.tsx`，把硬編碼中文換成 `t(...)`
- [ ] T4.2.3 REFACTOR：DSR 清單改為 `rightsKeys.map(...)`

---

## Phase 5：驗證

- [ ] T5.1 `tsc --noEmit` 0 error
- [ ] T5.2 `vitest run` 全綠
- [ ] T5.3 兩版 JSON 的 `legal.privacy` 與 `legal.gdpr` 子樹 keys 數完全一致
- [ ] T5.4 `vite dev` 啟動成功（HTTP 200）
- [ ] T5.5 Deslop 通過：沒 console.log、沒 as any、沒 narration 註解

---

## Phase 6：DEV 紀錄

- [ ] T6.1 寫 `DEV/07-2026/0726-legal-pages-i18n.md`

---

## 進度追蹤

| Task | 狀態 | 備註 |
|---|---|---|
| Phase 1 文件 | 完成 | |
| Phase 2 BDD | 進行中 | |
| Phase 3 i18n keys | 等待 | |
| Phase 4 Component | 等待 | |
| Phase 5 驗證 | 等待 | |
| Phase 6 DEV | 等待 | |
