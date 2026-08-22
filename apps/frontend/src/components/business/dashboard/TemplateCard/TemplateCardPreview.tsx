/**
 * TemplateCardPreview — 模板庫專用卡片預覽
 * 針對小尺寸視圖優化，不影響 CardBuilderEditor 的預覽
 * Layout 與 PassCardPreview 一致，僅調整尺寸
 */
import { Barcode, Building2, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/config/api';
import { getAccessToken } from '@/services/authStore';

const DEMO_BARCODE_VALUE = '4938591027384';

interface TemplateCardPreviewProps {
  templateId?: string;
  name?: string;
  cardType?: string | null;
  issuerName?: string;
  issuerLogo?: string;
  backgroundColor?: string;
  textColor?: string;
}

/**
 * 模板庫專用預覽：固定 compact 尺寸，針對 PhoneFrame (154px) 優化
 * Layout 與 PassCardPreview 一致，pt-[42px] 對齊 notch 高度（約 1.5 行字）
 */
export function TemplateCardPreview({
  templateId,
  name,
  cardType,
  issuerName,
  issuerLogo,
  backgroundColor = '#1a1a1a',
  textColor = '#ffffff',
}: TemplateCardPreviewProps) {
  const { t } = useTranslation('passCard');

  // Build proxy URL: avoids relying on Windows DNS resolving saome-assets.pages.dev
  const token = getAccessToken();
  const logoUrl = issuerLogo && templateId
    ? `${api.baseUrl}${api.paths.cardImage(templateId, 'logo')}${token ? `?token=${encodeURIComponent(token)}` : ''}`
    : undefined;

  return (
    <div className="relative flex w-full overflow-hidden rounded-[12px] border border-neutral-200 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.15)]" style={{ aspectRatio: '375 / 503' }}>
      {/* 卡片內容 */}
      <div className="relative flex h-full w-full flex-col bg-white">
        {/* Header — 頂部留白一小段 */}
        <div className="flex items-center justify-between px-2 pt-0.5">
          <div className="flex items-center gap-1">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={issuerName ?? t('defaultIssuerName')}
                className="h-4 w-4"
                style={{ borderRadius: 'inherit', objectFit: 'contain' }}
              />
            ) : (
              <Building2 size={12} className="text-neutral-400" aria-hidden="true" />
            )}
            <span className="text-[10px] font-bold leading-tight text-neutral-950">
              {issuerName ?? t('defaultIssuerName')}
            </span>
          </div>
          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[8px] font-medium leading-none text-neutral-700">
            {cardType ?? t('defaultCardType')}
          </span>
        </div>

        {/* Strip / Hero */}
        <div
          className="mx-0 mt-2 flex h-[100px] flex-col items-center justify-center gap-1 text-center"
          style={{ backgroundColor, color: textColor }}
        >
          <CreditCard className="h-5 w-5" style={{ color: textColor }} aria-hidden="true" />
          <span className="text-[10px] font-semibold leading-tight" style={{ color: textColor }}>
            {name ?? t('defaultName')}
          </span>
        </div>

        {/* Body */}
        <div className="mt-2 flex flex-col gap-1 px-2">
          <div className="h-px w-full bg-neutral-200" />
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[9px] text-neutral-500">{t('fieldLabelLeft')}</span>
            <span className="text-[9px] font-medium text-neutral-900">{t('fieldLabelRight')}</span>
          </div>
          <div className="h-px w-full bg-neutral-200" />
        </div>

        {/* Footer / Barcode */}
        <div className="mt-auto flex flex-1 flex-col items-center justify-end border-t border-neutral-200 bg-neutral-50 p-1.5 pb-3">
          <Barcode size={36} className="text-neutral-400" aria-hidden="true" />
          <span className="truncate max-w-full text-[8px] text-neutral-500">
            {DEMO_BARCODE_VALUE}
          </span>
        </div>
      </div>
    </div>
  );
}
