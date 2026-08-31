/**
 * Icon Upload — English translations
 * Namespace: iconUpload
 *
 * Component-bound translation for the icon variant of MediaAssetUploader.
 * Mirrors `logoUpload` namespace structure (flat keys + nested validation)
 * so MediaAssetUploader can switch namespaces dynamically without drift.
 *
 * @module i18n/locales/iconUpload.en
 */

export default {
  title: 'Upload Icon',
  selectFile: 'Select Image',
  replace: 'Replace Image',
  dragging: 'Drag to reposition, scroll to zoom',
  uploading: 'Uploading...',
  success: 'Icon uploaded successfully',
  error: 'Upload failed. Please try again.',
  /** Bug-φ fix (Phase 3 of icon-preview plan 2026-08-31): shown when the
   *  uploaded icon's <img src> fails to load (R2 404, expired token, etc.). */
  loadError: 'Image failed to load — please re-upload',
  remove: 'Remove Icon',
  apply: 'Apply Crop',
  cancel: 'Cancel',
  reset: 'Reset',
  scale: 'Zoom',
  hint: 'Icon will be cropped to a square (720×720 pixels) for push notifications',
  previewHint: 'Drag to reposition, scroll to zoom',
  validation: {
    tooSmall: 'Image width must be at least 720 pixels',
    tooLarge: 'File size must be less than 5MB',
    wrongFormat: 'Only PNG or JPG format is supported',
    tooSmallForSave: 'Image too small to save',
  },
};