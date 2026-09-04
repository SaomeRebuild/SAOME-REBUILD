/**
 * Step4CardInfo — Step 4 wizard section.
 *
 * Composes three sub-components in order:
 *   1. <DescriptionField /> — card description (textarea + counter)
 *   2. <BackFieldsField /> — Apple EULA-mandated contact info rows
 *   3. <LinksField /> — optional dedicated URL rows
 *
 * The parent (CardBuilderEditorWorkspace) is responsible for prev/next
 * buttons; this component is purely the editor body.
 */

import { DescriptionField } from './DescriptionField';
import { BackFieldsField } from './BackFieldsField';
import { LinksField } from './LinksField';

interface Step4CardInfoProps {
  /**
   * Surface per-field validation errors. The workspace passes
   * `!isStep4Valid()` so the user only sees the red borders / messages
   * after they've tried to leave the step at least once.
   */
  showValidation: boolean;
}

export function Step4CardInfo({ showValidation }: Step4CardInfoProps) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DescriptionField showValidation={showValidation} />
      <BackFieldsField showValidation={showValidation} />
      <LinksField showValidation={showValidation} />
    </div>
  );
}