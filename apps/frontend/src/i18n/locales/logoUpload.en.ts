/**
 * Logo Upload — English translations
 * Namespace: logoUpload
 *
 * @module i18n/locales/logoUpload.en
 */

export default {
  title: 'Upload Logo',
  selectFile: 'Select Image',
  replace: 'Replace Image',
  dragging: 'Drag to reposition, scroll to zoom',
  uploading: 'Uploading...',
  success: 'Logo uploaded successfully',
  error: 'Upload failed. Please try again.',
  /** Bug-φ fix (Phase 3 of icon-preview plan 2026-08-31): shown when the
   *  uploaded logo's <img src> fails to load (R2 404, expired token, etc.). */
  loadError: 'Image failed to load — please re-upload',
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
};
