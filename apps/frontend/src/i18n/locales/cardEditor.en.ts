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
    skipNotice: 'Geolocation is currently disabled. Step 5 has been collapsed — you can move on to Step 6.',
    initialMessage: {
      label: 'Initial message',
      helper: 'Will be displayed as a push notification after downloading a pass.',
      placeholder: 'Enter your initial message...',
      counter: '{{count}} / 50',
    },
    locationsDisabled: {
      label: 'Enable geolocation push',
      helper: 'When disabled, all Step 5 fields are cleared and you can skip directly to Step 6.',
      enabledHint: 'Enabled — at least 1 location + notification radius required.',
      disabledHint: 'Disabled — geolocation push will not trigger.',
    },
    locationsMaxDistance: {
      label: 'Notification radius',
      helper: 'Sets the radius where the Wallet pass triggers a lock-screen notification when the user is near a defined location. Leave blank to use the pass-type default (event tickets / boarding passes: up to 1000 m; coupons / store cards / membership cards: up to 100 m).',
      placeholder: '100 ~ 1000',
      unit: 'm',
      useDefault: 'Use default',
      rangeHint: 'Valid range: {{min}} ~ {{max}} m',
    },
    locations: {
      title: 'Locations',
      sectionHelper: "Based on this data a Wallet pass is shown on the user's lockscreen as soon as they're near a defined location or the relevant date is reached. The pass can then be opened right on the lockscreen.",
      coordinatesHelper: 'Pick a location in Google Maps, copy the coordinates, and paste here. The system will automatically split latitude and longitude.',
      addLocation: 'Add location',
      removeLocation: 'Remove location',
      counter: '{{count}} / 10',
      maxHint: 'Up to 10 locations',
      locationsMinOneHint: 'Please add at least 1 location to continue',
      maxReached: 'Maximum number of locations reached',
      storeNameLabel: 'Store name',
      storeNamePlaceholder: 'e.g. Taipei 101',
      coordinatesLabel: 'Coordinates',
      coordinatesPlaceholder: '25.033,121.565',
      relevantTextLabel: 'Arrival notification',
      relevantTextPlaceholder: 'e.g. Welcome! Show this card for 10% off',
      validation: {
        invalidFormat: 'Please enter valid coordinates in the format "latitude,longitude" (e.g. 25.033,121.565)',
        latitudeOutOfRange: 'Latitude must be between -90 and 90',
        longitudeOutOfRange: 'Longitude must be between -180 and 180',
        latitudeRequired: 'Please enter a latitude',
        longitudeRequired: 'Please enter a longitude',
        relevantTextTooLong: 'Arrival notification can be at most 100 characters',
        nameEmpty: 'Please enter a store name',
        nameTooLong: 'Store name can be at most 40 characters',
        tooMany: 'At most 10 locations',
        locationsMinOne: 'Please add at least 1 location',
        locationsMaxDistanceInvalid: 'Please enter a valid number',
        locationsMaxDistanceOutOfRange: 'Radius must be between 100 and 1000 meters',
        locationsMaxDistanceRequired: 'Please set a notification radius',
      },
    },
  },
  // Step 6: Card Logic
  step6: {
    title: 'Card Logic',
    // Introduction shown when entering Step 6
    intro: 'Set the stamping and reward rules for this card',
    introHint: 'Members earn a reward after collecting the required number of stamps.',
    // Stamp card specific (StampCardLogic sub-module)
    stamp: {
      accrualModeTitle: 'Stamping Method',
      accrualModeDescription: 'Choose how stamps are earned on this card',
      // Three accrual modes
      modes: {
        per_stamp: {
          label: 'Manual Stamp',
          helper: 'Staff manually stamps the customer\'s card. Ideal for in-store purchases where stamps are awarded after reaching a spending threshold.',
        },
        per_visit: {
          label: 'Per Visit',
          helper: 'Customer receives a stamp automatically each time they visit (by showing the card or scanning a QR code). Ideal for gyms, clinics, or tutoring centers.',
        },
        per_spend: {
          label: 'Per Spend',
          helper: 'Customer earns a stamp automatically when spending reaches a set amount, determined by the point-of-sale system. Ideal for chain restaurants or retail stores.',
        },
      },
      // Reward settings
      rewardNameTitle: 'Reward Name',
      rewardNamePlaceholder: 'e.g. R10 store credit or 8% store discount',
      rewardNameHelper: 'This will appear on the customer\'s card, e.g. "Redeem for 10% off at any store".',
      rewardNameCounter: '{{count}} / 40',
      rewardNameEmptyError: 'Please enter a reward name',
      rewardTypeTitle: 'Reward Type',
      rewardTypePlaceholder: 'Select reward type',
      rewardTypeAmount: 'Fixed cash discount',
      rewardTypeAmountHint: 'e.g. R10 off the total bill',
      rewardTypePercent: 'Percentage discount',
      rewardTypePercentHint: 'e.g. 8% off when you collect enough stamps',
      rewardValueLabel: 'Reward Amount',
      rewardValuePlaceholderAmount: 'Enter discount amount, e.g. 10',
      rewardValuePlaceholderPercent: 'Enter discount percentage, e.g. 8',
      // SAOME targets ZAR (South African Rand) for English locale — the
      // "R" symbol is rendered next to the Reward Amount input. Per-locale
      // currency unit lives here so future locales can override.
      rewardValueAmountUnit: 'R',
      rewardValuePercentUnit: '%',
      rewardValueEmptyError: 'Please enter the reward amount',
      rewardValueInvalidError: 'Please enter a valid number',
      rewardValueTooSmallError: 'Discount percentage must be greater than 0',
      rewardValueTooLargeError: 'Discount percentage cannot exceed 100',
      maxDiscountTitle: 'Maximum Discount Amount',
      maxDiscountDescription: 'When choosing "Percentage discount", set a cap on the maximum discount per transaction.',
      maxDiscountPlaceholder: 'e.g. 50 (leave blank for no cap)',
      maxDiscountOptional: '(Optional, leave blank for no cap)',
      maxDiscountHelper: 'Setting a cap prevents large discounts on big purchases and protects store margins.',
      maxDiscountZeroIsNoCap: 'Enter 0 = no cap',
      // Accrual threshold — per visit / per spend (2026-09-07)
      accrualThreshold: {
        perVisitTitle: 'Visit Threshold',
        perVisitVisitsLabel: 'visits',
        perVisitStampsLabel: 'stamps',
        perVisitHelper: 'Earn M stamps every N visits.',
        perSpendTitle: 'Spend Threshold',
        perSpendAmountLabel: 'spend',
        perSpendStampsLabel: 'stamps',
        perSpendHelper: 'Earn M stamps for every N spent.',
        requiredError: 'Please enter a threshold value',
        visitsMinError: 'Visit count must be greater than 0',
        stampsMinError: 'Stamp count must be greater than 0',
        amountMinError: 'Spend amount must be greater than 0',
      },
      // Preview description (StampCardLogicPreview component)
      preview: {
        modeUnknown: 'Please select a stamping method',
        rewardUnknown: 'Please enter a reward name',
        amountReward: 'R{{amount}} off',
        percentReward: '{{percent}}% off',
        amountWithCap: 'R{{amount}} off, max R{{cap}} per transaction',
        percentWithCap: '{{percent}}% off, max R{{cap}} per transaction',
        percentNoCap: '{{percent}}% off, no discount cap',
        template: 'Collect {{total}} stamps to redeem {{reward}}',
        templateWithCap: 'Collect {{total}} stamps to redeem {{reward}}',
        stampUnit: 'stamps',
      },
    },
    // Placeholder for non-stamp card types
    comingSoon: {
      otherCardTypes: 'Card logic for this card type is not yet available.',
      hint: 'Select "Stamp Card" or "Multipass" to configure stamping and reward rules.',
    },
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
