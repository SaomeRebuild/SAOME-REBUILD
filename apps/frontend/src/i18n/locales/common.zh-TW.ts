/**
 * Common — Chinese (Traditional) translations
 * Namespace: common
 *
 * Shared error / status messages consumed across multiple namespaces.
 * Adding a new error key here is the canonical place — namespace-local
 * files (auth, cardEditor, etc.) SHOULD import this namespace for
 * common error messages, not duplicate them.
 *
 * @module i18n/locales/common.zh-TW
 */

export default {
  error: {
    // 2026-10-11 — Passcreator integration (Step 8 v4 plan).
    // Triggered when the backend `updateTemplateService` throws
    // `BadGatewayError` (upstream 'passcreator' sync rejected the
    // request). The `Step8SaveErrorBanner` renders the specific
    // copy from `cardEditor:steps.save.passcreatorSyncFailed.*` —
    // this key is the GENERIC fallback used by the `errorHandler`
    // middleware when no namespace-specific banner is in scope.
    upstreamFailed: '連線至外部服務失敗,請稍後再試',
  },
};
