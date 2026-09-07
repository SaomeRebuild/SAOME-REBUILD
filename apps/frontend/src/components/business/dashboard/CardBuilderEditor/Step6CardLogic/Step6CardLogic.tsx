/**
 * Step6CardLogic — Generic dispatcher.
 *
 * Routes to the appropriate card-type-specific logic sub-module.
 * Currently only `stamp_card` / `multipass` have a real implementation.
 * All other card types render a ComingSoon placeholder.
 *
 * Architecture (Rule 000 § A.1 L2 結構):
 *   - One folder per L2 business component
 *   - Dispatcher stays ≤ 80 lines, delegates to sub-modules
 *   - Future card types add their own sub-module without changing this file
 *
 * 2026-09-07: First sub-module = StampCardLogic (集點卡).
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { StampCardLogic } from './StampCardLogic';
import { Step6CardLogicComingSoon } from './Step6CardLogicComingSoon';
import type { Step6CardLogicProps } from './Step6CardLogic.types';

/**
 * Step 6 dispatcher — routes to the right sub-module based on cardType.
 *
 * cardType === null (no type selected yet) → ComingSoon
 * cardType === 'stamp_card' | 'multipass' → StampCardLogic (集點卡)
 * Other card types → ComingSoon (not yet implemented)
 */
export function Step6CardLogic({ showValidation }: Step6CardLogicProps) {
  const { t } = useTranslation('cardEditor');
  const cardType = useCardBuilderStore((s) => s.cardType);

  // No type selected yet — show a gentle placeholder.
  if (!cardType) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <Step6CardLogicComingSoon cardType={null} />
      </div>
    );
  }

  // stamp_card and multipass share the same stamp card logic editor.
  if (cardType === 'stamp_card' || cardType === 'multipass') {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {/* Step 6 hero intro */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">{t('step6.intro')}</p>
          <p className="text-xs text-muted-foreground">{t('step6.introHint')}</p>
        </div>
        <StampCardLogic showValidation={showValidation} />
      </div>
    );
  }

  // Other card types: ComingSoon placeholder.
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 p-4">
        <p className="text-sm font-medium text-foreground">{t('step6.intro')}</p>
        <p className="text-xs text-muted-foreground">{t('step6.introHint')}</p>
      </div>
      <Step6CardLogicComingSoon cardType={cardType} />
    </div>
  );
}
