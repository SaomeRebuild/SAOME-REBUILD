/**
 * useQrCode.native — React Native stub binding.
 *
 * @module hooks/useQrCode.native
 * @description RN-side stub for QR Code generation. Currently throws a
 * NotImplementedError so RN-side bugs are immediately diagnosable.
 * Silent stubs (return null / empty) would mask the issue and surface
 * as cryptic canvas errors.
 *
 * **Status: not yet implemented.**
 *
 * RN migration backlog: replace this body with a real implementation
 * using `react-native-qrcode-svg` (or expo-barcode-generator). The
 * output signature is `Promise<HTMLImageElement>`-shaped; the RN impl
 * can either (a) return an RN-native image that the consumer treats
 * specially via a `.native.tsx` Konva equivalent, or (b) rasterize the
 * SVG to a PNG Buffer the same way web does.
 */

import type { QrToImageFn } from './useQrCode';

/**
 * RN stub — throws to signal "QR generation not yet implemented on native".
 * Replace with react-native-qrcode-svg (or equivalent) when the RN
 * migration is scheduled. Signature MUST match `QrToImageFn` in
 * `useQrCode.ts`.
 */
export const qrToImageOnNative: QrToImageFn = async (_text, _opts) => {
  throw new Error(
    '[useQrCode.native] QR rendering not yet implemented on React Native. ' +
      'See RN migration backlog (use react-native-qrcode-svg).',
  );
};
