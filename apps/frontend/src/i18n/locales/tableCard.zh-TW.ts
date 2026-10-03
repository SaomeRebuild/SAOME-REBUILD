/**
 * tableCard — Step 7 客製化桌牌 component-bound namespace (zh-TW).
 *
 * Per Rule 023 § 元件化原則, the L2 業務元件 `Step7TableCard` binds
 * its own namespace (`tableCard`) — keeping `cardEditor` from bloating
 * past ~600 lines. Page-level strings (Step indicator labels, Header
 * actions) stay in `cardEditor`; element-level strings live here.
 *
 * Translation discipline (Rule 023):
 *   - 嚴格全中文, 禁止摻雜英文單字 (`API` / `URL` 等約定俗成譯名例外)
 *   - flat key 結構 (e.g. `tools.text` not `{ tools: { text: '...' } }`)
 *
 * 對齊 Phase 5 實作的 element / button copy:
 *   - canvas.* — ARIA labels for screen readers
 *   - tools.* — toolbar 5 工具按鈕 label
 *   - text/image/background/shape/layers.* — Inspector 區塊
 *   - bleed.* — 出血設定
 *   - exportButton.* — 5 狀態 export button (idle/generating/ready/stale/error)
 *   - toast.* — 操作反饋 toast
 *   - errors.* — 錯誤訊息 i18n key
 */

