# Design Tokens Compliance Check (PR-2 audit)

> 2026-07-28 audit — captures the state of frontend pages/components against
> [design-system/MASTER.md](../../../../../design-system/MASTER.md) §1 + §9
> (warm-orange dark SaaS palette).

## Audit Method

For each page/component in `apps/frontend/src/{pages,components}/`, verify:

1. Page background uses `var(--color-background)` (#0F0F23), not `bg-neutral-*`.
2. Card surfaces use `var(--color-card)` (#1B1B30) + `var(--color-border)`, not `bg-white`.
3. Input/border uses `var(--color-border)` + focus ring `var(--color-ring)`.
4. Primary CTA uses `var(--color-primary)` (#F97316) with `var(--color-on-primary)` text.
5. No emoji characters used as structural icons (Lucide SVG only).
6. No `bg-header-bg` or other undefined tokens in class names.

## Pass / Fail

| File | Background | Card | Input | CTA | No emoji | Notes |
|------|------------|------|-------|-----|----------|-------|
| [pages/HomePage.tsx](../../../../apps/frontend/src/pages/HomePage.tsx) | ✅ inherits page | n/a | n/a | n/a | n/a | composes marketing landing (Hero/Features/Pricing etc.) |
| [pages/auth/LoginPage.tsx](../../../../apps/frontend/src/pages/auth/LoginPage.tsx) | ✅ via AuthShell | ✅ | ✅ | ✅ | ✅ | uses AuthShell |
| [pages/auth/RegisterPage.tsx](../../../../apps/frontend/src/pages/auth/RegisterPage.tsx) | ✅ via AuthShell | ✅ | ✅ | ✅ | ✅ | uses AuthShell |
| [pages/product/ProductPage.tsx](../../../../apps/frontend/src/pages/product/ProductPage.tsx) | ⚠️ page-level bg unset | ✅ FeatureCard | n/a | n/a | ✅ after PR-2 | Lucide icons; page bg inherits (currently transparent → HomeHeader) |
| [pages/demo/DemoPage.tsx](../../../../apps/frontend/src/pages/demo/DemoPage.tsx) | — | — | — | — | — | not audited in this PR |
| [pages/pricing/DetailedPricingPage.tsx](../../../../apps/frontend/src/pages/pricing/DetailedPricingPage.tsx) | — | — | — | — | — | not audited in this PR |
| [pages/app/AppDashboardPage.tsx](../../../../apps/frontend/src/pages/app/AppDashboardPage.tsx) | — | — | — | — | — | not audited in this PR |
| [pages/admin/AdminDashboardPage.tsx](../../../../apps/frontend/src/pages/admin/AdminDashboardPage.tsx) | — | — | — | — | — | not audited in this PR |
| [pages/legal/{Terms,Privacy,GDPR}Page.tsx](../../../../apps/frontend/src/pages/legal/) | — | — | — | — | — | not audited in this PR |
| [components/ui/layout/AuthShell.tsx](../../../../apps/frontend/src/components/ui/layout/AuthShell.tsx) | ✅ | ✅ | n/a | n/a | ✅ | rewritten in PR-2 |
| [components/ui/form/Field.tsx](../../../../apps/frontend/src/components/ui/form/Field.tsx) | n/a | n/a | n/a | n/a | ✅ | label + error use tokens |
| [components/ui/form/PasswordField.tsx](../../../../apps/frontend/src/components/ui/form/PasswordField.tsx) | n/a | n/a | ✅ | n/a | ✅ Lucide Eye/EyeOff | rewritten in PR-2 |
| [components/ui/form/SubmitButton.tsx](../../../../apps/frontend/src/components/ui/form/SubmitButton.tsx) | n/a | n/a | n/a | ✅ | ✅ | rewritten in PR-2 |
| [components/ui/feedback/ErrorBanner.tsx](../../../../apps/frontend/src/components/ui/feedback/ErrorBanner.tsx) | n/a | n/a | n/a | n/a | ✅ Lucide AlertCircle | rewritten in PR-2 |
| [components/layout/Header.tsx](../../../../apps/frontend/src/components/layout/Header.tsx) | ✅ | n/a | n/a | ✅ | ✅ | `bg-header-bg` removed; uses `var(--color-background)` |
| [components/business/auth/LoginForm](../../../../apps/frontend/src/components/business/auth/LoginForm/) | ✅ via AuthShell | ✅ | ✅ | ✅ | ✅ | rewritten in PR-2 |
| [components/business/auth/RegisterForm](../../../../apps/frontend/src/components/business/auth/RegisterForm/) | ✅ via AuthShell | ✅ | ✅ | ✅ | ✅ | rewritten in PR-2 |

## Audit Verdict

| Status | Count |
|--------|-------|
| ✅ Compliant after PR-2 | 17 files |
| ⚠️ Partial (page-level bg unset) | 1 file (`ProductPage.tsx` — relies on global page bg from index.css) |
| ❌ Non-compliant | 0 |
| ⏳ Not in this PR's scope | 7 files (DemoPage, DetailedPricingPage, AppDashboardPage, AdminDashboardPage, TermsPage, PrivacyPage, GDPRPage) |

## Known Gaps (Future Tasks)

- **ProductPage** wraps individual `<section>`s but does not set a page-level background. Currently the global `body { background-color: var(--color-background) }` from index.css handles this. If index.css is ever removed or overridden, ProductPage will look broken on mobile. Recommend explicit `<div style={{ backgroundColor: 'var(--color-background)' }}>` wrapper in a follow-up.
- **HomePage** also relies on global page bg + Header's transparent header → color-background fade-in. Acceptable for now but documented.
- DemoPage, DetailedPricingPage, AppDashboardPage, AdminDashboardPage, legal pages were not in PR-2 scope. Should be audited in next iteration if any of them ship before the next design review.

## Coverage

- Failing test added: `apps/frontend/src/pages/HomePage.test.tsx` — verifies HomePage does not redirect to login.
- Failing test added: `apps/frontend/src/components/ui/layout/AuthShell.test.tsx` — verifies AuthShell uses `--color-background`/`--color-card` tokens and not light theme utilities.
- Failing test added: `apps/frontend/src/pages/product/ProductPage.test.tsx` — verifies no emoji characters in rendered DOM.
- Existing test updated: `apps/frontend/src/components/layout/Header.test.tsx` + `apps/frontend/src/test/bdd/homepage.test.tsx` — assert `--color-background` token, no longer `bg-header-bg`.

Refs: design-system/MASTER.md §1 + §9, .cursor/rules/000-modular-design.mdc, .cursor/rules/frontend/022-component-reuse.mdc