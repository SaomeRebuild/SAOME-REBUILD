import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
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
          <Toaster richColors position="bottom-right" />
          <App />
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

/**
 * Render the app. i18n is initialized synchronously by `./i18n` import above.
 * The `isInitialized` guard is only to prevent double-init side-effects.
 */
if (i18n.isInitialized) {
  renderApp();
} else {
  // This branch should NOT be reached because `./i18n` calls init() synchronously.
  // If it IS reached, it means module loading order is broken.
  // Calling init() again with empty resources would erase all translations.
  console.error('[i18n] init() was not called by ./i18n — translations will be missing.');
  renderApp();
}
