/**
 * passTemplateMapping — pure mapping tests.
 *
 * @module modules/pass-templates/tests/passTemplateMapping
 *
 * Conformance tests pin the DB-row → Passcreator-body mapping contract
 * so the editor preview and the deployed pass stay in sync. The drift
 * is caught at unit-test time, not at production deploy time.
 *
 * Rule references:
 *   - Rule 019 § D.3 — third-party API shape is a contract.
 *   - Rule 023 § Shared Validation — the labels come from a single
 *     source (`@saome/shared/i18n/fieldLabels`); this test verifies
 *     the mapping actually reads from that source, not hardcoded strings.
 */

import { describe, it, expect } from 'vitest';
import { mapTemplateToPasscreator, getFieldLabelMap } from '../services/passTemplateMapping';
import type { TemplatesRow } from '@/modules/cards/db/templates';
import { getFieldLabel } from '@saome/shared/i18n/fieldLabels';

const R2_URL = 'https://r2.example.com';

/**
 * Build a minimal-but-realistic `TemplatesRow` for tests.
 * Defaults can be overridden per-test.
 */
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
  it('strips leading `#` from hex (Passcreator contract is bare 6-char hex)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.colors.backgroundColor).toBe('0F0F23');
    expect(body.colors.foregroundColor).toBe('F8FAFC');
  });
  it('uppercases the hex digits', () => {
    const row = makeRow();
    row.settings.backgroundColor = '#abcdef';
    row.settings.textColor = '#123456';
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.colors.backgroundColor).toBe('ABCDEF');
    expect(body.colors.foregroundColor).toBe('123456');
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
  it('maps qr_code → PKBarcodeFormatQR', () => {
    const row = makeRow();
    row.settings.barcodeType = 'qr_code';
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.barcode.format).toBe('PKBarcodeFormatQR');
  });
  it('maps pdf_417 → PKBarcodeFormatPDF417', () => {
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
  it('converts R2 keys to absolute URLs', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.images.icon).toBe(`${R2_URL}/tenant-001/template-001/icon.png`);
    expect(body.images.logo).toBe(`${R2_URL}/tenant-001/template-001/logo.png`);
  });
  it('preserves absolute URLs (legacy / pre-R2 rows)', () => {
    const row = makeRow();
    row.settings.iconImage = 'https://cdn.example.com/icon.png';
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.images.icon).toBe('https://cdn.example.com/icon.png');
  });
  it('emits empty string for missing image keys', () => {
    const row = makeRow();
    row.settings.iconImage = undefined;
    row.settings.issuerLogo = undefined;
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.images.icon).toBe('');
    expect(body.images.logo).toBe('');
  });
});

describe('mapTemplateToPasscreator — fields (header / primary / secondary / back)', () => {
  it('headerFields uses settings.leftField with a localized label', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields).toEqual([
      { key: 'phone', label: '電話', value: '' },
    ]);
  });
  it('primaryFields uses settings.rightField with a localized label', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields).toEqual([
      { key: 'email', label: 'E-mail', value: '' },
    ]);
  });
  it('en label is different from zh-TW label for the same key', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('Phone');
    expect(body.fields.primaryFields[0]?.label).toBe('Email');
  });
  it('secondaryFields is empty in v1 (no editor support yet)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.secondaryFields).toEqual([]);
  });
  it('backFields preserves the user-typed label (NOT localized)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'en',  // even in en, the backFields label stays in zh-TW
      r2PublicUrl: R2_URL,
    });
    // The label is the user's typed string, NOT the localized
    // CardFieldKey label. Per design 2026-10-11.
    expect(body.fields.backFields).toEqual([
      { key: '', label: '聯絡電話', value: '+886-2-1234-5678' },
      { key: '', label: '官方網站', value: 'https://cafe.example.com' },
    ]);
  });
  it('omits headerFields when leftField is not set', () => {
    const row = makeRow();
    row.settings.leftField = undefined;
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.fields.headerFields).toEqual([]);
  });
  it('omits primaryFields when rightField is not set', () => {
    const row = makeRow();
    row.settings.rightField = undefined;
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.fields.primaryFields).toEqual([]);
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
  it('zh-TW renders Chinese labels in header/primary fields', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('電話');
  });
  it('en renders English labels in header/primary fields', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('Phone');
  });
  it('header/primary labels match getFieldLabelMap(language) (no hard-coded values)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    const labelMap = getFieldLabelMap('en', 'reward_card');
    expect(body.fields.headerFields[0]?.label).toBe(labelMap.phone);
    expect(body.fields.primaryFields[0]?.label).toBe(labelMap.email);
  });
  it('header/primary labels match getFieldLabel(key, language) (regression — drift guard)', () => {
    // This is the integration test for "mapping uses shared, not hard-coded".
    // If the mapping module ever starts hardcoding labels, this test
    // fails because getFieldLabel will return the shared value.
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe(getFieldLabel('phone', 'zh-TW', 'reward_card'));
    expect(body.fields.primaryFields[0]?.label).toBe(getFieldLabel('email', 'zh-TW', 'reward_card'));
  });
});

