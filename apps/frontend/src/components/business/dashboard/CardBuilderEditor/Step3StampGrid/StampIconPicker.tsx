/**
 * StampIconPicker — trigger button + popover for picking a stamp icon.
 *
 * UX model:
 *   1. Trigger button shows the currently-selected icon (stamped variant,
 *      32×32) + its i18n label + a ChevronDown affordance.
 *   2. Click → popover opens, anchored below the trigger (or above on
 *      tight viewports — handled in usePopoverPosition if we add it later).
 *   3. Popover contains:
 *        a. Preview column: <StampGridPreview stripHeight={120} /> showing
 *           what the grid would look like in the actual card strip. Uses
 *           the picker state (not yet committed) so the user sees live
 *           feedback as they hover icons.
 *        b. Icon grid: 5-column grid of every manifest icon. Clicking an
 *           icon calls setStampIconId + closes the popover.
 *        c. Close button (X) in the corner.
 *   4. Outside click / Escape → close without committing.
 *
 * Why inline absolute positioning (no portal):
 *   - The popover lives inside the Step 3 wizard, which is a vertically
 *     scrolling container. A portal would have to manage overflow ancestors
 *     to avoid being clipped, which is more complexity than this L2 picker
 *     needs. If the popover is ever clipped, fall back to a full portal.
 *
 * Why we reuse `useClickOutside` / `useEscapeKey` from ColorSwatchPicker:
 *   - Identical semantics (mousedown outside, Escape), already tested
 *     across the CardBuilderEditor feature. Cross-folder import is the
 *     cheap path; extracting to a shared `hooks.ts` is a follow-up cleanup
 *     when a third caller needs them.
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
import { StampGridPreview } from '@/components/business/stampCard/StampGridPreview';
import {
  STAMP_ICONS,
  STAMP_ICON_IDS,
  getStampIcon,
} from '@/assets/icons/stamps/manifest';

const TRIGGER_ICON_SIZE = 32;
/** Strip height used inside the picker's preview column. */
const PICKER_PREVIEW_STRIP_HEIGHT = 120;
/** Cell size of each icon thumbnail in the popover grid. */
const GRID_ICON_SIZE = 48;
/** Maximum popover width (px). */
const POPOVER_MAX_WIDTH = 320;

export function StampIconPicker() {
  const { t } = useTranslation('cardEditor');
  const stampIconId = useCardBuilderStore((s) => s.stampIconId);
  const stampGridRows = useCardBuilderStore((s) => s.stampGridRows);
  const setStampIconId = useCardBuilderStore((s) => s.setStampIconId);

  const [open, setOpen] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Preview always reflects hover (when open) so the user sees what each
  // icon would look like before committing.
  const previewIconId = open ? (hoverId ?? stampIconId) : stampIconId;

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside<HTMLDivElement>(close, triggerRef as React.RefObject<HTMLElement | null>);
  useEscapeKey(close);

  const currentIcon = stampIconId ? getStampIcon(stampIconId) : undefined;
  const currentLabel = stampIconId
    ? t(`step3.stampSection.icons.${stampIconId}`, { defaultValue: stampIconId })
    : t('step3.stampSection.iconPicker.trigger');

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {t('step3.stampSection.iconPicker.label')}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
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

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={t('step3.stampSection.iconPicker.label')}
            className={
              'fixed left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 ' +
              'flex-col gap-4 rounded-lg border border-input bg-popover p-4 text-popover-foreground shadow-lg ' +
              'md:relative md:left-auto md:top-auto md:translate-x-0 md:translate-y-0'
            }
            style={{ width: 'min(100vw - 32px, 480px)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t('step3.stampSection.iconPicker.previewAlt')}
              </span>
              <button
                type="button"
                aria-label={t('step3.stampSection.iconPicker.closeAria')}
                onClick={close}
                className="rounded-sm p-1 text-muted-foreground hover:bg-accent/40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Preview column */}
            <div className="flex justify-center rounded-md border border-input bg-muted/40 p-3">
              <StampGridPreview
                iconId={previewIconId}
                rows={stampGridRows}
                stripHeight={PICKER_PREVIEW_STRIP_HEIGHT}
              />
            </div>

            {/* Icon grid */}
            <div
              role="radiogroup"
              aria-label={t('step3.stampSection.iconPicker.label')}
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${Math.min(STAMP_ICON_IDS.length, 5)}, ${GRID_ICON_SIZE}px)`,
                maxWidth: POPOVER_MAX_WIDTH,
              }}
            >
              {STAMP_ICONS.map((entry) => {
                const isActive = entry.id === stampIconId;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    aria-pressed={isActive}
                    aria-label={t(`step3.stampSection.icons.${entry.id}`, { defaultValue: entry.id })}
                    onMouseEnter={() => setHoverId(entry.id)}
                    onMouseLeave={() => setHoverId((prev) => (prev === entry.id ? null : prev))}
                    onClick={() => {
                      setStampIconId(entry.id);
                      close();
                    }}
                    title={t(`step3.stampSection.icons.${entry.id}`, { defaultValue: entry.id })}
                    className={
                      'flex items-center justify-center rounded-sm border p-1 transition-colors ' +
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
                      (isActive
                        ? 'border-primary bg-primary/10'
                        : 'border-transparent hover:bg-accent/40')
                    }
                    style={{ width: GRID_ICON_SIZE, height: GRID_ICON_SIZE }}
                  >
                    <img
                      src={entry.stampedUrl}
                      alt=""
                      width={GRID_ICON_SIZE}
                      height={GRID_ICON_SIZE}
                      className="block"
                    />
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
