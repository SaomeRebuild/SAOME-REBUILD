# design-system/ — TODO

> Design tokens + system documentation. Single source of truth for UI.

## Status

**Source of truth: `MASTER.md`.** This file is the canonical reference for
color, typography, spacing, motion, and iconography across the SAOME product.

## When to populate

`MASTER.md` is already complete (color palette, typography, spacing scale,
border radius, shadows, motion timing, icon rules, anti-patterns, spacing
application rules).

Add new files here only when a new design concern emerges (e.g. dark mode
contrast tables, illustration style guide, accessibility audit results).

## What goes here

- `MASTER.md` — main reference (already exists)
- Future: `dark-mode.md`, `accessibility.md`, `illustration.md`, etc.

## What does NOT go here

- React component implementations (those go in `frontend/src/components/`)
- Tailwind class definitions (those go in `frontend/src/index.css`)
- Storybook stories (those go alongside components in `frontend/`)