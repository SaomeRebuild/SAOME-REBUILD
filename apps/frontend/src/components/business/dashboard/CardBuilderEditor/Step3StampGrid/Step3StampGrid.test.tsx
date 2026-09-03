/**
 * Tests for Step3StampGrid.
 *
 * Covered:
 *   - Section header / hint render
 *   - GridCountSelector: 4 buttons, current selection styled with data-state
 *   - GridCountSelector: buttons meet 44px touch target
 *   - GridCountSelector: click updates store
 *   - StampIconPicker: trigger button visible; clicking opens popover
 *   - StampIconPicker: selecting an icon writes stampIconId to store and
 *     closes the popover (DESKTOP and MOBILE)
 *   - StampIconPicker: outside click closes popover
 *   - StampIconPicker: dialog uses popover token (--color-popover CSS var)
 *   - StampIconPicker: icon grid uses auto-fit responsive columns
 *
 * Host-level conditional render (only on stamp_card / multipass) is tested
 * in CardBuilderEditorWorkspace.test.tsx (not duplicated here).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { Step3StampGrid } from './index';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

// Stamp icon manifest is mocked so the picker grid renders deterministic
// stubs (we don't want this test to depend on real PNG asset URLs).
vi.mock('@/assets/icons/stamps/manifest', () => ({
  STAMP_ICONS: [
    { id: 'bell', stampedUrl: '/stamped/bell.png', unstampedUrl: '/unstamped/bell.png' },
    { id: 'fire', stampedUrl: '/stamped/fire.png', unstampedUrl: '/unstamped/fire.png' },
    { id: 'sun', stampedUrl: '/stamped/sun.png', unstampedUrl: '/unstamped/sun.png' },
  ],
  STAMP_ICON_IDS: ['bell', 'fire', 'sun'],
  getStampIcon: vi.fn((id: string) => {
    const map: Record<string, { id: string; stampedUrl: string; unstampedUrl: string }> = {
      bell: { id: 'bell', stampedUrl: '/stamped/bell.png', unstampedUrl: '/unstamped/bell.png' },
      fire: { id: 'fire', stampedUrl: '/stamped/fire.png', unstampedUrl: '/unstamped/fire.png' },
      sun: { id: 'sun', stampedUrl: '/stamped/sun.png', unstampedUrl: '/unstamped/sun.png' },
    };
    return map[id];
  }),
}));

/**
 * Helper: force `matchMedia` to return a specific viewport.
 * jsdom defaults to 1024×768, so we default to desktop. Tests that need
 * mobile behavior override this.
 */
