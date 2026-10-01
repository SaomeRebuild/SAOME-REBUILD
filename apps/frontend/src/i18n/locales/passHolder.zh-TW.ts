/**
 * Pass Holder Registration — Chinese (Traditional) translations
 * Namespace: passHolder
 *
 * 公開頁「取得 Pass」表單的語系設定；目標對象是錢包卡持有人（Pass Holder），
 * 不是 SAOME 平台會員。
 *
 * @module i18n/locales/passHolder.zh-TW
 */

export default {
  title: '取得您的專屬 Pass',
  subtitle: '填寫以下資料，立即加入 {{issuerName}}',
  fields: {
    name: {
      label: '姓名',
      placeholder: '請輸入您的姓名',
    },
    phone: {
      countryCodeLabel: '國碼',
      numberLabel: '電話號碼',
      numberPlaceholder: '0912345678',
    },
    birthday: {
      label: '生日',
      hint: '至少需年滿 13 歲',
    },
    email: {
      label: 'Email',
      placeholder: 'you@example.com',
    },
  },
  submit: '取得 Pass',
  submitting: '送出中...',
  success: {
    title: '感謝您註冊！',
    description: 'Pass 下載功能即將上線，請稍候。',
    backToTemplate: '返回 {{templateName}}',
  },
  errors: {
    templateNotFound: '找不到此模板，可能已下架',
    networkError: '網路錯誤，請稍後重試',
  },
  validation: {
    nameRequired: '請輸入姓名',
    nameTooShort: '姓名至少 2 個字',
    phoneInvalid: '電話號碼格式不正確',
    birthdayInvalid: '生日格式不正確',
    emailInvalid: 'Email 格式不正確',
    ageTooYoung: '需年滿 13 歲',
  },
};