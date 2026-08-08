import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '@/shared/types/bindings';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { getDb } from '@/shared/db/client';
import { createPassService } from '../services/createPassService';
import { getPassStatusService } from '../services/createPassService';

export const passRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /api/pass
 * Create a new pass for a tenant
 */
passRoutes.post('/', async (c) => {
  const body = await c.req.json();
  
  try {
    const result = await createPassService(c.env, body);
    return c.json(result, 201);
  } catch (err) {
    if (err instanceof Error && 'code' in err) {
      const saomeErr = err as { code: string };
      if (saomeErr.code === 'CONFLICT') {
        return c.json({ error: 'Tenant already has a pass' }, 409);
      }
      if (saomeErr.code === 'VALIDATION_ERROR') {
        return c.json({ error: 'Invalid request' }, 400);
      }
    }
    throw err;
  }
});

/**
 * GET /api/pass/current
 * Get current pass status for authenticated tenant
 */
passRoutes.get('/current', requireAuth, async (c) => {
  const user = getAuthenticatedUser(c);
  const tenantId = (user as { tenantId?: string }).tenantId;
  if (!tenantId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const result = await getPassStatusService(c.env, tenantId);
    return c.json(result);
  } catch (err) {
    if (err instanceof Error && 'code' in err) {
      const saomeErr = err as { code: string };
      if (saomeErr.code === 'NOT_FOUND') {
        return c.json({ error: 'Pass not found' }, 404);
      }
    }
    throw err;
  }
});
