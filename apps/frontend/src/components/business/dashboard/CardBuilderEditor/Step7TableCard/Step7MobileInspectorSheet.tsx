/**
 * Step7MobileInspectorSheet — mobile-only bottom sheet for the Inspector.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7MobileInspectorSheet
 * @description On mobile (<lg), the desktop sidebar is hidden — the
 * toolbar lives at the bottom (fixed) and the Inspector opens as a
 * bottom sheet when the user taps a tool icon.
 *
 * Mobile UX (Issue UX 9):
 *   - Slides up from the bottom (max-height 85vh).
 *   - Header has a "完成" button to dismiss.
 *   - Backdrop click dismisses.
 *   - Safe-area inset padding at the bottom (iOS).
 *
 * The desktop `<Step7TableCardSidebar>` ignores this component entirely.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Step7TableCardInspector } from './Step7TableCardInspector';
import type { Step7InspectorProps } from './Step7TableCard.types';

interface Props extends Step7InspectorProps {
  /** Whether the sheet is open. */
  open: boolean;
  /** Close handler. */
  onClose: () => void;
}

export function Step7MobileInspectorSheet({
  open,
  onClose,
  activeTool,
  selectedElement,
}: Props) {
  const { t } = useTranslation('tableCard');

  // Lock body scroll while sheet is open (prevents page scroll behind
  // the sheet on iOS Safari, where overflow:hidden doesn't fully stop
  // momentum scrolling).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('rightSidebar.ariaLabel')}
      data-testid="step7-mobile-sheet"
      className="fixed inset-0 z-50 flex items-end lg:hidden"
    >
      {/* Backdrop — click to dismiss. */}
      <button
        type="button"
        onClick={onClose}
        aria-label={t('common.close')}
        className="absolute inset-0 bg-black/50"
        tabIndex={-1}
      />

      {/* Sheet content. max-h-85vh + safe-area inset for iOS. */}
      <div className="relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            {t('rightSidebar.ariaLabel')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Inspector (the inspector itself renders the selection bar at
            the top of every tool panel — no need to duplicate here). */}
        <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <Step7TableCardInspector
            activeTool={activeTool}
            selectedElement={selectedElement}
          />
        </div>
      </div>
    </div>
  );
}

export default Step7MobileInspectorSheet;
