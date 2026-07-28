/**
 * ComingSoonCard — simple "coming soon" placeholder for shell pages.
 *
 * Visual contract (per design-system/MASTER.md §1):
 *   - Card surface: var(--color-card) on var(--color-background) page
 *   - Card border:  var(--color-border)
 *   - Title:        var(--color-foreground)
 *   - Description:  var(--color-muted-foreground)
 *   - Icon:         var(--color-muted-foreground) (low-emphasis)
 *
 * NOTE: never use Tailwind's `bg-white` / `text-neutral-*` palette
 * here — those are bootstrap-era tokens that render as a low-contrast
 * light card on top of a dark page background. See
 * .cursor/rules/010-uiux-pro-max.mdc and .specify/memory/constitution.md.
 */

import type { CSSProperties, ReactNode } from 'react';
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
  const cardStyle: CSSProperties = {
    backgroundColor: 'var(--color-card)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-card-foreground)',
  };
  const titleStyle: CSSProperties = { color: 'var(--color-foreground)' };
  const descriptionStyle: CSSProperties = { color: 'var(--color-muted-foreground)' };
  const iconStyle: CSSProperties = { color: 'var(--color-muted-foreground)' };

  return (
    <section className="flex min-h-screen items-center justify-center px-4 py-8">
      <div
        className="max-w-md rounded-lg border p-8 text-center shadow-sm"
        style={cardStyle}
      >
        <Construction size={40} className="mx-auto" style={iconStyle} aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold" style={titleStyle}>
          {title}
        </h1>
        <p className="mt-2 text-sm" style={descriptionStyle}>
          {description}
        </p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </section>
  );
}
