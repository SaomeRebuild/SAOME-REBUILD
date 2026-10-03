/**
 * useQrCode — Client-side QR Code generation hook (Hook Split Pattern).
 *
 * @module hooks/useQrCode
 * @description Generates an `HTMLImageElement` (ready to feed Konva.Image)
 * for the given (text, fgColor, bgColor, errorCorrectionLevel) tuple.
 *
 * RN migration (Rule 024 § Hook Split Pattern):
 *   - The public hook lives in this file and owns the `useState` /
 *     `useEffect` orchestration.
 *   - The web implementation of `qrToImageOnWeb` (Canvas-based) is
 *     in `useQrCode.web.ts`.
 *   - The React Native stub `qrToImageOnNative` (throws
 *     NotImplementedError) is in `useQrCode.native.ts`.
 *   - At RN migration time, swap the binding import below from
 *     `qrToImageOnWeb` to `qrToImageOnNative` (after that file is
 *     updated to use react-native-qrcode-svg).
 *
 * Why a separate hook (vs inline at call site): the Inspector changes
 * 2 colors + 1 EC level select, and the Canvas may have many QR
 * elements. Caching the (text, fg, bg, ec) tuple in `useMemo` and the
 * `HTMLImageElement` in `useState` avoids re-encoding on every render
 * (~50ms each, see `qrcode` lib benchmark). When the user changes a
 * color, the hook re-runs the effect and the new image replaces the
 * previous one after `img.decode()` settles.
 */

import { useEffect, useState } from 'react';
import { qrToImageOnWeb } from './useQrCode.web';
// RN migration backlog: when RN support is added, change the binding
// import to `./useQrCode.native` and provide a real implementation
// using `react-native-qrcode-svg`.
//
// import { qrToImageOnNative } from './useQrCode.native';
// const qrToImageImpl: QrToImageFn = qrToImageOnNative;

/** QR Code error correction levels (per ISO/IEC 18004:2015 § 6.5.1). */
export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

/** Platform-specific QR-to-image function signature (web + native). */
export type QrToImageFn = (
  text: string,
  opts: {
    fgColor: string;
    bgColor: string;
    errorCorrectionLevel: QrErrorCorrectionLevel;
  },
) => Promise<HTMLImageElement>;

/** Status reported by the hook so consumers can show loading / error UI. */
export type QrStatus = 'idle' | 'loading' | 'loaded' | 'failed';

/**
 * Currently active platform-specific QR-to-image function.
 * Web build: uses `qrToImageOnWeb` (Canvas-based PNG data URL).
 * Native build (future): swap to `qrToImageOnNative`.
 */
const qrToImageImpl: QrToImageFn = qrToImageOnWeb;

/**
 * Hook return tuple: `[image, status]`.
 *
 * - `image`: loaded `HTMLImageElement` (null until status === 'loaded')
 * - `status`: 'loading' (initial), 'loaded', or 'failed'
 */
export type UseQrCodeResult = readonly [HTMLImageElement | null, QrStatus];

/**
 * Generate a QR Code image for the given parameters.
 *
 * @param text Encoded text (typically a URL — schema enforces `.url()`).
 * @param fgColor Foreground hex color (QR dark modules). Default '#000000'.
 * @param bgColor Background hex color (QR light modules). Default '#ffffff'.
 * @param errorCorrectionLevel One of L (7%) / M (15%) / Q (25%) / H (30%).
 *
 * @example
 * ```tsx
 * const [qrImg, qrStatus] = useQrCode(
 *   'https://app.example.com/pass/abc',
 *   '#000000',
 *   '#ffffff',
 *   'M',
 * );
 * if (qrStatus === 'loaded' && qrImg) {
 *   return <Image image={qrImg} width={size} height={size} />;
 * }
 * ```
 */
export function useQrCode(
  text: string,
  fgColor: string,
  bgColor: string,
  errorCorrectionLevel: QrErrorCorrectionLevel,
): UseQrCodeResult {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<QrStatus>('idle');

  useEffect(() => {
    // Guard: if any input is empty, treat as "not yet ready" rather than
    // invoking the QR library with garbage. The Inspector should not
    // pass an empty `value` in practice (schema enforces `.url()`), but
    // being defensive here costs nothing.
    if (!text || !fgColor || !bgColor || !errorCorrectionLevel) {
      setImage(null);
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    qrToImageImpl(text, { fgColor, bgColor, errorCorrectionLevel })
      .then((img) => {
        if (cancelled) return;
        setImage(img);
        setStatus('loaded');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[useQrCode] QR generation failed:', err);
        setImage(null);
        setStatus('failed');
      });

    return () => {
      cancelled = true;
    };
  }, [text, fgColor, bgColor, errorCorrectionLevel]);

  return [image, status] as const;
}
