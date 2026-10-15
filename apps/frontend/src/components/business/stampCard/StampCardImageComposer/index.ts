/**
 * StampCardImageComposer — public barrel.
 *
 * @module business/stampCard/StampCardImageComposer
 * @description CardBuilder Step 3 / future Scanner call this module to
 * compose a stamp card PNG on the tenant device and upload it to R2.
 */
export { StampCardImageComposer } from './StampCardImageComposer';
export type { StampCardImageComposerProps } from './StampCardImageComposer';
export { useStampCardImageComposer } from './StampCardImageComposer.hooks';
export type {
  UseStampCardImageComposerOptions,
  UseStampCardImageComposerReturn,
} from './StampCardImageComposer.hooks';
export { composeStampCardImage } from './composeStampCardImage';
export {
  uploadStampCardImage,
  UploadStampCardImageError,
} from './uploadStampCardImage';
export type {
  ComposeStampCardImageFn,
  StampCardComposerStatus,
  StampCardComposerSaveResult,
} from './StampCardImageComposer.types';
