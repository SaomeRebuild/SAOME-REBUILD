/**
 * CardBuilderEditor.store — loadSettings cache-busting version bump test.
 *
 * Bug-φ fix (Phase 3 of icon-preview plan 2026-08-31): when a user resumes a
 * draft, the issuerLogo/iconImage URL gets a `?v=…` cache-busting param. The
 * version counter is reset to 0 on mount, so if the browser had cached a
 * stale 404 / partial / broken response, it would be served forever.
 *
 * Fix: `loadSettings` bumps the version to `Date.now()` whenever a non-empty
 * key is loaded from settings. This guarantees the URL has a fresh
 * cache-busting param the moment we know the key exists.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCardBuilderStore, unwrapCardSettings } from './CardBuilderEditor.store';

describe('CardBuilderEditor.store — loadSettings cache-busting fix', () => {
  beforeEach(() => {
    // Reset store to a clean state before each test
    useCardBuilderStore.setState({
      cardId: null,
      name: '',
      cardType: null,
      step: 1,
      completedSteps: new Set(),
      cardSide: 'front',
      issuerName: '',
      issuerLogo: '',
      issuerLogoVersion: 0,
      iconImage: '',
      iconImageVersion: 0,
      backgroundColor: '#1a1a1a',
      textColor: '#ffffff',
      holderName: '',
      barcodeType: 'qr_code',
      storeName: '',
      passValidDays: null,
      expiryDate: '',
      currency: 'TWD',
      isPaid: false,
    });
  });

  it('bumps issuerLogoVersion when loading a new logo key from settings', () => {
    // Simulate resume-from-draft: store starts with version=0 (after reset)
    expect(useCardBuilderStore.getState().issuerLogoVersion).toBe(0);

    const before = Date.now();
    useCardBuilderStore.getState().loadSettings({
      issuerLogo: 'tenant-1/template-1/issuer-logo.png',
    });
    const after = Date.now();

    const state = useCardBuilderStore.getState();
    expect(state.issuerLogo).toBe('tenant-1/template-1/issuer-logo.png');
    // Version must have been bumped to a fresh timestamp
    expect(state.issuerLogoVersion).toBeGreaterThanOrEqual(before);
    expect(state.issuerLogoVersion).toBeLessThanOrEqual(after);
  });

  it('bumps iconImageVersion when loading a new icon key from settings', () => {
    expect(useCardBuilderStore.getState().iconImageVersion).toBe(0);

    const before = Date.now();
    useCardBuilderStore.getState().loadSettings({
      iconImage: 'tenant-1/template-1/icon.png',
    });
    const after = Date.now();

    const state = useCardBuilderStore.getState();
    expect(state.iconImage).toBe('tenant-1/template-1/icon.png');
    expect(state.iconImageVersion).toBeGreaterThanOrEqual(before);
    expect(state.iconImageVersion).toBeLessThanOrEqual(after);
  });

  it('does NOT bump version when the loaded key is the same as the current one (idempotent resume)', () => {
    // Pre-seed store with a known logo + version
    useCardBuilderStore.setState({
      issuerLogo: 'tenant-1/template-1/issuer-logo.png',
      issuerLogoVersion: 12345,
    });

    useCardBuilderStore.getState().loadSettings({
      issuerLogo: 'tenant-1/template-1/issuer-logo.png',
    });

    // Version should remain at 12345 (no bump — same key)
    expect(useCardBuilderStore.getState().issuerLogoVersion).toBe(12345);
  });

  it('handles combined loadSettings (logo + icon + step 2 fields) without losing versions', () => {
    useCardBuilderStore.getState().loadSettings({
      issuerLogo: 'tenant-1/template-1/issuer-logo.png',
      iconImage: 'tenant-1/template-1/icon.png',
      storeName: 'My Store',
      issuerName: 'My Issuer',
      barcodeType: 'pdf_417',
      passValidDays: 365,
      expiryDate: '2027-01-01',
      currency: 'TWD',
      isPaid: true,
    });

    const state = useCardBuilderStore.getState();
    // Step 2 fields loaded
    expect(state.storeName).toBe('My Store');
    expect(state.issuerName).toBe('My Issuer');
    expect(state.barcodeType).toBe('pdf_417');
    expect(state.passValidDays).toBe(365);
    expect(state.expiryDate).toBe('2027-01-01');
    expect(state.currency).toBe('TWD');
    expect(state.isPaid).toBe(true);
    // Step 3 keys loaded
    expect(state.issuerLogo).toBe('tenant-1/template-1/issuer-logo.png');
    expect(state.iconImage).toBe('tenant-1/template-1/icon.png');
    // Versions bumped (non-zero)
    expect(state.issuerLogoVersion).toBeGreaterThan(0);
    expect(state.iconImageVersion).toBeGreaterThan(0);
  });
});

describe('loadSettings — defensive parsing (Bug #8.5 / 2026-08-31)', () => {
  beforeEach(() => {
    useCardBuilderStore.setState({
      cardId: null,
      name: '',
      cardType: null,
      step: 1,
      completedSteps: new Set(),
      cardSide: 'front',
      issuerName: '',
      issuerLogo: '',
      issuerLogoVersion: 0,
      iconImage: '',
      iconImageVersion: 0,
      backgroundColor: '#1a1a1a',
      textColor: '#ffffff',
      holderName: '',
      barcodeType: 'qr_code',
      storeName: '',
      passValidDays: null,
      expiryDate: '',
      currency: 'TWD',
      isPaid: false,
    });
  });

  it('merges array of partial objects into single store state', () => {
    // Bug #8.5 worst case: array of partial merges from legacy corruption.
    useCardBuilderStore.getState().loadSettings([
      { cardType: 'stamp_card' as const },
      { storeName: 'X', barcodeType: 'pdf_417' as const },
      { issuerLogo: 'k', iconImage: 'i' },
    ]);

    const s = useCardBuilderStore.getState();
    expect(s.cardType).toBe('stamp_card');
    expect(s.storeName).toBe('X');
    expect(s.barcodeType).toBe('pdf_417');
    expect(s.issuerLogo).toBe('k');
    expect(s.iconImage).toBe('i');
  });

  it('parses jsonb string before merging (Bug #8.5 legacy corruption)', () => {
    useCardBuilderStore.getState().loadSettings(
      '{"cardType":"stamp_card","storeName":"Y","issuerLogo":"z"}',
    );

    const s = useCardBuilderStore.getState();
    expect(s.cardType).toBe('stamp_card');
    expect(s.storeName).toBe('Y');
    expect(s.issuerLogo).toBe('z');
  });

  it('handles empty / null / undefined safely (returns {})', () => {
    useCardBuilderStore.getState().loadSettings({});
    expect(useCardBuilderStore.getState().cardType).toBeNull();

    // No state change for null/undefined (already cleared by beforeEach)
    useCardBuilderStore.getState().loadSettings(null);
    expect(useCardBuilderStore.getState().cardType).toBeNull();

    useCardBuilderStore.getState().loadSettings(undefined);
    expect(useCardBuilderStore.getState().cardType).toBeNull();
  });

  it('unwrapCardSettings — pure helper handles all defensive cases', () => {
    // Object passthrough
    expect(unwrapCardSettings({ a: 1 })).toEqual({ a: 1 });
    // String parse
    expect(unwrapCardSettings('{"a":2}')).toEqual({ a: 2 });
    // String parse failure → {}
    expect(unwrapCardSettings('not-json')).toEqual({});
    // Array of objects (reduce merge)
    expect(unwrapCardSettings([{ a: 1 }, { b: 2 }])).toEqual({ a: 1, b: 2 });
    // Array of strings (Bug #8.5 worst case)
    expect(unwrapCardSettings(['{"a":1}', '{"b":2}'])).toEqual({ a: 1, b: 2 });
    // null / undefined → {}
    expect(unwrapCardSettings(null)).toEqual({});
    expect(unwrapCardSettings(undefined)).toEqual({});
    // Nested array (recursion)
    expect(unwrapCardSettings([[{ a: 1 }], [{ b: 2 }]])).toEqual({ a: 1, b: 2 });
  });
});
