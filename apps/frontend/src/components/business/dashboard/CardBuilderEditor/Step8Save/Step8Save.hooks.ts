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
      toast.error(i18n.t('cardEditor:steps.save.publishError'));
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

  return {
    status,
    publish,
    goBack,
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