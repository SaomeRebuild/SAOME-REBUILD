/**
 * Field — form field wrapper. Provides id-matching label, description, and error.
 * Children should be the input element; the id is automatically supplied via cloneElement.
 *
 * Visual contract (per design-system/MASTER.md §1):
 *   - Label: var(--color-foreground), --font-family-body, text-sm font-medium
 *   - Required indicator: var(--color-destructive)
 *   - Description: var(--color-muted-foreground), text-xs
 *   - Error: var(--color-destructive), text-xs
 */

import { cloneElement, forwardRef, isValidElement, useId } from 'react';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  description?: ReactNode;
  error?: string;
  required?: boolean;
}

export const Field = forwardRef<HTMLDivElement, FieldProps>(function Field(
  { label, description, error, required, children, className, ...rest },
  ref,
) {
  const reactId = useId();
  const id = `field-${reactId}`;
  const describedBy = description ? `${id}-desc` : undefined;

  let childWithProps: ReactNode = children;
  if (children && isValidElement(children)) {
    childWithProps = cloneElement(children as ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>, {
      id: (children.props as { id?: string }).id ?? id,
      'aria-describedby': describedBy,
      'aria-invalid': Boolean(error) || undefined,
    });
  }

  return (
    <div ref={ref} className={['flex flex-col gap-1', className].filter(Boolean).join(' ')} {...rest}>
      {label ? (
        <label
          htmlFor={id}
          className="text-sm font-medium"
          style={{ color: 'var(--color-foreground)' }}
        >
          {label}
          {required ? (
            <span
              aria-hidden="true"
              className="ml-0.5"
              style={{ color: 'var(--color-destructive)' }}
            >
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {childWithProps}
      {description ? (
        <p
          id={`${id}-desc`}
          className="text-xs"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          {description}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="text-xs"
          style={{ color: 'var(--color-destructive)' }}
          data-testid="field-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
});
