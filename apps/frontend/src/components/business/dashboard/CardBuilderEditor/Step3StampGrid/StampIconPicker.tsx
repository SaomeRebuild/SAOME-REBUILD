/**
 * StampIconPicker — trigger button + popover for picking a stamp icon.
 *
 * UX model:
 *   1. Trigger button shows:
 *        - 32x32 visual preview of a stamp icon. When nothing is committed,
 *          this falls back to STAMP_ICONS[0] so the user immediately sees
 *          "a stamp" instead of a neutral gray placeholder.
 *        - i18n label that REFLECTS STORE STATE: when no icon is committed,
 *          the label is the generic "Pick a stamp" / "選擇印章" string
 *          (NOT the fallback icon's name). Once the user picks, the label
 *          switches to the chosen icon's i18n name.
 *        - ChevronDown affordance.
 *   2. Click → popover opens, anchored below the trigger on desktop or
 *      centered on the viewport on mobile.
 *   3. Popover contains:
 *        a. Close button (X) in the corner.
 *        b. Icon grid: auto-fit responsive grid of every manifest icon.
 *           Clicking an icon calls setStampIconId + closes the popover.
 *   4. Outside click / Escape → close without committing.
 *
 * Why inline absolute positioning (no portal) is replaced by createPortal:
 *   - Earlier we rendered the popover inline with `md:relative` to "anchor"
 *     it, but that leaked the popover into the wrong document flow and
 *     clipped off-viewport on long pages. We now use the same portal +
 *     explicit positioning pattern as ColorSwatchPicker (see
 *     useStampPickerPopoverPosition).
 *
 * Why we reuse `useClickOutside` / `useEscapeKey` from ColorSwatchPicker:
 *   - Identical semantics (mousedown outside, Escape), already tested
 *     across the CardBuilderEditor feature. Cross-folder import is the
 *     cheap path; extracting to a shared `hooks.ts` is a follow-up cleanup
 *     when a third caller needs them.
 *
 * "Visual default != functional default" (added 2026-09-04):
 *   - The 32x32 thumbnail is purely a visual hint — it previews what the
 *     icon will look like so the user can see "a stamp" before clicking.
 *   - The label is the semantic indicator — it must always reflect what
 *     the store actually has. Showing the fallback icon's name as the
 *     label misled users into thinking an icon was already chosen.
 *
 * 2026-09-04 stamp correction:
 *   - Mobile branch now also receives `onPick` and `activeId` so selecting
 *     an icon writes to the store and closes the popover. Previously the
 *     mobile body was rendered without these props, so icon buttons
 *     silently did nothing.
 *   - Dialog background switched from the `bg-popover` Tailwind utility
 *     (which is NOT produced by the current @theme mapping) to the
 *     semantic CSS variable `--color-popover`, paired with
 *     `--color-popover-foreground` for text. No hex; uses design tokens.
 *   - Grid switched from a fixed `repeat(N, 48px)` template (which
 *     overflowed the 280px dialog once more icons were added) to
 *     `repeat(auto-fit, minmax(44px, 1fr))` so any number of icons from
 *     the `import.meta.glob` manifest wraps automatically. Each radio
 *     is a square with `w-full` and `min-h-[44px]` for touch-target
 *     compliance.
 *   - Both mobile (viewport-centered) and desktop (anchored) variants use
 *     the same `POPOVER_WIDTH` constant (320px) so the body width matches
 *     the popover math in `StampIconPicker.hooks.ts`.
 */
import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import {
  useClickOutside,
  useEscapeKey,
} from '../Step3CardColors/ColorSwatchPicker.hooks';
import {
  POPOVER_WIDTH,
  useStampPickerPopoverPosition,
} from './StampIconPicker.hooks';
import {
  STAMP_ICONS,
  STAMP_ICON_IDS,
  getStampIcon,
} from '@/assets/icons/stamps/manifest';

const TRIGGER_ICON_SIZE = 32;
/** Minimum icon-cell size in the popover grid (44px = touch target). */
const GRID_CELL_MIN = 44;
/** Maximum icon-cell size in the popover grid. */
const GRID_CELL_MAX = 64;

