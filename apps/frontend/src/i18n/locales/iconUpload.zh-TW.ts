/**
 * Icon Upload — Chinese (Traditional) translations
 * Namespace: iconUpload
 *
 * Component-bound translation for the icon variant of MediaAssetUploader.
 * Mirrors `logoUpload` namespace structure (flat keys + nested validation)
 * so MediaAssetUploader can switch namespaces dynamically without drift.
 *
 * @module i18n/locales/iconUpload.zh-TW
 */

export default {
  title: '上傳 Icon',
  selectFile: '選擇圖片',
  replace: '更換圖片',
  dragging: '拖曳調整顯示區域，滾輪縮放',
  uploading: '上傳中...',
  success: 'Icon 上傳成功',
  error: '上傳失敗，請重試',
  /** Bug-φ fix (Phase 3 of icon-preview plan 2026-08-31): shown when the
   *  uploaded icon's <img src> fails to load (R2 404, expired token, etc.). */
  loadError: '圖片載入失敗，請重新上傳',
  remove: '移除 Icon',
  apply: '套用裁切',
  cancel: '取消',
  reset: '重置',
  scale: '縮放',
  hint: 'Icon 會被裁切為正方形（720×720 像素），用於推播通知',
  previewHint: '拖曳移動位置，滾輪縮放範圍',
  validation: {
    tooSmall: '圖片寬度需至少 720 像素',
    tooLarge: '檔案大小需小於 5MB',
    wrongFormat: '僅支援 PNG 或 JPG 格式',
    tooSmallForSave: '圖片太小，無法保存',
  },
};