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

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { TemplateLibraryGrid } from '@/components/business/dashboard/TemplateLibraryGrid';
import { CardBuilderEditor } from '@/components/business/dashboard/CardBuilderEditor';
import { authService } from '@/services/authService';
import { cardService } from '@/services/cardService';
import { ROUTES } from '@/services/httpClient';
import { PlusCircle, LayoutGrid, Loader2, AlertCircle } from 'lucide-react';

// TODO: Replace with API call when backend is ready.
const MOCK_TEMPLATES = Array.from({ length: 10 }, (_, i) => ({
  id: `template-${i + 1}`,
  name: `Template ${i + 1}`,
}));

export default function CardBuilderPage() {
  const { t } = useTranslation('cardBuilder');
  const [searchParams] = useSearchParams();
  const [showEditor, setShowEditor] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Sync showEditor with URL ?id= param
  useEffect(() => {
    const id = searchParams.get('id');
    setShowEditor(Boolean(id));
  }, [searchParams]);

  // Get templateId from URL params
  const templateId = searchParams.get('id');

  // Block interaction until auth session is confirmed (prevents race condition
  // where we call POST /api/cards before AuthProvider's mount refresh completes).
  useEffect(() => {
    authService.refresh()
      .then(() => setAuthReady(true))
      .catch(() => setAuthReady(false));
  }, []);

  /**
   * Handle "從頭建置" — refresh session then create a draft template.
   * Shows "please re-login" if the session has expired.
   */
  const handleBuildFromScratch = useCallback(async () => {
    setBuildError(null);
    setIsBuilding(true);
    setAuthReady(false);
    try {
      // Ensure session is fresh before calling POST /api/cards
      await authService.refresh();
      const template = await cardService.create({
        cardType: 'stamp_card',
        name: '',
      });
      window.location.href = `/app/dashboard/card-builder?id=${template.id}`;
    } catch (err) {
      console.error('Failed to create template:', err);
      const isUnauthorized =
        err instanceof Error &&
        (err.message.includes('401') || err.message.includes('UNAUTHORIZED') || err.message.includes('Invalid or expired'));
      if (isUnauthorized) {
        // Expired session — redirect to login, returning here keeps the error visible
        window.location.href = ROUTES.login;
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setBuildError(t('toolbar.buildErrorDetail', { detail: msg }));
    } finally {
      setIsBuilding(false);
      setAuthReady(true);
    }
  }, [t]);

  function handleBackToLibrary() {
    // Navigate to library mode (remove ?id= param)
    window.location.href = '/app/dashboard/card-builder';
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
      {/* 主要內容區 */}
      <div className="flex h-full w-full flex-col overflow-auto p-6 gap-6">
        {showEditor ? (
          <>
            {/* Editor mode: show CardBuilderEditor with templateId from URL */}
            <CardBuilderEditor
              templateId={templateId}
              onBack={handleBackToLibrary}
            />
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
                  disabled={isBuilding || !authReady}
                  className="flex items-center gap-2 rounded-lg border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-transform duration-150 hover:scale-[1.02] hover:shadow-[var(--shadow-glow)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {!authReady ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : isBuilding ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <PlusCircle size={16} aria-hidden="true" />
                  )}
                  {!authReady ? t('toolbar.checkingAuth') : isBuilding ? t('toolbar.building') : t('toolbar.buildFromScratch')}
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
