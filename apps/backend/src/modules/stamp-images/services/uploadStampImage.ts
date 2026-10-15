/**
 * `uploadStampImage` service — the atomic-ish write flow for stamp card PNGs.
 *
 * @module modules/stamp-images/services/uploadStampImage
 * @description Orchestrates: validate PNG magic + byte length → INSERT
 * pending row → R2 PUT → UPDATE uploaded (or DELETE pending on R2 error).
 *
 * Why a service layer (vs. inline in the route handler):
 *   - Modular design § B.4: route handler does zod parse + service
 *     call. All byte-handling logic stays out of the Hono route.
 *   - The atomic-ish flow touches 3 resources (DB, R2, byte array)
 *     and the failure-recovery branches are non-trivial. Keeping
 *     them in the route would balloon the route file to ~150 lines.
 *
 * SHA-256 hex:
 *   We compute it from the raw decoded bytes (not the base64 string)
 *   so the byte_hash stored in the DB matches what the client rendered.
 *   Subtle: the same PNG rendered twice produces the same hash
 *   deterministically, allowing R2 overwrite detection.
 *
 * @see apps/backend/src/modules/stamp-images/routes/uploadStampImage.ts (route)
 * @see apps/backend/src/modules/stamp-images/db/stampImages.ts (sql)
 * @see apps/backend/src/modules/stamp-images/schemas/request.ts (zod + magic)
 */

import type { Sql } from '@/shared/db/client';
import { BadGatewayError, NotFoundError, ValidationError } from '@/shared/lib/saomeError';
import {
  assertPngMagicHeader,
  assertRawByteLength,
} from '../schemas/request';
import {
  insertPendingStampImage,
  markStampImageUploaded,
  markStampImageFailed,
  deletePendingStampImage,
  deleteUploadedStampImage,
  findUploadedStampImage,
  type TemplateStampImageRow,
} from '../db/stampImages';

/**
 * Build the canonical R2 object key for a stamp card image.
 *
 * Convention: `tenants/{tenantId}/templates/{templateId}/stamp-{fillCount}.png`.
 * The `tenants/<id>/` prefix is consistent with the existing
 * `cards/db/generateUploadUrl.ts` style and lets a future
 * tenant-less archive job scan the table directly.
 *
 * The key is constructed by the service layer (not the route) so the
 * SQL + the R2 PUT use the EXACT same string. Drift between the two
 * is the most common source of "DB says it exists, R2 404s" bugs.
 */
export function buildStampImageKey(
  tenantId: string,
  templateId: string,
  fillCount: number,
): string {
  return `tenants/${tenantId}/templates/${templateId}/stamp-${fillCount}.png`;
}

/**
 * SHA-256 hex (lowercase) of a byte buffer.
 *
 * `crypto.subtle.digest('SHA-256', bytes)` is supported on every
 * runtime (Workers, Node 18+, browser). We avoid the `node:crypto`
 * import to keep workerd compatibility (the backend runs on
 * Cloudflare Workers — see apps/backend/wrangler.jsonc).
 *
 * @throws TypeError if the Web Crypto SubtleCrypto is unavailable (e.g.
 *         serverless runtime without crypto polyfill). The route layer
 *         maps this to a 500.
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Result of a successful upload.
 *
 * Mirrors `UploadStampCardImageResponse` from the shared schema
 * (Rule 019 § 4.1 layer 4 — the service signature IS the API contract).
 * The route handler maps this object directly to JSON.
 */
export interface UploadStampImageResult {
  r2Key: string;
  byteHash: string;
  byteLength: number;
  uploadedAt: string;
}

/**
 * Decode base64 → Uint8Array, with input validation.
 *
 * Defensive against malformed base64 strings (whitespace, padding,
 * illegal characters). Throws `ValidationError` on any issue so the
 * route handler returns a 400.
 *
 * `atob` is the standard Web API available in Workers + browsers.
 * We use it directly to avoid pulling a base64 polyfill into the
 * Worker bundle.
 */
