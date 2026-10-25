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
  /**
   * 2026-10-13 v14 — images.backgroundDifferentForEachPass.
   * Per Passcreator docs: `true` ⇒ per-pass upload at issuance time
   * overrides template-level `images.background` (which remains as
   * PassKit fallback). SAOME mapping hardcodes `true` for every push
   * (user decision 2026-10-13); tenants do NOT control this via UI.
   */
  it('always emits images.backgroundDifferentForEachPass = true (v14 default-on)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.images.backgroundDifferentForEachPass).toBe(true);
  });
  it('emits flag alongside images.background URL when tenant uploaded one (v14 default-on with URL)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.images.backgroundDifferentForEachPass).toBe(true);
    // 既有的 background URL 行為保留 (PassKit fallback)
    expect(body.images.background).toBe(
      `${R2_URL}/api/pass-templates/00000000-0000-4000-8000-000000000001/background`,
    );
  });
  /**
   * 2026-10-15 v16 — `images.backgroundHidden: false` alongside `images.background`.
   *
   * User-reported bug: stamp_card 0.png 在 R2 正確上傳,Passcreator push
   * 也送了 `images.background` URL,但 Passcreator 模板設定的「不用背景圖」
   * checkbox (即 `backgroundHidden` 欄位) 仍是 `true`,導致 deployed pass
   * 看不到 strip 圖。
   *
   * 根因:Passcreator V2 describe response 顯示
   *   `images.backgroundHidden: true` 是預設值。我們 push payload 只送
   *   `images.background` URL 卻不送 `backgroundHidden: false`,
   *   Passcreator 維持預設 → 隱藏背景。
   *
   * 修法:當 mapping 有 emit `images.background` (即租戶或 stamp-0.png
   * 有可下載的 strip URL) 時,同步 emit `images.backgroundHidden: false`
   * 顯式關閉隱藏。
   *
   * 同樣 issue 也會影響 `logoHidden`(describe 預設 `true`);當
   * `images.logo` 有 URL 時,emit `images.logoHidden: false`。
   *
   * 來源:https://developer.passcreator.com/en/api/v2/pass-template
   * (describe response 內 `images` block 同時帶 `background` /
   * `backgroundHidden` 兩欄位)
   */
  it('emits images.backgroundHidden: false when images.background URL is set (v16)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.images.background).toBeDefined();
    expect(body.images.backgroundHidden).toBe(false);
  });
  it('emits images.logoHidden: false when images.logo URL is set (v16)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.images.logo).toBeDefined();
    expect(body.images.logoHidden).toBe(false);
  });
  it('omits backgroundHidden when no background URL is set (no override of Passcreator default)', () => {
    // 沒 background URL → 不 emit backgroundHidden;讓 Passcreator 走預設
    // (預設對 tenant = 「hide」,但這是我們也沒圖可顯示的 fallback)。
    const row = makeRow();
    row.settings.backgroundImage = undefined;
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.images).not.toHaveProperty('background');
    expect(body.images).not.toHaveProperty('backgroundHidden');
  });
  it('omits logoHidden when no logo URL is set', () => {
    const row = makeRow();
    row.settings.issuerLogo = undefined;
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.images).not.toHaveProperty('logo');
    expect(body.images).not.toHaveProperty('logoHidden');
  });
  it('backgroundDifferentForEachPass + backgroundHidden both present and consistent (v14 + v16 coexist)', () => {
    // v14 (default-on per-pass override) 與 v16 (顯式 un-hide background)
    // 並存於同一張模板上,租戶仍享有 per-pass override 能力,同時
    // deployed pass 預設就會顯示背景。
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.images.background).toBeDefined();
    expect(body.images.backgroundHidden).toBe(false);
    expect(body.images.backgroundDifferentForEachPass).toBe(true);
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

  // 2026-10-19 regression fix: primaryFields[0].key = 'memberName' for
  // membership_card emits {memberName} in the slot's value, so additionalProperties[]
  // MUST also carry the entry so the cross-reference resolves in Passcreator.
  it('membership_card → additionalProperties contains memberName (regression — 2026-10-19)', () => {
    const row = makeRow({ card_type: 'membership_card' });
    const body = mapTemplateToPasscreator({ template: row, language: 'zh-TW', r2PublicUrl: R2_URL });
    const names = (body.additionalProperties ?? []).map((p) => p.name);
    expect(names).toContain('memberName');
    const memberNameEntry = body.additionalProperties!.find((p) => p.name === 'memberName');
    expect(memberNameEntry).toEqual({
      name: 'memberName',
      placeholder: '{memberName}',
      type: 'text',
      required: false,
      hidden: false,
    });
  });

  it('membership_card → additionalProperties contains ALL 4 slot keys (header + left + right + primary)', () => {
    const row = makeRow({ card_type: 'membership_card' });
    const body = mapTemplateToPasscreator({ template: row, language: 'zh-TW', r2PublicUrl: R2_URL });
    const names = (body.additionalProperties ?? []).map((p) => p.name);
    // header: memberExpiry (membership_card header)
    expect(names).toContain('memberExpiry');
    // left: phone (from makeRow defaults)
    expect(names).toContain('phone');
    // right: email (from makeRow defaults)
    expect(names).toContain('email');
    // primary: memberName (membership_card reserved slot — THIS IS THE FIX)
    expect(names).toContain('memberName');
  });

  it('reward_card → additionalProperties does NOT contain memberName (non-membership regression)', () => {
    const row = makeRow({ card_type: 'reward_card' });
    const body = mapTemplateToPasscreator({ template: row, language: 'zh-TW', r2PublicUrl: R2_URL });
    const names = (body.additionalProperties ?? []).map((p) => p.name);
    expect(names).not.toContain('memberName');
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

/**
 * 2026-10-12 v13 — locations[].name + initialMessage + locationsMaxDistance
 * (PassKit / Passcreator V2 contract fields that v9 missed).
 *
 * Regression trace: v9 was written against the Passcreator V2 describe
 * response's minimal `locations` row shape `{latitude, longitude,
 * relevantText}` and dropped `name`. v13 corrects the gap. `initialMessage`
 * and `locationsMaxDistance` are top-level pass-level fields that v9 never
 * emitted at all.
 */
describe('mapTemplateToPasscreator — locations[].name (v13)', () => {
  it('pushes per-row name when non-empty', () => {
    const row = makeRow();
    row.settings.locationsDisabled = false;
    row.settings.locations = [
      { name: 'asfasfasdfasfd', latitude: 25.147231388482524, longitude: 121.41076270166438, relevantText: 'dfasfdsafd' },
    ];
    const body = mapTemplateToPasscreator({ template: row, language: 'zh-TW', r2PublicUrl: R2_URL });
    expect(body.locations?.[0]?.name).toBe('asfasfasdfasfd');
  });
  it('omits name when empty string (no empty label rendered upstream)', () => {
    const row = makeRow();
    row.settings.locationsDisabled = false;
    row.settings.locations = [{ name: '', latitude: 25.14, longitude: 121.41 }];
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.locations?.[0]).not.toHaveProperty('name');
  });
  it('keeps name when row is well-formed (regression: explicit name survives map)', () => {
    const row = makeRow();
    row.settings.locationsDisabled = false;
    row.settings.locations = [{ name: 'A', latitude: 25.14, longitude: 121.41 }];
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.locations?.[0]?.name).toBe('A');
  });
  it('keeps name out when locationsDisabled is true → locations array is omitted (v9 contract preserved)', () => {
    // Defensive: when toggle is off, the whole array is gone (not just
    // the rows). This protects the v9 contract — don't partially ship.
    const row = makeRow();
    row.settings.locationsDisabled = true;
    row.settings.locations = [{ name: 'A', latitude: 25.14, longitude: 121.41 }];
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body).not.toHaveProperty('locations');
    expect(body.locationsDisabled).toBe(true);
  });
});

