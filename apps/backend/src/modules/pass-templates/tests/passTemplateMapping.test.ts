/**
 * passTemplateMapping conformance tests — written for the v12-followup wire format.
 *
 * @module modules/pass-templates/tests/passTemplateMapping
 *
 * Wire-format contract pinned here (2026-10-12 v12-followup):
 *   - `headerFields[0]` is FIXED per cardType (NOT from Step 3 dropdown).
 *   - `primaryFields[]` is RESERVED for membership_card.memberName (per user 2026-10-12 directive).
 *   - `secondaryFields[] = settings.leftField → [0]; settings.rightField → [1]`.
 *   - `additionalProperties[]` does NOT mirror `settings.backFields[]` (per user 2026-10-12 directive).
 *
 * Drift guard: if the mapping module ever starts hardcoding labels or
 * pushing legacy v6 keys, the tests here catch it at unit-test time —
 * not at production deploy time.
 *
 * Rule references:
 *   - Rule 019 § D.3 — third-party API shape is a contract.
 *   - Rule 023 § Shared Validation — the labels come from a single
 *     source (`@saome/shared/i18n/fieldLabels`); the tests assert the
 *     mapping reads from that source rather than hardcoding.
 */

import { describe, it, expect } from 'vitest';
import {
  mapTemplateToPasscreator,
  getFieldLabelMap,
  getHeaderField,
  normalizeLinkUrl,
} from '../services/passTemplateMapping';
import type { TemplatesRow } from '@/modules/cards/db/templates';
import { getFieldLabel, HEADER_FIELD_TYPES } from '@saome/shared/i18n/fieldLabels';
import { CARD_FIELDS } from '@saome/shared/constants/card-fields';

const R2_URL = 'https://r2.example.com';

/** Build a minimal-but-realistic TemplatesRow for tests. Defaults can be overridden per-test. */
function makeRow(overrides: Partial<TemplatesRow> = {}): TemplatesRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    tenant_id: '00000000-0000-4000-8000-000000000002',
    status: 'draft',
    name: 'Café Rewards',
    card_type: 'reward_card',
    settings: {
      cardType: 'reward_card',
      barcodeType: 'qr_code',
      logoText: 'Café 咖啡',
      issuerName: 'Café Co.',
      description: 'A neighborhood loyalty card',
      language: 'zh-TW',
      backgroundColor: '#0F0F23',
      textColor: '#F8FAFC',
      leftField: 'phone',
      rightField: 'email',
      backFields: [
        { label: '聯絡電話', value: '+886-2-1234-5678' },
        { label: '官方網站', value: 'https://cafe.example.com' },
      ],
      iconImage: 'tenant-001/template-001/icon.png',
      issuerLogo: 'tenant-001/template-001/logo.png',
      backgroundImage: 'tenant-001/template-001/background.png',
    },
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    expires_at: undefined,
    passcreator_template_id: null,
    ...overrides,
  };
}

describe('mapTemplateToPasscreator — name', () => {
  it('prefers templates.name over settings.logoText', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.name).toBe('Café Rewards');
  });
  it('falls back to settings.logoText when templates.name is empty', () => {
    const row = makeRow({ name: '  ' });
    const body = mapTemplateToPasscreator({ template: row, language: 'zh-TW', r2PublicUrl: R2_URL });
    expect(body.name).toBe('Café 咖啡');
  });
  it('falls back to "Untitled Card" when both are empty', () => {
    const row = makeRow({ name: '' });
    row.settings.logoText = '';
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.name).toBe('Untitled Card');
  });
});

describe('mapTemplateToPasscreator — colors', () => {
  /**
   * 2026-10-11 v6 fix — Passcreator regex contract.
   *
   * Passcreator's contract REQUIRES the `#` prefix. We now keep it
   * via `normalizeHexColor` (no longer strips).
   */
  it('preserves leading # from hex (v6 fix — Passcreator regex requires ^#)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.colors.backgroundColor).toBe('#0F0F23');
    expect(body.colors.foregroundColor).toBe('#F8FAFC');
  });
  it('uppercases the hex digits AND keeps the #', () => {
    const row = makeRow();
    row.settings.backgroundColor = '#abcdef';
    row.settings.textColor = '#123456';
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.colors.backgroundColor).toBe('#ABCDEF');
    expect(body.colors.foregroundColor).toBe('#123456');
  });
  it('emits empty string for missing colors (Passcreator falls back to pass-type default)', () => {
    const row = makeRow();
    row.settings.backgroundColor = undefined;
    row.settings.textColor = undefined;
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.colors.backgroundColor).toBe('');
    expect(body.colors.foregroundColor).toBe('');
  });
});

