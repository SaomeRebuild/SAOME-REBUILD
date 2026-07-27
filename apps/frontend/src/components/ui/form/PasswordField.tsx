/**
 * PasswordField — text input with show/hide toggle.
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
  function PasswordField({ label, error, helperText, required, disabled, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <Field label={label} error={error} description={helperText} required={required}>
        <div className="relative">
          <input
            ref={ref}
            type={visible ? 'text' : 'password'}
            disabled={disabled}
            className={[
              'w-full rounded border border-neutral-300 px-3 py-2 pr-10 text-base',
              'focus:border-neutral-900 focus:outline-none',
              'disabled:bg-neutral-100',
              error ? 'border-red-600' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-invalid={Boolean(error) || undefined}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center px-2 text-neutral-600"
            tabIndex={-1}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </Field>
    );
  },
);
