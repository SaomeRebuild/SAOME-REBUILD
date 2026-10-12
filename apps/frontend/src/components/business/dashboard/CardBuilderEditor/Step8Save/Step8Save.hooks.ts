/**
 * Step8Save — Hook layer.
 *
 * @module CardBuilderEditor/Step8Save/Step8Save.hooks
 * @description useStep8Save — owns the publish action lifecycle:
 *   1. Optimistic UI (status='saving')
 *   2. cardService.update(cardId, { status: 'published' })
 *   3. status='saved' → toast.success + navigate(Library, replace)
 *   4. on error: status='error' + toast.error (caller handles re-enable)
 *
 * v4 (2026-10-11, Passcreator push integration):
 *   - On `BadGatewayError` (upstream 'passcreator'), the hook now ALSO
 *     sets `passcreatorError` to a discriminated `PasscreatorSyncError`
 *     so the `Step8SaveErrorBanner` can render the full error detail.
 *     The hook's `status` still goes to `'error'` so the action button
 *     re-enables — same as for any other failure — but the banner
 *     gives the user a much more specific retry / dismiss surface.
 *   - For non-Passcreator errors (e.g. 500 INTERNAL_ERROR), the hook
 *     falls back to the generic `toast.error` flow with no banner.
 *
 * Why a separate hook (Rule 000 § A.3 — hook extraction strategy):
 *   - Publish action has a non-trivial lifecycle (optimistic UI + retry
 *     semantics + navigation) that doesn't belong in JSX.
 *   - Keeps `Step8Save/index.tsx` ≤ 100 lines (L2 main-file target).
 *
 * Why we don't push `status` into the Zustand store (Rule 023 § 業務邏輯):
 *   - `status` is a transient UI state — only Step 8 cares.
 *   - Pushing into the global store would leak Step 8 internals into every
 *     other consumer (Step 1-7 selectors, autosave effects, etc.).
 *   - A local `useState` in `useStep8Save` is the right scope.
 */

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/feedback/Toast';
import { cardService } from '@/services/cardService';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { ROLE_HOME_PATH, type Role } from '@saome/shared/constants/role';
import { useAuth } from '@/hooks/useAuth';
import i18n from '@/i18n';
import type { Step8SaveStatus } from './Step8Save.types';
import type { PasscreatorSyncError } from './Step8SaveErrorBanner';

interface UseStep8SaveReturn {
  /** Current status of the publish action. */
  status: Step8SaveStatus;
  /**
   * Trigger the publish flow:
   *   1. status → 'saving'
   *   2. PUT /api/cards/:id { status: 'published' }
   *   3. status → 'saved' + navigate(Library, { replace: true })
   *   4. on error: status → 'error' + toast.error (no navigation)
   *
   * The caller passes `validation.canPublish === false` guard at the
   * button level; calling this with `canPublish === false` is undefined
   * behavior (the API call will likely 400 because the template is
   * incomplete, but we don't pre-check here to keep the hook dumb).
   */
  publish: () => Promise<void>;
  /** Navigate back to Library without publishing. */
  goBack: () => void;
  /**
   * When the publish fails with a Passcreator-specific BadGatewayError
   * (502, upstream='passcreator'), the hook sets this so the
   * `Step8SaveErrorBanner` can render the full error detail. Null for
   * non-Passcreator errors (those use the generic toast).
   *
   * The `retry` action on the banner calls `publish()` again — same
   * state machine, just with `passcreatorError` cleared on the next
   * attempt.
   */
  passcreatorError: PasscreatorSyncError | null;
  /** Clear the banner without retrying (e.g. user clicks the X button). */
  dismissPasscreatorError: () => void;
}

/**
 * Publish the current draft + redirect to the Template Library.
 *
 * The hook owns the local status state machine (no global side effects).
 * Navigation uses `replace: true` to avoid leaving the user on a
 * "back to editor" history entry — per `001-methodology.mdc § Auth flow
 * 鐵律 #2`, post-action navigation must be replace-style so the user
 * cannot return to a half-completed publish state via browser back.
 */
