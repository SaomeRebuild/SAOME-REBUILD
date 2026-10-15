/**
 * Stamp Card namespace — English.
 *
 * @see apps/frontend/src/components/business/stampCard/StampCardImageComposer/ for consumers.
 */
export default {
  composer: {
    title: 'Preview & upload 0.png',
    description: 'Render the current stamp grid settings as an empty template image and upload to R2. The future Scanner will use the same module to generate 1.png ~ 15.png.',
    trigger: {
      previewSaveAsZero: 'Preview & save 0.png',
    },
    status: {
      idle: 'Not uploaded yet',
      composing: 'Composing…',
      uploading: 'Uploading…',
      saved: '0.png uploaded',
      error: 'Upload failed, please retry',
    },
    cap: {
      warning: 'This template has {{count}} stamps which exceeds the cap of 15; no PNG will be generated beyond 16.png.',
    },
    gridTransparent: 'Grid lines are always transparent (0% alpha); Passcreator push will not show a grid border.',
    disabled: {
      noTemplate: 'Please save the template first (Step 8 is required to produce 0.png).',
    },
  },
};
