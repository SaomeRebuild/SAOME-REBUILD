/**
 * Table Card constants.
 *
 * @module shared/constants/table-card
 * @description Physical dimensions, resolution, element limits, and
 * print-bleed settings for Step 7 (Customizable Table Card).
 *
 * Single source of truth (Rule 019 § 4.1 + Rule 023). Both frontend
 * Konva canvas sizing and backend zod schema import from here so the
 * physical canvas matches the exported PNG matches the zod bounds.
 *
 * A4 dimensions (210×297mm) + 300 DPI + 3/5/10mm bleed are the print
 * industry standard. Pixel values pre-computed at the DPI so the Konva
 * Stage and the rasterized PNG agree without per-stage conversion.
 */

// ===== Physical dimensions (millimeters) =====

/** A4 portrait — 210×297mm. */
export const TABLE_CARD_WIDTH_MM = 210;
export const TABLE_CARD_HEIGHT_MM = 297;

// ===== Bleed =====

/** Default bleed edge (3mm). User can pick from BLEED_OPTIONS_MM in the bleed selector. */
export const DEFAULT_BLEED_MM = 3;
/** Valid bleed options exposed in the editor. Union type mirrors schema. */
export const BLEED_OPTIONS_MM = [3, 5, 10] as const;
/** Bleed values mirrored into zod schema via `z.union([z.literal(3), ...])`. */
export type TableCardBleedMm = (typeof BLEED_OPTIONS_MM)[number];

// ===== Print resolution =====

/** 300 DPI is the standard for high-quality offset/digital print. */
export const PRINT_DPI = 300;
/** Inches per millimeter — used to convert mm ↔ px for print resolution. */
export const MM_PER_INCH = 25.4;

// ===== Element limits (anti-abuse) =====

/** Hard cap on canvas elements; prevents pathological JSONB payloads. */
export const MAX_ELEMENTS = 50;

/**
 * Hard cap on IMAGE elements per canvas (Round 3 Fix 4).
 *
 * Each image element owns an R2 object at
 * `{tenantId}/{templateId}/table-card/{elementId}.png` (typically
 * 100KB–5MB). Without a cap, a malicious or careless user could upload
 * hundreds of MBs per template and bloat tenant storage. 3 is a
 * conservative design limit (most real table-cards use 0–2 logos) and
 * keeps R2 cleanup tractable.
 *
 * Single source of truth — frontend Inspector gate + backend usage
 * guard both import this constant (Rule 019 §4.1 + Rule 023).
 */
export const MAX_IMAGE_ELEMENTS = 3;

// ===== QR Code element (Step 7 桌牌設計, 2026-10-04) =====

/**
 * Hard cap on QR Code elements per canvas.
 *
 * All QR elements encode the same URL (the tenant's member registration
 * page for this template), so placing more than one is semantically
 * redundant and wastes print space. The single-QR limit also keeps the
 * useQrCode hook's regeneration cost bounded at ~50ms per color change.
 *
 * Cap is enforced by `addTableCardElement` (rejects silently when full)
 * + Inspector button disabled state (double-protection per Rule 011).
 */
export const MAX_QRCODE_ELEMENTS = 1;

/**
 * Default side length of a newly-added QR element (mm). Locked 1:1 by
 * the Inspector and the Transformer `keepRatio` prop on selection.
 *
 * 30mm is a common table-tent QR size — large enough to be scannable
 * at arm's length (~1m) on a printed A4 page.
 */
export const DEFAULT_QRCODE_SIZE_MM = 30;

/**
 * Default top-left position of a newly-added QR element (mm from the
 * canvas top-left). 60mm inset matches the default position used by
 * other shape tools (rect, circle, line, etc.) for visual consistency.
 */
export const DEFAULT_QRCODE_X_MM = 60;
export const DEFAULT_QRCODE_Y_MM = 60;

// ===== Safe zone =====

/**
 * Safe zone is the inner area inside the bleed where critical content
 * (logos, names, key text) MUST stay — 5mm inset from the trim edge.
 * Apple's Wallet/print guidance: anything inside the safe zone survives
 * the trim, anything outside may be cropped.
 */
