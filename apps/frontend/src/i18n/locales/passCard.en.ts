/**
 * Pass Card — English translations
 * Namespace: passCard
 *
 * Language settings for card preview UI, shared by TemplateCardPreview and PassCardPreview.
 *
 * @module i18n/locales/passCard.en
 */

export default {
  defaultCardType: 'Card',
  defaultIssuerName: 'Unnamed Card',
  defaultName: 'Unnamed Card',
  fieldLabelLeft: 'Left Field',
  fieldLabelRight: 'Right Field',
  // Demo preview data (PassCreator Label/Value pairs — maps to templateSettings.leftField / rightField).
  // label renders as small hint text in the left/right slot; value renders as the larger primary content.
  // Once PassCreator is wired, real values will come from member rows; these are preview-only.
  fieldPreview: {
    phone: { label: 'Phone', value: '+279XXXXXXXXX' },
    email: { label: 'Email', value: 'hi@saome.org' },
    memberLevel: { label: 'Member Level', value: 'Gold', stampLabel: 'Reward', discountLabel: 'Discount Tier' },
    birthday: { label: 'Birthday', value: '05/11/1999' },
    visitCount: { label: 'Visit Count', value: '5 times' },
    memberName: { label: 'Member Name', value: 'Thabo Mokoena' },
    // Stamp-only preview fields — only shown in the dropdown for stamp_card
    // (decoupled from multipass 2026-09-20).
    // totalStamps.value uses {{rows}} interpolation; PassCardPreviewBody passes stampGridRows in.
    availableRewards: { label: 'Available Rewards', value: '2 times' },
    totalStamps: { label: 'Total Stamps', value: '3 / {{rows}}' },
    stampsRemaining: { label: 'Stamps Remaining', value: '6 stamps' },
    // Reward-only preview fields — only shown in the dropdown for reward_card.
    // (2026-09-10 reward card display-field extension)
    // values are static demo strings, matching the phone/email/visitCount pattern.
    // Will be sourced from member rows once PassCreator is wired.
    pointsToNextTier: { label: 'Points to Next Tier', value: '123 pts' },
    currentPoints: { label: 'Current Points', value: '23 pts' },
    // Cashback-only preview fields — only shown in the dropdown for cashback_card (2026-09-12).
    // Cashback is spend-based, NOT point-based, so the English label drops
    // "Points" → "Amount to Next Tier". Values are NOT stored here — they
    // live in `@saome/shared/constants/cashbackPreviewAmounts.ts` as a
    // currency-driven map (TWD → "562元" / ZAR → "R562"). The body component
    // reads from the map at runtime, so this locale only carries the label.
    // Reason for splitting label/value (Rule 023 § 翻譯書寫紀律): en cannot
    // contain Han characters, so "562元" cannot live in passCard.en.ts.
    // 2026-09-13 ZAR pollution fix: previously the body component applied
    // a regex-based `R` prefix formatter to ALL i18n-sourced values,
    // contaminating non-amount fields (phone `+279XXXXXXXXX` → `R279...`,
    // visitCount `5 times` → `R5`, etc.) for every card type. Cashback is
    // now one of two currency-driven fields (the other being the balance
    // preview block in PassCardPreviewHeader, also backed by a shared
    // constant).
    pointsToNextTierCashback: { label: 'Amount to Next Tier' },
    accumulatedSpendCashback: { label: 'Accumulated Spending' },
    // Discount-only preview fields — only shown in the dropdown for
    // discount_card (2026-09-18). Amount values are NOT stored here — they
    // live in `@saome/shared/constants/discountPreviewAmounts.ts` as a
    // currency-driven map (TWD → "234元" / ZAR → "R234"). The body component
    // reads from the map at runtime, so this locale only carries the label.
    // Reason for splitting label/value (Rule 023 § 翻譯書寫紀律): en cannot
    // contain Han characters, so "234元" cannot live in passCard.en.ts.
    // Mirrors the cashback amount split (2026-09-12) with distinct keys
    // because discount card has its own preview amount demo values.
    // discountTierBracket's value is rendered from store
    // (discountTiers[0].discountPercent + '%'); it has no currency-dependent
    // string, so it only needs the label here.
    pointsToNextTierDiscount: { label: 'Amount to Next Tier' },
    discountTierBracket: { label: 'Discount Tier Bracket' },
    accumulatedSpendDiscount: { label: 'Accumulated Spending' },
    // Coupon-only preview fields — only shown in dropdown for coupon_card
    // (2026-09-19). couponRemainingCount value is a static demo "1 sheet"
    // (matches the phone/email/visitCount pattern).
    //
    // couponDiscount value is store-driven (i18n template interpolation):
    //   - amount_off + couponDiscountAmount=N → "{{N}} off" (en)
    //   - percent_off + couponDiscountPercent=N → "{{N}}% off" (en)
    //   - either field null (not yet entered) → empty string (no placeholder
    //     text, matching other required-fields UX)
    //
    // 2026-09-19 bug fix: previously the preview hardcoded "10元折扣" /
    // "R10折扣" via COUPON_PREVIEW_AMOUNTS regardless of what the user
    // typed. New behaviour: read store.couponDiscountAmount /
    // couponDiscountPercent directly and interpolate into i18n templates —
    // the preview always reflects the user's actual input. The previous
    // "10元折扣" placeholder is removed; an empty value renders as an
    // empty string so the user sees the slot but no misleading demo text.
    //
    // Why amountFormat / amountFormatZAR / percentFormat are 3 separate keys:
    //   - TWD en: "NT${{amount}} off" (NT$ is ISO 4217 symbol for New
    //            Taiwan Dollar; zh-TW uses "元" suffix instead — kept
    //            under different keys because the currency unit + position
    //            differ across locales)
    //   - ZAR:    "R{{amount}} off" (prefix R, then " off" suffix)
    //   - percent: "{{percent}}% off" (shared structure across locales)
    // The 3 keys allow the suffix / prefix to differ by locale without
    // forcing a separate `currency-driven` shared constant.
    couponRemainingCount: {
      label: 'Remaining Count',
      value: '1 sheet',
      countFormat: '{{count}} sheets',
    },
    couponDiscount: {
      label: 'Discount Offer',
      // 2026-09-20: defensive empty value fallback. PassCardPreviewBody's
      // default branch does `t('fieldPreview.${field}.value')`; without
      // this key the lookup returns the raw key string
      // "fieldPreview.couponDiscount.value" which leaks into the preview.
      // The actual coupon path uses amountFormatTWD/ZAR/percentFormat;
      // value: '' is purely a safety net for the default branch fallback.
      value: '',
      amountFormatTWD: 'NT${{amount}} off',
      amountFormatZAR: 'R{{amount}} off',
      percentFormat: '{{percent}}% off',
    },
    // ===== MultiPass preview fields (2026-09-20) =====
    // Step 3 left/right dropdown for multipass cards.
    //   - multipassCompleted: static demo "1x" (matches availableRewards "2 times" pattern)
    //   - multipassPointsToNextTier: static demo "2x to complete"
    //   - multipassRewardContent: store-driven, amount_off → amountFormatTWD/ZAR,
    //     percent_off → percentFormat (TWD → "NT$10 off", ZAR → "R10 off")
    // The multipass "Member Level" slot is NOT a dedicated entry here — it
    // reuses the existing common `memberLevel` field, handled by
    // PassCardPreviewBody's `multipass + memberLevel` override branch
    // (mirrors `membership_card` pattern: label = `fieldPreview.memberLevel.label`
    // default, value = `firstMultipassTierName ?? ''`).
    multipassCompleted: { label: 'Cumulative', value: '1x' },
    multipassPointsToNextTier: { label: 'To Next Tier', value: '2x to complete' },
    multipassRewardContent: {
      label: 'Reward',
      amountFormatTWD: 'NT${{amount}} off',
      amountFormatZAR: 'R{{amount}} off',
      percentFormat: '{{percent}}% off',
    },
  },
  // ===== Balance preview — only shown for stamp_card / reward_card / cashback_card =====
  // When Step 1 picks one of these 3 card types, PassCardPreviewHeader's right-side
  // card-type pill is replaced with a 2-line vertical block:
  //   - label: "Balance" (locale-driven, provided by i18n)
  //   - value: selected by store.currency — TWD → "200元", ZAR → "R100" (1:0.5 rate)
  //   Note: value strings live in `@saome/shared/constants/balancePreview.ts` (NOT in
  //   i18n) because the currency unit and amount are driven by store.currency, NOT by
  //   i18n locale. en translations cannot contain Han characters (verify-i18n hard fail),
  //   so "200元" cannot live in passCard.en.ts. See plan § Design Decisions and
  //   Rule 024 § business logic in shared/.
  balancePreview: {
    label: 'Balance',
  },
  // ===== Member expiry preview — only shown for membership_card =====
  // When Step 1 picks `membership_card`, PassCardPreviewHeader's right-side
  // card-type pill is replaced with a 2-line vertical block:
  //   - label: "Member Expiry" (locale-driven, provided by i18n)
  //   - value: selected by store.hasExpiry — true → formatted expiryDate
  //     ("2027.10.23" zh-TW / "10.23.2027" en); false → "∞" (infinity)
  //   Date formatting follows locale convention:
  //     - zh-TW: YYYY.MM.DD (per user-confirmed UX)
  //     - en:    MM.DD.YYYY (US-style per user-confirmed UX)
  //   The expiryDate comes from store.expiryDate (ISO YYYY-MM-DD string).
  //   When hasExpiry=true and expiryDate is empty, falls back to "—" (placeholder).
  memberExpiry: {
    label: 'Member Expiry',
  },
// ===== Discount card expiry preview — only shown for discount_card (2026-09-18) =====
  // When Step 1 picks `discount_card`, PassCardPreviewHeader's right-side
  // card-type pill is replaced with a 2-line vertical block:
  //   - label: "Expiry Date" (locale-driven, provided by i18n)
  //   - value: selected by store.discountCustomExpiryDays /
  //     discountSpecificExpiryDate:
  //       - discountCustomExpiryDays set → today + N days formatted per locale
  //       - discountSpecificExpiryDate set → directly formatted per locale
  //       - both null → "—" (theoretical only, since expiry is required)
  //   Unlike the member expiry preview, the discount card expiry is a
  //   *required card-level* field (Step 6 DiscountExpiryFields is mandatory),
  //   not a toggle. Reuses the existing `formatExpiryDate(isoDate, locale)`
  //   helper from PassCardPreviewHeader (zh-TW YYYY.MM.DD / en MM.DD.YYYY).
  discountExpiry: {
    label: 'Expiry Date',
  },
  // ===== Coupon expiry preview — only shown for coupon_card (2026-09-19) =====
  // Mirrors the discount expiry label string ("Expiry Date") — the user-
  // visible label intentionally reuses "Expiry Date" across both expiry
  // preview surfaces since both communicate the same concept (card-level
  // validity end date). See passCard.zh-TW.ts couponExpiry for zh-TW copy.
  couponExpiry: {
    label: 'Expiry Date',
  },
};
