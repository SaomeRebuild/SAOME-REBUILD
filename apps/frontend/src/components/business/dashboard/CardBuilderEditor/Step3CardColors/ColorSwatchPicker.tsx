/**
 * ColorSwatchPicker — 單顆 picker（button + portal popover + HSL drag + palette + hex input）
 *
 * @module components/business/dashboard/CardBuilderEditor/Step3CardColors/ColorSwatchPicker
 *
 * Layout:
 *   [Label]                            (static)
 *   [Button — swatch + hex + chevron]   ← trigger
 *   [Popover via createPortal when open]
 *     - HslPickerSection (react-colorful drag picker)
 *     - ColorSwatchPalette (20 swatch grid for quick access)
 *     - HexInputField (custom 6-digit input + Apply)
 *
 * UX model — "live preview, commit on close":
 *   - Opening popover resets draft from current value.
 *   - HSL drag / preset click / hex typing only update local `draft`.
 *   - Trigger swatch reflects `draft` while open (live preview).
 *   - Commit fires only on: preset click, hex Apply, click outside, Escape,
 *     scroll/resize dismiss. This avoids parent re-renders during drag and
 *     keeps the same "drag-then-leave preserves" semantics as Figma/Photoshop.
 *
 * Internal format: with '#' (CSS-friendly for `style={{ backgroundColor }}`).
 * Save boundary: strip '#' + uppercase to PassCreator format (handled in
 * CardBuilderEditorWorkspace.handleNext Step 3 branch).
 */

import { useState, useEffect, useCallback, useRef, useLayoutEffect, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import type { ColorSwatchPickerProps } from './ColorSwatchPicker.types';
import { useClickOutside, useEscapeKey, useIsMobile } from './ColorSwatchPicker.hooks';
import { ColorSwatchPalette } from './ColorSwatchPalette';
import { validateColor } from '@saome/shared/logic/color';

const POPOVER_WIDTH = 280;
/**
 * Estimated popover height used by `usePopoverPosition` to decide whether
 * to flip the popover above the trigger. Set to the natural content height
 * of the desktop popover (HSL picker + 20-swatch palette + hex input + gaps
 * + padding) so the flip-to-top math is accurate. With Option A (popover
 * sizes to content, no scroll), the popover is always this tall — keeping
 * this constant in sync with actual content height prevents the popover
 * from being positioned just slightly below the viewport edge on short
 * windows.
 */
const POPOVER_HEIGHT_ESTIMATE = 460;
/** Tailwind `sm:` boundary — see Rule 014 (Breakpoint 規範). */
const MOBILE_BREAKPOINT_PX = 640;
/** Bottom-sheet max-height as a fraction of viewport (mobile = iOS sheet pattern).
 *  Uses `vh` for universal browser support; the inner content area scrolls
 *  on viewports where 85vh still doesn't fit HSL picker + palette + hex input. */
const MOBILE_SHEET_MAX_HEIGHT = '85vh';

/**
 * Compute popover position from a trigger element. Returns null when not open.
 * Lives in a separate hook so the effect deps stay narrow (just `open`),
 * avoiding oxlint's exhaustive-deps warning about the stable RefObject.
 *
 * On mobile (< 640px), the popover is rendered as a viewport-anchored bottom
 * sheet instead of a trigger-anchored popover, so this hook returns a sentinel
 * `{ mobile: true }` position — the caller renders the sheet layout directly.
 * See Rule 013 (RWD) § Modal/Drawer: mobile = full-screen bottom sheet.
 */
type PopoverPosition =
  | { mobile: true }
  | { mobile: false; top: number; left: number }
  | null;

function usePopoverPosition(open: boolean, containerRef: RefObject<HTMLElement | null>): PopoverPosition {
  const isMobile = useIsMobile(MOBILE_BREAKPOINT_PX);
  const [position, setPosition] = useState<PopoverPosition>(null);
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    // Mobile: skip trigger-anchored math entirely — the sheet is viewport-anchored.
    if (isMobile) {
      setPosition({ mobile: true });
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const top =
      spaceBelow >= POPOVER_HEIGHT_ESTIMATE + 16 || spaceBelow > spaceAbove
        ? rect.bottom + 8
        : Math.max(8, rect.top - POPOVER_HEIGHT_ESTIMATE - 8);
    const left = Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8);
    setPosition({ mobile: false, top, left });
  }, [open, containerRef, isMobile]); // containerRef is a stable RefObject but oxlint requires it
  return position;
}

