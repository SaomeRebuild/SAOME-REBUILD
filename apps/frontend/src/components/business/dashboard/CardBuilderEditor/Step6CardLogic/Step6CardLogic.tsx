/**
 * Step6CardLogic — Generic dispatcher.
 *
 * Routes to the appropriate card-type-specific logic sub-module.
 * Implemented: `stamp_card` (StampCardLogic),
 *              `multipass` (MultipassCardLogic, 2026-09-19 PR-3 split out
 *                           from the shared `stamp_card` branch — multipass
 *                           now has its own dedicated sub-module + tier
 *                           structure + i18n namespace),
 *              `reward_card` (RewardCardLogic),
 *              `cashback_card` (CashbackCardLogic),
 *              `membership_card` (MembershipCardLogic, 2026-09-13),
 *              `discount_card` (DiscountCardLogic, 2026-09-18),
 *              `coupon_card` (CouponCardLogic, 2026-09-19).
 * All other card types render a ComingSoon placeholder.
 *
 * Architecture (Rule 000 § A.1 L2 結構):
 *   - One folder per L2 business component
 *   - Dispatcher stays ≤ 80 lines, delegates to sub-modules
 *   - Future card types add their own sub-module without changing this file
 *
 * History:
 *   - 2026-09-07: First sub-module = StampCardLogic (集點卡, shared with multipass).
 *   - 2026-09-09: Second sub-module = RewardCardLogic (獎勵卡).
 *   - 2026-09-11: Third sub-module = CashbackCardLogic (現金回饋卡).
 *   - 2026-09-13: Fourth sub-module = MembershipCardLogic (會員卡).
 *   - 2026-09-18: Fifth sub-module = DiscountCardLogic (折扣卡).
 *   - 2026-09-19: Sixth sub-module = CouponCardLogic (折價券).
 *   - 2026-09-19 PR-3: Seventh sub-module = MultipassCardLogic (多通卡).
 *                       Split out of the shared `stamp_card` branch because
 *                       multipass cards have a fundamentally different tier
 *                       structure (5 tiers × {name + stampsNeeded + reward
 *                       type + reward value} instead of a single flat rule).
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { StampCardLogic } from './StampCardLogic';
import { RewardCardLogic } from './RewardCardLogic';
import { CashbackCardLogic } from './CashbackCardLogic';
import { DiscountCardLogic } from './DiscountCardLogic';
import { MembershipCardLogic } from './MembershipCardLogic';
import { CouponCardLogic } from './CouponCardLogic';
import { MultipassCardLogic } from './MultipassCardLogic';
import { Step6CardLogicComingSoon } from './Step6CardLogicComingSoon';
import type { Step6CardLogicProps } from './Step6CardLogic.types';

/**
 * Step 6 dispatcher — routes to the right sub-module based on cardType.
 *
 * cardType === null (no type selected yet) → ComingSoon
 * cardType === 'stamp_card'              → StampCardLogic (集點卡)
 * cardType === 'multipass'                → MultipassCardLogic (多通卡, 2026-09-19)
 * cardType === 'reward_card'              → RewardCardLogic (獎勵卡)
 * cardType === 'cashback_card'            → CashbackCardLogic (現金回饋卡)
 * cardType === 'discount_card'            → DiscountCardLogic (折扣卡)
 * cardType === 'membership_card'          → MembershipCardLogic (會員卡)
 * cardType === 'coupon_card'              → CouponCardLogic (折價券, 2026-09-19)
 * Other card types → ComingSoon (not yet implemented)
 */
