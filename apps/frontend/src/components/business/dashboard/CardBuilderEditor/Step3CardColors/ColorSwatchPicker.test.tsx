/**
 * ColorSwatchPicker — Vitest + RTL tests
 *
 * Covers: popover toggle, swatch selection, click-outside, ESC, hex input,
 * HSL drag commit-on-close, createPortal positioning, Apply i18n key.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { COLOR_PRESETS } from '@saome/shared/constants/color-presets';

// Mock react-colorful so we can drive its onChange without simulating pointer events.
// The real HexColorPicker uses pointermove / touchmove which jsdom does not dispatch
// meaningfully; this mock exposes a controlled input that fires the same onChange
// callback the real component does.
vi.mock('react-colorful', () => ({
  HexColorPicker: vi.fn(({ color, onChange }) => (
    <div data-testid="react-colorful-mock">
      <input
        data-testid="hsl-input"
        value={color}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )),
}));

// Mock i18n — vi.fn(key => key) makes t() return the key as text
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({ t: vi.fn((key: string) => key) })),
}));

/**
 * Helper: stub window.matchMedia so a specific query matches.
 * The global setup.ts mock only matches `(prefers-color-scheme: dark)`.
 * Call with `matches: true` to simulate mobile viewport, `false` for desktop.
 */
function stubMatchMedia(queryToMatch: string, matches: boolean) {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const isMatch = query === queryToMatch || query === '(prefers-color-scheme: dark)';
    return {
      matches: query === queryToMatch ? matches : isMatch && matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
  return () => {
    window.matchMedia = original;
  };
}

beforeEach(() => {
  cleanup();
});

describe('ColorSwatchPicker — legacy behavior (preserved)', () => {
  it('renders trigger button with the current value', () => {
    render(
      <ColorSwatchPicker
        label="背景色"
        value="#FF0000"
        onChange={vi.fn()}
        presets={COLOR_PRESETS}
      />,
    );
    expect(screen.getByText('背景色')).toBeInTheDocument();
    expect(screen.getByText('FF0000')).toBeInTheDocument();
    const swatch = document.querySelector('[style*="background-color: rgb(255, 0, 0)"]');
    expect(swatch).toBeInTheDocument();
  });

  it('opens popover on trigger click and shows all 20 presets', () => {
    render(
      <ColorSwatchPicker
        label="背景色"
        value="#1A1A1A"
        onChange={vi.fn()}
        presets={COLOR_PRESETS}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /背景色/ }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const swatches = screen.getAllByRole('option');
    expect(swatches).toHaveLength(20);
  });

  it('marks the active swatch with aria-selected=true', () => {
    render(
      <ColorSwatchPicker
        label="背景色"
        value="#F97316"
        onChange={vi.fn()}
        presets={COLOR_PRESETS}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /背景色/ }));

    const activeSwatch = screen.getByRole('option', { name: /#F97316/i })
      || screen.getAllByRole('option').find((el) => el.getAttribute('aria-selected') === 'true');
    expect(activeSwatch).toBeTruthy();
    expect(activeSwatch).toHaveAttribute('aria-selected', 'true');
  });

  it('closes popover and fires onChange when a swatch is clicked', () => {
    const onChange = vi.fn();
    render(
      <ColorSwatchPicker
        label="背景色"
        value="#1A1A1A"
        onChange={onChange}
        presets={COLOR_PRESETS}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
    fireEvent.click(screen.getByRole('option', { selected: false, name: /#F97316/ }));

    expect(onChange).toHaveBeenCalledWith('#F97316');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes popover when clicking outside the container (no draft change)', () => {
    render(
      <div>
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />
        <button data-testid="outside">Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes popover when Escape is pressed', () => {
    render(
      <ColorSwatchPicker
        label="背景色"
        value="#1A1A1A"
        onChange={vi.fn()}
        presets={COLOR_PRESETS}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('applies hex input — accepts valid 6-char hex, prepends #, uppercases', () => {
    const onChange = vi.fn();
    render(
      <ColorSwatchPicker
        label="背景色"
        value="#1A1A1A"
        onChange={onChange}
        presets={COLOR_PRESETS}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /背景色/ }));

    const input = screen.getByPlaceholderText('hexPlaceholder') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ff0000' } });
    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    expect(onChange).toHaveBeenCalledWith('#FF0000');
  });

  it('does NOT call onChange when hex input is invalid', () => {
    const onChange = vi.fn();
    render(
      <ColorSwatchPicker
        label="背景色"
        value="#1A1A1A"
        onChange={onChange}
        presets={COLOR_PRESETS}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /背景色/ }));

    const input = screen.getByPlaceholderText('hexPlaceholder') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'xyz' } });
    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('strips leading # from input before applying', () => {
    const onChange = vi.fn();
    render(
      <ColorSwatchPicker
        label="背景色"
        value="#1A1A1A"
        onChange={onChange}
        presets={COLOR_PRESETS}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /背景色/ }));

    const input = screen.getByPlaceholderText('hexPlaceholder') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '#22C55E' } });
    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    expect(onChange).toHaveBeenCalledWith('#22C55E');
  });
});

