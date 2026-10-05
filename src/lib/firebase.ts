import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import { Platform } from 'react-native';

import { emulatorHost, firebaseEnv, functionsRegion, isFirebaseConfigured } from './env';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let database: Database | undefined;
let storage: FirebaseStorage | undefined;
let functions: Functions | undefined;

function requireConfigured() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Copy .env.example to .env and fill it in.');
  }
}

// The Functions emulator's Admin SDK uses the namespace named after the project for a demo project,
// so the app asks for that one instead of the real database's.
const EMULATOR_PROJECT = 'demo-babycare';

const appConfig = emulatorHost
  ? {
      ...firebaseEnv,
      projectId: EMULATOR_PROJECT,
      databaseURL: `http://${emulatorHost}:9000?ns=${EMULATOR_PROJECT}`,
      storageBucket: `${EMULATOR_PROJECT}.appspot.com`,
    }
  : firebaseEnv;

/** Connecting twice throws; that only happens when fast refresh re-runs this module. */
const once = (connect: () => void) => {
  try {
    connect();
  } catch {
    // Already connected.
  }
};

export function getFirebaseApp(): FirebaseApp {
  requireConfigured();
  app ??= getApps().length ? getApp() : initializeApp(appConfig);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  const firebaseApp = getFirebaseApp();
  if (Platform.OS === 'web') {
    auth = getAuth(firebaseApp);
  } else {
    try {
      auth = initializeAuth(firebaseApp, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      // Fast refresh re-runs this module; auth was already initialized.
      auth = getAuth(firebaseApp);
    }
  }
  if (emulatorHost) {
    const instance = auth;
    once(() => connectAuthEmulator(instance, `http://${emulatorHost}:9099`, { disableWarnings: true }));
  }
  return auth;
}

export function getFirebaseDatabase(): Database {
  if (!database) {
    database = getDatabase(getFirebaseApp());
    const instance = database;
    if (emulatorHost) once(() => connectDatabaseEmulator(instance, emulatorHost, 9000));
  }
  return database;
}

export function getFirebaseFunctions(): Functions {
  if (!functions) {
    functions = getFunctions(getFirebaseApp(), functionsRegion);
    const instance = functions;
    if (emulatorHost) once(() => connectFunctionsEmulator(instance, emulatorHost, 5001));
  }
  return functions;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
    const instance = storage;
    if (emulatorHost) once(() => connectStorageEmulator(instance, emulatorHost, 9199));
  }
  return storage;
}
