/**
 * Stamp Card Image Composition Schemas (2026-10-13).
 *
 * @module shared/schemas/stampCard
 * @description Zod schemas for the stamp card image composition pipeline
 * (CardBuilder Step 3 pre-renders 0.png, future Scanner fills 1.png~15.png).
 *
 * Architecture rationale:
 *   - CardBuilder / Scanner run on the **tenant device** (browser), not the
 *     Cloudflare Worker. The worker free-plan envelope caps user-facing
 *     requests at **10ms CPU** / 50 subrequests, which is incompatible with
 *     image composition. Offloading composition to the browser keeps the
 *     worker's CPU budget free for auth + R2 round-trips.
 *   - The composed PNG is uploaded to the backend via `PUT
 *     /api/templates/:id/stamp-images/:fillCount`. Backend just stores the
 *     bytes — no composition happens server-side.
 *   - Grid lines are **always transparent** (`rgba(0,0,0,0)`). The grid
 *     structure is implied by the cell positions; the line color is the
 *     canvas's literal stroke style, and the contract pins it to
 *     `transparent` so consumers (Passcreator V2 push) never see a visible
 *     grid overlay.
 *
 * Cross-references (Rule 019 § 4.1 four-layer sync):
 *   1. shared schemas (this file)
 *   2. backend `apps/backend/src/modules/templates/schemas/request.ts`
 *   3. backend `apps/backend/src/modules/templates/db/stampImages.ts`
 *   4. backend `apps/backend/src/modules/templates/services/stampImageService.ts`
 *
 * Why this file lives in `shared/` and not `shared/constants/`:
 *   The schema validates **structured input** (nested objects, color
 *   formats, background union), not just primitive enum values. Constants
 *   that this schema depends on (`STAMP_FILL_CAP`, `STAMP_GRID_LINE_COLOR`,
 *   `STAMP_DEFAULT_CANVAS`) are exported from `shared/constants/stampCard.ts`
 *   (separate concern: reusable pure values for the canvas + R2 layer).
 */

import { z } from 'zod';
import {
  STAMP_FILL_CAP,
  STAMP_DEFAULT_CANVAS,
} from '../constants/stampCard';

/**
 * Fill count for a stamp card image.
 *
 * Domain: integer ∈ [0, STAMP_FILL_CAP]. Encodes the on-disk file name as
 * `${fillCount}.png` (e.g. 0.png, 1.png, ..., 15.png). The cap of
 * `STAMP_FILL_CAP` (15) is the cost-optimization ceiling — the user
 * confirmed 2026-10-13 that "after 16.png no more generation" is the
 * intended end-state. Tenants with larger grid configurations (e.g. 4×5=20)
 * would only ever see 0~15 states; this is intentional and trades visual
 * coverage for R2 + compute savings.
 *
 * Why a literal union and not `z.number().int().min(0).max(15)`:
 *   - Compile-time exhaustiveness — TypeScript narrows the type to the
 *     exact literal so we get TS errors if a new fillCount level is added
 *     without updating the schema.
 *   - Runtime zod still validates the numeric range (the union literal
 *     is a *type* artifact; the schema is the same numeric range check).
 */
export const stampFillCountSchema = z
  .number()
  .int()
  .min(0)
  .max(STAMP_FILL_CAP);

/**
 * Hex color string (6-digit, optional '#' prefix). Matches the existing
 * convention in `card.ts` (`backgroundColor`, `textColor`) and the
 * `card-images.ts` / `color-presets.ts` constants.
 */
const hexColorSchema = z.string().regex(/^#?[0-9a-fA-F]{6}$/);

/**
 * Background for the stamp card image.
 *
 * Two variants:
 *   - `color`: a flat fill (`{ type: 'color', value: '#RRGGBB' }`)
 *   - `image`: a fetched R2 / URL-backed background (`{ type: 'image', url: string }`)
 *
 * Why a discriminated union and not a `color?: string; imageUrl?: string`
 * flat shape: it eliminates the "both set / neither set" ambiguity at the
 * schema level. The renderer (`.web.ts`) and the upload service can switch
 * on `type` to pick the right branch.
 */
export const stampCardBackgroundSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('color'),
    value: hexColorSchema,
  }),
  z.object({
    type: z.literal('image'),
    /** https URL or R2 key. The `.web.ts` renderer fetches via `createImageBitmap`. */
    url: z.string().min(1),
  }),
]);

/**
 * Input to the stamp card image composer.
 *
 * Consumed by `composeStampCardImage.web.ts` (Canvas API binding) and
 * validated at the upload boundary (backend `uploadStampCardImageRequestSchema`).
 *
 * `gridColor` is intentionally a string-literal `'transparent'` (not a
 * generic color) — the design contract pins it transparent so Passcreator
 * never sees a visible grid overlay. Using a literal type here enforces
 * that at compile time.
 */
