/**
 * Card Builder — English translations
 * Namespace: cardBuilder
 *
 * @module i18n/locales/cardBuilder.en
 */

export default {
  pageTitle: 'My Template Library',
  pageDescription: 'Design and manage member cards.',
  toolbar: {
    buildFromScratch: 'Build from Scratch',
    publicTemplates: 'Public Templates',
    checkingAuth: 'Verifying...',
    building: 'Building...',
    buildErrorDetail: 'Failed to create card: {{detail}}',
    sessionExpired: 'Session expired. Please log in again.',
  },
  templateLibrary: {
    title: 'My Template Library',
    empty: 'No templates yet. Start by building from scratch.',
    // 2026-10-04 Step 8 — Real data wiring (TemplateCardPreview + template library)
    loading: 'Loading templates...',
    loadError: 'Failed to load templates. Please try again.',
    retry: 'Retry',
  },
  templateCard: {
    edit: 'Edit',
    // 2026-10-06 — `Send Card` → `Download Table Card`. Mirrors the
    // `ready` state in `tableCard.en.ts` (Step7 export column).
    send: 'Download Table Card',
    // 2026-10-06 — `Delete` → `Delete Template`. The action target is the
    // template, not the card.
    delete: 'Delete Template',
    deleting: 'Deleting...',
    // 2026-10-06 — in-flight label for the table-card download button
    // (mirrors `deleting`).
    downloading: 'Downloading...',
  },
  toast: {
    draftAbandoned: 'Draft discarded',
    draftRestored: 'Draft restored',
    templateDeleted: 'Template deleted',
    deleteError: 'Delete failed: {{detail}}',
    undo: 'Undo',
    // 2026-10-06 — table-card download feedback
    tableCardDownloaded: 'Table card downloaded',
    tableCardNotExported: 'Table card not generated yet. Please generate it in the editor first.',
    downloadError: 'Download failed: {{detail}}',
  },
};
