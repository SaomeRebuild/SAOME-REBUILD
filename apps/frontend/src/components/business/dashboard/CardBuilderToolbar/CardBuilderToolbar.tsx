import type { CardBuilderToolbarProps } from './CardBuilderToolbar.types';
import { useTranslation } from 'react-i18next';
import { PlusCircle, LayoutGrid } from 'lucide-react';

export function CardBuilderToolbar({
  onBuildFromScratch,
  onPublicTemplates,
}: CardBuilderToolbarProps) {
  const { t } = useTranslation('cardBuilder');

  return (
    <div className="flex w-48 flex-shrink-0 flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <button
        type="button"
        onClick={onBuildFromScratch}
        className="flex items-center gap-2 rounded-lg border border-primary bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-transform duration-150 hover:scale-[1.02] hover:shadow-[var(--shadow-glow)] active:scale-[0.98]"
      >
        <PlusCircle size={16} aria-hidden="true" />
        {t('toolbar.buildFromScratch')}
      </button>
      <button
        type="button"
        onClick={onPublicTemplates}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-transform duration-150 hover:scale-[1.02] hover:border-primary hover:text-primary active:scale-[0.98]"
      >
        <LayoutGrid size={16} aria-hidden="true" />
        {t('toolbar.publicTemplates')}
      </button>
    </div>
  );
}
