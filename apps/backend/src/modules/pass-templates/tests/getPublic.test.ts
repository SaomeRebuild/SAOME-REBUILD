/**
 * getPublicTemplate conformance + functional tests (no DB).
 *
 * @module modules/pass-templates/tests/getPublic
 *
 * Two layers of coverage:
 *   1. Schema conformance (Rule 019 § 3): the backend DTO
 *      `PublicPassTemplateDto` has the same field set as the shared
 *      `PublicPassTemplate`. If either side adds a field without updating
 *      the other, this test FAILS.
 *   2. Functional (no DB): the getPublicService field-projection logic
 *      handles `card_type = NULL` → 'reward_card' fallback, missing
 *      `settings.logoText` → `row.name` fallback, missing `issuerName`
 *      → '' fallback. All mocked at the db/templates.ts boundary.
 */

import { describe, it, expect, vi } from 'vitest';
import type { PublicTemplateRow } from '../db/templates';
import * as templatesDb from '../db/templates';
import { getPublicTemplateService } from '../services/getPublicService';
import type { PublicPassTemplateDto } from '@/shared/contracts/passTemplates';
import type { PublicPassTemplate } from '@saome/shared/types/passHolder';

/**
 * Schema conformance: PublicPassTemplateDto fields == PublicPassTemplate fields.
 *
 * Both types are hand-maintained mirrors (Layer 2 vs Layer 1 of Rule 019
 * § 4.1). Drift here = silent data shape mismatch between backend and
 * frontend. The conformance test pins the field set.
 */
describe('PublicPassTemplateDto schema conformance (Layer 1 vs Layer 2)', () => {
  // We compare shape via a sample object — TypeScript types are erased at
  // runtime, so we use the structural test pattern from Rule 019 § 3.
  // 'language' added 2026-10-01 (Q2): template-driven page i18n.
  // 2026-10-16 — paid-membership fields (`isPaid` / `membershipTiers` /
  //   `currency`) added as optional. They are CONDITIONALLY emitted by
  //   the service (only when `settings->>'isPaid'` is true) but the
  //   DTO type declares them as optional so the field set is stable.
  const EXPECTED_FIELDS = [
    'id',
    'name',
    'cardType',
    'logoText',
    'issuerName',
    'language',
    'issuerLogo',
    'backgroundColor',
    'textColor',
    'currency',
    'isPaid',
    'membershipTiers',
  ] as const;

  it('PublicPassTemplateDto has the expected fields', () => {
    // Sample instance — type-checker enforces the structural shape.
    // Set optional fields to `undefined` explicitly so `Object.keys()` includes
    // them in the enumeration (otherwise `Object.keys` skips un-set keys).
    const sample: PublicPassTemplateDto = {
      id: 'x',
      name: 'n',
      cardType: 'reward_card',
      logoText: 'lt',
      issuerName: 'in',
      language: 'en',
      issuerLogo: undefined,
      backgroundColor: undefined,
      textColor: undefined,
      // 2026-10-16 — paid-membership optional fields, set to undefined so
      // they appear in Object.keys() (the conformance test pins the full
      // field set; the service decides at runtime whether to emit them).
      currency: undefined,
      isPaid: undefined,
      membershipTiers: undefined,
    };
    const actual = Object.keys(sample).sort();
    const expected = [...EXPECTED_FIELDS].sort();
    expect(actual).toEqual(expected);
  });

  it('PublicPassTemplate (shared) has the expected fields', () => {
    // Sample instance for the shared type. Same trick as above.
    const sample: PublicPassTemplate = {
      id: 'x',
      name: 'n',
      cardType: 'reward_card',
      logoText: 'lt',
      issuerName: 'in',
      language: 'en',
      issuerLogo: undefined,
      backgroundColor: undefined,
      textColor: undefined,
      currency: undefined,
      isPaid: undefined,
      membershipTiers: undefined,
    };
    const actual = Object.keys(sample).sort();
    const expected = [...EXPECTED_FIELDS].sort();
    expect(actual).toEqual(expected);
  });

  it('the two types have identical field sets (no drift)', () => {
    // If PublicPassTemplate grows a field, this assertion fails and the
    // backend DTO MUST be updated to match (and vice versa).
    const dtoSample: PublicPassTemplateDto = {
      id: 'x',
      name: 'n',
      cardType: 'reward_card',
      logoText: 'lt',
      issuerName: 'in',
      language: 'en',
    };
    const sharedSample: PublicPassTemplate = {
      id: 'x',
      name: 'n',
      cardType: 'reward_card',
      logoText: 'lt',
      issuerName: 'in',
      language: 'en',
    };
    expect(Object.keys(dtoSample).sort()).toEqual(Object.keys(sharedSample).sort());
  });

  it('PublicPassTemplateDto does NOT include sensitive fields', () => {
    const sample: PublicPassTemplateDto = {
      id: 'x',
      name: 'n',
      cardType: 'reward_card',
      logoText: 'lt',
      issuerName: 'in',
      language: 'en',
    };
    expect(sample).not.toHaveProperty('tenant_id');
    expect(sample).not.toHaveProperty('status');
    expect(sample).not.toHaveProperty('settings');
    expect(sample).not.toHaveProperty('expires_at');
    expect(sample).not.toHaveProperty('created_by');
    expect(sample).not.toHaveProperty('updated_by');
  });
});

