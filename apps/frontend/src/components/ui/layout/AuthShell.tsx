/**
 * AuthShell — wraps auth pages in a centered card layout.
 *
 * Visual contract (per design-system/MASTER.md §1 + §9):
 *   - Outer background: var(--color-background)  (#0F0F23 dark)
 *   - Card surface:     var(--color-card)         (#1B1B30)
 *   - Card border:      var(--color-border)       (#2D2D4A)
 *   - Card radius:      rounded-xl (--radius-lg = 20px)
 *   - Heading color:    var(--color-foreground)   (#F8FAFC)
 *   - Heading font:     var(--font-family-heading) (Fredoka)
 *   - Subtitle color:   var(--color-muted-foreground)
 *   - Card padding:     p-6 (compact) / p-8 (standard)
 *   - Section padding:  py-8 sm:py-12 md:py-16
 *
 * RWD: mobile-first; max-w-md keeps the form readable on tablet/desktop.
 */

import type { ReactNode } from 'react';

export interface AuthShellProps {
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
  langSwitcher?: ReactNode;
}

export function AuthShell({ title, subtitle, footer, children, langSwitcher }: AuthShellProps) {
  return (
    <main
      className="min-h-screen px-4 pt-24 pb-8 sm:pt-12 sm:pb-12 md:pt-16 md:pb-16"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div className="mx-auto max-w-md">
        {langSwitcher ? <div className="mb-4 flex justify-end">{langSwitcher}</div> : null}
        <div
          className="rounded-xl border p-6 shadow-soft sm:p-8"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-card)',
          }}
        >
          {title ? (
            <h1
              className="text-2xl font-semibold sm:text-3xl"
              style={{
                color: 'var(--color-foreground)',
                fontFamily: 'var(--font-family-heading)',
              }}
            >
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {subtitle}
            </p>
          ) : null}
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
