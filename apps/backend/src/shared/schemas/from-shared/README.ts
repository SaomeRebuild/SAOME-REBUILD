/**
 * Placeholder directory for cp'd files from `packages/shared/`.
 *
 * After SAOME-11, copy these files from the monorepo source of truth:
 *
 *   cp ../../packages/shared/schemas/auth.ts src/shared/schemas/from-shared/auth.ts
 *   cp ../../packages/shared/schemas/index.ts src/shared/schemas/from-shared/index.ts
 *   cp ../../packages/shared/types/auth.ts src/shared/schemas/from-shared/auth-types.ts
 *
 * The modules import like:
 *
 *   import { registrationPayloadSchema } from '@/shared/schemas/from-shared/auth';
 *
 * Why cp instead of npm install?
 *   - Cross-repo private dep avoidance
 *   - Drift risk acknowledged; sync process documented in
 *     `runs/improvements/feedback/20260728-shared-sync.md` (SAOME-25)
 */

// TODO(SAOME-11+): cp files from packages/shared/ into this directory
throw new Error('from-shared/ not yet populated — cp files from packages/shared/ at SAOME-11+');