describe('mapTemplateToPasscreator — barcode', () => {
  it('maps qr_code to PKBarcodeFormatQR', () => {
    const row = makeRow();
    row.settings.barcodeType = 'qr_code';
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.barcode.format).toBe('PKBarcodeFormatQR');
  });
  it('maps pdf_417 to PKBarcodeFormatPDF417', () => {
    const row = makeRow();
    row.settings.barcodeType = 'pdf_417';
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.barcode.format).toBe('PKBarcodeFormatPDF417');
  });
  it('defaults to QR for missing barcode (legacy rows)', () => {
    const row = makeRow();
    row.settings.barcodeType = undefined;
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.barcode.format).toBe('PKBarcodeFormatQR');
  });
});

describe('mapTemplateToPasscreator — images', () => {
  it('converts R2 keys to public R2-proxy URLs (regression 2026-10-12)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.images.icon).toBe(`${R2_URL}/api/pass-templates/00000000-0000-4000-8000-000000000001/icon`);
    expect(body.images.logo).toBe(`${R2_URL}/api/pass-templates/00000000-0000-4000-8000-000000000001/logo`);
    expect(body.images.background).toBe(`${R2_URL}/api/pass-templates/00000000-0000-4000-8000-000000000001/background`);
  });
  it('preserves absolute URLs (legacy / pre-R2 rows)', () => {
    const row = makeRow();
    row.settings.iconImage = 'https://cdn.example.com/icon.png';
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.images.icon).toBe('https://cdn.example.com/icon.png');
  });
  it('emits undefined (key omitted) for missing image keys — Passcreator falls back to default', () => {
    const row = makeRow();
    row.settings.iconImage = undefined;
    row.settings.issuerLogo = undefined;
    row.settings.backgroundImage = undefined;
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.images).not.toHaveProperty('icon');
    expect(body.images).not.toHaveProperty('logo');
    expect(body.images).not.toHaveProperty('background');
  });
  it('pushed key is background, never strip (v7 fix 2026-10-12)', () => {
    const body = mapTemplateToPasscreator({ template: makeRow(), language: 'en', r2PublicUrl: R2_URL });
    expect(body.images).not.toHaveProperty('strip');
    expect(body.images).toHaveProperty('background');
  });
});

