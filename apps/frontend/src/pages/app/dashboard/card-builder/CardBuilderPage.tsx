/**
 * CardBuilderPage — "My Template Library" view.
 * Top-bottom layout:
 *   - Top: page title + "Build from Scratch" + "Public Templates" buttons
 *   - Bottom: multi-column template library grid
 *
 * When user clicks "從頭建置", shows CardBuilderEditor instead.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TemplateLibraryGrid } from '@/components/business/dashboard/TemplateLibraryGrid';
import { CardBuilderEditor } from '@/components/business/dashboard/CardBuilderEditor';
import { PlusCircle, LayoutGrid } from 'lucide-react';

// TODO: Replace with API call when backend is ready.
const MOCK_TEMPLATES = Array.from({ length: 10 }, (_, i) => ({
  id: `template-${i + 1}`,
  name: `Template ${i + 1}`,
}));

export default function CardBuilderPage() {
  const { t } = useTranslation('cardBuilder');
  const [showEditor, setShowEditor] = useState(false);

  function handleBuildFromScratch() {
    setShowEditor(true);
  }

  function handleBackToLibrary() {
    setShowEditor(false);
  }

  function handlePublicTemplates() {
    // TODO: Navigate to public templates gallery
    console.log('Public templates');
  }

  function handleEdit(id: string) {
    console.log('Edit template:', id);
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
            {/* Editor mode: show CardBuilderEditor */}
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
                  className="flex items-center gap-2 rounded-lg border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-transform duration-150 hover:scale-[1.02] hover:shadow-[var(--shadow-glow)] active:scale-[0.98]"
                >
                  <PlusCircle size={16} aria-hidden="true" />
                  {t('toolbar.buildFromScratch')}
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
