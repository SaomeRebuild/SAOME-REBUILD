# shared/ — TODO

> Reserved for cross-package shared code (business logic, types, i18n).
> Currently a placeholder for the planned monorepo layout.

## Status

**Empty placeholder.** No source code lives here yet.

The `dist/`, `node_modules/`, and `.turbo/` artifacts are leftovers from a
prior monorepo experiment and are git-ignored.

## When to populate

Only populate when **backend/** (Hono) is added and both frontend and backend
need to share TypeScript types, business constants, or i18n strings.

## What goes here (future)

- TypeScript interfaces shared between frontend + backend (Company, Member, Pass)
- zod schemas for shared API contracts
- Pure business-logic functions (e.g. `computeVipStatus`, points calculation)
- i18n translation strings consumed by both web and any future mobile clients
- Shared constants (roles, states, error codes)

## What does NOT go here

- React components
- Vite-specific or browser-specific code
- Hono middleware or Cloudflare-specific code