/**
 * Mock the SQL tag to satisfy the function signature. The actual SQL call
 * is mocked via vi.spyOn on the db module.
 */
function makeMockSql() {
  // We never call the SQL tag in these tests — they all mock the db layer.
  return {} as Parameters<typeof getPublicTemplateService>[0];
}

function stubFindPublicTemplateById(row: PublicTemplateRow | null) {
  vi.spyOn(templatesDb, 'findPublicTemplateById').mockResolvedValue(row);
}

const baseRow: PublicTemplateRow = {
  id: '716c4244-6c63-496d-a967-6c87cdac605d',
  name: 'Café Rewards',
  card_type: 'reward_card',
  settings: {
    logoText: 'Café 咖啡',
    issuerName: 'Café Rewards Co.',
    issuerLogo: 'https://picsum.photos/seed/saome-cafe/96',
    backgroundColor: '#0F0F23',
    textColor: '#F8FAFC',
    language: 'en',
  },
};

describe('getPublicTemplateService — field projection (v2)', () => {
  it('returns 200 with correct shape for a template whose card_type is set', async () => {
    stubFindPublicTemplateById(baseRow);
    const dto = await getPublicTemplateService(makeMockSql(), baseRow.id);
    expect(dto).toEqual({
      id: '716c4244-6c63-496d-a967-6c87cdac605d',
      name: 'Café Rewards',
      cardType: 'reward_card',
      logoText: 'Café 咖啡',
      issuerName: 'Café Rewards Co.',
      language: 'en',
      issuerLogo: 'https://picsum.photos/seed/saome-cafe/96',
      backgroundColor: '#0F0F23',
      textColor: '#F8FAFC',
    });
  });

  // ================================================================
  // Q2 (2026-10-01): settings.language → DTO.language projection
  // ================================================================

  it('Q2: projects settings.language to DTO.language', async () => {
    stubFindPublicTemplateById({
      ...baseRow,
      settings: { ...baseRow.settings, language: 'zh-TW' },
    });
    const dto = await getPublicTemplateService(makeMockSql(), baseRow.id);
    expect(dto?.language).toBe('zh-TW');
  });

  it('Q2: falls back to "en" when settings.language is missing (legacy rows)', async () => {
    stubFindPublicTemplateById({
      ...baseRow,
      // Legacy row predates the Q2 migration — no language field.
      settings: {
        logoText: baseRow.settings.logoText,
        issuerName: baseRow.settings.issuerName,
      },
    });
    const dto = await getPublicTemplateService(makeMockSql(), baseRow.id);
    expect(dto?.language).toBe('en');
  });

  it('Q2: falls back to "en" when settings itself is null (defensive)', async () => {
    stubFindPublicTemplateById({
      ...baseRow,
      settings: null as unknown as PublicTemplateRow['settings'],
    });
    const dto = await getPublicTemplateService(makeMockSql(), baseRow.id);
    expect(dto?.language).toBe('en');
  });

  it('returns null when the template does not exist (404 mapped by route layer)', async () => {
    stubFindPublicTemplateById(null);
    const dto = await getPublicTemplateService(makeMockSql(), 'does-not-exist');
    expect(dto).toBeNull();
  });

  it('falls back to reward_card when card_type is NULL', async () => {
    stubFindPublicTemplateById({
      ...baseRow,
      card_type: null,
    });
    const dto = await getPublicTemplateService(makeMockSql(), baseRow.id);
    expect(dto?.cardType).toBe('reward_card');
  });

  it('falls back to row.name when settings.logoText is missing', async () => {
    stubFindPublicTemplateById({
      ...baseRow,
      settings: { issuerName: 'x' },
    });
    const dto = await getPublicTemplateService(makeMockSql(), baseRow.id);
    expect(dto?.logoText).toBe(baseRow.name);
  });

  it('defaults issuerName to empty string when missing', async () => {
    stubFindPublicTemplateById({
      ...baseRow,
      settings: { logoText: 'lt' },
    });
    const dto = await getPublicTemplateService(makeMockSql(), baseRow.id);
    expect(dto?.issuerName).toBe('');
  });

  it('omits issuerLogo / backgroundColor / textColor when missing', async () => {
    stubFindPublicTemplateById({
      ...baseRow,
      settings: { logoText: 'lt', issuerName: 'in' },
    });
    const dto = await getPublicTemplateService(makeMockSql(), baseRow.id);
    expect(dto?.issuerLogo).toBeUndefined();
    expect(dto?.backgroundColor).toBeUndefined();
    expect(dto?.textColor).toBeUndefined();
  });

  it('handles settings being null/undefined gracefully (defensive)', async () => {
    stubFindPublicTemplateById({
      ...baseRow,
      // Postgres can return null for JSONB columns
      settings: null as unknown as PublicTemplateRow['settings'],
    });
    const dto = await getPublicTemplateService(makeMockSql(), baseRow.id);
    expect(dto?.logoText).toBe(baseRow.name);
    expect(dto?.issuerName).toBe('');
  });

  it('does NOT include tenant_id / status / settings (Decision 3 — tenant isolation)', async () => {
    stubFindPublicTemplateById(baseRow);
    const dto = await getPublicTemplateService(makeMockSql(), baseRow.id);
    expect(dto).not.toHaveProperty('tenant_id');
    expect(dto).not.toHaveProperty('status');
    expect(dto).not.toHaveProperty('settings');
    expect(dto).not.toHaveProperty('expires_at');
  });
});

