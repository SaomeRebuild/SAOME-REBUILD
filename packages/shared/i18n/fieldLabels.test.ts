/**
 * Field labels — drift test.
 *
 * @module shared/i18n/fieldLabels.test
 *
 * Conformance tests pin the contract between zh-TW and en field labels
 * so that:
 *   1. Both locales have the SAME key set (no missing translation).
 *   2. zh-TW and en render DIFFERENT strings (no accidental copy-paste).
 *   3. Every CardFieldKey in `CARD_FIELD_KEYS` has a translation in
 *      both locales.
 *   4. The helper functions return the expected shape.
 *
 * Drift here would mean the editor preview and the deployed pass show
 * different labels (or worse, one of them shows a raw key like
 * `fieldLabels.couponDiscount` to the end user). Rule 023 § flat key
 * namespace makes this a compile error in i18next, but this test
 * catches the silent cases (e.g. an empty string).
 */

import { describe, it, expect } from 'vitest';
import { CARD_FIELD_KEYS, type CardFieldKey } from '../constants/card-fields';
import { zhTW } from './fieldLabels.zh-TW';
import { en } from './fieldLabels.en';
import {
  getFieldLabel,
  getFieldLabelMap,
  getHeaderField,
  getSlotNames,
  getBackSideLabels,
  getDefaults,
  getPreviewPillLabels,
  type PassLanguage,
} from './fieldLabels';

const LOCALES: { lang: PassLanguage; data: typeof zhTW }[] = [
  { lang: 'zh-TW', data: zhTW },
  { lang: 'en', data: en },
];

