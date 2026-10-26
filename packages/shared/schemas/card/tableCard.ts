/**
 * Step 7 table card (A4 poster) schemas.
 *
 * @module shared/schemas/card/tableCard
 * @description Element union, background, and settings schemas for the
 * printable table card, plus the inferred element types.
 *
 * Part of the card schema contract (Rule 019 § 4.1) — frontend and
 * backend MUST import from `shared/schemas/card`.
 */

import { z } from 'zod';

// ===== Step 7 ??????????(2026-09-27) =====
//
// A4 portrait (210?297mm) canvas with user-configurable bleed (3/5/10mm).
// Frontend Konva canvas renders elements; backend rasterizes the
// exported PNG and stores it in R2 (key: `{tenantId}/{templateId}/table-card-export.png`).
//
// Element types: text, image (R2 key), shape (rect/circle/line).
// All positions/dimensions are in millimeters (mm) at the canvas
// coordinate system; the rasterizer converts to pixels at PRINT_DPI.
//
// Cross-references:
//   - packages/shared/constants/table-card.ts (single source of truth for dimensions)
//   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions table card)
//   - apps/backend/src/modules/cards/schemas/request.ts (backend mirror)
//   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
//
// IMPORTANT: schema is exported at the top level so consumers can
// validate `settings.tableCard` independently (frontend autosave +
// backend export endpoint), not just as part of the full settings
// object.
//
// Note on ordering: defined BEFORE templateSettingsSchema because
// templateSettingsSchema references tableCardSettingsSchema via
// `tableCard: tableCardSettingsSchema.optional()`. JS `const` is not
// hoisted (TDZ); reversed order would throw at module load.
export const tableCardElementSchema = z.discriminatedUnion('type', [
  // ????????
  z.object({
    id: z.string().uuid(),
    type: z.literal('text'),
    /** X position from canvas top-left in mm. */
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    /** Rotation in degrees, [0, 360). */
    rotation: z.number().min(0).max(360).default(0),
    zIndex: z.number().int().nonnegative(),
    /** ??????? ??200 chars (matches DESCRIPTION_MAX_LENGTH). */
    text: z.string().max(200),
    /** ??? in mm (height); Konva ??????????? px. */
    fontSize: z.number().positive(),
    fontWeight: z.enum(['normal', 'bold']),
    /** Hex color 6-digit format. */
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  // ????????
  z.object({
    id: z.string().uuid(),
    type: z.literal('image'),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    rotation: z.number().min(0).max(360).default(0),
    zIndex: z.number().int().nonnegative(),
    /** R2 key: `{tenantId}/{templateId}/table-card/{elementId}.png`. */
    imageKey: z.string().min(1),
    /**
     * 圖片形狀遮罩 (2026-09-27) — bounding box 仍是矩形，但 render
     * 像素裁切成 circle / triangle / rounded-rect。Konva 內建：
     *   - clipShape: 'rect' → 直接傳 cornerRadius 給 Konva.Image
     *   - clipShape: 'circle' / 'triangle' → clipFunc 繪製裁切路徑
     *
     * Backward-compatible：optional 欄位，舊資料不帶這兩個欄位時
     * 預設為「無遮罩 / 無圓角」（與既有渲染一致）。Transformer 仍
     * attach 在矩形 bounding box 上，hit-test / resize 行為不變。
     */
    clipShape: z.enum(['rect', 'circle', 'triangle']).optional(),
    /** 圓角半徑 (mm)，僅 clipShape === 'rect' 時生效。 */
    clipRadius: z.number().min(0).max(50).optional(),
  }),
  // 形狀元素 (矩形 / 圓形 / 線段 / 三角形 / 橢圓形 / 多邊形)
  z.object({
    id: z.string().uuid(),
    type: z.literal('shape'),
    /**
     * Shape kind.
     *   - rect / circle / triangle / ellipse: Konva primitive shapes
     *     (rectangle, inscribed circle, equilateral triangle, ellipse).
     *   - line: 2-point line from (0,0) to (width,height); stroke-only.
     *   - polygon: arbitrary polygon — vertex list stored in `points`
     *     (Konva flat format). The user clicks each vertex during
     *     creation mode in the canvas; the Inspector shows a "Vertex
     *     count" number input that mirrors the length of `points`.
     */
    shape: z.enum(['rect', 'circle', 'line', 'triangle', 'ellipse', 'polygon']),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    rotation: z.number().min(0).max(360).default(0),
    zIndex: z.number().int().nonnegative(),
    fill: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    cornerRadius: z.number().min(0).optional(),
    stroke: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    strokeWidth: z.number().min(0).optional(),
    /**
     * Polygon 頂點 (Konva flat points format: [x1, y1, x2, y2, ...])。
     * 座標系 = element 的 local coordinate space (相對於 bbox top-left,
     * 套用 rotation 之前)。使用者建立 polygon 時 click 點擊的 canvas
     * 座標 → 減去 bbox top-left 存進 points。只有 shape === 'polygon'
     * 時才會用到;其他 shape 沒有 points 欄位。
     *
     * 順序與 `vertexCount` 保持一致 (points.length === vertexCount * 2)。
     * 變更時兩者必須同步更新 (store action 會保證)。
     */
    points: z.array(z.number()).optional(),
    /**
     * Polygon 頂點數 (僅供 debug / analytics / Inspector 顯示用,
     * 真正渲染讀 `points`)。範圍 3-12 (對應 Konva `RegularPolygon`
     * 合理上限);只在 shape === 'polygon' 時有意義。
     */
    vertexCount: z.number().int().min(3).max(12).optional(),
  }),
  // QR Code 元素 (2026-10-04, Step 7 桌牌設計)
  //
  // 即時生成的 QR Code (用 `qrcode` npm 套件, see
  // runs/decisions/2026-10-04-qrcode-library-selection.md).
  // **不**單獨存 R2 (見 plans/step_7_qr_code_*.plan.md § 1.5)—
  // 配方 (value, fgColor, bgColor, errorCorrectionLevel) 存這裡,
  // 每次 mount 由 useQrCode hook 即時生成 HTMLImageElement 給 Konva.Image。
  // 整張桌牌匯出 PNG 自動含 rasterized QR。
  //
  // 鎖 1:1：width === height (store action 在 add 時強制同步;
  // schema 沒用 refine 是因為 z.discriminatedUnion 不支援 union-level
  // refine,而 per-variant refine 在 element-level 太繞。invariant
  // 由 addTableCardElement 進入時把 element.height = element.width
  // 保證)。
  z.object({
    id: z.string().uuid(),
    type: z.literal('qrcode'),
    /** X position from canvas top-left in mm. */
    x: z.number(),
    y: z.number(),
    /** Side length in mm. width === height (lock 1:1). */
    width: z.number().positive(),
    height: z.number().positive(),
    /** Rotation in degrees, [0, 360). */
    rotation: z.number().min(0).max(360).default(0),
    zIndex: z.number().int().nonnegative(),
    /**
     * Encoded URL. Auto-generated as
     * `${env.appBaseUrl}/pass/${cardId}` when the element is added
     * (see Step7TableCardInspector). NOT user-editable — the Inspector
     * shows it as read-only preview only.
     */
    value: z.string().url(),
    /** Foreground (QR "dark" modules) hex color. default '#000000'. */
    fgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#000000'),
    /** Background (QR "light" modules) hex color. default '#ffffff'. */
    bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
    /**
     * Error correction level per QR Code spec:
     *   L =  7% (smallest modules, highest density)
     *   M = 15% (default; recommended for most uses)
     *   Q = 25% (good for outdoor / partially damaged prints)
     *   H = 30% (allows logo overlay in the QR center)
     * Source: ISO/IEC 18004:2015 § 6.5.1.
     */
    errorCorrectionLevel: z.enum(['L', 'M', 'Q', 'H']).default('M'),
  }),
]);

export const tableCardBackgroundSchema = z.object({
  type: z.enum(['solid', 'gradient']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  gradient: z
    .object({
      from: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      to: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      /**
       * Gradient angle in degrees, [0, 360).
       * Convention: 0° = left→right, 90° = top→bottom, clockwise
       * (matches Photoshop / Figma). Mirrored in
       * packages/shared/logic/tableCard.ts::gradientAngleToEndPoints —
       * keep the two in sync.
       */
      angle: z.number().min(0).max(360),
    })
    .optional(),
});

export const tableCardSettingsSchema = z.object({
  /**
   * ???????????: ???? / ???? / ???. ????50 (?????.
   * Each element has x/y/width/height/rotation/zIndex.
   * zIndex 0 = bottom layer; sortByZIndex(elements) ???????
   */
  elements: z.array(tableCardElementSchema).max(50),
  /** ???????: ??? / ??. */
  background: tableCardBackgroundSchema,
  /** ???????: ??? 3mm. */
  bleedMm: z.union([z.literal(3), z.literal(5), z.literal(10)]).default(3),
  /**
   * ???????export ??R2 key.
   * ??????export endpoint ??;??? useTableCardExport hook ??????stale.
   * Optional: ???? export ??????.
   */
  exportKey: z.string().optional(),
  /** ???????export ??ISO timestamp. ??? stale ???? (Rule 030 baseline pattern). */
  lastExportedAt: z.string().optional(),
});

// ===== Step 7 ??Table Card inferred types (2026-09-27) =====
//
// Re-export zod-inferred types so consumers (frontend store, backend
// service signatures) can reference them without re-importing zod.
// Use `z.infer` to stay in sync with schema changes automatically.

export type TableCardTextElement = z.infer<typeof tableCardElementSchema> & {
  type: 'text';
};
export type TableCardImageElement = z.infer<typeof tableCardElementSchema> & {
  type: 'image';
};
export type TableCardShapeElement = z.infer<typeof tableCardElementSchema> & {
  type: 'shape';
};
// ===== Step 7 QR Code element (2026-10-04) =====
//
// See `tableCardElementSchema` discriminated-union variant above for
// field-by-field constraints. Inferred type is re-exported here for
// consumer ergonomics (avoids re-importing zod in components / hooks).
//
//   - Canvas: `CanvasQrCode` (apps/frontend/.../Step7TableCard/) feeds
//     `useQrCode(element.value, element.fgColor, element.bgColor,
//     element.errorCorrectionLevel)` to Konva.Image
//   - Inspector: 2× ColorSwatchPicker (fgColor / bgColor) + 1× select
//     (errorCorrectionLevel) + read-only URL preview
//   - Store: `addTableCardElement` enforces MAX_QRCODE_ELEMENTS=1 cap
//     + 1:1 invariant (`height = width`)
export type TableCardQrCodeElement = z.infer<typeof tableCardElementSchema> & {
  type: 'qrcode';
};
export type TableCardElement = z.infer<typeof tableCardElementSchema>;
export type TableCardBackground = z.infer<typeof tableCardBackgroundSchema>;
export type TableCardSettings = z.infer<typeof tableCardSettingsSchema>;
