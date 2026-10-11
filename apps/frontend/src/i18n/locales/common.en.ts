/**
 * Common — English translations
 * Namespace: common
 *
 * Shared error / status messages consumed across multiple namespaces.
 * Adding a new error key here is the canonical place — namespace-local
 * files (auth, cardEditor, etc.) SHOULD import this namespace for
 * common error messages, not duplicate them.
 *
 * @module i18n/locales/common.en
 */

export default {
  error: {
    // 2026-10-11 — Passcreator integration (Step 8 v4 plan).
    // Generic fallback used by the `errorHandler` middleware when
    // an upstream service (Passcreator, etc.) returns a non-2xx
    // response or is unreachable. The `Step8SaveErrorBanner` renders
    // the specific copy from `cardEditor:steps.save.passcreatorSyncFailed.*`
    // when the upstream is 'passcreator' — this key is the GENERIC
    // fallback for any other upstream.
    upstreamFailed: 'Failed to reach the external service. Please try again later.',
  },
};
