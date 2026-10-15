/**
 * Step8Save — Hook layer.
 *
 * @module CardBuilderEditor/Step8Save/Step8Save.hooks
 * @description useStep8Save — owns the publish action lifecycle.
 *
 *  v4 (2026-10-11, Passcreator push integration):
 *    On `BadGatewayError` (upstream 'passcreator'), the hook sets
 *    `passcreatorError` so the `Step8SaveErrorBanner` can render the
 *    full error detail. The hook's `status` still goes to `'error'`
 *    so the action button re-enables.
 *
 *  v5 (2026-10-14, Option B stamp_card pre-render):
 *    For `cardType === 'stamp_card'`, the publish flow now performs
 *    an extra compose + upload of the empty 0.png BEFORE the legacy
 *    `cardService.update({ status: 'published' })` call. The pre-render
 *    is owned by `StampCardImageComposer` (Phase 2, 2026-10-13); the
 *    publish hook just orchestrates the call. See
 *    `runs/decisions/2026-10-14-stamp-card-publish-composition.md` for
 *    the design rationale (mobile slow-network cost is acknowledged).
 *
 *    Failure semantics: if compose OR upload fails, the entire publish
 *    is blocked. A 0.png-less `published` template would have a missing
 *    customer-facing preview, so we fail loud (Decision § 設計約束 #2)
 *    and let the user retry from Step 8.
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
import { composeStampCardImage } from '@/components/business/stampCard/StampCardImageComposer/composeStampCardImage';
import {
  uploadStampCardImage,
  UploadStampCardImageError,
} from '@/components/business/stampCard/StampCardImageComposer/uploadStampCardImage';
import type { StampCardImageInput } from '@saome/shared/schemas/stampCard';
import type { Step8SaveStatus } from './Step8Save.types';
import type { PasscreatorSyncError } from './Step8SaveErrorBanner';

/**
 * Default column count for the stamp grid. The design is locked to 5
 * columns per row (see `shared/schemas/stampCard.ts` § `cols` and the
 * `calculateCellSize` formula in `StampGridPreview.utils.ts` which
 * hard-codes 5 columns). Only `rows` is user-customizable; `cols` is
 * design-pinned. Exposed here (and in the schema's max=5) so a future
 * design pivot to 4/6 columns is a one-line change.
 */
const STAMP_DESIGN_COLS = 5;

function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? '';
}

/**
 * Resolve `state.backgroundImage` (which is the R2 key, e.g.
 * `tenants/.../templates/.../background.png`) to a public proxy URL
 * the composer can `fetch()` successfully.
 *
 * 2026-10-15 (v15) — Issue 2 root cause + fix.
 *
 * The store holds the R2 key as `backgroundImage` (see
 * `MediaAssetUploader.tsx::setStoreField(key)`), not a pre-signed URL.
 * The composer at `composeStampCardImage.web.ts::loadImageBitmap`
 * does `fetch(input.background.url)`. If `url` is the raw R2 key,
 * the browser treats it as a relative path against the current origin
 * and 404s — the canvas then falls back to a solid white background
 * (no grid stamp visible against the tenant's image).
 *
 * The backend already exposes a public, no-auth R2 proxy at
 * `${apiBaseUrl()}/api/pass-templates/${templateId}/background`
 * (the same route Passcreator consumes). Using that URL:
 *   1. `fetch()` works in both dev (Vite proxy same-origin) and prod
 *      (cross-origin with CORS via the standard chain).
 *   2. No expiry (the route is public + immutable cache).
 *   3. Audit + tenant isolation happen on the server side, so we
 *      don't need to thread a token into the composer.
 *
 * The function returns `null` when there's no uploaded background
 * (`state.backgroundImage` falsy). The caller should fall through to
 * the existing color-only path.
 *
 * @param r2Key              The R2 key stored on `state.backgroundImage`
 *                           (`tenants/.../templates/.../background.png`).
 *                           Falsy → return null (color-only fallback).
 * @param templateId         Template UUID for the public proxy path.
 * @param backgroundImageVersion  Monotonic ms timestamp bumped by
 *                           `setBackgroundImage` on every upload
 *                           (see `CardBuilderEditor.store.ts`). Used as
 *                           a cache-bust query param so the browser
 *                           refetches when the user re-uploads the
 *                           background image (same R2 key gets
 *                           overwritten; without a cache-bust the
 *                           immutable public-proxy response from
 *                           `Cache-Control: max-age=31536000, immutable`
 *                           would serve stale bytes).
 *
 * 2026-10-15 (v17) — Cache-bust fix.
 *
 * User-reported: 換背景圖 → Step 8 publish 後,R2 o.png 背景仍是舊的;
 * 換 grid 格數 → 只有 grids 變,背景仍是舊的。Passcreator 模板的 strip
 * image 也持續顯示「好幾版之前的圖」。
 *
 * Root cause: `getTemplateImage.ts` 回的 `Cache-Control:
 * public, max-age=31536000, immutable`,URL 是 `${cardId}/background`
 * (跟 R2 key 對應但沒有 query string)。換背景時 R2 是同 key 覆寫,所以
 * URL 不變 → 瀏覽器 cache hit → composer 拿舊 bytes 畫 0.png
 * (grid 是新但背景是舊)。
 *
 * `CardBuilderEditorPreview.tsx` 那邊 preview 用 `?v=${backgroundImageVersion}`
 * 已經能繞過 cache,但 composer 之前的 URL 沒帶版本 → 拿到 stale bytes。
 *
 * 修法:加 `?v=${backgroundImageVersion}` query string。`backgroundImageVersion`
 * 在 `setBackgroundImage` 內 bump(`Date.now()`),所以每次上傳新背景
 * URL 都會帶不同 token → browser cache invalid → composer 拿到
 * R2 上的最新 bytes → 0.png 真的有新背景。
 *
 * 注意:`backgroundImageVersion` 是 number,`Date.now()` 回 ms timestamp。
 * 直接接在 query 上 OK;fastify/Hono 不會管 query 是什麼。
 */
