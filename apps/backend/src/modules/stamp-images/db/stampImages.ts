/**
 * `template_stamp_card_images` table queries (Phase 3, 2026-10-13).
 *
 * @module modules/stamp-images/db/stampImages
 * @description Pure SQL functions for the `template_stamp_card_images`
 * table that records per-(template, fillCount) stamp card PNG uploads
 * to R2. Mirrors the pattern of `cards/db/templates.ts` (PG schema is
 * the source of truth; this file is a typed accessor).
 *
 * Why a dedicated module (vs. adding to cards/db/templates.ts):
 *   - The schema lives on its own table (migration 022). The SQL functions
 *     target that table — same architectural line as `cards/db/r2PendingDeletes.ts`
 *     and `cards/db/r2Sweep.ts` (separate concerns = separate files).
 *   - Future Scanner integration (plan § 5.4) will use these same
 *     queries, and that work doesn't touch the templates CRUD path.
 *
 * Cross-references:
 *   - supabase/migrations/20261013000001_022_init_stamp_card_images.sql
 *     (table DDL + partial unique index + updated_at trigger)
 *   - packages/shared/schemas/stampCard.ts (uploadStampCardImageResponseSchema)
 *   - apps/backend/src/modules/stamp-images/services/uploadStampImage.ts
 */

import type { Sql } from '@/shared/db/client';

/**
 * A row in `template_stamp_card_images`, projected to the columns the
 * application layer needs. Mirrors the table DDL but expressed in
 * TypeScript-friendly names (snake_case → camelCase).
 *
 * `status` includes the three states from the SQL CHECK constraint:
 * 'pending' (row inserted, R2 PUT not yet attempted), 'uploaded' (R2
 * PUT succeeded, partial-unique-index row), or 'failed' (R2 PUT errored,
 * row kept for audit + retry).
 */
