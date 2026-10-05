/**
 * TemplateCard — business component
 * Single layout: card preview in the middle, three action buttons stacked vertically on bottom.
 * Optionally wraps preview in a phone frame SVG.
 */
import type { TemplateCardProps } from './TemplateCard.types';
import { PencilLine, Send, Trash2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TemplateCardPreview } from './TemplateCardPreview';
import { PhoneFrame } from '@/components/ui/phone/PhoneFrame';

export function TemplateCard({
  id,
  name,
  backgroundColor = '#ffffff',
  textColor = '#000000',
  cardType,
  issuerName,
  issuerLogo,
  showPhoneFrame = true,
  settings,
  isDeleting = false,
  onEdit,
  onSend,
  onDelete,
}: TemplateCardProps) {
  const { t } = useTranslation('cardBuilder');

  return (
    <div className="flex flex-col overflow-hidden rounded-[12px] border border-border bg-card p-3">
      {/* Top: card preview */}
      <div className="relative flex w-full items-center justify-center overflow-hidden px-4 pt-6 pb-4">
        {showPhoneFrame ? (
          <PhoneFrame className="w-full max-w-[220px] shadow-sm">
            <TemplateCardPreview
              templateId={id}
              name={name}
              cardType={cardType}
              issuerName={issuerName}
              issuerLogo={issuerLogo}
              backgroundColor={backgroundColor}
              textColor={textColor}
              settings={settings}
            />
          </PhoneFrame>
        ) : (
          <TemplateCardPreview
            templateId={id}
            name={name}
            cardType={cardType}
            issuerName={issuerName}
            issuerLogo={issuerLogo}
            backgroundColor={backgroundColor}
            textColor={textColor}
            settings={settings}
          />
        )}
      </div>

      {/* Bottom: three buttons in a row */}
      <div className="mt-3 flex flex-row items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onEdit?.(id)}
          disabled={isDeleting}
          className="flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-on-primary transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <PencilLine size={12} aria-hidden="true" />
          {t('templateCard.edit')}
        </button>
        <button
          type="button"
          onClick={() => onSend?.(id)}
          disabled={isDeleting}
          className="flex items-center justify-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-card-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send size={12} aria-hidden="true" />
          {t('templateCard.send')}
        </button>
        <button
          type="button"
          onClick={() => onDelete?.(id)}
          disabled={isDeleting}
          data-testid={`template-card-delete-${id}`}
          className="flex items-center justify-center gap-1 rounded-md border border-destructive/60 bg-destructive/20 px-2 py-1 text-xs font-semibold text-destructive transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeleting ? (
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 size={12} aria-hidden="true" />
          )}
          {isDeleting ? t('templateCard.deleting') : t('templateCard.delete')}
        </button>
      </div>
    </div>
  );
}
