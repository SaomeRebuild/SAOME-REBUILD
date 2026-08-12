export interface TenantToolbarProps {
  /** Default panel width in pixels */
  defaultWidth?: number;
  /** Minimum panel width in pixels */
  minWidth?: number;
  /** Maximum panel width in pixels */
  maxWidth?: number;
  /** Callback when width changes */
  onWidthChange?: (width: number) => void;
}
