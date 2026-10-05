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
    send: 'Send Card',
    delete: 'Delete',
    deleting: 'Deleting...',
  },
  toast: {
    draftAbandoned: 'Draft discarded',
    draftRestored: 'Draft restored',
    templateDeleted: 'Template deleted',
    deleteError: 'Delete failed: {{detail}}',
    undo: 'Undo',
  },
};
