import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from '@/hooks';
import { ThemeProvider } from '@/components/ui/theme';
import i18n from 'i18next';

/**
 * Render the app. Blocks until i18n is ready.
 *
 * In dev (HMR), `./i18n` runs first via module-order; `init()` is synchronous.
 * In production (tree-shaken), `init()` is also synchronous — just call it again
 * if needed. Using `isInitialized` guard prevents double-init side-effects.
 *
 * Previous attempt: `void (i18n as unknown as {initPromise}).initPromise.then(...)`
 * Failed because i18next 26.x `init()` does NOT return a Promise (returns `i18n`
 * instance synchronously), so `.then()` threw `TypeError: undefined.then is not
 * a function` and the entire React tree never mounted.
 */
function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

if (i18n.isInitialized) {
  // Module loaded in order; init already done.
  renderApp();
} else {
  // Race: `./i18n` hasn't finished yet. Call init() again (no-op if already in
  // progress; i18next guards against double-init).
  i18n.init({
    resources: {},
    lng: 'zh-TW',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  renderApp();
}
