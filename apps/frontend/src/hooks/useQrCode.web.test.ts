/**
 * useQrCode.web — Web binding unit tests (Rule 003 TDD).
 *
 * The web binding wraps the `qrcode` npm library:
 *   1. `QRCode.toDataURL(text, opts)` returns a PNG data URL
 *   2. We wrap it in `new Image()` so consumers get a loaded HTMLImageElement
 *      that Konva.Image can render synchronously after the load event.
 *
 * Tests cover the integration of `qrcode` with our config mapping.
 * We mock the `qrcode` library so the test stays fast (no real PNG
 * encoding) and deterministic across environments. jsdom's `Image`
 * object does not fire `onload` for `data:` URLs reliably, so mocking
 * the lib is the only sane way to test this in vitest.
 *
 * Tests:
 *   - basic encoding — `qrcode` is called with mapped options
 *   - all four EC levels are accepted
 *   - color hex codes are passed through to the `color: { dark, light }` option
 *   - CJK URL characters are passed through unmodified
 *   - empty string is rejected (regression: store action should never
 *     pass an empty `value` because schema enforces `.url()`)
 *
 * @module hooks/useQrCode.web.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import QRCode from 'qrcode';

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(),
  },
}));

// `QRCode.toDataURL` is typed loosely by `@types/qrcode` (the mock
// factory replaces it with `vi.fn()` whose signature widens to
// `Mock<any, any>`). Cast to the real signature so the call site
// (and `mockResolvedValue(FAKE_PNG_DATA_URL)`) typechecks cleanly.
const mockedToDataURL = QRCode.toDataURL as unknown as ReturnType<typeof vi.fn>;

// 1x1 transparent PNG (base64). We don't care about the actual pixels
// for the binding tests — only that `new Image().src = ...` is set and
// the promise resolves.
const FAKE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

import { qrToImageOnWeb } from './useQrCode.web';

describe('useQrCode.web binding — qrToImageOnWeb', () => {
  beforeEach(() => {
    // Each test gets a fresh `qrcode` mock. The implementation expects
    // `QRCode.toDataURL(...)` to resolve with a base64 PNG data URL.
    mockedToDataURL.mockReset();
    mockedToDataURL.mockResolvedValue(FAKE_PNG_DATA_URL);

    // jsdom does not fire `Image.onload` for data: URLs reliably, so
    // we patch the prototype to fire onload synchronously after src
    // is set. The hook awaits the load promise, so this is enough to
    // unblock the Promise chain in the binding.
    const proto = Image.prototype as unknown as {
      _srcSetter: (value: string) => void;
    };
    if (!proto._srcSetter) {
      proto._srcSetter = Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype,
        'src',
      )!.set!;
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        set(this: HTMLImageElement, value: string) {
          proto._srcSetter.call(this, value);
          // Fire onload on next microtask so consumers see a loaded image.
          queueMicrotask(() => {
            if (this.onload) this.onload(new Event('load'));
          });
        },
        get(this: HTMLImageElement) {
          return this.getAttribute('src') ?? '';
        },
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls QRCode.toDataURL with text + mapped options', async () => {
    await qrToImageOnWeb('https://example.com/pass/abc', {
      fgColor: '#000000',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
    });

    expect(mockedToDataURL).toHaveBeenCalledTimes(1);
    expect(mockedToDataURL).toHaveBeenCalledWith('https://example.com/pass/abc', {
      width: 1024,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
  });

  it('returns an HTMLImageElement with the data URL set as src', async () => {
    const img = await qrToImageOnWeb('https://example.com/p/1', {
      fgColor: '#000000',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
    });

    expect(img).toBeInstanceOf(HTMLImageElement);
    expect(img.src).toBe(FAKE_PNG_DATA_URL);
  });

  it('accepts all four error-correction levels', async () => {
    for (const level of ['L', 'M', 'Q', 'H'] as const) {
      await qrToImageOnWeb('https://example.com/p/1', {
        fgColor: '#000000',
        bgColor: '#ffffff',
        errorCorrectionLevel: level,
      });
      expect(mockedToDataURL).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ errorCorrectionLevel: level }),
      );
    }
  });

  it('plumbs custom foreground and background colors into the `color` option', async () => {
    await qrToImageOnWeb('https://example.com/p/2', {
      fgColor: '#1a73e8',
      bgColor: '#fef7e0',
      errorCorrectionLevel: 'H',
    });
    expect(mockedToDataURL).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        color: { dark: '#1a73e8', light: '#fef7e0' },
        errorCorrectionLevel: 'H',
      }),
    );
  });

  it('encodes CJK URL characters without modification (regression: charset)', async () => {
    // Regression: the `qrcode` lib accepts CJK strings as input; we
    // pass them through unmodified. If a future binding accidentally
    // URL-encodes the text BEFORE handing it to the lib, the
    // generated QR will decode to the URL-encoded form (not the
    // original characters) and scanning will fail.
    const cjkUrl = 'https://example.com/pass/中文-uuid-001';
    await qrToImageOnWeb(cjkUrl, {
      fgColor: '#000000',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
    });
    expect(mockedToDataURL).toHaveBeenCalledWith(
      cjkUrl,
      expect.objectContaining({ errorCorrectionLevel: 'M' }),
    );
  });

  it('rejects an empty string input by propagating qrcode lib error', async () => {
    // The qrcode lib throws on empty input. Our binding should
    // propagate that so the hook flips to 'failed' status and the
    // Inspector shows the failure placeholder.
    mockedToDataURL.mockRejectedValueOnce(new Error('No input text'));
    await expect(
      qrToImageOnWeb('', {
        fgColor: '#000000',
        bgColor: '#ffffff',
        errorCorrectionLevel: 'M',
      }),
    ).rejects.toThrow(/No input text/);
  });
});
