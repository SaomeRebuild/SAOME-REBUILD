/**
 * PassCardPreviewBack — 卡片反面預覽
 *
 * 完全獨立的 UI，與正面（Header / Strip / Body / Footer）無關。
 * 米白背景 + 四個白色 section card。
 */

import type { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface PassCardPreviewBackProps extends HTMLAttributes<HTMLDivElement> {
  /** 緊湊模式（用於手機框架內） */
  compact?: boolean;
}

export function PassCardPreviewBack({
  compact = false,
  className,
  ...props
}: PassCardPreviewBackProps) {
  const { t } = useTranslation('cardEditor');

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col gap-3 bg-[#f3f2f8] p-3',
        className
      )}
      {...props}
    >
      {/* Section 1: 卡片描述 */}
      <div className="rounded-lg bg-transparent p-3">
        <p
          className={cn(
            'text-center text-neutral-600',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {t('preview.backSide.description')}
        </p>
      </div>

      {/* Section 2: 自動更新 + 允許通知 */}
      <div className="flex flex-col gap-2 rounded-lg bg-white p-3">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              'text-neutral-700',
              compact ? 'text-xs' : 'text-sm'
            )}
          >
            {t('preview.backSide.automaticUpdates')}
          </span>
          <img
            src="/on-button.png"
            alt="on"
            className="h-6 w-12 object-contain"
          />
        </div>
        <div className="flex items-center justify-between">
          <span
            className={cn(
              'text-neutral-700',
              compact ? 'text-xs' : 'text-sm'
            )}
          >
            {t('preview.backSide.allowNotifications')}
          </span>
          <img
            src="/on-button.png"
            alt="on"
            className="h-6 w-12 object-contain"
          />
        </div>
      </div>

      {/* Section 3: 移除票卡 */}
      <button
        type="button"
        className={cn(
          'w-full rounded-lg bg-white p-3 text-left text-red-600 transition-colors',
          compact ? 'text-xs' : 'text-sm',
          'hover:bg-red-50'
        )}
      >
        {t('preview.backSide.removePass')}
      </button>

      {/* Section 4: 條文或連結 */}
      <div className="rounded-lg bg-white p-3">
        <p
          className={cn(
            'text-neutral-500',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {t('preview.backSide.termsOrLinks')}
        </p>
      </div>
    </div>
  );
}
