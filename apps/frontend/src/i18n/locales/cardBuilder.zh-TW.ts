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
    // 2026-10-04 Step 8 — Real data wiring (TemplateCardPreview + 模板庫)
    loading: '載入模板中...',
    loadError: '無法載入模板，請稍後再試。',
    retry: '重試',
  },
  templateCard: {
    edit: '重新編輯',
    // 2026-10-06 — `發送卡片` → `下載桌牌`。模板庫的下載動作對應
    // Step7 的 `ready` 狀態（見 `tableCard.zh-TW.ts::ready`），文案一致。
    send: '下載桌牌',
    // 2026-10-06 — `刪除卡片` → `刪除模板`。操作對象是「模板」而非「卡片」。
    delete: '刪除模板',
    deleting: '刪除中...',
    // 2026-10-06 — 下載桌牌進行中的 in-flight label (mirror of `deleting`)
    downloading: '下載中...',
  },
  toast: {
    draftAbandoned: '草稿已放棄',
    draftRestored: '已復原草稿',
    templateDeleted: '已刪除模板',
    deleteError: '刪除失敗：{{detail}}',
    undo: '復原',
    // 2026-10-06 — table-card download feedback
    tableCardDownloaded: '桌牌下載完成',
    tableCardNotExported: '此模板尚未生成桌牌，請先至編輯器生成',
    downloadError: '下載失敗：{{detail}}',
  },
};
