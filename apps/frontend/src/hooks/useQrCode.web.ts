/**
 * useQrCode.web — Web platform QR Code generation binding.
 *
 * @module hooks/useQrCode.web
 * @description Wraps the `qrcode` npm library's `toDataURL` and returns
 * a loaded `HTMLImageElement` ready to feed Konva.Image.
 *
 * Vite's automatic `.web.ts` / `.native.ts` resolution means this file
 * is selected when bundling for browsers. On React Native, Metro would
 * instead resolve `.native.ts` (which currently throws a
 * NotImplementedError; see `useQrCode.native.ts`).
 */

import QRCode from 'qrcode';
import type { QrToImageFn } from './useQrCode';

/**
 * Web-only: Generate a QR Code PNG and load it as an HTMLImageElement.
 *
 * @param text Encoded text (URL).
 * @param opts.fgColor Foreground hex color (QR dark modules).
 * @param opts.bgColor Background hex color (QR light modules).
 * @param opts.errorCorrectionLevel L (7%) / M (15%) / Q (25%) / H (30%).
 * @returns Loaded HTMLImageElement (Promise).
 */
export const qrToImageOnWeb: QrToImageFn = async (text, opts) => {
  const dataUrl = await QRCode.toDataURL(text, {
    // 1024 px gives a sharp render at typical print sizes (30-60mm at
    // 300 DPI ≈ 354-709 px). The Konva.Image node will downscale to
    // the on-canvas size; browsers handle this losslessly via
    // bilinear filtering.
    width: 1024,
    margin: 2,
    color: {
      dark: opts.fgColor,
      light: opts.bgColor,
    },
    errorCorrectionLevel: opts.errorCorrectionLevel,
  });

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('[useQrCode.web] failed to load QR data URL into HTMLImageElement'));
    img.src = dataUrl;
  });
};
