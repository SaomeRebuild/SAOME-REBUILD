/**
 * Background Upload — Chinese (Traditional) translations
 * Namespace: backgroundUpload
 *
 * Component-bound translation for the background variant of MediaAssetUploader.
 * Mirrors `logoUpload` / `iconUpload` namespace structure (flat keys + nested validation)
 * so MediaAssetUploader can switch namespaces dynamically without drift.
 *
 * Content spec: PassCreator background image field — 1860×738 pixels minimum,
 * landscape orientation (upper area of the Wallet pass).
 *
 * @module i18n/locales/backgroundUpload.zh-TW
 */

export default {
  title: '上傳背景圖',
  selectFile: '選擇圖片',
  replace: '更換圖片',
  dragging: '拖曳調整顯示區域，滾輪縮放',
  uploading: '上傳中...',
  success: '背景圖上傳成功',
  error: '上傳失敗，請重試',
  loadError: '圖片載入失敗，請重新上傳',
  remove: '移除背景圖',
  apply: '套用裁切',
  cancel: '取消',
  reset: '重置',
  scale: '縮放',
  hint: '背景圖會被裁切為 1860×738 像素（2.52:1 寬幅），用於卡片頂部區域',
  previewHint: '拖曳移動位置，滾輪縮放範圍',
  validation: {
    tooSmall: '圖片寬度需至少 1860 像素、高度需至少 738 像素',
    tooLarge: '檔案大小需小於 5MB',
    wrongFormat: '僅支援 PNG 或 JPG 格式',
    tooSmallForSave: '圖片太小，無法保存',
  },
};
