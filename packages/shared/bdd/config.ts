/**
 * Cucumber Configuration
 *
 * @module shared/bdd/config
 * @description Cucumber.js configuration for SAOME-REBUILD BDD tests
 *
 * Path resolution:
 *   - Features live in `.specify/memory/specs/spec/<feature>/features/*.feature`
 *     at the REPO ROOT, not in `packages/shared/`.
 *   - We resolve via `process.cwd()` so that running `npm run test:bdd` from the
 *     repo root (via `npm --workspace=packages/shared run test:bdd`) hits the
 *     right features directory.
 */

import { defineConfig } from '@cucumber/cucumber';
import * as path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '../..');
const featuresDir = path.resolve(repoRoot, '.specify/memory/specs/spec');
const stepsDir = path.resolve(repoRoot, 'packages/shared/bdd/steps');

export default defineConfig({
  paths: [`${featuresDir}/**/features/*.feature`],
  require: [
    `${stepsDir}/hooks.ts`,
    `${stepsDir}/navigation.ts`,
    `${stepsDir}/form.ts`,
    `${stepsDir}/assertion.ts`,
    `${stepsDir}/auth.ts`,
  ],
  format: [
    '@cucumber/pretty-formatter',
  ],
  publishQuiet: true,
  retry: 0,
  parallel: 1,
  worldParameters: {
    viewport: { width: 1280, height: 720 },
  },
});
