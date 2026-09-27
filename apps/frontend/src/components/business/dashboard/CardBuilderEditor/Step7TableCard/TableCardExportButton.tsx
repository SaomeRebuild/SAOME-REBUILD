/**
 * TableCardExportButton — 5-state export button.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/TableCardExportButton
 * @description Renders one of 5 button states per the plan:
 *   - 'idle'       → "生成桌牌"   (primary, no export yet)
 *   - 'generating' → "生成中…"    (disabled, spinner)
 *   - 'ready'      → "下載桌牌"   (secondary, last export OK)
 *   - 'stale'      → "重新生成"   (warning, canvas changed since last export)
 *   - 'error'      → "重試生成桌牌" (destructive, last export failed)
 *
 * Two variants:
 *   - 'inline' (default) — used in the Header next to "下一步"
 *   - 'fab'              — floating action button over the canvas (desktop only)
 */

import { useTranslation } from 'react-i18next';
import { Download, RefreshCw, AlertCircle, Loader2, Plus } from 'lucide-react';
import type { ExportState } from './Step7TableCard.types';

interface Props {
  state: ExportState;
  onClick: () => void;
  /**
   * Trigger for the "下載桌牌" state. Async is allowed because
   * the download now goes through `httpClient.getBlob` + Blob URL
   * (Round 2 fix — the previous `window.open(url)` approach silently
   * 401'd because browser navigation drops the Authorization header).
   * Fire-and-forget: we don't await the returned Promise.
   */
  onDownload?: () => void | Promise<void>;
  variant?: 'inline' | 'fab';
  disabled?: boolean;
}

export function TableCardExportButton({
  state,
  onClick,
  onDownload,
  variant = 'inline',
  disabled,
}: Props) {
  const { t } = useTranslation('tableCard');

  // 'ready' = both download AND re-export are available; show download
  // when onDownload is provided, otherwise fall through to "Re-generate".
  const effectiveState: ExportState =
    state === 'ready' && onDownload ? 'ready' : state;

  const labelMap: Record<ExportState, string> = {
    idle: t('exportButton.idle'),
    generating: t('exportButton.generating'),
    ready: t('exportButton.ready'),
    stale: t('exportButton.stale'),
    error: t('exportButton.error'),
  };
  const tooltipMap: Partial<Record<ExportState, string>> = {
    stale: t('exportButton.staleTooltip'),
    error: t('exportButton.errorTooltip'),
  };

  const iconMap = {
    idle: <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />,
    generating: <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />,
    ready: <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />,
    stale: <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" />,
    error: <AlertCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />,
  };

  const styleMap: Record<ExportState, string> = {
    idle:
      'bg-primary text-primary-foreground hover:bg-primary/90 border-primary',
    generating:
      'bg-muted text-muted-foreground border-muted cursor-not-allowed',
    ready:
      'bg-success text-success-foreground hover:bg-success/90 border-success',
    stale:
      'bg-warning text-warning-foreground hover:bg-warning/90 border-warning',
    error:
      'bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive',
  };

  const handleClick = () => {
    if (state === 'ready' && onDownload) {
      onDownload();
    } else {
      onClick();
    }
  };

  const baseClass =
    'inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
  const variantClass =
    variant === 'fab'
      ? 'fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full px-0 shadow-lg'
      : '';
  const stateClass = styleMap[effectiveState];
  const disabledClass = effectiveState === 'generating' || disabled ? 'opacity-60' : '';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={effectiveState === 'generating' || disabled}
      aria-label={t('exportButton.ariaLabel')}
      title={tooltipMap[effectiveState]}
      data-state={effectiveState}
      data-variant={variant}
      className={`${baseClass} ${variantClass} ${stateClass} ${disabledClass}`.trim()}
    >
      {iconMap[effectiveState]}
      {labelMap[effectiveState]}
    </button>
  );
}

export default TableCardExportButton;
