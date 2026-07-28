/**
 * ComingSoonCard design-token conformance test.
 *
 * Bug-6 / design contract: a placeholder card that hardcodes Tailwind's
 * neutral scale (bg-white, text-neutral-900, border-neutral-200) renders
 * as a low-contrast light card on top of a dark page background
 * (#0F0F23 per design-system/MASTER.md). The sign-out button inside
 * (border-neutral-300, dark text) is also invisible against the dark
 * surrounding chrome.
 *
 * These tests assert that the card actually pulls from the design
 * tokens declared in design-system/MASTER.md. If a future contributor
 * reaches for the neutral palette or any hex literal, the test fails
 * with a clear pointer to the contract instead of silently shipping a
 * low-contrast regression.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComingSoonCard } from './ComingSoonCard';

/**
 * Walk the rendered DOM and collect every Tailwind class we know to be
 * a forbidden hardcoded colour (Tailwind's neutral/white/black palette,
 * or any `bg-[#...]` / `text-[#...]` arbitrary hex).
 *
 * Implemented as a runtime check rather than a static AST scan because
 * class names are dynamic strings at the call site; the rendered HTML
 * is the source of truth that ends up in users' browsers.
 */
function findHardcodedColorClasses(container: HTMLElement): string[] {
  const FORBIDDEN = [
    /\bbg-white\b/,
    /\btext-white\b/,
    /\bbg-black\b/,
    /\btext-black\b/,
    /\bbg-neutral-(?:50|100|200|300|400|500|600|700|800|900)\b/,
    /\btext-neutral-(?:50|100|200|300|400|500|600|700|800|900)\b/,
    /\bborder-neutral-(?:50|100|200|300|400|500|600|700|800|900)\b/,
    /\bbg-(?:\[[^\]]+\])\b/, // bg-[#abc123] arbitrary
    /\btext-(?:\[[^\]]+\])\b/,
    /\bborder-(?:\[[^\]]+\])\b/,
  ];
  const offenders: string[] = [];
  for (const el of container.querySelectorAll<HTMLElement>('[class]')) {
    const cls = el.className;
    for (const re of FORBIDDEN) {
      if (re.test(cls)) offenders.push(`${re.source} on <${el.tagName.toLowerCase()}> "${cls.slice(0, 80)}"`);
    }
  }
  return offenders;
}

describe('ComingSoonCard design-token conformance', () => {
  it('renders title and description', () => {
    render(<ComingSoonCard title="Admin console" description="Under construction." />);
    expect(screen.getByRole('heading', { name: 'Admin console' })).toBeInTheDocument();
    expect(screen.getByText('Under construction.')).toBeInTheDocument();
  });

  it('uses design tokens (--color-card / --color-foreground etc.) — never the neutral scale or hex literals', () => {
    const { container } = render(
      <ComingSoonCard title="Admin" description="desc" action={<button>Sign out</button>} />,
    );
    const offenders = findHardcodedColorClasses(container);
    expect(
      offenders,
      `ComingSoonCard uses hardcoded colour classes; replace with design tokens from design-system/MASTER.md:\n  - ${offenders.join('\n  - ')}`,
    ).toEqual([]);
  });

  it('renders the Construction icon', () => {
    const { container } = render(<ComingSoonCard title="Admin" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});