/**
 * Step3CardFields — Step 3 "顯示欄位" section.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step3CardFields
 *
 * Renders two side-by-side native `<select>` dropdowns (左欄位 / 右欄位) so
 * the user can pick which fields to display on the card face. Each dropdown
 * shares the same six options defined in `CARD_FIELDS`
 * (packages/shared/constants/card-fields.ts). The option already picked by
 * the other side is rendered as `disabled`, with the localized "(已選)" /
 * "(already selected)" suffix in the option text.
 *
 * Plan: step3_card_fields_selector_baffa936.plan.md
 *   - Native `<select>` (user-confirmed UI primitive)
 *   - Dedup rule: disable picked option on the other side (user-confirmed)
 *   - Default values: both `null` (placeholder shown)
 *   - Section position: end of Step 3, after `<Step3CardColors />`
 *
 * Card-type-dependent field variations and post-selection behavior (e.g. how
 * the picked fields are rendered in `PassCardPreview`) are deferred to a
 * future plan per user request.
 *
 * Mobile-first layout (Rule 013 + 014):
 *   - `< 640px` (default): stacked 1 column
 *   - `≥ 768px` (`md:`): side-by-side 2 columns
 *
 * Tailwind tokens used (Rule 010 + design-system/MASTER.md):
 *   - border-input / bg-background / focus-visible:ring-ring (input surface)
 *   - text-muted-foreground (chevron)
 *   - rounded-md / h-10 / px-3 / py-2 (form control sizing — matches Step 2 inputs)
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import {
  type CardFieldDefinition,
  type CardFieldKey,
} from '@saome/shared/constants/card-fields';
import type { CardType } from '@saome/shared/schemas/card';
import { filterCARD_FIELDS_BY_CARD_TYPE } from './filterCARD_FIELDS_BY_CARD_TYPE';

/**
 * Shared `<select>` styling. Native `<select>` is used per user-confirmed
 * UI primitive (plan § Design decisions). `appearance-none` strips the
 * platform-default arrow so we can render our own ChevronDown icon to keep
 * the visual language consistent with `ColorSwatchPicker`'s trigger.
 *
 * `text-foreground` makes the visible selected value contrast against the
 * themed `bg-background` regardless of light/dark mode (otherwise the body
 * inherits light text on dark bg in dark mode, which leaks into the OS
 * dropdown panel and renders options white-on-white → invisible).
 *
 * The inline `color-scheme: light` (applied below) is the *first* half of
 * this fix — it forces the native dropdown panel to render in light color
 * scheme (white OS-default panel).
 *
 * The *second* half is `OPTION_STYLE` (also below): `colorScheme: 'light'`
 * alone does NOT override the inherited `color` cascade for `<option>`
 * elements on all browsers (Chrome on Windows notably still renders option
 * text in the body's `color: var(--foreground)` → white-on-white invisible).
 * Each `<option>` therefore sets `color: black` explicitly so the text is
 * always legible regardless of page theme. See 2026-09-04 Step3 fix.
 */
/**
 * Force every `<option>` rendered inside the OS-native dropdown panel to
 * use black text. Pair with `<select style={{ colorScheme: 'light' }}>` —
 * the panel becomes white (light scheme) and option text becomes black.
 */
const OPTION_STYLE = { color: '#000000' };

const SELECT_CLASS =
  'h-10 w-full appearance-none rounded-md border border-input bg-background ' +
  'px-3 py-2 pr-9 text-sm text-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

interface FieldSelectProps {
  /** Side label, e.g. "左欄位" / "Left Field" — used for both visible label and aria-label. */
  sideLabel: string;
  /** Currently selected field key (or `null` for placeholder). */
  value: CardFieldKey | null;
  /** The other side's selection — its matching option is rendered `disabled`. */
  otherValue: CardFieldKey | null;
  /** Store setter. `null` clears the slot back to placeholder. */
  onChange: (next: CardFieldKey | null) => void;
  /**
   * Fields visible in the dropdown for the current card type.
   * `Step3CardFields` filters `CARD_FIELDS` by `group` (common / stamp) and
   * passes the filtered list here. When the list excludes a key, that key
   * is not rendered as an `<option>` — but the store may still hold it
   * (e.g. user picked a stamp-only field then switched to a non-stamp card
   * type; the value is preserved, not silently cleared).
   */
  availableFields: readonly CardFieldDefinition[];
  /**
   * Current `cardType` from the store (Step 1 selection). Used to override
   * the option label for `memberLevel` when cardType === 'stamp_card':
   * the dropdown option reads "獎勵" instead of "會員等級", and the live
   * preview's label/value follow the same cardType-driven path
   * (PassCardPreviewBody.tsx). For all other cardTypes (incl. `multipass`),
   * the original "會員等級" label is preserved. (2026-09-10 stamp card
   * member-level → reward refactor.)
   */
  cardType?: CardType | null;
}

