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
    memberLevel: { label: '會員等級', value: '金級', stampLabel: '獎勵' },
    birthday: { label: '生日', value: '05/11/1999' },
    visitCount: { label: '拜訪次數', value: '5 次' },
    memberName: { label: '會員姓名', value: '王大明' },
    // 印章卡專用欄位預覽 — 僅在 stamp_card / multipass 時顯示於下拉選單
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
};
