const mockSignInWithCredential = jest.fn();
const mockSignIn = jest.fn();
const mockConfigure = jest.fn();

jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: { credential: (idToken: string) => ({ providerId: 'google.com', idToken }) },
  signInWithCredential: (...args: unknown[]) => mockSignInWithCredential(...args),
}));
jest.mock('firebase/app', () => ({ FirebaseError: class FirebaseError extends Error {} }));
jest.mock('@/lib/firebase', () => ({ getFirebaseAuth: () => ({ name: 'auth' }) }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: mockConfigure,
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: mockSignIn,
    signOut: jest.fn(),
  },
  statusCodes: { SIGN_IN_CANCELLED: '12501', IN_PROGRESS: '12502' },
  isErrorWithCode: (error: { code?: unknown }) => typeof error?.code === 'string',
}));

type Setup = { webClientId?: string; executionEnvironment?: string };

/** Loads a fresh copy of the service, because it reads the environment once at import time. */
function load({ webClientId = 'web-client.apps.googleusercontent.com', executionEnvironment = 'standalone' }: Setup = {}) {
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = webClientId;
  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: { executionEnvironment },
    ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone', Bare: 'bare' },
  }));
  let mod!: typeof import('./googleSignIn');
  let errors!: typeof import('@/lib/errors');
  jest.isolateModules(() => {
    mod = require('./googleSignIn');
    errors = require('@/lib/errors');
  });
  return { ...mod, ...errors };
}

beforeEach(() => jest.clearAllMocks());

describe('signInWithGoogle', () => {
  it('signs into Firebase with the ID token Google returns', async () => {
    mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'token-1' } });
    const { signInWithGoogle } = load();

    await expect(signInWithGoogle()).resolves.toBe('signed-in');
    expect(mockConfigure).toHaveBeenCalledWith({ webClientId: 'web-client.apps.googleusercontent.com' });
    expect(mockSignInWithCredential).toHaveBeenCalledWith(
      { name: 'auth' },
      { providerId: 'google.com', idToken: 'token-1' },
    );
  });

  it('does nothing when the person closes the Google sheet', async () => {
    mockSignIn.mockResolvedValue({ type: 'cancelled', data: null });
    const { signInWithGoogle } = load();

    await expect(signInWithGoogle()).resolves.toBe('cancelled');
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it('treats a cancel reported as an error the same way', async () => {
    mockSignIn.mockRejectedValue(Object.assign(new Error('cancelled'), { code: '12501' }));
    const { signInWithGoogle } = load();

    await expect(signInWithGoogle()).resolves.toBe('cancelled');
  });

  it('passes other failures on so the screen can show them', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockSignIn.mockRejectedValue(Object.assign(new Error('developer error'), { code: '10' }));
    const { signInWithGoogle } = load();

    await expect(signInWithGoogle()).rejects.toThrow('developer error');
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it('fails clearly when Google returns no ID token', async () => {
    mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: null } });
    const { signInWithGoogle } = load();

    await expect(signInWithGoogle()).rejects.toThrow(/ID token/);
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it('is unavailable in Expo Go, where the native module does not exist', async () => {
    const { signInWithGoogle, GoogleSignInUnavailableError } = load({ executionEnvironment: 'storeClient' });

    await expect(signInWithGoogle()).rejects.toBeInstanceOf(GoogleSignInUnavailableError);
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('is unavailable until a web client ID is configured', async () => {
    const { signInWithGoogle, GoogleSignInUnavailableError } = load({ webClientId: '' });

    await expect(signInWithGoogle()).rejects.toBeInstanceOf(GoogleSignInUnavailableError);
  });
});

describe('error messages', () => {
  it('explains the Expo Go limitation to the person', () => {
    const { GoogleSignInUnavailableError, toUserMessage } = load();
    expect(toUserMessage(new GoogleSignInUnavailableError())).toMatch(/development build/);
  });
});
