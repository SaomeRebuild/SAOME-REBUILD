/**
 * Cucumber Configuration
 * 
 * @module shared/bdd/config
 * @description Cucumber.js configuration for SAOME-REBUILD BDD tests
 */

import { defineConfig } from '@cucumber/cucumber';

export default defineConfig({
  paths: ['features/**/*.feature'],
  require: [
    'bdd/steps/*.ts',
    'bdd/steps/**/*.ts',
  ],
  format: [
    '@cucumber/pretty-formatter',
  ],
  publishQuiet: true,
  retry: 2,
  parallel: 2,
  worldParameters: {
    viewport: { width: 1280, height: 720 },
  },
});
