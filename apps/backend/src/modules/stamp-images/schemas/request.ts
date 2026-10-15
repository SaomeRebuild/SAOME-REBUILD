/**
 * Request schema for PUT /api/stamp-images/:templateId/:fillCount.
 *
 * @module modules/stamp-images/schemas/request
 * @description Zod schema for the stamp card image upload endpoint.
 *
 * 4-layer schema sync (Rule 019 § 4.1):
 *   Layer 1: packages/shared/schemas/stampCard.ts (uploadStampCardImageRequestSchema)
 *   Layer 2: this file (schema-level re-shape + byte-level guards the
 *            shared schema doesn't enforce)
 *   Layer 3: apps/backend/src/modules/stamp-images/db/stampImages.ts
 *            (sql query accepts literal bytea + byte_hash)
 *   Layer 4: apps/backend/src/modules/stamp-images/services/uploadStampImage.ts
 *            (service signature: bytes + fillCount + templateId)
 *
 * Why a layer-2 file (not just re-exporting the shared schema):
 *   - The shared schema is the cross-platform contract: frontend +
 *     backend + future RN clients all read the same field shape. It
 *     can NOT couple to byte-level concerns (raw byte length, PNG
 *     magic header) because those are HTTP-transport concerns that
 *     don't apply to RN `expo-file-system` reads.
 *   - This layer adds the `min(1)` base64 floor, the ≤4MB post-decode
 *     size cap, and the PNG-magic check. Those are server-side DoS
 *     defenses; the frontend already enforces the magic check in the
 *     canvas binding (so we don't reject for the wrong reason), and
 *     the size cap here is the last-line-of-defense.
 *   - Both schemas accept the same `fillCount: 0..15` (shared schema
 *     is the source; this file mirrors it for symmetry).
 */

import { z } from 'zod';
import {
  uploadStampCardImageRequestSchema,
} from '@saome/shared/schemas/stampCard';
import { STAMP_FILL_CAP } from '@saome/shared/constants/stampCard';

/**
 * Maximum raw (decoded) PNG byte length. 4 MB.
 *
 * Rationale: per the design plan, the composed stamp card image is
 * typically 100-300 KB at 1024×640. A 4 MB cap leaves 10x headroom
 * for unusually dense stamp configurations (multi-color tile overlays,
 * large background images) without opening the door to a DoS via a
 * 50 MB upload. The shared schema's `.max(6 * 1024 * 1024)` is on
 * the base64 string (≈4 MB raw with the 33% inflation); this layer-2
 * schema enforces the **decoded byte length** directly.
 */
const MAX_RAW_BYTES = 4 * 1024 * 1024;

/**
 * PNG magic header (8 bytes). All valid PNG files start with this byte
 * sequence; JPEG/GIF/WebP/BMP uploads would be rejected here.
 *
 * Decoded to ASCII: 89 50 4E 47 0D 0A 1A 0A.
 * We compare against the FIRST 8 RAW BYTES of the decoded buffer.
 */
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Path-param zod schema. UUID-only + fillCount range guard.
 *
 * On failure → 400 ValidationError. This is the user-facing API
 * surface, not an anti-probing endpoint (the auth guard already
 * prevented unauthenticated callers), so 400 is the right status.
 */
export const stampImageParamsSchema = z.object({
  templateId: z.string().uuid('common.error.validationFailed'),
  /** String because path params come over the wire as strings; we re-parse to int+range. */
  fillCount: z
    .string()
    .regex(/^\d+$/, 'common.error.validationFailed')
    .transform((s) => parseInt(s, 10))
    .pipe(z.number().int().min(0).max(STAMP_FILL_CAP)),
});

/**
 * Body zod schema — **stricter than the shared schema** because of
 * the layer-2 concerns listed in the file header.
 *
 * Differences from shared `uploadStampCardImageRequestSchema`:
 *   - `imageBase64` minimum length is `1` (we additionally require the
 *     raw decoded length to be ≥ the PNG magic header length of 8
 *     bytes, enforced at the service layer).
 *   - The byte-length cap is enforced post-decode (4 MB raw), not on
 *     the base64 string itself. This is the more semantically correct
 *     check: a base64-encoded 4 MB PNG is 5.7 MB in base64.
 *
 * The shared schema's `.max(6 * 1024 * 1024)` is preserved here as a
 * fast-fail on the wire (fail-fast before we burn CPU on decode).
 */
export const uploadStampImageBodySchema = uploadStampCardImageRequestSchema
  .extend({
    fillCount: z.number().int().min(0).max(STAMP_FILL_CAP),
    imageBase64: z
      .string()
      .min(1)
      .max(8 * 1024 * 1024), // 8 MB base64 — well above 6 MB; fails fast on gross overshoots.
  });

/**
 * Validate that the decoded bytes start with the PNG magic header.
 *
 * Pure function — service layer calls this AFTER base64 decode. Throws
 * `ValidationError` on mismatch (so the route handler maps it to a 400).
 *
 * Why a separate exported function (rather than zod refinement on the
 * body schema): zod refs the request body, not the decoded bytes.
 * Base64-decode happens BETWEEN zod parse and the R2 write; that's
 * the natural seam for the magic check.
 */
export function assertPngMagicHeader(bytes: Uint8Array): void {
  if (bytes.byteLength < PNG_MAGIC.byteLength) {
    throw new Error('decoded buffer too short to contain PNG magic');
  }
  for (let i = 0; i < PNG_MAGIC.byteLength; i++) {
    if (bytes[i] !== PNG_MAGIC[i]) {
      throw new Error('decoded buffer is not a valid PNG (magic header mismatch)');
    }
  }
}

/**
 * Assert decoded byte length is within the cap.
 *
 * Service-layer call AFTER decode, BEFORE R2 PUT. Throws
 * `ValidationError` on overshoot. The 4 MB cap matches `MAX_RAW_BYTES`
 * and is the design contract — see the rationale in the file header.
 */
export function assertRawByteLength(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_RAW_BYTES) {
    throw new Error(
      `decoded PNG byte length ${bytes.byteLength} exceeds cap ${MAX_RAW_BYTES}`,
    );
  }
  if (bytes.byteLength === 0) {
    throw new Error('decoded PNG byte length is zero');
  }
}

export { MAX_RAW_BYTES, PNG_MAGIC };
