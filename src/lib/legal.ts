// Public web addresses for the privacy policy, terms and account-deletion page. Google Play needs
// them in the store listing and the app. They are not secrets, and are set per build in .env.

/** Only plain https addresses are accepted, so a bad value can't open anything else. */
export function cleanLegalUrl(value: string | undefined): string {
  const url = value?.trim() ?? '';
  return /^https:\/\/[^\s]+$/.test(url) ? url : '';
}

// Expo inlines EXPO_PUBLIC_* values only when written out as `process.env.NAME`.
export const privacyPolicyUrl = cleanLegalUrl(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL);
export const termsUrl = cleanLegalUrl(process.env.EXPO_PUBLIC_TERMS_URL);
export const accountDeletionUrl = cleanLegalUrl(process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL);
