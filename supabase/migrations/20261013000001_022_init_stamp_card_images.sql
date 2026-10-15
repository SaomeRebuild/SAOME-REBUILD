-- Migration: 022_init_stamp_card_images
-- Desc: Create `template_stamp_card_images` table to track R2 stamp card images per template per fillCount.
-- Applied via: saome_supabase MCP apply_migration
--
-- Phase 3 of the Frontend Stamp Card Image Composition plan (2026-10-13).
-- Why a dedicated table (instead of reusing templates.settings):
--   - One row per (template, fillCount) — exactly 16 rows for the normal cap,
--     indexed by `partial unique (template_id, fill_count) WHERE status='uploaded'`.
--   - The status machine (pending → uploaded → optional failed) needs to be
--     tracked separately from `templates.settings`. When R2 PUT succeeds but
--     the service crashes before flipping the row, the next status-poll
--     cycle (not yet implemented) can pick up `pending` rows and retry.
--   - The byte_hash + r2_key columns give us an audit trail independent of
--     the actual R2 object. Passcreator push (next PR) reads `r2_key`
--     directly to wire the `images.{n}.png` payload.
--
-- Why not nested under `templates.settings` (jsonb `||` merge):
--   - `templates.settings` is `jsonb` and lives under the existing
--     string-merge trigger (see migration 013). Adding `n: { r2Key, byteHash }`
--     to settings would conflict with the trigger contract.
--   - One row per fillCount gives us a CHECK constraint at the DB layer,
--     a partial unique index for "one uploaded row per slot", and column-level
--     types (uuid, byte_hash char(64) for SHA-256 hex) — all of which are
--     awkward in jsonb.
--
-- Column-level rationale:
--   - template_id uuid FK: enforced at DB layer (no orphan rows).
--   - fill_count smallint CHECK (0..15): STAMP_FILL_CAP == 15 is the cost
--     cap (see packages/shared/constants/stampCard.ts). We use smallint
--     rather than int for compactness — the cap is 15 so 16+ won't ever fit.
--   - r2_key text: the canonical R2 path
--     `tenants/{tenant_id}/templates/{template_id}/stamp-{fill_count}.png`.
--     We store the WHOLE key (including the leading tenants/<id>/) so a
--     future tenant-less archive job can scan the table directly.
--   - byte_hash char(64): lower-case hex SHA-256 of the PNG byte stream.
--     `char(64)` enforces the exact length at the DB layer (would catch
--     a truncated hash write immediately).
--   - status text CHECK ('pending'|'uploaded'|'failed'): tracks the
--     atomic-ish write flow (DB INSERT pending → R2 PUT → UPDATE uploaded).
--   - uploaded_at timestamptz: server clock (DB default `now()`). NULL
--     while the row is `pending` or `failed`.
--
-- Partial unique index:
--   - `UNIQUE (template_id, fill_count) WHERE status='uploaded'`.
--   - Why partial: a row can transition pending → uploaded → failed.
--     If we made the index unconditional, an upload retry after a failed
--     attempt would need to first DELETE the failed row, complicating
--     the flow. The partial scope (only uploaded rows) means:
--       - One uploaded row per (template, fill_count) slot — enforced.
--       - Multiple pending rows can exist transiently during R2 writes.
--       - Multiple failed rows are allowed (kept for audit).
--   - Mirrors the pattern in migration 020 (`r2_pending_deletes`).
--
-- Cross-references:
--   - Frontend Phase 1: packages/shared/constants/stampCard.ts (STAMP_FILL_CAP)
--   - Frontend Phase 2: apps/frontend/src/components/business/stampCard/StampCardImageComposer/
--   - Service: apps/backend/src/modules/stamp-images/services/uploadStampImage.ts (Phase 3.2)

CREATE TABLE IF NOT EXISTS public.template_stamp_card_images (
  id            BIGSERIAL PRIMARY KEY,
  template_id   UUID NOT NULL
                REFERENCES public.templates(id) ON DELETE CASCADE,
  fill_count    SMALLINT NOT NULL
                CHECK (fill_count BETWEEN 0 AND 15),
  r2_key        TEXT NOT NULL,
  byte_hash     CHAR(64) NOT NULL
                CHECK (byte_hash ~ '^[0-9a-f]{64}$'),
  byte_length   INTEGER NOT NULL
                CHECK (byte_length > 0),
  status        TEXT NOT NULL
                CHECK (status IN ('pending', 'uploaded', 'failed')),
  uploaded_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index: at most one UPLOADED row per (template, fill_count).
-- Multiple pending / failed rows coexist until the next status poll clears
-- them. See header comment for the partial-index rationale.
CREATE UNIQUE INDEX IF NOT EXISTS template_stamp_card_images_uploaded_uidx
  ON public.template_stamp_card_images(template_id, fill_count)
  WHERE status = 'uploaded';

-- Lookup index: tenant dashboard queries "show me all uploaded images for
-- this template" hit this index directly without a seq scan.
CREATE INDEX IF NOT EXISTS template_stamp_card_images_template_id_idx
  ON public.template_stamp_card_images(template_id);

-- Updated_at trigger so the table has its own audit timestamp lifecycle.
-- Reuses the pattern from migration 020 (r2_pending_deletes).
CREATE OR REPLACE FUNCTION public.template_stamp_card_images_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS template_stamp_card_images_set_updated_at ON public.template_stamp_card_images;
CREATE TRIGGER template_stamp_card_images_set_updated_at
  BEFORE UPDATE ON public.template_stamp_card_images
  FOR EACH ROW
  EXECUTE FUNCTION public.template_stamp_card_images_set_updated_at();

-- Documentation: pin the partial-index rationale at the DB layer.
COMMENT ON TABLE public.template_stamp_card_images IS
  'One row per (template, fill_count) slot for pre-rendered stamp card PNG images stored in R2. fill_count is the user-visible "how many cells are stamped" value, in [0, STAMP_FILL_CAP=15]. status follows the atomic-ish write flow: INSERT pending (DB-only) → R2 PUT → UPDATE uploaded. Partial unique index ensures at most one uploaded row per slot; multiple pending rows can coexist transiently. ON DELETE CASCADE ties row lifetime to the parent template. See runs/improvements/feedback/20261013-stamp-card-image-composition-frontend.md.';

COMMENT ON COLUMN public.template_stamp_card_images.fill_count IS
  'Number of cells rendered as stamped. Must be in [0, 15] (matches STAMP_FILL_CAP in packages/shared/constants/stampCard.ts). 0 = empty template (CardBuilder pre-render target). 15 = fully stamped (cap).';

COMMENT ON COLUMN public.template_stamp_card_images.r2_key IS
  'Full R2 object key: `tenants/{tenant_id}/templates/{template_id}/stamp-{fill_count}.png`. Stored with the leading tenants/<id>/ prefix so future tenant-less archive jobs can scan the table directly.';

COMMENT ON COLUMN public.template_stamp_card_images.byte_hash IS
  'Lower-case hex SHA-256 of the PNG byte stream (64 chars). Matches the lowercase convention in shared/schemas/stampCard.ts::stampCardImageOutputSchema.blobHash.';

COMMENT ON COLUMN public.template_stamp_card_images.status IS
  'Atomic write state machine: pending (DB INSERT only) → uploaded (R2 PUT succeeded, row committed) or failed (R2 PUT failed, row kept for audit). Partial unique index scopes uniqueness to status=uploaded so retries can co-exist transiently.';

COMMENT ON COLUMN public.template_stamp_card_images.uploaded_at IS
  'Server clock when the row transitioned to status=uploaded. NULL while pending or failed.';