describe('ColorSwatchPicker — HSL drag picker (new)', () => {
  it('renders HexColorPicker inside popover', async () => {
    render(
      <ColorSwatchPicker
        label="背景色"
        value="#1A1A1A"
        onChange={vi.fn()}
        presets={COLOR_PRESETS}
      />,
    );
    // Popover not rendered initially
    expect(screen.queryByTestId('hsl-picker')).toBeNull();

    // Open popover — useLayoutEffect computes position before first paint,
    // but waitFor ensures the portal DOM is fully mounted.
    fireEvent.click(screen.getByRole('button', { name: /背景色/ }));

    // Wait for the dialog role to appear (confirms useLayoutEffect ran + portal mounted)
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByTestId('hsl-picker')).toBeInTheDocument();
  });

  it('HSL drag updates trigger preview without immediate parent commit (draft state)', async () => {
    const onChange = vi.fn();
    render(
      <ColorSwatchPicker
        label="背景色"
        value="#1A1A1A"
        onChange={onChange}
        presets={COLOR_PRESETS}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /背景色/ }));

    // Wait for portal to mount before interacting with hsl-input
    await waitFor(() => {
      expect(screen.getByTestId('hsl-picker')).toBeInTheDocument();
    });

    // Simulate HSL drag → onChange fires on the picker
    fireEvent.change(screen.getByTestId('hsl-input'), {
      target: { value: '#ABC123' },
    });

    // Trigger now reflects draft (ABC123), but parent.onChange was NOT called
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clicking outside commits draft to parent', async () => {
    const onChange = vi.fn();
    render(
      <div>
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={onChange}
          presets={COLOR_PRESETS}
        />
        <button data-testid="outside">Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /背景色/ }));

    // Wait for portal to mount
    await waitFor(() => {
      expect(screen.getByTestId('hsl-picker')).toBeInTheDocument();
    });

    // Drag HSL to a new color
    fireEvent.change(screen.getByTestId('hsl-input'), {
      target: { value: '#ABC123' },
    });
    expect(onChange).not.toHaveBeenCalled();

    // Click outside → commit draft
    fireEvent.mouseDown(screen.getByTestId('outside'));

    expect(onChange).toHaveBeenCalledWith('#ABC123');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape commits draft to parent', async () => {
    const onChange = vi.fn();
    render(
      <ColorSwatchPicker
        label="背景色"
        value="#1A1A1A"
        onChange={onChange}
        presets={COLOR_PRESETS}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /背景色/ }));

    await waitFor(() => {
      expect(screen.getByTestId('hsl-picker')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('hsl-input'), {
      target: { value: '#ABC123' },
    });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onChange).toHaveBeenCalledWith('#ABC123');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Apply button uses t(\'apply\') key (not openPicker)', async () => {
    render(
      <ColorSwatchPicker
        label="背景色"
        value="#1A1A1A"
        onChange={vi.fn()}
        presets={COLOR_PRESETS}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /背景色/ }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Submit button text comes from t('apply') which the mock returns as 'apply'
    const applyBtn = screen.getByRole('button', { name: 'apply' });
    expect(applyBtn).toBeInTheDocument();

    // Trigger button uses t('openPicker') in aria-label — confirm it is NOT 'apply'
    const triggerBtn = screen.getByRole('button', { name: /背景色/ });
    expect(triggerBtn.getAttribute('aria-label')).not.toMatch(/apply/);
  });

  it('popover renders to document.body via createPortal (no longer clipped by parent)', async () => {
    render(
      <div style={{ overflow: 'hidden', height: '100px' }}>
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /背景色/ }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    // Portal puts the dialog into document.body, NOT inside the overflow:hidden parent
    expect(document.body.contains(dialog)).toBe(true);
    // Dialog should NOT be inside the clipped parent container
    const clippedParent = document.querySelector('[style*="overflow: hidden"]');
    expect(clippedParent?.contains(dialog)).toBe(false);
  });
});

