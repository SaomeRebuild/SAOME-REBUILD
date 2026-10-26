/**
 * Card template schemas — public barrel.
 *
 * @module shared/schemas/card
 * @description Entry point for the card template schema contract.
 *
 * This directory is the SINGLE SOURCE OF TRUTH for card template types
 * (Rule 019 § 4.1). Both frontend and backend MUST import from here.
 *
 * Layout:
 *   - `enums.ts`          card type / barcode / currency / language / status
 *   - `tableCard.ts`      Step 7 printable table card schemas
 *   - `templateSettings/` flat `templates.settings` JSONB schema, split
 *                         into per-section schemas and composed back
 *                         into one flat object
 *   - `templateCrud.ts`   create / update request payloads
 *   - `templateDto.ts`    cross-package response contract
 *
 * The export surface is intentionally identical to the former
 * single-file `packages/shared/schemas/card.ts`, so every existing
 * consumer of `@saome/shared/schemas/card` keeps working unchanged.
 */

export * from './enums';
export * from './tableCard';
export * from './templateSettings';
export * from './templateCrud';
export * from './templateDto';
