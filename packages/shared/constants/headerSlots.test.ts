/**
 * Header slot spec — conformance tests.
 *
 * @module shared/constants/headerSlots.test
 *
 * The header-slot rule ("which card type shows which header value,
 * under which Passcreator key, with which test id") used to be
 * duplicated across four files. These tests pin the single source of
 * truth that replaced them:
 *
 *   1. PARTITION — every one of the 8 card types maps to exactly one
 *      header kind, and every kind is reachable. A card type with no
 *      row (or a kind no card type uses) is a spec bug.
 *   2. KEY — the Passcreator key is unique per kind and
 *      locale-invariant.
 *   3. TEST ID — the `data-testid` is unique per kind, so the
 *      selector-based regression tests can't accidentally match the
 *      wrong element.
 *
 * Rule references:
 *   - Rule 019 § 4.1 — the spec IS the contract for the header slot;
 *     both the frontend preview and the backend template push read it.
 *   - Rule 024 § Mobile Future-Proof — pure data, no platform API.
 */

import { describe, it, expect } from 'vitest';
import {
  HEADER_SLOTS,
  HEADER_SLOT_KINDS,
  HEADER_SLOT_KIND_SPECS,
  getHeaderSlot,
  type HeaderSlotKind,
} from './headerSlots';
import { cardTypeSchema, type CardType } from '../schemas/card';

const ALL_CARD_TYPES = cardTypeSchema.options;

/**
 * Resolve every schema card type through the public lookup and keep only
 * those that reach `kind`. This asserts the INVERSE of the mapping table:
 * each kind must be reachable from its own card-type set and no others.
 */
function cardTypesResolvingTo(kind: HeaderSlotKind): CardType[] {
  return ALL_CARD_TYPES.filter((cardType) => getHeaderSlot(cardType)?.kind === kind).sort();
}

describe('HEADER_SLOTS — partition (every card type has exactly one kind)', () => {
  it('covers EVERY card type in the schema (no orphan card type)', () => {
    for (const cardType of ALL_CARD_TYPES) {
      expect(
        HEADER_SLOTS[cardType],
        `HEADER_SLOTS is missing a row for cardType="${cardType}"`,
      ).toBeDefined();
    }
  });

  it('has NO extra rows beyond the schema card types', () => {
    expect(Object.keys(HEADER_SLOTS).sort()).toEqual([...ALL_CARD_TYPES].sort());
  });

  it('every mapped kind is a declared kind', () => {
    for (const cardType of ALL_CARD_TYPES) {
      expect(HEADER_SLOT_KINDS).toContain(HEADER_SLOTS[cardType]);
    }
  });

  it('every declared kind is reachable from at least one card type', () => {
    const used = new Set<HeaderSlotKind>(ALL_CARD_TYPES.map((c) => HEADER_SLOTS[c]));
    for (const kind of HEADER_SLOT_KINDS) {
      expect(used.has(kind), `header kind "${kind}" is not used by any card type`).toBe(true);
    }
  });

  it('the 8 card types partition into exactly 5 kinds', () => {
    const used = new Set(ALL_CARD_TYPES.map((c) => HEADER_SLOTS[c]));
    expect(used.size).toBe(5);
    expect(HEADER_SLOT_KINDS.length).toBe(5);
  });

  it('the documented partition holds (regression — 2026-10-24)', () => {
    // If this fails, the spec was changed in a way that alters which
    // card type shows which header value — a user-visible change that
    // must be a deliberate, reviewed decision.
    expect(HEADER_SLOTS).toEqual({
      membership_card: 'member_expiry',
      discount_card: 'discount_expiry',
      coupon_card: 'coupon_expiry',
      stamp_card: 'balance',
      reward_card: 'balance',
      cashback_card: 'balance',
      multipass: 'balance',
      gift_card: 'gift_points',
    } satisfies Record<CardType, HeaderSlotKind>);
  });
});

describe('getHeaderSlot — kind reachability is exclusive', () => {
  it('balance is reachable from exactly the 4 balance card types', () => {
    expect(cardTypesResolvingTo('balance')).toEqual([
      'cashback_card',
      'multipass',
      'reward_card',
      'stamp_card',
    ]);
  });

  it('member_expiry is reachable only from membership_card', () => {
    expect(cardTypesResolvingTo('member_expiry')).toEqual(['membership_card']);
  });

  it('discount_expiry is reachable only from discount_card', () => {
    expect(cardTypesResolvingTo('discount_expiry')).toEqual(['discount_card']);
  });

  it('coupon_expiry is reachable only from coupon_card', () => {
    expect(cardTypesResolvingTo('coupon_expiry')).toEqual(['coupon_card']);
  });

  it('gift_points is reachable only from gift_card', () => {
    expect(cardTypesResolvingTo('gift_points')).toEqual(['gift_card']);
  });
});