describe('ColorSwatchPicker — responsive bottom sheet (mobile)', () => {
  it('renders a full-width bottom sheet instead of a trigger-anchored popover when viewport < 640px', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', true);
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));

      const dialog = await waitFor(() => screen.getByRole('dialog'));
      // Dialog has full width on mobile (anchored to viewport bottom)
      expect(dialog.className).toMatch(/\bw-full\b/);
      expect(dialog.className).toMatch(/rounded-t-2xl/);
      // No fixed top/left positioning (would clip on small viewports)
      expect(dialog.getAttribute('style') || '').not.toMatch(/top:\s*\d/);
    } finally {
      restore();
    }
  });

  it('backdrop click closes the mobile sheet and commits draft to parent', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', true);
    const onChange = vi.fn();
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={onChange}
          presets={COLOR_PRESETS}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      // Drag HSL to a new color
      fireEvent.change(screen.getByTestId('hsl-input'), {
        target: { value: '#ABC123' },
      });
      expect(onChange).not.toHaveBeenCalled();

      // Tap the backdrop (useClickOutside treats it as "outside" — commits + closes)
      const backdrop = document.querySelector('.bg-black\\/50') as HTMLElement;
      expect(backdrop).toBeTruthy();
      fireEvent.mouseDown(backdrop);

      expect(onChange).toHaveBeenCalledWith('#ABC123');
      expect(screen.queryByRole('dialog')).toBeNull();
    } finally {
      restore();
    }
  });

  it('toggle handle (X icon) closes the mobile sheet and commits draft to parent', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', true);
    const onChange = vi.fn();
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={onChange}
          presets={COLOR_PRESETS}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      // Drag HSL to a new color
      fireEvent.change(screen.getByTestId('hsl-input'), {
        target: { value: '#ABC123' },
      });
      expect(onChange).not.toHaveBeenCalled();

      // Tap the close handle (X icon at top of sheet) → commits draft + closes sheet
      const closeBtn = screen.getByRole('button', { name: 'closeSheet' });
      fireEvent.mouseDown(closeBtn);
      fireEvent.click(closeBtn);

      expect(onChange).toHaveBeenCalledWith('#ABC123');
      expect(screen.queryByRole('dialog')).toBeNull();
    } finally {
      restore();
    }
  });

  it('scroll-does-not-close pass remains in effect after replacing collapse toggle with X close button', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', true);
    const onChange = vi.fn();
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={onChange}
          presets={COLOR_PRESETS}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      // Simulate scroll event on window
      fireEvent.scroll(window);
      await new Promise((r) => setTimeout(r, 50));

      // Sheet should still be open (scroll on mobile does not dismiss)
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // No commit from scroll
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('mobile sheet content area scrolls (overflow-y-auto) so all sections are reachable on short viewports', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', true);
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      // The scroll container is the immediate flex-1 child of the sheet (role=dialog).
      // It must allow vertical scrolling so the hex input is reachable on short viewports.
      const dialog = screen.getByRole('dialog');
      const scrollContainer = dialog.querySelector('.overflow-y-auto') as HTMLElement | null;
      expect(scrollContainer).toBeTruthy();
      // min-h-0 on the flex child is what makes overflow-y-auto actually work —
      // without it, the flex item won't shrink below its content size and the
      // scrollbar never appears.
      expect(scrollContainer?.className).toMatch(/min-h-0/);
      expect(scrollContainer?.className).toMatch(/overflow-y-auto/);

      // All picker sections must be present in the rendered DOM (even if
      // some are below the scroll fold).
      expect(screen.getByTestId('hsl-picker')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('hexPlaceholder')).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('close handle replaces toggle handle (no collapse/expand state)', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', true);
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      // Collapse/expand keys are gone; closeSheet is present
      expect(screen.queryByRole('button', { name: 'collapseSheet' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'expandSheet' })).toBeNull();
      expect(screen.getByRole('button', { name: 'closeSheet' })).toBeInTheDocument();

      // Clicking close handle does NOT toggle aria-expanded (no collapse state)
      const closeBtn = screen.getByRole('button', { name: 'closeSheet' });
      fireEvent.mouseDown(closeBtn);
      // Sheet closes entirely after click resolves through React state
      fireEvent.click(closeBtn);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    } finally {
      restore();
    }
  });

  it('keeps desktop popover layout (trigger-anchored, fixed top/left) when viewport ≥ 640px', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', false);
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      const dialog = await waitFor(() => screen.getByRole('dialog'));

      // Desktop popover has explicit fixed top/left coordinates from usePopoverPosition
      const style = dialog.getAttribute('style') || '';
      expect(style).toMatch(/top:\s*\d+/);
      expect(style).toMatch(/left:\s*\d+/);
      // Fixed width (POPOVER_WIDTH = 280), not full-width
      expect(style).toMatch(/width:\s*\d+/);
      // NOT rounded-t-2xl (that's mobile-only)
      expect(dialog.className).not.toMatch(/rounded-t-2xl/);
    } finally {
      restore();
    }
  });
});

