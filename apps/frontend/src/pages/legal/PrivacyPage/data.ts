export const CONTROLLER_ROWS = [
  {
    labelKey: 'legal.privacy.controller.table.controllerLabel',
    valueKey: 'legal.privacy.controller.table.controllerValue',
  },
  {
    labelKey: 'legal.privacy.controller.table.contactLabel',
    valueKey: 'legal.privacy.controller.table.contactValue',
  },
  {
    labelKey: 'legal.privacy.controller.table.effectiveLabel',
    valueKey: 'legal.privacy.controller.table.effectiveValue',
  },
] as const;

export const COLLECTION_ROWS = [
  {
    typeKey: 'legal.privacy.collection.row1.type',
    purposeKey: 'legal.privacy.collection.row1.purpose',
    basisKey: 'legal.privacy.collection.row1.basis',
  },
  {
    typeKey: 'legal.privacy.collection.row2.type',
    purposeKey: 'legal.privacy.collection.row2.purpose',
    basisKey: 'legal.privacy.collection.row2.basis',
  },
  {
    typeKey: 'legal.privacy.collection.row3.type',
    purposeKey: 'legal.privacy.collection.row3.purpose',
    basisKey: 'legal.privacy.collection.row3.basis',
  },
] as const;

export const RIGHT_ITEMS = [
  { titleKey: 'accessTitle', descKey: 'accessDesc' },
  { titleKey: 'rectificationTitle', descKey: 'rectificationDesc' },
  { titleKey: 'erasureTitle', descKey: 'erasureDesc' },
  { titleKey: 'restrictionTitle', descKey: 'restrictionDesc' },
  { titleKey: 'portabilityTitle', descKey: 'portabilityDesc' },
  { titleKey: 'objectionTitle', descKey: 'objectionDesc' },
] as const;

export const RETENTION_ITEMS = [{ key: 'dataRetention' }, { key: 'security' }] as const;