export function useStep8Save(cardId: string | null): UseStep8SaveReturn {
  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const [status, setStatus] = useState<Step8SaveStatus>('idle');
  const [passcreatorError, setPasscreatorError] = useState<PasscreatorSyncError | null>(null);

  /**
   * Resolve Library route based on the user's role. Mirrors the
   * `ROLE_HOME_PATH[role]` pattern used in LoginPage.tsx / RegisterPage.tsx /
   * DashboardHeaderActions.tsx so the tenant + admin flows land on their
   * respective dashboards (not the SPA root).
   */
  const resolveLibraryPath = useCallback((): string => {
    const role = authState.user?.role as Role | undefined;
    if (role && role in ROLE_HOME_PATH) {
      return ROLE_HOME_PATH[role];
    }
    return '/app/dashboard';
  }, [authState.user?.role]);

  const publish = useCallback(async () => {
    if (!cardId) {
      // Caller bug — the button should be disabled when cardId is null.
      // We surface a defensive error rather than silently no-op so the
      // user can see why Publish didn't fire.
      console.error('[useStep8Save] publish called with null cardId');
      setStatus('error');
      // 2026-10-05 fix — `i18n.t()` resolves the i18n key synchronously
      // against the currently active language. Previously `toast.error`
      // was called with a raw key string ('cardEditor:steps.save....'),
      // which sonner rendered verbatim as the toast body — the user
      // saw "cardEditor:steps.save.publishError" instead of the
      // translated "發布失敗,請稍後再試". Hooks cannot use
      // `useTranslation` (which requires component context), so we use
      // the `i18n` instance's synchronous `t()` instead. Mirrors the
      // i18n.t() pattern used by TemplateCardPreview for per-card
      // language isolation (Rule 023 § per-card language).
      toast.error(i18n.t('cardEditor:steps.save.publishError'));
      return;
    }
    // Clear any prior Passcreator error so the banner disappears on
    // the next attempt (v4 plan: the banner should NOT linger between
    // retries — it re-appears only if the new attempt also fails).
    setPasscreatorError(null);
    setStatus('saving');
    try {
      await cardService.update(cardId, { status: 'published' });
      setStatus('saved');
      toast.success(i18n.t('cardEditor:steps.save.publishSuccess'));
      // replace: true — see Auth flow 鐵律 #2 (001-methodology.mdc).
      navigate(resolveLibraryPath(), { replace: true });
    } catch (err) {
      console.error('[useStep8Save] publish failed:', err);
      setStatus('error');
      // 2026-10-11 — Passcreator failure surface. The backend throws
      // BadGatewayError (HTTP 502, code='BAD_GATEWAY') when the
      // upstream rejects. We discriminate by `err.code` (the
      // contractual identifier) — NOT by message text — to avoid
      // drift between locales / message changes.
      const upstream = (err as { details?: { upstream?: string } } | null)?.details?.upstream;
      const upstreamStatus = (err as { details?: { upstreamStatus?: number } } | null)?.details?.upstreamStatus;
      const upstreamBody = (err as { details?: { upstreamBody?: string } } | null)?.details?.upstreamBody;
      if (
        (err as { code?: string } | null)?.code === 'BAD_GATEWAY' &&
        upstream === 'passcreator'
      ) {
        // 2026-10-11 — extract structured `upstreamErrors[]` from the
        // BadGatewayError envelope. The backend's passcreator.ts now
        // pulls these from Passcreator's V2 `{success:false, errors:[...]}`
        // envelope (see apps/backend/src/shared/lib/passcreator.ts and
        // passcreator.test.ts "V2 errors[] extraction"). The banner
        // renders one row per `{property, message}` instead of dumping
        // the full upstreamBody JSON. Defensive: only attach when the
        // array is non-empty (matches the backend's "non-empty attach"
        // convention).
        const rawUpstreamErrors = (err as { details?: { upstreamErrors?: Array<{ property: string; message: string }> } } | null)?.details?.upstreamErrors;
        const upstreamErrors = Array.isArray(rawUpstreamErrors) && rawUpstreamErrors.length > 0
          ? rawUpstreamErrors
          : undefined;
        // 2026-10-11 — extract `kind` discriminator. The backend sets
        // this in BadGatewayError.details to one of 'network' |
        // 'invalid_response' | 'upstream_rejected' based on the
        // failure path. The banner uses it to pick user-actionable
        // copy (e.g. "service temporarily unavailable" for 530/1016
        // vs "check your internet" for DNS failure vs "correct the
        // fields" for V2 envelope rejection). Falls back to
        // undefined for backward compat with older backend.
        const rawKind = (err as { details?: { kind?: string } } | null)?.details?.kind;
        const kind: PasscreatorSyncError['kind'] =
          rawKind === 'network' ||
          rawKind === 'invalid_response' ||
          rawKind === 'upstream_rejected'
            ? rawKind
            : undefined;
        setPasscreatorError({
          code: 'BAD_GATEWAY',
          upstream: 'passcreator',
          upstreamStatus,
          upstreamBody,
          upstreamErrors,
          kind,
        });
        // No toast — the banner IS the surface. Showing a toast would
        // be redundant noise.
      } else {
        toast.error(i18n.t('cardEditor:steps.save.publishError'));
      }
      // No navigation — caller (Step8SaveActions) keeps the user on
      // Step 8 with the button re-enabled so they can retry.
    }
  }, [cardId, navigate, resolveLibraryPath]);

  /**
   * Library-only navigation (no publish). User wants to leave Step 8
   * without publishing — preserve the draft for later resume.
   *
   * We do NOT clear the store here — the draft is still in DB and
   * the user can re-enter via Library → Edit. The next mount of
   * CardBuilderEditor will `loadSettings` again.
   */
  const goBack = useCallback(() => {
    navigate(resolveLibraryPath(), { replace: true });
  }, [navigate, resolveLibraryPath]);

  const dismissPasscreatorError = useCallback(() => {
    setPasscreatorError(null);
  }, []);

  return {
    status,
    publish,
    goBack,
    passcreatorError,
    dismissPasscreatorError,
  };
}