export const stampCardImageInputSchema = z.object({
  /**
   * Grid rows. Matches the existing `StampGridRows` type in
   * `apps/frontend/src/components/business/stampCard/StampGridPreview/StampGridPreview.types.ts`.
   * The cap is the existing UI constraint (1-4), not the cost cap.
   */
  rows: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),

  /**
   * Grid columns. Always 5 in the locked-in design (see `STAMPS_PER_ROW`
   * in the existing preview types). We allow 1-5 here so the schema does
   * not over-constrain — the editor and the Step 3 selector both default
   * to 5, but smaller configs (e.g. a 3×3 grid for a 9-stamp design) are
   * acceptable in the input layer.
   */
  cols: z.number().int().min(1).max(5),

  /**
   * Grid line color. Pinned to `'transparent'` by the design contract —
   * the renderer should NEVER draw a visible grid border on top of the
   * stamp icons. Using a literal type here enforces the invariant at
   * compile time; runtime zod rejects anything else.
   */
  gridColor: z.literal('transparent'),

  /**
   * Icon id from `apps/frontend/src/assets/icons/stamps/manifest.ts`.
   * The composer resolves both `stampedUrl` and `unstampedUrl` via
   * `getStampIcon(iconId)`. If the id is unknown, the renderer falls
   * back to the first available icon (defensive — see manifest.ts
   * `getStampIcon` contract).
   */
  iconId: z.string().min(1),

  /**
   * Color for the foreground icon (modulates the stamped variant's tint).
   * Hex string, optional '#' prefix. The renderer applies this via
   * `ctx.fillStyle` for the stamped icon's draw pass.
   */
  iconColor: hexColorSchema,

  /**
   * Accent color for visual context (e.g. subtle background highlight on
   * stamped cells). Optional. When `undefined`, the renderer skips the
   * accent overlay.
   */
  accentColor: hexColorSchema.optional(),

  /**
   * Background. Color or image (see `stampCardBackgroundSchema`).
   */
  background: stampCardBackgroundSchema,

  /**
   * Number of cells to render as "stamped" (filled-in icon). The first
   * `fillCount` cells use `stampedUrl`; the remaining `rows*cols -
   * fillCount` cells use `unstampedUrl`.
   *
   * For pre-rendering the empty template, callers pass `fillCount: 0`.
   * For the Scanner-side composition, callers pass the member's current
   * stamp count (clamped to `[0, STAMP_FILL_CAP]`).
   */
  fillCount: stampFillCountSchema,
});

/**
 * Output metadata of the composer.
 *
 * Returned by the renderer alongside the `Blob`. The backend uses
 * `byteHash` for de-duplication (R2 overwrite detection) and
 * `dimensions` for layout validation.
 *
 * `byteHash` is the **hex-encoded SHA-256** of the PNG byte stream (64
 * chars, lowercase). Lowercase by convention to match the existing
 * `r2.ts` hash contract.
 */
export const stampCardImageOutputSchema = z.object({
  /** Lowercase hex SHA-256 of the PNG byte stream (64 chars). */
  blobHash: z.string().regex(/^[0-9a-f]{64}$/),
  /** Pixel dimensions of the rendered image. */
  dimensions: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  /** Total byte length of the rendered PNG. */
  byteLength: z.number().int().positive(),
});

/**
 * Backend upload request shape.
 *
 * Sent by CardBuilder / Scanner to `PUT /api/templates/:id/stamp-images/:fillCount`.
 * The body is JSON containing the base64-encoded PNG and the validated
 * fill count.
 *
 * Why base64 (not multipart/form-data): the request is small (≤ 4 MB
 * enforced) and the existing upload endpoints in the codebase use JSON
 * bodies (see `tableCard` export endpoint). base64 inflates the payload
 * by ~33% but keeps the body shape uniform with the rest of the API.
 */
export const uploadStampCardImageRequestSchema = z.object({
  fillCount: stampFillCountSchema,
  /**
   * Base64-encoded PNG. The backend decodes this, validates the PNG
   * magic header (`iVBORw`...), and writes the bytes to R2.
   * Size cap: 4 MB raw bytes after decoding (enforced in service layer).
   */
  imageBase64: z
    .string()
    .min(1)
    // Roughly: 4 MB raw ≈ 5.7 MB base64; reject payloads obviously larger
    // than the cap to fail fast in the zod parse step.
    .max(6 * 1024 * 1024),
});

/**
 * Backend upload response shape.
 *
 * Returned to the client on successful upload. `r2Key` is the
 * `{tenantId}/{templateId}/stamp-{fillCount}.png` path under which the
 * image is stored. `byteHash` is the same hex SHA-256 the composer
 * computed client-side, mirrored from the server for the R2 round-trip
 * audit log.
 */
export const uploadStampCardImageResponseSchema = z.object({
  r2Key: z.string().min(1),
  byteHash: z.string().regex(/^[0-9a-f]{64}$/),
  byteLength: z.number().int().positive(),
  uploadedAt: z.string(),
});

/** Inferred type for `StampCardImageInput`. Use this in renderer signatures. */
export type StampCardImageInput = z.infer<typeof stampCardImageInputSchema>;

/** Inferred type for `StampCardImageOutput`. */
export type StampCardImageOutput = z.infer<typeof stampCardImageOutputSchema>;

/** Inferred type for the upload request body. */
export type UploadStampCardImageRequest = z.infer<
  typeof uploadStampCardImageRequestSchema
>;

/** Inferred type for the upload response body. */
export type UploadStampCardImageResponse = z.infer<
  typeof uploadStampCardImageResponseSchema
>;

/** Re-export the default canvas constant for the renderer's convenience. */
export { STAMP_DEFAULT_CANVAS };
