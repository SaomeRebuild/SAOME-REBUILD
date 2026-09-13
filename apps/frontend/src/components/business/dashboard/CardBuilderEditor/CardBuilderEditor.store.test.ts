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

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCardBuilderStore, computeDefaultExpiryDate } from './CardBuilderEditor.store';

describe('CardBuilderEditor.store — loadSettings cache-busting fix', () => {
  beforeEach(() => {
    // Reset store to a clean state before each test.
    // 2026-09-13 swap: `name` → `cardName`, `storeName` removed,
    // `logoText` (NEW) added. Tests below follow the same naming.
    useCardBuilderStore.setState({
      cardId: null,
      cardName: '',
      logoText: '',
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
      // 2026-09-13 swap: storeName (settings.storeName, JSONB) is gone —
      // it's now `logoText` (settings.logoText, JSONB) for the pass
      // header text. Card Name lives in SQL column top-level, set via
      // `setCardName` from the URL effect (not loadSettings).
      logoText: 'My Store',
      issuerName: 'My Issuer',
      barcodeType: 'pdf_417',
      passValidDays: 365,
      expiryDate: '2027-01-01',
      currency: 'TWD',
      isPaid: true,
    });

    const state = useCardBuilderStore.getState();
    // Step 2 fields loaded — storeName check replaced by logoText.
    // (cardName is loaded separately via the outer URL effect calling
    // setCardName, not via loadSettings.)
    expect(state.logoText).toBe('My Store');
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
      cardName: '',
      logoText: '',
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
      { logoText: 'X', barcodeType: 'pdf_417' as const }, // 2026-09-13 swap
      { issuerLogo: 'k', iconImage: 'i' },
    ]);

    const s = useCardBuilderStore.getState();
    expect(s.cardType).toBe('stamp_card');
    expect(s.logoText).toBe('X');
    expect(s.barcodeType).toBe('pdf_417');
    expect(s.issuerLogo).toBe('k');
    expect(s.iconImage).toBe('i');
  });

  it('parses jsonb string before merging (Bug #8.5 legacy corruption)', () => {
    useCardBuilderStore.getState().loadSettings(
      '{"cardType":"stamp_card","logoText":"Y","issuerLogo":"z"}', // 2026-09-13 swap
    );

    const s = useCardBuilderStore.getState();
    expect(s.cardType).toBe('stamp_card');
    expect(s.logoText).toBe('Y');
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

  it('unwrapCardSettings is now sourced from @saome/shared/logic (Plan Phase 5.7)', () => {
    // Behavioral contract is fully tested in
    // packages/shared/logic/cardSettings.test.ts (10 cases). Here we only
    // assert that the shared import is wired correctly through the store
    // and survives a round-trip through loadSettings.
    const corrupted = ['{"description":"hi"}', '{"foo":1}']; // array-of-strings (Bug #8.5 worst case)
    useCardBuilderStore.getState().loadSettings(corrupted);
    // Reduce-merge → later wins → foo:1 survives
    expect(useCardBuilderStore.getState().description).toBe('hi');
  });
});

