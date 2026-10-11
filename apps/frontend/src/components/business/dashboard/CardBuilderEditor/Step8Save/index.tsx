/**
 * Step8Save — Step 8「儲存並發布」main component (組裝).
 *
 * Layout:
 *   - Title (uses the new `cardEditor.steps.save.title` key, 2026-10-04)
 *   - Step8SaveSummary (read-only summary panel)
 *   - Step8SaveErrorBanner (Passcreator-failure banner, conditionally rendered)
 *   - Step8SaveActions (Save & Publish + Back to Library buttons)
 *
 * Validation gate: `cardType` must be set (Step 1) AND `cardName` must be
 * non-empty (Step 2) for the publish action to be allowed. Mirrors the
 * `isStep1Valid` / `isStep2Valid` gates in CardBuilderEditorWorkspace.tsx.
 *
 * Why the wiring lives here (vs. each sub-component):
 *   - The action calls cardService directly (not in a sub-component) so
 *     Step8SaveActions stays a pure render component (testable in
 *     isolation).
 *   - The `summary` + `validation` derivations live in `Step8Save.hooks.ts`
 *     so the main file stays ≤ 100 lines (Rule 000 § A.2 — L2 main file).
 *
 * v4 (2026-10-11, Passcreator push integration):
 *   The component now ALSO renders `Step8SaveErrorBanner` when the
 *   publish hook reports a Passcreator-specific failure. The banner
 *   appears between the summary and the action buttons so the user
 *   sees it before the retry CTA at the bottom of the page.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step8Save
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { Step8SaveSummary } from './Step8SaveSummary';
import { Step8SaveActions } from './Step8SaveActions';
import { Step8SaveErrorBanner } from './Step8SaveErrorBanner';
import { useStep8Save, useStep8SaveSummary, useStep8SaveValidation } from './Step8Save.hooks';

export function Step8Save() {
  const { t } = useTranslation('cardEditor');

  // Wire store → hooks → sub-components.
  const cardId = useCardBuilderStore((s) => s.cardId);
  const summary = useStep8SaveSummary();
  const validation = useStep8SaveValidation();
  const { status, publish, goBack, passcreatorError, dismissPasscreatorError } = useStep8Save(cardId);

  return (
    <section className="flex min-w-0 flex-col gap-6" data-testid="step8-save">
      <h2
        className="text-lg font-semibold text-foreground"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {t('steps.save.title')}
      </h2>

      <Step8SaveSummary summary={summary} />

      <Step8SaveErrorBanner
        error={passcreatorError}
        onRetry={publish}
        onDismiss={dismissPasscreatorError}
      />

      <Step8SaveActions
        cardId={cardId}
        status={status}
        validation={validation}
        onPublish={publish}
        onBack={goBack}
      />
    </section>
  );
}

export default Step8Save;