/**
 * ThemeProvider — wraps the app and exposes theme state via Context.
 *
 * - Uses `useTheme` internally (which owns state + side-effects)
 * - RN migration: identical Context API, only `useTheme` internals change
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useTheme, type ThemePreference, type ResolvedTheme } from '@/hooks';

export interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * ThemeProvider must be rendered above AuthProvider in the tree so that
 * `useTheme()` is available to any component inside the app.
 *
 * Usage in main.tsx:
 * ```tsx
 * <ThemeProvider>
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useTheme();

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook to consume theme context (throws if used outside ThemeProvider) */
export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeContext must be used inside <ThemeProvider>');
  }
  return ctx;
}
