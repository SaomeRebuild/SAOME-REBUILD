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
 * Background crop configuration.
 * Based on PassCreator specifications for the background image field.
 *
 * PassCreator Background: 1860×738 pixels minimum (or larger, keep ratio).
 * 3× size (5580×2214) recommended for retina rendering.
 * @see https://passcreator.com/documentation/pass-components/
 *
 * This is the first non-square variant — output aspect 1860:738 ≈ 2.52:1.
 * The UI crop window is therefore rectangular (800×317, same aspect) and
 * `computeSrcRegion` produces a rectangular src crop rather than the
 * legacy `computeSrcSquareSize`.
 *
 * IMPORTANT: this constant must be added BEFORE the MediaAssetVariant
 * type and MEDIA_ASSET_CONFIG map are extended with 'background' entries
 * (see `BACKGROUND_CROP_CONFIG` referenced in `MEDIA_ASSET_CONFIG.background`).
 */
export const BACKGROUND_CROP_CONFIG = {
  /** Output width in pixels (PassCreator hero strip spec). */
  OUTPUT_WIDTH: 1860,
  /** Output height in pixels (PassCreator hero strip spec, fixed landscape). */
  OUTPUT_HEIGHT: 738,
  /** Minimum input image width in pixels. PassCreator spec is strict 1860+. */
  MIN_INPUT_WIDTH: 1860,
  /** Minimum input image height in pixels. PassCreator spec is strict 738+. */
  MIN_INPUT_HEIGHT: 738,
  /** Allowed MIME types for upload. */
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
   * UI crop window WIDTH in CSS px. Landscape orientation (wider than tall).
   * UI mask 800×317 (aspect 2.52:1) must match the output 1860×738 ratio so
   * the user sees exactly the region that gets exported on Apply Crop.
   */
  CROP_WINDOW_WIDTH: 800,
  /**
   * UI crop window HEIGHT in CSS px. 317 = round(800 × 738 / 1860).
   * Kept as a separate constant (not derived at runtime) so the type system
   * can pin the invariant.
   */
  CROP_WINDOW_HEIGHT: 317,
  /**
   * UI base canvas width in CSS px. Image rendered at this width before the
   * scale transform applies. Height auto-computed as `baseCanvasWidth *
   * NH/NW` (aspect-matched) so canvas aspect = source aspect.
   */
  BASE_CANVAS_WIDTH: 800,
} as const;

/**
 * Asserted type for BACKGROUND_CROP_CONFIG members to avoid 'as const' widening.
 */
export type BackgroundCropConfig = typeof BACKGROUND_CROP_CONFIG;

/**
 * Union of all media-asset crop configurations (logo + icon + background).
 * Use this for code that needs to accept any crop config (e.g. MediaAssetUploader hooks).
 */
export type MediaAssetCropConfig = LogoCropConfig | IconCropConfig | BackgroundCropConfig;

/**
 * Media asset variant discriminator.
 *
 * - 'logo' — Hero brand mark on the card (issuerLogo in templateSettings)
 * - 'icon' — Push-notification icon (iconImage in templateSettings)
 * - 'background' — Hero strip background image (backgroundImage in templateSettings)
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
 * The 'background' entry is required by the BackgroundUploader plan
 * (L2 Standard, approved 2026-09-01). The variant is the first non-square
 * one — UI mask is rectangular 800×317 (CROP_WINDOW_WIDTH × CROP_WINDOW_HEIGHT).
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
  background: {
    i18nNamespace: 'backgroundUpload',
    cropConfig: BACKGROUND_CROP_CONFIG,
    settingsField: 'backgroundImage' as const,
    cardImageType: 'background' as const,
  },
};
