/**
 * Background Upload — English translations
 * Namespace: backgroundUpload
 *
 * Component-bound translation for the background variant of MediaAssetUploader.
 * Mirrors `logoUpload` / `iconUpload` namespace structure (flat keys + nested validation)
 * so MediaAssetUploader can switch namespaces dynamically without drift.
 *
 * Content spec: PassCreator background image field — 1860×738 pixels minimum,
 * landscape orientation (upper area of the Wallet pass).
 *
 * @module i18n/locales/backgroundUpload.en
 */

export default {
  title: 'Upload Background',
  selectFile: 'Select Image',
  replace: 'Replace Image',
  dragging: 'Drag to reposition, scroll to zoom',
  uploading: 'Uploading...',
  success: 'Background image uploaded successfully',
  error: 'Upload failed. Please try again.',
  loadError: 'Image failed to load — please re-upload',
  remove: 'Remove Background',
  apply: 'Apply Crop',
  cancel: 'Cancel',
  reset: 'Reset',
  scale: 'Zoom',
  hint: 'Background image will be cropped to 1860×738 pixels (2.52:1 landscape) for the card header area',
  previewHint: 'Drag to reposition, scroll to zoom',
  validation: {
    tooSmall: 'Image must be at least 1860×738 pixels',
    tooLarge: 'File size must be less than 5MB',
    wrongFormat: 'Only PNG or JPG format is supported',
    tooSmallForSave: 'Image too small to save',
  },
};
