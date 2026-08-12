import { Award } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { memberTierSchema, type MemberTier } from '@saome/shared/schemas/member';

export interface MemberBadgeProps {
  tier: MemberTier;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const tierStyles: Record<MemberTier, { text: string; bg: string }> = {
  bronze: {
    text: 'text-amber-700',
    bg: 'bg-amber-50',
  },
  silver: {
    text: 'text-slate-500',
    bg: 'bg-slate-50',
  },
  gold: {
    text: 'text-yellow-600',
    bg: 'bg-yellow-50',
  },
};

const sizeStyles = {
  sm: 'text-sm px-2 py-1 min-h-[44px]',  // mobile 觸控目標 ≥ 44pt
  md: 'text-base px-3 py-2 min-h-[44px]', // mobile 觸控目標 ≥ 44pt
  lg: 'text-lg px-4 py-3 min-h-12',       // desktop ≥ 48px
};

export const MemberBadge = ({
  tier,
  size = 'md',
  className = '',
}: MemberBadgeProps) => {
  const { t } = useTranslation('member');
  // Validate tier
  const validatedTier = memberTierSchema.parse(tier);
  const displayName = t(`member.tier.${validatedTier}`);
  const ariaLabel = t('member.tier.ariaLabel', { tier: displayName });
  const styles = tierStyles[validatedTier];

  return (
    <span
      data-testid="member-badge"
      aria-label={ariaLabel}
      className={`
        inline-flex items-center gap-2
        rounded-full font-medium
        ${styles.text} ${styles.bg}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      <Award className="w-4 h-4" aria-hidden="true" />
      <span>{displayName}</span>
    </span>
  );
};
