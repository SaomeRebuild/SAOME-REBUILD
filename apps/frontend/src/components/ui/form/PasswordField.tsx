/**
 * PasswordField — text input with show/hide toggle.
 *
 * Visual contract (per design-system/MASTER.md §1):
 *   - Input bg:        var(--color-muted) (#27273B)
 *   - Input border:    var(--color-border) (#2D2D4A)
 *   - Input text:      var(--color-foreground) (#F8FAFC)
 *   - Focus ring:      var(--color-ring) (#F97316)
 *   - Error border:    var(--color-destructive) (#EF4444)
 *   - Radius:          --radius-md (12px)
 */

import { forwardRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Field } from './Field';

export interface PasswordFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ label, error, helperText, required, disabled, style, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <Field label={label} error={error} description={helperText} required={required}>
        <div className="relative">
          <input
            ref={ref}
            type={visible ? 'text' : 'password'}
            disabled={disabled}
            className="min-h-[44px] w-full rounded px-3 py-2 pr-10 text-base outline-none transition-colors focus:ring-2"
            style={{
              border: `1px solid ${error ? 'var(--color-destructive)' : 'var(--color-border)'}`,
              backgroundColor: 'var(--color-muted)',
              color: 'var(--color-foreground)',
              ...(error ? {} : { boxShadow: 'none' }),
              ...style,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-ring)';
              e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-ring)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = error
                ? 'var(--color-destructive)'
                : 'var(--color-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            aria-invalid={Boolean(error) || undefined}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center px-2"
            style={{ color: 'var(--color-muted-foreground)' }}
            tabIndex={-1}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </Field>
    );
  },
);