export function StampIconPicker() {
  const { t } = useTranslation('cardEditor');
  const stampIconId = useCardBuilderStore((s) => s.stampIconId);
  const setStampIconId = useCardBuilderStore((s) => s.setStampIconId);

  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useClickOutside<HTMLDivElement>(close, popoverRef as React.RefObject<HTMLElement | null>);
  useEscapeKey(close);
  const position = useStampPickerPopoverPosition(open, containerRef);

  // Visual fallback for the 32x32 thumbnail: when nothing is selected yet,
  // show the first manifest icon so the user immediately sees "a stamp"
  // instead of a neutral gray box. The fallback also kicks in if the store
  // holds an icon id that no longer exists in the manifest (e.g. the icon
  // file was removed in a later release) so the trigger never crashes.
  // DISPLAY ONLY — the store stays `stampIconId: ''` until the user picks.
  const fallbackIcon = STAMP_ICONS[0];
  const currentIcon = stampIconId
    ? (getStampIcon(stampIconId) ?? fallbackIcon)
    : fallbackIcon;

  // Label reflects STORE state, NOT the visual fallback. This is the fix
  // for "trigger shows 鈴鐺 even though nothing is selected":
  //   - empty / unknown id → generic "Pick a stamp" label
  //   - committed id → that icon's i18n name
  const hasCommittedIcon = stampIconId !== '' && getStampIcon(stampIconId) !== undefined;
  const currentLabel = hasCommittedIcon
    ? t(`step3.stampSection.icons.${stampIconId}`, { defaultValue: stampIconId })
    : t('step3.stampSection.iconPicker.trigger');

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {t('step3.stampSection.iconPicker.label')}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        // aria-label is the picker purpose (so screen readers hear
        // "印章圖示, button" instead of the current icon name). The visible
        // label inside the button shows the committed icon (or generic
        // fallback) for sighted users.
        aria-label={t('step3.stampSection.iconPicker.label')}
        onClick={() => setOpen((v) => !v)}
        className={
          'flex h-10 w-full max-w-sm items-center gap-3 rounded-md border border-input ' +
          'bg-background px-3 py-2 text-sm text-foreground ' +
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
          'hover:bg-accent/40'
        }
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-sm bg-muted"
        >
          {currentIcon ? (
            <img
              src={currentIcon.stampedUrl}
              alt=""
              width={TRIGGER_ICON_SIZE}
              height={TRIGGER_ICON_SIZE}
              className="block"
            />
          ) : (
            <span className="block h-8 w-8 bg-neutral-300 dark:bg-neutral-600" />
          )}
        </span>
        <span className="flex-1 text-left truncate">{currentLabel}</span>
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-muted-foreground"
        />
      </button>

      {open && position && createPortal(
        position.mobile ? (
          // Mobile: viewport-centered modal. The earlier relative-anchored
          // mobile style was unreliable on long pages; centering is the
          // lowest-risk default and matches the rest of the wizard on
          // mobile. (Bottom-sheet variant is out of scope — see plan.)
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={t('step3.stampSection.iconPicker.label')}
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => {
              // Backdrop click closes; clicks inside popoverRef are stopped
              // by the click-outside hook's `contains` check.
              if (!popoverRef.current?.contains(e.target as Node)) close();
            }}
          >
            <div
              style={{ width: `min(100vw - 32px, ${POPOVER_WIDTH}px)` }}
              className="flex flex-col gap-3 rounded-lg border border-border p-3 shadow-[var(--shadow-lifted)] bg-[var(--color-popover)] text-[var(--color-popover-foreground)]"
            >
              <StampIconPopoverBody
                tLabel={t('step3.stampSection.iconPicker.closeAria')}
                onClose={close}
                onPick={(id) => {
                  setStampIconId(id);
                  close();
                }}
                activeId={stampIconId}
              />
            </div>
          </div>
        ) : (
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={t('step3.stampSection.iconPicker.label')}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: POPOVER_WIDTH,
            }}
            className="z-50 flex flex-col gap-3 rounded-lg border border-border p-3 shadow-[var(--shadow-lifted)] bg-[var(--color-popover)] text-[var(--color-popover-foreground)]"
          >
            <StampIconPopoverBody
              tLabel={t('step3.stampSection.iconPicker.closeAria')}
              onClose={close}
              onPick={(id) => {
                setStampIconId(id);
                close();
              }}
              activeId={stampIconId}
            />
          </div>
        ),
        document.body,
      )}
    </div>
  );
}

/**
 * Shared popover body — used by both mobile (viewport-centered) and desktop
 * (trigger-anchored) variants so the close-button + icon grid stay in sync.
 *
 * Why this is inline (not a separate file): the body is small (~50 lines),
 * and extracting it would force props like `onClose` / `onPick` to be
 * threaded through an extra layer with no other consumer.
 */
function StampIconPopoverBody({
  tLabel,
  onClose,
  onPick,
  activeId,
}: {
  tLabel: string;
  onClose: () => void;
  /** Optional — when omitted (legacy / mobile preview build), the body
   *  renders the grid without selection state. */
  onPick?: (id: string) => void;
  activeId?: string;
}) {
  const { t } = useTranslation('cardEditor');
  return (
    <>
      <div className="flex items-center justify-end">
        <button
          type="button"
          aria-label={tLabel}
          onClick={onClose}
          className="rounded-sm p-1 text-muted-foreground hover:bg-accent/40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        role="radiogroup"
        aria-label={t('step3.stampSection.iconPicker.label')}
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(${GRID_CELL_MIN}px, 1fr))`,
        }}
        data-icon-count={STAMP_ICON_IDS.length}
      >
        {STAMP_ICONS.map((entry) => {
          const isActive = entry.id === activeId;
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              data-state={isActive ? 'checked' : undefined}
              aria-label={t(`step3.stampSection.icons.${entry.id}`, { defaultValue: entry.id })}
              onClick={() => onPick?.(entry.id)}
              title={t(`step3.stampSection.icons.${entry.id}`, { defaultValue: entry.id })}
              className={
                'flex aspect-square w-full items-center justify-center rounded-sm border p-1 transition-colors ' +
                'min-h-[44px] ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
                (isActive
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent hover:bg-accent/40')
              }
            >
              <img
                src={entry.stampedUrl}
                alt=""
                className="block h-full w-full object-contain"
                style={{ maxWidth: GRID_CELL_MAX, maxHeight: GRID_CELL_MAX }}
              />
            </button>
          );
        })}
      </div>
    </>
  );
}
