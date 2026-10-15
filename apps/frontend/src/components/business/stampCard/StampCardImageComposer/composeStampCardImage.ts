/**
 * Stamp Card Image Composer — pure wrapper around the platform binding.
 *
 * Per Rule 024 § Hook Split Pattern: this main file owns the public API;
 * the actual canvas implementation lives in `composeStampCardImage.web.ts`
 * (and the `.native.ts` stub). The wrapper dispatches to the web binding
 * by default; future RN migration flips the import to the native binding
 * and the rest of the codebase does not change.
 *
 * Why the dispatch is at module-load time (not runtime):
 *   - The browser / RN runtime is decided at build time, not at runtime.
 *   - Module-scope `const impl` is resolved once and never branches per
 *     call. There is no per-call overhead, no `typeof window` check, and
 *     no chance of a cross-platform split in the middle of a request.
 */

import type {
  ComposeStampCardImageFn,
} from './StampCardImageComposer.types';
import { composeStampCardImageOnWeb } from './composeStampCardImage.web';
// RN migration: change the import below to
//   `import { composeStampCardImageOnNative } from './composeStampCardImage.native';`
// and the rest of the codebase stays untouched.
const impl: ComposeStampCardImageFn = composeStampCardImageOnWeb;

/**
 * Compose a stamp card image to a PNG `Blob`.
 *
 * Pure wrapper. The actual canvas + image-element + OffscreenCanvas
 * work happens in the platform binding.
 *
 * @throws `RangeError` when the input's `fillCount` is out of
 *         `[0, STAMP_FILL_CAP]` (defense-in-depth; the input schema
 *         should reject this earlier, but the binding re-checks).
 * @throws `Error` with a clear "not yet implemented" message on
 *         React Native (Rule 024 § 必 throw 不准 silent).
 */
export async function composeStampCardImage(
  input: import('@saome/shared/schemas/stampCard').StampCardImageInput,
): Promise<Blob> {
  return impl(input);
}
