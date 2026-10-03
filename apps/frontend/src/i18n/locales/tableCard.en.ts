/**
 * tableCard — Step 7 Customize Table Card component-bound namespace (English).
 *
 * Mirror of tableCard.zh-TW.ts. Same flat-key structure (Rule 023):
 *   - Use `useTranslation('tableCard')` then `t('tools.text')` etc.
 *   - No namespace prefix in the key (`t('tableCard.tools.text')` would fail).
 *
 * Translation discipline (Rule 023):
 *   - Strict English. No mixed CJK characters.
 *   - Mirrors zh-TW key tree exactly (verified by Step7TableCard.i18n.test.ts).
 */

export default {
  pageTitle: 'Customize Table Card',

  // ===== Canvas (Konva Stage) =====
  canvas: {
    ariaLabel: 'Table card design canvas',
    safeZoneLabel: 'Safe zone',
    bleedLabel: 'Bleed area',
    bleedOverlayLabel: 'Bleed settings (dashed line shows safe-zone boundary)',
    backgroundAriaLabel: 'Canvas background',
    elementAriaLabel: 'Canvas element {{name}}',
    addElementHint: 'Add elements from the toolbar',
  },

  // ===== Toolbar — 6 main tools (text / image / qrcode / background / shape / layers) =====
  tools: {
    text: 'Text',
    image: 'Image',
    // 2026-10-04 — QR Code tool (Step 7 桌牌設計).
    // Encoded value is `${appBaseUrl}/pass/${templateId}` (auto-generated,
    // not user-editable). 1-per-template cap, locked 1:1, adjustable
    // foreground / background colors.
    qrcode: 'QR Code',
    background: 'Background',
    shape: 'Shape',
    layers: 'Layers',
    ariaLabel: 'Table card tools',
  },

  // ===== Header slot (Issue 7) — export button lives in Header =====
  header: {
    tableCardAriaLabel: 'Table card generator',
    tableCardTitle: 'Generate table card and save to cloud',
  },

  // ===== Right Sidebar (Issue 8) — toolbar + inspector container =====
  rightSidebar: {
    ariaLabel: 'Table card tools and properties',
    emptyHint: 'Select a canvas element to edit its properties',
    desktopOnlyHint: 'The right panel is desktop-only. Use the bottom toolbar on mobile.',
  },

  // ===== Selection Bar (Issues 5 & 6) — persistent delete + color =====
  selectionBar: {
    selected: 'Selected: {{type}}',
    colorLabel: 'Color',
    colorLockedHint: 'Image elements cannot change color',
    deleteButton: 'Delete element',
    deleteConfirm: 'Delete this element? This cannot be undone.',
    typeText: 'Text',
    typeImage: 'Image',
    typeShape: 'Shape',
    // 2026-10-04 — QR Code type label (shared by Inspector / SelectionBar)
    typeQrcode: 'QR Code',
    /**
     * Round 4 — Issue 1. 1-based creation-order number suffix
     * appended to the type label so users can identify which element
     * they are operating. Mirrors the layers list row format.
     *   Example: Shape Element 8 / Text Element 1 / Image Element 3
     */
    elementNumber: 'Element {{num}}',
  },

  // ===== Text element inspector =====
  text: {
    label: 'Text content',
    placeholder: 'Enter text…',
    fontSize: 'Font size',
    fontSizeUnit: 'mm',
    fontWeight: 'Weight',
    normal: 'Regular',
    bold: 'Bold',
    color: 'Color',
    alignment: 'Alignment',
    alignLeft: 'Left',
    alignCenter: 'Center',
    alignRight: 'Right',
    maxLength: 'Up to 200 characters',
    counter: '{{count}} / 200',
    /**
     * Round 6 (2026-09-27) — Inspector switched <input> to <textarea>;
     * the text tool now supports Enter to break lines (multi-line input).
     * The counter includes \n characters.
     */
    lineBreakHint: 'Press Enter to break line. Up to 200 characters.',
  },

  // ===== Image element inspector =====
  image: {
    upload: 'Upload image',
    uploadAriaLabel: 'Choose table card image file',
    uploading: 'Uploading…',
    uploaded: 'Uploaded successfully',
    uploadHint: 'Click or drag a PNG or JPG file',
    maxSize: 'Maximum 5MB',
    replaceImage: 'Replace image',
    removeImage: 'Remove image',
    aspectLock: 'Lock aspect ratio',
    width: 'Width',
    height: 'Height',
    /**
     * Round 3 Fix 4 — image element hard cap (MAX_IMAGE_ELEMENTS = 3).
     * Shown on the upload button label + a warning hint below it when
     * the user has reached the per-template limit.
     */
    atLimit: 'Limit reached ({{max}})',
    limitHint: 'Delete an image before uploading more. Keeps R2 storage bounded.',
    validation: {
      tooLarge: 'File size must be less than 5MB',
      wrongFormat: 'Only PNG or JPG format is supported',
      uploadFailed: 'Upload failed. Please try again.',
    },
    /**
     * Round 6 (2026-09-27) — image shape transformation. The bounding
     * box stays rectangular, but rendered pixels are clipped to circle
     * / triangle / rounded-rect.
     * - shapeLabel — Inspector section header
     * - shapeRect / shapeCircle / shapeTriangle — three toggle buttons
     * - clipRadius / clipRadiusUnit — corner radius input (rect only)
     */
    shapeLabel: 'Shape',
    shapeRect: 'Rectangle',
    shapeCircle: 'Circle',
    shapeTriangle: 'Triangle',
    clipRadius: 'Corner radius',
    clipRadiusUnit: 'mm',
  },

  // ===== Background panel =====
  background: {
    type: 'Background type',
    solid: 'Solid',
    gradient: 'Gradient',
    color: 'Color',
    from: 'Start color',
    to: 'End color',
    angle: 'Gradient angle',
    angleUnit: 'degrees',
  },

  // ===== Shape panel =====
  shape: {
    rect: 'Rectangle',
    circle: 'Circle',
    line: 'Line',
    // Round 10 (2026-09-27) — new shapes
    triangle: 'Triangle',
    ellipse: 'Ellipse',
    polygon: 'Polygon',
    addRect: 'Add rectangle',
    addCircle: 'Add circle',
    addLine: 'Add line',
    addTriangle: 'Add triangle',
    addEllipse: 'Add ellipse',
    addPolygon: 'Add polygon',
    fill: 'Fill',
    fillNone: 'No fill',
    cornerRadius: 'Corner radius',
    cornerRadiusUnit: 'mm',
    stroke: 'Stroke',
    strokeColor: 'Stroke color',
    strokeWidth: 'Stroke width',
    strokeWidthUnit: 'mm',
    // Round 11 — polygon creation mode (click to add vertices)
    sides: 'Vertex count',
    sidesHint: 'Range 3-12. Drag vertices to fine-tune after creation.',
    // Round 11 — copy synced. Enter / double-click were removed from
    // the canvas (replaced by the on-canvas "完成" button) so the
    // hint describes the actual user flow: click to add vertices,
    // tap the Done button, or drag vertices to fine-tune.
    //
    // Round 15 (2026-09-27) — shortened "Finish polygon" → "Done".
    // The previous wording was wordy for a 2-word button next to a
    // Cancel button. "Done" matches SAOME's terser copy convention
    // (e.g. Save / Delete elsewhere) and the surrounding UI now
    // (Inspector panel + on-canvas floating button) scopes the
    // action to polygon creation implicitly.
    polygonHint: '{{count}} vertices added — click stage to add vertices, tap the Done button next to the last vertex, or drag vertices to fine-tune',
    polygonFinish: 'Done',
    polygonCancel: 'Cancel',
  },

  // ===== QR Code panel (2026-10-04, Step 7 桌牌設計) =====
  //
  // Mirrors the schema variant in `packages/shared/schemas/card.ts`.
  // Inspector renders:
  //   - "Add QR Code" button (shown when no QR element; disabled at cap)
  //   - URL preview (read-only, lets users scan to verify)
  //   - 2× ColorSwatchPicker (fgColor / bgColor)
  //   - Error correction select (L / M / Q / H)
  qrcode: {
    title: 'QR Code',
    addLabel: 'Add QR Code',
    addHint: 'Click to add a QR code that lets customers register this Pass.',
    valueLabel: 'Encoded value',
    valueHint: 'Auto-generated. Cannot be edited.',
    fgColorLabel: 'Foreground color',
    bgColorLabel: 'Background color',
    ecLevelLabel: 'Error correction',
    ecLevelL: 'Low (7%)',
    ecLevelM: 'Medium (15%, recommended)',
    ecLevelQ: 'Quartile (25%)',
    ecLevelH: 'High (30%)',
    reachedCap: 'Only 1 QR code is allowed per table card.',
  },

  // ===== Layers panel =====
  layers: {
    title: 'Layers',
    hint: 'Use the buttons to reorder layers.',
    bringToFront: 'Bring to front',
    sendToBack: 'Send to back',
    bringForward: 'Bring forward',
    sendBackward: 'Send backward',
    delete: 'Delete',
    empty: 'Canvas has no elements',
    zIndexBadge: 'Layer {{z}}',
    elementTypeLabel: {
      text: 'Text',
      image: 'Image',
      shape: 'Shape',
      // 2026-10-04 — QR Code type label in the layers list
      qrcode: 'QR Code',
    },
  },

  // ===== Bleed selector =====
  bleed: {
    label: 'Bleed settings',
    hint: 'Trim along the dashed line after printing. The bleed area prevents white edges.',
    option3mm: '3 mm (standard)',
    option5mm: '5 mm (safe)',
    option10mm: '10 mm (heavy bleed)',
  },

  // ===== Delete confirmation =====
  delete: {
    confirmTitle: 'Delete element',
    confirmMessage: 'Are you sure you want to delete "{{name}}"? This cannot be undone.',
    confirmButton: 'Delete',
    cancelButton: 'Cancel',
  },

  // ===== 5-state export button =====
  exportButton: {
    idle: 'Generate Table Card',
    generating: 'Generating…',
    ready: 'Download Table Card',
    stale: 'Re-generate',
    error: 'Retry generation',
    staleTooltip: 'Canvas has changed. Re-generate to use the latest design.',
    errorTooltip: 'Last generation failed. Please retry.',
    ariaLabel: 'Generate and download table card',
  },

  // ===== Toast feedback =====
  toast: {
    success: 'Table card generated. Download started.',
    downloadStarted: 'Download started',
    staleWarning: 'Canvas has changed. Re-generate to use the latest design.',
    failed: 'Generation failed: {{message}}',
    retry: 'Retry',
  },

  // ===== Errors =====
  errors: {
    networkError: 'Network error. Please check your connection.',
    serverError: 'Server error. Please try again later.',
    blobError: 'Canvas export failed. Please retry.',
    validationError: 'Canvas settings invalid: {{message}}',
  },

  // ===== Step 7 guard (2026-10-04 PR) =====
  // After designing the custom table card, the user must click the
  // "Generate" button before advancing to Step 8. This guard prevents
  // users from saving a card without ever designing a table card.
  step7Guard: {
    /** Red hint shown below the disabled "Next" button on Step 7. */
    mustGenerateFirst: 'Please click the "Generate Table Card" button above first before proceeding.',
  },
};
