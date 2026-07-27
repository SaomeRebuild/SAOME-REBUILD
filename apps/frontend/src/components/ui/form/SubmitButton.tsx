/**
 * SubmitButton — primary CTA button with loading & disabled states.
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
    return (
      <button
        ref={ref}
        type="submit"
        disabled={disabled || loading}
        className={[
          'inline-flex items-center justify-center gap-2 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white',
          'hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400',
          'min-h-[44px]',
          fullWidth ? 'w-full' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        <span>{loading && loadingText ? loadingText : children}</span>
      </button>
    );
  },
);