function resolveBackgroundImageUrl(
  r2Key: string | undefined,
  templateId: string,
  backgroundImageVersion: number,
): string | null {
  if (!r2Key) return null;
  // versioned query param invalidates the browser's "immutable, max-age=1y"
  // cache from prior renders. Empty/falsy version → still append for
  // uniformity so test snapshots match the same shape every time.
  const v = typeof backgroundImageVersion === 'number' && backgroundImageVersion > 0
    ? backgroundImageVersion
    : 0;
  return `${apiBaseUrl()}/api/pass-templates/${templateId}/background?v=${v}`;
}

/**
 * Build the `StampCardImageInput` for the empty 0.png pre-render at
 * publish time. Reads the current draft from the Zustand store.
 *
 * `fillCount` is hard-coded to 0 — this is the **empty** stamp card
 * (the customer-facing preview shown before any stamp is earned).
 * `1.png`–`15.png` are out of scope here; the Scanner fills those
 * incrementally (Plan Phase 3, deferred).
 *
 * `iconId` falls back to a placeholder string when the user has not
 * picked an icon yet. The `composeStampCardImage.web.ts` binding
 * calls `getStampIcon(input.iconId)` which itself falls back to the
 * first available icon (defensive — see `assets/icons/stamps/manifest.ts`),
 * so an empty string still produces a valid render.
 *
 * `background` is `image` when `backgroundImage` is set (resolved via
 * the public proxy URL — see `resolveBackgroundImageUrl`), otherwise
 * `color` (matching the Step 3 selector behavior).
 */
function buildZeroFillStampInput(
  state: ReturnType<typeof useCardBuilderStore.getState>,
  templateId: string,
): StampCardImageInput {
  // v17 (2026-10-15) — pass `state.backgroundImageVersion` as cache-bust
  // token to invalidate the browser's immutable-cache on the public
  // background proxy. Without this, every Publish re-paints with stale
  // background bytes (R2 key unchanged across re-uploads → URL unchanged
  // → browser cache hit). See `resolveBackgroundImageUrl` for the
  // full root-cause trace.
  const backgroundUrl = resolveBackgroundImageUrl(
    state.backgroundImage,
    templateId,
    state.backgroundImageVersion,
  );
  return {
    rows: state.stampGridRows,
    cols: STAMP_DESIGN_COLS,
    gridColor: 'transparent',
    iconId: state.stampIconId || 'bell',
    iconColor: state.textColor,
    background: backgroundUrl
      ? { type: 'image', url: backgroundUrl }
      : { type: 'color', value: state.backgroundColor },
    fillCount: 0,
  };
}

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

    // ─── Option B Phase: stamp_card / multipass 0.png pre-render ─────
    // For `cardType === 'stamp_card' || cardType === 'multipass'`,
    // compose + upload the empty 0.png BEFORE the legacy
    // `cardService.update`. A failure here blocks the entire publish
    // (Decision 2026-10-14 § 設計約束 #2, extended 2026-10-15 for
    // multipass per user direction that "Stamp and Multipass are
    // the only two card types that use the generated image as
    // background"). Other card types (membership / cashback / etc.)
    // skip this block and fall through to the legacy path.
    //
    // Why stamp + multipass: both cardTypes declare a composed
    // grid-based background image in Passcreator's `images.background`
    // slot. Other cardTypes use the tenant-uploaded
    // `settings.backgroundImage` instead. The push dispatcher
    // (backend `passTemplateMapping.ts::images` v15) consumes this
    // uploaded 0.png accordingly.
    const cardType = useCardBuilderStore.getState().cardType;
    const isStampish = cardType === 'stamp_card' || cardType === 'multipass';
    if (isStampish) {
      const accessToken = authState.accessToken;
      if (!accessToken) {
        console.error(`[useStep8Save] publish: ${cardType} but accessToken is null`);
        setStatus('error');
        toast.error(i18n.t('cardEditor:steps.save.publishError'));
        return;
      }
      try {
        setStatus('composing-stamp-zero');
        const input = buildZeroFillStampInput(useCardBuilderStore.getState(), cardId);
        const blob = await composeStampCardImage(input);
        setStatus('uploading-stamp-zero');
        await uploadStampCardImage(cardId, 0, blob, accessToken);
      } catch (err) {
        console.error('[useStep8Save] 0.png pre-render failed:', err);
        setStatus('error');
        // Distinguish upload failures (network / 4xx / 5xx) from
        // compose failures (OffscreenCanvas allocation, manifest
        // lookup). The toast message is generic either way; the
        // discriminator matters for future telemetry.
        if (err instanceof UploadStampCardImageError) {
          toast.error(i18n.t('cardEditor:steps.save.publishError'));
        } else {
          toast.error(i18n.t('cardEditor:steps.save.publishError'));
        }
        return; // CRITICAL: do NOT proceed to cardService.update.
      }
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
  }, [cardId, navigate, resolveLibraryPath, authState.accessToken]);

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