export interface TemplateStampImageRow {
  id: string;
  templateId: string;
  fillCount: number;
  r2Key: string;
  /** Lowercase hex SHA-256 (64 chars). */
  byteHash: string;
  byteLength: number;
  status: 'pending' | 'uploaded' | 'failed';
  uploadedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Insert a `pending` row before R2 PUT.
 *
 * Why insert pending first (rather than writing R2 first then DB):
 *   - The atomic-ish write flow is "DB row → R2 PUT → DB UPDATE". If
 *     R2 PUT fails, the row already exists in `failed` status; the
 *     service can DELETE it without losing the audit trail.
 *   - Conversely, writing R2 first then DB means a Worker crash
 *     between the two leaves an orphan R2 object with no DB record
 *     (the row that should reference it never persisted). The DB-first
 *     ordering eliminates this orphan class.
 *
 * The `ON CONFLICT (template_id, fill_count) WHERE status='uploaded'
 * DO NOTHING` clause (via the partial unique index) is NOT applied
 * here because inserting a new `pending` row alongside an existing
 * `uploaded` row is allowed (multiple pending rows can coexist
 * transiently during retries; only one `uploaded` row is enforced
 * per slot).
 */
export async function insertPendingStampImage(
  sql: Sql,
  args: {
    templateId: string;
    fillCount: number;
    r2Key: string;
    byteHash: string;
    byteLength: number;
  },
): Promise<TemplateStampImageRow> {
  const rows = await sql<TemplateStampImageRow[]>`
    INSERT INTO template_stamp_card_images
      (template_id, fill_count, r2_key, byte_hash, byte_length, status, uploaded_at)
    VALUES
      (${args.templateId}, ${args.fillCount}, ${args.r2Key}, ${args.byteHash}, ${args.byteLength}, 'pending', NULL)
    RETURNING
      id,
      template_id   AS "templateId",
      fill_count    AS "fillCount",
      r2_key        AS "r2Key",
      byte_hash     AS "byteHash",
      byte_length   AS "byteLength",
      status        AS "status",
      uploaded_at   AS "uploadedAt",
      created_at    AS "createdAt",
      updated_at    AS "updatedAt"
  `;
  if (!rows[0]) {
    throw new Error('insertPendingStampImage: no row returned (unexpected)');
  }
  return rows[0];
}

/**
 * Flip a row to `uploaded` after a successful R2 PUT.
 *
 * The trigger on the table auto-sets `updated_at = now()`, so this
 * SQL only needs to flip status + uploaded_at. The WHERE clause on
 * `status='pending'` is defensive: a concurrent writer that already
 * flipped the row won't be silently overwritten.
 */
export async function markStampImageUploaded(
  sql: Sql,
  rowId: string,
): Promise<TemplateStampImageRow | null> {
  const rows = await sql<TemplateStampImageRow[]>`
    UPDATE template_stamp_card_images
       SET status        = 'uploaded',
           uploaded_at   = now()
     WHERE id            = ${rowId}
       AND status        = 'pending'
     RETURNING
      id,
      template_id   AS "templateId",
      fill_count    AS "fillCount",
      r2_key        AS "r2Key",
      byte_hash     AS "byteHash",
      byte_length   AS "byteLength",
      status        AS "status",
      uploaded_at   AS "uploadedAt",
      created_at    AS "createdAt",
      updated_at    AS "updatedAt"
  `;
  return rows[0] ?? null;
}

/**
 * Mark a row as `failed` after an R2 PUT error.
 *
 * Returns the updated row (so the service layer can include it in a
 * structured error response if it wants). A `failed` row coexists with
 * other pending rows (no UNIQUE constraint on status=failed), so
 * retries don't lose history.
 */
export async function markStampImageFailed(
  sql: Sql,
  rowId: string,
): Promise<TemplateStampImageRow | null> {
  const rows = await sql<TemplateStampImageRow[]>`
    UPDATE template_stamp_card_images
       SET status = 'failed'
     WHERE id     = ${rowId}
     RETURNING
      id,
      template_id   AS "templateId",
      fill_count    AS "fillCount",
      r2_key        AS "r2Key",
      byte_hash     AS "byteHash",
      byte_length   AS "byteLength",
      status        AS "status",
      uploaded_at   AS "uploadedAt",
      created_at    AS "createdAt",
      updated_at    AS "updatedAt"
  `;
  return rows[0] ?? null;
}

/**
 * Delete a `pending` row (used after R2 PUT error when we don't want
 * to keep an audit trail — e.g. malformed PNG magic header means the
 * byte data was never accepted; the row is meaningless).
 *
 * The row was inserted with `byte_hash` / `byte_length` from the
 * (invalid) request, so it carries no useful audit. Drop it.
 */
export async function deletePendingStampImage(
  sql: Sql,
  rowId: string,
): Promise<void> {
  await sql`
    DELETE FROM template_stamp_card_images
     WHERE id = ${rowId}
       AND status = 'pending'
  `;
}

/**
 * Delete any `uploaded` row(s) for a (template, fillCount) slot.
 *
 * 2026-10-14 — Re-publish / partial-unique-index regression.
 *
 * The migration declares a partial unique index:
 *   UNIQUE (template_id, fill_count) WHERE status = 'uploaded'
 *
 * The flow in `uploadStampImage` is
 *   INSERT pending → R2 PUT → UPDATE pending→uploaded
 *
 * The first publish run leaves one `uploaded` row behind. On a
 * re-publish, the UPDATE to set status='uploaded' trips the partial
 * unique index (the (template_id, fill_count, status='uploaded')
 * tuple is now duplicated). The service MUST `DELETE` the existing
 * `uploaded` row BEFORE `INSERT pending` to maintain the migration's
 * "one uploaded row per slot" invariant.
 *
 * Why this is the right place:
 *   - `failed` rows are NOT touched (kept for audit per migration
 *     comment: "Multiple failed rows are allowed (kept for audit)").
 *   - `pending` rows are NOT touched (multiple pending rows can
 *     coexist transiently during retries).
 *   - Only `uploaded` rows are deleted, and only the rows for the
 *     specific (template_id, fill_count) slot.
 *
 * Returns the number of rows deleted (0 or 1 in normal operation;
 * 1+ only if a previous bug left multiple `uploaded` rows in place).
 * The service logs the count for observability.
 */
export async function deleteUploadedStampImage(
  sql: Sql,
  args: {
    templateId: string;
    fillCount: number;
  },
): Promise<number> {
  const rows = await sql<{ count: number }[]>`
    WITH deleted AS (
      DELETE FROM template_stamp_card_images
       WHERE template_id = ${args.templateId}
         AND fill_count  = ${args.fillCount}
         AND status      = 'uploaded'
      RETURNING 1
    )
    SELECT count(*)::int AS count FROM deleted
  `;
  return rows[0]?.count ?? 0;
}

/**
 * Find an `uploaded` row for a given (templateId, fillCount) slot.
 *
 * Used by future read-paths (Passcreator push payload assembly) and
 * conformance tests. Returns null when no uploaded row exists.
 */
export async function findUploadedStampImage(
  sql: Sql,
  templateId: string,
  fillCount: number,
): Promise<TemplateStampImageRow | null> {
  const rows = await sql<TemplateStampImageRow[]>`
    SELECT
      id,
      template_id   AS "templateId",
      fill_count    AS "fillCount",
      r2_key        AS "r2Key",
      byte_hash     AS "byteHash",
      byte_length   AS "byteLength",
      status        AS "status",
      uploaded_at   AS "uploadedAt",
      created_at    AS "createdAt",
      updated_at    AS "updatedAt"
      FROM template_stamp_card_images
     WHERE template_id = ${templateId}
       AND fill_count = ${fillCount}
       AND status = 'uploaded'
     ORDER BY uploaded_at DESC NULLS LAST
     LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Audit projection for the public stamp-image proxy route. Returns
 * the joined `(tenant_id, r2_key)` pair in a single SQL roundtrip so
 * the route can perform the canonical-key check without a second
 * SELECT against `templates`.
 *
 * Why a JOIN (vs. the existing `findUploadedStampImage` followed by a
 * SELECT templates):
 *   - One query instead of two — halves the roundtrip count for a
 *     high-traffic, server-to-server endpoint.
 *   - The route's tenant-audit logic is atomic in the sense that a
 *     concurrent UPDATE that swaps the template's tenant_id (very
 *     unlikely; tenant_id is mostly stable post-creation) is captured
 *     in the same transaction snapshot.
 *
 * Mirrors the shape of `pass-templates/db/imageKeys.ts::TemplateImageAuditRow`
 * for symmetric test patterns.
 */
export interface StampImageAuditRow {
  tenantId: string | null;
  r2Key: string | null;
}

export async function findStampImageAudit(
  sql: Sql,
  templateId: string,
  fillCount: number,
): Promise<StampImageAuditRow | null> {
  const rows = await sql<StampImageAuditRow[]>`
    SELECT t.tenant_id AS "tenantId",
           s.r2_key    AS "r2Key"
      FROM templates t
      LEFT JOIN template_stamp_card_images s
        ON s.template_id = t.id
       AND s.fill_count  = ${fillCount}
       AND s.status      = 'uploaded'
     WHERE t.id = ${templateId}
     LIMIT 1
  `;
  return rows[0] ?? null;
}
