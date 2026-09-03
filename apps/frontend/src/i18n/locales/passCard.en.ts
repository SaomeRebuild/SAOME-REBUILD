/**
 * Pass Card — English translations
 * Namespace: passCard
 *
 * Language settings for card preview UI, shared by TemplateCardPreview and PassCardPreview.
 *
 * @module i18n/locales/passCard.en
 */

export default {
  defaultCardType: 'Card',
  defaultIssuerName: 'Unnamed Card',
  defaultName: 'Unnamed Card',
  fieldLabelLeft: 'Left Field',
  fieldLabelRight: 'Right Field',
  // Demo preview data (PassCreator Label/Value pairs — maps to templateSettings.leftField / rightField).
  // label renders as small hint text in the left/right slot; value renders as the larger primary content.
  // Once PassCreator is wired, real values will come from member rows; these are preview-only.
  fieldPreview: {
    phone: { label: 'Phone', value: '+279XXXXXXXXX' },
    email: { label: 'Email', value: 'hi@saome.org' },
    memberLevel: { label: 'Member Level', value: 'Gold' },
    birthday: { label: 'Birthday', value: '05/11/1999' },
    visitCount: { label: 'Visit Count', value: '5 times' },
    memberName: { label: 'Member Name', value: 'Thabo Mokoena' },
  },
};