function setMobileMode(isMobile: boolean) {
  const listeners: Array<(e: { matches: boolean }) => void> = [];
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('max-width') ? isMobile : false,
      media: query,
      onchange: null,
      addEventListener: (_evt: string, cb: (e: { matches: boolean }) => void) => {
        listeners.push(cb);
      },
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

describe('Step3StampGrid — section', () => {
  beforeEach(() => {
    useCardBuilderStore.setState({
      stampGridRows: 1,
      stampIconId: '',
    });
    setMobileMode(false);
  });

  it('renders the section header', () => {
    render(<Step3StampGrid />);
    expect(screen.getByTestId('step3-stamp-grid')).toBeInTheDocument();
  });
});

describe('Step3StampGrid — GridCountSelector', () => {
  beforeEach(() => {
    useCardBuilderStore.setState({
      stampGridRows: 1,
      stampIconId: '',
    });
    setMobileMode(false);
  });

  it('renders 4 radio buttons (1, 2, 3, 4 rows)', () => {
    render(<Step3StampGrid />);
    const section = screen.getByTestId('step3-stamp-grid');
    const radios = within(section).getAllByRole('radio');
    expect(radios.length).toBeGreaterThanOrEqual(4);
  });

  it('marks the active rows as data-state="checked"', () => {
    useCardBuilderStore.setState({ stampGridRows: 3 });
    render(<Step3StampGrid />);
    const rows3Button = screen.getByRole('radio', { name: /3/ });
    expect(rows3Button.getAttribute('data-state')).toBe('checked');
    // Inactive rows must NOT carry data-state="checked"
    const rows1Button = screen.getByRole('radio', { name: /1/ });
    expect(rows1Button.getAttribute('data-state')).not.toBe('checked');
  });

  it('updates stampGridRows in the store when clicked', () => {
    render(<Step3StampGrid />);
    const rows2Button = screen.getByRole('radio', { name: /2/ });
    fireEvent.click(rows2Button);
    expect(useCardBuilderStore.getState().stampGridRows).toBe(2);
  });

  it('updates stampGridRows to 4 when the 4-rows button is clicked', () => {
    render(<Step3StampGrid />);
    fireEvent.click(screen.getByRole('radio', { name: /4/ }));
    expect(useCardBuilderStore.getState().stampGridRows).toBe(4);
  });

  it('each grid-count button meets the 44px touch-target minimum (Rule 013 RWD)', () => {
    render(<Step3StampGrid />);
    const section = screen.getByTestId('step3-stamp-grid');
    const radios = within(section).getAllByRole('radio');
    // Only check the 4 grid-count radios (icon radios are scoped to a
    // different radiogroup that mounts only when the picker opens).
    const gridRadios = radios.slice(0, 4);
    gridRadios.forEach((btn) => {
      expect(btn.className).toMatch(/min-h-\[44px\]/);
    });
  });

  it('active button has press-feedback classes (active:bg-primary/90 active:scale-95)', () => {
    useCardBuilderStore.setState({ stampGridRows: 2 });
    render(<Step3StampGrid />);
    const active = screen.getByRole('radio', { name: /2/ });
    expect(active.className).toMatch(/active:bg-primary\/90/);
    expect(active.className).toMatch(/active:scale-95/);
  });

  it('inactive button has press-feedback classes (active:bg-muted active:scale-95)', () => {
    useCardBuilderStore.setState({ stampGridRows: 1 });
    render(<Step3StampGrid />);
    const inactive = screen.getByRole('radio', { name: /2/ });
    expect(inactive.className).toMatch(/active:bg-muted/);
    expect(inactive.className).toMatch(/active:scale-95/);
  });
});

describe('Step3StampGrid — StampIconPicker (desktop)', () => {
  beforeEach(() => {
    useCardBuilderStore.setState({
      stampGridRows: 1,
      stampIconId: '',
    });
    setMobileMode(false);
  });

  it('renders the trigger button collapsed by default', () => {
    render(<Step3StampGrid />);
    const trigger = screen.getByRole('button', { name: /印章|Stamp/ });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    // Popover dialog should not be present yet
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the first manifest icon as a visual fallback in the trigger when nothing is selected', () => {
    // Default state: stampIconId = ''. The trigger should still render a
    // stamp icon (the first one in the manifest) so the user sees "a
    // stamp" instead of a neutral gray placeholder. The store stays at
    // '' until the user explicitly picks an icon.
    render(<Step3StampGrid />);
    const trigger = screen.getByRole('button', { name: /印章|Stamp/ });
    const triggerImg = trigger.querySelector('img');
    expect(triggerImg).not.toBeNull();
    expect(triggerImg?.getAttribute('src')).toBe('/stamped/bell.png');
  });

  it('falls back to the visual default when stampIconId does not match any manifest entry', () => {
    // Defensive: if the store somehow holds an id that no longer exists
    // (e.g. icon file removed in a later release), the trigger should
    // gracefully fall back to the first manifest icon rather than crash.
    useCardBuilderStore.setState({ stampIconId: 'does-not-exist' });
    render(<Step3StampGrid />);
    const trigger = screen.getByRole('button', { name: /印章|Stamp/ });
    const triggerImg = trigger.querySelector('img');
    expect(triggerImg).not.toBeNull();
    expect(triggerImg?.getAttribute('src')).toBe('/stamped/bell.png');
  });

  // 2026-09-04 fix: trigger LABEL must reflect store state, not the visual
  // fallback. Showing the first icon's i18n name (e.g. "鈴鐺") when nothing
  // was picked misled users into thinking an icon was already committed.
  it('trigger LABEL shows the generic "Pick a stamp" text when stampIconId is empty (NOT the first icon name)', () => {
    useCardBuilderStore.setState({ stampIconId: '' });
    render(<Step3StampGrid />);
    const trigger = screen.getByRole('button', { name: /印章|Stamp/ });
    // Visible label inside the trigger button is the second <span> after
    // the icon thumbnail. Use within() to scope to the button so we don't
    // catch labels from other radios on the page.
    const triggerText = within(trigger).getByText(/選擇印章|Pick a stamp/);
    expect(triggerText).toBeInTheDocument();
    // Make sure we are NOT showing the first icon's name as the label.
    expect(within(trigger).queryByText(/鈴鐺|Bell/)).toBeNull();
    // Visual fallback (32x32 <img>) is still rendered.
    const triggerImg = trigger.querySelector('img');
    expect(triggerImg?.getAttribute('src')).toBe('/stamped/bell.png');
  });

  it('trigger LABEL shows the actual icon i18n name when stampIconId is committed', () => {
    useCardBuilderStore.setState({ stampIconId: 'fire' });
    render(<Step3StampGrid />);
    const trigger = screen.getByRole('button', { name: /印章|Stamp/ });
    // fire icon label in zh-TW = "火焰" / en = "Fire"
    const triggerText = within(trigger).getByText(/火焰|Fire/);
    expect(triggerText).toBeInTheDocument();
  });

  it('opens the popover when the trigger button is clicked', async () => {
    render(<Step3StampGrid />);
    const trigger = screen.getByRole('button', { name: /印章|Stamp/ });
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders all manifest icons in the popover grid', async () => {
    render(<Step3StampGrid />);
    fireEvent.click(screen.getByRole('button', { name: /印章|Stamp/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    // The icon grid contains 3 radios (one per mocked icon) plus the 4
    // count selector radios — total >= 3 icons.
    const radios = within(dialog).getAllByRole('radio');
    expect(radios.length).toBeGreaterThanOrEqual(3);
  });

  // 2026-09-04 fix: preview block (header title + <StampGridPreview>) was
  // removed from the popover. The popover should now contain only the close
  // button + icon grid.
  it('does NOT render the preview block inside the popover (header title + StampGridPreview removed)', async () => {
    render(<Step3StampGrid />);
    fireEvent.click(screen.getByRole('button', { name: /印章|Stamp/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    // StampGridPreview test-id should NOT be inside the dialog.
    expect(within(dialog).queryByTestId('stamp-grid-preview')).toBeNull();
    // "Stamp Preview" / "印章預覽" header title should NOT be inside the dialog.
    expect(within(dialog).queryByText(/印章預覽|Stamp Preview/)).toBeNull();
  });

  it('writes stampIconId and closes popover when an icon is picked (DESKTOP)', async () => {
    render(<Step3StampGrid />);
    fireEvent.click(screen.getByRole('button', { name: /印章|Stamp/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    const iconRadios = within(dialog).getAllByRole('radio');
    expect(iconRadios.length).toBeGreaterThan(0);
    fireEvent.click(iconRadios[0]);
    // The first mocked icon is 'bell' — verify by reading the store
    expect(useCardBuilderStore.getState().stampIconId).toBe('bell');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  // 2026-09-04 stamp correction: dialog background MUST come from the
  // popover semantic token (--color-popover), not a Tailwind `bg-popover`
  // utility (which is not produced by the current @theme mapping and would
  // render as transparent). No hex; uses design tokens.
  it('dialog background uses the popover CSS variable token (no hex)', async () => {
    render(<Step3StampGrid />);
    fireEvent.click(screen.getByRole('button', { name: /印章|Stamp/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toMatch(/bg-\[var\(--color-popover\)\]/);
    expect(dialog.className).toMatch(/text-\[var\(--color-popover-foreground\)\]/);
  });

  // 2026-09-04 stamp correction: icon grid uses auto-fit responsive sizing
  // so any number of manifest icons wrap automatically (5 icons fit in one
  // row at desktop width; 6+ icons wrap without code changes).
  it('icon grid uses responsive auto-fit columns (minmax(44px, 1fr))', async () => {
    render(<Step3StampGrid />);
    fireEvent.click(screen.getByRole('button', { name: /印章|Stamp/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    // The radiogroup is the icon grid; grid template uses minmax(44px, 1fr)
    const radiogroup = within(dialog).getByRole('radiogroup');
    expect(radiogroup.style.gridTemplateColumns).toMatch(/repeat\(auto-fit, minmax\(44px, 1fr\)\)/);
    // data-icon-count is set to the manifest length so CSS / tests can verify it
    expect(radiogroup.getAttribute('data-icon-count')).toBe('3');
  });

  it('icon button meets the 44px touch target', async () => {
    render(<Step3StampGrid />);
    fireEvent.click(screen.getByRole('button', { name: /印章|Stamp/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    const iconButtons = within(dialog).getAllByRole('radio');
    iconButtons.forEach((btn) => {
      expect(btn.className).toMatch(/min-h-\[44px\]/);
      expect(btn.className).toMatch(/aspect-square/);
      expect(btn.className).toMatch(/w-full/);
    });
  });

  it('selected icon is marked data-state="checked"', async () => {
    useCardBuilderStore.setState({ stampIconId: 'sun' });
    render(<Step3StampGrid />);
    fireEvent.click(screen.getByRole('button', { name: /印章|Stamp/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    // sun icon radio should be checked
    const sunRadio = within(dialog).getByRole('radio', { name: /太陽|Sun/ });
    expect(sunRadio.getAttribute('data-state')).toBe('checked');
    expect(sunRadio.getAttribute('aria-checked')).toBe('true');
    // bell radio (different id) should NOT be checked
    const bellRadio = within(dialog).getByRole('radio', { name: /鈴鐺|Bell/ });
    expect(bellRadio.getAttribute('data-state')).not.toBe('checked');
    expect(bellRadio.getAttribute('aria-checked')).toBe('false');
  });

  it('closes the popover when clicking the X close button', async () => {
    render(<Step3StampGrid />);
    fireEvent.click(screen.getByRole('button', { name: /印章|Stamp/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /關閉印章|Close stamp/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes the popover on outside click', async () => {
    render(
      <div>
        <Step3StampGrid />
        <button data-testid="outside">Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /印章|Stamp/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.mouseDown(screen.getByTestId('outside'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('Step3StampGrid — StampIconPicker (mobile)', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    useCardBuilderStore.setState({
      stampGridRows: 1,
      stampIconId: '',
    });
    originalMatchMedia = window.matchMedia;
    setMobileMode(true);
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('opens the viewport-centered dialog when triggered on mobile', async () => {
    render(<Step3StampGrid />);
    fireEvent.click(screen.getByRole('button', { name: /印章|Stamp/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    // The popover content (inside the modal backdrop) uses the popover
    // CSS variable token. The backdrop itself is a separate overlay div.
    expect(dialog.className).toMatch(/bg-black\/50/);
    // Inner popover panel uses --color-popover
    const popoverPanel = dialog.querySelector('.bg-\\[var\\(--color-popover\\)\\]');
    expect(popoverPanel).not.toBeNull();
    expect(popoverPanel?.className).toMatch(/text-\[var\(--color-popover-foreground\)\]/);
  });

  // 2026-09-04 stamp correction: mobile selection was previously a no-op
  // because the mobile branch omitted `onPick` / `activeId`. Clicking an
  // icon must now write to the store and close the dialog (mirroring
  // desktop).
  it('writes stampIconId and closes dialog when an icon is picked on MOBILE', async () => {
    render(<Step3StampGrid />);
    fireEvent.click(screen.getByRole('button', { name: /印章|Stamp/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    const iconRadios = within(dialog).getAllByRole('radio');
    // Pick a non-first icon to prove the callback isn't always targeting [0]
    expect(iconRadios.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(iconRadios[2]);
    expect(useCardBuilderStore.getState().stampIconId).toBe('sun');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('marks the active icon on mobile (data-state + aria-checked)', async () => {
    useCardBuilderStore.setState({ stampIconId: 'fire' });
    render(<Step3StampGrid />);
    fireEvent.click(screen.getByRole('button', { name: /印章|Stamp/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    const fireRadio = within(dialog).getByRole('radio', { name: /火焰|Fire/ });
    expect(fireRadio.getAttribute('data-state')).toBe('checked');
    expect(fireRadio.getAttribute('aria-checked')).toBe('true');
  });
});
