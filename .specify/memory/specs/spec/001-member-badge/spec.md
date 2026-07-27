# 001 - Member Badge Component

> 顯示會員等級的業務元件

## Overview

### Problem

SAOME 會員系統需要在前台顯示會員等級（銅牌/銀牌/金牌），目前沒有一個統一的元件來處理。

### Goal

建立 `MemberBadge` L2 業務元件，根據會員的 `tier` 顯示對應的等級圖示與名稱。

### User Value

- 使用者能一眼看到自己的會員等級
- 不同等級有不同的視覺區別
- 與 SAOME 既有會員資料流整合

## User Scenarios

### Scenario 1: 顯示金牌會員

- **When** 會員的 tier 為 `gold`
- **Then** 顯示金牌圖示與「金牌」文字

### Scenario 2: 顯示銀牌會員

- **When** 會員的 tier 為 `silver`
- **Then** 顯示銀牌圖示與「銀牌」文字

### Scenario 3: 顯示銅牌會員

- **When** 會員的 tier 為 `bronze`
- **Then** 顯示銅牌圖示與「銅牌」文字

## Functional Requirements

### FR-1: 等級顯示

- 元件必須根據 `tier` prop 顯示對應的等級
- 等級名稱必須從 i18n 取得
- 銅/銀/金 三種等級必須視覺上有區別

### FR-2: RWD 支援

- 在 mobile 觸控目標 ≥ 44pt
- 在 desktop 觸控目標 ≥ 32pt
- 文字 ≥ 14px

### FR-3: i18n 整合

- 使用 `packages/shared/i18n/zh-TW.ts` 的 `member.tier.*`
- 支援 `zh-TW` 與 `en` 兩種語系

### FR-4: TypeScript 嚴格

- 必須使用 `packages/shared/schemas/member.ts` 的 `memberTierSchema`
- 不允許任何 `any` 類型

## Success Criteria

### SC-1: 三種等級正確顯示

- 銅牌會員頁面顯示「銅牌」
- 銀牌會員頁面顯示「銀牌」
- 金牌會員頁面顯示「金牌」

### SC-2: 測試覆蓋

- 單元測試覆蓋率 ≥ 80%
- 三種等級都有對應的測試案例

### SC-3: 效能

- 元件渲染時間 < 16ms
- Bundle size 增加 < 5KB

## Out of Scope

- 會員升級功能
- 會員等級的權限管理
- 動畫效果
- 拖拉排序

## Assumptions

- 已有 `Member` 資料模型（含 `tier` 欄位）
- 已有 `getTierDisplayName` 純函式
- 已有 i18n 翻譯檔

## Dependencies

- React 19
- TypeScript
- `@saome/shared` 套件
- Tailwind CSS
- Lucide icons

## Open Questions

無
