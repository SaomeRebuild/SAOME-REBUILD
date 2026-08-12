export const CONTROLLER_ROWS = [
  {
    labelKey: 'privacy.controller.table.controllerLabel',
    valueKey: 'privacy.controller.table.controllerValue',
  },
  {
    labelKey: 'privacy.controller.table.contactLabel',
    valueKey: 'privacy.controller.table.contactValue',
  },
  {
    labelKey: 'privacy.controller.table.effectiveLabel',
    valueKey: 'privacy.controller.table.effectiveValue',
  },
] as const;

export const COLLECTION_ROWS = [
  {
    typeKey: 'privacy.collection.row1.type',
    purposeKey: 'privacy.collection.row1.purpose',
    basisKey: 'privacy.collection.row1.basis',
  },
  {
    typeKey: 'privacy.collection.row2.type',
    purposeKey: 'privacy.collection.row2.purpose',
    basisKey: 'privacy.collection.row2.basis',
  },
  {
    typeKey: 'privacy.collection.row3.type',
    purposeKey: 'privacy.collection.row3.purpose',
    basisKey: 'privacy.collection.row3.basis',
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
