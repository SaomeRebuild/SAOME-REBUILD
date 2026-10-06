/**
 * CardBuilderPage — "My Template Library" view.
 * Top-bottom layout:
 *   - Top: page title + "Build from Scratch" + "Public Templates" buttons
 *   - Bottom: multi-column template library grid
 *
 * Routing:
 *   - /app/dashboard/card-builder          → Library mode (no ?id=)
 *   - /app/dashboard/card-builder?id=...   → Editor mode (has ?id=)
 *
 * 2026-10-04 PR — Replaced the MOCK_TEMPLATES placeholder with a real
 * `cardService.list()` query so the TemplateLibraryGrid renders the
 * user's actually-saved templates (logoText, cardType, issuerName,
 * leftField, rightField, barcodeType, language, currency, etc.). Each
 * `TemplateDto.settings` is passed through to `TemplateCardPreview`,
 * which uses per-cardType + per-card-language i18n to render the
 * matching preview.
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TemplateLibraryGrid } from '@/components/business/dashboard/TemplateLibraryGrid';
import { CardBuilderEditor } from '@/components/business/dashboard/CardBuilderEditor';
import { ConfirmAbandonDraftDialog } from '@/components/ui/dialog/ConfirmAbandonDraftDialog';
import { cardService } from '@/services/cardService';
import { SaomeApiError } from '@/services/httpClient';
import { PlusCircle, LayoutGrid, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/feedback/Toast';
import type { TemplateDto } from '@saome/shared/schemas/card';
import type { TemplateCardData } from '@/components/business/dashboard/TemplateLibraryGrid';

export default function CardBuilderPage() {
  const { t } = useTranslation('cardBuilder');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  // Draft dialog state
  const [pendingDraft, setPendingDraft] = useState<TemplateDto | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // 2026-10-04 PR — Real data wiring.
  // Templates fetched from cardService.list(); status of the fetch is
  // tracked in `isLoadingTemplates` / `templatesError` so the UI can
  // show a spinner / error banner before the grid renders.
  const [templates, setTemplates] = useState<TemplateCardData[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  // While a single-card delete is in flight, we mark that id so the
  // TemplateCard can show a deleting state. Stored as a Set so multiple
  // deletes can run concurrently without conflict (unlikely in practice
  // but the data structure is cheap).
  const [deletingIds, setDeletingIds] = useState<ReadonlySet<string>>(new Set());
  // Per-card download state — mirrors `deletingIds`. Tracks which
  // template's table card download is in flight so the row can show
  // a disabled/spinner state.
  const [downloadingIds, setDownloadingIds] = useState<ReadonlySet<string>>(new Set());

  // Editor mode: 有 ?id= 就顯示 editor，否則顯示 library
  const isEditorMode = Boolean(searchParams.get('id'));

  /**
   * Format an unknown error as a human-readable detail string.
   * Pulled out as a helper because three different error paths (list,
   * delete, build) all want the same shape: "(<status> <code>) <message>"
   * for `SaomeApiError`, fallback to String(err) otherwise.
   */
  function formatErrorDetail(err: unknown): string {
    let detail = String(err);
    if (err instanceof SaomeApiError) {
      detail = `(${err.status} ${err.code}) ${err.message}`;
    }
    return detail;
  }

  /**
   * Fetch the tenant's templates from the API and map them into the
   * `TemplateCardData[]` shape the grid expects. The mapping is
   * minimal: id, name, cardType, settings (full passthrough) +
   * showPhoneFrame flag. The `TemplateCardPreview` reads the rest
   * (logoText, issuerName, leftField, rightField, barcodeType,
   * language, currency, etc.) directly from settings.
   *
   * 2026-10-04 PR — Replaces the MOCK_TEMPLATES array. Without
   * settings, the preview was falling back to placeholder values like
   * "未命名卡片" / "Template 1" / "左欄位" — this is the root-cause
   * fix for the regression observed in production screenshots.
   */
  const fetchTemplates = useCallback(async (): Promise<void> => {
    setIsLoadingTemplates(true);
    setTemplatesError(null);
    try {
      const dtos = await cardService.list();
      // Map TemplateDto → TemplateCardData. settings is a structural
      // match (both are TemplateSettings / zod-inferred equivalents)
      // but the DTO uses a loose Record<string, unknown> signature in
      // the shared zod schema, so we cast to TemplateSettings.
      const mapped: TemplateCardData[] = dtos.map((dto) => ({
        id: dto.id,
        name: dto.name,
        // Some legacy rows may have settings.cardType set but
        // top-level cardType unset. Prefer top-level; fall back to
        // settings to handle the migration window where the column
        // was added later than the JSONB blob.
        cardType: dto.cardType ?? (dto.settings?.cardType as TemplateCardData['cardType']),
        // settings is a structural match — both are TemplateSettings
        // shapes. The shared zod schema types settings as a loose
        // Record<string, unknown>; we re-cast to the strict
        // TemplateSettings inferred from the full templateSettingsSchema
        // (the grid is a consumer and trusts this shape).
        settings: (dto.settings ?? {}) as TemplateCardData['settings'],
        showPhoneFrame: true,
      }));
      setTemplates(mapped);
    } catch (err) {
      console.error('[CardBuilderPage] failed to load templates:', err);
      setTemplatesError(formatErrorDetail(err));
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  // Fetch templates when entering library mode. Skipped in editor mode
  // because the editor's own URL effect owns the data lifecycle.
  useEffect(() => {
    if (isEditorMode) {
      return;
    }
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      setIsLoadingTemplates(true);
      setTemplatesError(null);
      try {
        const dtos = await cardService.list();
        if (cancelled) return;
        const mapped: TemplateCardData[] = dtos.map((dto) => ({
          id: dto.id,
          name: dto.name,
          cardType: dto.cardType ?? (dto.settings?.cardType as TemplateCardData['cardType']),
          settings: (dto.settings ?? {}) as TemplateCardData['settings'],
          showPhoneFrame: true,
        }));
        setTemplates(mapped);
      } catch (err) {
        if (cancelled) return;
        console.error('[CardBuilderPage] failed to load templates:', err);
        setTemplatesError(formatErrorDetail(err));
      } finally {
        if (!cancelled) setIsLoadingTemplates(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditorMode]);

  /**
   * Handle "從頭建置" — check for existing draft, then proceed.
   * If a draft exists, show the confirm dialog.
   * Otherwise, create a new draft directly.
   */
  const handleBuildFromScratch = useCallback(async () => {
    setBuildError(null);
    setIsBuilding(true);
    try {
      const draft = await cardService.getLatestDraft();
      if (draft) {
        // Show dialog to let user choose resume or discard
        setPendingDraft(draft);
        setShowConfirmDialog(true);
      } else {
        // No draft — create a new one directly
        await createNewDraft();
      }
    } catch (err) {
      console.error('Failed to check drafts:', err);
      // Fall back to creating a new draft
      await createNewDraft();
    } finally {
      setIsBuilding(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Actually create a new draft and navigate to the editor.
   * UUID is created immediately and written to DB so that:
   * 1. Step 1 can store cardType against this ID
   * 2. Leaving and returning can resume via ?id=
   */
  async function createNewDraft() {
    const uuid = crypto.randomUUID();
    console.log('[createNewDraft] creating draft with id:', uuid);
    try {
      const template = await cardService.createDraft(uuid);
      console.log('[createNewDraft] draft created:', template);
      // After creating a new draft, refresh the library list so the
      // new template shows up the next time the user comes back.
      // (Skip the await — navigation is the primary action.)
      void fetchTemplates();
      window.location.href = `/app/dashboard/card-builder?id=${uuid}`;
    } catch (err) {
      console.error('[createNewDraft] FAILED to create draft:', err);
      setIsBuilding(false);
      setBuildError(t('toolbar.buildErrorDetail', { detail: formatErrorDetail(err) }));
    }
  }

  /**
   * Resume: navigate to the existing draft.
   * 用 navigate() 而非 pushState()，這樣會觸發 React Router re-render，
   * CardBuilderEditor 自己監聽的 useSearchParams 會即時讀到新的 ?id=。
   */
  function handleResumeDraft(draft: TemplateDto) {
    setShowConfirmDialog(false);
    setPendingDraft(null);
    navigate(`/app/dashboard/card-builder?id=${draft.id}`);
  }

  /**
   * Discard: delete the draft, then create a new one.
   */
  async function handleDiscardDraft(draft: TemplateDto) {
    setShowConfirmDialog(false);
    setPendingDraft(null);
    setIsBuilding(true);
    try {
      await cardService.abandon(draft.id);
      toast(t('toast.draftAbandoned'));
      await createNewDraft();
    } catch (err) {
      console.error('Failed to abandon draft:', err);
      setIsBuilding(false);
      setBuildError(t('toolbar.buildErrorDetail', { detail: formatErrorDetail(err) }));
    }
  }

  function handleBackToLibrary() {
    // Navigate to library mode (remove ?id= param)
    navigate('/app/dashboard/card-builder');
    // Re-fetch on back so newly-edited cards reflect the latest
    // settings (logoText, issuerName, etc.). The editor's PUT flow
    // updates DB; the next library render should show the changes.
    void fetchTemplates();
  }

  function handlePublicTemplates() {
    // TODO: Navigate to public templates gallery
    console.log('Public templates');
  }

  /**
   * Handle "Edit" — fetch existing template and load into editor.
   */
  function handleEdit(id: string) {
    window.location.href = `/app/dashboard/card-builder?id=${id}`;
  }

  /**
   * Handle "下載桌牌" (Download Table Card) — fetch the merged PNG
   * from R2 via `cardService.downloadTableCardBlob`, then trigger a
   * browser download via an in-memory `<a download>` click.
   *
   * Mirrors the canonical pattern from
   * `CardBuilderEditor/Step7TableCard/Step7TableCard.hooks.ts::handleDownload`
   * (the editor's "ready" button). `httpClient.getBlob` is used (not
   * `window.open`) so the Bearer token rides with the request —
   * `window.open` silently 401's in production because browser
   * navigation requests do not include the Authorization header.
   *
   * 404 from the backend means the user never pressed 「生成桌牌」 in
   * Step 7 — surface a localized hint instead of a generic network
   * error. Other errors get the standard `formatErrorDetail` formatting.
   */
  async function handleSend(id: string) {
    setDownloadingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      const blob = await cardService.downloadTableCardBlob(id);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = 'table-card.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revoke so the browser has a tick to start the download
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast(t('toast.tableCardDownloaded'));
    } catch (err) {
      console.error('[CardBuilderPage] failed to download table card:', err);
      const status =
        err instanceof SaomeApiError ? err.status : undefined;
      if (status === 404) {
        toast.error(t('toast.tableCardNotExported'));
      } else {
        toast.error(
          t('toast.downloadError', { detail: formatErrorDetail(err) }),
        );
      }
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  /**
   * Handle "Delete" — call cardService.delete(), show a toast, and
   * refetch the list so the remaining templates close the gap
   * (Step 8 plan: deletion of a middle template promotes later
   * templates forward; backend `findTemplatesByTenantId` already
   * orders by `created_at ASC` for natural array-position semantics).
   *
   * Per-card deleting state is tracked in `deletingIds` so the grid
   * can show a spinner / disabled state on the row being removed.
   */
  async function handleDelete(id: string) {
    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      await cardService.delete(id);
      toast(t('toast.templateDeleted'));
      // Refetch the list to reflect the deletion. Don't await — let
      // the user see the spinner on the row that just got removed.
      void fetchTemplates();
    } catch (err) {
      console.error('[CardBuilderPage] failed to delete template:', err);
      toast.error(t('toast.deleteError', { detail: formatErrorDetail(err) }));
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <>
      {/* Draft abandon confirm dialog */}
      <ConfirmAbandonDraftDialog
        draft={showConfirmDialog ? pendingDraft : null}
        onResume={handleResumeDraft}
        onDiscard={handleDiscardDraft}
        onCancel={() => {
          setShowConfirmDialog(false);
          setPendingDraft(null);
        }}
      />

      {/* 主要內容區 */}
      <div className="flex h-full w-full flex-col overflow-auto p-6 gap-6">
        {isEditorMode ? (
          <>
            {/* Editor mode: show CardBuilderEditor (它自己監聽 URL ?id=) */}
            <CardBuilderEditor onBack={handleBackToLibrary} />
          </>
        ) : (
          <>
            {/* Library mode: show page title + action buttons */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <h1
                className="text-2xl font-bold text-foreground"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {t('pageTitle')}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleBuildFromScratch}
                  disabled={isBuilding}
                  className="flex items-center gap-2 rounded-lg border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-transform duration-150 hover:scale-[1.02] hover:shadow-[var(--shadow-glow)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBuilding ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <PlusCircle size={16} aria-hidden="true" />
                  )}
                  {isBuilding ? t('toolbar.building') : t('toolbar.buildFromScratch')}
                </button>
                <button
                  type="button"
                  onClick={handlePublicTemplates}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-transform duration-150 hover:scale-[1.02] hover:border-primary hover:text-primary active:scale-[0.98]"
                >
                  <LayoutGrid size={16} aria-hidden="true" />
                  {t('toolbar.publicTemplates')}
                </button>
              </div>
            </div>

            {/* Error banner when build fails */}
            {buildError && (
              <div
                className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                <AlertCircle size={16} aria-hidden="true" />
                {buildError}
              </div>
            )}

            {/* 2026-10-04 PR — Library state machine: loading → error / empty / populated. */}
            {isLoadingTemplates ? (
              <div
                className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-muted-foreground"
                data-testid="template-library-loading"
              >
                <Loader2 size={32} className="animate-spin" aria-hidden="true" />
                <p className="text-sm">{t('templateLibrary.loading')}</p>
              </div>
            ) : templatesError ? (
              <div
                className="flex flex-1 flex-col items-center justify-center gap-3 py-12"
                data-testid="template-library-error"
              >
                <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle size={16} aria-hidden="true" />
                  {t('templateLibrary.loadError')} ({templatesError})
                </div>
                <button
                  type="button"
                  onClick={() => void fetchTemplates()}
                  className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-transform duration-150 hover:scale-[1.02] hover:border-primary hover:text-primary active:scale-[0.98]"
                >
                  <RefreshCw size={12} aria-hidden="true" />
                  {t('templateLibrary.retry')}
                </button>
              </div>
            ) : (
              /* Bottom: template library grid. passes deletingIds down so
                 the card can render a "deleting" state for the row being
                 removed (used by the conformance test for delete flow).
                 `downloadingIds` mirrors that pattern for the table-card
                 download — the card disables its 下載桌牌 button while
                 the in-flight Blob → object-URL → click flow runs. */
              <TemplateLibraryGrid
                templates={templates}
                onEdit={handleEdit}
                onSend={handleSend}
                onDelete={handleDelete}
                deletingIds={deletingIds}
                downloadingIds={downloadingIds}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
