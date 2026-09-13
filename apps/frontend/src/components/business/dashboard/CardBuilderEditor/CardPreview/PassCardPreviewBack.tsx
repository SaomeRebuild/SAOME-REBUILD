/**
 * PassCardPreviewBack — 卡片反面預覽
 *
 * 完全獨立的 UI，與正面（Header / Strip / Body / Footer）無關。
 * 米白背景 + 四個白色 section card。
 */

import type { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface LabelValuePair {
  label: string;
  value: string;
}

interface PassCardPreviewBackProps extends HTMLAttributes<HTMLDivElement> {
  /** 緊湊模式（用於手機框架內） */
  compact?: boolean;
  /** Section 1 — card description (Step 4 card-info 2026-09-04). */
  description?: string;
  /** Section 4 — back fields (Step 4 card-info 2026-09-04). */
  backFields?: ReadonlyArray<LabelValuePair>;
  /** Section 5 — dedicated links (Step 4 card-info 2026-09-04). */
  links?: ReadonlyArray<LabelValuePair>;
  /**
   * 2026-09-13 membership card — 會員獎勵 sub-rows from the first tier.
   * Rendered as Section 4 (取代原本的 Section 1.5) when `isMembership` is true.
   * Section 4 semantic for membership cards: 「背面欄位」 = 會員獎勵 sub-rows.
   * Section 1.5 was REMOVED in 2026-09-13 because the description→rewards
   * ordering was confusing (description should be at the very top, rewards
   * belong in the back-field area).
   */
  membershipTiersRewards?: ReadonlyArray<LabelValuePair>;
  /**
   * 2026-09-13 membership card — gates the Section 4 會員獎勵 rendering.
   * When true, Section 4 renders `membershipTiersRewards` instead of
   * the regular `backFields`.
   */
  isMembership?: boolean;
}

export function PassCardPreviewBack({
  compact = false,
  description,
  backFields,
  links,
  membershipTiersRewards,
  isMembership = false,
  className,
  ...props
}: PassCardPreviewBackProps) {
  const { t } = useTranslation('cardEditor');

  // Filter out empty rows (label='' AND value='') so partially-typed
  // rows don't appear in the preview until the user has typed something
  // meaningful. Rows with only label or only value are kept (user might
  // be mid-edit).
  const filteredBackFields = (backFields ?? []).filter(
    (row) => row.label.trim() !== '' || row.value.trim() !== '',
  );
  const filteredLinks = (links ?? []).filter(
    (row) => row.label.trim() !== '' || row.value.trim() !== '',
  );
  // 2026-09-13 membership card: filter 會員獎勵 sub-rows the same way.
  const filteredMembershipRewards = isMembership
    ? (membershipTiersRewards ?? []).filter(
        (row) => row.label.trim() !== '' || row.value.trim() !== '',
      )
    : [];

  return (
    <div
      className={cn(
        // Back side fills PhoneFrame content area (2026-09-05).
        // - h-full w-full: stretch to PhoneFrame inner box
        // - min-h-0: flex column root must allow children to shrink below
        //   content size, otherwise flex items refuse to size down
        // - overflow-x-hidden: hide X-axis scrollbar; vertical scroll is
        //   owned by PhoneFrame's overflow-y-auto, not by this component
        // - scrollbar-hide: belt-and-suspenders hide of any residual
        //   scrollbar (should not show in practice, but defensive against
        //   future content changes that might accidentally grow this div
        //   beyond the PhoneFrame inner box)
        'flex h-full w-full min-h-0 flex-col gap-3 overflow-x-hidden scrollbar-hide bg-[#f3f2f8] p-3',
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
          {description || t('preview.backSide.description')}
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

      {/* Section 4: 背面欄位 / 會員獎勵 */}
      {/* 2026-09-13 fix (current task): 會員卡把「背面欄位」語意改成
          會員獎勵 sub-rows（從第一個 tier 讀取）。原本是渲染
          Section 1.5（描述下方）並保留 Section 4 為「條文或連結」，
          但會員卡沒有獨立「條文」概念，「背面欄位」= 會員獎勵更直觀。
          Section 1.5 已移除（見上方註解）；當 isMembership=true 時，
          Section 4 渲染 membershipTiersRewards 並在空狀態顯示
          `preview.backSide.membershipRewardsEmpty` placeholder。
          標題用 `membershipRewardsTitle`（「會員獎勵」）；非會員卡保持
          原樣：渲染 backFields 或 `termsOrLinks` placeholder。 */}
      <div className="rounded-lg bg-white p-3" data-testid="back-fields-section">
        {isMembership ? (
          filteredMembershipRewards.length > 0 ? (
            <>
              <h3
                className={cn(
                  'mb-2 font-medium text-neutral-700',
                  compact ? 'text-xs' : 'text-sm'
                )}
              >
                {t('preview.backSide.membershipRewardsTitle')}
              </h3>
              <ul className="flex flex-col">
                {filteredMembershipRewards.map((row, idx) => (
                  <li
                    key={idx}
                    className={cn(
                      'flex flex-col items-start gap-0.5 py-2 text-neutral-700',
                      compact ? 'text-xs' : 'text-sm',
                      idx > 0 && 'border-t border-neutral-200'
                    )}
                  >
                    <span className="text-neutral-500">{row.label}</span>
                    <span className="whitespace-pre-wrap break-words">{row.value}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h3
                className={cn(
                  'mb-2 font-medium text-neutral-700',
                  compact ? 'text-xs' : 'text-sm'
                )}
              >
                {t('preview.backSide.membershipRewardsTitle')}
              </h3>
              <p
                className={cn(
                  'text-neutral-500',
                  compact ? 'text-xs' : 'text-sm'
                )}
              >
                {t('preview.backSide.membershipRewardsEmpty')}
              </p>
            </>
          )
        ) : filteredBackFields.length > 0 ? (
          <ul className="flex flex-col">
            {filteredBackFields.map((row, idx) => (
              <li
                key={idx}
                className={cn(
                  'flex flex-col items-start gap-0.5 py-2 text-neutral-700',
                  compact ? 'text-xs' : 'text-sm',
                  idx > 0 && 'border-t border-neutral-200'
                )}
              >
                <span className="text-neutral-500">{row.label}</span>
                {/* whitespace-pre-wrap preserves user-entered newlines from the
                    multi-line textarea added 2026-09-05; break-words prevents
                    long unbroken strings from overflowing the phone-frame column. */}
                <span className="whitespace-pre-wrap break-words">{row.value}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p
            className={cn(
              'text-neutral-500',
              compact ? 'text-xs' : 'text-sm'
            )}
          >
            {t('preview.backSide.termsOrLinks')}
          </p>
        )}
      </div>

      {/* Section 5: 連結（Step 4 card-info 2026-09-04） */}
      <div className="rounded-lg bg-white p-3">
        <h3
          className={cn(
            'mb-2 font-medium text-neutral-700',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {t('preview.backSide.linksTitle')}
        </h3>
        {filteredLinks.length > 0 ? (
          <ul className="flex flex-col">
            {filteredLinks.map((link, idx) => (
              <li
                key={idx}
                className={cn(
                  'flex flex-col items-start gap-1 py-2 text-neutral-700',
                  compact ? 'text-xs' : 'text-sm',
                  idx > 0 && 'border-t border-neutral-200'
                )}
              >
                <span className="text-neutral-500">{link.label}</span>
                <span className="break-all text-blue-600 underline">
                  {link.value}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p
            className={cn(
              'text-neutral-400',
              compact ? 'text-xs' : 'text-sm'
            )}
          >
            {t('preview.backSide.linksEmpty')}
          </p>
        )}
      </div>
    </div>
  );
}
