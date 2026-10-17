/**
 * POST /api/pass-templates/:id/register
 *
 * Public, NO AUTH REQUIRED. Idempotent on (template_id, email).
 *
 * v2 (2026-09-29): NO status filter on the template existence check — any
 * template is reachable by UUID. See Decision Log § 拿掉的決策.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { ValidationError } from '@/shared/lib/saomeError';
import { registerService } from '../services/registerService';
import { passHolderRegisterPayloadSchema } from '../schemas/request';

export const registerRoute = new Hono<HonoEnv>().post('/:id/register', async (c) => {
  const sql = await getDbForRequest(c);
  const templateId = c.req.param('id');

  // zod parse — fail with 400 + i18n key on validation failure.
  const body = await c.req.json().catch(() => ({}));
  const parsed = passHolderRegisterPayloadSchema.safeParse(body);
  if (!parsed.success) {
    // 2026-10-17 — include the actual offending value in `details.issues`
    // so the user (and ops) can see WHAT the API received, not just
    // WHICH field failed. Helps disambiguate "I entered 1989 but the
    // API got 2026" (browser autofill, stale form state, wrong field
    // clicked) from "I entered 1989 and the API really got 1989 but
    // validation is misbehaving" (a real backend bug).
    //
    // For the birthday refine specifically, also include the boundary
    // date the API computed so the user can see how old the API
    // thinks they need to be (vs. what they thought). Recomputed here
    // so the boundary in the error response matches the one the
    // schema's refine just used (both pinned to "now - 13 years" in
    // the same request).
    const issues = parsed.error.issues.map((i) => {
      const path = i.path.join('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const received = (body as any)?.[path];
      return {
        path,
        i18nKey: i.message,
        ...(received !== undefined ? { received } : {}),
      };
    });
    let minBirthdayBoundary: string | undefined;
    if (issues.some((i) => i.i18nKey === 'passHolder.errors.tooYoung')) {
      const thirteenYearsAgo = new Date();
      thirteenYearsAgo.setUTCFullYear(
        thirteenYearsAgo.getUTCFullYear() - 13,
      );
      minBirthdayBoundary = thirteenYearsAgo.toISOString().slice(0, 10);
    }
    throw new ValidationError(issues[0]?.i18nKey ?? 'common.error.validationFailed', {
      issues,
      ...(minBirthdayBoundary !== undefined ? { minBirthdayBoundary } : {}),
    });
  }

  const result = await registerService(sql, c.env, templateId, parsed.data);
  return c.json(result, 200);
});

export default registerRoute;