export default {
  pageTitle: '客製化桌牌',

  // ===== Canvas (Konva Stage) =====
  canvas: {
    ariaLabel: '桌牌設計畫布',
    safeZoneLabel: '安全區',
    bleedLabel: '出血區',
    bleedOverlayLabel: '出血設定（虛線框為安全區邊界）',
    backgroundAriaLabel: '畫布背景',
    elementAriaLabel: '畫布元素 {{name}}',
    addElementHint: '從工具列新增元素',
  },

  // ===== Toolbar — 6 main tools (text / image / qrcode / background / shape / layers) =====
  tools: {
    text: '文字',
    image: '圖片',
    // 2026-10-04 — QR Code 工具 (Step 7 桌牌設計).
    // 編碼值為 `${appBaseUrl}/pass/${templateId}` (自動產生, 不可由使用者覆寫),
    // 每模板上限 1 個, 鎖 1:1 比例, 可調前景 / 背景色。
    qrcode: 'QR 碼',
    background: '背景',
    shape: '形狀',
    layers: '圖層',
    ariaLabel: '桌牌工具',
  },

  // ===== Header slot (Issue 7) — export button lives in Header =====
  header: {
    tableCardAriaLabel: '桌牌生成按鈕',
    tableCardTitle: '生成桌牌並儲存到雲端',
  },

  // ===== Right Sidebar (Issue 8) — toolbar + inspector container =====
  rightSidebar: {
    ariaLabel: '桌牌工具與屬性',
    emptyHint: '選取畫布上的元素以編輯屬性',
    desktopOnlyHint: '右側面板僅在桌機顯示，手機請使用底部工具列',
  },

  // ===== Selection Bar (Issues 5 & 6) — persistent delete + color =====
  selectionBar: {
    selected: '已選取：{{type}}',
    colorLabel: '顏色',
    colorLockedHint: '圖片元素無法調整顏色',
    deleteButton: '刪除元素',
    deleteConfirm: '確定刪除此元素？此操作無法復原。',
    typeText: '文字',
    typeImage: '圖片',
    typeShape: '形狀',
    // 2026-10-04 — QR 碼元素類型標籤 (Inspector / SelectionBar 共用)
    typeQrcode: 'QR 碼',
    /**
     * Round 4 — Issue 1. The 1-based creation-order number suffix
     * appended to the type label so users can identify which element
     * they are operating. Mirrors the layers list row format so the
     * two UIs share the same mental model.
     *   Example: 形狀 元素 8 / 文字 元素 1 / 圖片 元素 3
     */
    elementNumber: '元素 {{num}}',
  },

  // ===== Text element inspector =====
  text: {
    label: '文字內容',
    placeholder: '輸入文字…',
    fontSize: '字級',
    fontSizeUnit: '毫米',
    fontWeight: '粗細',
    normal: '標準',
    bold: '粗體',
    color: '顏色',
    alignment: '對齊',
    alignLeft: '靠左',
    alignCenter: '置中',
    alignRight: '靠右',
    maxLength: '最多 200 字',
    counter: '{{count}} / 200',
    /**
     * Round 6 (2026-09-27) — Inspector 將 <input> 換成 <textarea>，
     * 文字工具現在支援 Enter 換行（多行輸入）。Counter 已包含 \n。
     * "Enter" 鍵在 zh-TW 全中文化紀律下譯為「確認鍵」(對應 SAOME
     * 既有 keyboard hint 用法)。鍵盤實際按鍵名稱保持 Enter,但 UI 文字
     * 嚴格用中文描述。
     */
    lineBreakHint: '按確認鍵換行，最多 200 字',
  },

  // ===== Image element inspector =====
  image: {
    upload: '上傳圖片',
    uploadAriaLabel: '選擇桌牌圖片檔案',
    uploading: '上傳中…',
    uploaded: '上傳成功',
    uploadHint: '點擊或拖曳 PNG 或 JPG 檔案',
    maxSize: '檔案上限 5MB',
    replaceImage: '更換圖片',
    removeImage: '移除圖片',
    aspectLock: '鎖定長寬比',
    width: '寬度',
    height: '高度',
    /**
     * Round 3 Fix 4 — image element hard cap (MAX_IMAGE_ELEMENTS = 3).
     * Shown on the upload button label + a warning hint below it when
     * the user has reached the per-template limit.
     */
    atLimit: '已達上限 ({{max}} 張)',
    limitHint: '請先刪除其他圖片再上傳，避免 R2 空間膨脹',
    validation: {
      tooLarge: '檔案大小需小於 5MB',
      wrongFormat: '僅支援 PNG 或 JPG 格式',
      uploadFailed: '上傳失敗, 請重試',
    },
    /**
     * Round 6 (2026-09-27) — 圖片形狀變形工具。Bounding box 仍是矩形，
     * 但 render 像素裁切成圓形 / 三角形 / 圓角矩形。
     * - shapeLabel — Inspector section header
     * - shapeRect / shapeCircle / shapeTriangle — 3 個 toggle 按鈕 label
     * - clipRadius / clipRadiusUnit — 僅 rect 顯示的圓角輸入
     */
    shapeLabel: '形狀',
    shapeRect: '矩形',
    shapeCircle: '圓形',
    shapeTriangle: '三角形',
    clipRadius: '圓角',
    clipRadiusUnit: '毫米',
  },

  // ===== Background panel =====
  background: {
    type: '背景類型',
    solid: '單色',
    gradient: '漸層',
    color: '顏色',
    from: '起始色',
    to: '結束色',
    angle: '漸層角度',
    angleUnit: '度',
  },

  // ===== Shape panel =====
  shape: {
    rect: '矩形',
    circle: '圓形',
    line: '線段',
    // Round 10 (2026-09-27) — 新增 3 個形狀
    triangle: '三角形',
    ellipse: '橢圓形',
    polygon: '多邊形',
    addRect: '新增矩形',
    addCircle: '新增圓形',
    addLine: '新增線段',
    addTriangle: '新增三角形',
    addEllipse: '新增橢圓形',
    addPolygon: '新增多邊形',
    fill: '填色',
    fillNone: '無填色',
    cornerRadius: '圓角',
    cornerRadiusUnit: '毫米',
    stroke: '邊框',
    strokeColor: '邊框顏色',
    strokeWidth: '邊框粗細',
    strokeWidthUnit: '毫米',
    // Round 11 — polygon 創建模式
    sides: '頂點數',
    sidesHint: '範圍 3-12,建立後可拖曳頂點微調形狀',
    /**
     * Round 15 (2026-09-27) — 文案改為「完成」。
     * 之前「完成多邊形」太具體,在 Inspector 與畫布浮動按鈕都使用同一個
     * key。Round 11 移除了 Enter / 雙擊(改用畫布上的「完成多邊形」按鈕)
     * 後,文字本身就失焦了:使用者看到「完成」就夠了,後面那個「多邊形」
     * 跟旁邊已經在建的「新增多邊形」按鈕文字重複,反而混淆。
     * 改為更短的「完成」,Inspector 旁的「取消」按鈕仍然把這個動作
     * 範圍框得很清楚。
     */
    polygonHint: '已加入 {{count}} 個頂點 — 點擊畫布加頂點,完成按鈕在最後一個頂點旁,或拖曳頂點微調',
    polygonFinish: '完成',
    polygonCancel: '取消',
  },

  // ===== QR Code panel (2026-10-04, Step 7 桌牌設計) =====
  //
  // Mirrors the schema variant in `packages/shared/schemas/card.ts`.
  // Inspector renders:
  //   - 「新增 QR 碼」按鈕 (無 QR 元素時顯示, 已達上限時 disabled)
  //   - URL preview (唯讀, 顯示實際編碼內容供使用者掃碼驗證)
  //   - 2× ColorSwatchPicker (fgColor / bgColor)
  //   - 容錯等級 select (L / M / Q / H)
  qrcode: {
    title: 'QR 碼',
    addLabel: '新增 QR 碼',
    addHint: '點擊新增 QR 碼,掃描可註冊這張 Pass',
    valueLabel: '編碼內容',
    valueHint: '自動產生,無法修改',
    fgColorLabel: '前景色',
    bgColorLabel: '背景色',
    ecLevelLabel: '容錯等級',
    ecLevelL: '低（7%）',
    ecLevelM: '中（15%,推薦）',
    ecLevelQ: '高（25%）',
    ecLevelH: '最高（30%）',
    reachedCap: '每張桌牌只能放 1 個 QR 碼',
  },

  // ===== Layers panel =====
  layers: {
    title: '圖層',
    hint: '使用按鈕調整圖層順序',
    bringToFront: '移到最上',
    sendToBack: '移到最下',
    bringForward: '上移一層',
    sendBackward: '下移一層',
    delete: '刪除',
    empty: '畫布尚無元素',
    zIndexBadge: '圖層 {{z}}',
    elementTypeLabel: {
      text: '文字',
      image: '圖片',
      shape: '形狀',
      // 2026-10-04 — QR Code 圖層列類型標籤 (與新增的 qrcode 變體對應)
      qrcode: 'QR 碼',
    },
  },

  // ===== Bleed selector =====
  bleed: {
    label: '出血設定',
    hint: '列印後沿虛線裁切, 留下出血區可避免白邊',
    option3mm: '3 毫米 (標準)',
    option5mm: '5 毫米 (保險)',
    option10mm: '10 毫米 (大量出血)',
  },

  // ===== Delete confirmation =====
  delete: {
    confirmTitle: '刪除元素',
    confirmMessage: '確定要刪除「{{name}}」嗎？此操作無法復原。',
    confirmButton: '刪除',
    cancelButton: '取消',
  },

  // ===== 5-state export button =====
  // Maps to `tableCardExportState` in store:
  //   idle       → "生成桌牌"       (no export yet)
  //   generating → "生成中…"        (POST in flight)
  //   ready      → "下載桌牌"       (last export OK)
  //   stale      → "重新生成"       (canvas changed since last export)
  //   error      → "重試生成桌牌"   (last export failed)
  exportButton: {
    idle: '生成桌牌',
    generating: '生成中…',
    ready: '下載桌牌',
    stale: '重新生成',
    error: '重試生成桌牌',
    staleTooltip: '畫布已變更, 需重新生成才會使用最新設計',
    errorTooltip: '上次生成失敗, 請重試',
    ariaLabel: '桌牌生成與下載',
  },

  // ===== Toast feedback =====
  toast: {
    success: '桌牌已生成, 下載已開始',
    downloadStarted: '下載開始',
    staleWarning: '畫布已變更, 需重新生成才會使用最新設計',
    failed: '生成失敗: {{message}}',
    retry: '重試',
  },

  // ===== Errors (i18n keys for shared error mapping) =====
  errors: {
    networkError: '網路錯誤, 請檢查連線',
    serverError: '伺服器錯誤, 請稍後再試',
    blobError: '畫布轉檔失敗, 請重試',
    validationError: '畫布設定無效: {{message}}',
  },

  // ===== Step 7 防呆 (2026-10-04 PR) =====
  // 客製化桌牌設計完成後, 使用者必須按「生成桌牌」按鈕才能進入 Step 8。
  // 這層 guard 避免使用者忘記設計桌牌就儲存卡片。
  step7Guard: {
    /**
     * 「下一步」按鈕 disabled 時顯示在按鈕下方的紅字提示。
     * 引導使用者按 Header 上的「生成桌牌」按鈕(剛按完第一次會變成
     * 「下載桌牌」/「重新生成」/「重試生成桌牌」, 視 export 狀態而定)。
     */
    mustGenerateFirst: '請先按上方「生成桌牌」按鈕生成一次桌牌, 才能進入下一步',
  },
};
