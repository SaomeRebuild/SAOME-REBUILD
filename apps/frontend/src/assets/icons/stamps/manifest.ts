/**
 * Stamp icon manifest.
 *
 * Discovers all PNG files under `./stamped/` and `./unstamped/` via Vite's
 * `import.meta.glob` with `eager: true`, so the URLs are resolved and bundled
 * at build time. Adding a new icon (e.g. `star.png`) is a zero-code-change
 * operation: drop the file into both folders and the manifest picks it up on
 * the next build.
 *
 * Why `import.meta.glob` and not `import.meta.url + fetch`:
 * - Vite hashes the asset URL, so cache-busting is automatic.
 * - The PNG participates in the production bundle (no runtime HTTP).
 * - Type-safe: the glob query result is constrained to the file shape we
 *   declare (`{ default: string }`).
 *
 * Why `eager: true`:
 * - The icons are small and always used; deferring (lazy mode) would force
 *   every consumer to handle a Promise. Synchronous load keeps the React
 *   component tree simple and matches the test expectation.
 */
const stamped = import.meta.glob<{ default: string }>(
  './stamped/*.png',
  { eager: true },
);
const unstamped = import.meta.glob<{ default: string }>(
  './unstamped/*.png',
  { eager: true },
);

/** A single stamp icon entry: id + both URL variants. */
export interface StampIconEntry {
  /** Lower-cased filename stem, e.g. `'bell'`, `'fire'`, `'sun'`. */
  id: string;
  /** URL of the stamped (filled-in) variant. */
  stampedUrl: string;
  /** URL of the unstamped (outline / dim) variant. */
  unstampedUrl: string;
}

/** Extract the basename (no extension) from a glob key path. */
function filenameFromPath(p: string): string {
  const segments = p.split('/');
  const last = segments[segments.length - 1] ?? '';
  return last.replace(/\.png$/, '');
}

/**
 * Discovered stamp icons. Sorted alphabetically by id for stable rendering
 * order across the editor UI.
 *
 * If an icon is present in `stamped/` but not in `unstamped/` (or vice versa),
 * the missing variant's URL is an empty string; consumers should treat that
 * as "fallback to the other variant" rather than crashing.
 */
export const STAMP_ICONS: readonly StampIconEntry[] = Object.keys(stamped)
  .sort()
  .map((path) => {
    const id = filenameFromPath(path);
    const stampedMod = stamped[path];
    const unstampedPath = path.replace('/stamped/', '/unstamped/');
    const unstampedMod = unstamped[unstampedPath];
    return {
      id,
      stampedUrl: stampedMod.default,
      unstampedUrl: unstampedMod?.default ?? '',
    };
  });

/** Just the icon ids, in alphabetical order. */
export const STAMP_ICON_IDS: readonly string[] = STAMP_ICONS.map((i) => i.id);

/**
 * Look up an icon entry by id. Returns `undefined` if not found; callers
 * decide on fallback behaviour (placeholder vs. the first icon).
 */
export function getStampIcon(id: string): StampIconEntry | undefined {
  return STAMP_ICONS.find((i) => i.id === id);
}