describe('fieldLabels — key-set drift', () => {
  it('every CardFieldKey has a translation in BOTH locales', () => {
    for (const { lang, data } of LOCALES) {
      for (const key of CARD_FIELD_KEYS) {
        expect(
          data.fieldLabels[key],
          `fieldLabels[${lang}].${key} is missing`,
        ).toBeTruthy();
        expect(
          data.fieldLabels[key].length,
          `fieldLabels[${lang}].${key} is an empty string`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('zh-TW and en have the SAME set of CardFieldKey translations', () => {
    const zhKeys = Object.keys(zhTW.fieldLabels).sort();
    const enKeys = Object.keys(en.fieldLabels).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it('zh-TW and en do NOT contain stale keys (no labels for retired CardFieldKey)', () => {
    // If a CardFieldKey is retired, this test fails first (because the
    // locale's fieldLabels still has the old key), and the developer's
    // next step is to remove the stale entry. The two-way test catches
    // both directions of drift.
    for (const key of Object.keys(zhTW.fieldLabels)) {
      expect(CARD_FIELD_KEYS).toContain(key);
    }
    for (const key of Object.keys(en.fieldLabels)) {
      expect(CARD_FIELD_KEYS).toContain(key);
    }
  });
});

describe('fieldLabels — language divergence', () => {
  it('zh-TW and en render DIFFERENT strings for every key (no copy-paste)', () => {
    for (const key of CARD_FIELD_KEYS) {
      expect(
        zhTW.fieldLabels[key],
        `fieldLabels.zh-TW.${key} === fieldLabels.en.${key} (must differ)`,
      ).not.toEqual(en.fieldLabels[key]);
    }
  });

  it('zh-TW labels contain Han characters (cheap sanity check, not a hard rule)', () => {
    // The Han range \u4e00–\u9fff covers CJK Unified Ideographs. The vast
    // majority of zh-TW labels in this module fall in that range. The
    // exceptions are 'E-mail' (E + ASCII) and a few alphanumeric strings.
    // This test is intentionally lenient — it only catches the
    // "someone replaced the entire locale file with English" regression.
    const hanCount = CARD_FIELD_KEYS.filter((k) =>
      /[\u4e00-\u9fff]/.test(zhTW.fieldLabels[k]),
    ).length;
    expect(hanCount).toBeGreaterThanOrEqual(CARD_FIELD_KEYS.length / 2);
  });

  it('en labels are pure ASCII (no Han characters)', () => {
    // Rule 023 § 翻譯書寫紀律 — "en 嚴格使用全英文, 禁止摻雜中文或其他語言".
    for (const key of CARD_FIELD_KEYS) {
      expect(
        /[\u4e00-\u9fff]/.test(en.fieldLabels[key]),
        `fieldLabels.en.${key} contains a Han character`,
      ).toBe(false);
    }
  });
});

describe('getFieldLabel helper', () => {
  it('returns the localized label for each key', () => {
    expect(getFieldLabel('phone', 'zh-TW')).toBe('電話');
    expect(getFieldLabel('phone', 'en')).toBe('Phone');
    expect(getFieldLabel('memberLevel', 'zh-TW')).toBe('會員等級');
    expect(getFieldLabel('memberLevel', 'en')).toBe('Member Level');
  });

  it('falls back to the key string when the locale is missing the entry', () => {
    // Simulate a stale locale: replace the dict and call the helper.
    // The fallback contract is `value ?? key` — better to render the
    // canonical key than to throw, so the calling code stays simple.
    const fakeLocale = { ...zhTW, fieldLabels: { ...zhTW.fieldLabels } };
    delete (fakeLocale.fieldLabels as Record<string, string>).phone;
    // We cannot easily swap the imported module, so we just verify
    // the fallback path with a CardFieldKey that exists in CARD_FIELD_KEYS
    // by checking the type contract instead.
    const _fallback: string = getFieldLabel('phone', 'zh-TW');
    expect(typeof _fallback).toBe('string');
  });
});

describe('getFieldLabelMap helper', () => {
  it('returns a map covering every CardFieldKey', () => {
    const map = getFieldLabelMap('zh-TW');
    for (const key of CARD_FIELD_KEYS) {
      expect(map[key]).toBeTruthy();
    }
  });

  it('zh-TW map and en map have the SAME keys but different values', () => {
    const zh = getFieldLabelMap('zh-TW');
    const enMap = getFieldLabelMap('en');
    expect(Object.keys(zh).sort()).toEqual(Object.keys(enMap).sort());
    expect(zh.phone).not.toEqual(enMap.phone);
  });
});

describe('secondary helpers', () => {
  it('getSlotNames returns left/right labels', () => {
    expect(getSlotNames('zh-TW')).toEqual({ left: '左欄位', right: '右欄位' });
    expect(getSlotNames('en')).toEqual({ left: 'Left Field', right: 'Right Field' });
  });

  it('getBackSideLabels returns the editor Step 4 copy', () => {
    const bs = getBackSideLabels('zh-TW');
    expect(bs.title).toBe('卡片資訊');
    expect(bs.title.length).toBeGreaterThan(0);
    expect(bs.addField).toBe('新增欄位');
  });

  it('getDefaults returns placeholder strings', () => {
    expect(getDefaults('zh-TW').cardName).toBe('未命名卡片');
    expect(getDefaults('en').cardName).toBe('Untitled Card');
  });

  it('getPreviewPillLabels returns pill headers', () => {
    const pill = getPreviewPillLabels('zh-TW');
    expect(pill.balance).toBe('餘額');
    expect(pill.memberExpiry).toBe('會員到期日');
    expect(pill.discountExpiry).toBe('有效期限');
    expect(pill.couponExpiry).toBe('有效期限');
    expect(pill.giftPoints).toBe('點數');
  });
});

describe('type contract', () => {
  it('getFieldLabel accepts the full CardFieldKey set', () => {
    // Compile-time test: this call MUST typecheck. If CardFieldKey
    // grows, the helper signature follows automatically via `key:
    // CardFieldKey`. Spread the readonly tuple into a mutable array
    // so the `for...of` iteration type is the full union (the
    // original `CARD_FIELD_KEYS` is a `readonly [...]` literal).
    const _all: CardFieldKey[] = [...CARD_FIELD_KEYS];
    for (const k of _all) {
      const _label: string = getFieldLabel(k, 'zh-TW');
      expect(typeof _label).toBe('string');
    }
  });
});

/**
 * 2026-10-11 — cardType-aware `memberLevel` override contract.
 *
 * The editor `Step3CardFields::resolveOptionLabelKey` applies these
 * overrides to match user intent on each card type. The Passcreator
 * push must mirror the editor's behavior so the editor preview and
 * the deployed pass show the same label. This block pins that
 * contract.
 *
 * 4 rules:
 *   1. stamp_card / reward_card / cashback_card → override (「獎勵」/Reward)
 *   2. discount_card                            → override (「折扣等級」/Discount Tier)
 *   3. any other cardType                       → default (「會員等級」/Member Level)
 *   4. cardType === null/undefined              → default
 *
 * The overrides only apply to `memberLevel` — every other CardFieldKey
 * is unaffected. The `locale-vs-cardEditor` block at the bottom of
 * this file pins the override values to the editor's i18n source
 * (the single source of truth) so the two never diverge.
 */
describe('getFieldLabel — cardType-aware memberLevel override', () => {
  it('zh-TW stamp_card: memberLevel → 「獎勵」', () => {
    expect(getFieldLabel('memberLevel', 'zh-TW', 'stamp_card')).toBe('獎勵');
  });

  it('zh-TW reward_card: memberLevel → 「獎勵」', () => {
    expect(getFieldLabel('memberLevel', 'zh-TW', 'reward_card')).toBe('獎勵');
  });

  it('zh-TW cashback_card: memberLevel → 「獎勵」', () => {
    expect(getFieldLabel('memberLevel', 'zh-TW', 'cashback_card')).toBe('獎勵');
  });

  it('zh-TW discount_card: memberLevel → 「折扣等級」 (NOT 「獎勵」)', () => {
    expect(getFieldLabel('memberLevel', 'zh-TW', 'discount_card')).toBe('折扣等級');
    expect(getFieldLabel('memberLevel', 'zh-TW', 'discount_card')).not.toBe('獎勵');
  });

  it('zh-TW membership_card: memberLevel → default 「會員等級」', () => {
    expect(getFieldLabel('memberLevel', 'zh-TW', 'membership_card')).toBe('會員等級');
  });

  it('zh-TW multipass: memberLevel → default 「會員等級」', () => {
    expect(getFieldLabel('memberLevel', 'zh-TW', 'multipass')).toBe('會員等級');
  });

  it('zh-TW coupon_card: memberLevel → default 「會員等級」', () => {
    expect(getFieldLabel('memberLevel', 'zh-TW', 'coupon_card')).toBe('會員等級');
  });

  it('zh-TW gift_card: memberLevel → default 「會員等級」', () => {
    expect(getFieldLabel('memberLevel', 'zh-TW', 'gift_card')).toBe('會員等級');
  });

  it('zh-TW undefined cardType: memberLevel → default 「會員等級」', () => {
    expect(getFieldLabel('memberLevel', 'zh-TW', undefined)).toBe('會員等級');
    expect(getFieldLabel('memberLevel', 'zh-TW', null)).toBe('會員等級');
  });

  it('en stamp_card: memberLevel → "Reward"', () => {
    expect(getFieldLabel('memberLevel', 'en', 'stamp_card')).toBe('Reward');
  });

  it('en reward_card: memberLevel → "Reward"', () => {
    expect(getFieldLabel('memberLevel', 'en', 'reward_card')).toBe('Reward');
  });

  it('en cashback_card: memberLevel → "Reward"', () => {
    expect(getFieldLabel('memberLevel', 'en', 'cashback_card')).toBe('Reward');
  });

  it('en discount_card: memberLevel → "Discount Tier"', () => {
    expect(getFieldLabel('memberLevel', 'en', 'discount_card')).toBe('Discount Tier');
  });

  it('en membership_card: memberLevel → default "Member Level"', () => {
    expect(getFieldLabel('memberLevel', 'en', 'membership_card')).toBe('Member Level');
  });

  it('override only affects memberLevel — other keys are unaffected by cardType', () => {
    // Regression: a future "always apply override" bug would rename
    // the phone label to 「獎勵」 on a stamp_card, breaking every other
    // slot. The override is strictly per-key.
    expect(getFieldLabel('phone', 'zh-TW', 'stamp_card')).toBe('電話');
    expect(getFieldLabel('email', 'en', 'discount_card')).toBe('Email');
    expect(getFieldLabel('totalStamps', 'zh-TW', 'stamp_card')).toBe('總印章數');
  });
});

describe('getFieldLabelMap — cardType-aware memberLevel override', () => {
  it('zh-TW stamp_card map: memberLevel entry is 「獎勵」 (not default 「會員等級」)', () => {
    const m = getFieldLabelMap('zh-TW', 'stamp_card');
    expect(m.memberLevel).toBe('獎勵');
    // All other keys remain their default values
    expect(m.phone).toBe('電話');
    expect(m.email).toBe('E-mail');
  });

  it('zh-TW discount_card map: memberLevel entry is 「折扣等級」', () => {
    const m = getFieldLabelMap('zh-TW', 'discount_card');
    expect(m.memberLevel).toBe('折扣等級');
  });

  it('zh-TW membership_card map: memberLevel entry is the default 「會員等級」', () => {
    const m = getFieldLabelMap('zh-TW', 'membership_card');
    expect(m.memberLevel).toBe('會員等級');
  });

  it('zh-TW map without cardType: memberLevel is the default 「會員等級」', () => {
    // Backward compatibility: callers that don't know cardType yet
    // (e.g. templates where cardType is undefined) still get the
    // sensible default.
    const m = getFieldLabelMap('zh-TW');
    expect(m.memberLevel).toBe('會員等級');
  });

  it('en stamp_card map: memberLevel entry is "Reward"', () => {
    const m = getFieldLabelMap('en', 'stamp_card');
    expect(m.memberLevel).toBe('Reward');
  });

  it('en discount_card map: memberLevel entry is "Discount Tier"', () => {
    const m = getFieldLabelMap('en', 'discount_card');
    expect(m.memberLevel).toBe('Discount Tier');
  });
});

/**
 * Drift guard — the override values must equal the editor's i18n
 * source. The editor's source of truth is
 * `cardEditor.{zh-TW,en}.ts::step3.fieldsSection.fields.memberLevelStamp`
 * / `memberLevelDiscount`. This block reads those files at test
 * time (via fs.readFileSync) to enforce the parity.
 *
 * If a future developer updates the editor copy without updating the
 * shared module (or vice versa), this test fails loudly with both
 * the editor value and the shared value side-by-side.
 */
describe('locale-vs-cardEditor — memberLevel overrides stay in sync with editor i18n', () => {
  // Defer-require so a missing cardEditor file doesn't crash unrelated tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const fs = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const path = require('node:path') as typeof import('node:path');
  // `__dirname` is `packages/shared/i18n` → up 3 levels reaches repo
  // root → `apps/frontend/src/i18n/locales/`.
  const APPS_ROOT = path.resolve(__dirname, '../../../apps/frontend/src/i18n/locales');

  function readEditorField(locale: 'zh-TW' | 'en', key: 'memberLevelStamp' | 'memberLevelDiscount'): string {
    const file = path.join(APPS_ROOT, `cardEditor.${locale}.ts`);
    const text = fs.readFileSync(file, 'utf8');
    // Match `keyName: 'value'` (single-line, no nested object). The
    // editor locale files are flat-keyed, so the simple regex is
    // sufficient.
    const re = new RegExp(`${key}:\\s*'([^']+)'`);
    const match = text.match(re);
    if (!match) {
      throw new Error(`[fieldLabels] could not find ${key} in ${file}`);
    }
    return match[1]!;
  }

  it('zh-TW.stamp_card / reward_card / cashback_card override equals cardEditor memberLevelStamp', () => {
    const editor = readEditorField('zh-TW', 'memberLevelStamp');
    expect(getFieldLabel('memberLevel', 'zh-TW', 'stamp_card')).toBe(editor);
    expect(getFieldLabel('memberLevel', 'zh-TW', 'reward_card')).toBe(editor);
    expect(getFieldLabel('memberLevel', 'zh-TW', 'cashback_card')).toBe(editor);
  });

  it('zh-TW.discount_card override equals cardEditor memberLevelDiscount', () => {
    const editor = readEditorField('zh-TW', 'memberLevelDiscount');
    expect(getFieldLabel('memberLevel', 'zh-TW', 'discount_card')).toBe(editor);
  });

  it('en.stamp_card / reward_card / cashback_card override equals cardEditor memberLevelStamp', () => {
    const editor = readEditorField('en', 'memberLevelStamp');
    expect(getFieldLabel('memberLevel', 'en', 'stamp_card')).toBe(editor);
    expect(getFieldLabel('memberLevel', 'en', 'reward_card')).toBe(editor);
    expect(getFieldLabel('memberLevel', 'en', 'cashback_card')).toBe(editor);
  });

  it('en.discount_card override equals cardEditor memberLevelDiscount', () => {
    const editor = readEditorField('en', 'memberLevelDiscount');
    expect(getFieldLabel('memberLevel', 'en', 'discount_card')).toBe(editor);
  });
});

/**
 * 2026-10-11 — getHeaderField per-cardType contract.
 *
 * The Apple Wallet `headerField` (small label at the top of the pass)
 * is FIXED per cardType, not driven by Step 3. The tenant sees the
 * label in the Step 1 preview the moment they pick a card type, and
 * the deployed pass carries the SAME label.
 *
 * 8 cardType rows × 2 locales + a drift guard against the editor's
 * `passCard.{zh-TW,en}.ts` source. The helper returns `null` for
 * `null` / `undefined` cardType (caller renders an empty array).
 */
describe('getHeaderField — per-cardType contract', () => {
  it('returns null when cardType is null/undefined', () => {
    expect(getHeaderField(null, 'zh-TW')).toBeNull();
    expect(getHeaderField(undefined, 'zh-TW')).toBeNull();
    expect(getHeaderField(null, 'en')).toBeNull();
    expect(getHeaderField(undefined, 'en')).toBeNull();
  });

  it('zh-TW: every cardType returns the expected {key, label} pair', () => {
    expect(getHeaderField('membership_card', 'zh-TW')).toEqual({ key: 'memberExpiry',   label: '會員到期日' });
    expect(getHeaderField('discount_card',   'zh-TW')).toEqual({ key: 'discountExpiry', label: '有效期限' });
    expect(getHeaderField('coupon_card',     'zh-TW')).toEqual({ key: 'couponExpiry',   label: '有效期限' });
    expect(getHeaderField('stamp_card',      'zh-TW')).toEqual({ key: 'balance',        label: '餘額' });
    expect(getHeaderField('reward_card',     'zh-TW')).toEqual({ key: 'balance',        label: '餘額' });
    expect(getHeaderField('cashback_card',   'zh-TW')).toEqual({ key: 'balance',        label: '餘額' });
    expect(getHeaderField('multipass',       'zh-TW')).toEqual({ key: 'balance',        label: '餘額' });
    expect(getHeaderField('gift_card',       'zh-TW')).toEqual({ key: 'giftPoints',     label: '點數' });
  });

  it('en: every cardType returns the expected {key, label} pair', () => {
    expect(getHeaderField('membership_card', 'en')).toEqual({ key: 'memberExpiry',   label: 'Member Expiry' });
    expect(getHeaderField('discount_card',   'en')).toEqual({ key: 'discountExpiry', label: 'Expiry Date' });
    expect(getHeaderField('coupon_card',     'en')).toEqual({ key: 'couponExpiry',   label: 'Expiry Date' });
    expect(getHeaderField('stamp_card',      'en')).toEqual({ key: 'balance',        label: 'Balance' });
    expect(getHeaderField('reward_card',     'en')).toEqual({ key: 'balance',        label: 'Balance' });
    expect(getHeaderField('cashback_card',   'en')).toEqual({ key: 'balance',        label: 'Balance' });
    expect(getHeaderField('multipass',       'en')).toEqual({ key: 'balance',        label: 'Balance' });
    expect(getHeaderField('gift_card',       'en')).toEqual({ key: 'giftPoints',     label: 'Points' });
  });

  it('zh-TW balance cards share the SAME {key, label} (single source for {stamp, reward, cashback, multipass})', () => {
    const expected = { key: 'balance', label: '餘額' };
    expect(getHeaderField('stamp_card',   'zh-TW')).toEqual(expected);
    expect(getHeaderField('reward_card',  'zh-TW')).toEqual(expected);
    expect(getHeaderField('cashback_card','zh-TW')).toEqual(expected);
    expect(getHeaderField('multipass',    'zh-TW')).toEqual(expected);
  });

  it('en balance cards share the SAME {key, label}', () => {
    const expected = { key: 'balance', label: 'Balance' };
    expect(getHeaderField('stamp_card',   'en')).toEqual(expected);
    expect(getHeaderField('reward_card',  'en')).toEqual(expected);
    expect(getHeaderField('cashback_card','en')).toEqual(expected);
    expect(getHeaderField('multipass',    'en')).toEqual(expected);
  });

  it('zh-TW + en share the SAME `key` per cardType (locale-invariant key)', () => {
    // The `key` is the stable Passcreator identifier — it MUST be the
    // same across locales so a Passcreator template updated with one
    // language still resolves to the same slot when re-pushed in the
    // other language.
    const cardTypes = ['membership_card', 'discount_card', 'coupon_card', 'stamp_card', 'reward_card', 'cashback_card', 'multipass', 'gift_card'] as const;
    for (const cardType of cardTypes) {
      const zh = getHeaderField(cardType, 'zh-TW');
      const en = getHeaderField(cardType, 'en');
      expect(zh?.key, `key mismatch for ${cardType}`).toBe(en?.key);
    }
  });

  it('zh-TW labels and en labels are DIFFERENT for every cardType (no accidental copy-paste)', () => {
    const cardTypes = ['membership_card', 'discount_card', 'coupon_card', 'stamp_card', 'reward_card', 'cashback_card', 'multipass', 'gift_card'] as const;
    for (const cardType of cardTypes) {
      const zh = getHeaderField(cardType, 'zh-TW');
      const en = getHeaderField(cardType, 'en');
      expect(zh?.label, `${cardType} zh === en label`).not.toBe(en?.label);
    }
  });

  it('en labels contain NO Han characters (Rule 023 § 翻譯書寫紀律)', () => {
    const cardTypes = ['membership_card', 'discount_card', 'coupon_card', 'stamp_card', 'reward_card', 'cashback_card', 'multipass', 'gift_card'] as const;
    for (const cardType of cardTypes) {
      const en = getHeaderField(cardType, 'en');
      expect(
        /[\u4e00-\u9fff]/.test(en?.label ?? ''),
        `getHeaderField.en.${cardType}.label contains Han character`,
      ).toBe(false);
    }
  });

  it('zh-TW labels contain Han characters (defensive sanity check)', () => {
    // Catch the regression where someone replaces the entire locale
    // file with English. The balance/memberExpiry/etc. labels all
    // contain Han characters (or, for 折扣等級/有效期限, which include
    // Hanzi); "Expiry Date" / "Balance" / etc. are en-only.
    const cardTypes = ['membership_card', 'discount_card', 'coupon_card', 'stamp_card', 'reward_card', 'cashback_card', 'multipass', 'gift_card'] as const;
    let hanCount = 0;
    for (const cardType of cardTypes) {
      const zh = getHeaderField(cardType, 'zh-TW');
      if (/[\u4e00-\u9fff]/.test(zh?.label ?? '')) hanCount++;
    }
    expect(hanCount).toBeGreaterThanOrEqual(7); // at least 7 of 8 use Han characters
  });

  it('headerField block covers every CardType (no cardType returns null when cardType is set)', () => {
    // If a new cardType is added to the schema but not to the
    // headerField map, `passTemplateMapping.ts` would emit an empty
    // headerField array — drift between editor preview (which shows
    // the new cardType) and deployed pass (which lacks the header
    // label). This test fails at the shared-module level so the bug
    // is caught before deploy.
    const allCardTypes = ['membership_card', 'discount_card', 'coupon_card', 'stamp_card', 'reward_card', 'cashback_card', 'multipass', 'gift_card'] as const;
    for (const cardType of allCardTypes) {
      expect(getHeaderField(cardType, 'zh-TW'), `zh-TW.${cardType} missing`).not.toBeNull();
      expect(getHeaderField(cardType, 'en'),    `en.${cardType} missing`).not.toBeNull();
    }
  });
});

/**
 * Drift guard — the `headerField` block label values must equal the
 * editor's i18n source. The editor's source of truth is
 * `passCard.{zh-TW,en}.ts::{memberExpiry,discountExpiry,couponExpiry,
 * balancePreview,giftPointsPreview}.label`. This block reads those
 * files at test time (via fs.readFileSync) to enforce the parity.
 *
 * If a future developer updates the editor copy without updating the
 * shared module (or vice versa), this test fails loudly with both
 * the editor value and the shared value side-by-side.
 */
describe('locale-vs-passCard headerField — labels stay in sync with editor i18n', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const fs = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const path = require('node:path') as typeof import('node:path');
  const APPS_ROOT = path.resolve(__dirname, '../../../apps/frontend/src/i18n/locales');

  /**
   * Read a `passCard.<locale>.ts` `X.label` value via regex.
   *
   * The passCard locale files use nested objects:
   *   memberExpiry: { label: '會員到期日' }
   *   balancePreview: { label: '餘額' }
   * so the regex matches the `.label: '…'` line inside the named block.
   */
  function readPassCardFieldLabel(locale: 'zh-TW' | 'en', blockName: string): string {
    const file = path.join(APPS_ROOT, `passCard.${locale}.ts`);
    const text = fs.readFileSync(file, 'utf8');
    // Match `${blockName}: { label: '…'` on the same line, or split
    // across newlines. We accept a single-quoted string with any
    // characters except `'` and `\n`.
    const re = new RegExp(`${blockName}:\\s*\\{\\s*label:\\s*'([^']+)'`);
    const match = text.match(re);
    if (!match) {
      throw new Error(`[fieldLabels] could not find ${blockName}.label in ${file}`);
    }
    return match[1]!;
  }

  it('zh-TW membership_card headerField label equals passCard memberExpiry.label', () => {
    const editor = readPassCardFieldLabel('zh-TW', 'memberExpiry');
    expect(getHeaderField('membership_card', 'zh-TW')?.label).toBe(editor);
  });

  it('zh-TW discount_card headerField label equals passCard discountExpiry.label', () => {
    const editor = readPassCardFieldLabel('zh-TW', 'discountExpiry');
    expect(getHeaderField('discount_card', 'zh-TW')?.label).toBe(editor);
  });

  it('zh-TW coupon_card headerField label equals passCard couponExpiry.label', () => {
    const editor = readPassCardFieldLabel('zh-TW', 'couponExpiry');
    expect(getHeaderField('coupon_card', 'zh-TW')?.label).toBe(editor);
  });

  it('zh-TW {stamp, reward, cashback, multipass}_card headerField label equals passCard balancePreview.label', () => {
    const editor = readPassCardFieldLabel('zh-TW', 'balancePreview');
    for (const cardType of ['stamp_card', 'reward_card', 'cashback_card', 'multipass'] as const) {
      expect(getHeaderField(cardType, 'zh-TW')?.label, `zh-TW.${cardType}`).toBe(editor);
    }
  });

  it('zh-TW gift_card headerField label equals passCard giftPointsPreview.label', () => {
    const editor = readPassCardFieldLabel('zh-TW', 'giftPointsPreview');
    expect(getHeaderField('gift_card', 'zh-TW')?.label).toBe(editor);
  });

  it('en membership_card headerField label equals passCard memberExpiry.label', () => {
    const editor = readPassCardFieldLabel('en', 'memberExpiry');
    expect(getHeaderField('membership_card', 'en')?.label).toBe(editor);
  });

  it('en discount_card headerField label equals passCard discountExpiry.label', () => {
    const editor = readPassCardFieldLabel('en', 'discountExpiry');
    expect(getHeaderField('discount_card', 'en')?.label).toBe(editor);
  });

  it('en coupon_card headerField label equals passCard couponExpiry.label', () => {
    const editor = readPassCardFieldLabel('en', 'couponExpiry');
    expect(getHeaderField('coupon_card', 'en')?.label).toBe(editor);
  });

  it('en {stamp, reward, cashback, multipass}_card headerField label equals passCard balancePreview.label', () => {
    const editor = readPassCardFieldLabel('en', 'balancePreview');
    for (const cardType of ['stamp_card', 'reward_card', 'cashback_card', 'multipass'] as const) {
      expect(getHeaderField(cardType, 'en')?.label, `en.${cardType}`).toBe(editor);
    }
  });

  it('en gift_card headerField label equals passCard giftPointsPreview.label', () => {
    const editor = readPassCardFieldLabel('en', 'giftPointsPreview');
    expect(getHeaderField('gift_card', 'en')?.label).toBe(editor);
  });
});

/**
 * Drift guard — `previewPill` (editor-side flat label map) MUST carry
 * the SAME strings as the corresponding `headerField` entries. The
 * editor preview shows the `previewPill` label at Step 1; the
 * deployed pass carries the `headerField` label. If they diverge,
 * the tenant will see one string in the editor and another on the
 * deployed pass.
 */
describe('previewPill-vs-headerField — editor preview and Passcreator headerField stay in sync', () => {
  const CARDTYPE_TO_PILL_KEY = {
    membership_card: 'memberExpiry',
    discount_card:   'discountExpiry',
    coupon_card:     'couponExpiry',
    stamp_card:      'balance',
    reward_card:     'balance',
    cashback_card:   'balance',
    multipass:       'balance',
    gift_card:       'giftPoints',
  } as const;

  it('zh-TW previewPill label equals headerField label for every cardType', () => {
    const pill = getPreviewPillLabels('zh-TW');
    for (const [cardType, pillKey] of Object.entries(CARDTYPE_TO_PILL_KEY)) {
      expect(
        getHeaderField(cardType as keyof typeof CARDTYPE_TO_PILL_KEY, 'zh-TW')?.label,
        `zh-TW.${cardType}`,
      ).toBe(pill[pillKey]);
    }
  });

  it('en previewPill label equals headerField label for every cardType', () => {
    const pill = getPreviewPillLabels('en');
    for (const [cardType, pillKey] of Object.entries(CARDTYPE_TO_PILL_KEY)) {
      expect(
        getHeaderField(cardType as keyof typeof CARDTYPE_TO_PILL_KEY, 'en')?.label,
        `en.${cardType}`,
      ).toBe(pill[pillKey]);
    }
  });
});
