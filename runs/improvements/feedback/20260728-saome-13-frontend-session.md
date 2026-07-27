# 2026-07-28 — Spec 002-tenant-auth session feedback

## Session summary

Implemented end-to-end tenant auth (register + login + role-based redirect + lockout + i18n) across:

- `apps/backend/` (new) — Hono on Cloudflare Workers with Hyperdrive/Supabase Postgres
- `apps/frontend/` (existing) — added L1/L2 components, hooks, services, routes
- `packages/shared/` (existing) — added auth schemas, logic, types, i18n, constants

## Pits hit (lessons learned)

### 1. `Write` tool auto-converts email literals

When writing test files with string literals like `'[email protected]'`,
the `Write` tool silently rewrote the content into Markdown link syntax
`[email protected]`, producing non-printable characters that Zod rejected
in subsequent test runs. Debug script `fix-emails.js` was written to
scan files and replace literals with concatenated strings like
`'user' + '@example.com'`.

**Rule**: NEVER put raw `*@*` literals in source files; always build them
via string concatenation or template literals that contain no `@`.

### 2. Vitest alias requires array form (Vite 8)

Vite's object-form alias `find: '@saome/shared'` swallows more-specific
paths like `@saome/shared/schemas/auth`. The fix is array form with
exact-match ordering (most specific first):

```ts
{ find: '@saome/shared/schemas/auth', replacement: '...auth.ts' },
{ find: '@saome/shared/schemas', replacement: '.../schemas/index.ts' },
{ find: '@saome/shared', replacement: '.../index.ts' },
```

This is now a project rule in `.cursor/rules/016-config-and-tsconfig-discipline.mdc`.
Always verify aliases by running BOTH `tsc -b --noEmit` AND `vite build`
— the latter is the runtime mirror.

### 3. `vitest-pool-workers` swallows `console.log`

When debugging Hono routes in `@cloudflare/vitest-pool-workers`,
`console.log` output is unreliable. Use throw-based debugging:
`throw new Error(JSON.stringify(value))` so the test failure message
carries the debug payload.

### 4. Hono test app must include `app.onError(errorHandler)`

Without registering `errorHandler`, custom errors like `RateLimitError`
default to 500 Internal Server Error. The unit tests for
`rateLimitMiddleware` initially failed with 500 until the test's Hono
instance was given `app.onError(errorHandler)`.

### 5. SQL transaction in mocked `getDb`

`registerService` uses `sql.begin(async (tx) => ...)` for atomicity.
When mocking `getDb`, the mock must also implement `begin`:

```ts
vi.mock('@/shared/db/client', () => ({
  getDb: vi.fn().mockReturnValue({
    begin: vi.fn().mockImplementation(async (cb) => cb({})),
  }),
}));
```

### 6. Zod input/output type divergence breaks `zodResolver`

`tenantInfoSchema` has `invoiceAddress: z.string().optional().default('')`
which makes the input type `invoiceAddress?: string` and output
`invoiceAddress: string`. `zodResolver` infers a `Resolver<TInput, ...>`
but `useForm` expects the output type. Workaround: cast
`zodResolver(schema) as never`. Better long-term fix: align input/output
types or split into `tenantInfoInputSchema` + `tenantInfoSchema`.

### 7. Frontend `noUnusedLocals` + `noUnusedParameters`

`tsc -b --noEmit` fails on any unused import or unused destructure.
Add ESLint rule `no-unused-vars: error` (oxlint catches most cases).
When `Children` import was unused, it was flagged — strip it.

### 8. PowerShell heredoc parsing

`git commit -m "$(cat <<'EOF' ... EOF)"` fails in PowerShell because
the angle brackets in YAML-style fences collide with shell parsing.
Use a temp file: `git commit -F .commit-msg.txt`, then delete it.

## What went well

- TDD discipline kept the backend service layer testable with vi.mock
- The 5-feature BDD bundle was easy to wire to Playwright smoke test
- Shared package's zod schemas are reused by both backend and frontend
  (zero copy-paste between apps)
- Modular design (L1/L2 folder layout) made the frontend component
  skeleton composable from existing design tokens

## Future work

- Phase B: ui-ux-pro-max to finalize design tokens
- Phase C: Cloudflare deploy of apps/backend (requires real Hyperdrive ID)
- Phase D: Wire Cloudflare Pages custom domain routing
  (`app.saome.org` → /app, `admin.saome.org` → /admin) via Worker route rules

## Decisions to record

- Decided to keep "Write tool should not auto-link emails" as a
  workspace-wide rule. Proposed: add to `.cursor/rules/006-verification.mdc`
- Decided vitest.config alias MUST mirror vite.config alias (016 rule).
- Decided to use array form alias (NOT object form) for both vite.config
  and vitest.config.

## Skill improvements to make

- `saome-self-improvement`: Add a step "scan all recently-written files
  for the `*@*` literal pattern and ensure none exist raw in source code".