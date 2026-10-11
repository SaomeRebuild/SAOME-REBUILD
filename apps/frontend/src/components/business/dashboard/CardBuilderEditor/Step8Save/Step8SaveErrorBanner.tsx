/**
 * Step8SaveErrorBanner — Passcreator sync failure banner.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step8Save/Step8SaveErrorBanner
 * @description L2 sub-component that renders a dismissable error banner
 * when the Step 8 "Save & Publish" action fails at the Passcreator
 * upstream. Triggered when the backend `updateTemplateService` throws
 * `BadGatewayError` with `details.upstream === 'passcreator'`.
 *
 * Why a dedicated sub-component (vs. inlining in Step8SaveActions):
 *   - The banner needs the upstream detail payload (e.g. status code,
 *     truncated body) which doesn't fit into a one-line toast.
 *   - It needs a "Retry" CTA (different from the "Publish" button) and
 *     a "Dismiss" CTA — duplicating that into Step8SaveActions would
 *     bloat the action panel.
 *   - The "Retry" button calls the SAME `onPublish` handler — same
 *     validation gate, same state machine — so it shares the hook
 *     (`useStep8Save`) with the primary publish button. No duplicate
 *     `cardService.update` call.
 *
 * Why we discriminate by `error.code === 'BAD_GATEWAY'` (not status === 502):
 *   - The backend `BadGatewayError` ALWAYS uses code `BAD_GATEWAY` and
 *     status 502. Code is the contractual identifier (logged + surfaced
 *     to client); status is the HTTP code. The frontend should branch
 *     on the contract.
 *
 * L2 structure: Step8SaveErrorBanner is rendered as a sibling to
 * Step8SaveActions in the parent `Step8Save` component. The banner
 * appears ONLY when the `error` prop is non-null. The Step8Save
 * container owns the error state (it can come from the publish hook's
 * catch block, or be passed in via the page-level error boundary).
 *
 * Rule references:
 *   - Rule 000 § A.2 — sub-component ≤ 100 lines, pure render.
 *   - Rule 019 § D.3 — third-party (Passcreator) error envelope is a
 *     contract. We branch on `code` not the message.
 */

import { useTranslation } from 'react-i18next';
import { AlertTriangle, X, RotateCw } from 'lucide-react';

export interface Step8SaveErrorBannerProps {
  /**
   * The Passcreator sync error to display. When `null`, the banner is
   * not rendered (parent should conditionally render). When set, the
   * banner surfaces the upstream's status + truncated body to the
   * user so they can debug without a wrangler tail.
   */
  error: PasscreatorSyncError | null;
  /** Re-trigger the publish action. Provided by `useStep8Save.publish`. */
  onRetry: () => void;
  /** Dismiss the banner without re-trying. Allows user to navigate away. */
  onDismiss: () => void;
}

/**
 * Shape of a Passcreator sync error — a discriminated subset of the
 * backend's `BadGatewayError` envelope that the frontend cares about.
 *
 * We define a local interface (not import the backend type) because:
 *   1. The backend `SaomeError` is in the Worker bundle, not the
 *      frontend bundle — cross-package import would pull in
 *      `postgres`/`hono` deps.
 *   2. The frontend only needs 3 fields (`upstream`, `upstreamStatus`,
 *      `upstreamBody`) — using a narrow type pins the contract to
 *      exactly what the banner reads (no over-coupling).
 */
export interface PasscreatorSyncError {
  code: 'BAD_GATEWAY';
  upstream: 'passcreator';
  upstreamStatus?: number;
  upstreamBody?: string;
}

/**
 * The banner — a red-tinted card with the upstream error info and two
 * CTAs. Hidden when `error` is null.
 */
export function Step8SaveErrorBanner({
  error,
  onRetry,
  onDismiss,
}: Step8SaveErrorBannerProps) {
  const { t } = useTranslation('cardEditor');

  if (!error) return null;

  // Truncate the upstream body to ≤ 240 chars to keep the banner
  // compact. The full body (≤ 500 chars per BadGatewayError) is in
  // the error envelope if a future debugger wants to inspect.
  const detailSnippet =
    error.upstreamBody && error.upstreamBody.length > 240
      ? `${error.upstreamBody.slice(0, 240)}…`
      : (error.upstreamBody ?? '');

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="step8-error-banner"
      className="
        flex flex-col gap-3 rounded-lg border p-4
        border-[var(--color-destructive)] bg-[var(--color-destructive)]/5
        text-foreground
      "
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          size={18}
          className="mt-0.5 shrink-0 text-[var(--color-destructive)]"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {t('steps.save.passcreatorSyncFailed.title')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('steps.save.passcreatorSyncFailed.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('steps.save.passcreatorSyncFailed.cancel')}
          data-testid="step8-error-dismiss"
          className="
            shrink-0 rounded-md p-1 text-muted-foreground
            transition-colors duration-150
            hover:bg-muted hover:text-foreground
            focus:outline-none focus:ring-2 focus:ring-offset-1
            focus:ring-[var(--color-destructive)]
          "
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {detailSnippet && (
        <details className="rounded-md border border-border bg-card p-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            {t('steps.save.passcreatorSyncFailed.upstreamDetail')}
            {error.upstreamStatus !== undefined && (
              <span className="ml-1 font-mono text-foreground">
                · HTTP {error.upstreamStatus}
              </span>
            )}
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">
            {detailSnippet}
          </pre>
        </details>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onRetry();
          }}
          data-testid="step8-error-retry"
          className="
            flex items-center gap-1.5 rounded-md bg-[var(--color-destructive)]
            px-3 py-1.5 text-xs font-semibold text-white
            transition-all duration-150
            hover:scale-[1.02] active:scale-[0.98]
            focus:outline-none focus:ring-2 focus:ring-offset-1
            focus:ring-[var(--color-destructive)]
          "
        >
          <RotateCw size={14} aria-hidden="true" />
          {t('steps.save.passcreatorSyncFailed.retry')}
        </button>
      </div>
    </div>
  );
}
