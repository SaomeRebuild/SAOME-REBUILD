/**
 * TemplateLibraryGrid — Types
 *
 * @module components/business/dashboard/TemplateLibraryGrid/TemplateLibraryGrid.types
 */

import type { z } from 'zod';
import type { templateSettingsSchema } from '@saome/shared/schemas/card';

/**
 * Type alias for the canonical TemplateSettings shape (zod-inferred).
 * Mirrors TemplateCard.types.ts — single source of truth lives in
 * shared/schemas/card.ts (Rule 019 § 4.1).
 */
export type TemplateSettings = z.infer<typeof templateSettingsSchema>;

export interface TemplateCardData {
  id: string;
  name?: string;
  backgroundColor?: string;
  textColor?: string;
  cardType?: TemplateSettings['cardType'];
  issuerName?: string;
  issuerLogo?: string;
  showPhoneFrame?: boolean;
  /**
   * 2026-10-04 PR — Full template settings passed to TemplateCardPreview.
   * Drives per-cardType rendering + per-card language isolation in the
   * preview (see TemplateCardPreview.tsx for the i18n.getFixedT pattern).
   */
  settings?: TemplateSettings;
}

export interface TemplateLibraryGridProps {
  /** List of template cards to display. */
  templates?: TemplateCardData[];
  /** Called when the user clicks "重新編輯" on a card. */
  onEdit?: (id: string) => void;
  /** Called when the user clicks "發送卡片" on a card. */
  onSend?: (id: string) => void;
  /** Called when the user clicks "刪除卡片" on a card. */
  onDelete?: (id: string) => void;
  /**
   * 2026-10-04 PR — Set of template IDs currently being deleted.
   * When a template id is in this set, the corresponding card renders
   * a "deleting" state (spinner on the delete button). The set lives on
   * the page (not the card) so the page can refetch the list when
   * each delete resolves.
   */
  deletingIds?: ReadonlySet<string>;
}

// Re-export the schema for test fixtures.
export { templateSettingsSchema };