/**
 * UploadPrompt — Idle state when the user has no logo yet.
 *
 * Pure presentation component. All event/state lives in the parent
 * `LogoUploader`. This component only renders the dashed-border button +
 * helper hint and forwards the file picker click.
 *
 * @module components/business/dashboard/CardBuilderEditor/LogoUploader/UploadPrompt
 */

import { Upload } from 'lucide-react';

export interface UploadPromptProps {
  /** i18n text for the prompt heading (e.g. 'selectFile'). */
  selectFileLabel: string;
  /** i18n text for the helper hint (e.g. 規格說明). */
  hintLabel: string;
  /** Forwarded click → triggers the hidden file input. */
  onSelectFile: () => void;
}

export function UploadPrompt({ selectFileLabel, hintLabel, onSelectFile }: UploadPromptProps) {
  return (
    <button
      type="button"
      onClick={onSelectFile}
      className="
        flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30
        bg-muted/30 p-8 transition-all duration-150
        hover:border-primary hover:bg-primary/5
      "
    >
      <Upload size={32} className="text-muted-foreground" aria-hidden="true" />
      <span className="text-sm font-medium text-muted-foreground">{selectFileLabel}</span>
      <span className="text-xs text-muted-foreground/60">{hintLabel}</span>
    </button>
  );
}
