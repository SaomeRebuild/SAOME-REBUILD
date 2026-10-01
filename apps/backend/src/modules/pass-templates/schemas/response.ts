/**
 * Response DTOs for the pass-templates module.
 *
 * @module modules/pass-templates/schemas/response
 * @description Re-exports the backend DTOs from `shared/contracts/passTemplates.ts`.
 *
 * Why not hand-define response types here?
 *   - The shared contract IS the public-facing DTO (Layer 2 of 4).
 *   - Re-exporting avoids drift between the route handler return type and the
 *     zod schema parsed body.
 *
 * Layer mapping (Rule 019 § 4.1):
 *   - Layer 1: packages/shared/types/passHolder.ts::PublicPassTemplate
 *   - Layer 2: shared/contracts/passTemplates.ts::PublicPassTemplateDto
 *   - Layer 3: db/templates.ts::PublicTemplateRow
 *   - Layer 4: services/getPublicService.ts
 */

export type {
  PublicPassTemplateDto,
  PublicPassTemplateResponseDto,
  PassHolderRegisterPayloadDto,
  PassHolderRegisterResponseDto,
  PassHolderPhoneCountryCodeDto,
} from '@/shared/contracts/passTemplates';