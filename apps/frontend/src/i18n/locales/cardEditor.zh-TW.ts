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
      hint: '選擇要顯示在卡片正面的兩個欄位。之後會依 Step 1 選擇的卡片類型增減可用選項。',
      leftField: '左欄位',
      rightField: '右欄位',
      placeholder: '請選擇',
      disabledSuffix: '已選',
      fields: {
        phone: '電話',
        email: 'E-mail',
        memberLevel: '會員等級',
        birthday: '生日',
        visitCount: '拜訪次數',
        memberName: '會員姓名',
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
      valuePlaceholder: 'https://example.com',
      labelLabel: '名稱',
      valueLabel: '網址',
      counter: '{{count}} / 4',
      maxReached: '最多 4 個連結',
      invalidUrl: '網址格式不正確',
    },
  },
  // Step 5: 地理位置
  step5: {
    title: '地理位置',
  },
  // Step 6: 卡片邏輯
  step6: {
    title: '卡片邏輯',
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