export function ColorSwatchPicker({ label, value, onChange, presets }: ColorSwatchPickerProps) {
  const { t } = useTranslation('colorPicker');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>(value);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile(MOBILE_BREAKPOINT_PX);

  // Commit current draft to parent and close. If draft equals value, just close.
  const commitAndClose = useCallback(() => {
    setDraft((currentDraft) => {
      if (currentDraft !== value) onChange(currentDraft);
      return currentDraft;
    });
    setOpen(false);
  }, [value, onChange]);

  const containerRef = useClickOutside<HTMLDivElement>(commitAndClose, popoverRef);
  useEscapeKey(commitAndClose);
  const position = usePopoverPosition(open, containerRef);

  // Sync draft from value when popover opens.
  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  // Dismiss on scroll/resize to avoid stale portal position.
  // Mobile sheet is viewport-anchored, so scrolling inside the sheet (or the page
  // behind it) must NOT close — the trigger-anchored desktop popover still needs
  // the listener because the trigger's position becomes stale after scroll.
  //
  // CRITICAL: scroll events fire with `useCapture: true` from window DOWN to
  // target, so a scroll on the popover's INNER scroll container (e.g. user
  // scrolling past the HSL picker to reach the hex input on short viewports)
  // would also be caught here and dismiss the popover. That's hostile UX —
  // the user just wants to see the rest of the picker, not close it. Guard
  // with `popoverRef.current?.contains(target)` so only OUTSIDE scrolls
  // (page scroll, ancestor scroll) trigger dismiss.
  useEffect(() => {
    if (!open) return;
    const dismiss = () => commitAndClose();
    /**
     * Scroll event handler — only dismisses when the scroll target is OUTSIDE
     * the popover. This matters because the scroll listener uses `useCapture:
     * true` from window DOWN to target, so a scroll on the popover's inner
     * scroll container (e.g. user browsing past the HSL picker to reach the
     * hex input on short viewports) also reaches this handler. Without the
     * `popoverRef.current?.contains(target)` guard, that scroll would dismiss
     * the popover — hostile UX.
     *
     * Window/document scroll has no useful Node target (`e.target` is the
     * Window itself or null), so it falls through to dismiss — correct,
     * because the popover's trigger-anchored position is now stale.
     *
     * The `target instanceof Node` guard is required because jsdom passes the
     * Window object as `target` for window-level scrolls, and Node.contains
     * throws on non-Node arguments.
     */
    const handleScroll = (e: Event) => {
      const target = e.target;
      if (target instanceof Node && popoverRef.current?.contains(target)) {
        return;
      }
      dismiss();
    };
    const handleResize = () => dismiss();
    if (!isMobile) {
      window.addEventListener('scroll', handleScroll, true);
    }
    window.addEventListener('resize', handleResize);
    return () => {
      if (!isMobile) {
        window.removeEventListener('scroll', handleScroll, true);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [open, commitAndClose, isMobile]);

  // Reset draft when popover closes so reopen starts from current value.
  useEffect(() => {
    if (!open) {
      setDraft(value);
    }
  }, [open, value]);

  function applyHex(raw: string) {
    const result = validateColor(raw);
    if ('hex' in result) {
      const normalized = `#${result.hex}`;
      setDraft(normalized);
      if (normalized !== value) onChange(normalized);
      setOpen(false);
    }
  }

  function handlePresetChange(hex: string) {
    const normalized = `#${hex}`;
    setDraft(normalized);
    if (normalized !== value) onChange(normalized);
    setOpen(false);
  }

  // Trigger shows draft while popover is open (live preview), value otherwise.
  const displayed = open ? draft : value;

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label} — ${t('openPicker')}`}
        className="
          flex h-12 w-full items-center gap-3 rounded-lg border border-border
          bg-card px-3 transition-all duration-150
          hover:scale-[1.01] hover:border-primary
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
        "
      >
        <span
          aria-hidden="true"
          className="inline-block h-8 w-8 rounded-md border border-border shadow-inner"
          style={{ backgroundColor: displayed }}
        />
        <span className="text-sm font-mono uppercase">{displayed.replace(/^#/, '')}</span>
        <ChevronDown
          size={16}
          className={`ml-auto text-muted-foreground transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Popover via createPortal — escapes any overflow:hidden ancestor clipping.
          Layout switches by viewport (Rule 013 § Modal/Drawer):
            - Mobile (< 640px): full-width bottom sheet with backdrop
            - Desktop (≥ 640px): trigger-anchored popover + dim backdrop

          Desktop backdrop — covers the viewport so the popover reads as elevated
          above page content. Without it the popover's `bg-card` (light=#FFFFFF,
          dark=#1B1B30) blends into the page (`bg-background` light=#FAFAFA,
          dark=#0F0F23) and the user can see content underneath, causing
          visual disorientation. Recipe matches the mobile sheet's backdrop
          (`bg-black/50 backdrop-blur-sm`) for cross-viewport consistency.

          Backdrop click triggers `commitAndClose` via two paths:
          1. `useClickOutside` mousedown listener (the backdrop is outside both
             containerRef and popoverRef, so any mousedown there is "outside").
          2. The explicit `onClick` handler on the backdrop itself, in case the
             user clicks a child element with `pointer-events:none`.
          Both paths are idempotent — setOpen(false) twice is the same as once. */}
      {open && position && createPortal(
        position.mobile ? (
          <MobileColorSheet
            popoverRef={popoverRef}
            label={label}
            draft={draft}
            setDraft={setDraft}
            presets={presets}
            selectedForPalette={draft}
            handlePresetChange={handlePresetChange}
            applyHex={applyHex}
            onClose={commitAndClose}
            maxHeight={MOBILE_SHEET_MAX_HEIGHT}
          />
        ) : (
          <>
            <div
              className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
              onClick={commitAndClose}
              aria-hidden="true"
              data-testid="desktop-popover-backdrop"
            />
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={label}
              style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                width: POPOVER_WIDTH,
                // Option A: NO maxHeight — popover sizes to natural content
                // height (HSL picker + 20-swatch palette + hex input + gaps +
                // padding ≈ 460px). The previous `max-height: calc(100vh -
                // 32px)` + `flex-1 overflow-y-auto` inner produced a vertical
                // scrollbar on every desktop viewport because `flex-1` claimed
                // all available main-axis space up to outer's maxHeight, even
                // when the content was only ~450px. That left ~400px of empty
                // flex space overflowing into a visible scrollbar on the inner.
                // With Option A, the popover grows to fit the content, no
                // scrollbar appears, and the user sees the whole picker.
                //
                // Trade-off: on viewports shorter than the natural content
                // height (~460px) the popover may extend below the viewport.
                // In practice desktop viewports are ≥ 700px tall, so this is
                // rare. Mobile (< 640px) is handled by the bottom-sheet
                // variant (MobileColorSheet) which has its own scroll
                // containment.
              }}
              className="z-[9999] flex flex-col rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-lifted)]"
            >
              {/* Inner content area — plain flex column that sizes to its
                  children's natural height. No `flex-1`, no `min-h-0`, no
                  `overflow-y-auto`: the popover follows content height, no
                  internal scroll. `min-w-0` is still required on flex children
                  so their implicit `min-width: auto` (= intrinsic content
                  min-width) cannot push them past the popover's 280px width. */}
              <div className="flex min-w-0 flex-col gap-3">
                <HslPickerSection value={draft} onChange={setDraft} />

                <div className="min-w-0 border-t border-border pt-2">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {t('paletteLabel')}
                  </p>
                  <ColorSwatchPalette
                    presets={presets}
                    selected={draft}
                    onChange={handlePresetChange}
                  />
                </div>

                <HexInputField value={draft} onApply={applyHex} />
              </div>
            </div>
          </>
        ),
        document.body,
      )}
    </div>
  );
}