describe('mapTemplateToPasscreator — initialMessage (v13)', () => {
  it('pushes top-level initialMessage when set', () => {
    const row = makeRow();
    row.settings.initialMessage = 'asfasf';
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.initialMessage).toBe('asfasf');
  });
  it('omits initialMessage when empty string', () => {
    const row = makeRow();
    row.settings.initialMessage = '';
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body).not.toHaveProperty('initialMessage');
  });
  it('omits initialMessage when undefined (default schema behavior)', () => {
    const row = makeRow();
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body).not.toHaveProperty('initialMessage');
  });
});

describe('mapTemplateToPasscreator — locationsMaxDistance (v13)', () => {
  it('pushes top-level locationsMaxDistance when non-null', () => {
    const row = makeRow();
    row.settings.locationsMaxDistance = 122;
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.locationsMaxDistance).toBe(122);
  });
  it('omits locationsMaxDistance when null (PassKit picks pass-type default)', () => {
    const row = makeRow();
    row.settings.locationsMaxDistance = null;
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body).not.toHaveProperty('locationsMaxDistance');
  });
  it('omits locationsMaxDistance when undefined', () => {
    const row = makeRow();
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body).not.toHaveProperty('locationsMaxDistance');
  });
  it('preserves the PassKit-bound upper value (1000) — no clamping in the mapping layer', () => {
    // Range [100, 1000] is enforced upstream by the shared zod schema;
    // the mapping layer passes through whatever the editor wrote.
    const row = makeRow();
    row.settings.locationsMaxDistance = 1000;
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.locationsMaxDistance).toBe(1000);
  });
});

