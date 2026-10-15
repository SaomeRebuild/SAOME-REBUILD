/**
 * Passcreator template sync — orchestrate create vs update.
 *
 * @module modules/pass-templates/services/passTemplateSync
 * @description Glue between `mapTemplateToPasscreator` (pure mapping)
 * and `passcreator.{createPassTemplate, updatePassTemplate}` (transport).
 *
 * Behavior:
 *   - If `template.passcreator_template_id` is null → `createPassTemplate`
 *     → returns the new `id`. The CALLER persists the id to the DB row.
 *   - If `template.passcreator_template_id` is set → `updatePassTemplate`
 *     with the existing id → idempotent.
 *
 * Error contract:
 *   - Both create and update throw `BadGatewayError` on any upstream
 *     non-2xx, network failure, or non-JSON response. The caller
 *     (`updateTemplateService`) lets the error propagate so the route
 *     layer can return a 502 to the frontend.
 *   - We do NOT catch / wrap / suppress — Rule 000 Part C.3 says the
 *     boundary is `createPassTemplate / updatePassTemplate` themselves.
 *     This service is a thin dispatcher; the contract is "throw on
 *     failure, return `{id}` on success".
 *
 * Why this split from the mapping:
 *   - `mapTemplateToPasscreator` is a pure function (no I/O). It's the
 *     easiest to unit-test (no SQL mocks, no fetch mocks).
 *   - `syncTemplateToPasscreator` is the I/O wrapper. It's still
 *     unit-testable but with `vi.mock` on the `passcreator` lib.
 *   - Keeping them split lets us verify the mapping independently
 *     from the I/O behavior, and lets the I/O wrapper be replaced
 *     (e.g. for a future GraphQL upstream) without touching the mapping.
 *
 * 2026-10-15 (v15) — Stamp-card push wiring:
 *   For `card_type === 'stamp_card' || card_type === 'multipass'`,
 *   this service reads the composed stamp-0.png R2 key from
 *   `template_stamp_card_images` (via `findUploadedStampImage`) and
 *   passes it to `mapTemplateToPasscreator` as `stampImageKey`. The
 *   mapping then uses that key (instead of `settings.backgroundImage`)
 *   when constructing `images.background`. Other card types continue
 *   to use the tenant-uploaded `settings.backgroundImage`.
 *
 *   The DB read is colocated here (rather than in
 *   `mapTemplateToPasscreator`) to keep the mapping a pure function.
 *   `findUploadedStampImage` returns null when no uploaded row exists;
 *   the mapping then falls back to `settings.backgroundImage` (graceful
 *   path).
 *
 * Rule references:
 *   - Rule 000 Part C.2 — third-party service module structure.
 *   - Rule 000 Part C.3 — third-party errors are wrapped at the
 *     boundary. We do NOT add another wrap layer here; the upstream
 *     service already throws `BadGatewayError`.
 *   - Rule 019 § D.3 — third-party API shape is a contract.
 *
 * @see apps/backend/src/shared/lib/passcreator.ts (transport)
 * @see apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts (pure)
 */

import type { Sql } from '@/shared/db/client';
import type { TemplatesRow } from '@/modules/cards/db/templates';
import {
  createPassTemplate,
  updatePassTemplate,
} from '@/shared/lib/passcreator';
import { findUploadedStampImage } from '@/modules/stamp-images/db/stampImages';
import { mapTemplateToPasscreator } from './passTemplateMapping';
import type { PassLanguage } from '@saome/shared/i18n/fieldLabels';

/**
 * Sync a SAOME template to Passcreator — create or update.
 *
 * @param env   - Cloudflare Worker env (read by passcreator.ts via requireEnv).
 *                Type-erased to `unknown` to keep this module decoupled
 *                from the Hono `HonoEnv` type.
 * @param sql   - postgres.js instance from `getDbForRequest(c)`. Required
 *                since v15 (2026-10-15) to read the composed stamp-0.png
 *                row for stamp_card / multipass pushes.
 * @param template - The current SAOME template row. `passcreator_template_id`
 *                   determines the create-vs-update branch.
 * @param language - The DB-stored template language ('zh-TW' | 'en').
 *                   Drives the localized field labels via the shared
 *                   `fieldLabels` module.
 * @param r2PublicUrl - Backend's R2 public URL (env-driven). Used to
 *                      convert R2 keys to absolute URLs.
 * @returns       - The Passcreator template id (UUID). If the row
 *                 already had an id, that id is returned (idempotent).
 *                 If the row was null, the newly-created id is returned.
 *
 * @throws {BadGatewayError} - From createPassTemplate/updatePassTemplate
 *             on any upstream failure. Caller MUST let this propagate
 *             (the route layer maps to 502 + frontend banner).
 */
export async function syncTemplateToPasscreator(args: {
  env: unknown;
  sql: Sql;
  template: TemplatesRow;
  language: PassLanguage;
  r2PublicUrl: string;
}): Promise<{ id: string; created: boolean }> {
  // 2026-10-15 v15 — Stamp-card / multipass push wiring.
  // Read the composed stamp-0.png row (if any) and thread its R2 key
  // through to the pure mapping. For non-stamp card types, `stampImageKey`
  // is null and the mapping uses `settings.backgroundImage` (existing
  // behavior).
  //
  // v18 (2026-10-15) — additionally thread `stampImageByteHash` so the
  // mapping can append a `?v=<hash[:12]>` cache-bust query string to the
  // R2 proxy URL. Regression trace:
  //   `runs/improvements/feedback/20261015-stamp-card-push-cache-bust-url-hash.md`
  // Without the cache-bust token, Passcreator caches the first
  // fetched PNG keyed by the fixed `${tid}/stamp-image/0` URL and
  // never re-fetches — even after R2 PUT overwrites with newer
  // bytes. byteHash is bound 1:1 to the PNG bytes (any change →
  // new hash → new query string → fresh Passcreator fetch).
  const isStampish =
    args.template.card_type === 'stamp_card' ||
    args.template.card_type === 'multipass';
  const stampImageRow = isStampish
    ? await findUploadedStampImage(args.sql, args.template.id, 0)
    : null;
  const stampImageKey = stampImageRow?.r2Key ?? null;
  const stampImageByteHash = stampImageRow?.byteHash ?? null;

  const body = mapTemplateToPasscreator({
    template: args.template,
    language: args.language,
    r2PublicUrl: args.r2PublicUrl,
    stampImageKey,
    // v18 — only thread the byteHash when the r2Key is present, so the
    // mapping gate (`stampImageKey && stampImageByteHash`) keeps its
    // invariant: null/undefined stampImageKey means "no stamp uploaded
    // yet" — the mapping then falls back to settings.backgroundImage
    // rather than emitting a query-string-flagged URL whose cache key
    // we can't invalidate.
    stampImageByteHash: stampImageKey ? stampImageByteHash : null,
  });

  const existingId = args.template.passcreator_template_id;
  if (existingId) {
    // Idempotent update — Passcreator V2 uses `POST /api/v2/pass-template/:id`
    // (NOT PUT; V1 was PUT, V2 standardized on POST for all mutations).
    const { id } = await updatePassTemplate(args.env, existingId, body);
    return { id, created: false };
  }

  // First-time create — Passcreator POST.
  const { id } = await createPassTemplate(args.env, body);
  return { id, created: true };
}
