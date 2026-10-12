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
 * Rule references:
 *   - Rule 000 Part C.2 — third-party service module structure.
 *   - Rule 000 Part C.3 — third-party errors are wrapped at the
 *     boundary. We do NOT add another wrap layer here; the upstream
 *     service already throws `BadGatewayError`.
 *
 * @see apps/backend/src/shared/lib/passcreator.ts (transport)
 * @see apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts (pure)
 */

import type { TemplatesRow } from '@/modules/cards/db/templates';
import {
  createPassTemplate,
  updatePassTemplate,
} from '@/shared/lib/passcreator';
import { mapTemplateToPasscreator } from './passTemplateMapping';
import type { PassLanguage } from '@saome/shared/i18n/fieldLabels';

/**
 * Sync a SAOME template to Passcreator — create or update.
 *
 * @param env   - Cloudflare Worker env (read by passcreator.ts via requireEnv).
 *                Type-erased to `unknown` to keep this module decoupled
 *                from the Hono `HonoEnv` type.
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
  template: TemplatesRow;
  language: PassLanguage;
  r2PublicUrl: string;
}): Promise<{ id: string; created: boolean }> {
  const body = mapTemplateToPasscreator({
    template: args.template,
    language: args.language,
    r2PublicUrl: args.r2PublicUrl,
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
