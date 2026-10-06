/**
 * TemplateCard — Types
 *
 * @module components/business/dashboard/TemplateCard/TemplateCard.types
 */

import type { z } from 'zod';
import type { templateSettingsSchema } from '@saome/shared/schemas/card';

/**
 * Type alias for the canonical TemplateSettings shape (zod-inferred).
 *
 * The schema is exported as `templateSettingsSchema`; we re-export its
 * inferred type here so consumers continue to use `TemplateSettings`
 * without a Type suffix. The schema is the source of truth (Rule 019
 * § 4.1 layer 1); this is a thin convenience alias.
 */
export type TemplateSettings = z.infer<typeof templateSettingsSchema>;

export interface TemplateCardProps {
  /** Unique identifier for this template card. */
  id: string;
  /** Optional display name for the template. */
  name?: string;
  /** Card background color. Defaults to #FFFFFF. */
  backgroundColor?: string;
  /** Card text color. Defaults to #000000. */
  textColor?: string;
  /** Card type (determines body layout). */
  cardType?: TemplateSettings['cardType'];
  /** Issuer name displayed in the card header. */
  issuerName?: string;
  /** Issuer logo URL or SVG string. */
  issuerLogo?: string;
  /** Whether to wrap the card preview in a phone frame SVG. Defaults to true. */
  showPhoneFrame?: boolean;
  /**
   * 2026-10-04 PR — Full template settings passed to TemplateCardPreview.
   * Drives per-cardType rendering (stamp grid / membership strip / left /
   * right field labels / barcode image / etc.). Optional for backward
   * compat with old callers that only passed the props above; when
   * omitted, the preview falls back to flat props (legacy behavior).
   */
  settings?: TemplateSettings;
  /**
   * 2026-10-04 PR — While `true`, the card shows a deleting state
   * (delete button is disabled + spinner). Driven from the page-level
   * `deletingIds` set so the page can refetch the list when the
   * delete resolves.
   */
  isDeleting?: boolean;
  /**
   * 2026-10-06 — While `true`, the card disables the 下載桌牌 button
   * (mirrors `isDeleting` for the download flow). Driven from the
   * page-level `downloadingIds` set so the page can show a spinner
   * during the in-flight Blob → object-URL → click download.
   */
  isDownloading?: boolean;
  /** Called when the user clicks "重新編輯". */
  onEdit?: (id: string) => void;
  /** Called when the user clicks "下載桌牌". */
  onSend?: (id: string) => void;
  /** Called when the user clicks "刪除模板". */
  onDelete?: (id: string) => void;
}

// Re-export the schema for consumers that need it (e.g. test fixtures).
export { templateSettingsSchema };