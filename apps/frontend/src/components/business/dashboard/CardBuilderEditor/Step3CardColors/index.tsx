/**
 * Step3CardColors — Step 3 composer (兩顆並列 ColorSwatchPicker)
 *
 * @module components/business/dashboard/CardBuilderEditor/Step3CardColors
 *
 * Renders 兩顆並列按鈕（背景色 / 文字色）於 Step 3 Background section 之後。
 * 與既有 icon / background section 對稱，皆採 parent section header pattern
 * （Rule 028 § 15 Variant Header Pattern）。
 *
 * Layout: mobile `grid-cols-1` → sm `sm:grid-cols-2`（Rule 013 RWD + Rule 014）。
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { COLOR_PRESETS } from '@saome/shared/constants/color-presets';
import { ColorSwatchPicker } from './ColorSwatchPicker';

export function Step3CardColors() {
  const { t } = useTranslation('cardEditor');
  const backgroundColor = useCardBuilderStore((s) => s.backgroundColor);
  const textColor = useCardBuilderStore((s) => s.textColor);
  const setBackgroundColor = useCardBuilderStore((s) => s.setBackgroundColor);
  const setTextColor = useCardBuilderStore((s) => s.setTextColor);

  return (
    <section className="flex min-w-0 flex-col gap-2 border-t pt-6">
      <h3
        className="text-base font-semibold text-foreground"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {t('step3.colorsSection.title')}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t('step3.colorsSection.hint')}
      </p>

      {/* 兩顆並列：mobile 1 column → sm: 2 columns */}
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ColorSwatchPicker
          label={t('step3.colorsSection.background')}
          value={backgroundColor}
          onChange={setBackgroundColor}
          presets={COLOR_PRESETS}
        />
        <ColorSwatchPicker
          label={t('step3.colorsSection.text')}
          value={textColor}
          onChange={setTextColor}
          presets={COLOR_PRESETS}
        />
      </div>
    </section>
  );
}