// =============================================================================
// 2026-10-16 — paid-membership field projection (regression for the
// "membership tiers / payment buttons missing on the paid public page"
// bug). The frontend renders the picker ONLY when `isPaid === true` AND
// `membershipTiers.length > 0`. Backend MUST surface those fields when
// the underlying `settings->>'isPaid'` is true, else the page silently
// hides the tier UI.
// =============================================================================

const paidRow: PublicTemplateRow = {
  id: '738d9a5e-7f25-414b-b0d9-0c3abce8cf52',
  name: '搭哈哈',
  card_type: 'membership_card',
  settings: {
    logoText: '呼嚕嚕',
    issuerName: 'fdsgsdg',
    language: 'en',
    isPaid: true,
    currency: 'ZAR',
    membershipTiers: [
      {
        name: '嗯嗯',
        rewards: [{ label: 'ao6', value: 'huohoij' }],
        monthlyCost: 100,
        yearlyCost: null,
        durationType: 'monthly',
      },
      {
        name: '貴',
        rewards: [{ label: 'sadfasf', value: 'adsfasdf' }],
        monthlyCost: 200,
        yearlyCost: null,
        durationType: 'monthly',
      },
    ],
  },
  // SQL projection fields — what `findPublicTemplateById` returns after
  // applying `(settings->>'isPaid')::boolean` / `settings->'membershipTiers'`
  // / `settings->>'currency'`.
  is_paid: true,
  membership_tiers: [
    {
      name: '嗯嗯',
      rewards: [{ label: 'ao6', value: 'huohoij' }],
      monthlyCost: 100,
      yearlyCost: null,
      durationType: 'monthly',
    },
    {
      name: '貴',
      rewards: [{ label: 'sadfasf', value: 'adsfasdf' }],
      monthlyCost: 200,
      yearlyCost: null,
      durationType: 'monthly',
    },
  ],
  currency: 'ZAR',
};