/**
 * cardType-aware memberLevel override — pushed label must mirror the
 * editor's `Step3CardFields::resolveOptionLabelKey` output, otherwise
 * the editor preview and the deployed pass diverge.
 *
 * The override rules are:
 *   - stamp_card / reward_card / cashback_card → 「獎勵」 / "Reward"
 *   - discount_card                            → 「折扣等級」 / "Discount Tier"
 *   - any other cardType (membership_card, multipass, coupon_card,
 *     gift_card, undefined, null)              → 「會員等級」 / "Member Level"
 *
 * The user's 2026-10-11 directive: "fieldLabels 組裝推送的標籤文字邏輯
 * 要跟 CardBuilderEditor 一樣"。These tests pin that contract.
 */
describe('mapTemplateToPasscreator — cardType-aware memberLevel override', () => {
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

  it('stamp_card pushes 「獎勵」 (zh-TW) for memberLevel', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('stamp_card'),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]).toEqual({ key: 'memberLevel', label: '獎勵', value: '' });
    expect(body.fields.primaryFields[0]).toEqual({ key: 'memberLevel', label: '獎勵', value: '' });
  });

  it('reward_card pushes 「獎勵」 (zh-TW) for memberLevel', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('reward_card'),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('獎勵');
  });

  it('cashback_card pushes 「獎勵」 (zh-TW) for memberLevel', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('cashback_card'),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('獎勵');
  });

  it('discount_card pushes 「折扣等級」 (zh-TW) for memberLevel — independent of stamp/reward/cashback', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('discount_card'),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('折扣等級');
    expect(body.fields.headerFields[0]?.label).not.toBe('獎勵');
  });

  it('membership_card pushes 「會員等級」 (zh-TW) for memberLevel — default, no override', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('membership_card'),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('會員等級');
  });

  it('multipass pushes 「會員等級」 (zh-TW) for memberLevel — default, no override', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('multipass'),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('會員等級');
  });

  it('coupon_card pushes 「會員等級」 (zh-TW) for memberLevel — default, no override (also the slot is hidden in editor but if set it falls through)', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('coupon_card'),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('會員等級');
  });

  it('undefined card_type pushes default 「會員等級」 (zh-TW) for memberLevel', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel(null),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('會員等級');
  });

  it('en stamp_card pushes "Reward" for memberLevel', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('stamp_card'),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('Reward');
  });

  it('en discount_card pushes "Discount Tier" for memberLevel', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('discount_card'),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('Discount Tier');
  });

  it('en membership_card pushes default "Member Level" for memberLevel', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithMemberLevel('membership_card'),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('Member Level');
  });

  it('cardType override does NOT leak to other CardFieldKeys (e.g. phone stays "電話" on stamp_card)', () => {
    // Regression guard: a future "always apply override" bug would
    // rename the phone label to "獎勵" on a stamp_card, breaking
    // every other slot. The override is strictly per-key.
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'stamp_card' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe('電話');
    expect(body.fields.primaryFields[0]?.label).toBe('E-mail');
  });
});