/**
 * Resolve the i18n labelKey for a `CardFieldDefinition` in the dropdown.
 * The only conditional override today is `memberLevel` → `memberLevelStamp`
 * when cardType is stamp_card; every other field uses its canonical
 * `field.labelKey`. Keeping this helper local (rather than baking the
 * conditional into the map() below) keeps the override auditable in one
 * place and avoids drift if a future field needs the same treatment.
 */
function resolveOptionLabelKey(field: CardFieldDefinition, cardType?: CardType | null): string {
  if (field.key === 'memberLevel' && cardType === 'stamp_card') {
    return 'step3.fieldsSection.fields.memberLevelStamp';
  }
  return field.labelKey;
}

/**
 * Single side-by-side `<select>` with native picker UX.
 *
 * The "disabled suffix" string is appended to option text so the user can
 * SEE WHY an option is unselectable (without that, `disabled` only greys out
 * without explanation in the dropdown).
 */
function FieldSelect({ sideLabel, value, otherValue, onChange, availableFields, cardType }: FieldSelectProps) {
  const { t } = useTranslation('cardEditor');
  const placeholder = t('step3.fieldsSection.placeholder');
  const disabledSuffix = t('step3.fieldsSection.disabledSuffix');

  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{sideLabel}</span>
      <div className="relative">
        <select
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === '' ? null : (raw as CardFieldKey));
          }}
          aria-label={sideLabel}
          // Force the native dropdown panel to use light color scheme so
          // unselected options are always black text on a white panel —
          // without this, dark-themed pages render the OS panel with body
          // text color (light) on a white default background → invisible.
          style={{ colorScheme: 'light' }}
          className={SELECT_CLASS}
        >
          <option value="" disabled style={OPTION_STYLE}>
            {placeholder}
          </option>
          {availableFields.map((field) => {
            const pickedByOther = field.key === otherValue;
            const labelKey = resolveOptionLabelKey(field, cardType);
            return (
              <option
                key={field.key}
                value={field.key}
                disabled={pickedByOther}
                style={OPTION_STYLE}
              >
                {t(labelKey)}
                {pickedByOther ? ` (${disabledSuffix})` : ''}
              </option>
            );
          })}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </label>
  );
}

/**
 * Step 3 — 顯示欄位 section. Mounted after `<Step3CardColors />` inside the
 * Step 3 wizard step. Mobile-first: stacked on < 768px, side-by-side on ≥ 768px.
 *
 * Card-type-conditional behavior (2026-09-08):
 *   - The dropdown always renders both sides.
 *   - Options are filtered by `CARD_FIELDS` `group` discriminator:
 *     - `group: 'common'` entries are always shown.
 *     - `group: 'stamp'` entries (availableRewards / totalStamps /
 *       stampsRemaining) are shown ONLY when `cardType ∈ {stamp_card, multipass}`.
 *   - The store keeps its value if the user later switches card type and the
 *     previously-picked field becomes hidden — the filter affects the
 *     dropdown options, not the stored value (no silent data loss).
 */
export function Step3CardFields() {
  const { t } = useTranslation('cardEditor');
  const leftField = useCardBuilderStore((s) => s.leftField);
  const rightField = useCardBuilderStore((s) => s.rightField);
  const setLeftField = useCardBuilderStore((s) => s.setLeftField);
  const setRightField = useCardBuilderStore((s) => s.setRightField);
  const cardType = useCardBuilderStore((s) => s.cardType);

  // Filter once per cardType change — useMemo avoids recomputing on every
  // leftField/rightField change (which would still produce the same array
  // for a given cardType). `cardType` is `CardType | null`, and
  // `filterCARD_FIELDS_BY_CARD_TYPE` accepts both.
  const availableFields = useMemo(
    () => filterCARD_FIELDS_BY_CARD_TYPE(cardType),
    [cardType],
  );

  return (
    <section className="flex min-w-0 flex-col gap-3 border-t pt-6">
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step3.fieldsSection.title')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step3.fieldsSection.hint')}
        </p>
      </header>

      {/* 兩欄並列：mobile 1 column → md: 2 columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FieldSelect
          sideLabel={t('step3.fieldsSection.leftField')}
          value={leftField}
          otherValue={rightField}
          onChange={setLeftField}
          availableFields={availableFields}
          cardType={cardType}
        />
        <FieldSelect
          sideLabel={t('step3.fieldsSection.rightField')}
          value={rightField}
          otherValue={leftField}
          onChange={setRightField}
          availableFields={availableFields}
          cardType={cardType}
        />
      </div>
    </section>
  );
}
