/**
 * Pass Card — Chinese (Traditional) translations
 * Namespace: passCard
 *
 * 卡片預覽 UI 的語言設定，供 TemplateCardPreview 與 PassCardPreview 共用。
 *
 * @module i18n/locales/passCard.zh-TW
 */

export default {
  defaultCardType: '卡片',
  defaultIssuerName: '未命名卡片',
  defaultName: '未命名卡片',
  fieldLabelLeft: '左欄位',
  fieldLabelRight: '右欄位',
  // Demo 預覽資料（PassCreator Label/Value 配對 — 對應 templateSettings.leftField / rightField）。
  // label 用於卡片正面左/右欄位的小字提示，value 用於同欄位的較大字主要內容。
  // 當 PassCreator 整合後，real value 將由 member row 提供，此處僅供 preview 使用。
  fieldPreview: {
    phone: { label: '電話', value: '+8869XXXXXXXX' },
    email: { label: 'E-mail', value: 'hi@saome.org' },
    memberLevel: { label: '會員等級', value: '金級', stampLabel: '獎勵', discountLabel: '折扣等級' },
    birthday: { label: '生日', value: '05/11/1999' },
    visitCount: { label: '拜訪次數', value: '5 次' },
    memberName: { label: '會員姓名', value: '王大明' },
    // 印章卡專用欄位預覽 — 僅在 stamp_card 時顯示於下拉選單（2026-09-20 與 multipass 解耦）
    // totalStamps 的 value 使用 {{rows}} 內插，由 PassCardPreviewBody 帶入 stampGridRows
    availableRewards: { label: '可用獎勵', value: '2 次' },
    totalStamps: { label: '總印章數', value: '3/{{rows}}' },
    stampsRemaining: { label: '還差幾個章', value: '6個' },
    // 獎勵卡專用欄位預覽 — 僅在 reward_card 時顯示於下拉選單
    // (2026-09-10 reward card display-field extension)
    // value 為靜態 demo，與 phone/email/visitCount 等其他 demo 欄位對齊。
    // 實作 PassCreator 整合後將從 member row 取真實點數。
    pointsToNextTier: { label: '到下一階還差', value: '123點' },
    currentPoints: { label: '已累積點數', value: '23點' },
    // 現金回饋卡專用欄位預覽 — 僅在 cashback_card 時顯示於下拉選單（2026-09-12）
    // value 不存於此處，由 `@saome/shared/constants/cashbackPreviewAmounts.ts`
    // 的 currency-driven map 提供（TWD → "562元" / ZAR → "R562"），
    // PassCardPreviewBody 在 runtime 從 map 讀取。本 locale 只保留 label。
    // 為什麼 label / value 拆開（Rule 023 § 翻譯書寫紀律）：en 翻譯不能含
    // Han 字元，"562元" 不能放進 passCard.en.ts。
    // 2026-09-13 ZAR 污染修正：原本 PassCardPreviewBody 對所有 i18n value
    // 套用 regex 加 R 前綴，把非金額欄位（電話 +886... → R886...、拜訪
    // 次數 5 次 → R5 等）污染到所有卡種。Cashback 現在改為 currency-driven
    // 欄位（跟餘額預覽同一模式，餘額由 PassCardPreviewHeader 對應另一個
    // shared constant）。
    pointsToNextTierCashback: { label: '到下個層級還差' },
    accumulatedSpendCashback: { label: '已累積消費' },
    // 折扣卡專用欄位預覽 — 僅在 discount_card 時顯示於下拉選單(2026-09-18)。
    // 兩個 amount field 的 value 不存於此處,由
    // `@saome/shared/constants/discountPreviewAmounts.ts` 的 currency-driven
    // map 提供(TWD → "234元" / ZAR → "R234"),
    // PassCardPreviewBody 在 runtime 從 map 讀取。本 locale 只保留 label。
    // 沿用 cashback 的 label/value 拆分邏輯(Rule 023 § 翻譯書寫紀律)。
    // discountTierBracket 的 value 直接由 store 派生
    // (`discountTiers[0].discountPercent` + '%'),不走 currency-driven map。
    pointsToNextTierDiscount: { label: '到下一級還差' },
    discountTierBracket: { label: '折扣級距' },
    accumulatedSpendDiscount: { label: '累積消費' },
    // Coupon-only preview fields — only shown in dropdown for coupon_card
    // (2026-09-19).
    // couponRemainingCount value 為靜態 demo "1張" (與 phone/email/visitCount 模式對齊)。
    // 2026-09-20 新增 countFormat: 當 user 設定 couponIssueCount != 1 時
    // (Step 6 數量欄位),body 端用此模板 "{{count}}張" 內插顯示實際張數
    // (修前只顯示純數字 "5",缺單位;詳見 feedback 2026-09-20 coupon
    // preview units regression)。
    //
    // couponDiscount value 由 store 驅動(i18n 模板內插):
    //   - amount_off + couponDiscountAmount=N → "{{N}}元折扣" (zh-TW) / "NT${{N}} off" (en)
    //   - percent_off + couponDiscountPercent=N → "{{N}}%折扣" (zh-TW) / "{{N}}% off" (en)
    //   - 任一欄位為 null(尚未填入) → 空字串(不顯示佔位文字,符合其他必填欄位 UX)
    //
    // 2026-09-19 bug 修正: 原本以 COUPON_PREVIEW_AMOUNTS 硬編 "10元折扣" /
    // "R10折扣" 當 placeholder,使用者輸入 50 後仍顯示 "10元折扣"(無視輸入)。
    // 新行為: 直接讀 store couponDiscountAmount / couponDiscountPercent
    // 並內插到 i18n 模板,使用者輸入什麼就顯示什麼。
    //
    // 2026-09-20 en TWD 加 NT$ 前綴修正: en + TWD + amount_off 原為
    // "{{amount}} off" 缺貨幣符號;TWD 在 en 慣例為 NT$ (ISO 4217)。
    //
    // 為什麼 amountFormat / amountFormatZAR / percentFormat 拆 3 個 key:
    //   - zh-TW: "10元折扣" 把元放金額後面;en "NT$10 off" 把 NT$ 放金額前面;
    //     ZAR 是 "R10折扣"(R 在前),不能共用同一個模板
    //   - percent_format 共用,zh-TW / en 都是 "<n>%折扣" / "<n>% off"
    couponRemainingCount: {
      label: '剩餘張數',
      value: '1張',
      countFormat: '{{count}}張',
    },
    couponDiscount: {
      label: '折扣優惠',
      // 2026-09-20: 無 `value` key — 無 `value:` 行時，brace tracker
      // 的 values tracker 略過這個 key（只有有 assignment 才 push），keys
      // tracker 仍收集 `fieldPreview.couponDiscount.value`，但不進入 values
      // 陣列，所以不觸發 empty-value check。
      // 真實 coupon 值走 amountFormatTWD/ZAR/percentFormat 模板（store 驅動）。
      amountFormatTWD: '{{amount}}元折扣',
      amountFormatZAR: 'R{{amount}}折扣',
      percentFormat: '{{percent}}%折扣',
    },
    // ===== MultiPass 卡預覽欄位 (2026-09-20) =====
    // Step 3 選 multipass 時，leftField / rightField 下拉選到此三個 key 時的預覽值。
    //   - multipassCompleted: 靜態 demo "1次"（與 availableRewards "2 次" pattern 對齊）
    //   - multipassPointsToNextTier: 靜態 demo "2次集滿"
    //   - multipassRewardContent: store 驅動，amount_off → amountFormatTWD/ZAR，
    //     percent_off → percentFormat（TWD → "10元折扣"、ZAR → "R10折扣"）
    // multipass 卡的「會員等級」slot 不在此處 — 它直接複用既有 common 欄位
    // `memberLevel`，由 PassCardPreviewBody 的 `multipass + memberLevel` override
    // branch 處理（mirror `membership_card` 模式：label 走 `fieldPreview.memberLevel.label`
    // default、value 走 `firstMultipassTierName ?? ''`）。
    multipassCompleted: { label: '累積已滿', value: '1次' },
    multipassPointsToNextTier: { label: '到下個等級還差', value: '2次集滿' },
    multipassRewardContent: {
      label: '獎勵內容',
      amountFormatTWD: '{{amount}}元折扣',
      amountFormatZAR: 'R{{amount}}折扣',
      percentFormat: '{{percent}}%折扣',
    },
  },
  // ===== 餘額預覽 — 僅在 stamp_card / reward_card / cashback_card 顯示 =====
  // Step 1 選這 3 種卡時，PassCardPreviewHeader 的右側卡種 pill 會被替換成兩行垂直區塊。
  //   - label: "餘額" (locale-driven，由 i18n 提供)
  //   - value: 由 store.currency 決定 — TWD → "200元"、ZAR → "R100" (1:0.5 換算)
  //   注意：value 字串放在 `@saome/shared/constants/balancePreview.ts` 而非 i18n，
  //   因為貨幣單位與金額是「由 store.currency 決定」而非由 i18n locale 決定。
  //   （en 翻譯禁止包含 Han 字元，故不能把 "200元" 放進 passCard.en.ts。）
  //   詳見 plan § 設計決策與 Rule 024 § 業務邏輯在 shared/。
  balancePreview: {
    label: '餘額',
  },
  // ===== 會員到期日預覽 — 僅在 membership_card 顯示 =====
  // Step 1 選 membership_card 時，PassCardPreviewHeader 的右側卡種 pill 會被替換成兩行垂直區塊。
  //   - label: "會員到期日" (locale-driven，由 i18n 提供)
  //   - value: 由 store.hasExpiry 決定 — true → 格式化後的 expiryDate
  //     ("2027.10.23" zh-TW / "10.23.2027" en)；false → "∞" (無限符號)
  //   日期格式遵循 locale 慣例：
  //     - zh-TW: YYYY.MM.DD（依 user-confirmed UX）
  //     - en:    MM.DD.YYYY（US-style 依 user-confirmed UX）
  //   expiryDate 來自 store.expiryDate (ISO YYYY-MM-DD 字串)。
  //   當 hasExpiry=true 且 expiryDate 為空時，fallback 到 "—" (placeholder)。
  memberExpiry: {
    label: '會員到期日',
  },
// ===== 折扣卡到期預覽 — 僅在 discount_card 顯示 (2026-09-18) =====
  // Step 1 選 discount_card 時,PassCardPreviewHeader 的右側卡種 pill 會被替換成
  // 兩行垂直區塊。
  //   - label: "有效期限" (locale-driven, 由 i18n 提供)
  //   - value: 由 store.discountCustomExpiryDays / discountSpecificExpiryDate 決定:
  //       - discountCustomExpiryDays 設定 → today + N 天 formatted per locale
  //         ("2026.10.30" zh-TW / "10.30.2026" en)
  //       - discountSpecificExpiryDate 設定 → 直接 formatted per locale
  //       - 兩者皆 null → "—" (理論上不會發生,因為 Step 6 expiry 為必填)
  //   與 memberExpiry 不同:discount card 的到期日是 *card-level* 必填欄位
  //   (Step 6 DiscountExpiryFields 必填),不是 membership 式的"是否啟用"切換。
  //   沿用既有 `formatExpiryDate(isoDate, locale)` helper
  //   (zh-TW YYYY.MM.DD / en MM.DD.YYYY)。
  discountExpiry: {
    label: '有效期限',
  },
  // ===== Coupon 卡到期預覽 — 僅在 coupon_card 顯示 (2026-09-19) =====
  // Step 1 選 coupon_card 時,PassCardPreviewHeader 的右側卡種 pill 會被替換成
  // 兩行垂直區塊。
  //   - label: "有效期限" (locale-driven, 由 i18n 提供)
  //   - value: 由 store.passValidDays / store.expiryDate 決定
  //     (coupon card 保留 Step 2 的 PassValidDaysField + ExpiryDateField,
  //     跟 membership_card 不同 — membership 隱藏了這兩個欄位):
  //       - passValidDays 設定 → today + N 天 formatted per locale
  //         ("2026.10.30" zh-TW / "10.30.2026" en)
  //       - expiryDate 設定 → 直接 formatted per locale
  //       - 兩者皆 null / '' → "∞" (無限符號,跟 membership_card 的
  //         hasExpiry=false 行為對齊 — 折價券預設無限期)
  //   沿用既有 `formatExpiryDate(isoDate, locale)` helper
  //   (zh-TW YYYY.MM.DD / en MM.DD.YYYY)。
  //   Label 沿用 "有效期限" — 跟 discountExpiry 同一個詞,語意也一致
  //   (都是「卡片層級的有效期限結束日」)。
  couponExpiry: {
    label: '有效期限',
  },
};