/**
 * 2026-10-12 v13 — membership_card backFields source switch.
 *
 * Regression trace: v9 / v12-followup read `settings.backFields[]` for
 * every card type. For membership cards, `settings.backFields` is an
 * empty placeholder (`[{label: '', value: ''}]` in real DB rows); the
 * actual user-authored 會員福利 content lives in
 * `settings.membershipTiers[].rewards[]`. v13 fixes the gap.
 */
describe('mapTemplateToPasscreator — membership_card backFields from tiers (v13)', () => {
  function makeMembershipRow(): TemplatesRow {
    return makeRow({ card_type: 'membership_card' });
  }

  it('membership_card: flattens membershipTiers[].rewards[] into backFields (regression — user data)', () => {
    // Matches the user-provided DB row verbatim: backFields is empty,
    // rewards carries the actual 會員福利 content.
    const row = makeMembershipRow();
    row.settings.membershipTiers = [
      { name: '嗯嗯', rewards: [{ label: 'ao6', value: 'huohoij' }] },
    ];
    row.settings.backFields = [{ label: '', value: '' }];
    const body = mapTemplateToPasscreator({ template: row, language: 'zh-TW', r2PublicUrl: R2_URL });
    expect(body.fields.backFields).toEqual([
      { key: '', type: 'text', label: 'ao6', value: 'huohoij' },
    ]);
  });

  it('membership_card: flattens multiple tiers + multiple rewards per tier in order', () => {
    const row = makeMembershipRow();
    row.settings.membershipTiers = [
      { name: 'Gold', rewards: [{ label: 'L1', value: 'V1' }, { label: 'L2', value: 'V2' }] },
      { name: 'Silver', rewards: [{ label: 'L3', value: 'V3' }] },
    ];
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.fields.backFields).toEqual([
      { key: '', type: 'text', label: 'L1', value: 'V1' },
      { key: '', type: 'text', label: 'L2', value: 'V2' },
      { key: '', type: 'text', label: 'L3', value: 'V3' },
    ]);
  });

  it('membership_card: skips reward rows with both label and value empty', () => {
    const row = makeMembershipRow();
    row.settings.membershipTiers = [
      {
        name: 'A',
        rewards: [
          { label: '', value: '' },
          { label: 'kept', value: 'kept-v' },
        ],
      },
    ];
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.fields.backFields).toEqual([
      { key: '', type: 'text', label: 'kept', value: 'kept-v' },
    ]);
  });

  it('membership_card: empty tiers + non-empty backFields → falls back to backFields (legacy transition state)', () => {
    // 邊緣: 用戶可能先建 backFields 再建 tier，這時 backFields 還有內容
    const row = makeMembershipRow();
    row.settings.membershipTiers = [];
    row.settings.backFields = [{ label: 'legacy', value: 'lv' }];
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.fields.backFields).toEqual([
      { key: '', type: 'text', label: 'legacy', value: 'lv' },
    ]);
  });

  it('membership_card: empty tiers + empty backFields → backFields = [] (graceful empty)', () => {
    const row = makeMembershipRow();
    row.settings.membershipTiers = [];
    row.settings.backFields = [];
    const body = mapTemplateToPasscreator({ template: row, language: 'en', r2PublicUrl: R2_URL });
    expect(body.fields.backFields).toEqual([]);
  });

  it('non-membership cardTypes: still use settings.backFields[] (regression — v9 behavior preserved)', () => {
    const row = makeRow({ card_type: 'discount_card' });
    row.settings.backFields = [{ label: '聯絡電話', value: '+886-2-1234-5678' }];
    // Even if a tenant happens to have membershipTiers (e.g. cardType
    // was switched after authoring), non-membership cardTypes DO NOT
    // read from it. This keeps the per-cardType contract explicit.
    row.settings.membershipTiers = [{ name: 'ignored', rewards: [{ label: 'IGNORED', value: 'x' }] }];
    const body = mapTemplateToPasscreator({ template: row, language: 'zh-TW', r2PublicUrl: R2_URL });
    expect(body.fields.backFields).toEqual([
      { key: '', type: 'text', label: '聯絡電話', value: '+886-2-1234-5678' },
    ]);
  });
});

