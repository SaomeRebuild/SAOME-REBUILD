// Smoke-only Cucumber Configuration
//
// Used by `npm run test:bdd:smoke` for the spec-bundle sanity check.
// This config validates that:
//   - Feature files are discoverable at .specify/memory/specs/spec/**/features/*.feature
//   - Gherkin parses correctly (no syntax errors)
//   - Step definitions load without throwing at import time
// It does NOT execute scenarios against a browser (that requires a live app + backend).
//
// To run real BDD scenarios:
//   1. Start frontend:  npm run dev   (http://localhost:5173)
//   2. Start backend:   cd saome-backend && npm run dev  (http://localhost:8787)
//   3. Run:             npm run test:bdd  (against live app)

const path = require('node:path');
const toPosix = (p) => p.replace(/\\/g, '/');

const repoRoot = __dirname;
const featuresDir = toPosix(path.resolve(repoRoot, '.specify/memory/specs/spec'));
const stepsDir = toPosix(path.resolve(repoRoot, 'packages/shared/bdd/steps'));

module.exports = {
  default: {
    paths: [
      `${featuresDir}/002-tenant-auth/features/*.feature`,
    ],
    require: [
      `${stepsDir}/hooks.ts`,
      `${stepsDir}/navigation.ts`,
      `${stepsDir}/form.ts`,
      `${stepsDir}/assertion.ts`,
      `${stepsDir}/auth.ts`,
    ],
    format: ['progress'],
    retry: 0,
    parallel: 1,
    dryRun: true,
    worldParameters: {
      viewport: { width: 1280, height: 720 },
    },
  },
};
