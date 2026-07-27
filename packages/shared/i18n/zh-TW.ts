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
  },
};

export type TranslationKeys = typeof zhTW;
