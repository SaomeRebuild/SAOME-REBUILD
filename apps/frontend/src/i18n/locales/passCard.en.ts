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
    memberLevel: { label: 'Member Level', value: 'Gold', stampLabel: 'Reward' },
    birthday: { label: 'Birthday', value: '05/11/1999' },
    visitCount: { label: 'Visit Count', value: '5 times' },
    memberName: { label: 'Member Name', value: 'Thabo Mokoena' },
    // Stamp-only preview fields — only shown in the dropdown for stamp_card / multipass.
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
};
