/**
 * FieldError — standalone inline error message for forms.
 */

import type { HTMLAttributes } from 'react';

export interface FieldErrorProps extends HTMLAttributes<HTMLParagraphElement> {
  message?: string;
}

export function FieldError({ message, className, ...rest }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p role="alert" className={['text-xs text-red-600', className].filter(Boolean).join(' ')} {...rest}>
      {message}
    </p>
  );
}
