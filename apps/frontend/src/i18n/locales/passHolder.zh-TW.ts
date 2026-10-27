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
  // 2026-10-19 — Passcreator V3 per-pass runtime integration.
  // Replaces the prior `success.*` placeholder with the actual
  // download CTA + barcode display + Passwallet reminder + retry
  // banner. Full L2 view lives in
  // `components/business/pass/PassHolderPassDownload/`.
  //
  // 2026-10-19 (split-two-platform-buttons) — Renamed
  // `appleWallet` / `androidWallet` / `directDownload` / `iosHint`
  // to `forIos` / `forAndroid`. The download view now renders TWO
  // side-by-side platform-specific buttons (iOS + Android) instead
  // of one UA-keyed primary + a universal-secondary pair. Each
  // 按鈕各自帶獨立 URI，universal 「下載 .pkpass」按鈕已移除。
  // 翻譯書寫紀律：zh-TW 全中文，Apple / Android 當產品 / 平台名直接寫不翻譯，
  // 符合 Rule 023 § 翻譯書寫紀律的「產品名直接保留」例外。
  // See runs/improvements/feedback/20261019-pass-holder-split-two-platform-buttons.md.
  download: {
    title: 'Pass 已發行！',
    subtitle: '把 Pass 加入你的手機錢包，隨時出示給店員掃描',
    forIos: '給 iPhone 用戶',
    forAndroid: 'Android 用戶',
    barcodeLabel: '條碼內容',
    showBarcodeHint: '櫃台掃描時請出示條碼',
    // Shown when the backend returns no `issuance` field (template
    // pre-launch — known waiting state, not an error).
    notReadyYet: 'Pass 尚未發行，請稍候再試。',
  },
  passwalletReminder: {
    title: 'Android 用戶',
    // v3-fix-tips-copy (2026-10-19): refreshed copy explains that
    // a first install will guide the user to the Play Store to
    // install Passwallet — this is normal expected behavior, not
    // a bug. The previous copy ("請先安裝 Passwallet App，再點
    // 上方「下載 .pkpass」開啟") implied a manual install step
    // that confused users when the actual flow is auto-guided.
    body: '如果 Android 裝置沒有 Passwallet，首次安裝卡片時會被引導至 Play 商店安裝 Passwallet，這是正常現象。安裝後再點上方按鈕即可加入錢包。',
    installCta: '下載 Passwallet',
  },
  downloadError: {
    title: '簽發暫時無法完成',
    body: '伺服器忙碌中，請稍後重試。',
    retry: '重試簽發',
  },
  // 2026-10-19 — Production recovery UI for the V3 partial-update bug.
  // When a holder row was registered BEFORE the COALESCE fix landed
  // (2026-10-19), the barcode backfill's second UPDATE wiped
  // pass_identifier / download_url / issued_at / iphone_uri /
  // android_uri back to NULL. Such rows now have `barcode_value`
  // set but all 3 URIs missing — the frontend distinguishes this
  // state ("lost data" from the pre-fix era) and renders a banner
  // asking the user to contact support, since V3 LIST response
  // doesn't expose identifier / iPhoneUri / androidUri for
  // re-issuance — only downloadPage is recoverable.
  //
  // See:
  //   - runs/improvements/feedback/20261019-pass-holder-v3-partial-update-bug.md
  //   - apps/backend/src/modules/pass-templates/db/passHolders.ts::updatePassHolderIssuance
  //     (COALESCE partial update fix — runtime columns preserved).
  lostData: {
    title: '您的 Pass 缺少部分資訊',
    body: '此筆 Pass 的某些欄位因系統異常而遺失，請聯絡客服協助重新簽發。我們仍可保留您的條碼內容。',
    contactCta: '聯絡客服',
  },
  errors: {
    templateNotFound: '找不到此模板，可能已下架',
    networkError: '網路錯誤，請稍後重試',
    // 2026-10-19 — V3 upstream failure i18n key. Backend writes this
    // into `pass_holders.issuance_error` when Passcreator V3 rejects
    // or times out. Frontend surfaces it via `PassHolderDownloadErrorBanner`.
    upstreamFailed: '簽發服務暫時無法使用，請稍後再試或聯絡客服。',
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
    // 2026-10-23 — 贈品卡購買流程。Backend `registerService::
    // deriveGiftCardPurchase` 在下列情境會 throw 這些 key,前端 banner
    // 直接顯示（與 backend `schemas/request.ts` 保持同步）。
    // 「購買點數」而不是「購買金額」——價格由商家設定的兌換率換算,
    // 顧客永遠不能自己改價。
    pointsForbiddenForNotRequired: '購買點數不可標示為免費',
    giftCardPointsRequired: '請選擇要購買的點數',
    giftCardNotConfigured: '此贈品卡尚未設定兌換率,請聯絡商家',
    // 2026-10-27 — 會員等級快照由後端從範本重算,前端只送 tier index。
    // 這兩個 key 由 `apps/backend/src/modules/pass-templates/services/
    // registerService.ts::deriveMembershipTierSnapshot` 產生。
    membershipTierRequired: '請選擇會員等級方案',
    membershipTierInvalid: '會員等級方案已變更,請重新整理頁面後再試',
  },
  validation: {
    nameRequired: '請輸入姓名',
    nameTooShort: '姓名至少 2 個字',
    phoneInvalid: '電話號碼格式不正確',
    birthdayInvalid: '生日格式不正確',
    emailInvalid: 'Email 格式不正確',
    ageTooYoung: '需年滿 13 歲',
    // 2026-10-23 — 贈品卡購買驗證訊息。
    // 這四個 key 由 `packages/shared/logic/giftCardPurchase.ts` 產生,
    // 網頁與未來的手機版 App 共用同一組 key（Rule 023 §
    // Shared Validation 用 i18n Key）。
    pointsInvalid: '請輸入有效的點數',
    pointsBelowMin: '點數低於最低購買量',
    pointsAboveMax: '點數高於單次購買上限',
    pointsNotMultipleOfRate: '點數必須是兌換單位的倍數',
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
  // 2026-10-23: 贈品卡購買區塊（兌換率說明 + 點數輸入 + 贈送提示）。
  //
  // 贈品卡賣的是「點數」不是「金額」:顧客輸入點數,應付金額由商家
  // 設定的兌換率換算,所以介面上沒有金額輸入框——金額永遠是唯讀的
  // 計算結果,後端也會用同一套換算邏輯重新計算一次。
  //
  // 翻譯書寫紀律:zh-TW 全中文（點數 / 兌換 / 贈品）;數字範圍用
  // {{min}} / {{max}} 插值,不寫死數字,商家改設定後文案自動跟上。
  gift: {
    sectionTitle: '購買點數',
    sectionHint: '以下為商家設定的兌換方式,購買後點數可直接於店家使用',
    rateLabel: '兌換率',
    rateValue: '每 {{amount}} 可獲得 {{points}} 點',
    rangeLabel: '單次購買範圍',
    rangePoints: '{{min}} 點 ~ {{max}} 點',
    // 金額上下限由商家在 CardBuilder Step 6 設定（checkoutMinAmount /
    // checkoutMaxAmount），與上面的點數上下限是同一組 fence 的兩個維度。
    // 兩者並列顯示,顧客才知道輸入 100 點要付多少。
    amountRangeLabel: '單筆付款金額',
    amountRangeValue: '{{min}} ~ {{max}}',
    usageHint: '結帳時出示手機錢包中的卡片,店員掃描條碼即可扣抵點數',
    tipsTitle: '要送人嗎?',
    tipsBody: '直接填寫對方的姓名、電話、生日與信箱即可,Pass 會寄給對方。',
    pointsLabel: '購買點數',
    pointsPlaceholder: '請輸入點數',
    amountLabel: '應付金額',
    amountEmpty: '尚未輸入點數',
    fenceHintLabel: '可購買範圍:',
    payButton: {
      payfast: '以 Payfast 付款',
      ecpay: '以綠界付款',
    },
    payWithAmountAction: '支付 {{amount}} 並領取 Pass',
    paying: '付款處理中…',
    paid: '已付款',
  },
};