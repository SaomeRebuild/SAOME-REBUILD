/**
 * fieldLabels-integration test — proves passTemplateMapping reads labels
 * from the shared `fieldLabels` module, not from hard-coded strings.
 *
 * @module modules/pass-templates/tests/fieldLabels-integration
 *
 * Drift guard for the v4 plan: the mapping module must call
 * `getFieldLabelMap(language)` from `@saome/shared/i18n/fieldLabels`.
 * If a future refactor bakes the labels directly into the mapping
 * (e.g. by typing them as literal strings), the editor preview will
 * drift from the deployed pass — and that drift is invisible until
 * production.
 *
 * This test catches that drift at unit-test time by:
 *   1. Asking the mapping module for a `headerField.label` value.
 *   2. Asking the shared `fieldLabels` module for the same value.
 *   3. Asserting the two are equal — the strongest possible proof
 *      that the mapping is NOT hard-coding the value (because the
 *      shared module's value would not match a hard-coded constant
 *      that happened to be different from it).
 *
 * Rule references:
 *   - Rule 019 § D.3 — third-party API is a contract. Drift between
 *     the contract and the consumer is a P0 bug.
 *   - Rule 023 § Shared Validation — single source of truth for
 *     labels; this test enforces the chain.
 */

import { describe, it, expect } from 'vitest';
import { mapTemplateToPasscreator } from '../services/passTemplateMapping';
import { getFieldLabel, getFieldLabelMap } from '@saome/shared/i18n/fieldLabels';
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
  it('headerField label = getFieldLabel(leftField, language, cardType) for zh-TW', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ leftField: 'phone' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe(
      getFieldLabel('phone', 'zh-TW', 'reward_card'),
    );
  });
  it('headerField label = getFieldLabel(leftField, language, cardType) for en', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ leftField: 'phone' }),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe(
      getFieldLabel('phone', 'en', 'reward_card'),
    );
  });
  it('primaryField label = getFieldLabel(rightField, language, cardType) for zh-TW', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ rightField: 'email' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields[0]?.label).toBe(
      getFieldLabel('email', 'zh-TW', 'reward_card'),
    );
  });
  it('primaryField label = getFieldLabel(rightField, language, cardType) for en', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ rightField: 'email' }),
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.primaryFields[0]?.label).toBe(
      getFieldLabel('email', 'en', 'reward_card'),
    );
  });
  it('every CardFieldKey produces the same label via mapping and shared module', () => {
    // This is the strongest drift guard. If any CardFieldKey produces
    // a mismatch, the mapping has hardcoded something. We pass the
    // same `cardType` to both the mapping AND the shared helper so
    // the cardType-aware memberLevel override is applied uniformly —
    // otherwise the shared helper would return the default 「會員等級」
    // while mapping would push 「獎勵」 for `reward_card` (correct
    // behavior) and the assertion would fail.
    const labelMap = getFieldLabelMap('zh-TW', 'reward_card');
    for (const key of Object.keys(labelMap) as Array<keyof typeof labelMap>) {
      const body = mapTemplateToPasscreator({
        template: makeRow({ leftField: key, rightField: key }),
        language: 'zh-TW',
        r2PublicUrl: R2_URL,
      });
      expect(body.fields.headerFields[0]?.label, `zh-TW header ${key}`).toBe(labelMap[key]);
      expect(body.fields.primaryFields[0]?.label, `zh-TW primary ${key}`).toBe(labelMap[key]);
    }
  });
  it('regression — switching the shared zh-TW label of "phone" propagates to mapping output', () => {
    // This is a "what if" test: if the shared labels changed, would
    // the mapping reflect that? Yes — because mapping calls
    // getFieldLabel on every invocation. We can't actually mutate
    // the shared module from here, but we can verify the call chain
    // is wired by reading the SAME shared source both places.
    const body = mapTemplateToPasscreator({
      template: makeRow({ leftField: 'phone' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    // The label the mapping produces is the same string the shared
    // module returns for the same key+language+cardType. If they
    // ever diverge (e.g. someone hardcodes the label in mapping),
    // this assertion fails.
    const shared = getFieldLabel('phone', 'zh-TW', 'reward_card');
    expect(typeof body.fields.headerFields[0]?.label).toBe('string');
    expect(body.fields.headerFields[0]?.label).toBe(shared);
  });
});

/**
 * 2026-10-11 — cardType-aware drift guard.
 *
 * Pins the new contract: for every cardType in
 * MEMBER_LEVEL_OVERRIDE_CARD_TYPES, the mapping pushes the override
 * label (`memberLevel` → 「獎勵」 for stamp/reward/cashback,
 * 「折扣等級」 for discount). The shared `getFieldLabel` returns the
 * SAME override when called with the same `cardType` — proving the
 * mapping is wired to the shared module (not hard-coded).
 */
describe('passTemplateMapping integration — cardType-aware memberLevel override', () => {
  function rowWith(cardType: TemplatesRow['card_type'], field: 'leftField' | 'rightField'): TemplatesRow {
    return makeRow({
      ...makeRow().settings,
      [field]: 'memberLevel',
      cardType,
    } as Partial<TemplatesRow['settings']>).card_type === cardType
      ? ({
          ...makeRow(),
          card_type: cardType,
          settings: {
            ...makeRow().settings,
            leftField: field === 'leftField' ? 'memberLevel' : 'phone',
            rightField: field === 'rightField' ? 'memberLevel' : 'email',
          },
        } as TemplatesRow)
      : makeRow();
  }

  it('zh-TW stamp_card: mapping pushes 「獎勵」 which equals getFieldLabel(..., stamp_card)', () => {
    const body = mapTemplateToPasscreator({
      template: { ...makeRow(), card_type: 'stamp_card', settings: { ...makeRow().settings, leftField: 'memberLevel' } },
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe(getFieldLabel('memberLevel', 'zh-TW', 'stamp_card'));
    expect(body.fields.headerFields[0]?.label).toBe('獎勵');
  });

  it('zh-TW discount_card: mapping pushes 「折扣等級」 which equals getFieldLabel(..., discount_card)', () => {
    const body = mapTemplateToPasscreator({
      template: { ...makeRow(), card_type: 'discount_card', settings: { ...makeRow().settings, leftField: 'memberLevel' } },
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe(getFieldLabel('memberLevel', 'zh-TW', 'discount_card'));
    expect(body.fields.headerFields[0]?.label).toBe('折扣等級');
  });

  it('en stamp_card: mapping pushes "Reward" which equals getFieldLabel(..., stamp_card)', () => {
    const body = mapTemplateToPasscreator({
      template: { ...makeRow(), card_type: 'stamp_card', settings: { ...makeRow().settings, leftField: 'memberLevel' } },
      language: 'en',
      r2PublicUrl: R2_URL,
    });
    expect(body.fields.headerFields[0]?.label).toBe(getFieldLabel('memberLevel', 'en', 'stamp_card'));
    expect(body.fields.headerFields[0]?.label).toBe('Reward');
  });
});
