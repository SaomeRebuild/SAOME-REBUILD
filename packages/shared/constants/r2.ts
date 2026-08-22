/**
 * Shared card image URL utilities.
 *
 * @module shared/constants/r2
 * @description Provides helpers for building card image URLs.
 */

/**
 * Build the R2 path key for a card template image.
 * Used by the backend to read/write R2 objects.
 *
 * @param tenantId - Tenant UUID
 * @param templateId - Template UUID
 * @param imageType - Image type suffix (e.g. 'issuer-logo.png')
 * @returns R2 object key (e.g. `tenantId/templateId/issuer-logo.png`)
 */
export function buildCardImageR2Key(tenantId: string, templateId: string, imageType: string): string {
  return `${tenantId}/${templateId}/${imageType}`;
}
