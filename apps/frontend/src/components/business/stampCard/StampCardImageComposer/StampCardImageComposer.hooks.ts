/**
 * `useStampCardImageComposer` — hook driving the pre-render + upload state machine.
 *
 * The state machine lives in the hook (per Rule 000 § A.3: business
 * orchestration in `.hooks.ts`, JSX in `.tsx`). The component is a
 * thin trigger + status display.
 *
 * State transitions:
 *
 *   idle ─[composeAndSave]→ composing ─[ok]→ uploading ─[ok]→ saved
 *                                ↘ error (any failure)
 *   error ─[composeAndSave]→ composing (retry)
 *   saved ─[composeAndSave]→ composing (overwrite the same key)
 *
 * The hook also enforces the "no template, no save" guard: if the
 * caller passes a falsy `templateId`, the hook transitions directly
 * to `error` with a clear message instead of attempting a fetch to
 * `/api/templates//stamp-images/0`.
 */

import { useCallback, useState } from 'react';
import { composeStampCardImage } from './composeStampCardImage';
import {
  uploadStampCardImage,
  UploadStampCardImageError,
} from './uploadStampCardImage';
import type {
  StampCardComposerStatus,
  StampCardComposerSaveResult,
} from './StampCardImageComposer.types';
import type { StampCardImageInput } from '@saome/shared/schemas/stampCard';

export interface UseStampCardImageComposerOptions {
  /** Template UUID. Required for the upload to land in the right R2 path. */
  templateId: string | null;
  /** Auth token (Bearer). */
  authToken: string | null;
  /**
   * The composer input. The hook forwards this to `composeStampCardImage`.
   * The caller is responsible for keeping `fillCount` in `[0, STAMP_FILL_CAP]`
   * and for picking the `background` / `iconId` / colors / grid.
   */
  input: StampCardImageInput;
}

export interface UseStampCardImageComposerReturn {
  status: StampCardComposerStatus;
  /** Last successful save (set when status === 'saved'). */
  result: StampCardComposerSaveResult | null;
  /** Last error message (set when status === 'error'). */
  error: string | null;
  /** Trigger the compose + upload flow. */
  composeAndSave: () => Promise<void>;
  /** Manually reset to `idle` (e.g. when the user changes template). */
  reset: () => void;
}

export function useStampCardImageComposer(
  options: UseStampCardImageComposerOptions,
): UseStampCardImageComposerReturn {
  const { templateId, authToken, input } = options;
  const [status, setStatus] = useState<StampCardComposerStatus>('idle');
  const [result, setResult] = useState<StampCardComposerSaveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  const composeAndSave = useCallback(async () => {
    if (!templateId) {
      setStatus('error');
      setError('no_template_id');
      return;
    }
    if (!authToken) {
      setStatus('error');
      setError('no_auth_token');
      return;
    }
    setStatus('composing');
    setError(null);
    try {
      const blob = await composeStampCardImage(input);
      setStatus('uploading');
      const res = await uploadStampCardImage(templateId, input.fillCount, blob, authToken);
      setResult({
        r2Key: res.r2Key,
        byteHash: res.byteHash,
        byteLength: res.byteLength,
      });
      setStatus('saved');
    } catch (err) {
      setStatus('error');
      setError(
        err instanceof UploadStampCardImageError
          ? `upload_failed_${err.status}`
          : err instanceof Error
            ? `compose_failed_${err.message}`
            : 'unknown_error',
      );
    }
  }, [authToken, input, templateId]);

  return { status, result, error, composeAndSave, reset };
}
