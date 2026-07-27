# Tasks: Member Badge

> MemberBadge 業務元件的任務分解

## Phase 1: Setup

- [ ] T001 Create directory structure apps/frontend/src/components/business/member/MemberBadge/
- [ ] T002 [P] Add barrel export to index.ts

## Phase 2: Foundational

- [ ] T003 Define MemberBadgeProps type in MemberBadge.types.ts
- [ ] T004 [P] Create MemberBadge.hooks.ts with useMemberBadge hook

## Phase 3: US1 - 顯示金牌

- [ ] T005 [US1] Create BDD feature file .specify/memory/specs/features/member-badge.feature
- [ ] T006 [US1] Write failing test for gold tier in MemberBadge.test.tsx
- [ ] T007 [US1] Implement gold tier rendering in MemberBadge.tsx
- [ ] T008 [US1] Verify test passes (green)
- [ ] T009 [US1] Add BDD step definition in packages/shared/bdd/steps/member-badge.ts

## Phase 4: US2 - 顯示銀牌

- [ ] T010 [US2] Add silver tier scenario to member-badge.feature
- [ ] T011 [US2] Write failing test for silver tier
- [ ] T012 [US2] Implement silver tier rendering
- [ ] T013 [US2] Verify test passes

## Phase 5: US3 - 顯示銅牌

- [ ] T014 [US3] Add bronze tier scenario to member-badge.feature
- [ ] T015 [US3] Write failing test for bronze tier
- [ ] T016 [US3] Implement bronze tier rendering
- [ ] T017 [US3] Verify test passes

## Phase 6: Polish

- [ ] T018 [P] Create Storybook stories in MemberBadge.stories.tsx
- [ ] T019 Add i18n integration test
- [ ] T020 Run coverage check (>= 80%)
- [ ] T021 Run smoke test
- [ ] T022 Request code review

## Dependencies

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
```

## Parallel Opportunities

- T002, T003, T004 can be done in parallel (different files)
- T005, T006, T011, T015 test files can be written in parallel
- T018 Storybook can be done in parallel with Phase 3-5

## MVP Scope

Phase 1-3 only (show gold tier first)
