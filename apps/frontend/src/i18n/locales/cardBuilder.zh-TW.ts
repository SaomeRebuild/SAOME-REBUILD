/**
 * Card Builder — Chinese (Traditional) translations
 * Namespace: cardBuilder
 *
 * @module i18n/locales/cardBuilder.zh-TW
 */

export default {
  pageTitle: '我的模板庫',
  pageDescription: '設計與管理會員卡片。',
  toolbar: {
    buildFromScratch: '從頭建置',
    publicTemplates: '公共模板',
    checkingAuth: '驗證中...',
    building: '建立中...',
    buildErrorDetail: '建立卡片失敗：{{detail}}',
    sessionExpired: '登入已過期，請重新登入後再試。',
  },
  templateLibrary: {
    title: '我的模板庫',
    empty: '尚無模板，從頭建置開始吧。',
  },
  templateCard: {
    edit: '重新編輯',
    send: '發送卡片',
    delete: '刪除卡片',
  },
  toast: {
    draftAbandoned: '草稿已放棄',
    draftRestored: '已復原草稿',
    undo: '復原',
  },
  logoUpload: {
    title: '上傳 Logo',
    selectFile: '選擇圖片',
    dragging: '拖曳調整顯示區域，滾輪縮放',
    uploading: '上傳中...',
    success: 'Logo 上傳成功',
    error: '上傳失敗，請重試',
    remove: '移除 Logo',
    apply: '套用裁切',
    cancel: '取消',
    reset: '重置',
    scale: '縮放',
    hint: 'Logo 會被裁切為正方形（960×960 像素）',
    previewHint: '拖曳移動位置，滾輪縮放範圍',
    validation: {
      tooSmall: '圖片寬度需至少 960 像素',
      tooLarge: '檔案大小需小於 5MB',
      wrongFormat: '僅支援 PNG 或 JPG 格式',
      tooSmallForSave: '圖片太小，無法保存',
    },
  },
};