/**
 * MobileColorSheet — bottom-sheet variant for viewports < 640px.
 *
 * Wraps the popover in a full-viewport backdrop + rounded-top sheet so the
 * HSL picker / palette / hex input are fully visible without horizontal
 * truncation. Matches the pattern established by MobilePreviewPanel.tsx.
 *
 * The backdrop is OUTSIDE the popoverRef on purpose — `useClickOutside`
 * treats clicks on the backdrop as "outside" and commits+closes the draft.
 *
 * Layout:
 *   [Close handle pill] — flex-shrink-0, always visible
 *   [Scrollable content] — flex-1 min-h-0 overflow-y-auto
 *
 * The content area scrolls when HSL picker + 20-swatch palette + hex input
 * (~470px combined) exceed the sheet's maxHeight on shorter mobile viewports.
 * Without `min-h-0`, a flex child won't shrink below its content size, so the
 * inner scroll container can't show a scrollbar.
 */
function MobileColorSheet({
  popoverRef,
  label,
  draft,
  setDraft,
  presets,
  selectedForPalette,
  handlePresetChange,
  applyHex,
  onClose,
  maxHeight,
}: {
  popoverRef: RefObject<HTMLDivElement | null>;
  label: string;
  draft: string;
  setDraft: (hex: string) => void;
  presets: readonly string[];
  selectedForPalette: string;
  handlePresetChange: (hex: string) => void;
  applyHex: (hex: string) => void;
  onClose: () => void;
  maxHeight: string;
}) {
  const { t } = useTranslation('colorPicker');
  const sheetId = `color-sheet-${label.replace(/\s+/g, '-')}`;
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
      {/* Backdrop — closes the sheet on tap (useClickOutside treats it as "outside"). */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet — full width, rounded top corners. */}
      <div
        ref={popoverRef}
        id={sheetId}
        role="dialog"
        aria-label={label}
        style={{ maxHeight }}
        className="
          relative flex w-full flex-col overflow-hidden rounded-t-2xl
          border-t border-border bg-card
          shadow-[0_-4px_20px_rgba(0,0,0,0.15)]
          animate-in slide-in-from-bottom duration-300
        "
      >
        {/* Close handle — X icon. Tapping commits the current draft to the
            parent and closes the picker (same path as tapping the backdrop). */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-controls={sheetId}
            aria-label={t('closeSheet')}
            className="
              flex h-9 w-16 cursor-pointer items-center justify-center
              rounded-full bg-muted-foreground/20
              transition-colors duration-150
              hover:bg-muted-foreground/30
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
            "
          >
            <X
              size={16}
              className="text-muted-foreground"
              aria-hidden="true"
            />
            <span className="sr-only">{t('closeSheet')}</span>
          </button>
        </div>

        {/* Scrollable content — `min-h-0` is critical on flex children so they
            can shrink below their content size and let the overflow-y-auto
            actually show a scrollbar. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <HslPickerSection value={draft} onChange={setDraft} />

          <div className="border-t border-border pt-2">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {t('paletteLabel')}
            </p>
            <ColorSwatchPalette
              presets={presets}
              selected={selectedForPalette}
              onChange={handlePresetChange}
            />
          </div>

          <HexInputField value={draft} onApply={applyHex} />
        </div>
      </div>
    </div>
  );
}

/**
 * Inline sub-component — HSL drag picker wrapper.
 * Kept in same file (not extracted) since it's only used here and
 * extracting would force artificial prop-passing between parent / child.
 */
function HslPickerSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">HSL</p>
      <div className="flex min-w-0 justify-center" data-testid="hsl-picker">
        <HexColorPicker
          color={value}
          onChange={onChange}
          style={{ width: 240, height: 160 }}
        />
      </div>
    </div>
  );
}

/**
 * Inline sub-component — Hex input with Apply button.
 * Kept in same file (not extracted) since it's only used here and
 * extracting would force artificial prop-passing between parent / child.
 */
interface HexInputFieldProps {
  value: string;
  onApply: (hex: string) => void;
}

function HexInputField({ value, onApply }: HexInputFieldProps) {
  const { t } = useTranslation('colorPicker');
  const [typed, setTyped] = useState<string>(value.replace(/^#/, ''));

  // Sync from parent (e.g., HSL drag updates parent's draft).
  useEffect(() => {
    setTyped(value.replace(/^#/, ''));
  }, [value]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onApply(typed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-2 border-t border-border pt-2">
      <label
        htmlFor={`hex-input-${value}`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('hexInputLabel')}
      </label>
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="text-sm font-mono text-muted-foreground">#</span>
        <input
          id={`hex-input-${value}`}
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value.toUpperCase())}
          placeholder={t('hexPlaceholder')}
          maxLength={7}
          className="
            h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm
            font-mono uppercase tracking-wider
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
          "
        />
        <button
          type="submit"
          className="
            h-9 rounded-md bg-primary px-3 text-sm font-semibold text-on-primary
            transition-all duration-150
            hover:scale-[1.02] active:scale-[0.98]
          "
        >
          {t('apply')}
        </button>
      </div>
    </form>
  );
}
