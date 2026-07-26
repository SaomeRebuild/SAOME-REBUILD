export const SCOPE_ROWS = [
  { labelKey: 'purposeLabel', descKey: 'purposeDesc' },
  { labelKey: 'dataSubjectsLabel', descKey: 'dataSubjectsDesc' },
  { labelKey: 'dataCategoriesLabel', descKey: 'dataCategoriesDesc' },
  { labelKey: 'sensitivityLabel', descKey: 'sensitivityDesc' },
  { labelKey: 'natureLabel', descKey: 'natureDesc' },
  { labelKey: 'durationLabel', descKey: 'durationDesc' },
] as const;

export const ASSISTANCE_ITEMS = [{ key: 'dsr' }, { key: 'dpia' }, { key: 'breach' }] as const;

export const TERMINATION_ITEMS = [{ key: 'deletion' }, { key: 'audit' }] as const;
