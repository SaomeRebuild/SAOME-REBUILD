/**
 * LogoUploader Component Types
 *
 * @module components/business/dashboard/CardBuilderEditor/LogoUploader
 */

export interface LogoUploaderProps {
  /** Template ID for the card being edited. */
  templateId: string;
  /** Callback when logo is successfully uploaded. */
  onLogoUploaded: (logoUrl: string) => void;
  /** CSS class for the root element. */
  className?: string;
}

export type LogoUploaderState = 'idle' | 'uploading' | 'cropping' | 'success' | 'error';

export interface ValidationError {
  type: 'tooSmall' | 'tooLarge' | 'wrongFormat';
  message: string;
}
