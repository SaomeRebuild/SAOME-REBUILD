/**
 * Card Image Constants
 *
 * @module shared/constants/card-images
 * @description Constants for card template image assets stored in R2.
 */

/**
 * R2 object keys for card template images.
 * Each image type maps to a fixed filename to simplify key generation.
 */
export const CARD_IMAGE_KEYS = {
  /** Issuer logo image — will be cropped to 960x960px before upload. */
  logo: 'issuer-logo.png',
  /** Background image for the pass. */
  background: 'background.png',
  /** Icon/thumbnail image. */
  icon: 'icon.png',
} as const;

/**
 * Supported card image types.
 */
export type CardImageType = keyof typeof CARD_IMAGE_KEYS;

/**
 * Build the R2 key for a card template image.
 *
 * R2 key pattern: {tenant_id}/{template_id}/{image_type_filename}
 *
 * @param tenantId - Tenant UUID (from JWT)
 * @param templateId - Template UUID
 * @param imageType - Type of image (logo, background, icon)
 * @returns The full R2 object key
 */
export function buildImageKey(
  tenantId: string,
  templateId: string,
  imageType: CardImageType,
): string {
  const filename = CARD_IMAGE_KEYS[imageType];
  if (!filename) {
    throw new Error(`buildImageKey: unknown imageType "${imageType}"`);
  }
  return `${tenantId}/${templateId}/${filename}`;
}

/**
 * Logo crop configuration.
 * Based on PassCreator specifications for the logo field.
 *
 * Logo: Width up to 960 pixels, height flexible.
 * @see https://passcreator.com/documentation/pass-components/
 */
export const LOGO_CROP_CONFIG = {
  /** Output width in pixels. Width capped at 960px per PassCreator spec. */
  OUTPUT_WIDTH: 960,
  /** Output height in pixels. Flexible — preserves natural aspect ratio. */
  OUTPUT_HEIGHT: null,
  /** Minimum input image width in pixels. User must upload >= 960px wide image. */
  MIN_INPUT_WIDTH: 960,
  /** Allowed MIME types for upload. */
  MIME_TYPES: ['image/png', 'image/jpeg'] as const,
  /** Maximum file size: 5MB */
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  /** Minimum zoom scale: 50% (image displayed at half size, showing more context) */
  MIN_SCALE: 0.5,
  /** Maximum zoom scale: 300% (image displayed at 3x, showing more detail) */
  MAX_SCALE: 3.0,
  /** Default zoom scale: 100% (image at natural size) */
  DEFAULT_SCALE: 1.0,
} as const;

/**
 * Asserted type for LOGO_CROP_CONFIG members to avoid 'as const' widening.
 */
export type LogoCropConfig = typeof LOGO_CROP_CONFIG;
