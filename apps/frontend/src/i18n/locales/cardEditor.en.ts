/**
 * Card Editor — English translations
 * Namespace: cardEditor
 *
 * @module i18n/locales/cardEditor.en
 */

export default {
  // Page level
  pageTitle: 'Card Builder',
  cardNameLabel: 'Card Name',
  cardNamePlaceholder: 'Enter card name',
  comingSoon: 'Coming soon',

  // Action buttons
  actions: {
    backToLibrary: 'Back to Library',
    save: 'Save',
    prev: 'Previous',
  },

  // Step indicator
  steps: {
    selectType: 'Select Card Type',
    cardSettings: 'Card Settings',
    cardDesign: 'Card Design',
    cardInfo: 'Card Info',
    geolocation: 'Geolocation',
    cardLogic: 'Card Logic',
    customizePlaceCard: 'Customize Table Card',
    save: 'Save',
  },

  // Step 1: Card type selector
  step1: {
    title: 'Choose Card Type',
    nameRequired: 'Please enter a card name',
    cardTypes: {
      stamp_card: 'Stamp Card',
      cashback_card: 'Cashback Card',
      reward_card: 'Reward Card',
      membership_card: 'Membership Card',
      discount_card: 'Discount Card',
      coupon_card: 'Coupon Card',
      multipass: 'Multipass',
      gift_card: 'Gift Card',
    },
    next: 'Next',
  },

  // Step 2: Card Settings（Base — shared by all card types）
  step2: {
    title: 'Card Settings',
    barcode: {
      title: 'Barcode Format',
      qrCode: 'QR Code',
      pdf417: 'PDF 417',
    },
    storeName: {
      title: 'Store Name',
      placeholder: 'Enter store name',
      required: 'Store name is required',
    },
    issuerName: {
      title: 'Issuer Name',
      placeholder: 'Enter issuer name',
      required: 'Issuer name is required',
    },
    passValidDays: {
      title: 'Card Validity Period',
      placeholder: 'e.g. 30',
      unit: 'days',
      hint: 'Leave blank for no expiration. Filling this will clear the expiry date.',
    },
    expiryDate: {
      title: 'Expiry Date',
      hint: 'Setting this will clear the validity days.',
    },
    currency: {
      title: 'Currency',
    },
    membershipExtension: {
      title: 'Membership Card Options',
      isPaid: 'Requires payment',
      isPaidHint: 'When enabled, members must pay to obtain this card',
    },
  },
  step3: {
    title: 'Card Design',
  },
  step4: {
    title: 'Card Info',
  },
  // Step 5: Geolocation
  step5: {
    title: 'Geolocation',
  },
  // Step 6: Card Logic
  step6: {
    title: 'Card Logic',
  },
  // Step 7: Customize Table Card
  step7: {
    title: 'Customize Table Card',
  },
  // Step 8: Save
  step8: {
    title: 'Save',
  },

  // Live preview
  preview: {
    title: 'Live Preview',
    empty: 'Please select a card type',
    untitled: 'Untitled Card',
    togglePreview: 'Preview',
    closePreview: 'Close Preview',
    // Card front/back toggle
    cardSide: 'Card Side',
    front: 'Front',
    back: 'Back',
    // PassCardPreview
    passTypeDefault: 'Card',
    cardHolderDefault: 'Card Holder',
    cardType: 'Card Type',
    // Card back side
    backSide: {
      description: 'Card Description',
      automaticUpdates: 'Automatic Updates',
      allowNotifications: 'Allow Notifications',
      removePass: 'Remove Pass',
      termsOrLinks: 'Terms or Links',
    },
  },
};
