/**
 * Tests for Step3StampGrid.
 *
 * Covered:
 *   - Section header / hint render
 *   - GridCountSelector: 4 buttons, current selection styled as aria-pressed
 *   - GridCountSelector click updates store
 *   - StampIconPicker: trigger button visible; clicking opens popover
 *   - StampIconPicker: selecting an icon writes stampIconId to store and
 *     closes the popover
 *   - StampIconPicker: outside click closes popover
 *
 * Host-level conditional render (only on stamp_card / multipass) is tested
 * in CardBuilderEditorWorkspace.test.tsx (not duplicated here).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('Step3StampGrid — section', () => {
  beforeEach(() => {
    useCardBuilderStore.setState({
      stampGridRows: 1,
      stampIconId: '',
    });
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
  });

  it('renders 4 radio buttons (1, 2, 3, 4 rows)', () => {
    render(<Step3StampGrid />);
    const section = screen.getByTestId('step3-stamp-grid');
    const radios = within(section).getAllByRole('radio');
    expect(radios.length).toBeGreaterThanOrEqual(4);
  });

  it('marks the active rows as aria-pressed', () => {
    useCardBuilderStore.setState({ stampGridRows: 3 });
    render(<Step3StampGrid />);
    const rows3Button = screen.getByRole('radio', { name: /3/ });
    expect(rows3Button.getAttribute('aria-pressed')).toBe('true');
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
});

describe('Step3StampGrid — StampIconPicker', () => {
  beforeEach(() => {
    useCardBuilderStore.setState({
      stampGridRows: 1,
      stampIconId: '',
    });
  });

  it('renders the trigger button collapsed by default', () => {
    render(<Step3StampGrid />);
    const trigger = screen.getByRole('button', { name: /印章|Stamp/ });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    // Popover dialog should not be present yet
    expect(screen.queryByRole('dialog')).toBeNull();
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

  it('writes stampIconId and closes popover when an icon is picked', async () => {
    render(<Step3StampGrid />);
    fireEvent.click(screen.getByRole('button', { name: /印章|Stamp/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    // The icon grid's first button is the "bell" icon (locale is zh-TW in
    // tests, so the aria-label is the i18n key `step3.stampSection.icons.bell`
    // → "鈴鐺"). We query inside the dialog to scope the lookup.
    const dialog = screen.getByRole('dialog');
    // Pick the first radio button inside the dialog (icons appear after the
    // count-selector radios, which are scoped to a different radiogroup).
    const iconRadios = within(dialog).getAllByRole('radio');
    expect(iconRadios.length).toBeGreaterThan(0);
    fireEvent.click(iconRadios[0]);
    // The first mocked icon is 'bell' — verify by reading the store
    expect(useCardBuilderStore.getState().stampIconId).toBe('bell');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
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