describe('ColorSwatchPicker — desktop popover sizing (Option A: follow content height)', () => {
  it('outer popover has no overflow-hidden — shadow renders unclipped, content not clipped by container', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', false);
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      const dialog = await waitFor(() => screen.getByRole('dialog'));

      // Option A: popover sizes to content. No overflow-hidden on outer
      // (would clip the shadow and any sub-pixel rounding artifacts).
      expect(dialog.className).not.toMatch(/\boverflow-hidden\b/);
      // No overflow-y-auto on outer either — the previous bug had `flex-1
      // overflow-y-auto` on the INNER container, which still produced a
      // scrollbar on every desktop viewport because flex-1 claimed all
      // available main-axis space up to the outer's maxHeight.
      expect(dialog.className).not.toMatch(/\boverflow-y-auto\b/);
    } finally {
      restore();
    }
  });

  it('inner content area is NOT a scroll container — no flex-1 / no min-h-0 / no overflow-y-auto (Option A)', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', false);
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      const dialog = await waitFor(() => screen.getByRole('dialog'));

      // Option A: popover sizes to content. The inner container is a plain
      // flex column that sizes to its children's natural height — no scroll,
      // no min-h-0, no flex-1, no overflow.
      //
      // Why this matters: the previous design used `flex-1 overflow-y-auto`
      // on the inner container with a fixed maxHeight on the outer. Because
      // `flex-1` claims ALL available main-axis space (up to outer's maxHeight),
      // the inner was always as tall as `calc(100vh - 32px - padding)` even
      // when content was only ~450px. That left ~400px of empty flex space
      // overflowing into a vertical scrollbar on the inner. Users saw a
      // scrollable popover that "didn't follow content height".
      const inner = dialog.querySelector(
        'div.flex.min-w-0.flex-col.gap-3',
      ) as HTMLElement | null;
      expect(inner).toBeTruthy();
      expect(inner?.className).not.toMatch(/\bflex-1\b/);
      expect(inner?.className).not.toMatch(/\bmin-h-0\b/);
      expect(inner?.className).not.toMatch(/\boverflow-y-auto\b/);
      expect(inner?.className).not.toMatch(/\boverflow-x-hidden\b/);

      // All HSL / palette / hex sections must still live inside the inner
      // container so they render in the right order.
      expect(inner?.contains(screen.getByTestId('hsl-picker'))).toBe(true);
      expect(inner?.contains(screen.getByPlaceholderText('hexPlaceholder'))).toBe(true);
    } finally {
      restore();
    }
  });

  it('outer popover has NO maxHeight — sizes to natural content height (Option A)', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', false);
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      const dialog = await waitFor(() => screen.getByRole('dialog'));

      const style = dialog.getAttribute('style') || '';
      // Option A: no maxHeight on outer. The popover grows to fit the
      // content (HSL picker + 20-swatch palette + hex input ≈ 460px).
      // The previous `max-height: calc(100vh - 32px)` + `flex-1 overflow-y-auto`
      // inner produced a vertical scrollbar on every desktop viewport because
      // flex-1 claimed all available main-axis space.
      expect(style).not.toMatch(/max-height/);
      expect(style).not.toMatch(/maxHeight/);
    } finally {
      restore();
    }
  });

  it('desktop popover contents are all reachable without scroll — HSL + palette + hex all rendered', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', false);
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      const dialog = await waitFor(() => screen.getByRole('dialog'));

      // Regression guard for the original bug report: "color picker popover
      // 不跟內容高度走，可以上下滑動". After Option A all three sections
      // are present in the DOM AND the popover has no scroll capability,
      // so the user sees them in full without any vertical scrolling.
      expect(screen.getByTestId('hsl-picker')).toBeInTheDocument();
      // 20 presets rendered
      expect(screen.getAllByRole('option')).toHaveLength(20);
      expect(screen.getByPlaceholderText('hexPlaceholder')).toBeInTheDocument();

      // No element with overflow-y-auto inside the popover — that's the
      // direct repro of "popover can scroll vertically".
      const scrollables = dialog.querySelectorAll('.overflow-y-auto');
      expect(scrollables).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('desktop popover keeps trigger-anchored fixed positioning (regression guard)', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', false);
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      const dialog = await waitFor(() => screen.getByRole('dialog'));

      // Regression guard: positioning math (top/left from trigger rect) and
      // POPOVER_WIDTH must be preserved across the Option A layout refactor.
      const style = dialog.getAttribute('style') || '';
      expect(style).toMatch(/top:\s*\d+/);
      expect(style).toMatch(/left:\s*\d+/);
      expect(style).toMatch(/width:\s*\d+/);
      // NOT mobile rounded-t-2xl
      expect(dialog.className).not.toMatch(/rounded-t-2xl/);
    } finally {
      restore();
    }
  });

  it('inner flex sections have min-w-0 so implicit min-width: auto cannot push them past the popover width (no X scrollbar leak)', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', false);
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      await waitFor(() => screen.getByRole('dialog'));

      // HSL section + palette section + hex form must all carry min-w-0.
      // Without it, a flex child's default `min-width: auto` equals its
      // content's intrinsic min-width — which can exceed the popover's
      // 256px inner width when the HSL picker (240px) or the hex row
      // (# + input + Apply button) is taken into account. Result: an
      // outer-level horizontal scrollbar appears because the inner scroll
      // container can't be smaller than its children.
      const hslSection = screen.getByTestId('hsl-picker').parentElement;
      expect(hslSection?.className).toMatch(/\bmin-w-0\b/);

      const hexForm = screen.getByPlaceholderText('hexPlaceholder').closest('form');
      expect(hexForm?.className).toMatch(/\bmin-w-0\b/);

      // The inner row containing # / input / Apply button is a flex container
      // — its children need min-w-0 too so the input can shrink and let the
      // Apply button stay on one line.
      const hexRow = hexForm?.querySelector('.flex.items-center');
      expect(hexRow?.className).toMatch(/\bmin-w-0\b/);
    } finally {
      restore();
    }
  });
});