describe('getPublicTemplateService — paid-membership projection (2026-10-16)', () => {
  it('projects isPaid / currency / membershipTiers when row.is_paid is true', async () => {
    stubFindPublicTemplateById(paidRow);
    const dto = await getPublicTemplateService(makeMockSql(), paidRow.id);
    expect(dto?.isPaid).toBe(true);
    expect(dto?.currency).toBe('ZAR');
    expect(dto?.membershipTiers).toHaveLength(2);
    expect(dto?.membershipTiers?.[0]).toMatchObject({
      name: '嗯嗯',
      monthlyCost: 100,
      yearlyCost: null,
      durationType: 'monthly',
    });
    expect(dto?.membershipTiers?.[0]?.rewards).toEqual([
      { label: 'ao6', value: 'huohoij' },
    ]);
  });

  it('OMITS isPaid / currency / membershipTiers when row.is_paid is false (or missing)', async () => {
    stubFindPublicTemplateById(baseRow);
    const dto = await getPublicTemplateService(makeMockSql(), baseRow.id);
    expect(dto?.isPaid).toBeUndefined();
    expect(dto?.currency).toBeUndefined();
    expect(dto?.membershipTiers).toBeUndefined();
  });

  it('OMITS paid fields when row.is_paid is false even if settings has membershipTiers', async () => {
    // Defensive: a non-paid template with stray membershipTiers in
    // settings MUST NOT trigger the paid UI — only `is_paid = true` does.
    stubFindPublicTemplateById({
      ...baseRow,
      is_paid: false,
      membership_tiers: [
        {
          name: 'stale',
          rewards: [],
          monthlyCost: 0,
          yearlyCost: null,
          durationType: 'monthly',
        },
      ],
    });
    const dto = await getPublicTemplateService(makeMockSql(), baseRow.id);
    expect(dto?.isPaid).toBeUndefined();
    expect(dto?.membershipTiers).toBeUndefined();
  });

  it('defaults currency to TWD when row.currency is null (legacy paid templates)', async () => {
    stubFindPublicTemplateById({
      ...paidRow,
      currency: undefined,
    });
    const dto = await getPublicTemplateService(makeMockSql(), paidRow.id);
    expect(dto?.currency).toBe('TWD');
  });

  it('returns empty membershipTiers when raw JSONB is null / non-array (defensive)', async () => {
    stubFindPublicTemplateById({
      ...paidRow,
      membership_tiers: null,
    });
    const dto = await getPublicTemplateService(makeMockSql(), paidRow.id);
    expect(dto?.isPaid).toBe(true);
    expect(dto?.membershipTiers).toEqual([]);
  });

  it('normalizes malformed tier rows (drops tiers with empty name)', async () => {
    stubFindPublicTemplateById({
      ...paidRow,
      membership_tiers: [
        // valid
        { name: 'Basic', rewards: [], monthlyCost: 100, yearlyCost: null, durationType: 'monthly' },
        // missing name → dropped
        { name: '', rewards: [], monthlyCost: 0, yearlyCost: null, durationType: 'monthly' },
        // not an object → dropped
        null,
        // non-string monthlyCost → normalized to null
        { name: 'Pro', rewards: [], monthlyCost: 'abc', yearlyCost: null, durationType: 'monthly' },
      ],
    });
    const dto = await getPublicTemplateService(makeMockSql(), paidRow.id);
    expect(dto?.membershipTiers).toHaveLength(2);
    expect(dto?.membershipTiers?.map((t) => t.name)).toEqual(['Basic', 'Pro']);
    expect(dto?.membershipTiers?.[1]?.monthlyCost).toBeNull();
  });
});

