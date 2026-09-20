/**
 * MultipassTierNameField — Tier name input.
 *
 * Renders a `<input type="text">` for the tier name.
 * Calls `updateMultipassTier(tierId, { name })` on each change.
 * Max length: MULTIPASS_TIER_NAME_MAX_LENGTH=40.
 *
 * Validation: surfaces a red border + error message when `showValidation`
 * is true AND the name is blank.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MULTIPASS_TIER_NAME_MAX_LENGTH } from '@saome/shared/constants';
import type { MultipassTierNameFieldProps } from './MultipassCardLogic.types';

export function MultipassTierNameField({ showValidation, tierId }: MultipassTierNameFieldProps) {
  const { t } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.multipassTiers.find((tier) => tier.id === tierId),
  );
  const updateMultipassTier = useCardBuilderStore((s) => s.updateMultipassTier);

  if (!tier) return null;

  const name = tier.name;
  const isEmpty = name.trim() === '';
  const showError = showValidation && isEmpty;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-multipass-${tierId}-name`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.multipass.tier.nameTitle')}
      </label>
      <div className="flex flex-col gap-1">
        <input
          id={`step6-multipass-${tierId}-name`}
          type="text"
          inputMode="text"
          value={name}
          onChange={(e) => {
            updateMultipassTier(tierId, { name: e.target.value });
          }}
          placeholder={t('step6.multipass.tier.namePlaceholder')}
          maxLength={MULTIPASS_TIER_NAME_MAX_LENGTH}
          aria-label={t('step6.multipass.tier.nameTitle')}
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
              {t('step6.multipass.tier.nameRequiredError')}
            </p>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {name.length} / {MULTIPASS_TIER_NAME_MAX_LENGTH}
          </span>
        </div>
      </div>
    </div>
  );
}
