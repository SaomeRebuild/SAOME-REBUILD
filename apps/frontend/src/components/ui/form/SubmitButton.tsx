/**
 * SubmitButton — primary CTA button with loading & disabled states.
 *
 * Visual contract (per design-system/MASTER.md §1 + §4):
 *   - Background:      var(--color-primary) (#F97316 orange)
 *   - Text:            var(--color-on-primary) (#0F172A deep navy)
 *   - Hover:           var(--color-accent) (#FBBF24 amber) at 90% opacity
 *   - Disabled:        var(--color-muted) (#27273B)
 *   - Disabled text:   var(--color-muted-foreground)
 *   - Min height:      44px (touch target per .cursor/rules/013-rwd.mdc)
 */

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
}

export const SubmitButton = forwardRef<HTMLButtonElement, SubmitButtonProps>(
  function SubmitButton({ loading, loadingText, fullWidth, children, disabled, className, ...rest }, ref) {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        type="submit"
        disabled={isDisabled}
        className={[
          'inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium',
          'transition-colors',
          'min-h-[44px]',
          fullWidth ? 'w-full' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          backgroundColor: isDisabled ? 'var(--color-muted)' : 'var(--color-primary)',
          color: isDisabled
            ? 'var(--color-muted-foreground)'
            : 'var(--color-on-primary)',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isDisabled) e.currentTarget.style.backgroundColor = 'var(--color-accent)';
        }}
        onMouseLeave={(e) => {
          if (!isDisabled) e.currentTarget.style.backgroundColor = 'var(--color-primary)';
        }}
        {...rest}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        <span>{loading && loadingText ? loadingText : children}</span>
      </button>
    );
  },
);