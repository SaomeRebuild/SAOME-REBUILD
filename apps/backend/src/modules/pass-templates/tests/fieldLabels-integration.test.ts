/**
 * fieldLabels-integration test (2026-10-12 v12-followup).
 *
 * Drift guard: if a future refactor hardcodes labels, the editor preview
 * drifts from the deployed pass — invisible until production.
 *
 * Wire-format contract (post-v12-followup):
 *   - headerFields[0] is FIXED per cardType via `getHeaderField`.
 *   - primaryFields[] is RESERVED for membership_card.memberName.
 *   - secondaryFields[] = settings.leftField -> [0]; rightField -> [1].
 */

import { describe, it, expect } from 'vitest';
import { mapTemplateToPasscreator } from '../services/passTemplateMapping';
import { getFieldLabel, getHeaderField } from '@saome/shared/i18n/fieldLabels';
import type { TemplatesRow } from '@/modules/cards/db/templates';

const R2_URL = 'https://r2.example.com';

function makeRow(overrides: Partial<TemplatesRow['settings']> = {}): TemplatesRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    tenant_id: '00000000-0000-4000-8000-000000000002',
    status: 'draft',
    name: 'X',
    card_type: 'reward_card',
    settings: {
      cardType: 'reward_card',
      leftField: 'phone',
      rightField: 'email',
      barcodeType: 'qr_code',
      language: 'en',
      ...overrides,
    },
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    expires_at: undefined,
    passcreator_template_id: null,
  };
}

describe('passTemplateMapping integration with @saome/shared/i18n/fieldLabels', () => {
  it('headerField label = getHeaderField(cardType, language).label for zh-TW (regression drift guard)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    const header = getHeaderField('reward_card', 'zh-TW');
    expect(header).not.toBeNull();
    expect(body.fields.headerFields[0]?.label).toBe(header?.label);
    // 2026-10-12 v12-followup: primaryFields is [] for reward_card.
    expect(body.fields.primaryFields).toEqual([]);
  });

  it('headerField label = getHeaderField(cardType, language).label for en', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    const header = getHeaderField('reward_card', 'en');
    expect(header).not.toBeNull();
    expect(body.fields.headerFields[0]?.label).toBe(header?.label);
  });

  it('secondaryFields[0] label = getFieldLabel(leftField) for zh-TW', () => {
    // 2026-10-12 v12-followup: leftField -> secondaryFields[0].
    const body = mapTemplateToPasscreator({
      template: makeRow({ leftField: 'phone' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.secondaryFields[0]?.label).toBe(
      getFieldLabel('phone', 'zh-TW', 'reward_card'),
    );
    expect(body.fields.primaryFields).toEqual([]);
  });

  it('secondaryFields[0] label = getFieldLabel(leftField) for en', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ leftField: 'phone' }),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.secondaryFields[0]?.label).toBe(
      getFieldLabel('phone', 'en', 'reward_card'),
    );
  });

  it('secondaryFields[1] label = getFieldLabel(rightField) for zh-TW', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ rightField: 'email' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.secondaryFields[1]?.label).toBe(
      getFieldLabel('email', 'zh-TW', 'reward_card'),
    );
  });

  it('secondaryFields[1] label = getFieldLabel(rightField) for en', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ rightField: 'email' }),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.secondaryFields[1]?.label).toBe(
      getFieldLabel('email', 'en', 'reward_card'),
    );
  });

  it('regression: shared zh-TW label of phone propagates to mapping output (secondaryFields[0])', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ leftField: 'phone' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    const shared = getFieldLabel('phone', 'zh-TW', 'reward_card');
    expect(typeof body.fields.secondaryFields[0]?.label).toBe('string');
    expect(body.fields.secondaryFields[0]?.label).toBe(shared);
  });

  it('regression: shared headerField for a cardType propagates to mapping output (headerField)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow(),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    const shared = getHeaderField('reward_card', 'zh-TW');
    expect(shared).not.toBeNull();
    expect(body.fields.headerFields[0]?.label).toBe(shared?.label);
  });

  it('membership_card pushes memberName into primaryFields (reserved slot)', () => {
    const body = mapTemplateToPasscreator({
      template: { ...makeRow(), card_type: 'membership_card' },
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields[0]?.label).toBe(
      getFieldLabel('memberName', 'zh-TW', 'membership_card'),
    );
  });
});

describe('passTemplateMapping integration cardType-aware memberLevel override on secondaryFields', () => {
  it('zh-TW stamp_card: secondaryFields[0] pushes reward override', () => {
    const body = mapTemplateToPasscreator({
      template: { ...makeRow(), card_type: 'stamp_card', settings: { ...makeRow().settings, leftField: 'memberLevel' } },
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.secondaryFields[0]?.label).toBe(getFieldLabel('memberLevel', 'zh-TW', 'stamp_card'));
    expect(body.fields.primaryFields).toEqual([]);
    expect(body.fields.headerFields[0]?.label).toBe(getHeaderField('stamp_card', 'zh-TW')?.label);
  });

  it('zh-TW discount_card: secondaryFields[0] pushes discount tier override', () => {
    const body = mapTemplateToPasscreator({
      template: { ...makeRow(), card_type: 'discount_card', settings: { ...makeRow().settings, leftField: 'memberLevel' } },
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.secondaryFields[0]?.label).toBe(getFieldLabel('memberLevel', 'zh-TW', 'discount_card'));
    expect(body.fields.primaryFields).toEqual([]);
    expect(body.fields.headerFields[0]?.label).toBe(getHeaderField('discount_card', 'zh-TW')?.label);
  });

  it('en stamp_card: secondaryFields[0] pushes Reward', () => {
    const body = mapTemplateToPasscreator({
      template: { ...makeRow(), card_type: 'stamp_card', settings: { ...makeRow().settings, leftField: 'memberLevel' } },
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.secondaryFields[0]?.label).toBe(getFieldLabel('memberLevel', 'en', 'stamp_card'));
    expect(body.fields.primaryFields).toEqual([]);
    expect(body.fields.headerFields[0]?.label).toBe(getHeaderField('stamp_card', 'en')?.label);
  });

  it('zh-TW multipass: secondaryFields[1] pushes default member level', () => {
    const body = mapTemplateToPasscreator({
      template: { ...makeRow(), card_type: 'multipass', settings: { ...makeRow().settings, rightField: 'memberLevel' } },
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.secondaryFields[1]?.label).toBe(getFieldLabel('memberLevel', 'zh-TW', 'multipass'));
  });

  it('zh-TW gift_card: secondaryFields[0] pushes default member level', () => {
    const body = mapTemplateToPasscreator({
      template: { ...makeRow(), card_type: 'gift_card', settings: { ...makeRow().settings, leftField: 'memberLevel' } },
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.secondaryFields[0]?.label).toBe(getFieldLabel('memberLevel', 'zh-TW', 'gift_card'));
  });
});