/**
 * The expiry slot's Passcreator field TYPE (2026-10-26).
 *
 * Passcreator's `date` field type rejects a non-date string. A card
 * that never expires has no date to send — the runtime writes the
 * `∞` sentinel instead. So the template must declare the expiry slot
 * as `text` when SOME holder could have no expiry date, and as `date`
 * when EVERY holder is guaranteed one.
 */
describe('mapTemplateToPasscreator — expiry slot field type (2026-10-26)', () => {
  /** A row of the given card type with the given expiry settings. */
  function rowWithExpiry(
    cardType: TemplatesRow['card_type'],
    settings: Partial<TemplatesRow['settings']>,
  ): TemplatesRow {
    const row = makeRow({ card_type: cardType });
    row.settings = { ...row.settings, ...settings };
    return row;
  }

  it('membership_card with hasExpiry=false → the expiry slot is "text" (never expires)', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithExpiry('membership_card', { hasExpiry: false }),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.key).toBe('memberExpiry');
    expect(body.fields.headerFields[0]?.type).toBe('text');
  });

  it('membership_card with a guaranteed free-membership expiry → the expiry slot stays "date"', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithExpiry('membership_card', {
        hasExpiry: true,
        membershipExpiryMode: 'custom_days',
        membershipCustomExpiryDays: 30,
      }),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.key).toBe('memberExpiry');
    expect(body.fields.headerFields[0]?.type).toBe('date');
  });

  it('membership_card with NO expiry mode → the expiry slot is "text" (the paid tier duration is holder-level)', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithExpiry('membership_card', { hasExpiry: true }),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.type).toBe('text');
  });

  it('coupon_card without a validity period → the expiry slot is "text"', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithExpiry('coupon_card', { passValidDays: null, expiryDate: '' }),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.key).toBe('couponExpiry');
    expect(body.fields.headerFields[0]?.type).toBe('text');
  });

  it('coupon_card WITH passValidDays → the expiry slot stays "date"', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithExpiry('coupon_card', { passValidDays: 30 }),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.key).toBe('couponExpiry');
    expect(body.fields.headerFields[0]?.type).toBe('date');
  });

  it('discount_card without an expiry setting → the expiry slot is "text"', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithExpiry('discount_card', {
        discountCustomExpiryDays: null,
        discountSpecificExpiryDate: null,
      }),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.key).toBe('discountExpiry');
    expect(body.fields.headerFields[0]?.type).toBe('text');
  });

  it('discount_card WITH a custom day count → the expiry slot stays "date"', () => {
    const body = mapTemplateToPasscreator({
      template: rowWithExpiry('discount_card', { discountCustomExpiryDays: 60 }),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.key).toBe('discountExpiry');
    expect(body.fields.headerFields[0]?.type).toBe('date');
  });

  it('balance-kind card types are UNCHANGED (the slot is a number, never an expiry slot)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'reward_card' }),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.key).toBe('balance');
    expect(body.fields.headerFields[0]?.type).toBe('number');
  });
});
