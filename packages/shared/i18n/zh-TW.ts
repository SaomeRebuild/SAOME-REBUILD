/**
 * Chinese (Traditional) Translations
 *
 * @module shared/i18n/zh-TW
 */

export const zhTW = {
  common: {
    save: '儲存',
    cancel: '取消',
    delete: '刪除',
    edit: '編輯',
    submit: '送出',
    loading: '載入中...',
    error: '發生錯誤',
    success: '成功',
    back: '返回',
    next: '下一步',
  },
  member: {
    title: '會員',
    tier: {
      bronze: '銅牌',
      silver: '銀牌',
      gold: '金牌',
      ariaLabel: '會員等級：{{tier}}',
    },
    register: '註冊會員',
    login: '登入',
    logout: '登出',
    profile: '會員資料',
  },
  auth: {
    title: {
      login: '登入',
      register: '店家註冊',
      comingSoon: '即將推出',
    },
    login: {
      emailLabel: 'Email',
      emailPlaceholder: '請輸入 Email',
      passwordLabel: '密碼',
      passwordPlaceholder: '請輸入密碼',
      submit: '登入',
      errorInvalid: '帳號或密碼錯誤',
      sessionExpired: '您的 session 已過期，請重新登入',
      noAccountPrompt: '還沒有帳號？',
      registerCta: '立即註冊',
    },
    register: {
      step1Title: 'Step 1：店家資料',
      step2Title: 'Step 2：帳號資料',
      fields: {
        contactName: '聯絡人姓名',
        phoneCity: '市內電話',
        address: '公司地址',
        taxId: '統一編號(無可填 0)',
        companyName: '公司/店家名稱',
        invoiceAddress: '發票寄送地址',
        email: '登入 Email',
        password: '密碼',
        confirmPassword: '確認密碼',
        mobile: '行動電話',
        website: '公司/店家網址',
        businessEmail: '商業聯絡 Email',
      },
      taxIdHint: '若無統一編號，請填 0',
      submitStep1: '下一步',
      submitStep2: '建立帳號',
      success: '註冊成功',
    },
    lockout: {
      title: '帳號已被暫時鎖定',
      body: '由於連續 {{count}} 次登入失敗，帳號已被暫時鎖定。請於倒數結束後再試。',
      remaining: '剩 {{time}}',
    },
    comingSoon: {
      appTitle: '店家後台 即將推出',
      appBody: '我們正在為您打造最棒的店家管理工具，敬請期待。',
      adminTitle: '管理後台 即將推出',
      adminBody: '管理後台建置中。',
    },
    languages: {
      'zh-TW': '繁體中文',
      en: 'English',
    },
  },
  pass: {
    title: '通行證',
    tier: {
      basic: '基本版',
      premium: '進階版',
      enterprise: '企業版',
    },
    active: '有效',
    expired: '已過期',
    purchase: '購買通行證',
  },
  order: {
    title: '訂單',
    status: {
      pending: '等待中',
      paid: '已付款',
      shipped: '已出貨',
      delivered: '已送達',
      cancelled: '已取消',
    },
    create: '建立訂單',
  },
  validation: {
    required: '此欄位為必填',
    email: '請輸入有效的電子郵件',
    minLength: '至少需要 {min} 個字元',
    maxLength: '最多 {max} 個字元',
    passwordTooShort: '密碼至少需要 8 個字元',
    passwordMismatch: '兩次密碼不一致',
    taxIdInvalid: '統一編號格式錯誤（請填 0 或 8 碼數字）',
    lockedOut: '帳號已被暫時鎖定，請稍後再試',
    emailAlreadyUsed: '此 Email 已被使用',
    networkError: '網路連線異常，請稍後再試',
  },
};

export type TranslationKeys = typeof zhTW;

