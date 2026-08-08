/**
 * TrialBanner.types — exported types for the TrialBanner business component.
 */

export interface TrialBannerProps {
  /** Computed days remaining (from `endDate - Date.now()`). */
  daysLeft: number;
  /** ISO 8601 expiry date string, for accessibility / aria-label. */
  endDate: string;
  /** Called when the user clicks "Verify Now". */
  onVerify: () => void;
  /** Plan type — only renders when 'green' */
}

/** The live `daysLeft` value — computed every second via setInterval. */
export interface TrialBannerDaysLeft {
  value: number;
}
