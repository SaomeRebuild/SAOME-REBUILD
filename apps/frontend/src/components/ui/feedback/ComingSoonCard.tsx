/**
 * ComingSoonCard — simple "coming soon" placeholder for shell pages.
 */

import type { ReactNode } from 'react';
import { Construction } from 'lucide-react';

export interface ComingSoonCardProps {
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function ComingSoonCard({
  title = 'Coming soon',
  description = 'This feature is under construction. Stay tuned.',
  action,
}: ComingSoonCardProps) {
  return (
    <section className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <Construction size={40} className="mx-auto text-neutral-400" />
        <h1 className="mt-4 text-2xl font-semibold text-neutral-900">{title}</h1>
        <p className="mt-2 text-sm text-neutral-600">{description}</p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </section>
  );
}
