/**
 * Visit count preview demo value — single source of truth.
 *
 * @module shared/constants/visitCountPreview
 * @description The editor and the template library both render the
 * `visitCount` slot with a DEMO value (there is no holder in the
 * editor, so there is no real visit count to show). This constant
 * holds that demo number so the two previews cannot disagree:
 *
 *   - `apps/frontend/.../CardPreview/passCardPreviewSlot.ts` — the
 *     editor + library preview resolver.
 *   - `packages/shared/logic/visitCount.ts` — the formatter that
 *     turns the number into the "number + unit" string.
 *
 * WHY THE NUMBER LIVES HERE AND NOT IN THE i18n DICTIONARY
 * ------------------------------------------------------------------------
 * The i18n dictionaries previously held the WHOLE display string
 * (`'5 次'` / `'5 times'`), which meant the demo value and the unit
 * were two separate literal strings per locale — the shape the
 * discount / cashback / balance slots already abandoned when they
 * moved to shared constants + shared formatters.
 *
 * Holding only the NUMBER here keeps the unit in exactly one place
 * (the shared formatter), so a unit change is a one-line edit rather
 * than a locale-sync across two files.
 *
 * The value 5 matches the long-standing demo string ('5 次' / '5
 * times'), so the editor preview is unchanged for the reader — only
 * its SOURCE moved.
 *
 * Rule references:
 *   - Rule 023 § Shared Package 邊界 — the demo value is shared by two
 *     consumers, so it belongs in shared/, not in one app.
 *   - Rule 023 § 翻譯書寫紀律 — the en locale must not contain Han
 *     characters; keeping the unit out of the locale file avoids that
 *     hazard entirely.
 *
 * @see packages/shared/logic/visitCount.ts
 * @see packages/shared/constants/balancePreview.ts — same pattern
 * @see packages/shared/constants/discountPreviewAmounts.ts — same pattern
 */

/**
 * The demo visit count rendered by the editor and template-library
 * previews. Rendered through `formatVisitCount`, so it shows as
 * `5 次` (zh-TW) or `5 times` (en) depending on the template language.
 */
export const VISIT_COUNT_PREVIEW_VALUE = 5;