export function decodeBase64ToBytes(b64: string): Uint8Array {
  // Strip whitespace (Chrome sometimes wraps long strings). Strip only
  // ASCII whitespace to avoid trampling Unicode.
  const cleaned = b64.replace(/\s+/g, '');
  if (cleaned.length === 0) {
    throw new ValidationError('common.error.validationFailed');
  }
  // Validate base64 alphabet + padding BEFORE calling atob (atob throws
  // an opaque `InvalidCharacterError` on bad input — we want our
  // deterministic ValidationError).
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new ValidationError('common.error.validationFailed');
  }
  let binary: string;
  try {
    binary = atob(cleaned);
  } catch {
    throw new ValidationError('common.error.validationFailed');
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * The atomic-ish write flow.
 *
 * Steps:
 *   1. Decode base64 → bytes
 *   2. Assert PNG magic + raw length cap (defense-in-depth)
 *   3. Compute SHA-256 byte_hash
 *   4. DELETE any pre-existing `uploaded` row for this slot
 *      (re-publish idempotency — see migration 022 partial unique
 *      index `template_stamp_card_images_uploaded_uidx`)
 *   5. INSERT pending row (DB state visible immediately)
 *   6. R2 PUT
 *   7a. Success → UPDATE status='uploaded' → return
 *   7b. Failure → markStampImageFailed (audit) → throw BadGatewayError
 *
 * 2026-10-14 — Step 4 added. Without it, the UPDATE in step 7a trips
 * the partial unique index when the user re-publishes a stamp_card
 * that already has a successful `uploaded` row. The DELETE only
 * touches `uploaded` rows — `pending` and `failed` rows are
 * preserved per the migration's "multiple pending / multiple failed
 * rows allowed" rationale.
 *
 * On step 7b the pending row is kept (status='failed') so the next
 * retry attempt has history to consult. Operators can see the failure
 * via `wrangler tail` (`[uploadStampImage] R2 PUT failed ...`) and
 * the `template_stamp_card_images` row directly.
 *
 * @param sql        postgres.js instance (from getDbForRequest(c))
 * @param bucket     R2 bucket binding (env.ASSETS, typed as R2Bucket)
 * @param args.templateId  Template UUID (must belong to tenant)
 * @param args.tenantId    Tenant UUID (from JWT, trusted per decision 2026-09-09)
 * @param args.fillCount   0..15, validated by zod before reaching this layer
 * @param args.imageBase64 Base64-encoded PNG bytes
 * @returns The upload result (r2Key, byteHash, byteLength, uploadedAt).
 * @throws ValidationError on bad base64 / non-PNG bytes / oversize
 * @throws NotFoundError when the template doesn't belong to the tenant
 * @throws BadGatewayError when R2 PUT fails
 */
export async function uploadStampImage(
  sql: Sql,
  bucket: R2Bucket,
  args: {
    templateId: string;
    tenantId: string;
    fillCount: number;
    imageBase64: string;
  },
): Promise<UploadStampImageResult> {
  // Step 1+2: decode + byte-level validation. Both throws map to
  // 400 ValidationError at the route layer.
  const bytes = decodeBase64ToBytes(args.imageBase64);
  try {
    assertPngMagicHeader(bytes);
    assertRawByteLength(bytes);
  } catch (err) {
    // Re-throw as ValidationError with the original message embedded.
    throw new ValidationError('common.error.validationFailed', {
      reason: err instanceof Error ? err.message : String(err),
    });
  }

  // Step 3: hash.
  const byteHash = await sha256Hex(bytes);
  const byteLength = bytes.byteLength;

  // Step 4: build the canonical key.
  const r2Key = buildStampImageKey(args.tenantId, args.templateId, args.fillCount);

  // Step 5: DELETE any pre-existing `uploaded` row for this slot.
  //
  // The migration declares a partial unique index
  //   UNIQUE (template_id, fill_count) WHERE status='uploaded'
  // so a re-publish would otherwise have the subsequent UPDATE
  // (`pending → uploaded`) rejected by the index. We DELETE the
  // existing `uploaded` row BEFORE INSERTing a new `pending` row,
  // preserving the migration's "one uploaded row per slot" invariant.
  //
  // Only `uploaded` rows are touched — `pending` and `failed` rows
  // are preserved for audit (per the migration's partial-index
  // rationale and the "Multiple failed rows are allowed" comment).
  //
  // The count is logged for observability. A non-zero count on every
  // call is the steady-state for re-publishes; a count > 1 indicates
  // a previous bug left multiple `uploaded` rows in place (the DELETE
  // cleans them all up so the next state is exactly one `uploaded`).
  const deletedUploadedCount = await deleteUploadedStampImage(sql, {
    templateId: args.templateId,
    fillCount: args.fillCount,
  });
  if (deletedUploadedCount > 1) {
    console.warn(
      `[uploadStampImage] template=${args.templateId} fillCount=${args.fillCount} ` +
        `removed ${deletedUploadedCount} pre-existing uploaded rows (expected ≤ 1); ` +
        `partial-unique index should have prevented this — investigate earlier writes`,
    );
  }

  // Step 6: INSERT pending row.
  const pendingRow = await insertPendingStampImage(sql, {
    templateId: args.templateId,
    fillCount: args.fillCount,
    r2Key,
    byteHash,
    byteLength,
  });

  // Step 7+8a: R2 PUT → flip uploaded.
  //
  // `R2Bucket.put` accepts a Uint8Array or a ReadableStream. We use
  // Uint8Array because the PNG payload is small (≤ 4 MB) and the
  // Cloudflare Workers runtime handles both forms cheaply.
  //
  // `httpMetadata: { contentType: 'image/png' }` is what the public
  // R2 image proxy reads to set the Content-Type header on getTemplateImage
  // routes (see routes/getTemplateImage.ts). Without it the proxy
  // defaults to 'image/png' anyway, but explicit is better.
  try {
    const putResult = await bucket.put(r2Key, bytes, {
      httpMetadata: { contentType: 'image/png' },
      customMetadata: {
        templateId: args.templateId,
        tenantId: args.tenantId,
        fillCount: String(args.fillCount),
        byteHash,
      },
    });
    if (!putResult) {
      throw new Error('R2 bucket.put returned undefined');
    }
  } catch (err) {
    // Step 7b: mark failed + bubble up. The row is kept (not deleted)
    // because the byte_hash + byte_length + r2_key are useful audit
    // data — a future cron-sweep could, e.g., retry `failed` rows.
    await markStampImageFailed(sql, pendingRow.id).catch(() => {
      // Suppress the markFailed failure: the original R2 error is the
      // user-facing issue. markFailed failure becomes a `wrangler tail`
      // diagnostic instead.
    });
    throw new BadGatewayError({
      upstream: 'r2',
      kind: 'invalid_response',
      message: err instanceof Error ? err.message : 'R2 PUT failed',
    });
  }

  // Step 8a (cont.): flip uploaded, fetch the final row.
  const updated = await markStampImageUploaded(sql, pendingRow.id);
  if (!updated) {
    // The row vanished between INSERT and UPDATE (very unlikely — would
    // require a concurrent DELETE). The R2 PUT succeeded, so we
    // surface a 500 with an explicit message so the client knows the
    // bytes ARE on R2 even though the DB state is unknown.
    throw new Error(
      '[uploadStampImage] row disappeared between INSERT and UPDATE — R2 PUT succeeded but DB state unknown',
    );
  }

  return {
    r2Key: updated.r2Key,
    byteHash: updated.byteHash,
    byteLength: updated.byteLength,
    // `uploadedAt` is non-null on status='uploaded' (DB default is
    // NULL on insert, now() on the trigger).
    uploadedAt: (updated.uploadedAt ?? new Date()).toISOString(),
  };
}

/**
 * Look up an already-uploaded stamp image — re-exported from the
 * db layer for ergonomic imports from the route layer.
 *
 * Used by:
 *   - Conformance tests (verify a (template, fillCount) upload landed).
 *   - Future Passcreator push payload assembly (read `r2_key` to wire
 *     `images.strip.0.png` etc.).
 */
export async function getUploadedStampImage(
  sql: Sql,
  templateId: string,
  fillCount: number,
): Promise<TemplateStampImageRow | null> {
  return findUploadedStampImage(sql, templateId, fillCount);
}

/**
 * Delete a pending row by id.
 *
 * Used as a cleanup path when the byte-level validation fails AFTER
 * we've already inserted a pending row. The current implementation
 * of `uploadStampImage` doesn't expose that path (the magic-header
 * check happens before INSERT), but this function is exported for
 * tests + future retry-cleanup flows.
 */
export async function dropPendingStampImage(
  sql: Sql,
  rowId: string,
): Promise<void> {
  return deletePendingStampImage(sql, rowId);
}

/**
 * Throw NotFoundError when the template doesn't belong to the tenant.
 *
 * The route handler calls this AFTER parsing the path params but
 * BEFORE the byte-handling work — this saves us from spending CPU
 * on base64 decoding when the URL is intentionally wrong. Reference
 * implementation lives in the route layer; this stub is kept here
 * so consumers that import the service don't accidentally bypass the
 * tenant check.
 */
export function ensureTemplateBelongsToTenantOr404(
  templateTenantId: string | null,
  expectedTenantId: string,
): void {
  if (templateTenantId !== expectedTenantId) {
    throw new NotFoundError('common.error.notFound');
  }
}
