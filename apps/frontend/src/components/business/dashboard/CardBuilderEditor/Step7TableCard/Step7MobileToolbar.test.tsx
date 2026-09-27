/**
 * Step7MobileToolbar — conformance tests (Round 2 fix, 2026-09-27).
 *
 * Critical invariant under test:
 *   - Toolbar uses translucent backdrop (bg-card/60 + backdrop-blur-md)
 *     so the canvas underneath shows through, matching the visual
 *     convention of other mobile preview surfaces in CardBuilderEditor
 *     (MobilePreviewPanel uses bg-black/50 backdrop-blur-sm).
 *   - All 5 tool buttons render with the correct active-state styling
 *     when tapped (orange-outline visual language shared with desktop).
 *
 * Run: `npm test -- Step7MobileToolbar.test`
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Step7MobileToolbar } from './Step7MobileToolbar';

// Setup i18n once per test file
import '@/test/i18n';

describe('Step7MobileToolbar — translucent backdrop (Fix 3)', () => {
  it('toolbar uses bg-card/60 backdrop-blur-md backdrop-saturate-150', () => {
    render(
      <Step7MobileToolbar activeTool="text" onToolChange={vi.fn()} />,
    );
    const nav = screen.getByTestId('step7-mobile-toolbar');
    expect(nav.className).toContain('bg-card/60');
    expect(nav.className).toContain('backdrop-blur-md');
    expect(nav.className).toContain('backdrop-saturate-150');
  });

  it('does NOT use opaque bg-card (regression for Round 1)', () => {
    render(
      <Step7MobileToolbar activeTool="text" onToolChange={vi.fn()} />,
    );
    const nav = screen.getByTestId('step7-mobile-toolbar');
    // `bg-card/60` should be present, but the bare `bg-card ` (with trailing
    // space) should NOT be a separate token — Tailwind's class merging
    // would resolve to the more specific /60 variant. We assert the class
    // list does NOT contain a bare `bg-card` token that would override it.
    const classes = nav.className.split(/\s+/);
    expect(classes).not.toContain('bg-card');
    // (We rely on Tailwind's CSS source order / specificity — the /60
    //  variant is defined later in the generated CSS and wins.)
  });

  it('renders all 5 tool buttons with the correct active state', async () => {
    const user = userEvent.setup();
    const onToolChange = vi.fn();
    render(<Step7MobileToolbar activeTool="shape" onToolChange={onToolChange} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);

    // The 'shape' button is the active one — its aria-pressed should be true
    const shapeButton = buttons.find((b) => b.getAttribute('data-tool') === 'shape');
    expect(shapeButton).toBeDefined();
    expect(shapeButton!.getAttribute('aria-pressed')).toBe('true');

    // Others are inactive
    const textButton = buttons.find((b) => b.getAttribute('data-tool') === 'text');
    expect(textButton!.getAttribute('aria-pressed')).toBe('false');

    // Click the text button → onToolChange fires
    await user.click(textButton!);
    expect(onToolChange).toHaveBeenCalledWith('text');
  });

  it('active button has border-primary class (orange outline)', () => {
    render(
      <Step7MobileToolbar activeTool="image" onToolChange={vi.fn()} />,
    );
    const buttons = screen.getAllByRole('button');
    const activeButton = buttons.find((b) => b.getAttribute('data-active') === 'true');
    expect(activeButton).toBeDefined();
    expect(activeButton!.className).toContain('border-primary');
  });
});