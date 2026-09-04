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
    iconSection: {
      title: 'Push Notification Icon',
      hint: 'This Icon appears on the lock screen and notification center, not on the card template itself',
    },
    backgroundSection: {
      title: 'Card Background Image',
      hint: 'The background image appears in the card header area (1860×738 pixels) for visual brand identification',
    },
    colorsSection: {
      title: 'Card Colors',
      hint: 'Set the card background and text colors (applied to the entire card). Pick from the preset palette or enter a custom hex code.',
      background: 'Background',
      text: 'Text',
    },
    fieldsSection: {
      title: 'Display Fields',
      hint: 'Choose two fields to display on the card face. Available options will change based on the card type selected in Step 1.',
      leftField: 'Left Field',
      rightField: 'Right Field',
      placeholder: 'Select a field',
      disabledSuffix: 'already selected',
      fields: {
        phone: 'Phone',
        email: 'Email',
        memberLevel: 'Member Level',
        birthday: 'Birthday',
        visitCount: 'Visit Count',
        memberName: 'Member Name',
      },
    },
    // ===== Stamp grid — added 2026-09-04 =====
    // Conditional section: shown only when cardType ∈ {stamp_card, multipass}.
    stampSection: {
      title: 'Stamp & Grid Size',
      hint: 'Choose a stamp icon and the number of grid cells. This section is only visible when "Stamp Card" or "Multipass" is selected in Step 1.',
      gridCount: {
        label: 'Grid Rows',
        rows: '{{rows}} rows',
        cells: '{{count}} cells',
      },
      iconPicker: {
        label: 'Stamp Icon',
        trigger: 'Pick a stamp',
        previewAlt: 'Stamp Preview',
        closeAria: 'Close stamp picker',
      },
      icons: {
        bell: 'Bell',
        fire: 'Fire',
        lightbulb: 'Lightbulb',
        love: 'Heart',
        sun: 'Sun',
      },
    },
  },
  step4: {
    title: 'Card Info',
    description: {
      title: 'Card Description',
      hint: 'Enter a card description, up to 200 characters.',
      required: 'Card description is required',
      counter: '{{count}} / 200',
    },
    backFields: {
      title: 'Back Fields',
      hint: 'According to the Apple EULA, every Wallet pass must include contact data. Please specify either an Email address or a phone number that can be used to contact you.',
      addField: 'Add Field',
      removeField: 'Remove',
      labelPlaceholder: 'Label (optional)',
      valuePlaceholder: 'Value (required)',
      required: 'Each row value is required',
      minOne: 'At least one back field is required',
      maxReached: 'Maximum 10 back fields',
      counter: '{{count}} / 10',
      labelLabel: 'Label',
      valueLabel: 'Value',
    },
    links: {
      title: 'Links',
      hint: 'Up to 4 links can be added to a pass. These links will be shown in Apple Wallet and Google Wallet passes. You can also use HTML links anywhere in your back fields instead of using these dedicated link fields!',
      addLink: 'Add Link',
      removeLink: 'Remove',
      labelPlaceholder: 'Link name (optional)',
      valuePlaceholder: 'https://example.com, 0912-345-678, or name@example.com',
      labelLabel: 'Name',
      valueLabel: 'URL',
      counter: '{{count}} / 4',
      maxReached: 'Maximum 4 links',
      invalidUrl: 'Invalid URL, phone, or email format',
    },
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
      linksTitle: 'Links',
      linksEmpty: '(No links yet)',
    },
  },
};
