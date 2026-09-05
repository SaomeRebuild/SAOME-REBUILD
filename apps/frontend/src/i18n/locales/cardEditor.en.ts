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
