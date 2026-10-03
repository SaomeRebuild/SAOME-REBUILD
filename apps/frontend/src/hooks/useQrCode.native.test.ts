/**
 * useQrCode.native — React Native stub binding unit tests.
 *
 * Per Rule 024 § Hook Split Pattern, the native binding must throw a
 * descriptive NotImplementedError so RN-side bugs are immediately
 * diagnosable. Silent stubs (return null / empty) hide the issue and
 * produce cryptic canvas-related errors at runtime.
 *
 * @module hooks/useQrCode.native.test
 */

import { describe, it, expect } from 'vitest';
import { qrToImageOnNative } from './useQrCode.native';

describe('useQrCode.native binding — qrToImageOnNative (RN stub)', () => {
  it('throws a NotImplementedError when called on React Native', async () => {
    await expect(
      qrToImageOnNative('https://example.com/p/1', {
        fgColor: '#000000',
        bgColor: '#ffffff',
        errorCorrectionLevel: 'M',
      }),
    ).rejects.toThrow(/not yet implemented on React Native/i);
  });

  it('error message points to the RN migration backlog', async () => {
    try {
      await qrToImageOnNative('x', {
        fgColor: '#000000',
        bgColor: '#ffffff',
        errorCorrectionLevel: 'M',
      });
      expect.fail('expected qrToImageOnNative to throw');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Mentions react-native-qrcode-svg so devs find the migration guide
      // without grep'ing the codebase.
      expect(message).toMatch(/react-native-qrcode-svg/);
    }
  });
});