/**
 * Direct unit tests for `normalizeMembershipTiers` — the pure-function
 * boundary. Keep these at the top of the test file (next to the import)
 * for visibility? No — they're after the live usage tests so the reader
 * sees the projection first. Order matters for debugging output.
 */
describe('normalizeMembershipTiers (db/templates.ts) — pure-function unit tests', () => {
  it('returns [] for non-array input', async () => {
    const { normalizeMembershipTiers } = await import('../db/templates');
    expect(normalizeMembershipTiers(null)).toEqual([]);
    expect(normalizeMembershipTiers(undefined)).toEqual([]);
    expect(normalizeMembershipTiers('string')).toEqual([]);
    expect(normalizeMembershipTiers({})).toEqual([]);
  });

  it('drops rows with empty / missing name', async () => {
    const { normalizeMembershipTiers } = await import('../db/templates');
    expect(
      normalizeMembershipTiers([
        { name: '', rewards: [], monthlyCost: 0, yearlyCost: null, durationType: 'monthly' },
        { rewards: [], monthlyCost: 0, yearlyCost: null, durationType: 'monthly' },
        null,
        'string',
        { name: 'OK', rewards: [], monthlyCost: 0, yearlyCost: null, durationType: 'monthly' },
      ]),
    ).toHaveLength(1);
  });

  it('defaults durationType to "monthly" when missing or unknown', async () => {
    const { normalizeMembershipTiers } = await import('../db/templates');
    const result = normalizeMembershipTiers([
      { name: 'A', rewards: [], monthlyCost: 0, yearlyCost: null, durationType: 'bogus' },
      { name: 'B', rewards: [], monthlyCost: 0, yearlyCost: null }, // missing
    ]);
    expect(result[0]?.durationType).toBe('monthly');
    expect(result[1]?.durationType).toBe('monthly');
  });

  it('defaults non-number cost fields to null', async () => {
    const { normalizeMembershipTiers } = await import('../db/templates');
    const result = normalizeMembershipTiers([
      { name: 'A', rewards: [], monthlyCost: '100', yearlyCost: NaN, durationType: 'monthly' },
    ]);
    expect(result[0]?.monthlyCost).toBeNull();
    expect(result[0]?.yearlyCost).toBeNull();
  });

  it('filters out reward rows where both label and value are empty', async () => {
    const { normalizeMembershipTiers } = await import('../db/templates');
    const result = normalizeMembershipTiers([
      {
        name: 'A',
        rewards: [
          { label: 'x', value: 'y' },         // kept
          { label: '', value: '' },           // dropped
          { label: 'only-label', value: '' }, // kept
          null,                               // dropped
        ],
        monthlyCost: 0,
        yearlyCost: null,
        durationType: 'monthly',
      },
    ]);
    expect(result[0]?.rewards).toEqual([
      { label: 'x', value: 'y' },
      { label: 'only-label', value: '' },
    ]);
  });
});

// =============================================================================
// 2026-10-23 — gift-card purchase projection.
//
// A gift card is ALWAYS paid, but it is NOT a "paid membership card":
// it has no `isPaid` flag and no tier list. The backend therefore
// projects it on a SEPARATE `card_type === 'gift_card'` branch. Before
// this, `currency` was emitted only inside the `is_paid` branch, so a
// gift-card template could never tell the frontend which payment
// provider to offer — a silent dead end on the public page.
//
// See runs/decisions/2026-10-23-gift-card-paid-registration.md
// =============================================================================

