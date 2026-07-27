/**
 * Field — form field wrapper. Provides id-matching label, description, and error.
 * Children should be the input element; the id is automatically supplied via cloneElement.
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
        <label htmlFor={id} className="text-sm font-medium text-neutral-900">
          {label}
          {required ? <span aria-hidden="true" className="ml-0.5 text-red-600">*</span> : null}
        </label>
      ) : null}
      {childWithProps}
      {description ? (
        <p id={`${id}-desc`} className="text-xs text-neutral-500">
          {description}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-red-600" data-testid="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
});
