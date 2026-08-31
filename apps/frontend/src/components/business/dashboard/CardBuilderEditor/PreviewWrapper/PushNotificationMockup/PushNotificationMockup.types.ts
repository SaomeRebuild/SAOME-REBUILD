/**
 * PushNotificationMockup props.
 *
 * @module components/business/dashboard/CardBuilderEditor/PreviewWrapper/PushNotificationMockup
 */

export interface PushNotificationMockupProps {
  /** R2 key (per shared/constants/card-images.ts § 5.7 contract) — used to
   * build the cache-busted URL via api.paths.cardImage. */
  iconImage: string;
  /** Cache-bust counter — bumped on every successful icon upload. */
  iconImageVersion?: number;
  /** Display name shown as the push-notification title (issuer name). */
  issuerName: string;
}