describe('ColorSwatchPicker — desktop popover placement (tricky mid-band fix 2026-09-04)', () => {
  /**
   * Regression guard for the "Color Picker 開啟後 popover 被 viewport 底部截斷" bug
   * that surfaced after Step3CardFields was added. The previous placement
   * rule was:
   *
   *   placeBelow = spaceBelow >= ESTIMATE+16 || spaceBelow > spaceAbove
   *
   * which let the popover open BELOW the trigger even when spaceBelow was
   * strictly less than the popover height (e.g. 440 < 476), as long as
   * spaceBelow > spaceAbove. The new rule:
   *
   *   placeBelow = spaceBelow >= ESTIMATE+16
   *
   * — only place below if it ACTUALLY fits, otherwise flip above (and clamp
   * top so the popover never extends past the viewport edge).
   *
   * jsdom has no layout, so we mock `getBoundingClientRect` on the trigger
   * container to simulate three scroll/viewport scenarios and verify the
   * placement math picks the correct side in each.
   */
  function stubTriggerRect(opts: {
    rectTop: number;
    rectBottom: number;
    rectLeft?: number;
    rectRight?: number;
    viewportHeight: number;
    viewportWidth?: number;
  }) {
    const containerRect = {
      top: opts.rectTop,
      bottom: opts.rectBottom,
      left: opts.rectLeft ?? 50,
      right: opts.rectRight ?? 330,
      width: (opts.rectRight ?? 330) - (opts.rectLeft ?? 50),
      height: opts.rectBottom - opts.rectTop,
      x: opts.rectLeft ?? 50,
      y: opts.rectTop,
      toJSON() {
        return {};
      },
    } as DOMRect;
    const triggerRect = {
      ...containerRect,
      top: opts.rectTop,
      bottom: opts.rectBottom,
    } as DOMRect;
    const origGetBCR = Element.prototype.getBoundingClientRect;
    // Element.prototype.getBoundingClientRect is called for both the
    // containerRef (outer) and the trigger button (inner) — return the same
    // shape for both. The component only reads containerRef.
    Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
      // The label and trigger button are siblings inside containerRef; return
      // the container's rect for both calls (the positioning math only uses
      // containerRef's rect.bottom / rect.top).
      return this.classList?.contains('h-12')
        ? triggerRect
        : containerRect;
    }) as typeof Element.prototype.getBoundingClientRect;

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: opts.viewportHeight,
    });
    if (opts.viewportWidth !== undefined) {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: opts.viewportWidth,
      });
    }

    return () => {
      Element.prototype.getBoundingClientRect = origGetBCR;
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: 768,
      });
      if (opts.viewportWidth !== undefined) {
        Object.defineProperty(window, 'innerWidth', {
          configurable: true,
          value: 1024,
        });
      }
    };
  }

  async function openPickerAndGetDialogTop(): Promise<number> {
    fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
    const dialog = await waitFor(() => screen.getByRole('dialog'));
    const style = dialog.getAttribute('style') || '';
    const match = style.match(/top:\s*(\d+)/);
    if (!match) throw new Error(`popover has no top: ${style}`);
    return Number(match[1]);
  }

  it('places popover BELOW trigger when there is enough room below (spaceBelow ≥ ESTIMATE+16)', async () => {
    const restoreMM = stubMatchMedia('(max-width: 639px)', false);
    // Trigger at y=200 in a 720px viewport → spaceBelow = 520 ≥ 476 (enough).
    const restoreRect = stubTriggerRect({ rectTop: 100, rectBottom: 200, viewportHeight: 720 });
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      const top = await openPickerAndGetDialogTop();
      // rect.bottom + 8 gap = 200 + 8 = 208
      expect(top).toBe(208);
    } finally {
      restoreRect();
      restoreMM();
    }
  });

  it('flips popover ABOVE trigger when spaceBelow < ESTIMATE+16 even if spaceBelow > spaceAbove (tricky mid-band — the bug)', async () => {
    const restoreMM = stubMatchMedia('(max-width: 639px)', false);
    // Trigger at y=400 in 720px viewport:
    //   spaceBelow = 720 - 400 = 320  (< 476, NOT enough for popover)
    //   spaceAbove = 400                (above the trigger)
    // Old buggy rule: 320 > 400 is FALSE → would correctly flip above.
    // But old buggy rule was: spaceBelow >= 476 || spaceBelow > spaceAbove
    //   → (320 >= 476) FALSE, (320 > 400) FALSE → flip above (correct in this case).
    //
    // The actual bug case: trigger at y=300 with spaceBelow=420 (just below 476)
    // and spaceAbove=300 (below spaceBelow). Old rule fired placeBelow with
    // insufficient room → bottom clipped.
    const restoreRect = stubTriggerRect({ rectTop: 200, rectBottom: 300, viewportHeight: 720 });
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      const top = await openPickerAndGetDialogTop();
      // Expected: flip above. top = rect.top - ESTIMATE - 8 = 200 - 460 - 8 = -268,
      // clamped to Math.max(8, -268) = 8 (still fits within viewport).
      //
      // The KEY assertion is: the popover is NOT placed below at top=308,
      // because that would extend from y=308 to y=768 — clipped by 720 viewport.
      expect(top).not.toBe(308); // ← the buggy value (rect.bottom + 8)
      expect(top).toBeLessThanOrEqual(720 - 460 - 8); // popover bottom ≤ viewport bottom
    } finally {
      restoreRect();
      restoreMM();
    }
  });

  it('clamps popover top so it never extends past the viewport bottom (neither side fits)', async () => {
    const restoreMM = stubMatchMedia('(max-width: 639px)', false);
    // Tiny viewport (500px tall) where neither above nor below has room.
    // Trigger at y=240 → spaceBelow = 260, spaceAbove = 240 — both < 476.
    const restoreRect = stubTriggerRect({ rectTop: 140, rectBottom: 240, viewportHeight: 500 });
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      const top = await openPickerAndGetDialogTop();
      // Clamped to fit within viewport: max top = 500 - 460 - 16 = 24.
      expect(top).toBeLessThanOrEqual(24);
      expect(top).toBeGreaterThanOrEqual(8);
    } finally {
      restoreRect();
      restoreMM();
    }
  });
});

