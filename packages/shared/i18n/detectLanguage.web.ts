/**
 * Web platform language detection.
 * Vite automatically picks this file when bundling for the browser.
 */

import { detectDeviceLanguage as baseDetect, type SupportedLanguage } from './detectLanguage';

/**
 * Detects the user's preferred language from the browser's language settings.
 *
 * Priority:
 * 1. navigator.languages[0] — most preferred locale (e.g. 'zh-TW')
 * 2. navigator.language       — fallback locale (e.g. 'en-US')
 * 3. 'zh-TW'                 — ultimate fallback
 */
export function detectDeviceLanguage(): SupportedLanguage {
  const primary = navigator.languages?.[0] ?? navigator.language;

  if (primary.startsWith('zh')) return 'zh-TW';
  if (primary.startsWith('en')) return 'en';

  return baseDetect();
}
