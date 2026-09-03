/**
 * Default color palette for card builder Step 3 color picker.
 *
 * 20 colors total: 4 grayscale + 16 saturated.
 * Format: 6-char uppercase hex WITHOUT '#' prefix (PassCreator contract).
 *
 * @module shared/constants/color-presets
 */

export const COLOR_PRESETS = [
  // Grayscale
  'FFFFFF', 'F5F5F5', '1A1A1A', '000000',
  // Warm
  'F97316', 'FB923C', 'FBBF24', 'EF4444',
  // Cool
  '22C55E', '14B8A6', '06B6D4', '3B82F6',
  // Brand-ish
  '8B5CF6', 'A855F7', 'EC4899', 'F43F5E',
  // Neutral / muted
  '64748B', '475569', '94A3B8', '27273B',
] as const;

export type ColorPreset = (typeof COLOR_PRESETS)[number];
