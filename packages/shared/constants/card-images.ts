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
  /**
   * UI crop window size in CSS px. The 200×200 mask stays visually fixed at
   * this size regardless of zoom scale (see Crop Window Invariant in
   * `.cursor/skills/saome-image-upload/SKILL.md`).
   */
  CROP_WINDOW_SIZE: 200,
  /**
   * UI base canvas width in CSS px. Image is rendered at this size in the
   * canvas before the scale transform applies, so the canvas aspect ratio
   * matches the source image (height auto-computed as `baseCanvasWidth * NH/NW`).
   */
  BASE_CANVAS_WIDTH: 400,
} as const;

/**
 * Icon crop configuration.
 * Based on PassCreator specifications for the push-notification icon field.
 *
 * PassCreator Icon: minimum 720×720 pixels, equal ratio (square, transparency required).
 * @see https://passcreator.com/documentation/pass-components/
 *
 * UI dimensions are proportional to LogoUploader (CROP_WINDOW 200 → 150, BASE_CANVAS 400 → 300)
 * so mask/OUTPUT_WIDTH ratio (~20.8%) and mask/canvas ratio (50%) match the logo cropper exactly.
 */
export const ICON_CROP_CONFIG = {
  /** Output width in pixels. Fixed square per PassCreator spec (push icon). */
  OUTPUT_WIDTH: 720,
  /** Output height in pixels. Fixed square (matches OUTPUT_WIDTH for icon). */
  OUTPUT_HEIGHT: 720,
  /** Minimum input image width in pixels. User must upload >= 720px wide image. */
  MIN_INPUT_WIDTH: 720,
  /** Allowed MIME types for upload. PNG strongly preferred (transparency). */
  MIME_TYPES: ['image/png', 'image/jpeg'] as const,
  /** Maximum file size: 5MB */
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  /** Minimum zoom scale: 50% */
  MIN_SCALE: 0.5,
  /** Maximum zoom scale: 300% */
  MAX_SCALE: 3.0,
  /** Default zoom scale: 100% */
  DEFAULT_SCALE: 1.0,
  /**
   * UI crop window size in CSS px. Smaller than logo (150 vs 200) because icon
   * lives in a more compact mobile layout (Step 3 with logo + icon stacked).
   * Mask/OUTPUT_WIDTH ratio = 150/720 = 20.8% (same as logo 200/960).
   */
  CROP_WINDOW_SIZE: 150,
  /**
   * UI base canvas width in CSS px. 1:2 ratio with CROP_WINDOW_SIZE preserved
   * from LogoUploader so hook chain (useImageCrop) is shared verbatim.
   */
  BASE_CANVAS_WIDTH: 300,
} as const;

/**
 * Asserted type for LOGO_CROP_CONFIG members to avoid 'as const' widening.
 */
export type LogoCropConfig = typeof LOGO_CROP_CONFIG;

/**
 * Asserted type for ICON_CROP_CONFIG members to avoid 'as const' widening.
 */
export type IconCropConfig = typeof ICON_CROP_CONFIG;

/**
 * Union of all media-asset crop configurations (logo + icon today, + background later).
 * Use this for code that needs to accept any crop config (e.g. MediaAssetUploader hooks).
 */
export type MediaAssetCropConfig = LogoCropConfig | IconCropConfig;

/**
 * Media asset variant discriminator.
 *
 * - 'logo' — Hero brand mark on the card (issuerLogo in templateSettings)
 * - 'icon' — Push-notification icon (iconImage in templateSettings)
 * - 'background' — Reserved for future BackgroundUploader (not implemented yet)
 */
export type MediaAssetVariant = 'logo' | 'icon' | 'background';

/**
 * Per-variant config entry shape. Each MEDIA_ASSET_CONFIG entry must satisfy this.
 *
 * Declared BEFORE MEDIA_ASSET_CONFIG so the `satisfies` clause can reference it
 * (TypeScript does not allow forward-reference in `satisfies`).
 */
export type MediaAssetVariantEntry = {
  i18nNamespace: string;
  cropConfig: MediaAssetCropConfig;
  settingsField: string;
  cardImageType: CardImageType;
};

/**
 * Variant-driven configuration map for the unified MediaAssetUploader component.
 *
 * Each entry bundles everything that differs between variants, so the component
 * code stays variant-agnostic and reads `config.cropConfig / i18nNamespace /
 * settingsField / cardImageType` instead of branching on `variant`.
 *
 * NOTE: 'background' entry is intentionally omitted in this plan (Phase 16 ❌),
 * but the type allows it for the next BackgroundUploader plan. Consumers MUST
 * null-check `MEDIA_ASSET_CONFIG[variant]` or restrict the variant prop to
 * 'logo' | 'icon' until the background entry lands.
 */
export const MEDIA_ASSET_CONFIG: {
  readonly [K in MediaAssetVariant]?: MediaAssetVariantEntry;
} = {
  logo: {
    i18nNamespace: 'logoUpload',
    cropConfig: LOGO_CROP_CONFIG,
    settingsField: 'issuerLogo' as const,
    cardImageType: 'logo' as const,
  },
  icon: {
    i18nNamespace: 'iconUpload',
    cropConfig: ICON_CROP_CONFIG,
    settingsField: 'iconImage' as const,
    cardImageType: 'icon' as const,
  },
  // background variant deliberately omitted — BackgroundUploader is a separate plan.
  // See plan § 16 for why and what the next plan needs.
};
