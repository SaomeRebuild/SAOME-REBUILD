/**
 * Unit tests for shared/lib/passcreator/env (env validation).
 *
 * @module shared/lib/passcreator/env.test
 *
 * 3 tests pin the `requireEnv` boundary contract:
 *   - throws when PASSCREATOR_API_URL is missing
 *   - throws when PASSCREATOR_API_KEY is missing
 *   - throws when PASSCREATOR_PASS_TYPE_ID is missing
 *
 * These are the EARLIEST defensive checks — `requireEnv` runs
 * before any HTTP fetch, so a missing env var surfaces as a 500
 * (uncaught Error) rather than a silent network call to a
 * bogus URL. Each test pins one missing field, in declaration
 * order, so a future field reordering is caught.
 *
 * Rule reference:
 *   - Rule 000 Part C.3 — boundary validation belongs in the
 *     third-party service wrapper, not in the route handler.
 */

import { describe, it, expect } from 'vitest';
import { createPassTemplate } from '../passcreator';
import { VALID_ENV, makeBody } from './__fixtures__';

describe('Passcreator client — env validation', () => {
  it('createPassTemplate throws when PASSCREATOR_API_URL is missing', async () => {
    await expect(
      createPassTemplate(
        { PASSCREATOR_API_KEY: 'k', PASSCREATOR_PASS_TYPE_ID: 'p' },
        makeBody(),
      ),
    ).rejects.toThrow(/PASSCREATOR_API_URL/);
  });
  it('createPassTemplate throws when PASSCREATOR_API_KEY is missing', async () => {
    await expect(
      createPassTemplate(
        { PASSCREATOR_API_URL: 'https://x', PASSCREATOR_PASS_TYPE_ID: 'p' },
        makeBody(),
      ),
    ).rejects.toThrow(/PASSCREATOR_API_KEY/);
  });
  it('createPassTemplate throws when PASSCREATOR_PASS_TYPE_ID is missing', async () => {
    await expect(
      createPassTemplate(
        { PASSCREATOR_API_URL: 'https://x', PASSCREATOR_API_KEY: 'k' },
        makeBody(),
      ),
    ).rejects.toThrow(/PASSCREATOR_PASS_TYPE_ID/);
  });
});
