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
      backgroundImage: '',
      backgroundImageVersion: 0,
      backgroundColor: '#ffffff',
      textColor: '#000000',
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
      backgroundImage: '',
      backgroundImageVersion: 0,
      backgroundColor: '#ffffff',
      textColor: '#000000',
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

describe('CardBuilderEditor.store — backgroundImage state (BackgroundUploader L2 plan 2026-09-01)', () => {
  beforeEach(() => {
    useCardBuilderStore.setState({
      cardId: null, name: '', cardType: null, step: 1,
      completedSteps: new Set(), cardSide: 'front',
      issuerName: '', issuerLogo: '', issuerLogoVersion: 0,
      iconImage: '', iconImageVersion: 0,
      backgroundImage: '', backgroundImageVersion: 0,
      backgroundColor: '#ffffff', textColor: '#000000', holderName: '',
      barcodeType: 'qr_code', storeName: '', passValidDays: null,
      expiryDate: '', currency: 'TWD', isPaid: false,
    });
  });

  it('bumps backgroundImageVersion when loading a new backgroundImage key from settings', () => {
    expect(useCardBuilderStore.getState().backgroundImageVersion).toBe(0);
    const before = Date.now();
    useCardBuilderStore.getState().loadSettings({
      backgroundImage: 'tenant-1/template-1/background.png',
    });
    const after = Date.now();
    const state = useCardBuilderStore.getState();
    expect(state.backgroundImage).toBe('tenant-1/template-1/background.png');
    expect(state.backgroundImageVersion).toBeGreaterThanOrEqual(before);
    expect(state.backgroundImageVersion).toBeLessThanOrEqual(after);
  });

  it('does NOT bump version when the loaded key is the same as the current one (idempotent resume)', () => {
    useCardBuilderStore.setState({
      backgroundImage: 'tenant-1/template-1/background.png',
      backgroundImageVersion: 12345,
    });
    useCardBuilderStore.getState().loadSettings({
      backgroundImage: 'tenant-1/template-1/background.png',
    });
    expect(useCardBuilderStore.getState().backgroundImageVersion).toBe(12345);
  });

  it('setBackgroundImage bumps backgroundImageVersion to Date.now()', () => {
    const before = Date.now();
    useCardBuilderStore.getState().setBackgroundImage('tenant-1/template-1/background.png');
    const after = Date.now();
    const state = useCardBuilderStore.getState();
    expect(state.backgroundImage).toBe('tenant-1/template-1/background.png');
    expect(state.backgroundImageVersion).toBeGreaterThanOrEqual(before);
    expect(state.backgroundImageVersion).toBeLessThanOrEqual(after);
  });

  it('handles combined loadSettings (backgroundImage + logo + icon + step2 fields) without losing versions', () => {
    useCardBuilderStore.getState().loadSettings({
      issuerLogo: 'tenant-1/template-1/issuer-logo.png',
      iconImage: 'tenant-1/template-1/icon.png',
      backgroundImage: 'tenant-1/template-1/background.png',
      storeName: 'My Store',
      issuerName: 'My Issuer',
    });
    const state = useCardBuilderStore.getState();
    expect(state.issuerLogo).toBe('tenant-1/template-1/issuer-logo.png');
    expect(state.iconImage).toBe('tenant-1/template-1/icon.png');
    expect(state.backgroundImage).toBe('tenant-1/template-1/background.png');
    expect(state.backgroundImageVersion).toBeGreaterThan(0);
    expect(state.issuerLogoVersion).toBeGreaterThan(0);
    expect(state.iconImageVersion).toBeGreaterThan(0);
  });
});

