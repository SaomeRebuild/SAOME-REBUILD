/**
 * MediaAssetUploader Component Types
 *
 * @module components/business/dashboard/CardBuilderEditor/MediaAssetUploader
 */

import type { MediaAssetVariant } from '@saome/shared/constants/card-images';

/**
 * Variants currently supported by MediaAssetUploader (logo + icon).
 * Excludes 'background' until the next BackgroundUploader plan lands.
 * See plan § 16 for why.
 */
export type SupportedMediaAssetVariant = Extract<MediaAssetVariant, 'logo' | 'icon'>;

export interface MediaAssetUploaderProps {
  /** Template ID for the card being edited. */
  templateId: string;
  /** Which media asset to upload. Drives crop config / i18n namespace / settings field. */
  variant: SupportedMediaAssetVariant;
  /** Callback when upload completes successfully. Receives the R2 key. */
  onUploaded?: (key: string) => void;
  /** CSS class for the root element. */
  className?: string;
  /**
   * Whether to render the in-component header (title + description).
   * Defaults to true. Set to false when the consumer already provides its
   * own section title (e.g. CardBuilderEditorWorkspace renders `<h3>` +
   * `<p>` above the icon variant to group the Icon section under Step 3).
   */
  showHeader?: boolean;
}

export type MediaAssetUploaderState = 'idle' | 'uploading' | 'cropping' | 'success' | 'error';

// Re-export from shared for backwards-compatible consumers.
export type { ValidationError } from '@saome/shared/types';