describe('HEADER_SLOT_KIND_SPECS — key', () => {
  it('every kind has a non-empty Passcreator key', () => {
    for (const kind of HEADER_SLOT_KINDS) {
      expect(HEADER_SLOT_KIND_SPECS[kind].passcreatorKey.length).toBeGreaterThan(0);
    }
  });

  it('Passcreator keys are UNIQUE across kinds', () => {
    const keys = HEADER_SLOT_KINDS.map((k) => HEADER_SLOT_KIND_SPECS[k].passcreatorKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('the documented keys hold (regression — the Passcreator field names are a contract)', () => {
    expect(HEADER_SLOT_KIND_SPECS.member_expiry.passcreatorKey).toBe('memberExpiry');
    expect(HEADER_SLOT_KIND_SPECS.discount_expiry.passcreatorKey).toBe('discountExpiry');
    expect(HEADER_SLOT_KIND_SPECS.coupon_expiry.passcreatorKey).toBe('couponExpiry');
    expect(HEADER_SLOT_KIND_SPECS.balance.passcreatorKey).toBe('balance');
    expect(HEADER_SLOT_KIND_SPECS.gift_points.passcreatorKey).toBe('giftPoints');
  });

  it('gift points and balance use DIFFERENT keys (points must never land in a currency slot)', () => {
    // The "gift points 不得與 currency balance 互換" invariant starts
    // here: if these two keys were ever the same, a point count could
    // be written into a currency slot and vice versa.
    expect(HEADER_SLOT_KIND_SPECS.gift_points.passcreatorKey).not.toBe(
      HEADER_SLOT_KIND_SPECS.balance.passcreatorKey,
    );
  });

  it('every kind has a non-empty label key (passCard namespace path)', () => {
    for (const kind of HEADER_SLOT_KINDS) {
      const { labelKey } = HEADER_SLOT_KIND_SPECS[kind];
      expect(labelKey.length).toBeGreaterThan(0);
      expect(labelKey).toContain('.');
    }
  });
});

describe('HEADER_SLOT_KIND_SPECS — test id', () => {
  it('every kind has a non-empty test id', () => {
    for (const kind of HEADER_SLOT_KINDS) {
      expect(HEADER_SLOT_KIND_SPECS[kind].testId.length).toBeGreaterThan(0);
    }
  });

  it('test ids are UNIQUE across kinds', () => {
    const ids = HEADER_SLOT_KINDS.map((k) => HEADER_SLOT_KIND_SPECS[k].testId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the documented test ids hold (regression — selectors are used by the preview tests)', () => {
    expect(HEADER_SLOT_KIND_SPECS.member_expiry.testId).toBe('member-expiry-preview');
    expect(HEADER_SLOT_KIND_SPECS.discount_expiry.testId).toBe('discount-expiry-preview');
    expect(HEADER_SLOT_KIND_SPECS.coupon_expiry.testId).toBe('coupon-expiry-preview');
    expect(HEADER_SLOT_KIND_SPECS.balance.testId).toBe('balance-preview');
    expect(HEADER_SLOT_KIND_SPECS.gift_points.testId).toBe('gift-points-preview');
  });
});

describe('HEADER_SLOT_KIND_SPECS — value type', () => {
  it('expiry kinds are dates, balance / gift points are numbers', () => {
    expect(HEADER_SLOT_KIND_SPECS.member_expiry.valueType).toBe('date');
    expect(HEADER_SLOT_KIND_SPECS.discount_expiry.valueType).toBe('date');
    expect(HEADER_SLOT_KIND_SPECS.coupon_expiry.valueType).toBe('date');
    expect(HEADER_SLOT_KIND_SPECS.balance.valueType).toBe('number');
    expect(HEADER_SLOT_KIND_SPECS.gift_points.valueType).toBe('number');
  });
});

describe('getHeaderSlot', () => {
  it('returns null for null / undefined card type', () => {
    expect(getHeaderSlot(null)).toBeNull();
    expect(getHeaderSlot(undefined)).toBeNull();
  });

  it('returns null for an UNKNOWN card type string (not in the schema)', () => {
    // The retired `shouldShowXxxPreview()` guards took a plain `string`
    // and returned false for EVERY string outside their Sets. The lookup
    // must keep that property — an unknown card type is "no slot", never
    // a half-resolved one.
    expect(getHeaderSlot('not_a_card_type' as CardType)).toBeNull();
    expect(getHeaderSlot('' as CardType)).toBeNull();
  });

  it('returns null for prototype-chain keys (no prototype pollution)', () => {
    // A plain `HEADER_SLOTS[cardType]` read would resolve these to
    // Object.prototype members — truthy values whose spec is undefined.
    // The lookup uses an own-property check, so they resolve to no slot.
    for (const key of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf']) {
      expect(getHeaderSlot(key as CardType), `cardType="${key}" must not resolve a slot`).toBeNull();
    }
  });

  it('returns the kind + spec for a known card type', () => {
    const slot = getHeaderSlot('membership_card');
    expect(slot?.kind).toBe('member_expiry');
    expect(slot?.spec.passcreatorKey).toBe('memberExpiry');
  });

  it('all 4 balance card types resolve to the SAME kind + spec', () => {
    const specs = (['stamp_card', 'reward_card', 'cashback_card', 'multipass'] as const).map(
      (c) => getHeaderSlot(c)?.spec.passcreatorKey,
    );
    expect(new Set(specs)).toEqual(new Set(['balance']));
  });
});

/**
 * The lookup semantics that the retired per-kind exports used to expose.
 *
 * 2026-10-25 — `PassCardPreviewHeader.tsx` used to export five
 * `ReadonlySet<CardType>` constants (`BALANCE_PREVIEW_CARD_TYPES`,
 * `MEMBER_EXPIRY_PREVIEW_CARD_TYPES`, `DISCOUNT_EXPIRY_PREVIEW_CARD_TYPES`,
 * `COUPON_EXPIRY_PREVIEW_CARD_TYPES`, `GIFT_POINTS_PREVIEW_CARD_TYPES`) plus
 * five `shouldShowXxxPreview(cardType)` type guards. Both are gone; the rule
 * they encoded now lives in this one table.
 *
 * The partition describe above pins the TABLE (the raw cardType → kind
 * mapping). This describe pins the LOOKUP semantics the retired guards
 * exposed — "does this card type belong to kind K?" — which is what
 * `shouldShowBalancePreview(ct) === true` used to answer:
 *
 *   - a card type resolves to EXACTLY one kind, and it is the kind its
 *     documented membership says (the old `SET.has(...)` / `SET.size`);
 *   - every OTHER card type resolves to a DIFFERENT kind (the old
 *     "excludes the other N card types" assertions);
 *   - a null / undefined card type resolves to NO kind at all (the old
 *     "guards return false for null / undefined" assertions).
 */
describe('getHeaderSlot — kind membership (successor of the retired Sets + type guards)', () => {
  /** The card types that belong to each kind — the retired Sets, in table form. */
  const KIND_MEMBERS: Record<HeaderSlotKind, readonly CardType[]> = {
    member_expiry: ['membership_card'],
    discount_expiry: ['discount_card'],
    coupon_expiry: ['coupon_card'],
    balance: ['stamp_card', 'reward_card', 'cashback_card', 'multipass'],
    gift_points: ['gift_card'],
  };

  it.each(HEADER_SLOT_KINDS)(
    'kind "%s" is resolved for exactly its member card types',
    (kind) => {
      const members = KIND_MEMBERS[kind];
      // A kind with no members would make the assertion below vacuous.
      expect(members.length).toBeGreaterThan(0);
      for (const cardType of ALL_CARD_TYPES) {
        const resolved = getHeaderSlot(cardType)?.kind;
        if (members.includes(cardType)) {
          expect(resolved, `${cardType} must resolve to "${kind}"`).toBe(kind);
        } else {
          expect(resolved, `${cardType} must NOT resolve to "${kind}"`).not.toBe(kind);
        }
      }
    },
  );

  it.each(HEADER_SLOT_KINDS)(
    'kind "%s" is never resolved for a null / undefined card type',
    (kind) => {
      // The retired guards returned false for null / undefined. The lookup
      // returns no kind at all — the same "no preview block" outcome.
      expect(getHeaderSlot(null)?.kind).not.toBe(kind);
      expect(getHeaderSlot(undefined)?.kind).not.toBe(kind);
    },
  );
});
