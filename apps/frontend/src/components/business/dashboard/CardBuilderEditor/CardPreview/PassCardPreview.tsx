/**
 * PassCardPreview — 卡片本體預覽
 * Apple Pass 風格：白色背景、圓角、柔陰影（Dark mode 適配）
 */
import type { PassCardPreviewProps } from './PassCardPreview.types';
import { PassCardPreviewHeader } from './PassCardPreviewHeader';
import { PassCardPreviewBody } from './PassCardPreviewBody';
import { PassCardPreviewFooter } from './PassCardPreviewFooter';
import { PassCardPreviewBack } from './PassCardPreviewBack';
import { cn } from '@/lib/utils';
import { CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function PassCardPreview({
  name,
  cardType,
  issuerName,
  issuerLogo,
  backgroundColor,
  textColor,
  side = 'front',
  holderName,
  storeName,
  barcodeType,
  className,
  compact = false,
  ...props
}: PassCardPreviewProps) {
  const { t } = useTranslation('passCard');

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-[12px] border border-neutral-200 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.15)]',
        'dark:border-neutral-700 dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)]',
        className
      )}
      style={{ aspectRatio: '375 / 503' }}
      {...props}
    >
      {/* 卡片本體 — 固定白色背景，模擬實體 Pass */}
      <div className="relative flex h-full w-full flex-col bg-white">
        {side === 'back' ? (
          // ─── Back Side：完全清除正面殘留 UI ───
          <PassCardPreviewBack compact={compact} />
        ) : (
          // ─── Front Side ───
          <>
            <PassCardPreviewHeader
              cardType={cardType}
              issuerName={issuerName}
              issuerLogo={issuerLogo}
              name={name}
              compact={compact}
            />

            {/* Strip / Hero */}
            <div
              className={compact ? 'mx-0 mt-2 flex h-[100px] flex-col items-center justify-center gap-1 text-center' : 'mx-0 mt-4 flex h-[120px] flex-col items-center justify-center gap-2 text-center'}
              style={{ backgroundColor, color: textColor }}
            >
              <CreditCard className={compact ? 'h-6 w-6' : 'h-12 w-12'} style={{ color: textColor }} aria-hidden="true" />
              <span className="text-xs font-semibold leading-tight" style={{ color: textColor }}>
                {name || t('defaultName')}
              </span>
            </div>

            {/* Body */}
            <PassCardPreviewBody storeName={storeName} issuerName={issuerName} compact={compact} />

            {/* Footer / Barcode */}
            <PassCardPreviewFooter holderName={holderName} barcodeType={barcodeType} compact={compact} />
          </>
        )}
      </div>
    </div>
  );
}