describe('mapTemplateToPasscreator — fields (header / primary / secondary / back)', () => {
  /**
   * 2026-10-12 v12-followup contract:
   *   - headerFields[0] FIXED per cardType via getHeaderField(cardType, language).
   *   - primaryFields[] RESERVED for membership_card.memberName; 其它 ⇒ [].
   *   - secondaryFields[] = settings.leftField → [0]; settings.rightField → [1].
   */
  it('headerFields[0] is FIXED per cardType (reward_card to balance/Balance) — NOT driven by leftField', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields).toEqual([
      { key: 'balance', type: 'number', label: '餘額', value: '{balance}' },
    ]);
    expect(body.fields.primaryFields).toEqual([]);
  });

  it('secondaryFields[] is [leftField, rightField] when both are set', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.secondaryFields).toEqual([
      { key: 'phone', type: 'text', label: '電話', value: '{phone}' },
      { key: 'email', type: 'text', label: 'E-mail', value: '{email}' },
    ]);
  });

  it('en labels are different from zh-TW labels across all three slots', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]).toEqual({ key: 'balance', type: 'number', label: 'Balance', value: '{balance}' });
    expect(body.fields.secondaryFields[0]?.label).toBe('Phone');
    expect(body.fields.secondaryFields[1]?.label).toBe('Email');
  });

  it('backFields preserves the user-typed label (NOT localized)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.backFields).toEqual([
      { key: '', type: 'text', label: '聯絡電話', value: '+886-2-1234-5678' },
      { key: '', type: 'text', label: '官方網站', value: 'https://cafe.example.com' },
    ]);
  });

  it('headerFields is empty when cardType is null (no card picked yet)', () => {
    const row = makeRow({ card_type: null });
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.fields.headerFields).toEqual([]);
    expect(body.fields.primaryFields).toEqual([]);
    expect(body.fields.secondaryFields).toEqual([
      { key: 'phone', type: 'text', label: 'Phone', value: '{phone}' },
      { key: 'email', type: 'text', label: 'Email', value: '{email}' },
    ]);
  });

  it('headerFields label is INDEPENDENT of settings.leftField (the v5 fix)', () => {
    const row = makeRow();
    row.settings.leftField = 'memberLevel';
    const body = mapTemplateToPasscreator({ template: row, language: 'zh-TW', r2PublicUrl: R2_URL });
    expect(body.fields.headerFields).toEqual([
      { key: 'balance', type: 'number', label: '餘額', value: '{balance}' },
    ]);
    expect(body.fields.primaryFields).toEqual([]);
    expect(body.fields.secondaryFields[0]).toEqual({ key: 'memberLevel', type: 'text', label: '獎勵', value: '{memberLevel}' });
  });

  it('secondaryFields is empty when both leftField AND rightField are unset', () => {
    const row = makeRow();
    row.settings.leftField = undefined;
    row.settings.rightField = undefined;
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.fields.secondaryFields).toEqual([]);
  });

  it('secondaryFields has [left] only when rightField is not set', () => {
    const row = makeRow();
    row.settings.rightField = undefined;
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.fields.secondaryFields).toEqual([
      { key: 'phone', type: 'text', label: 'Phone', value: '{phone}' },
    ]);
  });

  it('membership_card → primaryFields = [memberName] (reserved slot)', () => {
    const row = makeRow({ card_type: 'membership_card' });
    const body = mapTemplateToPasscreator({ template: row, language: 'zh-TW', r2PublicUrl: R2_URL });
    expect(body.fields.primaryFields[0]).toEqual({ key: 'memberName', type: 'text', label: '會員姓名', value: '{memberName}' });
    expect(body.fields.secondaryFields).toEqual([
      { key: 'phone', type: 'text', label: '電話', value: '{phone}' },
      { key: 'email', type: 'text', label: 'E-mail', value: '{email}' },
    ]);
  });

  it('membership_card (en) → primaryFields = [Member Name]', () => {
    const row = makeRow({ card_type: 'membership_card' });
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.fields.primaryFields[0]?.label).toBe('Member Name');
  });

  it('additionalProperties does NOT contain backField labels (v12-followup regression)', () => {
    // 2026-10-12 v12-followup: per user directive「backFields 的值就填在
    // backFields 裡面就好」, backFields rows are NOT mirrored into additionalProperties[].
    const body = mapTemplateToPasscreator({ template: makeRow(), language: 'zh-TW', r2PublicUrl: R2_URL });
    const names = (body.additionalProperties ?? []).map((p) => p.name);
    expect(names).not.toContain('聯絡電話');
    expect(names).not.toContain('官方網站');
    // Slot entries still present (header + secondary on reward_card).
    expect(names).toContain('balance');
    expect(names).toContain('phone');
    expect(names).toContain('email');
  });
});

describe('mapTemplateToPasscreator — passTypeId', () => {
  it('uses the override when provided', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'en',
      r2PublicUrl: R2_URL,
      passTypeId: 'custom.pass.type',
    });
    expect(body.passTypeId).toBe('custom.pass.type');
  });
  it('falls back to the SAOME default passTypeId', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.passTypeId).toBe('pass.saome.org.passcreator');
  });
});

describe('mapTemplateToPasscreator — language propagation', () => {
  it('zh-TW headerFields label is the Chinese fixed-per-cardType string', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('餘額');
  });
  it('en headerFields label is the English fixed-per-cardType string', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('Balance');
  });
  it('secondaryFields[0]/[1] labels match getFieldLabel(leftField/rightField, language) (regression — drift guard)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.secondaryFields[0]?.label).toBe(getFieldLabel('phone', 'zh-TW', 'reward_card'));
    expect(body.fields.secondaryFields[1]?.label).toBe(getFieldLabel('email', 'zh-TW', 'reward_card'));
  });
  it('headerFields label equals getHeaderField(cardType, language) (regression — drift guard)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe(
      getHeaderField('reward_card', 'zh-TW')?.label,
    );
  });
});

