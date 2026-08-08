/**
 * useStorage — localStorage wrapper hook.
 *
 * RN migration: swap `window.localStorage` to
 * `@react-native-async-storage/async-storage` — same `[value, setValue]` interface.
 *
 * - SSR-safe (typeof window guard)
 * - JSON serialization/deserialization
 * - No throw on parse error → falls back to default
 */
import { useState, useCallback, useEffect } from 'react';

type Serializer<T> = (value: T) => string;
type Deserializer<T> = (raw: string) => T;

function defaultSerializer<T>(value: T): string {
  return JSON.stringify(value);
}

function defaultDeserializer<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

export interface UseStorageOptions<T> {
  serializer?: Serializer<T>;
  deserializer?: Deserializer<T>;
}

export function useStorage<T>(
  key: string,
  defaultValue: T,
  options?: UseStorageOptions<T>,
): [T, (value: T | ((prev: T) => T)) => void] {
  const serializer = options?.serializer ?? defaultSerializer;
  const deserializer = options?.deserializer ?? defaultDeserializer;

  // Initialize from localStorage (SSR-safe)
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) return defaultValue;
      return deserializer(item);
    } catch {
      return defaultValue;
    }
  });

  // Sync to localStorage on change
  const setValue = useCallback(
    (valueOrUpdater: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = typeof valueOrUpdater === 'function'
          ? (valueOrUpdater as (prev: T) => T)(prev)
          : valueOrUpdater;

        try {
          window.localStorage.setItem(key, serializer(next));
        } catch {
          // localStorage may be full or unavailable (private browsing, etc.)
          // Fail silently — state is still updated.
        }
        return next;
      });
    },
    [key, serializer],
  );

  // Listen to changes in other tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: StorageEvent) => {
      if (e.key !== key) return;
      try {
        const item = e.newValue;
        if (item === null) {
          setStoredValue(defaultValue);
        } else {
          setStoredValue(deserializer(item));
        }
      } catch {
        setStoredValue(defaultValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key, defaultValue, deserializer]);

  return [storedValue, setValue];
}
