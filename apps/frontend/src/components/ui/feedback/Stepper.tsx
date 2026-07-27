/**
 * Stepper — progress indicator for multi-step forms.
 */

import { Check } from 'lucide-react';

export interface StepperProps {
  current: number;
  steps: Array<{ label: string }>;
}

export function Stepper({ current, steps }: StepperProps) {
  return (
    <ol className="flex items-center gap-2" aria-label="progress">
      {steps.map((s, idx) => {
        const isComplete = idx < current;
        const isCurrent = idx === current;
        const status = isComplete ? 'complete' : isCurrent ? 'current' : 'pending';
        return (
          <li key={s.label} className="flex flex-1 items-center gap-2" aria-current={isCurrent ? 'step' : undefined}>
            <span
              data-status={status}
              className={[
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                isComplete ? 'border-neutral-900 bg-neutral-900 text-white' : '',
                isCurrent ? 'border-neutral-900 text-neutral-900' : '',
                !isComplete && !isCurrent ? 'border-neutral-300 text-neutral-400' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {isComplete ? <Check size={14} /> : idx + 1}
            </span>
            <span className={['text-sm', isCurrent ? 'font-medium text-neutral-900' : 'text-neutral-500'].join(' ')}>
              {s.label}
            </span>
            {idx < steps.length - 1 ? <span className="flex-1 border-t border-neutral-200" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}
