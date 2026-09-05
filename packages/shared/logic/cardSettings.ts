/**
 * Shared card settings defensive parser.
 *
 * All functions in this module are PURE — no DOM, no DB, no React state.
 * This makes them:
 *   1. Cross-platform safe (web + RN + Cloudflare Worker).
 *   2. Unit-testable without jsdom / DB mocks.
 *   3. Conformance-testable: any drift from the unwrap contract here
 *      silently corrupts template reads in both layers, so shared tests
 *      pin the behavior.
 *
 * @module shared/logic/cardSettings
 * @see runs/improvements/feedback/20260831-bug-8.5-defensive-unwrap-complete.md
 */

/**
 * Defensive parser for `templates.settings` JSONB.
 *
 * Bug #8.5 (2026-08-31): The settings column may have been corrupted into:
 *   - a proper object (normal case)
 *   - a JSON string (legacy corruption where JSON.stringify(obj) was stored)
 *   - an array of partial merges (Bug #8 partial fix — array grew on each PUT)
 *   - an array containing jsonb **strings** (Bug #8.5 worst case)
 *
 * This helper handles all cases and returns a single merged object:
 *   - Object → passthrough
 *   - String → JSON.parse with try/catch (returns `{}` on failure)
 *   - Array → reduce-merge (later elements override earlier; each elem is
 *     recursively unwrapped so array-of-strings also works)
 *   - null/undefined → `{}`
 *   - Anything else → `{}`
 *
 * Used by both backend (apps/backend/src/modules/cards/services/cardService.ts)
 * and frontend (apps/frontend/src/components/business/dashboard/CardBuilderEditor/
 * CardBuilderEditor.store.ts). Moving to shared/ eliminates drift between layers.
 *
 * Pure function — no side effects, no IO, no async.
 *
 * @param raw  The raw value from DB / API / store (type unknown)
 * @returns    Always returns a plain object (never null/undefined/array)
 */
export function unwrapCardSettings(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (Array.isArray(raw)) {
    return raw.reduce<Record<string, unknown>>(
      (acc, elem) => ({ ...acc, ...unwrapCardSettings(elem) }),
      {},
    );
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}