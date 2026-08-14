export interface TemplateCardData {
  id: string;
  name?: string;
  imageUrl?: string;
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
}
