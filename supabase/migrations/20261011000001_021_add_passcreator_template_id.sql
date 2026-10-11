-- Migration: 021_add_passcreator_template_id
-- Desc: Add `passcreator_template_id` column to track the upstream Passcreator template UUID.
-- Applied via: saome_supabase MCP apply_migration
--
-- Phase 1 of the Step 8 "Save & Publish" → Passcreator push integration (plan v4).
-- Why a dedicated column:
--   - The card template lifecycle is decoupled from Passcreator. The card template
--     may exist locally (status='draft') for an arbitrary period before the user
--     clicks "Save & Publish".
--   - On first publish, the backend `updateTemplateService` calls Passcreator's
--     `createPassTemplate` and stores the returned `id` in this column.
--   - On subsequent updates (status changes, setting changes), the backend calls
--     `updatePassTemplate(id, ...)` using this column as the lookup key.
--   - The column is nullable because: (a) the column is new, so existing rows
--     have no Passcreator counterpart (no backfill per user decision), and (b)
--     the user may decide to never publish a card.
--   - Unique index ensures one-to-one mapping per row: a card template maps
--     to AT MOST ONE Passcreator template. Partial index (`WHERE NOT NULL`)
--     keeps the index small (only indexed rows that actually have a Passcreator
--     counterpart).
--
-- Why no backfill (user decision 2026-10-11):
--   - The existing 34+ templates were authored before the Passcreator pipeline
--     existed. Forcing a backfill would either:
--     a) Create stale Passcreator templates from incomplete card designs
--        (publishing drafts that the user never intended to ship), or
--     b) Block publishing entirely until the user re-confirms each template.
--   - Per user instruction: "舊模板不動" (leave existing templates alone). The
--     user can manually re-publish a card if they want to onboard it to
--     Passcreator. Until they do, the column stays NULL and the template is
--     treated as a local-only design.
--   - Future re-consideration: if Passcreator sync is needed for existing
--     templates, write a separate one-off backfill migration (Rule 035 § 5:
--     "修補已 apply 的 migration → 新建檔案, 不可改舊檔").

ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS passcreator_template_id UUID;

-- Partial unique index: at most one row per Passcreator template id, but
-- NULL values (rows that have never been pushed) are not indexed (so
-- multiple NULLs coexist, matching the "never published yet" semantics).
CREATE UNIQUE INDEX IF NOT EXISTS templates_passcreator_template_id_idx
  ON public.templates(passcreator_template_id)
  WHERE passcreator_template_id IS NOT NULL;

-- Documentation: why a comment matters here.
-- A future developer reading this schema will likely wonder why a partial
-- index rather than a plain `UNIQUE` column. The comment below pins the
-- design rationale in the DB itself (the only place that survives schema
-- migrations, code rewrites, and PR history compression).
COMMENT ON COLUMN public.templates.passcreator_template_id IS
  'UUID of the corresponding template in the upstream Passcreator system. NULL = card has not been pushed to Passcreator (draft or local-only). Set on first publish; updated on subsequent setting changes. Partial unique index ensures one-to-one mapping (no two SAOME rows can reference the same Passcreator template). See runs/decisions/2026-10-11-step8-passcreator-push.md and .cursor/rules/035-migration-apply-pipeline.mdc.';
