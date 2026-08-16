import type { CardType } from '@/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.types';

export interface TemplateCardProps {
  /** Unique identifier for this template card. */
  id: string;
  /** Optional display name for the template. */
  name?: string;
  /** Card background color. Defaults to #1a1a1a. */
  backgroundColor?: string;
  /** Card text color. Defaults to #ffffff. */
  textColor?: string;
  /** Card type (determines body layout). */
  cardType?: CardType;
  /** Issuer name displayed in the card header. */
  issuerName?: string;
  /** Issuer logo URL or SVG string. */
  issuerLogo?: string;
  /** Whether to wrap the card preview in a phone frame SVG. Defaults to true. */
  showPhoneFrame?: boolean;
  /** Called when the user clicks "重新編輯". */
  onEdit?: (id: string) => void;
  /** Called when the user clicks "發送卡片". */
  onSend?: (id: string) => void;
  /** Called when the user clicks "刪除卡片". */
  onDelete?: (id: string) => void;
}