const GIFT_SETTINGS = {
  giftCardAmount: 100,
  giftCardPoints: 10,
  giftCardCheckoutMinPoints: 100,
  giftCardCheckoutMaxPoints: 10_000,
  giftCardCheckoutMinAmount: 100,
  giftCardCheckoutMaxAmount: 10_000,
  giftCardDesignMinPoints: 1,
  giftCardDesignMaxPoints: 999_999_999,
  currency: 'TWD',
};

const giftRow: PublicTemplateRow = {
  id: 'aaaaaaa1-7f25-414b-b0d9-0c3abce8cf52',
  name: 'Gift Card Studio',
  card_type: 'gift_card',
  settings: {
    logoText: 'Gift Studio',
    issuerName: 'Gift Card Studio',
    language: 'zh-TW',
    ...GIFT_SETTINGS,
  },
  is_paid: false,
  membership_tiers: null,
  currency: 'TWD',
  gift_card_config: {
    giftCardAmount: 100,
    giftCardPoints: 10,
    giftCardCheckoutMinPoints: 100,
    giftCardCheckoutMaxPoints: 10_000,
    giftCardCheckoutMinAmount: 100,
    giftCardCheckoutMaxAmount: 10_000,
  },
};

describe('getPublicTemplateService — gift-card projection (2026-10-23)', () => {
  it('projects giftCard + currency for a gift_card template (is_paid = false)', async () => {
    stubFindPublicTemplateById(giftRow);
    const dto = await getPublicTemplateService(makeMockSql(), giftRow.id);
    expect(dto?.cardType).toBe('gift_card');
    expect(dto?.currency).toBe('TWD');
    expect(dto?.giftCard).toEqual({
      unitAmount: 100,
      unitPoints: 10,
      checkoutMinPoints: 100,
      checkoutMaxPoints: 10_000,
      checkoutMinAmount: 100,
      checkoutMaxAmount: 10_000,
    });
  });

  it('does NOT project isPaid / membershipTiers for a gift card', async () => {
    // A gift card must not render the membership tier picker — the two
    // branches are mutually exclusive.
    stubFindPublicTemplateById(giftRow);
    const dto = await getPublicTemplateService(makeMockSql(), giftRow.id);
    expect(dto?.isPaid).toBeUndefined();
    expect(dto?.membershipTiers).toBeUndefined();
  });

  it('projects ZAR currency so the page can offer Payfast', async () => {
    stubFindPublicTemplateById({ ...giftRow, currency: 'ZAR' });
    const dto = await getPublicTemplateService(makeMockSql(), giftRow.id);
    expect(dto?.currency).toBe('ZAR');
    expect(dto?.giftCard?.unitAmount).toBe(100);
  });

  it('defaults currency to TWD when the template has none configured', async () => {
    stubFindPublicTemplateById({ ...giftRow, currency: undefined });
    const dto = await getPublicTemplateService(makeMockSql(), giftRow.id);
    expect(dto?.currency).toBe('TWD');
  });

  it('omits giftCard when the tenant never configured a rate', async () => {
    stubFindPublicTemplateById({ ...giftRow, gift_card_config: null });
    const dto = await getPublicTemplateService(makeMockSql(), giftRow.id);
    expect(dto?.giftCard).toBeUndefined();
    // currency still rides along — the card type alone warrants it.
    expect(dto?.currency).toBe('TWD');
  });

  it('does NOT project giftCard on a non-gift card type (regression guard)', async () => {
    // A stamp card carrying stale giftCard* keys in settings must not
    // render a purchase UI.
    stubFindPublicTemplateById({
      ...baseRow,
      card_type: 'stamp_card',
      gift_card_config: giftRow.gift_card_config,
    });
    const dto = await getPublicTemplateService(makeMockSql(), baseRow.id);
    expect(dto?.giftCard).toBeUndefined();
    expect(dto?.currency).toBeUndefined();
  });

  it('a paid membership card keeps the is_paid branch (branches do not collide)', async () => {
    stubFindPublicTemplateById(paidRow);
    const dto = await getPublicTemplateService(makeMockSql(), paidRow.id);
    expect(dto?.isPaid).toBe(true);
    expect(dto?.giftCard).toBeUndefined();
  });
});

