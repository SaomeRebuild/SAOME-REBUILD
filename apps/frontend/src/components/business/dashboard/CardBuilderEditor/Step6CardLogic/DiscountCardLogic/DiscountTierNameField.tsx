/**
 * DiscountTierNameField — Discount tier sub-field 1 (折扣等級名稱).
 *
 * Renders a `<input type="text">` for the tier name.
 * Calls `updateDiscountTier(tierId, { name })` on each change.
 * Max length: DISCOUNT_TIER_NAME_MAX_LENGTH=40.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { DISCOUNT_TIER_NAME_MAX_LENGTH } from '@saome/shared/constants';
import type { DiscountTierNameFieldProps } from './DiscountCardLogic.types';

export function DiscountTierNameField({ showValidation, tierId }: DiscountTierNameFieldProps) {
  const { t } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.discountTiers.find((tier) => tier.id === tierId),
  );
  const updateDiscountTier = useCardBuilderStore((s) => s.updateDiscountTier);

  if (!tier) return null;

  const name = tier.name;
  const isEmpty = name.trim() === '';
  const showError = showValidation && isEmpty;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-discount-${tierId}-name`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.discount.tier.nameTitle')}
      </label>
      <div className="flex flex-col gap-1">
        <input
          id={`step6-discount-${tierId}-name`}
          type="text"
          inputMode="text"
          value={name}
          onChange={(e) => {
            updateDiscountTier(tierId, { name: e.target.value });
          }}
          placeholder={t('step6.discount.tier.namePlaceholder')}
          maxLength={DISCOUNT_TIER_NAME_MAX_LENGTH}
          aria-label={t('step6.discount.tier.nameTitle')}
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
              {t('step6.discount.tier.nameRequiredError')}
            </p>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {name.length} / {DISCOUNT_TIER_NAME_MAX_LENGTH}
          </span>
        </div>
      </div>
    </div>
  );
}
