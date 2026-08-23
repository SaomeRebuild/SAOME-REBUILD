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
  },
  templateCard: {
    edit: 'Edit',
    send: 'Send Card',
    delete: 'Delete',
  },
  toast: {
    draftAbandoned: 'Draft discarded',
    draftRestored: 'Draft restored',
    undo: 'Undo',
  },
  logoUpload: {
    title: 'Upload Logo',
    selectFile: 'Select Image',
    replace: 'Replace Image',
    dragging: 'Drag to reposition, scroll to zoom',
    uploading: 'Uploading...',
    success: 'Logo uploaded successfully',
    error: 'Upload failed. Please try again.',
    remove: 'Remove Logo',
    apply: 'Apply Crop',
    cancel: 'Cancel',
    reset: 'Reset',
    scale: 'Zoom',
    hint: 'Logo will be cropped to a square (960×960 pixels)',
    previewHint: 'Drag to reposition, scroll to zoom',
    validation: {
      tooSmall: 'Image width must be at least 960 pixels',
      tooLarge: 'File size must be less than 5MB',
      wrongFormat: 'Only PNG or JPG format is supported',
      tooSmallForSave: 'Image too small to save',
    },
  },
};