describe('normalizeGiftCardConfig (db/templates.ts) — pure-function unit tests', () => {
  async function loadNormalizer() {
    const mod = await import('../db/templates');
    return mod.normalizeGiftCardConfig;
  }

  it('returns null when the config is missing entirely', async () => {
    const normalizeGiftCardConfig = await loadNormalizer();
    expect(normalizeGiftCardConfig(null)).toBeNull();
    expect(normalizeGiftCardConfig(undefined)).toBeNull();
  });

  it('returns null when the rate fields are absent (template not configured)', async () => {
    const normalizeGiftCardConfig = await loadNormalizer();
    expect(normalizeGiftCardConfig({})).toBeNull();
  });

  it('returns null when a required numeric field is missing or non-numeric', async () => {
    const normalizeGiftCardConfig = await loadNormalizer();
    const valid = {
      giftCardAmount: 100,
      giftCardPoints: 10,
      giftCardCheckoutMinPoints: 100,
      giftCardCheckoutMaxPoints: 10_000,
      giftCardCheckoutMinAmount: 100,
      giftCardCheckoutMaxAmount: 10_000,
    };
    for (const key of Object.keys(valid)) {
      expect(normalizeGiftCardConfig({ ...valid, [key]: 'abc' })).toBeNull();
      expect(normalizeGiftCardConfig({ ...valid, [key]: undefined })).toBeNull();
    }
  });

  it('returns null for a non-positive or non-integer rate (corrupt row)', async () => {
    const normalizeGiftCardConfig = await loadNormalizer();
    const valid = {
      giftCardAmount: 100,
      giftCardPoints: 10,
      giftCardCheckoutMinPoints: 100,
      giftCardCheckoutMaxPoints: 10_000,
      giftCardCheckoutMinAmount: 100,
      giftCardCheckoutMaxAmount: 10_000,
    };
    expect(normalizeGiftCardConfig({ ...valid, giftCardAmount: 0 })).toBeNull();
    expect(normalizeGiftCardConfig({ ...valid, giftCardPoints: -1 })).toBeNull();
    expect(normalizeGiftCardConfig({ ...valid, giftCardAmount: 10.5 })).toBeNull();
  });

  it('returns null when the checkout fence is inverted (min > max)', async () => {
    const normalizeGiftCardConfig = await loadNormalizer();
    expect(
      normalizeGiftCardConfig({
        giftCardAmount: 100,
        giftCardPoints: 10,
        giftCardCheckoutMinPoints: 10_000,
        giftCardCheckoutMaxPoints: 100,
        giftCardCheckoutMinAmount: 100,
        giftCardCheckoutMaxAmount: 10_000,
      }),
    ).toBeNull();
  });

  it('returns null for a non-object payload (JSONB free-form guard)', async () => {
    const normalizeGiftCardConfig = await loadNormalizer();
    expect(normalizeGiftCardConfig('string')).toBeNull();
    expect(normalizeGiftCardConfig(42)).toBeNull();
    expect(normalizeGiftCardConfig([1, 2, 3])).toBeNull();
  });

  it('accepts a complete config and maps it to the public shape', async () => {
    const normalizeGiftCardConfig = await loadNormalizer();
    expect(
      normalizeGiftCardConfig({
        giftCardAmount: 1,
        giftCardPoints: 1,
        giftCardCheckoutMinPoints: 100,
        giftCardCheckoutMaxPoints: 10_000,
        giftCardCheckoutMinAmount: 100,
        giftCardCheckoutMaxAmount: 10_000,
      }),
    ).toEqual({
      unitAmount: 1,
      unitPoints: 1,
      checkoutMinPoints: 100,
      checkoutMaxPoints: 10_000,
      checkoutMinAmount: 100,
      checkoutMaxAmount: 10_000,
    });
  });
});