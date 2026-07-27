# 001 - Member Badge Implementation Plan

> MemberBadge 業務元件的實作計畫

## Technical Context

### Stack

- **Frontend**: React 19 + Vite + TypeScript (strict)
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **i18n**: packages/shared/i18n/
- **Testing**: Vitest + React Testing Library

### Module Structure

```
apps/frontend/src/components/business/member/MemberBadge/
├── index.ts                    ← barrel export
├── MemberBadge.tsx             ← 主組件（< 100 行）
├── MemberBadge.types.ts        ← TypeScript types
├── MemberBadge.hooks.ts        ← hooks (如 useMemberBadge)
├── MemberBadge.test.tsx        ← Vitest + RTL tests
└── MemberBadge.stories.tsx     ← Storybook
```

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 等級對應 | icon + text 組合 | 視覺區別清晰 |
| 顏色 | 銅/銀/金 對應色 token | 避免 hard-code |
| i18n | packages/shared/i18n | 跨平台共用 |
| Type | 使用 zod schema | 與後端一致 |
| Testing | Vitest + RTL | 與專案 stack 一致 |

## Constitution Check

- ✅ SDD-First: spec.md 已產出
- ✅ BDD-Validated: 將產出 .feature
- ✅ TDD-Mandatory: 將先寫 failing test
- ✅ Superpowers-Integrated: 使用 brainstorming + test-driven-development
- ✅ Mobile-Future-Proof: 業務邏輯在 packages/shared/

## Implementation Phases

### Phase 1: Setup

- 建立目錄結構
- 設定 Storybook 入口

### Phase 2: Foundational

- 定義 TypeScript types
- 建立 zod schema 引用

### Phase 3: US1 - 顯示金牌

- 寫 .feature
- 寫 failing test
- 實作金牌顯示
- 驗證 green

### Phase 4: US2 - 顯示銀牌

- 寫 .feature
- 寫 failing test
- 實作銀牌顯示
- 驗證 green

### Phase 5: US3 - 顯示銅牌

- 寫 .feature
- 寫 failing test
- 實作銅牌顯示
- 驗證 green

### Phase 6: Polish

- Storybook stories
- i18n 整合
- RWD 調整

## File Structure

```
files created:
- apps/frontend/src/components/business/member/MemberBadge/index.ts
- apps/frontend/src/components/business/member/MemberBadge/MemberBadge.tsx
- apps/frontend/src/components/business/member/MemberBadge/MemberBadge.types.ts
- apps/frontend/src/components/business/member/MemberBadge/MemberBadge.hooks.ts
- apps/frontend/src/components/business/member/MemberBadge/MemberBadge.test.tsx
- apps/frontend/src/components/business/member/MemberBadge/MemberBadge.stories.tsx

files referenced:
- packages/shared/schemas/member.ts
- packages/shared/i18n/zh-TW.ts
- packages/shared/i18n/en.ts
- packages/shared/logic/member.ts

files to add:
- .specify/memory/specs/features/member-badge.feature
```
