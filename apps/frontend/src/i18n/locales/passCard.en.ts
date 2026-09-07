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
    memberLevel: { label: 'Member Level', value: 'Gold' },
    birthday: { label: 'Birthday', value: '05/11/1999' },
    visitCount: { label: 'Visit Count', value: '5 times' },
    memberName: { label: 'Member Name', value: 'Thabo Mokoena' },
    // Stamp-only preview fields — only shown in the dropdown for stamp_card / multipass.
    // totalStamps.value uses {{rows}} interpolation; PassCardPreviewBody passes stampGridRows in.
    availableRewards: { label: 'Available Rewards', value: '2 times' },
    totalStamps: { label: 'Total Stamps', value: '3 / {{rows}}' },
    stampsRemaining: { label: 'Stamps Remaining', value: '6 stamps' },
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
};
