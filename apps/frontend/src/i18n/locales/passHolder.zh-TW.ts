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
  // 2026-10-17 — submit-error banner copy (Bug 4 umbrella).
  // Close button on the alert banner so the user can dismiss
  // without retrying. Defaults to the localized 'Dismiss' label
  // via i18next fallback if not present.
  submitErrorDismiss: '關閉',
  // 2026-10-17 — diagnostic line shown under tooYoung errors so the
  // user can see the exact value the API received (disambiguates
  // "I typed 1989 but the form sent 2026 due to autofill" from a
  // real backend math bug).
  submitErrorDebug: {
    receivedPrefix: 'API 收到的生日：',
    boundaryMid: '伺服器要求 ≤ ',
  },
  success: {
    title: '感謝您註冊！',
    description: 'Pass 下載功能即將上線，請稍候。',
    backToTemplate: '返回 {{templateName}}',
  },
  errors: {
    templateNotFound: '找不到此模板，可能已下架',
    networkError: '網路錯誤，請稍後重試',
    // 2026-10-17 — Backend-error capture (Bug 4 umbrella).
    // Backend `apps/backend/src/modules/pass-templates/schemas/request.ts`
    // throws these i18n keys when zod rejects a payload (400). The
    // frontend mirrors them verbatim via `passHolderError.i18nKey` —
    // any key the backend emits MUST be defined here or the catch
    // path will leak a raw key into the alert banner. Keep in sync
    // with backend `request.ts` regex / refine messages.
    birthdayInvalid: '生日格式不正確',
    phoneInvalid: '電話號碼格式不正確',
    tooYoung: '需年滿 13 歲',
  },
  validation: {
    nameRequired: '請輸入姓名',
    nameTooShort: '姓名至少 2 個字',
    phoneInvalid: '電話號碼格式不正確',
    birthdayInvalid: '生日格式不正確',
    emailInvalid: 'Email 格式不正確',
    ageTooYoung: '需年滿 13 歲',
  },
  // 2026-10-16: Paid-membership tier picker + simulated payment UI.
  // 翻譯書寫紀律：全中文，禁止中英夾雜（Rule 023 § 翻譯書寫紀律）。
  membership: {
    sectionTitle: '選擇會員方案',
    sectionHint: '請選擇您要加入的會員等級，並完成付款以繼續',
    selectTier: '請選擇方案',
    costFree: '免費',
    perMonth: '每月',
    perYear: '每年',
    rewardsLabel: '會員獎勵',
    payBlockedHint: '請先選擇方案並完成付款',
    // 2026-10-17 — Ecpay 用官方中文名「綠界」取代拉丁拼寫
    // (Rule 023 § 翻譯書寫紀律:zh-TW 嚴格全中文)。
    // Payfast 沒有官方中文名,brand name 走 verify-i18n-keys.mjs::ZHTW_ACRONYM_WHITELIST。
    payButton: {
      payfast: '以 Payfast 付款',
      ecpay: '以綠界付款',
    },
    // 2026-10-16 — CTA 顯示金額 + 動作：user 按下去前知道付多少、拿什麼。
    // zh-TW 全中文（Pass 當產品名、NT$ / R 當貨幣符號），Rule 023 § 翻譯書寫紀律。
    payWithTierAction: '支付 {{amount}} 並領取 Pass',
    payWithFreeTier: '免費領取 Pass',
    paying: '付款處理中…',
    paid: '已付款',
    providerBadge: {
      payfast: 'Payfast',
      ecpay: '綠界',
    },
  },
};