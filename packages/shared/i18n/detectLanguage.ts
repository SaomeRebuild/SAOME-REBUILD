/**
 * Language detection for browser environment.
 *
 * This base file provides the shared interface and runtime detection.
 * Both @saome/shared/i18n/detectLanguage (for web) and
 * @saome/shared/i18n/detectLanguage (for RN) export this same function.
 *
 * Detection logic:
 * - navigator.languages[0] — most preferred locale (e.g. 'en-US')
 * - navigator.language       — fallback locale (e.g. 'en')
 * - 'zh-TW'                — ultimate fallback
 */

export const SUPPORTED_LANGUAGES = ['zh-TW', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Detects the user's preferred language from the browser's language settings.
 * Always called at i18n init time for unauthenticated visitors.
 */
export function detectDeviceLanguage(): SupportedLanguage {
  // This file runs in the browser — navigator is always available.
  // In test environments (jsdom) both navigator.languages and navigator.language
  // may be undefined; guard against that to avoid TypeError.
  //
  // Allow TEST_LANG override for unit tests where jsdom's navigator.language='en'
  // would cause detectDeviceLanguage() to return 'en' at i18n init time, breaking
  // tests that expect zh-TW default. setup.ts sets globalThis.process.env.TEST_LANG.
  // Use globalThis.process to avoid ReferenceError in browser where `process` is undefined.
  // Guard against undefined globalThis.process in non-browser environments.
  // This module must work in both browser (Vite) and test (jsdom) contexts.
  // setup.ts sets globalThis.process.env.TEST_LANG for unit tests.
  const testLang = (globalThis as { process?: { env?: { TEST_LANG?: string } } }).process?.env?.TEST_LANG;
  if (testLang === 'zh-TW' || testLang === 'en') {
    return testLang;
  }

  const primary = navigator.languages?.[0] ?? navigator.language ?? null;

  if (primary && primary.startsWith('zh')) return 'zh-TW';
  if (primary && primary.startsWith('en')) return 'en';

  return 'zh-TW';
}
