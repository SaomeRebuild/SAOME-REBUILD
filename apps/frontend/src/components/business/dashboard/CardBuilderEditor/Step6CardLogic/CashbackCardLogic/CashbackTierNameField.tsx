/**
 * CashbackTierNameField — Cashback tier sub-field 1 (回饋等級名稱).
 *
 * Renders a `<input type="text">` for the tier name.
 * Calls `updateCashbackTier(tierId, { name })` on each change.
 * Max length: CASHBACK_TIER_NAME_MAX_LENGTH=40.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { CASHBACK_TIER_NAME_MAX_LENGTH } from '@saome/shared/constants';
import type { CashbackTierNameFieldProps } from './CashbackCardLogic.types';

export function CashbackTierNameField({ showValidation, tierId }: CashbackTierNameFieldProps) {
  const { t } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.cashbackTiers.find((tier) => tier.id === tierId),
  );
  const updateCashbackTier = useCardBuilderStore((s) => s.updateCashbackTier);

  if (!tier) return null;

  const name = tier.name;
  const isEmpty = name.trim() === '';
  const showError = showValidation && isEmpty;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-cashback-${tierId}-name`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.cashback.tier.nameTitle')}
      </label>
      <div className="flex flex-col gap-1">
        <input
          id={`step6-cashback-${tierId}-name`}
          type="text"
          inputMode="text"
          value={name}
          onChange={(e) => {
            updateCashbackTier(tierId, { name: e.target.value });
          }}
          placeholder={t('step6.cashback.tier.namePlaceholder')}
          maxLength={CASHBACK_TIER_NAME_MAX_LENGTH}
          aria-label={t('step6.cashback.tier.nameTitle')}
          aria-invalid={showError}
          className={`
            flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm
            text-foreground ring-offset-background
            placeholder:text-muted-foreground
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
            disabled:cursor-not-allowed disabled:opacity-50
            ${showError ? 'border-destructive' : 'border-input'}
          `}
        />
        <div className="flex items-center justify-between">
          {showError && (
            <p className="text-xs text-destructive" role="alert">
              {t('step6.cashback.tier.nameRequiredError')}
            </p>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {name.length} / {CASHBACK_TIER_NAME_MAX_LENGTH}
          </span>
        </div>
      </div>
    </div>
  );
}