/**
 * Compute the Step 8 summary directly from the Zustand store. Mirrors
 * the workspace's `isStep1Valid()` + `isStep2Valid()` gates (the same
 * gate set that disabled "Next" on Step 1 / Step 2). Surfaced here so
 * `Step8SaveSummary` can render the current values without each summary
 * line reaching into the store individually.
 *
 * Returns the snapshot — caller is responsible for subscribing to the
 * store at the parent level so the component re-renders on changes.
 */
export function useStep8SaveSummary() {
  const cardName = useCardBuilderStore((s) => s.cardName);
  const cardType = useCardBuilderStore((s) => s.cardType);
  const issuerName = useCardBuilderStore((s) => s.issuerName);
  const barcodeType = useCardBuilderStore((s) => s.barcodeType);
  const issuerLogo = useCardBuilderStore((s) => s.issuerLogo);
  const locations = useCardBuilderStore((s) => s.locations);
  const isPaid = useCardBuilderStore((s) => s.isPaid);

  return {
    cardName,
    cardType,
    issuerName,
    barcodeType,
    hasLogo: Boolean(issuerLogo),
    hasLocations: locations.length > 0,
    isPaid,
  };
}

/**
 * Validation gate for the publish action. Mirrors the workspace's
 * isStep1Valid + isStep2Valid from CardBuilderEditorWorkspace.tsx —
 * both `cardType` (Step 1) and non-empty `cardName` (Step 2) are
 * required to advance past the publish action.
 */
export function useStep8SaveValidation() {
  const cardName = useCardBuilderStore((s) => s.cardName);
  const cardType = useCardBuilderStore((s) => s.cardType);
  const hasCardType = cardType !== null;
  const hasCardName = cardName.trim().length > 0;
  return {
    hasCardType,
    hasCardName,
    canPublish: hasCardType && hasCardName,
  };
}