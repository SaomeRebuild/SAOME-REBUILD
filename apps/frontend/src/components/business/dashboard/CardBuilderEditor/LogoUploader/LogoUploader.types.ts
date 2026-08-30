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

// Re-export from shared for backwards-compatible `@/LogoUploader.types` consumers.
export type { ValidationError } from '@saome/shared/types';
