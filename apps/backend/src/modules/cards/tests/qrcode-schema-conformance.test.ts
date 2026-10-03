/**
 * Schema conformance test — QR Code element (2026-10-04).
 *
 * Rule 019 § 4.1 — 4-layer sync for the new `qrcode` element variant
 * in `tableCardElementSchema`. Pins:
 *   - shared `tableCardElementSchema` (Layer 1)
 *   - backend local `templateSettingsSchema.tableCard.elements` (Layer 2)
 *   - backend db `TemplateSettings.tableCard.elements` (Layer 3 — TS type)
 *   - frontend store (Layer 4 — TS type)
 *
 * The new element variant stores a QR PNG recipe (value, fgColor,
 * bgColor, errorCorrectionLevel) — NOT the rasterized PNG itself.
 * See `runs/decisions/2026-10-04-qrcode-library-selection.md` § 1.5.
 */

import { describe, it, expect } from 'vitest';
import { tableCardElementSchema, tableCardSettingsSchema } from '@saome/shared/schemas/card';
import { templateSettingsSchema as localTemplateSettingsSchema } from '../schemas/request';

describe('tableCardElementSchema — qrcode variant conformance (Rule 019 § 4.1)', () => {
  describe('shared schema (Layer 1)', () => {
    it('accepts a valid QR element with all required fields', () => {
      const valid = {
        id: '11111111-1111-1111-1111-111111111111',
        type: 'qrcode' as const,
        x: 60,
        y: 60,
        width: 30,
        height: 30,
        rotation: 0,
        zIndex: 0,
        value: 'https://app.saome.org/pass/abc',
        fgColor: '#000000',
        bgColor: '#ffffff',
        errorCorrectionLevel: 'M' as const,
      };
      expect(() => tableCardElementSchema.parse(valid)).not.toThrow();
    });

    it('errorCorrectionLevel accepts L | M | Q | H', () => {
      const base = {
        id: '11111111-1111-1111-1111-111111111111',
        type: 'qrcode' as const,
        x: 60,
        y: 60,
        width: 30,
        height: 30,
        rotation: 0,
        zIndex: 0,
        value: 'https://app.saome.org/pass/abc',
        fgColor: '#000000',
        bgColor: '#ffffff',
      };
      for (const level of ['L', 'M', 'Q', 'H'] as const) {
        expect(() => tableCardElementSchema.parse({ ...base, errorCorrectionLevel: level })).not.toThrow();
      }
    });

    it('errorCorrectionLevel rejects invalid values', () => {
      const base = {
        id: '11111111-1111-1111-1111-111111111111',
        type: 'qrcode' as const,
        x: 60,
        y: 60,
        width: 30,
        height: 30,
        rotation: 0,
        zIndex: 0,
        value: 'https://app.saome.org/pass/abc',
        fgColor: '#000000',
        bgColor: '#ffffff',
      };
      // @ts-expect-error — intentional invalid value for regression test
      expect(() => tableCardElementSchema.parse({ ...base, errorCorrectionLevel: 'X' })).toThrow();
    });

    it('value requires a valid URL (regression — not user-editable)', () => {
      const base = {
        id: '11111111-1111-1111-1111-111111111111',
        type: 'qrcode' as const,
        x: 60,
        y: 60,
        width: 30,
        height: 30,
        rotation: 0,
        zIndex: 0,
        fgColor: '#000000',
        bgColor: '#ffffff',
        errorCorrectionLevel: 'M' as const,
      };
      // empty string
      expect(() => tableCardElementSchema.parse({ ...base, value: '' })).toThrow();
      // non-URL string
      expect(() => tableCardElementSchema.parse({ ...base, value: 'not-a-url' })).toThrow();
      // URL with whitespace
      expect(() => tableCardElementSchema.parse({ ...base, value: '  ' })).toThrow();
    });

    it('fgColor / bgColor must be 6-digit hex with leading #', () => {
      const base = {
        id: '11111111-1111-1111-1111-111111111111',
        type: 'qrcode' as const,
        x: 60,
        y: 60,
        width: 30,
        height: 30,
        rotation: 0,
        zIndex: 0,
        value: 'https://app.saome.org/pass/abc',
        errorCorrectionLevel: 'M' as const,
      };
      // 3-digit hex rejected
      expect(() => tableCardElementSchema.parse({ ...base, fgColor: '#000', bgColor: '#fff' })).toThrow();
      // 8-digit hex rejected
      expect(() => tableCardElementSchema.parse({ ...base, fgColor: '#00000000', bgColor: '#ffffffff' })).toThrow();
      // no leading # rejected
      expect(() => tableCardElementSchema.parse({ ...base, fgColor: '000000', bgColor: 'ffffff' })).toThrow();
      // 6-digit hex accepted (case-insensitive)
      expect(() => tableCardElementSchema.parse({ ...base, fgColor: '#1a73e8', bgColor: '#FEF7E0' })).not.toThrow();
    });

    it('width / height must be positive', () => {
      const base = {
        id: '11111111-1111-1111-1111-111111111111',
        type: 'qrcode' as const,
        x: 60,
        y: 60,
        rotation: 0,
        zIndex: 0,
        value: 'https://app.saome.org/pass/abc',
        fgColor: '#000000',
        bgColor: '#ffffff',
        errorCorrectionLevel: 'M' as const,
      };
      expect(() => tableCardElementSchema.parse({ ...base, width: 0, height: 0 })).toThrow();
      expect(() => tableCardElementSchema.parse({ ...base, width: -1, height: -1 })).toThrow();
    });

    it('rotation must be in [0, 360] (inclusive max — matches zod .max(360))', () => {
      // zod `.max(360)` is INCLUSIVE — rotation=360 is allowed (treats
      // it as "back to 0"). This test pins the inclusive behavior so
      // any future change to `.max(360).exclusive()` is intentional.
      const base = {
        id: '11111111-1111-1111-1111-111111111111',
        type: 'qrcode' as const,
        x: 60,
        y: 60,
        width: 30,
        height: 30,
        zIndex: 0,
        value: 'https://app.saome.org/pass/abc',
        fgColor: '#000000',
        bgColor: '#ffffff',
        errorCorrectionLevel: 'M' as const,
      };
      expect(() => tableCardElementSchema.parse({ ...base, rotation: -1 })).toThrow();
      // 360 is allowed (inclusive max)
      expect(() => tableCardElementSchema.parse({ ...base, rotation: 360 })).not.toThrow();
      expect(() => tableCardElementSchema.parse({ ...base, rotation: 0 })).not.toThrow();
      expect(() => tableCardElementSchema.parse({ ...base, rotation: 359 })).not.toThrow();
    });
  });

  describe('tableCardSettingsSchema round-trip (Layer 1)', () => {
    it('accepts a full tableCard payload with 1 QR element', () => {
      const payload = {
        elements: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            type: 'qrcode' as const,
            x: 60,
            y: 60,
            width: 30,
            height: 30,
            rotation: 0,
            zIndex: 0,
            value: 'https://app.saome.org/pass/abc',
            fgColor: '#000000',
            bgColor: '#ffffff',
            errorCorrectionLevel: 'M' as const,
          },
        ],
        background: { type: 'solid' as const, color: '#ffffff' },
        bleedMm: 3 as const,
      };
      expect(() => tableCardSettingsSchema.parse(payload)).not.toThrow();
    });
  });

  describe('local (backend Layer 2) — full templateSettings parse', () => {
    it('round-trips a QR element through the full templateSettings schema', () => {
      // Layer 2 mirror — request.ts imports sharedTemplateSettingsSchema
      // directly (Rule 019 § 4.1 L2), so this is the same parse. The
      // round-trip pins that no field is dropped by the parser.
      const payload = {
        tableCard: {
          elements: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              type: 'qrcode' as const,
              x: 60,
              y: 60,
              width: 30,
              height: 30,
              rotation: 0,
              zIndex: 0,
              value: 'https://app.saome.org/pass/abc',
              fgColor: '#1a73e8',
              bgColor: '#FEF7E0',
              errorCorrectionLevel: 'H' as const,
            },
          ],
          background: { type: 'solid' as const, color: '#ffffff' },
          bleedMm: 3 as const,
        },
      };
      const parsed = localTemplateSettingsSchema.parse(payload) as Record<string, unknown>;
      const tableCard = parsed.tableCard as Record<string, unknown>;
      const elements = tableCard.elements as Array<Record<string, unknown>>;
      expect(elements[0]!.type).toBe('qrcode');
      expect(elements[0]!.value).toBe('https://app.saome.org/pass/abc');
      expect(elements[0]!.fgColor).toBe('#1a73e8');
      expect(elements[0]!.bgColor).toBe('#FEF7E0');
      expect(elements[0]!.errorCorrectionLevel).toBe('H');
    });
  });
});