describe('CardBuilderEditor.store — backgroundColor / textColor round-trip (Step 3 Color Picker 2026-09-03)', () => {
  beforeEach(() => {
    useCardBuilderStore.setState({
      cardId: null, name: '', cardType: null, step: 1,
      completedSteps: new Set(), cardSide: 'front',
      issuerName: '', issuerLogo: '', issuerLogoVersion: 0,
      iconImage: '', iconImageVersion: 0,
      backgroundImage: '', backgroundImageVersion: 0,
      backgroundColor: '#ffffff', textColor: '#000000', holderName: '',
      barcodeType: 'qr_code', storeName: '', passValidDays: null,
      expiryDate: '', currency: 'TWD', isPaid: false,
    });
  });

  it('normalizes raw PassCreator hex (6-char uppercase, no #) into store internal format with #', () => {
    // DB stores 'F97316' (PassCreator format). Store must wrap to '#F97316'.
    useCardBuilderStore.getState().loadSettings({ backgroundColor: 'F97316' });
    expect(useCardBuilderStore.getState().backgroundColor).toBe('#F97316');
  });

  it('uppercases + wraps textColor from raw PassCreator format', () => {
    useCardBuilderStore.getState().loadSettings({ textColor: 'ffffff' });
    expect(useCardBuilderStore.getState().textColor).toBe('#FFFFFF');
  });

  it('falls back to current state value when loaded color is invalid', () => {
    useCardBuilderStore.setState({ backgroundColor: '#ABCDEF' });
    useCardBuilderStore.getState().loadSettings({ backgroundColor: 'not-a-color' });
    // Invalid input → fallback to previous state value
    expect(useCardBuilderStore.getState().backgroundColor).toBe('#ABCDEF');
  });

  it('handles both colors together in a single loadSettings call', () => {
    useCardBuilderStore.getState().loadSettings({
      backgroundColor: '22C55E',
      textColor: '0F172A',
    });
    expect(useCardBuilderStore.getState().backgroundColor).toBe('#22C55E');
    expect(useCardBuilderStore.getState().textColor).toBe('#0F172A');
  });

  it('falls back to default when raw is null/undefined (no existing state)', () => {
    // Already cleared by beforeEach — defaults are #ffffff / #000000
    useCardBuilderStore.getState().loadSettings({});
    expect(useCardBuilderStore.getState().backgroundColor).toBe('#ffffff');
    expect(useCardBuilderStore.getState().textColor).toBe('#000000');
  });
});

describe('CardBuilderEditor.store — stamp grid state (Stamp Grid feature 2026-09-04)', () => {
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
      backgroundImage: '',
      backgroundImageVersion: 0,
      backgroundColor: '#ffffff',
      textColor: '#000000',
      holderName: '',
      barcodeType: 'qr_code',
      storeName: '',
      passValidDays: null,
      expiryDate: '',
      currency: 'TWD',
      leftField: null,
      rightField: null,
      isPaid: false,
      stampGridRows: 1,
      stampIconId: '',
    });
  });

  it('initial state: stampGridRows=1 (smallest grid), stampIconId="" (no icon)', () => {
    const s = useCardBuilderStore.getState();
    expect(s.stampGridRows).toBe(1);
    expect(s.stampIconId).toBe('');
  });

  it('setStampGridRows updates rows (1, 2, 3, 4)', () => {
    const { setStampGridRows } = useCardBuilderStore.getState();
    setStampGridRows(2);
    expect(useCardBuilderStore.getState().stampGridRows).toBe(2);
    setStampGridRows(3);
    expect(useCardBuilderStore.getState().stampGridRows).toBe(3);
    setStampGridRows(4);
    expect(useCardBuilderStore.getState().stampGridRows).toBe(4);
    setStampGridRows(1);
    expect(useCardBuilderStore.getState().stampGridRows).toBe(1);
  });

  it('setStampIconId updates icon id', () => {
    useCardBuilderStore.getState().setStampIconId('bell');
    expect(useCardBuilderStore.getState().stampIconId).toBe('bell');
    useCardBuilderStore.getState().setStampIconId('fire');
    expect(useCardBuilderStore.getState().stampIconId).toBe('fire');
    useCardBuilderStore.getState().setStampIconId('');
    expect(useCardBuilderStore.getState().stampIconId).toBe('');
  });

  it('loadSettings hydrates stampGridRows + stampIconId', () => {
    useCardBuilderStore.getState().loadSettings({
      stampGridRows: 3,
      stampIconId: 'fire',
    });
    const s = useCardBuilderStore.getState();
    expect(s.stampGridRows).toBe(3);
    expect(s.stampIconId).toBe('fire');
  });

  it('loadSettings preserves current values when fields are absent', () => {
    useCardBuilderStore.setState({ stampGridRows: 2, stampIconId: 'love' });
    useCardBuilderStore.getState().loadSettings({ storeName: 'X' });
    const s = useCardBuilderStore.getState();
    expect(s.stampGridRows).toBe(2);
    expect(s.stampIconId).toBe('love');
    expect(s.storeName).toBe('X');
  });

  it('reset() returns stamp grid state to defaults', () => {
    useCardBuilderStore.getState().setStampGridRows(4);
    useCardBuilderStore.getState().setStampIconId('sun');
    useCardBuilderStore.getState().reset();
    const s = useCardBuilderStore.getState();
    expect(s.stampGridRows).toBe(1);
    expect(s.stampIconId).toBe('');
  });
});
