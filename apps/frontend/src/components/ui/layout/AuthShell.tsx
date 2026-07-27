/**
 * AuthShell — wraps auth pages in a centered card layout.
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
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:py-12 md:py-16">
      <div className="mx-auto max-w-md">
        {langSwitcher ? <div className="mb-4 flex justify-end">{langSwitcher}</div> : null}
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          {title ? (
            <h1 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">{title}</h1>
          ) : null}
          {subtitle ? <p className="mt-1 text-sm text-neutral-600">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
