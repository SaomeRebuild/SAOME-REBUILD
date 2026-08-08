/**
 * useTheme — 2-state theme hook (light / dark).
 *
 * RN migration:
 * - `document.documentElement.dataset.theme` → `StatusBar.setBarStyle()` + Context update
 * - `useStorage` interface stays identical
 *
 * Interface contract is preserved for RN — only the platform-specific parts change.
 */
import { useEffect } from 'react';
import { useStorage } from './useStorage';

export type ThemePreference = 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'saome.theme';

function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

export interface UseThemeReturn {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

export function useTheme(): UseThemeReturn {
  const [preference, setPreference] = useStorage<ThemePreference>(STORAGE_KEY, 'dark');

  // Apply theme to <html> whenever preference changes
  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  return { preference, resolved: preference, setPreference };
}
