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
 *
 * 2026-09-13 membership_card hide: BackFieldsField (Apple EULA-mandated
 * contact info) is hidden when cardType === 'membership_card' per the
 * plan `membership_card_conditional_ui_hide`. DescriptionField and
 * LinksField stay visible — only the contact-info section is omitted.
 */

import { DescriptionField } from './DescriptionField';
import { BackFieldsField } from './BackFieldsField';
import { LinksField } from './LinksField';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

interface Step4CardInfoProps {
  /**
   * Surface per-field validation errors. The workspace passes
   * `!isStep4Valid()` so the user only sees the red borders / messages
   * after they've tried to leave the step at least once.
   */
  showValidation: boolean;
}

export function Step4CardInfo({ showValidation }: Step4CardInfoProps) {
  const cardType = useCardBuilderStore((s) => s.cardType);
  const isMembership = cardType === 'membership_card';

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DescriptionField showValidation={showValidation} />
      {/* Membership cards hide the Apple EULA contact-info section per
          plan `membership_card_conditional_ui_hide`. isStep4Valid() in
          CardBuilderEditorWorkspace mirrors this skip — see the
          conditional branch in that function. */}
      {!isMembership && <BackFieldsField showValidation={showValidation} />}
      <LinksField showValidation={showValidation} />
    </div>
  );
}