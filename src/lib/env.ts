// Expo inlines EXPO_PUBLIC_* variables at build time, but only for static
// `process.env.NAME` access, so each variable must be referenced explicitly.
const raw = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
} as const;

export type FirebaseEnv = { [K in keyof typeof raw]: string };

const variableNames: Record<keyof typeof raw, string> = {
  apiKey: 'EXPO_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  databaseURL: 'EXPO_PUBLIC_FIREBASE_DATABASE_URL',
  projectId: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'EXPO_PUBLIC_FIREBASE_APP_ID',
};

const missing = (Object.keys(raw) as (keyof typeof raw)[])
  .filter((key) => !raw[key])
  .map((key) => variableNames[key]);

/** True when every Firebase variable is set; the UI shows a setup screen otherwise. */
export const isFirebaseConfigured = missing.length === 0;
export const missingFirebaseKeys: readonly string[] = missing;

export const firebaseEnv = raw as FirebaseEnv;

/**
 * Development only: the host running the Firebase emulators (10.0.2.2 from an Android emulator).
 * Set `EXPO_PUBLIC_EMULATOR_HOST` on the command line when starting Metro; release builds ignore it.
 */
export const emulatorHost = __DEV__ ? process.env.EXPO_PUBLIC_EMULATOR_HOST || '' : '';

/** OAuth "Web client" ID, needed by Google sign-in to obtain an ID token that Firebase accepts. */
export const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

export const functionsRegion = process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION || 'asia-southeast1';
