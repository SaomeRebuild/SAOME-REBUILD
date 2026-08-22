/**
 * PassCardPreview — 卡片正面預覽（Header 部分）
 * 固定白色背景（模擬實體 Pass），字色用 neutral 確保可讀
 */
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { api } from '@/config/api';
import { getAccessToken } from '@/services/authStore';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

interface PassCardPreviewHeaderProps {
  cardType?: string | null;
  issuerLogo?: string;
  name?: string;
  compact?: boolean;
}

export function PassCardPreviewHeader({ cardType, issuerLogo, name, compact }: PassCardPreviewHeaderProps) {
  const { t } = useTranslation('passCard');

  // Build proxy URL: avoids relying on Windows DNS resolving saome-assets.pages.dev
  const templateId = useCardBuilderStore.getState().cardId;
  const token = getAccessToken();
  const logoUrl = issuerLogo && templateId
    ? `${api.baseUrl}${api.paths.cardImage(templateId, 'logo')}${token ? `?token=${encodeURIComponent(token)}` : ''}`
    : undefined;

  return (
    <div className={compact ? 'flex items-center justify-between px-2 pt-2' : 'flex items-center justify-between px-4 pt-4'}>
      {/* Logo 區 */}
      <div className="flex flex-col gap-1">
        <div className={compact ? 'flex items-center gap-1' : 'flex items-center gap-2'}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={t('defaultIssuerName')}
              className={compact ? 'h-5 w-5' : 'h-8 w-8'}
              style={{ borderRadius: 'inherit', objectFit: 'contain' }}
            />
          ) : (
            <Building2 size={compact ? 16 : 24} className="text-neutral-400" aria-hidden="true" />
          )}
          <span className={compact ? 'text-xs font-bold leading-tight text-neutral-950' : 'text-sm font-bold text-neutral-950'}>
            {name || t('defaultIssuerName')}
          </span>
        </div>
      </div>

      {/* Pass 類型標籤 */}
      <span className={compact ? 'rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-medium leading-none text-neutral-700' : 'rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700'}>
        {cardType ?? t('defaultCardType')}
      </span>
    </div>
  );
}
