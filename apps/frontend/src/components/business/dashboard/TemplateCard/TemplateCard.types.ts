export interface TemplateCardProps {
  /** Unique identifier for this template card. */
  id: string;
  /** Optional display name for the template. */
  name?: string;
  /** URL of the card preview image. Defaults to the stamp card placeholder. */
  imageUrl?: string;
  /** Called when the user clicks "重新編輯". */
  onEdit?: (id: string) => void;
  /** Called when the user clicks "發送卡片". */
  onSend?: (id: string) => void;
  /** Called when the user clicks "刪除卡片". */
  onDelete?: (id: string) => void;
}
