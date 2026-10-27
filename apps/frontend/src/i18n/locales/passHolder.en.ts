/**
 * Pass Holder Registration — English translations
 * Namespace: passHolder
 *
 * Language settings for the public "Get Pass" page; the target audience is
 * Pass Holders (wallet card end-users), NOT SAOME platform members.
 *
 * @module i18n/locales/passHolder.en
 */

export default {
  title: 'Get Your Exclusive Pass',
  subtitle: 'Fill in the form below to join {{issuerName}}',
  fields: {
    name: {
      label: 'Name',
      placeholder: 'Enter your name',
    },
    phone: {
      countryCodeLabel: 'Country Code',
      numberLabel: 'Phone Number',
      numberPlaceholder: '0912345678',
    },
    birthday: {
      label: 'Birthday',
      hint: 'Must be at least 13 years old',
    },
    email: {
      label: 'Email',
      placeholder: 'you@example.com',
    },
  },
  submit: 'Get Pass',
  submitting: 'Submitting...',
  // 2026-10-17 — submit-error banner copy (Bug 4 umbrella).
  // Close button on the alert banner so the user can dismiss
  // without retrying. Defaults to the localized 'Dismiss' label
  // via i18next fallback if not present.
  submitErrorDismiss: 'Dismiss',
  // 2026-10-17 — diagnostic line shown under tooYoung errors so the
  // user can see the exact value the API received (disambiguates
  // "I typed 1989 but the form sent 2026 due to autofill" from a
  // real backend math bug).
  submitErrorDebug: {
    receivedPrefix: 'API received birthday: ',
    boundaryMid: 'Server requires ≤ ',
  },
  success: {
    title: 'Thanks for registering!',
    description: 'The Pass download feature is coming soon. Please check back later.',
    backToTemplate: 'Back to {{templateName}}',
  },
  // 2026-10-19 — Passcreator V3 per-pass runtime integration.
  // Mirror of zh-TW file; full English only, no Chinese (Rule 023 §
  // translation discipline).
  //
  // 2026-10-19 (split-two-platform-buttons) — Renamed
  // `appleWallet` / `androidWallet` / `directDownload` / `iosHint`
  // to `forIos` / `forAndroid`. The download view now renders TWO
  // side-by-side platform-specific buttons (iOS + Android) instead
  // of one UA-keyed primary + a universal-secondary pair. The
  // universal "Download .pkpass" button is gone — users pick the
  // platform they want directly. See
  // runs/improvements/feedback/20261019-pass-holder-split-two-platform-buttons.md.
  download: {
    title: 'Your Pass is ready!',
    subtitle: 'Add the Pass to your mobile wallet and show it at checkout.',
    forIos: 'For iOS',
    forAndroid: 'For Android',
    barcodeLabel: 'Barcode content',
    showBarcodeHint: 'Show this barcode to the cashier at checkout',
    notReadyYet: 'Pass has not been issued yet. Please try again shortly.',
  },
  passwalletReminder: {
    title: 'Android users',
    // v3-fix-tips-copy (2026-10-19): refreshed copy (mirror of zh-TW)
    // explains that the first install guides the user to the Play
    // Store to install Passwallet — this is normal, not a bug.
    body: 'If your Android device does not have Passwallet installed, the first install will guide you to the Play Store to get Passwallet — this is normal. After installing, tap the button above again to add to your wallet.',
    installCta: 'Get Passwallet',
  },
  downloadError: {
    title: 'Pass issuance is temporarily unavailable',
    body: 'The server is busy. Please try again shortly.',
    retry: 'Retry issuance',
  },
  // 2026-10-19 — Production recovery UI for the V3 partial-update
  // bug. When a holder row was registered BEFORE the COALESCE fix
  // landed (2026-10-19), the barcode backfill's second UPDATE
  // wiped pass_identifier / download_url / issued_at / iphone_uri /
  // android_uri back to NULL. Such rows now have `barcode_value`
  // set but all 3 URIs missing — the frontend distinguishes this
  // state ("lost data" from the pre-fix era) and renders a banner
  // asking the user to contact support, since V3 LIST response
  // doesn't expose identifier / iPhoneUri / androidUri for
  // re-issuance — only downloadPage is recoverable.
  //
  // See:
  //   - runs/improvements/feedback/20261019-pass-holder-v3-partial-update-bug.md
  //   - apps/backend/src/modules/pass-templates/db/passHolders.ts::updatePassHolderIssuance
  //     (COALESCE partial update fix — runtime columns preserved).
  lostData: {
    title: 'Your Pass is missing some details',
    body: 'Some fields of this pass were lost due to a system anomaly. Please contact support to re-issue. Your barcode value has been preserved.',
    contactCta: 'Contact support',
  },
  errors: {
    templateNotFound: 'This template cannot be found or has been removed.',
    networkError: 'Network error. Please try again later.',
    // 2026-10-19 — V3 upstream failure i18n key (mirror of zh-TW).
    upstreamFailed: 'Pass issuance is temporarily unavailable. Please try again later or contact support.',
    // 2026-10-17 — Backend-error capture (Bug 4 umbrella).
    // Mirror of zh-TW file; keep in sync with backend
    // `apps/backend/src/modules/pass-templates/schemas/request.ts`.
    birthdayInvalid: 'Invalid birthday format',
    phoneInvalid: 'Invalid phone number format',
    tooYoung: 'Must be at least 13 years old',
    // 2026-10-23 — Gift-card purchase errors. Thrown by the backend
    // `registerService::deriveGiftCardPurchase` and surfaced verbatim
    // in the frontend banner. Keep in sync with the backend.
    // The customer buys POINTS, not an amount — the price is derived
    // from the tenant's rate and can never be client-edited.
    pointsForbiddenForNotRequired: 'A points purchase cannot be marked as free',
    giftCardPointsRequired: 'Please choose how many points to buy',
    giftCardNotConfigured:
      'This gift card has no exchange rate configured. Please contact the merchant.',
    // 2026-10-27 — Membership tier snapshot errors. The backend
    // re-derives the snapshot from the template's own tier list, so
    // these come from
    // `apps/backend/src/modules/pass-templates/services/registerService.ts::deriveMembershipTierSnapshot`.
    // Mirror of zh-TW file; keep in sync with the backend.
    membershipTierRequired: 'Please choose a membership tier',
    membershipTierInvalid:
      'The membership tiers have changed. Please refresh the page and try again.',
  },
  validation: {
    nameRequired: 'Please enter your name',
    nameTooShort: 'Name must be at least 2 characters',
    phoneInvalid: 'Invalid phone number format',
    birthdayInvalid: 'Invalid birthday format',
    emailInvalid: 'Invalid email format',
    ageTooYoung: 'Must be at least 13 years old',
    // 2026-10-23 — Gift-card purchase validation messages. These keys
    // are produced by `packages/shared/logic/giftCardPurchase.ts` and
    // shared by web + (future) React Native (Rule 023 § Shared
    // Validation 用 i18n Key).
    pointsInvalid: 'Please enter a valid number of points',
    pointsBelowMin: 'Points are below the minimum purchase',
    pointsAboveMax: 'Points exceed the per-checkout maximum',
    pointsNotMultipleOfRate: 'Points must be a multiple of the exchange unit',
  },
  // 2026-10-16: Paid-membership tier picker + simulated payment UI.
  // Translation writing discipline: full English only, no Chinese
  // mixed in (Rule 023 § 翻譯書寫紀律).
  membership: {
    sectionTitle: 'Choose a Membership Plan',
    sectionHint: 'Select a membership tier and complete the payment to continue.',
    selectTier: 'Please select a plan',
    costFree: 'Free',
    perMonth: 'per month',
    perYear: 'per year',
    rewardsLabel: 'Member Rewards',
    payBlockedHint: 'Please select a plan and complete payment first',
    payButton: {
      payfast: 'Pay with Payfast',
      ecpay: 'Pay with Ecpay',
    },
    // 2026-10-16 — CTA shows amount + action: user knows what they pay
    // and what they get before clicking. Full English (Rule 023 §
    // translation discipline); "Pass" stays untranslated as a product name.
    payWithTierAction: 'Pay {{amount}} & Get Pass',
    payWithFreeTier: 'Get Free Pass',
    paying: 'Processing payment…',
    paid: 'Paid',
    providerBadge: {
      payfast: 'Payfast',
      ecpay: 'Ecpay',
    },
  },
  // 2026-10-23: Gift-card purchase section (exchange-rate explanation +
  // points input + gifting hint). Mirror of the zh-TW `gift.*` block.
  //
  // A gift card sells POINTS, not money: the customer types points and
  // the payable amount is derived from the tenant's rate. There is no
  // amount input — the price is a read-only computation, and the
  // backend re-derives it from the same shared function.
  //
  // Translation discipline: full English only (Rule 023 § 翻譯書寫
  // 紀律). Ranges use {{min}} / {{max}} interpolation so the copy
  // tracks the merchant's settings instead of hardcoding numbers.
  gift: {
    sectionTitle: 'Buy Points',
    sectionHint:
      'Here is the exchange rate set by the merchant. Points can be spent in store right away.',
    rateLabel: 'Exchange rate',
    rateValue: '{{points}} points for every {{amount}}',
    rangeLabel: 'Per-purchase range',
    rangePoints: '{{min}} – {{max}} points',
    // The amount fences come from CardBuilder Step 6 (checkoutMinAmount /
    // checkoutMaxAmount) and are the currency-side view of the SAME
    // fence the points range above expresses. Both are shown so the
    // customer can predict what 100 points will cost.
    amountRangeLabel: 'Per-purchase amount',
    amountRangeValue: '{{min}} – {{max}}',
    usageHint:
      'Show the pass in your mobile wallet at checkout and the cashier will scan it to deduct your points.',
    tipsTitle: 'Buying this for someone else?',
    tipsBody:
      "Just fill in their name, phone, birthday and email — the pass will be sent to them.",
    pointsLabel: 'Points to buy',
    pointsPlaceholder: 'Enter points',
    amountLabel: 'Amount payable',
    amountEmpty: 'No points entered',
    fenceHintLabel: 'You can buy:',
    payButton: {
      payfast: 'Pay with Payfast',
      ecpay: 'Pay with Ecpay',
    },
    payWithAmountAction: 'Pay {{amount}} & Get Pass',
    paying: 'Processing payment…',
    paid: 'Paid',
  },
};