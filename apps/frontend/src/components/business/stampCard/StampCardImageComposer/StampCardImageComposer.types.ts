/**
 * Stamp Card Image Composer — public types.
 *
 * @module StampCardImageComposer.types
 * @description Public type surface for the stamp card image composer
 * (Phase 2 of the Frontend Stamp Card Image Composition plan, 2026-10-13).
 *
 * The composer is consumed by:
 *   - CardBuilder Step 3: pre-renders `0.png` (empty template) and uploads
 *     to R2.
 *   - Future Scanner: incrementally writes `1.png`~`15.png` after each
 *     stamp-earning event.
 *
 * Both call sites pass the same `StampCardImageInput` shape (the same
 * zod schema defined in `@saome/shared/schemas/stampCard`); the only
 * difference is the `fillCount` value and the upload target.
 */

import type { StampCardImageInput } from '@saome/shared/schemas/stampCard';

/**
 * Pure-function binding signature for the canvas composer.
 *
 * Implemented by `composeStampCardImageOnWeb` (`.web.ts`) using
 * OffscreenCanvas + CanvasRenderingContext2D, and by a `throw`
 * stub in `composeStampCardImageOnNative` (`.native.ts`) per
 * Rule 024 § Hook Split Pattern (必 throw 不准 silent).
 *
 * Consumers (CardBuilder / Scanner) call `composeStampCardImage(input)`
 * — the pure wrapper that dispatches to the active platform binding.
 */
export type ComposeStampCardImageFn = (input: StampCardImageInput) => Promise<Blob>;

/**
 * Lifecycle state of the pre-render trigger.
 *
 * The component drives a state machine:
 *
 *   idle ─[trigger]→ composing ─[ok]→ uploading ─[ok]→ saved
 *                                ↘ error (any failure)
 *   error ─[trigger]→ composing (retry)
 *
 * The hook (`useStampCardImageComposer`) owns the state transitions
 * and the `compose + upload` orchestration; the component is a
 * thin trigger + status display layer.
 */
export type StampCardComposerStatus =
  | 'idle'
  | 'composing'
  | 'uploading'
  | 'saved'
  | 'error';

/**
 * Result of a successful save. Mirrors the backend's
 * `UploadStampCardImageResponse` (minus `uploadedAt` which is
 * server-side only).
 */
export interface StampCardComposerSaveResult {
  /** R2 path, e.g. `tenants/{tenantId}/templates/{id}/stamp-0.png`. */
  r2Key: string;
  /** Lowercase hex SHA-256 of the PNG byte stream. */
  byteHash: string;
  /** PNG byte length after upload. */
  byteLength: number;
}
