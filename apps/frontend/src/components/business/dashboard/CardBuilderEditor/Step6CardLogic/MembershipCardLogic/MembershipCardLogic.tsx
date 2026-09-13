/**
 * MembershipCardLogic — Step 6 sub-module for membership_card (會員卡).
 *
 * Renders 2 top-level sub-components in order:
 *   1. <MembershipHasExpiryToggle /> — card-wide "無期限 / 有期限" switch.
 *   2. <MembershipTierList />        — list of up to MAX_MEMBERSHIP_TIERS=5
 *                                       tiers, each with name + (if hasExpiry)
 *                                       durationType + cost + 會員獎勵 sub-rows.
 *
 * Conditional rendering:
 *   - isPaid === false (免費會員卡) → shows MembershipCardLogicFreeState.
 *   - isPaid === true (付費會員卡)  → shows the tier editor below.
 *
 * The parent (`Step6CardLogic` dispatcher) is responsible for prev/next buttons
 * in CardBuilderEditorWorkspace. The free state component is rendered directly
 * here (not via a switch in the dispatcher) so the dispatcher stays ≤ 100 lines.
 *
 * Total membership tiers are bounded by MAX_MEMBERSHIP_TIERS=5 (Rule 019 § 4.1
 * mirror of `shared/constants/membership-card.ts`).
 *
 * Differs from CashbackCardLogic:
 *   - Card-wide `hasExpiry` toggle (no cashback equivalent).
 *   - Per-tier `durationType` (monthly / yearly / null) — cashback has no duration.
 *   - Per-tier "會員獎勵" sub-rows (label + value pairs) — cashback has no rewards.
 *   - cost = 0 IS allowed (= "free" membership tier).
 *   - Free state when `isPaid === false` (cashback is always paid).
 *
 * 2026-09-13 fix: removed `MembershipCardLogicPreview` — its live-preview block
 * was redundant with the card preview on the right panel and obscured the
 * tier editor. The pass-level preview is the source of truth for tier info.
 */

import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MembershipHasExpiryToggle } from './MembershipHasExpiryToggle';
import { MembershipTierList } from './MembershipTierList';
import { MembershipCardLogicFreeState } from './MembershipCardLogicFreeState';
import type { MembershipCardLogicProps } from './MembershipCardLogic.types';

export function MembershipCardLogic({ showValidation }: MembershipCardLogicProps) {
  const isPaid = useCardBuilderStore((s) => s.isPaid);

  // 免費會員卡 → 顯示空狀態，不渲染付費 tier 編輯器。
  if (!isPaid) {
    return <MembershipCardLogicFreeState />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Card-wide "無期限 / 有期限" toggle */}
      <MembershipHasExpiryToggle showValidation={showValidation} />

      {/* Tier list — up to 5 tiers */}
      <MembershipTierList showValidation={showValidation} />
    </div>
  );
}