describe('ColorSwatchPicker — desktop scroll listener (no hostile UX)', () => {
  it('scrolling OUTSIDE the desktop popover (page scroll) DOES close it and commit draft', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', false);
    const onChange = vi.fn();
    try {
      render(
        <div>
          <ColorSwatchPicker
            label="背景色"
            value="#1A1A1A"
            onChange={onChange}
            presets={COLOR_PRESETS}
          />
          <button data-testid="outside">Outside</button>
        </div>,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      // Scroll outside the popover — page-level scroll, which makes the
      // popover's trigger-anchored position stale, so dismiss is correct.
      fireEvent.scroll(window);

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    } finally {
      restore();
    }
  });

  it('Option A: popover has no inner scroll container, so there is nothing inside to scroll (regression guard)', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', false);
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      const dialog = await waitFor(() => screen.getByRole('dialog'));

      // The inner content area is sized to content (no overflow-y-auto),
      // so there is no inner scroll surface for the user to interact with.
      // This is the desired state under Option A: popover = content height,
      // no internal scrollbar, content fully visible.
      const innerScrollables = dialog.querySelectorAll('.overflow-y-auto, .overflow-x-auto');
      expect(innerScrollables).toHaveLength(0);
    } finally {
      restore();
    }
  });
});

describe('ColorSwatchPicker — desktop backdrop (visual elevation)', () => {
  it('renders a dim+blur backdrop on desktop so the popover reads as elevated above page content', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', false);
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      expect(screen.queryByTestId('desktop-popover-backdrop')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      // Backdrop exists, sits below the popover in z-order, and covers the viewport
      const backdrop = screen.getByTestId('desktop-popover-backdrop');
      expect(backdrop).toBeTruthy();
      expect(backdrop.className).toMatch(/\bfixed\b/);
      expect(backdrop.className).toMatch(/inset-0/);
      expect(backdrop.className).toMatch(/bg-black\/50/);
      expect(backdrop.className).toMatch(/backdrop-blur-sm/);
      // Backdrop must NOT be the dialog itself — it's a sibling layer
      expect(backdrop.getAttribute('role')).not.toBe('dialog');
      // Backdrop sits below the popover (z-[9998] vs z-[9999])
      expect(backdrop.className).toMatch(/z-\[9998\]/);

      // Popover sits above (z-[9999])
      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toMatch(/z-\[9999\]/);
    } finally {
      restore();
    }
  });

  it('does NOT render a desktop backdrop on mobile (the bottom sheet already has its own backdrop)', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', true);
    try {
      render(
        <ColorSwatchPicker
          label="背景色"
          value="#1A1A1A"
          onChange={vi.fn()}
          presets={COLOR_PRESETS}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      expect(screen.queryByTestId('desktop-popover-backdrop')).toBeNull();
      // The mobile sheet's own backdrop is still present (bg-black/50 from MobileColorSheet)
      const mobileBackdrop = document.querySelector('.bg-black\\/50');
      expect(mobileBackdrop).toBeTruthy();
    } finally {
      restore();
    }
  });

  it('clicking the desktop backdrop commits the draft to the parent and closes the popover', async () => {
    const restore = stubMatchMedia('(max-width: 639px)', false);
    const onChange = vi.fn();
    try {
      render(
        <div>
          <ColorSwatchPicker
            label="背景色"
            value="#1A1A1A"
            onChange={onChange}
            presets={COLOR_PRESETS}
          />
          <button data-testid="outside">Outside</button>
        </div>,
      );
      fireEvent.click(screen.getByRole('button', { name: /背景色/ }));
      await waitFor(() => expect(screen.getByTestId('hsl-picker')).toBeInTheDocument());

      // Drag HSL to a new color (draft state — parent.onChange not yet called)
      fireEvent.change(screen.getByTestId('hsl-input'), {
        target: { value: '#ABC123' },
      });
      expect(onChange).not.toHaveBeenCalled();

      // Click the backdrop → useClickOutside mousedown + backdrop onClick both
      // fire commitAndClose; either way the draft commits and the popover closes.
      const backdrop = screen.getByTestId('desktop-popover-backdrop');
      fireEvent.mouseDown(backdrop);
      fireEvent.click(backdrop);

      expect(onChange).toHaveBeenCalledWith('#ABC123');
      expect(screen.queryByRole('dialog')).toBeNull();
    } finally {
      restore();
    }
  });
});
