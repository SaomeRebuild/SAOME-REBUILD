/**
 * Stamp Card Image Composer — REACT NATIVE stub.
 *
 * Per Rule 024 § Hook Split Pattern (必 throw 不准 silent), this binding
 * MUST throw a clear, actionable error when called on RN. A silent stub
 * (returning `null` or a `Promise.resolve(new Blob())`) would cause
 * runtime canvas errors that are hard to trace; the throw surfaces
 * immediately at the first call site and points the implementer to
 * the RN migration backlog.
 *
 * To migrate to RN:
 *   1. Implement `composeStampCardImageOnNative` using
 *      `expo-image-manipulator` (or `react-native-image-crop-picker`):
 *        - Build a 1024×640 transparent canvas via `ImageManipulator.manipulate`
 *        - For each cell, composite the stamped/unstamped icon
 *      (downloaded from the manifest URLs as React Native asset URIs).
 *   2. Flip the import in `composeStampCardImage.ts` from
 *      `./composeStampCardImage.web` to `./composeStampCardImage.native`.
 *   3. The shared pure functions in `@saome/shared/logic/stampCardImage`
 *      are platform-agnostic and do not change.
 */

import type { ComposeStampCardImageFn } from './StampCardImageComposer.types';

export const composeStampCardImageOnNative: ComposeStampCardImageFn = (): Promise<Blob> => {
  throw new Error(
    '[composeStampCardImage.native] not yet implemented on React Native. ' +
    'See Rule 024 / RN migration backlog. ' +
    'Use expo-image-manipulator to build the same layout using the shared ' +
    '`computeStampGridLayout` from @saome/shared/logic/stampCardImage.',
  );
};
