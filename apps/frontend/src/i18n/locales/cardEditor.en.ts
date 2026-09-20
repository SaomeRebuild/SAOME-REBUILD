/**
 * Card Editor — English translations
 * Namespace: cardEditor
 *
 * @module i18n/locales/cardEditor.en
 */

export default {
  // Page level
  pageTitle: 'Card Builder',
  // 2026-09-13 semantic swap: cardNameLabel / cardNamePlaceholder removed;
  // Header input now binds to Logo Text. Card Name is edited in Step 2.
  logoTextLabel: 'Logo Text',
  logoTextPlaceholder: 'Enter logo text',
  cardNameDisplay: 'Template: {{cardName}}',
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
  // 2026-09-13 swap: nameRequired → logoTextRequired (Header input now
  // binds to Logo Text, the pass header text).
  step1: {
    title: 'Choose Card Type',
    logoTextRequired: 'Please enter logo text',
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
    // 2026-09-13 swap: storeName (Store Name) → cardName (Card Name).
    // Persisted to SQL column `templates.name` instead of
    // `settings.storeName` (JSONB).
    cardName: {
      title: 'Card Name',
      placeholder: 'Enter card name',
      required: 'Card name is required',
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
    language: {
      title: 'Card Language',
      zhTW: 'Chinese',
      en: 'English',
      hint: 'Choose the language used when sending the card',
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
      hint: 'Choose two fields to display on the card face. When "Stamp Card" is selected, stamp-related fields (Available Rewards, Total Stamps, Stamps Remaining) are also available.',
      leftField: 'Left Field',
      rightField: 'Right Field',
      placeholder: 'Select a field',
      disabledSuffix: 'already selected',
      fields: {
        phone: 'Phone',
        email: 'Email',
        memberLevel: 'Member Level',
        // Stamp Card override: when cardType is stamp_card, the "memberLevel"
        // option in the left/right dropdown renders as "Reward" instead.
        // (2026-09-10 stamp card member-level → reward refactor)
        memberLevelStamp: 'Reward',
        // 2026-09-18 Discount Card override: when cardType is discount_card,
        // the "memberLevel" option in the left/right dropdown renders as
        // "Discount Tier" instead. Distinct from memberLevelStamp
        // (stamp/reward/cashback = "Reward" semantic; discount = "tier"
        // semantic) so we keep a dedicated key.
        memberLevelDiscount: 'Discount Tier',
        birthday: 'Birthday',
        visitCount: 'Visit Count',
        memberName: 'Member Name',
        // Stamp-only fields — only shown for stamp_card (decoupled from multipass 2026-09-20)
        availableRewards: 'Available Rewards',
        totalStamps: 'Total Stamps',
        stampsRemaining: 'Stamps Remaining',
        // Reward-only fields — only shown for reward_card (2026-09-10 reward card
        // display-field extension). Points-related data is meaningless on
        // non-reward cards.
        pointsToNextTier: 'Points to Next Tier',
        currentPoints: 'Current Points',
        // Cashback-only fields — only shown for cashback_card (2026-09-12).
        // Cashback uses spending amount, NOT points — so the label drops
        // "Points" to match the cashback business logic (spend-based tier).
        // (2026-09-12 cashback field copy fix.)
        pointsToNextTierCashback: 'Amount to Next Tier',
        accumulatedSpendCashback: 'Accumulated Spending',
        // Discount-only fields — only shown for discount_card (2026-09-18).
        // Mirror the cashback copy (spend-based, "Amount" not "Points") to
        // keep the currency-driven amount semantics consistent across the
        // spend-tier card families.
        pointsToNextTierDiscount: 'Amount to Next Tier',
        discountTierBracket: 'Discount Tier Bracket',
        accumulatedSpendDiscount: 'Accumulated Spending',
        // Coupon-only fields — only shown for coupon_card (2026-09-19).
        // gated by group: 'coupon' + filterCARD_FIELDS_BY_CARD_TYPE.
        couponRemainingCount: 'Remaining Count',
        couponDiscount: 'Discount Offer',
        // MultiPass-only fields — only shown for multipass (2026-09-20).
        // gated by group: 'multipass' + filterCARD_FIELDS_BY_CARD_TYPE.
        multipassCompleted: 'Cumulative',
        multipassPointsToNextTier: 'To Next Tier',
        multipassRewardContent: 'Reward',
        // The multipass "Member Level" slot is NOT a dedicated dropdown entry —
        // it reuses the existing common `memberLevel` field (whose
        // `hideOnCardTypes: ['coupon_card']` does NOT exclude multipass).
        // PassCardPreviewBody's `multipass + memberLevel` override branch
        // surfaces `firstMultipassTierName` as the value for that slot.
      },
    },
    // ===== Stamp grid — added 2026-09-04 =====
    // Conditional section: shown only when cardType ∈ {stamp_card, multipass}.
    stampSection: {
      title: 'Stamp & Grid Size',
      hint: 'Choose a stamp icon and the number of grid cells. This section is only visible when "Stamp Card" is selected in Step 1.',
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
      // 2026-09-10 currency-aware hint: ZAR prefix (R10) vs TWD prefix (NT$10).
      rewardTypeAmountHintTWD: 'e.g. NT$10 off when you spend enough',
      rewardTypeAmountHintZAR: 'e.g. R10 off when you spend enough',
      rewardTypePercent: 'Percentage discount',
      rewardTypePercentHint: 'e.g. 8% off when you collect enough stamps',
      rewardValueLabel: 'Reward Amount',
      rewardValuePlaceholderAmount: 'Enter discount amount, e.g. 10',
      rewardValuePlaceholderPercent: 'Enter discount percentage, e.g. 8',
      // 2026-09-10 currency-aware unit (replaces single `rewardValueAmountUnit: 'R'`).
      // English: TWD uses prefix NT$, ZAR uses prefix R (both prefix-style).
      rewardValueAmountUnitTWD: 'NT$',
      rewardValueAmountUnitZAR: 'R',
      rewardValuePercentUnit: '%',
      rewardValueEmptyError: 'Please enter the reward amount',
      rewardValueInvalidError: 'Please enter a valid number',
      rewardValueTooSmallError: 'Discount percentage must be greater than 0',
      rewardValueTooLargeError: 'Discount percentage cannot exceed 100',
      maxDiscountTitle: 'Maximum Discount Amount',
      maxDiscountDescription: 'When choosing "Percentage discount", set a cap on the maximum discount per transaction.',
      maxDiscountPlaceholder: 'e.g. 50 (leave blank for no cap)',
      // 2026-09-10 currency-aware max discount unit. Both TWD and ZAR
      // use prefix notation in English (NT$50 / R50).
      maxDiscountUnitTWD: 'NT$',
      maxDiscountUnitZAR: 'R',
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
        // 2026-09-10 currency-aware per-spend amount label.
        // TWD uses suffix "spent"; ZAR uses prefix "R".
        // Component decides whether to render before / after input based
        // on store.currency — see AccrualThresholdField.tsx.
        perSpendAmountLabelTWD: 'spent',
        perSpendAmountLabelZAR: 'R',
        perSpendStampsLabel: 'stamps',
        perSpendHelper: 'Earn M stamps for every N spent.',
        requiredError: 'Please enter a threshold value',
        visitsMinError: 'Visit count must be greater than 0',
        stampsMinError: 'Stamp count must be greater than 0',
        amountMinError: 'Spend amount must be greater than 0',
      },
      // Preview description (StampCardLogicPreview component)
      // 2026-09-10 i18n refactor: {{amount}} / {{cap}} are pre-formatted
      // with the currency unit at the correct position (prefix R for ZAR,
      // prefix NT$ for TWD, suffix 元 for zh-TW TWD) before being
      // interpolated. Templates provide ONLY English phrasing — no
      // currency symbols embedded here. Mirrors REWARD preview.
      preview: {
        modeUnknown: 'Please select a stamping method',
        rewardUnknown: 'Please enter a reward name',
        amountReward: '{{amount}} off',
        percentReward: '{{percent}}% off',
        amountWithCap: '{{amount}} off, max {{cap}} per transaction',
        percentWithCap: '{{percent}}% off, max {{cap}} per transaction',
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
    // ===== Reward card (2026-09-09) =====
    // Differs from stamp card:
    //   - Points-driven (not stamps)
    //   - Up to 5 reward tiers (not single reward)
    //   - earningMode: based_on_points / based_on_visits / based_on_spending
    reward: {
      intro: 'Set the points accumulation and reward redemption rules for this card',
      introHint: 'Members can earn points by custom conditions, visits, or spending, then redeem rewards once the threshold is met.',
      // Earning Mode selector
      earningModeTitle: 'Points Earning Method',
      earningModeDescription: 'Choose how points are earned on this card',
      modes: {
        based_on_points: {
          label: 'Custom Conditions',
          helper: 'Members earn points by fulfilling custom conditions (e.g. completing tasks, referring new members, filling out surveys). Best for engagement-driven scenarios.',
        },
        based_on_visits: {
          label: 'Per Visit',
          helper: 'Members automatically earn points each time they visit (by showing the card or scanning a QR code). Ideal for gyms, clinics, or tutoring centers.',
        },
        based_on_spending: {
          label: 'Per Spend',
          helper: 'Members earn points automatically when spending reaches a set amount, determined by the point-of-sale system. Ideal for chain restaurants or retail stores.',
        },
      },
      // Per-visit threshold
      pointsPerVisit: {
        title: 'Points Per Visit',
        helper: 'Points earned each time a member visits.',
        placeholder: 'e.g. 10',
        unit: 'points',
        requiredError: 'Please enter points earned per visit',
        minError: 'Points per visit must be at least 1',
      },
      // Per-spend threshold (per-tier, 2026-09-09 copy refactor)
      pointsPerSpend: {
        title: 'Spend-Points Ratio',
        helper: 'Earn M points for every N spent.',
        amountLabel: 'every',
        amountPlaceholder: 'e.g. 100',
        // 2026-09-09: currency-aware — TWD 後綴 spent, ZAR 前綴R
        // 渲染層根據 store.currency 條件選擇 prefix / suffix
        amountUnitTWD: 'spent',
        amountUnitZAR: 'R',
        // 2026-09-09 2nd-pass: equalLabel + earnLabel merged into
        // equalEarnLabel so the sentence renders as "=earn" with no
        // visible space between "=" and the verb. Previous gap-x-1.5
        // between two separate spans produced "= earn" which the user
        // explicitly asked to compact on mobile.
        equalEarnLabel: '=earn',
        pointsLabel: 'points',
        pointsPlaceholder: 'e.g. 1',
        pointsUnit: 'pts',
        requiredError: 'Please enter the spend amount and points',
        amountMinError: 'Spend amount must be greater than 0',
        pointsMinError: 'Points must be greater than 0',
      },
      // Reward tiers
      tiersTitle: 'Reward Tiers',
      tiersHint: 'Set up to 5 reward tiers that members can redeem at each point threshold.',
      tier: {
        nameTitle: 'Reward Name',
        namePlaceholder: 'e.g. 1000 pts for 10% off or 500 pts for R50 off',
        nameCounter: '{{count}} / 40',
        nameRequiredError: 'Please enter a reward name',
        thresholdTitle: 'Points Threshold',
        thresholdUnit: 'points',
        thresholdPlaceholder: 'e.g. 1000',
        thresholdRequiredError: 'Please enter the threshold',
        thresholdMinError: 'Threshold must be greater than 0',
        rewardTypeTitle: 'Reward Type',
        rewardTypePlaceholder: 'Select reward type',
        rewardTypeAmount: 'Cash discount',
        rewardTypePercent: 'Percentage discount',
        rewardValueTitle: 'Reward Value',
        rewardValueAmountPlaceholder: 'Enter discount amount, e.g. 10',
        rewardValuePercentPlaceholder: 'Enter discount percentage, e.g. 10',
        // Currency-aware unit: TWD uses NT$ (per SAOME i18n convention —
        // see auth.en.ts / pricing.en.ts), ZAR uses R (South African Rand)
        rewardValueAmountUnitTWD: 'NT$',
        rewardValueAmountUnitZAR: 'R',
        rewardValuePercentUnit: '%',
        rewardValueRequiredError: 'Please enter the reward value',
        rewardValueInvalidError: 'Please enter a valid number',
        rewardValueTooLargeError: 'Discount percentage cannot exceed 100',
        maxDiscountTitle: 'Maximum Discount Amount',
        maxDiscountUnitTWD: 'NT$',
        maxDiscountUnitZAR: 'R',
        maxDiscountPlaceholder: 'e.g. 50 (leave blank for no cap)',
        maxDiscountOptional: '(Optional, leave blank for no cap)',
        maxDiscountHelper: 'Setting a cap prevents large discounts on big purchases.',
      },
      addTier: 'Add Reward Tier',
      removeTier: 'Remove',
      maxTiersReached: 'Maximum 5 tiers reached',
      // Live preview sentence
      // 2026-09-09 i18n fix: {{amount}} / {{cap}} already include the
      // currency unit (R / NT$ prefix-style for English). Templates
      // provide ONLY the locale-correct phrasing — no currency symbols
      // embedded here.
      preview: {
        modeUnknown: 'Please select an earning method',
        tierUnknown: 'Please set up at least one reward tier',
        amountReward: '{{amount}} off',
        percentReward: '{{percent}}% off',
        amountWithCap: '{{amount}} off, max {{cap}} per transaction',
        percentWithCap: '{{percent}}% off, max {{cap}} per transaction',
        percentNoCap: '{{percent}}% off, no discount cap',
        template: 'Earn {{threshold}} points to redeem {{reward}}',
      },
      // Validation
      validation: {
        earningModeRequired: 'Please select an earning method',
        tierRequired: 'Please set up at least one reward tier',
        tierNameRequired: 'Reward name is required',
        thresholdRequired: 'Threshold is required',
        rewardTypeRequired: 'Please select a reward type',
        rewardValueRequired: 'Please enter the reward value',
      },
    },
    // ===== Membership Card (2026-09-13) =====
    // Paid membership card: card-wide "no expiry / with expiry" toggle +
    // up to 5 membership tiers + up to 5 member rewards sub-rows per tier.
    // Free membership card (isPaid=false) renders a full editor
    // (single tier + hasExpiry toggle + expiry mode + rewards sub-rows).
    membership: {
      // Hero intro — varies by isPaid (2026-09-14)
      // The Step6CardLogic dispatcher switches between intro (paid) and
      // introFree based on the `isPaid` store selector. Keeping both keys
      // here avoids inlining conditional copy in JSX.
      intro: 'Configure membership tiers and pricing plans',
      introHint: 'Members enjoy different benefits and exclusive rewards by tier, up to 5 tiers.',
      introFree: 'Configure this free membership card tier and validity',
      introHintFree: 'Free membership cards need only one tier with a validity period; up to 5 rewards per tier.',
      hasExpiryToggle: 'Card Expiration',
      hasExpiryOn: 'With expiry (monthly/yearly)',
      hasExpiryOff: 'No expiry (lifetime)',
      // 2026-09-14: free-card variant — explicitly notes "specific end date"
      // rather than the paid card's "monthly/yearly". MembershipHasExpiryToggle
      // switches copy based on isPaid.
      hasExpiryOnFree: 'With expiry (specific end date)',
      tiersTitle: 'Membership Tiers',
      tiersHint: 'Configure each tier\'s cost and rewards. Up to 5 tiers.',
      addTier: 'Add Membership Tier',
      removeTier: 'Remove',
      maxTiersReached: 'Maximum 5 tiers reached',
      rewardsTitle: 'Member Rewards',
      rewardsHint: 'Add exclusive rewards for this tier (up to 5); shown on the back of the card.',
      rewardsEmpty: 'No rewards added yet',
      addReward: 'Add Member Reward',
      removeReward: 'Remove',
      maxRewardsReached: 'Maximum 5 rewards reached',
      rewardLabelTitle: 'Reward Title',
      rewardLabelPlaceholder: 'e.g. VIP Benefit',
      rewardValueTitle: 'Reward Content',
      rewardValuePlaceholder: 'e.g. https://example.com/vip',
      tier: {
        nameTitle: 'Tier Name',
        namePlaceholder: 'e.g. VIP, Gold Member',
        nameCounter: '{{count}} / 40',
        nameRequiredError: 'Please enter a tier name',
        durationTitle: 'Duration',
        durationMonthly: 'Monthly',
        durationYearly: 'Yearly',
        durationRequiredError: 'Please select a duration',
        costTitle: 'Cost',
        costMonthlyPlaceholder: 'e.g. 100',
        costYearlyPlaceholder: 'e.g. 1000',
        costUnitTWD: 'NT$',
        costUnitZAR: 'R',
        costZeroIsFree: 'Enter 0 = free member',
        // 2026-09-13 added: lifetime cost field (card-wide hasExpiry=false).
        // Tenants use this to sell the right to a lifetime tier at a one-time
        // price. Mutually exclusive with monthly/yearly — the editor decides
        // which cost field is rendered based on the hasExpiry toggle.
        lifetimeCostTitle: 'Lifetime Cost',
        lifetimeCostPlaceholder: 'e.g. 3000',
        lifetimeCostZeroIsFree: 'Enter 0 = free lifetime member',
      },
      // ===== Free-card section (2026-09-14) =====
      // Free membership card (isPaid=false) UI section. Reuses
      // membershipTiers[0].name and rewards; no new fields at the tier
      // level. The 3 card-level expiry fields (membershipExpiryMode /
      // customExpiryDays / specificExpiryDate) live at the store level.
      freeTierNameTitle: 'Membership Tier',
      freeTierNamePlaceholder: 'e.g. VIP, Standard Member',
      freeTierNameCounter: '{{count}} / 40',
      freeTierNameRequiredError: 'Please enter a membership tier name',

      freeExpiryModeTitle: 'Expiry Setting',
      freeExpiryModeCustomDays: 'Custom days',
      freeExpiryModeSpecificDate: 'Specific date',
      freeExpiryModeRequiredError: 'Please choose an expiry setting',

      freeCustomExpiryDaysTitle: 'Validity (days)',
      freeCustomExpiryDaysPlaceholder: 'e.g. 100',
      freeCustomExpiryDaysUnit: 'days',
      freeCustomExpiryDaysRangeError: 'Please enter between 1 and 3650 days',

      freeSpecificExpiryDateTitle: 'Expiry Date',
      freeSpecificExpiryDatePlaceholder: 'YYYY-MM-DD',
      freeSpecificExpiryDateRequiredError: 'Please choose an expiry date',
      freeSpecificExpiryDatePastError: 'Expiry date cannot be earlier than today',

      // ===== Free state (preserved from 2026-09-13) =====
      freeStateTitle: 'Free membership card needs no paid settings',
      freeStateHint: 'This is a free membership card; no tiers or costs required. To configure a paid membership card, enable "Requires payment" in Step 2.',
      // ===== Validation =====
      validation: {
        tierRequired: 'Please add at least one membership tier',
        tierNameRequired: 'Tier name is required',
        durationRequired: 'Please select a duration',
        costRequired: 'Please enter a cost',
        costInvalid: 'Cost cannot be negative',
        // 2026-09-14: free-card-specific validation messages
        freeTierNameRequired: 'Membership tier name is required',
        freeExpiryModeRequired: 'Please choose an expiry setting',
        freeCustomExpiryDaysInvalid: 'Please enter between 1 and 3650 days',
        freeSpecificExpiryDateRequired: 'Please choose an expiry date',
        freeSpecificExpiryDatePast: 'Expiry date cannot be earlier than today',
      },
    },
    // ===== Cashback card (2026-09-11) =====
    // Points earned on spending, usable on next purchase (Cashback effect).
    // Up to 5 tiers, each with name + thresholdSpend (0 allowed) + cashbackPercent (1-100).
    cashback: {
      intro: 'Set the cashback tiers for this card',
      introHint: 'Members earn cashback % based on cumulative spending. Up to 5 tiers.',
      tiersTitle: 'Cashback Tiers',
      tiersHint: 'Define cashback % for each spending tier. Up to 5 tiers.',
      addTier: 'Add Cashback Tier',
      removeTier: 'Remove',
      maxTiersReached: 'Maximum 5 tiers reached',
      tier: {
        nameTitle: 'Tier Name',
        namePlaceholder: 'e.g. VIP, Gold Member',
        nameCounter: '{{count}} / 40',
        nameRequiredError: 'Please enter a tier name',
        thresholdTitle: 'Cumulative Spending',
        thresholdHelper: 'Members must spend N to qualify for this tier. Enter 0 = everyone qualifies.',
        thresholdUnitTWD: 'NT$',
        thresholdUnitZAR: 'R',
        thresholdPlaceholder: 'e.g. 1000 (0 = no threshold)',
        thresholdInvalidError: 'Threshold cannot be negative',
        thresholdZeroHint: 'Enter 0 = no threshold, everyone qualifies',
        percentTitle: 'Cashback %',
        percentPlaceholder: 'e.g. 5',
        percentUnit: '%',
        percentRequiredError: 'Please enter cashback %',
        percentInvalidError: 'Cashback % must be an integer between 1 and 100',
        percentTooLargeError: 'Cashback % cannot exceed 100',
      },
      preview: {
        tierUnknown: 'Please add at least one cashback tier',
        noThreshold: 'Earn {{percent}}% cashback on every purchase',
        withThreshold: 'Spend {{amount}} to earn {{percent}}% cashback',
      },
      validation: {
        tierRequired: 'Please add at least one cashback tier',
        tierNameRequired: 'Tier name is required',
        thresholdInvalid: 'Cumulative spending cannot be negative',
        percentInvalid: 'Cashback % must be an integer between 1 and 100',
      },
    },
    // ===== Discount Card (2026-09-18, discount_card only) =====
    // Direct discount % at point of sale (instant price reduction), as opposed
    // to cashback (post-purchase refund). Up to 5 tiers, each with
    // name + thresholdSpend (0 allowed) + discountPercent (1-100).
    // Optional card-level expiry (customDays OR specificDate, mutually exclusive, no toggle).
    discount: {
      intro: "Configure this discount card's discount tiers",
      introHint: 'Different discount % based on cumulative spend; card expiry is optional.',
      tiersTitle: 'Discount Tiers',
      tiersHint: 'Set discount % for each cumulative spending threshold. Up to 5 tiers.',
      addTier: 'Add Discount Tier',
      removeTier: 'Remove',
      maxTiersReached: 'Maximum 5 tiers reached',
      tier: {
        nameTitle: 'Tier Name',
        namePlaceholder: 'e.g. Gold, Bronze, VIP',
        nameCounter: '{{count}} / 40',
        nameRequiredError: 'Please enter a tier name',
        thresholdTitle: 'Cumulative Spend',
        thresholdHelper: 'Members must spend N to qualify for this tier. Enter 0 = everyone qualifies.',
        thresholdUnitTWD: 'NT$',
        thresholdUnitZAR: 'R',
        thresholdPlaceholder: 'e.g. 1000 (0 = no threshold)',
        thresholdInvalidError: 'Threshold cannot be negative',
        thresholdZeroHint: 'Enter 0 = no threshold, everyone qualifies',
        percentTitle: 'Discount %',
        percentPlaceholder: 'e.g. 10',
        percentUnit: '%',
        percentRequiredError: 'Please enter discount %',
        percentInvalidError: 'Discount % must be an integer between 1 and 100',
        percentTooLargeError: 'Discount % cannot exceed 100',
      },
      expiryTitle: 'Card Expiration (Required)',
      expiryHint: 'Fill at least one field. Otherwise, use the Cashback Card (no expiry).',
      expiryBothNullError: 'Please fill at least one expiry field (days or date). If you do not need an expiry, use the Cashback Card instead.',
      customExpiryDaysTitle: 'Valid Days',
      customExpiryDaysPlaceholder: 'e.g. 365',
      customExpiryDaysUnit: 'days',
      customExpiryDaysRangeError: 'Valid days must be an integer between 1 and 3650',
      specificExpiryDateTitle: 'Expiry Date',
      specificExpiryDateHint: 'Setting expiry date will clear valid days.',
      specificExpiryDatePastError: 'Expiry date cannot be earlier than today',
      preview: {
        tierUnknown: 'Please add at least one discount tier',
        noThreshold: '{{percent}}% off every purchase',
        withThreshold: '{{percent}}% off when you spend {{amount}}',
      },
      validation: {
        tierRequired: 'Please add at least one discount tier',
        tierNameRequired: 'Tier name is required',
        thresholdInvalid: 'Cumulative spending cannot be negative',
        percentInvalid: 'Discount % must be an integer between 1 and 100',
      },
    },
    // ===== Coupon Card (2026-09-19, coupon_card only) =====
    // Single coupon: one discount value per use + issue count per transaction.
    coupon: {
      intro: 'Set up this coupon card',
      introHint: 'Choose between a fixed amount or percentage discount, set the per-use value, and decide how many coupons to issue per transaction.',
      // Discount type radio
      discountTypeTitle: 'Discount Type',
      discountTypeAmount: 'Fixed Amount',
      discountTypePercent: 'Percentage',
      discountTypeRequiredError: 'Please choose a discount type',
      // Fixed amount
      amountTitle: 'Discount per Use',
      amountPlaceholder: 'e.g. 50',
      amountUnitTWD: 'NT$',
      amountUnitZAR: 'R',
      amountRequiredError: 'Please enter the fixed amount',
      amountInvalidError: 'Fixed amount must be ≥ 1',
      // Percentage
      percentTitle: 'Discount per Use',
      percentPlaceholder: 'e.g. 10',
      percentUnit: '%',
      percentRequiredError: 'Please enter the discount %',
      percentInvalidError: 'Discount % must be an integer between 1 and 100',
      // Issue count
      issueCountTitle: 'Coupons per Transaction',
      issueCountPlaceholder: 'e.g. 1',
      issueCountUnit: 'coupons',
      issueCountHint: 'How many coupons to issue to the same customer per transaction (minimum 1).',
      issueCountRequiredError: 'Please enter the number of coupons',
      issueCountInvalidError: 'Coupon count must be ≥ 1',
      // Validation
      validation: {
        discountTypeRequired: 'Please choose a discount type',
        amountRequired: 'Please enter the fixed amount',
        amountInvalid: 'Fixed amount must be ≥ 1',
        percentRequired: 'Please enter the discount %',
        percentInvalid: 'Discount % must be an integer between 1 and 100',
        issueCountRequired: 'Please enter the number of coupons',
        issueCountInvalid: 'Coupon count must be ≥ 1',
      },
    },
    // ===== Multipass card (2026-09-19, multipass only) =====
    multipass: {
      intro: "Configure this multipass card's stamp accumulation and reward tiers",
      introHint: 'Customers can stack stamps across multiple cards and redeem different rewards at each tier.',
      tiersTitle: 'Reward tiers',
      tiersHint: 'Set up the rewards customers can redeem at each stamp milestone. Up to 5 tiers.',
      addTier: 'Add reward tier',
      maxTiersReached: 'Maximum number of tiers reached (5)',
      removeTierConfirm: 'Remove this tier?',
      // ★ PR-5 card-wide Stamping Method (2026-09-20)
      accrualModeTitle: 'Stamping Method',
      accrualModeDescription: 'Choose how stamps are earned on this card',
      modes: {
        per_stamp: {
          label: 'Manual Stamp',
          helper: 'Staff manually stamps the customer\'s multipass',
        },
        per_visit: {
          label: 'Per Visit',
          helper: 'Customer earns stamps automatically per visit',
        },
        per_spend: {
          label: 'Per Spend',
          helper: 'Customer earns stamps automatically per spend',
        },
      },
      tier: {
        nameTitle: 'Member Level',
        namePlaceholder: 'e.g. Bronze / Silver / Gold',
        nameCounter: '{{count}} / 40',
        nameRequiredError: 'Please enter a member level',
        stampsNeededTitle: 'Times to collect',
        stampsNeededPlaceholder: 'e.g. 5 (0 = welcome gift on download)',
        stampsNeededHelper: '0 = welcome gift awarded on download. Cap of 999 is a safety valve.',
        stampsNeededUnit: 'times',
        stampsNeededRequiredError: 'Please enter the number of times to collect',
        stampsNeededMinError: 'Times to collect must be >= 0',
        stampsNeededMaxError: 'Times to collect must be <= 999',
        stampsNeededNotIntegerError: 'Times to collect must be an integer',
        stampsNeededDuplicateWarning: 'Another tier uses the same collect count. Duplicate tiers may cause unexpected behavior.',
        // ★ PR-5 per-tier threshold fields (2026-09-20)
        perVisitTitle: 'Visit Threshold',
        perVisitVisitsLabel: 'visits',
        perVisitStampsLabel: 'stamps',
        perVisitHelper: 'Earn M stamps every N visits',
        perSpendTitle: 'Spend Threshold',
        perSpendAmountLabelTWD: 'spent',
        perSpendAmountLabelZAR: 'R',
        perSpendStampsLabel: 'stamps',
        perSpendHelper: 'Earn M stamps for every N spent',
        accrualThresholdRequiredError: 'Please enter a threshold value',
        perVisitCountMinError: 'Visit count must be > 0',
        perVisitStampsMinError: 'Stamps count must be > 0',
        perSpendAmountMinError: 'Spend amount must be > 0',
        perSpendStampsMinError: 'Stamps count must be > 0',
        rewardTypeTitle: 'Reward type',
        rewardTypePlaceholder: 'Select a reward type',
        rewardTypeAmount: 'Cash discount',
        rewardTypeAmountHint: 'e.g. NT$10 off at this tier',
        rewardTypePercent: 'Percentage discount',
        rewardTypePercentHint: 'e.g. 8% off at this tier',
        rewardValueTitle: 'Reward value',
        rewardValueAmountPlaceholder: 'Enter cash amount, e.g. 10',
        rewardValuePercentPlaceholder: 'Enter percentage, e.g. 8',
        rewardValueAmountUnitTWD: 'NT$',
        rewardValueAmountUnitZAR: 'R',
        rewardValuePercentUnit: '%',
        rewardValueRequiredError: 'Please enter a reward value',
        rewardValueInvalidError: 'Please enter a valid number',
        rewardValueTooSmallError: 'Reward value must be > 0',
        rewardValueTooLargeError: 'Percentage must be <= 100',
        // ★ PR-6 per-tier max discount cap (2026-09-20, shown when rewardType === 'percent_off')
        maxDiscountTitle: 'Max discount per use',
        maxDiscountPlaceholder: 'e.g. 50 (leave blank for no cap)',
        maxDiscountHelper: 'Set a cap to prevent excessive discounts on large purchases.',
        maxDiscountUnitTWD: 'NT$',
        maxDiscountUnitZAR: 'R',
        maxDiscountOptional: '(Optional — leave blank for no cap)',
        maxDiscountZeroIsNoCap: 'Enter 0 = no cap',
        removeTier: 'Remove this tier',
      },
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
      // 2026-09-13 membership card: Section 4 (replacing the previous
      // Section 1.5). The back-side fields slot now directly renders
      // the first tier's member reward sub-rows.
      membershipRewardsTitle: 'Member Rewards',
      // 2026-09-13: when the membership card has no rewards yet, Section 4
      // shows this placeholder.
      membershipRewardsEmpty: 'No member rewards yet',
    },
  },
};
