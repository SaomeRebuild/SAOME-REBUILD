/**
 * LinksField — Step 4 section 3 (連結).
 *
 * Renders a list of Label + URL rows. OPTIONAL — empty array is the
 * initial state. Capped at LINKS_MAX=4; the add button is disabled at the
 * cap.
 *
 * Validation differs from BackFieldsField:
 *   - Empty `value` is OK (unfilled field = row simply isn't shown in
 *     the preview's Section 5).
 *   - Non-empty `value` MUST be a valid URL (`isValidUrl()` from
 *     `@saome/shared/logic/links`); otherwise the error message appears
 *     when `showValidation` is true.
 *
 * `removeLink` does NOT auto-refill — the user is allowed to delete all
 * rows because links are optional.
 */

import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { LINKS_MAX } from '@saome/shared/constants/card-back-fields';
import { isValidUrl } from '@saome/shared/logic/links';
import { LabelValueListField } from './LabelValueListField';

interface LinksFieldProps {
  showValidation: boolean;
}

export function LinksField({ showValidation }: LinksFieldProps) {
  const rows = useCardBuilderStore((s) => s.links);
  const setLinksLabel = useCardBuilderStore((s) => s.setLinksLabel);
  const setLinksValue = useCardBuilderStore((s) => s.setLinksValue);
  const addLink = useCardBuilderStore((s) => s.addLink);
  const removeLink = useCardBuilderStore((s) => s.removeLink);

  // For links, value is optional — empty is OK; non-empty must parse.
  const validateValue = (value: string) => value === '' || isValidUrl(value);

  return (
    <LabelValueListField
      titleKey="step4.links.title"
      hintKey="step4.links.hint"
      addLabelKey="step4.links.addLink"
      counterKey="step4.links.counter"
      maxReachedKey="step4.links.maxReached"
      rows={rows}
      max={LINKS_MAX}
      onLabelChange={setLinksLabel}
      onValueChange={setLinksValue}
      onAdd={addLink}
      onRemove={removeLink}
      validateValue={validateValue}
      valueErrorKey="step4.links.invalidUrl"
      labelPlaceholderKey="step4.links.labelPlaceholder"
      valuePlaceholderKey="step4.links.valuePlaceholder"
      removeLabelKey="step4.links.removeLink"
      showValidation={showValidation}
    />
  );
}