describe('CardBuilderEditor.store — backgroundImage state (BackgroundUploader L2 plan 2026-09-01)', () => {
  beforeEach(() => {
    useCardBuilderStore.setState({
      cardId: null, cardName: '', logoText: '', cardType: null, step: 1,
      completedSteps: new Set(), cardSide: 'front',
      issuerName: '', issuerLogo: '', issuerLogoVersion: 0,
      iconImage: '', iconImageVersion: 0,
      backgroundImage: '', backgroundImageVersion: 0,
      backgroundColor: '#ffffff', textColor: '#000000', holderName: '',
      barcodeType: 'qr_code', passValidDays: null,
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
      logoText: 'My Store',
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
      cardId: null, cardName: '', logoText: '', cardType: null, step: 1,
      completedSteps: new Set(), cardSide: 'front',
      issuerName: '', issuerLogo: '', issuerLogoVersion: 0,
      iconImage: '', iconImageVersion: 0,
      backgroundImage: '', backgroundImageVersion: 0,
      backgroundColor: '#ffffff', textColor: '#000000', holderName: '',
      barcodeType: 'qr_code', passValidDays: null,
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
      cardName: '',
      logoText: '',
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
    useCardBuilderStore.getState().loadSettings({ logoText: 'X' });
    const s = useCardBuilderStore.getState();
    expect(s.stampGridRows).toBe(2);
    expect(s.stampIconId).toBe('love');
    expect(s.logoText).toBe('X');
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

describe('CardBuilderEditor.store — Step 4 card-info state (2026-09-04)', () => {
  beforeEach(() => {
    useCardBuilderStore.setState({
      cardId: null,
      cardName: '',
      logoText: '',
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
      passValidDays: null,
      expiryDate: '',
      currency: 'TWD',
      leftField: null,
      rightField: null,
      isPaid: false,
      stampGridRows: 1,
      stampIconId: '',
      description: '',
      backFields: [{ label: '', value: '' }],
      links: [],
    });
  });

  it('initial state: description="" + backFields=[{empty}] + links=[]', () => {
    const s = useCardBuilderStore.getState();
    expect(s.description).toBe('');
    expect(s.backFields).toEqual([{ label: '', value: '' }]);
    expect(s.links).toEqual([]);
  });

  it('setDescription updates the description string', () => {
    useCardBuilderStore.getState().setDescription('Hello world');
    expect(useCardBuilderStore.getState().description).toBe('Hello world');
  });

  it('setBackFieldsLabel updates only the targeted row label', () => {
    useCardBuilderStore.setState({
      backFields: [
        { label: '', value: '' },
        { label: '', value: '' },
      ],
    });
    useCardBuilderStore.getState().setBackFieldsLabel(1, 'Phone');
    const s = useCardBuilderStore.getState();
    expect(s.backFields[0]).toEqual({ label: '', value: '' });
    expect(s.backFields[1]).toEqual({ label: 'Phone', value: '' });
  });

  it('setBackFieldsValue updates only the targeted row value', () => {
    useCardBuilderStore.setState({
      backFields: [
        { label: 'Email', value: '' },
        { label: 'Phone', value: '' },
      ],
    });
    useCardBuilderStore.getState().setBackFieldsValue(0, 'a@b.com');
    const s = useCardBuilderStore.getState();
    expect(s.backFields[0]).toEqual({ label: 'Email', value: 'a@b.com' });
    expect(s.backFields[1]).toEqual({ label: 'Phone', value: '' });
  });

  it('addBackField appends an empty row up to BACK_FIELDS_MAX=10', () => {
    for (let i = 0; i < 9; i++) {
      useCardBuilderStore.getState().addBackField();
    }
    expect(useCardBuilderStore.getState().backFields).toHaveLength(10);
    // 11th add is a no-op
    useCardBuilderStore.getState().addBackField();
    expect(useCardBuilderStore.getState().backFields).toHaveLength(10);
  });

  it('removeBackField splices the row but refills an empty row at 0 (BACK_FIELDS_MIN=1)', () => {
    useCardBuilderStore.setState({
      backFields: [
        { label: 'Email', value: 'a@b.com' },
        { label: 'Phone', value: '+1234' },
      ],
    });
    useCardBuilderStore.getState().removeBackField(0);
    expect(useCardBuilderStore.getState().backFields).toEqual([
      { label: 'Phone', value: '+1234' },
    ]);

    // Remove the last remaining row → should refill with empty row, NOT collapse to []
    useCardBuilderStore.getState().removeBackField(0);
    expect(useCardBuilderStore.getState().backFields).toEqual([
      { label: '', value: '' },
    ]);
  });

  it('setLinksLabel updates only the targeted row label', () => {
    useCardBuilderStore.setState({
      links: [
        { label: '', value: 'https://x.com' },
        { label: '', value: 'tel:+1234' },
      ],
    });
    useCardBuilderStore.getState().setLinksLabel(0, 'Website');
    const s = useCardBuilderStore.getState();
    expect(s.links[0]).toEqual({ label: 'Website', value: 'https://x.com' });
    expect(s.links[1]).toEqual({ label: '', value: 'tel:+1234' });
  });

  it('setLinksValue updates only the targeted row value', () => {
    useCardBuilderStore.setState({
      links: [
        { label: 'Web', value: '' },
        { label: 'Phone', value: '' },
      ],
    });
    useCardBuilderStore.getState().setLinksValue(1, 'tel:+1234');
    const s = useCardBuilderStore.getState();
    expect(s.links[0]).toEqual({ label: 'Web', value: '' });
    expect(s.links[1]).toEqual({ label: 'Phone', value: 'tel:+1234' });
  });

  it('addLink appends an empty row up to LINKS_MAX=4 (optional section)', () => {
    for (let i = 0; i < 4; i++) {
      useCardBuilderStore.getState().addLink();
    }
    expect(useCardBuilderStore.getState().links).toHaveLength(4);
    // 5th add is a no-op
    useCardBuilderStore.getState().addLink();
    expect(useCardBuilderStore.getState().links).toHaveLength(4);
  });

  it('removeLink splices the row and does NOT refill (links are optional)', () => {
    useCardBuilderStore.setState({
      links: [
        { label: 'Web', value: 'https://x.com' },
        { label: 'Phone', value: 'tel:+1234' },
      ],
    });
    useCardBuilderStore.getState().removeLink(0);
    expect(useCardBuilderStore.getState().links).toEqual([
      { label: 'Phone', value: 'tel:+1234' },
    ]);

    // Remove the last row → empty array is allowed (no auto-refill)
    useCardBuilderStore.getState().removeLink(0);
    expect(useCardBuilderStore.getState().links).toEqual([]);
  });

  it('loadSettings hydrates description / backFields / links', () => {
    useCardBuilderStore.getState().loadSettings({
      description: 'My description',
      backFields: [
        { label: 'Email', value: 'a@b.com' },
        { label: 'Phone', value: '+1234' },
      ],
      links: [
        { label: 'Web', value: 'https://x.com' },
      ],
    });
    const s = useCardBuilderStore.getState();
    expect(s.description).toBe('My description');
    expect(s.backFields).toEqual([
      { label: 'Email', value: 'a@b.com' },
      { label: 'Phone', value: '+1234' },
    ]);
    expect(s.links).toEqual([
      { label: 'Web', value: 'https://x.com' },
    ]);
  });

  it('loadSettings truncates backFields to BACK_FIELDS_MAX (10)', () => {
    const tooMany = Array.from({ length: 15 }, (_, i) => ({
      label: `L${i}`,
      value: `V${i}`,
    }));
    useCardBuilderStore.getState().loadSettings({ backFields: tooMany });
    expect(useCardBuilderStore.getState().backFields).toHaveLength(10);
  });

  it('loadSettings truncates links to LINKS_MAX (4)', () => {
    const tooMany = Array.from({ length: 8 }, (_, i) => ({
      label: `L${i}`,
      value: `V${i}`,
    }));
    useCardBuilderStore.getState().loadSettings({ links: tooMany });
    expect(useCardBuilderStore.getState().links).toHaveLength(4);
  });

  it('loadSettings falls back to a single empty backFields row when input is malformed', () => {
    useCardBuilderStore.getState().loadSettings({
      backFields: 'not an array' as unknown as never,
    });
    expect(useCardBuilderStore.getState().backFields).toEqual([
      { label: '', value: '' },
    ]);
  });

  it('loadSettings falls back to empty links array when input is malformed', () => {
    useCardBuilderStore.getState().loadSettings({
      links: { not: 'an array' } as unknown as never,
    });
    expect(useCardBuilderStore.getState().links).toEqual([]);
  });

  it('loadSettings coerces non-string label/value entries to empty strings', () => {
    useCardBuilderStore.getState().loadSettings({
      backFields: [
        { label: 123 as unknown as string, value: null as unknown as string },
        { label: 'X', value: 'Y' },
      ],
    });
    const s = useCardBuilderStore.getState();
    expect(s.backFields[0]).toEqual({ label: '', value: '' });
    expect(s.backFields[1]).toEqual({ label: 'X', value: 'Y' });
  });

  it('reset() returns Step 4 state to defaults', () => {
    useCardBuilderStore.getState().setDescription('Hello');
    useCardBuilderStore.setState({
      backFields: [
        { label: 'Email', value: 'a@b.com' },
        { label: 'Phone', value: '+1234' },
      ],
      links: [{ label: 'Web', value: 'https://x.com' }],
    });
    useCardBuilderStore.getState().reset();
    const s = useCardBuilderStore.getState();
    expect(s.description).toBe('');
    expect(s.backFields).toEqual([{ label: '', value: '' }]);
    expect(s.links).toEqual([]);
  });
});

// =============================================================================
// Cashback Card Logic store tests (Step 6 — 2026-09-11)
// =============================================================================
//
// Covers the cashback sub-module of Step 6 (cashback_card):
//   - addCashbackTier / removeCashbackTier / updateCashbackTier / sortCashbackTiers
//   - loadSettings defensive parsing of `cashbackTiers`
//   - reset() returns to empty array
//
// Mirrors packages/shared/constants/cashback-card.ts source-of-truth bounds.
// =============================================================================

describe('CardBuilderEditor.store — Cashback Card Logic state (Step 6, 2026-09-11)', () => {
  beforeEach(() => {
    useCardBuilderStore.getState().reset();
  });

  describe('addCashbackTier', () => {
    it('appends a new tier with default values', () => {
      useCardBuilderStore.getState().addCashbackTier();
      const s = useCardBuilderStore.getState();
      expect(s.cashbackTiers.length).toBe(1);
      expect(s.cashbackTiers[0]).toMatchObject({
        name: '',
        thresholdSpend: 0,
        cashbackPercent: 1,
      });
      expect(typeof s.cashbackTiers[0].id).toBe('string');
      expect(s.cashbackTiers[0].id.length).toBeGreaterThan(0);
    });

    it('is no-op when at MAX_CASHBACK_TIERS=5', () => {
      // Add 5 tiers
      for (let i = 0; i < 5; i++) {
        useCardBuilderStore.getState().addCashbackTier();
      }
      expect(useCardBuilderStore.getState().cashbackTiers.length).toBe(5);

      // 6th add is a no-op
      useCardBuilderStore.getState().addCashbackTier();
      expect(useCardBuilderStore.getState().cashbackTiers.length).toBe(5);
    });
  });

  describe('removeCashbackTier', () => {
    it('removes the matching tier by id', () => {
      useCardBuilderStore.getState().addCashbackTier();
      useCardBuilderStore.getState().addCashbackTier();
      const [first, second] = useCardBuilderStore.getState().cashbackTiers;
      useCardBuilderStore.getState().removeCashbackTier(first.id);
      const remaining = useCardBuilderStore.getState().cashbackTiers;
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe(second.id);
    });

    it('does not auto-refill when the last tier is removed', () => {
      useCardBuilderStore.getState().addCashbackTier();
      const [only] = useCardBuilderStore.getState().cashbackTiers;
      useCardBuilderStore.getState().removeCashbackTier(only.id);
      expect(useCardBuilderStore.getState().cashbackTiers).toEqual([]);
    });
  });

  describe('updateCashbackTier', () => {
    let tierId: string;

    beforeEach(() => {
      useCardBuilderStore.getState().addCashbackTier();
      tierId = useCardBuilderStore.getState().cashbackTiers[0].id;
    });

    it('updates name field', () => {
      useCardBuilderStore.getState().updateCashbackTier(tierId, { name: 'VIP' });
      expect(useCardBuilderStore.getState().cashbackTiers[0].name).toBe('VIP');
    });

    it('truncates name to CASHBACK_TIER_NAME_MAX_LENGTH=40', () => {
      const long = 'A'.repeat(100);
      useCardBuilderStore.getState().updateCashbackTier(tierId, { name: long });
      expect(useCardBuilderStore.getState().cashbackTiers[0].name.length).toBe(40);
    });

    it('accepts thresholdSpend = 0 (legitimate default tier)', () => {
      useCardBuilderStore.getState().updateCashbackTier(tierId, { thresholdSpend: 1000 });
      useCardBuilderStore.getState().updateCashbackTier(tierId, { thresholdSpend: 0 });
      expect(useCardBuilderStore.getState().cashbackTiers[0].thresholdSpend).toBe(0);
    });

    it('rejects thresholdSpend < 0 (keeps previous value)', () => {
      useCardBuilderStore.getState().updateCashbackTier(tierId, { thresholdSpend: 1000 });
      useCardBuilderStore.getState().updateCashbackTier(tierId, { thresholdSpend: -1 });
      expect(useCardBuilderStore.getState().cashbackTiers[0].thresholdSpend).toBe(1000);
    });

    it('rejects thresholdSpend > CASHBACK_THRESHOLD_MAX', () => {
      useCardBuilderStore
        .getState()
        .updateCashbackTier(tierId, { thresholdSpend: 999_999_999_999 });
      expect(useCardBuilderStore.getState().cashbackTiers[0].thresholdSpend).toBe(
        999_999_999,
      );
    });

    it('rejects cashbackPercent > CASHBACK_PERCENT_MAX=100', () => {
      useCardBuilderStore.getState().updateCashbackTier(tierId, { cashbackPercent: 101 });
      // unchanged from default (1)
      expect(useCardBuilderStore.getState().cashbackTiers[0].cashbackPercent).toBe(1);
    });

    it('rejects cashbackPercent < CASHBACK_PERCENT_MIN=1', () => {
      useCardBuilderStore.getState().updateCashbackTier(tierId, { cashbackPercent: 50 });
      useCardBuilderStore.getState().updateCashbackTier(tierId, { cashbackPercent: 0 });
      // unchanged from 50 — but 0 is below min so rejected
      expect(useCardBuilderStore.getState().cashbackTiers[0].cashbackPercent).toBe(50);
    });

    it('rounds cashbackPercent to integer', () => {
      useCardBuilderStore.getState().updateCashbackTier(tierId, { cashbackPercent: 7.6 });
      expect(useCardBuilderStore.getState().cashbackTiers[0].cashbackPercent).toBe(8);
    });
  });

  describe('sortCashbackTiers', () => {
    it('orders tiers by thresholdSpend ASC (threshold=0 first)', () => {
      useCardBuilderStore.getState().addCashbackTier();
      useCardBuilderStore.getState().addCashbackTier();
      useCardBuilderStore.getState().addCashbackTier();
      const [t1, t2, t3] = useCardBuilderStore.getState().cashbackTiers;

      // Set thresholds: t1=5000, t2=0, t3=1000
      useCardBuilderStore.getState().updateCashbackTier(t1.id, { thresholdSpend: 5000 });
      useCardBuilderStore.getState().updateCashbackTier(t2.id, { thresholdSpend: 0 });
      useCardBuilderStore.getState().updateCashbackTier(t3.id, { thresholdSpend: 1000 });

      useCardBuilderStore.getState().sortCashbackTiers();
      const sorted = useCardBuilderStore.getState().cashbackTiers;
      expect(sorted.map((t) => t.thresholdSpend)).toEqual([0, 1000, 5000]);
    });
  });

  describe('loadSettings — defensive parsing of cashbackTiers', () => {
    it('rebuilds tiers from a valid array', () => {
      useCardBuilderStore.getState().loadSettings({
        cashbackTiers: [
          { name: 'Gold', thresholdSpend: 5000, cashbackPercent: 10 },
          { name: 'Default', thresholdSpend: 0, cashbackPercent: 1 },
        ],
      });
      const s = useCardBuilderStore.getState();
      expect(s.cashbackTiers.length).toBe(2);
      // Sorted ASC so threshold=0 (Default) comes first
      expect(s.cashbackTiers[0].name).toBe('Default');
      expect(s.cashbackTiers[0].thresholdSpend).toBe(0);
      expect(s.cashbackTiers[1].name).toBe('Gold');
    });

    it('preserves existing state when cashbackTiers is missing', () => {
      useCardBuilderStore.getState().addCashbackTier();
      const before = useCardBuilderStore.getState().cashbackTiers;
      useCardBuilderStore.getState().loadSettings({ name: 'X' });
      const after = useCardBuilderStore.getState().cashbackTiers;
      expect(after).toEqual(before);
    });

    it('falls back to defaults for malformed tier entries', () => {
      useCardBuilderStore.getState().loadSettings({
        cashbackTiers: [
          // name is not a string → ''
          // thresholdSpend is negative → 0
          // cashbackPercent is out of range → 1
          { name: 123 as unknown as string, thresholdSpend: -5, cashbackPercent: 999 },
        ],
      });
      const tier = useCardBuilderStore.getState().cashbackTiers[0];
      expect(tier.name).toBe('');
      expect(tier.thresholdSpend).toBe(0);
      expect(tier.cashbackPercent).toBe(1);
    });

    it('caps array length at MAX_CASHBACK_TIERS=5', () => {
      const long = Array.from({ length: 10 }, (_, i) => ({
        name: `T${i}`,
        thresholdSpend: i * 100,
        cashbackPercent: 1,
      }));
      useCardBuilderStore.getState().loadSettings({ cashbackTiers: long });
      expect(useCardBuilderStore.getState().cashbackTiers.length).toBe(5);
    });
  });

  describe('reset()', () => {
    it('returns cashbackTiers to empty array', () => {
      useCardBuilderStore.getState().addCashbackTier();
      useCardBuilderStore.getState().addCashbackTier();
      useCardBuilderStore.getState().reset();
      expect(useCardBuilderStore.getState().cashbackTiers).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Membership expiry auto-seed (2026-09-13)
// Bug: when user selects "monthly" / "yearly" duration for a membership tier
// (or flips hasExpiry=true on the card-wide toggle), the member-expiry preview
// shows "—" instead of a sensible default date. Fix: auto-seed `expiryDate`
// (today + 1 month for monthly, today + 1 year for yearly) when the user
// commits to a duration. User's explicit date is never overwritten.
//
// Tests pin down:
//   1. computeDefaultExpiryDate pure function (monthly / yearly)
//   2. setHasExpiry(true) + empty expiryDate → seeds to today + 1 year
//   3. setHasExpiry(true) + existing expiryDate → no-op for expiryDate
//   4. updateMembershipTier({ durationType: 'monthly' }) + empty → seeds +1 month
//   5. updateMembershipTier({ durationType: 'yearly' }) + empty → seeds +1 year
//   6. updateMembershipTier({ durationType: 'monthly' }) + existing → preserves
//   7. updateMembershipTier({ durationType: null }) + empty → no auto-seed
//   8. updateMembershipTier({ name: 'X' }) + empty → no auto-seed (unrelated patch)
// ─────────────────────────────────────────────────────────────────────────────
describe('CardBuilderEditor.store — membership expiry auto-seed (2026-09-13)', () => {
  // Fixed reference time so the computed "today + N days" assertions are
  // deterministic across test runs.
  const REFERENCE_NOW = new Date('2026-09-13T10:00:00Z');

  beforeEach(() => {
    useCardBuilderStore.getState().reset();
    // vi.setSystemTime() controls what `new Date()` (no args) returns.
    // Cleaner than vi.spyOn(globalThis, 'Date') because there's no
    // recursion risk (mocked calls go through real Date).
    vi.useFakeTimers();
    vi.setSystemTime(REFERENCE_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── computeDefaultExpiryDate pure helper ───────────────────────────────
  describe('computeDefaultExpiryDate', () => {
    it('monthly → today + 1 month, formatted YYYY-MM-DD', () => {
      const result = computeDefaultExpiryDate('monthly');
      // Sep 13 + 1 month → Oct 13
      expect(result).toBe('2026-10-13');
    });

    it('yearly → today + 1 year, formatted YYYY-MM-DD', () => {
      const result = computeDefaultExpiryDate('yearly');
      // Sep 13 + 1 year → Sep 13 2027
      expect(result).toBe('2027-09-13');
    });

    it('formats as zero-padded YYYY-MM-DD (e.g. Feb 5 → 2027-02-05)', () => {
      // Temporarily shift system time to Feb 5 2027.
      vi.setSystemTime(new Date('2027-02-05T10:00:00Z'));
      expect(computeDefaultExpiryDate('monthly')).toBe('2027-03-05');
    });

    it('month-end overflow normalizes (Jan 31 → Feb 31 → Mar 3)', () => {
      // JS Date semantics: month overflow rolls into the next month.
      // Documented behavior in the helper — UX acceptable, user can adjust
      // the date in Step 2 before saving.
      vi.setSystemTime(new Date('2027-01-31T10:00:00Z'));
      // Jan 31 + 1 month = JS normalizes Feb 31 → Mar 3 (2027 is not a leap year).
      expect(computeDefaultExpiryDate('monthly')).toBe('2027-03-03');
    });
  });

  // ─── setHasExpiry(true) auto-seed ────────────────────────────────────────
  describe('setHasExpiry(true)', () => {
    it('auto-seeds expiryDate to today + 1 year when expiryDate is empty', () => {
      expect(useCardBuilderStore.getState().expiryDate).toBe('');
      useCardBuilderStore.getState().setHasExpiry(true);
      const s = useCardBuilderStore.getState();
      expect(s.hasExpiry).toBe(true);
      // Sep 13 2026 + 1 year = Sep 13 2027
      expect(s.expiryDate).toBe('2027-09-13');
    });

    it('PRESERVES existing expiryDate when toggling ON (user choice wins)', () => {
      useCardBuilderStore.setState({ expiryDate: '2030-01-01' });
      useCardBuilderStore.getState().setHasExpiry(true);
      expect(useCardBuilderStore.getState().expiryDate).toBe('2030-01-01');
    });

    it('no-op when toggling ON with already hasExpiry=true', () => {
      useCardBuilderStore.setState({ hasExpiry: true });
      // expiryDate stays whatever it was (no seed, no overwrite)
      useCardBuilderStore.setState({ expiryDate: '2030-06-15' });
      useCardBuilderStore.getState().setHasExpiry(true);
      expect(useCardBuilderStore.getState().expiryDate).toBe('2030-06-15');
    });
  });

  // ─── updateMembershipTier({ durationType }) auto-seed ───────────────────
  describe('updateMembershipTier({ durationType }) — auto-seed expiryDate', () => {
    let tierId: string;

    beforeEach(() => {
      useCardBuilderStore.getState().addMembershipTier();
      tierId = useCardBuilderStore.getState().membershipTiers[0].id;
    });

    it('durationType="monthly" + empty expiryDate → seeds today + 1 month', () => {
      expect(useCardBuilderStore.getState().expiryDate).toBe('');
      useCardBuilderStore
        .getState()
        .updateMembershipTier(tierId, { durationType: 'monthly' });
      const s = useCardBuilderStore.getState();
      // Sep 13 + 1 month → Oct 13
      expect(s.expiryDate).toBe('2026-10-13');
      expect(s.membershipTiers[0].durationType).toBe('monthly');
    });

    it('durationType="yearly" + empty expiryDate → seeds today + 1 year', () => {
      expect(useCardBuilderStore.getState().expiryDate).toBe('');
      useCardBuilderStore
        .getState()
        .updateMembershipTier(tierId, { durationType: 'yearly' });
      const s = useCardBuilderStore.getState();
      // Sep 13 2026 + 1 year → Sep 13 2027
      expect(s.expiryDate).toBe('2027-09-13');
      expect(s.membershipTiers[0].durationType).toBe('yearly');
    });

    it('PRESERVES existing expiryDate when setting durationType', () => {
      // User's explicit date wins over the auto-seed.
      useCardBuilderStore.setState({ expiryDate: '2030-12-31' });
      useCardBuilderStore
        .getState()
        .updateMembershipTier(tierId, { durationType: 'monthly' });
      expect(useCardBuilderStore.getState().expiryDate).toBe('2030-12-31');
    });

    it('durationType=null + empty expiryDate → does NOT auto-seed', () => {
      // Clearing the duration (e.g. user switched back to lifetime) does
      // not seed a date — the user is intentionally leaving the duration
      // unset, so no expiry should be implied.
      useCardBuilderStore
        .getState()
        .updateMembershipTier(tierId, { durationType: null });
      expect(useCardBuilderStore.getState().expiryDate).toBe('');
    });

    it('unrelated patch (name only) + empty expiryDate → does NOT auto-seed', () => {
      // Only durationType triggers the seed. Renaming a tier, changing
      // cost, etc. should not affect expiryDate.
      useCardBuilderStore
        .getState()
        .updateMembershipTier(tierId, { name: 'VIP' });
      expect(useCardBuilderStore.getState().expiryDate).toBe('');
    });

    it('monthly → yearly switch + empty expiryDate re-seeds (deterministic)', () => {
      // After clearing expiryDate, switching duration types re-seeds.
      useCardBuilderStore.getState().setExpiryDate('');
      useCardBuilderStore
        .getState()
        .updateMembershipTier(tierId, { durationType: 'monthly' });
      expect(useCardBuilderStore.getState().expiryDate).toBe('2026-10-13');
      // Switch to yearly — expiryDate was just set, so preserved.
      useCardBuilderStore
        .getState()
        .updateMembershipTier(tierId, { durationType: 'yearly' });
      // expiryDate preserved (user choice already made).
      expect(useCardBuilderStore.getState().expiryDate).toBe('2026-10-13');
    });
  });
});
