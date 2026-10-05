/**
 * Business events worth measuring (paywall views, plan taps, purchases). Nothing is sent anywhere
 * yet: `trackEvent` is a placeholder until an analytics destination is chosen.
 *
 * The type allows no free-form data on purpose, so baby names, diaper details and other family
 * information cannot end up in an analytics event by accident.
 */
export type BillingEvent =
  | 'paywall_viewed'
  | 'plus_monthly_selected'
  | 'plus_yearly_selected'
  | 'lifetime_selected'
  | 'purchase_started'
  | 'purchase_completed'
  | 'purchase_failed'
  | 'purchase_restored'
  | 'subscription_cancelled'
  | 'subscription_expired'
  | 'premium_feature_locked';

/** An allowed detail value: which feature was locked, never what the family logged. */
export type EventFeature = 'multiple_babies' | 'premium_storage' | 'ad_free' | 'advanced_analytics' | 'pdf_reports' | 'data_export';

export function trackEvent(_event: BillingEvent, _feature?: EventFeature): void {
  // Intentionally empty for now.
}