export function Step6CardLogic({ showValidation }: Step6CardLogicProps) {
  const { t } = useTranslation('cardEditor');
  const cardType = useCardBuilderStore((s) => s.cardType);
  const isPaid = useCardBuilderStore((s) => s.isPaid);

  // No type selected yet — show a gentle placeholder.
  if (!cardType) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <Step6CardLogicComingSoon cardType={null} />
      </div>
    );
  }

  // stamp_card → 集點卡 editor (single flat rule; shared StampCardLogic).
  if (cardType === 'stamp_card') {
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

  // multipass → 多通卡 editor (2026-09-19 PR-3, split out from shared
  // stamp_card branch). Uses multipass-card-specific intro copy +
  // tier-based structure (NOT the stamp card's flat single-rule shape).
  if (cardType === 'multipass') {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {/* Step 6 hero intro — multipass-card-specific copy */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">{t('step6.multipass.intro')}</p>
          <p className="text-xs text-muted-foreground">{t('step6.multipass.introHint')}</p>
        </div>
        <MultipassCardLogic showValidation={showValidation} />
      </div>
    );
  }

  // reward_card → points-driven logic editor (2026-09-09).
  if (cardType === 'reward_card') {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {/* Step 6 hero intro — reward-card-specific copy */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">{t('step6.reward.intro')}</p>
          <p className="text-xs text-muted-foreground">{t('step6.reward.introHint')}</p>
        </div>
        <RewardCardLogic showValidation={showValidation} />
      </div>
    );
  }

  // cashback_card → tier-based % cashback editor (2026-09-11).
  if (cardType === 'cashback_card') {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {/* Step 6 hero intro — cashback-card-specific copy */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">{t('step6.cashback.intro')}</p>
          <p className="text-xs text-muted-foreground">{t('step6.cashback.introHint')}</p>
        </div>
        <CashbackCardLogic showValidation={showValidation} />
      </div>
    );
  }

  // discount_card → tier-based % discount editor with optional card-level
  // expiry (2026-09-18). Mirrors cashback_card's tier structure but
  // semantically represents a DISCOUNT (reduces purchase price) rather
  // than CASHBACK (refund after purchase). Hero intro is rendered here
  // (same pattern as cashback_card / membership_card) so the user sees
  // card-type-specific copy above the editor.
  if (cardType === 'discount_card') {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {/* Step 6 hero intro — discount-card-specific copy */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">{t('step6.discount.intro')}</p>
          <p className="text-xs text-muted-foreground">{t('step6.discount.introHint')}</p>
        </div>
        <DiscountCardLogic showValidation={showValidation} />
      </div>
    );
  }

  // membership_card → 會員卡邏輯 editor (2026-09-13).
  // The sub-module itself branches on isPaid — free cards show the full
  // editor (single tier + hasExpiry toggle + expiry mode + rewards sub-rows),
  // paid cards show the tier editor. The dispatcher just delegates; no
  // isPaid check here.
  //
  // 2026-09-14: The hero intro copy also branches on isPaid (paid card
  // uses `intro`/`introHint`; free card uses `introFree`/`introHintFree`).
  // The previous single `intro`/`introHint` keys were ambiguous for free
  // cards (mentioned "paid rules" / "付費規則") — the dispatcher now picks
  // the right key set based on the same `isPaid` selector that the
  // sub-module uses.
  if (cardType === 'membership_card') {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {/* Step 6 hero intro — membership-card copy, branched by isPaid (2026-09-14) */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">
            {isPaid
              ? t('step6.membership.intro')
              : t('step6.membership.introFree')}
          </p>
          <p className="text-xs text-muted-foreground">
            {isPaid
              ? t('step6.membership.introHint')
              : t('step6.membership.introHintFree')}
          </p>
        </div>
        <MembershipCardLogic showValidation={showValidation} />
      </div>
    );
  }

  // coupon_card → 折價券邏輯 editor (2026-09-19). Mirrors the
  // discount_card branch shape — hero intro with coupon-card-specific copy
  // + delegates to CouponCardLogic sub-module which composes 4
  // sub-components (radio + conditional amount/percent + issue count).
  if (cardType === 'coupon_card') {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {/* Step 6 hero intro — coupon-card-specific copy */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">{t('step6.coupon.intro')}</p>
          <p className="text-xs text-muted-foreground">{t('step6.coupon.introHint')}</p>
        </div>
        <CouponCardLogic showValidation={showValidation} />
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
