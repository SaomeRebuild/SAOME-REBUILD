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
  /** Optional text color override (hex with #). When provided, applied to card name + card type badge. */
  textColor?: string;
  compact?: boolean;
}

export function PassCardPreviewHeader({ cardType, issuerLogo, name, textColor, compact }: PassCardPreviewHeaderProps) {
  const { t } = useTranslation('passCard');

  // Build proxy URL: avoids relying on Windows DNS resolving saome-assets.pages.dev
  const templateId = useCardBuilderStore.getState().cardId;
  const issuerLogoVersion = useCardBuilderStore.getState().issuerLogoVersion;
  const token = getAccessToken();
  const logoUrl = issuerLogo && templateId
    ? `${api.baseUrl}${api.paths.cardImage(templateId, 'logo')}${token ? `?token=${encodeURIComponent(token)}` : ''}&v=${issuerLogoVersion}`
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
          {/* Card name — textColor 套用範圍 #1 (header 名稱) */}
          <span
            className={compact ? 'text-xs font-bold leading-tight' : 'text-sm font-bold'}
            style={textColor ? { color: textColor } : undefined}
          >
            {name || t('defaultIssuerName')}
          </span>
        </div>
      </div>

      {/* Pass 類型標籤 — textColor 套用範圍 #2 (card type 標籤)
          背景透明（2026-09-03 修正）：避免灰色色塊切斷卡片色彩統一性 */}
      <span
        className={compact
          ? 'rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none'
          : 'rounded-full px-2 py-0.5 text-xs font-medium'
        }
        style={textColor ? { color: textColor } : undefined}
      >
        {cardType ?? t('defaultCardType')}
      </span>
    </div>
  );
}
