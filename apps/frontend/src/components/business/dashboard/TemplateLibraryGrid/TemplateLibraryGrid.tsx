/**
 * TemplateLibraryGrid — business component
 * Displays a responsive multi-column grid of template cards.
 * Each card: image on left, three action buttons stacked vertically on right.
 * Desktop: 3 columns | Tablet: 2 columns | Mobile: 1 column
 */

import type { TemplateLibraryGridProps } from './TemplateLibraryGrid.types';
import { TemplateCard } from '../TemplateCard';
import { useTranslation } from 'react-i18next';
import { FileX2 } from 'lucide-react';

export function TemplateLibraryGrid({
  templates = [],
  onEdit,
  onSend,
  onDelete,
}: TemplateLibraryGridProps) {
  const { t } = useTranslation('cardBuilder');

  return (
    <div className="flex flex-1 flex-col gap-4">
      {templates.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
          <FileX2 size={48} aria-hidden="true" />
          <p className="text-sm">{t('templateLibrary.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              id={template.id}
              name={template.name}
              backgroundColor={template.backgroundColor}
              textColor={template.textColor}
              cardType={template.cardType}
              issuerName={template.issuerName}
              issuerLogo={template.issuerLogo}
              showPhoneFrame={template.showPhoneFrame}
              onEdit={onEdit}
              onSend={onSend}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
