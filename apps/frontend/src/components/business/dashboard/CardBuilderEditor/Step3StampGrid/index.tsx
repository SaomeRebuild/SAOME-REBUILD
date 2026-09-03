/**
 * Step3StampGrid — 集點印章 section.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step3StampGrid
 *
 * Conditional render: only shown when the user selected a stamp-capable
 * card type in Step 1 (`stamp_card` or `multipass`). The host
 * (`CardBuilderEditorWorkspace`) gates this section on `cardType` so the
 * component itself stays pure and only renders UI — no conditional return.
 *
 * Layout (mobile-first per Rule 013 + 014):
 *   - header (title + hint)
 *   - <StampGridCountSelector />  — 1×5 / 2×5 / 3×5 / 4×5 segmented buttons
 *   - <StampIconPicker />          — trigger button + popover with icon grid
 *
 * State: read from `useCardBuilderStore` directly (single source of truth).
 * Persistence: the store's setter writes through to the JSONB settings on
 * the next auto-save (see `apps/backend/.../db/templates.ts::updateTemplate`).
 *
 * Why this is a separate folder (not inline in CardBuilderEditorWorkspace):
 * - The component will likely grow (more grid sizes, custom icons, etc.).
 * - Sub-components (count selector, icon picker popover) need their own
 *   files to keep each under 100 lines (Rule 000 § A.1).
 */
import { useTranslation } from 'react-i18next';
import { StampGridCountSelector } from './StampGridCountSelector';
import { StampIconPicker } from './StampIconPicker';

export function Step3StampGrid() {
  const { t } = useTranslation('cardEditor');

  return (
    <section
      className="flex min-w-0 flex-col gap-4 border-t pt-6"
      data-testid="step3-stamp-grid"
    >
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step3.stampSection.title')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step3.stampSection.hint')}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <StampGridCountSelector />
        <StampIconPicker />
      </div>
    </section>
  );
}
