/**
 * Step8SaveSummary — Read-only summary panel for Step 8.
 *
 * Shows the user the values they configured in Steps 1-7 so they can
 * confirm before publishing. Pure render — no logic. Receives a
 * `summary` prop shaped per `Step8Save.types.ts::Step8SaveSummary`.
 *
 * The card-type label is rendered via the same `cardEditor.step1.cardTypes.*`
 * keys that the Step 1 CardTypeSelector uses (Rule 023 § 元件化原則:
 * reuse existing translation keys; do not duplicate card-type copy).
 */

import { useTranslation } from 'react-i18next';
import { Building2, CreditCard, MapPin, Tag, Type, User } from 'lucide-react';
import type { Step8SaveSummaryProps } from './Step8Save.types';

export function Step8SaveSummary({ summary }: Step8SaveSummaryProps) {
  const { t } = useTranslation('cardEditor');

  const cardTypeLabel = summary.cardType
    ? t(`step1.cardTypes.${summary.cardType}`)
    : t('preview.passTypeDefault');

  const rows = [
    {
      icon: <Type size={16} aria-hidden="true" />,
      label: t('step2.cardName.title'),
      value: summary.cardName.trim() || '—',
    },
    {
      icon: <Tag size={16} aria-hidden="true" />,
      label: t('preview.cardType'),
      value: cardTypeLabel,
    },
    {
      icon: <User size={16} aria-hidden="true" />,
      label: t('step2.issuerName.title'),
      value: summary.issuerName.trim() || '—',
    },
    {
      icon: <CreditCard size={16} aria-hidden="true" />,
      label: t('step2.barcode.title'),
      value:
        summary.barcodeType === 'pdf_417'
          ? t('step2.barcode.pdf417')
          : t('step2.barcode.qrCode'),
    },
    {
      icon: <Building2 size={16} aria-hidden="true" />,
      label: t('step3.iconSection.title'),
      value: summary.hasLogo ? '✓' : '—',
    },
    {
      icon: <MapPin size={16} aria-hidden="true" />,
      label: t('step5.locations.title'),
      value: summary.hasLocations ? '✓' : '—',
    },
  ];

  return (
    <div
      data-testid="step8-save-summary"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <p className="text-sm font-medium text-foreground">
        {t('steps.save.summary')}
      </p>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
          >
            <span className="text-muted-foreground">{row.icon}</span>
            <div className="flex min-w-0 flex-1 flex-col">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="truncate text-sm font-medium text-foreground">
                {row.value}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}