describe('mapTemplateToPasscreator — cardType-aware memberLevel override (secondary only, post-v12-followup)', () => {
  /**
   * 2026-10-12 v12-followup: override target is `secondaryFields[0]` (or [1]),
   * NOT `primaryFields` and NOT `headerFields`. The override applies only
   * when the chosen key is `memberLevel`.
   *
   * Override rules (mirror `getFieldLabel` in `@saome/shared/i18n/fieldLabels`):
   *   - stamp_card / reward_card / cashback_card  → 獎勵 / "Reward"
   *   - discount_card                              → 折扣等級 / "Discount Tier"
   *   - 其它 cardType (membership, multipass, coupon, gift, null, undefined) → 會員等級 / "Member Level"
   */
  function rowWithMemberLevel(cardType: TemplatesRow['card_type']): TemplatesRow {
    return makeRow({
      card_type: cardType,
      settings: {
        ...makeRow().settings,
        leftField: 'memberLevel',
        rightField: 'memberLevel',
      },
    });
  }

  it('stamp_card pushes 獎勵 (zh-TW) for secondaryFields[0] AND [1] (headerField unaffected)', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('stamp_card'),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields).toEqual([]);
    expect(body.fields.secondaryFields[0]).toEqual({ key: 'memberLevel', type: 'text', label: '獎勵', value: '{memberLevel}' });
    expect(body.fields.secondaryFields[1]).toEqual({ key: 'memberLevel', type: 'text', label: '獎勵', value: '{memberLevel}' });
    expect(body.fields.headerFields[0]).toEqual({ key: 'balance', type: 'number', label: '餘額', value: '{balance}' });
  });

  it('reward_card pushes 獎勵 (zh-TW) for secondaryFields[0]', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('reward_card'),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields).toEqual([]);
    expect(body.fields.secondaryFields[0]?.label).toBe('獎勵');
    expect(body.fields.headerFields[0]?.label).toBe('餘額');
  });

  it('cashback_card pushes 獎勵 (zh-TW) for secondaryFields[0]', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('cashback_card'),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields).toEqual([]);
    expect(body.fields.secondaryFields[0]?.label).toBe('獎勵');
    expect(body.fields.headerFields[0]?.label).toBe('餘額');
  });

  it('discount_card pushes 折扣等級 (zh-TW) for secondaryFields[0] — independent of stamp/reward/cashback', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('discount_card'),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields).toEqual([]);
    expect(body.fields.secondaryFields[0]?.label).toBe('折扣等級');
    expect(body.fields.secondaryFields[0]?.label).not.toBe('獎勵');
    expect(body.fields.headerFields[0]?.label).toBe('有效期限');
  });

  it('membership_card: primaryFields = [memberName] AND secondaryFields[0] = default 會員等級', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('membership_card'),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields[0]).toEqual({ key: 'memberName', type: 'text', label: '會員姓名', value: '{memberName}' });
    expect(body.fields.secondaryFields[0]?.label).toBe('會員等級');
    expect(body.fields.headerFields[0]?.label).toBe('會員到期日');
  });

  it('multipass: primaryFields = [] AND secondaryFields[0] = default 會員等級', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('multipass'),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields).toEqual([]);
    expect(body.fields.secondaryFields[0]?.label).toBe('會員等級');
    expect(body.fields.headerFields[0]?.label).toBe('餘額');
  });

  it('coupon_card: primaryFields = [] AND secondaryFields[0] = default 會員等級', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('coupon_card'),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields).toEqual([]);
    expect(body.fields.secondaryFields[0]?.label).toBe('會員等級');
    expect(body.fields.headerFields[0]?.label).toBe('有效期限');
  });

  it('null cardType: primaryFields = [] AND secondaryFields[0] = default 會員等級', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel(null),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields).toEqual([]);
    expect(body.fields.secondaryFields[0]?.label).toBe('會員等級');
    expect(body.fields.headerFields).toEqual([]);
  });

  it('en stamp_card pushes Reward for secondaryFields[0]', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('stamp_card'),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields).toEqual([]);
    expect(body.fields.secondaryFields[0]?.label).toBe('Reward');
    expect(body.fields.headerFields[0]?.label).toBe('Balance');
  });

  it('en discount_card pushes Discount Tier for secondaryFields[0]', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('discount_card'),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields).toEqual([]);
    expect(body.fields.secondaryFields[0]?.label).toBe('Discount Tier');
    expect(body.fields.headerFields[0]?.label).toBe('Expiry Date');
  });

  it('en membership_card: primaryFields = [Member Name] AND secondaryFields[0] = Member Level', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('membership_card'),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields[0]?.label).toBe('Member Name');
    expect(body.fields.secondaryFields[0]?.label).toBe('Member Level');
    expect(body.fields.headerFields[0]?.label).toBe('Member Expiry');
  });

  it('cardType override does NOT leak to other CardFieldKeys (e.g. phone stays 電話 on stamp_card)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'stamp_card' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields).toEqual([]);
    expect(body.fields.secondaryFields[0]?.label).toBe('電話');
    expect(body.fields.secondaryFields[1]?.label).toBe('E-mail');
    expect(body.fields.headerFields[0]?.label).toBe('餘額');
  });
});
