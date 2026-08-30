/**
 * Native (React Native) stub for `cropImage()`.
 *
 * Metro bundler's automatic `.web.ts` / `.native.ts` resolution means this
 * file is selected when bundling for React Native. The web build picks up
 * `useImageCrop.web.ts` instead.
 *
 * **Status: not yet implemented.**
 *
 * The RN migration backlog will fill in a real implementation using
 * `react-native-image-crop-picker` (or expo-image-manipulator). For now,
 * calling `cropImage()` in an RN environment throws — this is intentional
 * so that consumers can detect the missing implementation early rather
 * than getting a silent canvas-related runtime error on RN (where
 * `document.createElement` does not exist).
 *
 * @module hooks/useImageCrop.native
 */

import type { CropImageFn } from './useImageCrop';

/**
 * RN stub — throws to signal "cropImage not yet implemented on native".
 * Once the RN migration adds react-native-image-crop-picker (or equivalent),
 * replace this body with the real implementation and keep the signature
 * identical to `useImageCrop.web.cropImageOnWeb`.
 */
export const cropImageOnNative: CropImageFn = (): Promise<Blob> => {
  throw new Error(
    '[useImageCrop.native] cropImage() not yet implemented on React Native. ' +
    'See RN migration backlog (use react-native-image-crop-picker).',
  );
};
