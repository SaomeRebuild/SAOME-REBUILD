/**
 * Card Editor — Chinese (Traditional) translations
 * Namespace: cardEditor
 *
 * @module i18n/locales/cardEditor.zh-TW
 */

export default {
  // 頁面層級
  pageTitle: '卡片建置器',
  cardNameLabel: '卡片名稱',
  cardNamePlaceholder: '輸入卡片名稱',
  comingSoon: '即將推出',

  // 動作按鈕
  actions: {
    backToLibrary: '返回模板庫',
    save: '保存',
    prev: '上一步',
  },

  // 步驟指示器
  steps: {
    selectType: '選擇卡片種類',
    cardSettings: '卡片設定',
    cardDesign: '卡片設計',
    cardInfo: '卡片資訊',
    geolocation: '地理位置',
    cardLogic: '卡片邏輯',
    customizePlaceCard: '客製化桌牌',
    save: '保存',
  },

  // Step 1: 卡片類型選擇器
  step1: {
    title: '選擇卡片類型',
    nameRequired: '請填寫卡片名稱',
    cardTypes: {
      stamp_card: '集點卡',
      cashback_card: '現金回饋卡',
      reward_card: '獎勵卡',
      membership_card: '會員卡',
      discount_card: '折扣卡',
      coupon_card: '優惠券',
      multipass: '多通卡',
      gift_card: '禮品卡',
    },
    next: '下一步',
  },

  // Step 2: 卡片設定（Base — 所有卡種共用）
  step2: {
    title: '卡片設定',
    barcode: {
      title: '條碼格式',
      qrCode: 'QR 碼',
      pdf417: 'PDF 417',
    },
    storeName: {
      title: '店名',
      placeholder: '請輸入店名',
      required: '店名為必填欄位',
    },
    issuerName: {
      title: '發卡機構名稱',
      placeholder: '請輸入發卡機構名稱',
      required: '發卡機構名稱為必填欄位',
    },
    passValidDays: {
      title: '卡片有效天數',
      placeholder: '例：30',
      unit: '天',
      hint: '留空表示無期限。填寫後到期日將自動清除。',
    },
    expiryDate: {
      title: '到期日設定',
      hint: '設定後有效天數將自動清除。',
    },
    currency: {
      title: '貨幣',
    },
    membershipExtension: {
      title: '會員卡選項',
      isPaid: '需收費',
      isPaidHint: '開啟後，會員需支付費用才能領取此卡',
    },
  },
  step3: {
    title: '卡片設計',
    iconSection: {
      title: '推播通知圖示',
      hint: '此 Icon 會顯示於手機鎖屏與推播中心，不會出現在卡片模板內',
    },
    backgroundSection: {
      title: '卡片背景圖',
      hint: '背景圖會顯示在卡片頂部區域（1860×738 像素），用於視覺化品牌識別',
    },
    colorsSection: {
      title: '卡片顏色',
      hint: '設定卡片背景色與文字色（套用到整張卡片），可從預設色票選擇或輸入自訂 hex 色碼',
      background: '背景色',
      text: '文字色',
    },
    fieldsSection: {
      title: '顯示欄位',
      hint: '選擇要顯示在卡片正面的兩個欄位。選擇「集點卡」或「多通卡」時，會額外顯示印章相關欄位（可用獎勵、總印章數、還差幾個章）。',
      leftField: '左欄位',
      rightField: '右欄位',
      placeholder: '請選擇',
      disabledSuffix: '已選',
      fields: {
        phone: '電話',
        email: 'E-mail',
        memberLevel: '會員等級',
        // Stamp Card 限定覆寫：選 stamp_card 時「會員等級」option 顯示為「獎勵」
        // （per 2026-09-10 stamp card member-level → reward refactor）
        memberLevelStamp: '獎勵',
        birthday: '生日',
        visitCount: '拜訪次數',
        memberName: '會員姓名',
        // 印章卡專用欄位 — 僅在 stamp_card / multipass 顯示（見 card-fields.ts 的 group 篩選）
        availableRewards: '可用獎勵',
        totalStamps: '總印章數',
        stampsRemaining: '還差幾個章',
        // 獎勵卡專用欄位 — 僅在 reward_card 顯示（2026-09-10 reward card display-field extension）
        pointsToNextTier: '到下一階還差',
        currentPoints: '已累積點數',
      },
    },
    // ===== Stamp grid (集點印章) — added 2026-09-04 =====
    // Conditional section: shown only when cardType ∈ {stamp_card, multipass}.
    stampSection: {
      title: '印章與格數',
      hint: '選擇印章圖示與集點格數。本區塊僅在 Step 1 選擇「集點卡」或「多通卡」時顯示。',
      gridCount: {
        label: '集點格數',
        rows: '{{rows}} 列',
        cells: '{{count}} 格',
      },
      iconPicker: {
        label: '印章圖示',
        trigger: '選擇印章',
        previewAlt: '印章預覽',
        closeAria: '關閉印章選擇器',
      },
      icons: {
        bell: '鈴鐺',
        fire: '火焰',
        lightbulb: '燈泡',
        love: '愛心',
        sun: '太陽',
      },
    },
  },
  step4: {
    title: '卡片資訊',
    description: {
      title: '卡片描述',
      hint: '輸入卡片描述，最多 200 字。',
      required: '卡片描述為必填欄位',
      counter: '{{count}} / 200',
    },
    backFields: {
      title: '背面欄位',
      hint: '依據 Apple 終端使用者授權協議，每張 Wallet 票卡皆須包含聯絡資訊。請填寫電子郵件地址或電話號碼，以便持卡人聯繫您。',
      addField: '新增欄位',
      removeField: '移除',
      labelPlaceholder: '標籤（選填）',
      valuePlaceholder: '內容（必填）',
      required: '每一組的內容為必填',
      minOne: '至少需要一組背面欄位',
      maxReached: '最多 10 組背面欄位',
      counter: '{{count}} / 10',
      labelLabel: '標籤',
      valueLabel: '內容',
    },
    links: {
      title: '連結',
      hint: 'Pass 最多可加入 4 個連結，這些連結會顯示在 Apple Wallet 與 Google Wallet 中。你也可以改在「背面欄位」中使用 HTML 連結取代專屬連結欄位。',
      addLink: '新增連結',
      removeLink: '移除',
      labelPlaceholder: '連結名稱（選填）',
      valuePlaceholder: 'https://example.com 或 0912-345-678 或 name@example.com',
      labelLabel: '名稱',
      valueLabel: '網址',
      counter: '{{count}} / 4',
      maxReached: '最多 4 個連結',
      invalidUrl: '網址、電話或 E-mail 格式不正確',
    },
  },
  // Step 5: 地理位置
  step5: {
    title: '地理位置',
    skipNotice: '目前已停用地理位置推播，Step 5 已收合，可直接進入 Step 6。',
    initialMessage: {
      label: '推播訊息',
      helper: '使用者下載卡片後，將以推播通知顯示這段訊息。',
      placeholder: '輸入推播訊息...',
      counter: '{{count}} / 50',
    },
    locationsDisabled: {
      label: '啟用地理位置推播',
      helper: '關閉後 Step 5 所有欄位會清空，使用者可直接進入 Step 6。',
      enabledHint: '已啟用 — 至少需設定 1 個地點與推播範圍。',
      disabledHint: '已停用 — 不會觸發地理位置推播。',
    },
    locationsMaxDistance: {
      label: '推播範圍半徑',
      helper: '設定接近地點時，Wallet 卡片跳出推播通知的範圍。留空則依卡片類型自動設定（活動票券與登機證適用 1000 公尺，優惠券、會員卡適用 100 公尺）。',
      placeholder: '100 ~ 1000',
      unit: '公尺',
      useDefault: '使用預設',
      rangeHint: '有效範圍：{{min}} ~ {{max}} 公尺',
    },
    locations: {
      title: '地點',
      sectionHelper: '根據設定的資料，當使用者接近設定地點或到達相關日期時，Wallet 卡片會自動顯示於鎖定畫面，使用者可直接從鎖定畫面開啟卡片。',
      coordinatesHelper: '請至 Google Maps 點選地點，複製經緯度後貼上此欄，系統會自動拆分經度與緯度。',
      addLocation: '新增地點',
      removeLocation: '移除地點',
      counter: '{{count}} / 10',
      maxHint: '最多 10 個地點',
      locationsMinOneHint: '請至少新增 1 個地點，才能繼續下一步',
      maxReached: '已達地點數量上限',
      storeNameLabel: '店家名稱',
      storeNamePlaceholder: '例如：台北 101',
      coordinatesLabel: '經緯度',
      coordinatesPlaceholder: '25.033,121.565',
      relevantTextLabel: '到達通知訊息',
      relevantTextPlaceholder: '例如：歡迎光臨！出示卡片享 9 折優惠',
      validation: {
        invalidFormat: '請輸入有效的經緯度，格式為「緯度,經度」，例如 25.033,121.565',
        latitudeOutOfRange: '緯度需介於 -90 到 90 之間',
        longitudeOutOfRange: '經度需介於 -180 到 180 之間',
        latitudeRequired: '請輸入緯度',
        longitudeRequired: '請輸入經度',
        relevantTextTooLong: '到達通知訊息最多 100 字',
        nameEmpty: '請輸入店家名稱',
        nameTooLong: '店家名稱最多 40 字',
        tooMany: '最多 10 個地點',
        locationsMinOne: '請至少新增 1 個地點',
        locationsMaxDistanceInvalid: '請輸入有效的數字',
        locationsMaxDistanceOutOfRange: '範圍半徑需介於 100 到 1000 公尺之間',
        locationsMaxDistanceRequired: '請設定推播範圍半徑',
      },
    },
  },
  // Step 6: 卡片邏輯
  step6: {
    title: '卡片邏輯',
    // 進入 Step 6 時的說明
    intro: '設定此卡片的蓋章與獎勵規則',
    introHint: '集點卡的獎勵發放方式，會員集滿指定印章數量後即可領取。',
    // 集點卡專用（StampCardLogic 子模組）
    stamp: {
      accrualModeTitle: '蓋章方式',
      accrualModeDescription: '選擇此卡要採用哪一種蓋章方式',
      // 三種模式
      modes: {
        per_stamp: {
          label: '基於蓋章',
          helper: '由店員手動在顧客的卡片上蓋印章。適用於實體店面消費滿額後，給予印章鼓勵再訪。',
        },
        per_visit: {
          label: '基於來訪',
          helper: '顧客每次到訪（出示卡片或掃描 QR 碼）即自動獲得印章。適用於健身房、診所、補習班等需要計算到訪次數的場所。',
        },
        per_spend: {
          label: '基於消費',
          helper: '顧客每次消費達指定金額即自動獲得印章，金額由消費記錄系統決定。適用於連鎖餐廳、零售通路等。',
        },
      },
      // 獎勵設定
      rewardNameTitle: '獎勵名稱',
      rewardNamePlaceholder: '例如：10元折價活動 或 8% 門市折扣',
      rewardNameHelper: '這會顯示在顧客的卡片上，例如「集滿可兌換 10% 門市折扣」。',
      rewardNameCounter: '{{count}} / 40',
      rewardNameEmptyError: '請輸入獎勵名稱',
      rewardTypeTitle: '獎勵類型',
      rewardTypePlaceholder: '請選擇獎勵類型',
      rewardTypeAmount: '訂單折抵現金',
      // 2026-09-10 currency-aware hint: ZAR prefix (R10) vs TWD suffix (10元)
      rewardTypeAmountHintTWD: '例如：消費滿額可折抵 10 元',
      rewardTypeAmountHintZAR: '例如：消費滿額可折抵 R10',
      rewardTypePercent: '訂單折抵百分比',
      rewardTypePercentHint: '例如：集滿可享 8% 折扣',
      rewardValueLabel: '獎勵數量',
      rewardValuePlaceholderAmount: '輸入折抵金額，例如 10',
      rewardValuePlaceholderPercent: '輸入折抵百分比，例如 8',
      // 2026-09-10 currency-aware unit (replaces single `rewardValueAmountUnit`).
      // zh-TW: TWD 後綴元 (10元), ZAR 前綴R (R10).
      rewardValueAmountUnitTWD: '元',
      rewardValueAmountUnitZAR: 'R',
      rewardValuePercentUnit: '%',
      rewardValueEmptyError: '請輸入獎勵數量',
      rewardValueInvalidError: '請輸入有效的數字',
      rewardValueTooSmallError: '折抵百分比需大於 0',
      rewardValueTooLargeError: '折抵百分比不能超過 100',
      maxDiscountTitle: '最高折抵金額',
      maxDiscountDescription: '當選擇「折抵百分比」時，可設定每筆消費的最高折抵上限。',
      maxDiscountPlaceholder: '例如：50（留空表示無上限）',
      // 2026-09-10 currency-aware max discount unit (replaces inline `rewardValueAmountUnit`).
      // zh-TW: TWD 後綴元, ZAR 前綴R.
      maxDiscountUnitTWD: '元',
      maxDiscountUnitZAR: 'R',
      maxDiscountOptional: '（選填，留空表示無上限）',
      maxDiscountHelper: '設定上限可避免大筆消費時折扣金額過高，確保店家利潤。',
      maxDiscountZeroIsNoCap: '輸入 0 = 無上限',
      // 門檻設定 — 基於拜訪 / 基於消費（2026-09-07）
      accrualThreshold: {
        perVisitTitle: '來訪門檻',
        perVisitVisitsLabel: '次拜訪',
        perVisitStampsLabel: '個蓋章',
        perVisitHelper: '每 N 次拜訪可獲得 M 個蓋章。',
        perSpendTitle: '消費門檻',
        // 2026-09-10 currency-aware per-spend amount label.
        // TWD uses suffix 元消費; ZAR uses prefix R with empty suffix
        // (the verb complement 消費 is dropped because in ZAR locale
        // the prefix-R syntax makes the verb complement redundant).
        // Component code decides whether to render the prefix / suffix
        // span based on store.currency — see AccrualThresholdField.tsx.
        perSpendAmountLabelTWD: '元消費',
        perSpendAmountLabelZAR: 'R',
        perSpendStampsLabel: '個蓋章',
        perSpendHelper: '每消費 N 元可獲得 M 個蓋章。',
        requiredError: '請輸入門檻值',
        visitsMinError: '拜訪次數需大於 0',
        stampsMinError: '蓋章數量需大於 0',
        amountMinError: '消費金額需大於 0',
      },
      // 預覽說明（StampCardLogicPreview 用）
      // 2026-09-10 i18n refactor: {{amount}} / {{cap}} are pre-formatted
      // with the currency unit at the correct position (suffix 元 for
      // zh-TW TWD, prefix R / NT$ for everything else) before being
      // interpolated. Templates provide ONLY locale-correct phrasing —
      // no currency symbols embedded here. Mirrors REWARD preview.
      preview: {
        modeUnknown: '請選擇蓋章方式',
        rewardUnknown: '請填寫獎勵名稱',
        amountReward: '{{amount}}折價',
        percentReward: '{{percent}}%折扣',
        amountWithCap: '{{amount}}折價，最高折抵 {{cap}}',
        percentWithCap: '{{percent}}%折扣，最高折抵 {{cap}}',
        percentNoCap: '{{percent}}%折扣，無折抵上限',
        template: '集滿 {{total}} 個印章可兌換 {{reward}}',
        templateWithCap: '集滿 {{total}} 個印章可兌換 {{reward}}',
        stampUnit: '個印章',
      },
    },
    // 非集點卡的提示（其他卡種尚未實作）
    comingSoon: {
      otherCardTypes: '此卡種的卡片邏輯尚未實作。',
      hint: '選擇「集點卡」或「多通卡」即可設定蓋章與獎勵規則。',
    },
    // ===== REWARD 卡（獎勵卡，2026-09-09）=====
    // 與 stamp 卡的核心差異:
    //   - 點數驅動 (非印章)
    //   - 最多 5 組獎勵級距 (非單一獎勵)
    //   - earningMode: based_on_points / based_on_visits / based_on_spending
    reward: {
      // 進入 Step 6 時的說明
      intro: '設定此獎勵卡的點數累積與獎勵兌換規則',
      introHint: '會員可由自訂條件、拜訪或消費累積點數，集滿指定點數後可兌換獎勵。',
      // ===== Earning Mode 選擇 =====
      earningModeTitle: '點數累積方式',
      earningModeDescription: '選擇此卡要採用哪一種點數累積方式',
      modes: {
        based_on_points: {
          label: '基於點數',
          helper: '會員滿足自訂條件（如完成任務、推薦新會員、填寫問卷等）即獲得點數。適用於鼓勵互動、參與活動的場景。',
        },
        based_on_visits: {
          label: '基於拜訪',
          helper: '顧客每次到訪（出示卡片或掃描 QR 碼）即自動獲得點數。適用於健身房、診所、補習班等需要計算到訪次數的場所。',
        },
        based_on_spending: {
          label: '基於消費',
          helper: '顧客每次消費達指定金額即自動獲得點數，金額由消費記錄系統決定。適用於連鎖餐廳、零售通路等。',
        },
      },
      // ===== 基於拜訪門檻 =====
      pointsPerVisit: {
        title: '每次拜訪獲得點數',
        helper: '顧客每次到訪可獲得的點數。',
        placeholder: '例如：10',
        unit: '點',
        requiredError: '請輸入每次拜訪獲得的點數',
        minError: '每次拜訪至少需獲得 1 點',
      },
      // ===== 基於消費門檻 (per-tier, 2026-09-09) =====
      // 2026-09-09 2nd-pass: equalLabel + earnLabel merged into
      // equalEarnLabel so the sentence renders as "=獲得" with no
      // visible space between "=" and the verb. Previous gap-x-1.5
      // between two separate spans produced "= 獲得" which the user
      // explicitly asked to compact on mobile.
      pointsPerSpend: {
        title: '消費點數比例',
        helper: '每消費 N 元可獲得 M 點。',
        amountLabel: '每消費',
        amountPlaceholder: '例如：100',
        // 2026-09-09: 改為 currency-aware — TWD 後綴元, ZAR 前綴R
        // 渲染層根據 store.currency 條件選擇 prefix / suffix
        amountUnitTWD: '元',
        amountUnitZAR: 'R',
        equalEarnLabel: '=獲得',
        pointsLabel: '個點數',
        pointsPlaceholder: '例如：1',
        pointsUnit: '點',
        requiredError: '請輸入消費金額與點數',
        amountMinError: '消費金額需大於 0',
        pointsMinError: '點數需大於 0',
      },
      // ===== 獎勵級距 =====
      tiersTitle: '獎勵級距',
      tiersHint: '設定會員集滿指定點數可兌換的獎勵。最多可設定 5 組級距。',
      tier: {
        nameTitle: '獎勵名稱',
        namePlaceholder: '例如：1000點折抵10% 或 500點折抵50元',
        nameCounter: '{{count}} / 40',
        nameRequiredError: '請輸入獎勵名稱',
        thresholdTitle: '達成門檻',
        thresholdUnit: '點',
        thresholdPlaceholder: '例如：1000',
        thresholdRequiredError: '請輸入門檻點數',
        thresholdMinError: '門檻點數需大於 0',
        rewardTypeTitle: '獎勵方式',
        rewardTypePlaceholder: '請選擇獎勵方式',
        rewardTypeAmount: '現金折扣',
        rewardTypePercent: '百分比折扣',
        rewardValueTitle: '獎勵值',
        rewardValueAmountPlaceholder: '輸入折抵金額，例如 10',
        rewardValuePercentPlaceholder: '輸入折抵百分比，例如 10',
        // 動態單位: 根據 store.currency 切換元 / R
        rewardValueAmountUnitTWD: '元',
        rewardValueAmountUnitZAR: 'R',
        rewardValuePercentUnit: '%',
        rewardValueRequiredError: '請輸入獎勵值',
        rewardValueInvalidError: '請輸入有效的數字',
        rewardValueTooLargeError: '折抵百分比不能超過 100',
        maxDiscountTitle: '最高折抵金額',
        maxDiscountUnitTWD: '元',
        maxDiscountUnitZAR: 'R',
        maxDiscountPlaceholder: '例如：50（留空表示無上限）',
        maxDiscountOptional: '（選填，留空表示無上限）',
        maxDiscountHelper: '設定上限可避免大筆消費時折扣金額過高。',
      },
      addTier: '新增獎勵級距',
      removeTier: '移除',
      maxTiersReached: '已達最高 5 組級距',
      // ===== 即時預覽湊句 =====
      // 2026-09-09 i18n fix: {{amount}} / {{cap}} already include the
      // currency unit in the correct position (suffix 元 for zh-TW TWD,
      // prefix NT$/R for everything else). Templates provide ONLY the
      // locale-correct phrasing — no currency symbols embedded here.
      preview: {
        modeUnknown: '請選擇累積方式',
        tierUnknown: '請設定獎勵級距',
        amountReward: '{{amount}}折價',
        percentReward: '{{percent}}%折扣',
        amountWithCap: '{{amount}}折價，最高折抵 {{cap}}',
        percentWithCap: '{{percent}}%折扣，最高折抵 {{cap}}',
        percentNoCap: '{{percent}}%折扣，無折抵上限',
        template: '集滿 {{threshold}} 點可兌換 {{reward}}',
      },
      // ===== Validation =====
      validation: {
        earningModeRequired: '請選擇累積方式',
        tierRequired: '請至少設定 1 組獎勵級距',
        tierNameRequired: '獎勵名稱為必填欄位',
        thresholdRequired: '門檻點數為必填欄位',
        rewardTypeRequired: '請選擇獎勵方式',
        rewardValueRequired: '請輸入獎勵值',
      },
    },
  },
  // Step 7: 客製化桌牌
  step7: {
    title: '客製化桌牌',
  },
  // Step 8: 保存
  step8: {
    title: '保存',
  },

  // 即時預覽
  preview: {
    title: '即時預覽',
    empty: '請選擇卡片類型',
    untitled: '未命名卡片',
    togglePreview: '預覽',
    closePreview: '關閉預覽',
    // 卡片正反面切換
    cardSide: '卡片檢視',
    front: '正面',
    back: '反面',
    // PassCardPreview
    passTypeDefault: '卡片',
    cardHolderDefault: '持卡人',
    cardType: '卡片類型',
    // 卡片反面
    backSide: {
      description: '卡片描述',
      automaticUpdates: '自動更新',
      allowNotifications: '允許通知',
      removePass: '移除票卡',
      termsOrLinks: '條文或連結',
      linksTitle: '連結',
      linksEmpty: '（尚未加入連結）',
    },
  },
};
