/**
 * PassCardPreviewStrip — 卡片正面 Strip / Hero 區塊
 * Apple Pass 風格：固定深灰黑色背景 + icon placeholder + 名稱
 *
 * Two render modes (Plan 2 § 4):
 *   1. Default: CreditCard icon + card name (Apple Wallet hero placeholder).
 *   2. Stamp card: <StampGridPreview> inside a transparent padded container
 *      (rows × 5 cols, first 3 cells stamped). Replaces the icon + name.
 *
 * Mode is selected by `cardType` + `stampIconId` + `stampGridRows`:
 *   - `cardType === 'stamp_card' | 'multipass'`
 *   - `stampIconId` is a non-empty string
 *   - `stampGridRows` is one of 1..4
 *
 * The strip's outer chrome (background color / image / overlay) is shared
 * across both modes — only the inner content layer branches.
 *
 * BACKGROUND IMAGE: This component owns the card background image.
 * The container has `position: relative` + `overflow-hidden` so the
 * absolutely-positioned `<img>` (background) and overlay div are
 * CONSTRAINED to the strip area (h-[100px] / h-[120px]). They do NOT
 * leak up into the header or down into the body.
 *
 * Strip 背景策略（自 2026-09-03 cycle）：
 * - Strip 永遠是深灰黑色 (`#1f2937`) — 不跟 color picker 改變。
 *   這是固定視覺，模仿 Apple Wallet 的彩色 hero strip。
 * - 上傳背景圖 → 圖片 `absolute inset-0 object-cover` 滿版蓋住深灰。
 *   `overflow-hidden` 確保圖片不會溢出 strip 邊界。
 *
 * `rgba(0,0,0,0.35)` overlay 永遠渲染，確保白字在 strip 區域可讀
 * （圖片之上額外暗化，避免彩色圖片破壞文字對比）。
 */
import { CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  StampGridPreview,
  STRIP_INNER_PADDING,
  type StampGridRows,
} from '@/components/business/stampCard/StampGridPreview';
import type { CardType } from '@saome/shared/schemas/card';

interface PassCardPreviewStripProps {
  name?: string;
  /** 卡片背景圖（可選，R2 URL）— 套用到 strip 區域，object-cover 滿版 */
  backgroundImage?: string;
  /** 卡片文字色（套用到 strip 內的 icon 與名稱） */
  textColor?: string;
  /** 緊湊模式 */
  compact?: boolean;
  /**
   * Card type. When set to `stamp_card` or `multipass` AND `stampIconId` is
   * non-empty AND `stampGridRows` is defined, the strip renders the stamp
   * grid instead of the default CreditCard icon + name.
   */
  cardType?: CardType | null;
  /** Stamp icon id (manifest id, e.g. `'bell'`). Empty = no stamp grid. */
  stampIconId?: string;
  /** Number of stamp grid rows (1..4). Undefined = no stamp grid. */
  stampGridRows?: StampGridRows;
}

/** Strip 固定背景色 — 永遠深灰黑色，不跟 color picker 改變 */
const STRIP_BACKGROUND_COLOR = '#1f2937';

/** Card types that render the stamp grid instead of the default hero. */
function isStampCardType(cardType: CardType | null | undefined): boolean {
  return cardType === 'stamp_card' || cardType === 'multipass';
}

export function PassCardPreviewStrip({
  name,
  backgroundImage,
  textColor = '#ffffff',
  compact,
  cardType,
  stampIconId,
  stampGridRows,
}: PassCardPreviewStripProps) {
  const { t } = useTranslation('passCard');

  const showStampGrid =
    isStampCardType(cardType) && Boolean(stampIconId) && Boolean(stampGridRows);

  // Dark semi-transparent overlay ensures text readability over any card background.
  const overlayColor = 'rgba(0, 0, 0, 0.35)';
  const stripHeight = compact ? 100 : 120;

  return (
    <div
      className={
        compact
          ? 'relative mx-0 mt-2 flex h-[100px] overflow-hidden text-center'
          : 'relative mx-0 mt-4 flex h-[120px] overflow-hidden text-center'
      }
      style={{ backgroundColor: STRIP_BACKGROUND_COLOR }}
    >
      {/* 背景圖（覆蓋 strip 整個區域；因父容器有 overflow-hidden,
          不會溢出到 header / body） */}
      {backgroundImage && (
        <img
          src={backgroundImage}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
        />
      )}

      {/* 半透明遮罩（確保文字可讀，覆蓋於背景圖之上） */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: overlayColor }}
        aria-hidden="true"
      />

      {/* 內層內容：透明、置中、padding 8px — 兩種 render mode 共用 */}
      <div
        className="relative flex h-full w-full items-center justify-center"
        style={{ padding: STRIP_INNER_PADDING }}
        data-testid="strip-content"
      >
        {showStampGrid ? (
          <StampGridPreview
            iconId={stampIconId!}
            rows={stampGridRows!}
            stripHeight={stripHeight}
          />
        ) : (
          <>
            {/* 卡片圖示 placeholder（icon 預覽在 MediaAssetUploader 面板，不在卡片內） */}
            <CreditCard
              className={compact ? 'relative h-6 w-6' : 'relative h-12 w-12'}
              style={{ color: textColor }}
              aria-hidden="true"
            />

            {/* 卡片名稱 */}
            <span
              className={
                compact
                  ? 'relative ml-2 text-xs font-semibold leading-tight'
                  : 'relative ml-3 text-lg font-semibold'
              }
              style={{ color: textColor }}
            >
              {name || t('defaultName')}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
