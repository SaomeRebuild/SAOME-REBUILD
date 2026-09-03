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
    memberLevel: { label: '會員等級', value: '金級' },
    birthday: { label: '生日', value: '05/11/1999' },
    visitCount: { label: '拜訪次數', value: '5 次' },
    memberName: { label: '會員姓名', value: '王大明' },
  },
};