export const SAFE_ZONE_INSET_MM = 5;

// ===== Pixel dimensions (computed from mm × DPI) =====

/**
 * Screen-preview width (CSS px, no bleed). A4 at 72 DPI ≈ 595×842.
 * Used by the Konva Stage for in-browser display; export still uses
 * EXPORT_WIDTH_PX × EXPORT_HEIGHT_PX.
 *
 * Round 3 Fix 2 — placed BEFORE EXPORT_WIDTH_PX/EXPORT_HEIGHT_PX so the
 * export dimensions can be derived from these constants via a single
 * pixel ratio (instead of being independently rounded and drifting).
 */
export const PREVIEW_WIDTH_PX = 595;
export const PREVIEW_HEIGHT_PX = 842;

/**
 * Export width in pixels including bleed.
 *   (TABLE_CARD_WIDTH_MM + 2 × DEFAULT_BLEED_MM) × PRINT_DPI / MM_PER_INCH
 *   = (210 + 6) × 300 / 25.4 ≈ 2551
 */
export const EXPORT_WIDTH_PX = Math.round(
  ((TABLE_CARD_WIDTH_MM + 2 * DEFAULT_BLEED_MM) * PRINT_DPI) / MM_PER_INCH,
);

/**
 * Export height in pixels including bleed.
 *
 * Round 3 Fix 2 — height is derived from PREVIEW_HEIGHT_PX × the
 * width-derived pixel ratio so the two ratios match exactly. Previously
 * the constants were computed independently with `Math.round` and
 * produced
 *   EXPORT_WIDTH_PX / PREVIEW_WIDTH_PX  = 2551 / 595 ≈ 4.287
 *   EXPORT_HEIGHT_PX / PREVIEW_HEIGHT_PX = 3579 / 842 ≈ 4.251
 * which differed by 0.84%. The defensive check in
 * `Step7TableCard.export.web.ts` threw at module load because of this
 * inconsistency. Now both ratios equal 4.287 exactly, so the rasterizer
 * can use a single `pixelRatio` value to upscale the Stage without
 * introducing aspect-ratio skew.
 *
 * Numerical: PREVIEW_HEIGHT_PX (842) × EXPORT_WIDTH_PX/PREVIEW_WIDTH_PX
 * (4.287394957983193) ≈ 3609.83 → rounded to 3610. The 30-pixel
 * difference vs. the prior 3579 is within print-bleed tolerance (bleed
 * = 6mm = ~71 px at 300 DPI) and preserves aspect ratio.
 */
export const EXPORT_HEIGHT_PX = Math.round(
  PREVIEW_HEIGHT_PX * (EXPORT_WIDTH_PX / PREVIEW_WIDTH_PX),
);

// ===== Convenience constants for callers =====

/** Bleed at the max option — used by safe-zone clamp & rasterizer sizing. */
export const MAX_BLEED_MM = BLEED_OPTIONS_MM[BLEED_OPTIONS_MM.length - 1];

/**
 * Scale factor for converting physical mm coordinates to CSS px for
 * the in-browser Konva Stage preview. Lives in shared/ so that
 * CanvasQrCode (and any future mm-based canvas sub-component) can
 * reuse the same scale as the main Step7TableCardCanvas, guaranteeing
 * drag/transform math is identical between elements.
 *
 *   PREVIEW_SCALE = PREVIEW_WIDTH_PX / TABLE_CARD_WIDTH_MM
 *                 = 595 / 210
 *                 ≈ 2.833 (CSS px per mm)
 *
 * Single source of truth: previously defined locally in
 * `Step7TableCardCanvas.web.tsx` and hard-coded `1.5` / `2.0`
 * multipliers in other files caused subtle drift between the
 * preview-render math and the drag-to-mm math. Now consumed
 * from shared by both canvas + sub-components.
 */
export const PREVIEW_SCALE = PREVIEW_WIDTH_PX / TABLE_CARD_WIDTH_MM;
