/**
 * Step7TableCard — hooks.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCard.hooks
 * @description React hooks specific to Step 7. Currently just
 * `useTableCardExport` — orchestrates the 5-state machine + PUT flow.
 */

import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type Konva from 'konva';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { cardService } from '@/services/cardService';
import { getAccessToken } from '@/services/authStore';
import { rasterizeTableCard } from './Step7TableCard.export.web';
import {
  PREVIEW_WIDTH_PX,
  PREVIEW_HEIGHT_PX,
} from '@saome/shared/constants/table-card';
import type { ExportState } from './Step7TableCard.types';

interface UseTableCardExportArgs {
  templateId: string | null;
  stageRef: React.RefObject<Konva.Stage | null>;
  onSuccess?: (exportKey: string) => void;
  onError?: (errorMessage: string) => void;
}

interface UseTableCardExportResult {
  state: ExportState;
  handleExport: () => Promise<void>;
  handleDownload: () => void;
}

/**
 * Manage the 5-state export machine (idle/generating/ready/stale/error)
 * and orchestrate the rasterize → POST → confirm flow.
 */
export function useTableCardExport({
  templateId,
  stageRef,
  onSuccess,
  onError,
}: UseTableCardExportArgs): UseTableCardExportResult {
  const { t } = useTranslation('tableCard');
  // tableCard is read fresh inside handleExport via getState() so we
  // intentionally avoid subscribing to it here — this hook only needs
  // to re-render when the export state machine flips.
  const exportState = useCardBuilderStore((s) => s.tableCardExportState);
  const setExportState = useCardBuilderStore((s) => s.setTableCardExportState);
  const setExport = useCardBuilderStore((s) => s.setTableCardExport);

  // Guard against double-clicks / overlapping requests.
  const inFlightRef = useRef(false);

  const handleExport = useCallback(async () => {
    if (!templateId) {
      setExportState('error', t('errors.serverError'));
      onError?.(t('errors.serverError'));
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    // Fix 1d (Round 2 diagnostic, 2026-09-27): confirm a Bearer token is
    // actually available before the POST goes out. If this prints `false`
    // in console, the GENERATE button's 401 has the same root cause as
    // the DOWNLOAD button — token gone, not a wrong code path.
    if (import.meta.env.DEV) {
      console.debug('[useTableCardExport] token present:', !!getAccessToken());
    }

    setExportState('generating');

    try {
      const stage = stageRef.current;
      if (!stage) {
        throw new Error('Konva stage not mounted');
      }
      // Round 3 Fix 2 — temporarily reset the Stage to print-time
      // nominal A4 dimensions before rasterizing. The mobile-side
      // `ResizeObserver` in `Step7TableCardCanvas.web.tsx` sets
      // `scaleX/scaleY` < 1 to fit small viewports; without this
      // reset, `stage.toDataURL({ width: 2551, height: 3579 })`
      // applies the current scale and the rendered output collapses
      // into the top-left ~11% of the export canvas (since
      // 595 × 0.5 = 297.5 px out of 2551 px width).
      //
      // Save → reset → rasterize → restore is the standard Konva
      // pattern for exporting from a scaled view.
      const saved = {
        width: stage.width(),
        height: stage.height(),
        scaleX: stage.scaleX(),
        scaleY: stage.scaleY(),
      };
      stage.width(PREVIEW_WIDTH_PX);
      stage.height(PREVIEW_HEIGHT_PX);
      stage.scaleX(1);
      stage.scaleY(1);
      stage.batchDraw();

      try {
        const blob = await rasterizeTableCard({ stage });
        const result = await cardService.exportTableCard(templateId, blob);
        setExport(result.exportKey, result.lastExportedAt);
        onSuccess?.(result.exportKey);
      } finally {
        // Restore the user's current view regardless of rasterize
        // outcome — a thrown export error must not leave the canvas
        // stuck at print dimensions.
        stage.width(saved.width);
        stage.height(saved.height);
        stage.scaleX(saved.scaleX);
        stage.scaleY(saved.scaleY);
        stage.batchDraw();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[useTableCardExport] export failed:', err);
      setExportState('error', t('errors.networkError'));
      onError?.(message);
    } finally {
      inFlightRef.current = false;
    }
  }, [templateId, stageRef, setExportState, setExport, onSuccess, onError, t]);

  const handleDownload = useCallback(async () => {
    if (!templateId) return;
    try {
      // Fix 1b (Round 2): route through httpClient.getBlob so the
      // Bearer token is sent with the request. The previous `window.open`
      // approach silently 401'd because browser navigation requests do
      // not include the `Authorization` header.
      const blob = await cardService.downloadTableCardBlob(templateId);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = 'table-card.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after a short delay so the browser has time to start the
      // download before the blob URL is invalidated.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      console.error('[useTableCardExport] download failed:', err);
      setExportState('error', t('errors.networkError'));
    }
  }, [templateId, setExportState, t]);

  return {
    state: exportState,
    handleExport,
    handleDownload,
  };
}
