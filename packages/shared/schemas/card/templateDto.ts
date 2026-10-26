/**
 * Card template DTO — the cross-package response contract.
 *
 * @module shared/schemas/card/templateDto
 * @description Shape returned by every card-template endpoint
 * (POST / GET / PUT / DELETE).
 *
 * Part of the card schema contract (Rule 019 § 4.1) — frontend and
 * backend MUST import from `shared/schemas/card`.
 */

import { z } from 'zod';
import { cardTypeSchema, templateStatusSchema } from './enums';

// ===== Template DTO (cross-package contract, 2026-09-27) =====
//
// `TemplateDto` is the shape returned by every card-template endpoint
// (POST/GET/PUT/DELETE). Frontend `cardService.ts` + multiple components
// import this type directly; backend `apps/backend/src/modules/cards/schemas/response.ts`
// also defines a structurally-identical interface but for cross-package
// consumption we re-export the canonical zod-inferred shape here.
//
// Per Rule 019 § 4.1 (single source of truth): the canonical fields
// (id, name, status, cardType, settings, timestamps) live in shared scope.
// Backend response.ts keeps a structural interface alias for its local
// callers (avoid breaking changes there); frontend consumers should
// import from `@saome/shared/schemas/card`.

export const templateDtoSchema = z.object({
  id: z.string().uuid(),
  status: templateStatusSchema,
  name: z.string(),
  cardType: cardTypeSchema.optional(),
  settings: z.record(z.string(), z.unknown()), // TemplateSettings ? typed loosely here
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TemplateDto = z.infer<typeof templateDtoSchema>;
