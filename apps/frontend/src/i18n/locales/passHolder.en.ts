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
  errors: {
    templateNotFound: 'This template cannot be found or has been removed.',
    networkError: 'Network error. Please try again later.',
    // 2026-10-17 — Backend-error capture (Bug 4 umbrella).
    // Mirror of zh-TW file; keep in sync with backend
    // `apps/backend/src/modules/pass-templates/schemas/request.ts`.
    birthdayInvalid: 'Invalid birthday format',
    phoneInvalid: 'Invalid phone number format',
    tooYoung: 'Must be at least 13 years old',
  },
  validation: {
    nameRequired: 'Please enter your name',
    nameTooShort: 'Name must be at least 2 characters',
    phoneInvalid: 'Invalid phone number format',
    birthdayInvalid: 'Invalid birthday format',
    emailInvalid: 'Invalid email format',
    ageTooYoung: 'Must be at least 13 years old',
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
};