/**
 * CardBuilderPage — "My Template Library" view.
 * Top-bottom layout:
 *   - Top: page title + "Build from Scratch" + "Public Templates" buttons
 *   - Bottom: multi-column template library grid
 *
 * Routing:
 *   - /app/dashboard/card-builder          → Library mode (no ?id=)
 *   - /app/dashboard/card-builder?id=...   → Editor mode (has ?id=)
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TemplateLibraryGrid } from '@/components/business/dashboard/TemplateLibraryGrid';
import { CardBuilderEditor } from '@/components/business/dashboard/CardBuilderEditor';
import { ConfirmAbandonDraftDialog } from '@/components/ui/dialog/ConfirmAbandonDraftDialog';
import { cardService } from '@/services/cardService';
import { PlusCircle, LayoutGrid, Loader2, AlertCircle } from 'lucide-react';
import { toast } from '@/components/ui/feedback/Toast';
import type { TemplateDto } from '@saome/shared/schemas/card';

// TODO: Replace with API call when backend is ready.
const MOCK_TEMPLATES = Array.from({ length: 10 }, (_, i) => ({
  id: `template-${i + 1}`,
  name: `Template ${i + 1}`,
}));

export default function CardBuilderPage() {
  const { t } = useTranslation('cardBuilder');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  // Draft dialog state
  const [pendingDraft, setPendingDraft] = useState<TemplateDto | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Editor mode: 有 ?id= 就顯示 editor，否則顯示 library
  const isEditorMode = Boolean(searchParams.get('id'));

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
      window.location.href = `/app/dashboard/card-builder?id=${uuid}`;
    } catch (err) {
      console.error('[createNewDraft] FAILED to create draft:', err);
      setIsBuilding(false);
      setBuildError(t('toolbar.buildErrorDetail', { detail: String(err) }));
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
      setBuildError(t('toolbar.buildErrorDetail', { detail: String(err) }));
    }
  }

  function handleBackToLibrary() {
    // Navigate to library mode (remove ?id= param)
    navigate('/app/dashboard/card-builder');
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

  function handleSend(id: string) {
    console.log('Send card:', id);
  }

  function handleDelete(id: string) {
    console.log('Delete template:', id);
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

            {/* Bottom: template library grid */}
            <TemplateLibraryGrid
              templates={MOCK_TEMPLATES}
              onEdit={handleEdit}
              onSend={handleSend}
              onDelete={handleDelete}
            />
          </>
        )}
      </div>
    </>
  );
}
