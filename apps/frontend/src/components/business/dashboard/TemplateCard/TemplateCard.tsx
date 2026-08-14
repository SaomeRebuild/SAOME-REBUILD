/**
 * TemplateCard — business component
 * Single layout: image on left, three action buttons stacked vertically on right.
 */

import type { TemplateCardProps } from './TemplateCard.types';
import { PencilLine, Send, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PLACEHOLDER_IMAGE = '/pic/cards/stampCardLiviing-removebg-preview.png';

export function TemplateCard({
  id,
  name,
  imageUrl = PLACEHOLDER_IMAGE,
  onEdit,
  onSend,
  onDelete,
}: TemplateCardProps) {
  const { t } = useTranslation('cardBuilder');

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card p-3">
      {/* Top: card preview image */}
      <div className="h-80 w-64 flex-shrink-0 overflow-hidden rounded-lg bg-muted self-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={name ?? id}
          className="h-full w-full object-contain"
        />
      </div>

      {/* Bottom: three buttons in a row */}
      <div className="mt-3 flex flex-row items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onEdit?.(id)}
          className="flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-on-primary transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
        >
          <PencilLine size={12} aria-hidden="true" />
          {t('templateCard.edit')}
        </button>
        <button
          type="button"
          onClick={() => onSend?.(id)}
          className="flex items-center justify-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-card-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Send size={12} aria-hidden="true" />
          {t('templateCard.send')}
        </button>
        <button
          type="button"
          onClick={() => onDelete?.(id)}
          className="flex items-center justify-center gap-1 rounded-md border border-destructive/60 bg-destructive/20 px-2 py-1 text-xs font-semibold text-destructive transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Trash2 size={12} aria-hidden="true" />
          {t('templateCard.delete')}
        </button>
      </div>
    </div>
  );
}
