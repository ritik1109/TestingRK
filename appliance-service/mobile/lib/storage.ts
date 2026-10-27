import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

const TOKEN_KEY = 'customer-access-token';
const REFRESH_TOKEN_KEY = 'customer-refresh-token';
const USER_CACHE_KEY = 'customer-profile-cache';
const INSTALL_MARKER_FILE = 'customer-session-install-marker';
let installCheck: Promise<void> | null = null;

/** Clear Keychain credentials that may survive removal of the app on iOS. */
export async function clearSessionAfterReinstall(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (installCheck) return installCheck;

  installCheck = (async () => {
    const documentDirectory = FileSystem.documentDirectory;
    if (!documentDirectory) throw new Error('App storage is unavailable.');
    const markerPath = `${documentDirectory}${INSTALL_MARKER_FILE}`;
    const marker = await FileSystem.getInfoAsync(markerPath);
    if (!marker.exists) {
      await clearToken();
      await FileSystem.writeAsStringAsync(markerPath, 'installed');
    }
  })();

  try {
    await installCheck;
  } finally {
    installCheck = null;
  }
}

/** Keep native access tokens in the operating-system credential store. */
export async function readToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

/** Persist a login token using the strongest storage available on this platform. */
export async function writeToken(token: string): Promise<void> {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('The server did not return a valid access token. Please update and restart the backend.');
  }
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

/** Persist the rotating refresh credential in the platform's secure storage. */
export async function writeRefreshToken(token: string): Promise<void> {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('The server did not return a refresh token. Update and restart the backend to enable persistent sign-in.');
  }
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

/** Read the refresh credential used to keep a native customer signed in. */
export async function readRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
  }
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

/** Cache the last profile securely so a temporary offline start does not look like logout. */
export async function writeCachedUser(user: unknown): Promise<void> {
  const value = JSON.stringify(user);
  if (typeof value !== 'string') {
    throw new Error('Could not save the customer profile because it is invalid.');
  }
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(USER_CACHE_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(USER_CACHE_KEY, value);
}

/** Restore a previously cached profile after a temporary network failure. */
export async function readCachedUser<T>(): Promise<T | null> {
  const value = Platform.OS === 'web'
    ? (typeof window === 'undefined' ? null : window.sessionStorage.getItem(USER_CACHE_KEY))
    : await SecureStore.getItemAsync(USER_CACHE_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    await clearCachedUser();
    return null;
  }
}

/** Remove cached profile data on explicit logout or confirmed session expiry. */
async function clearCachedUser(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(USER_CACHE_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(USER_CACHE_KEY);
}

/** Remove local credentials when a user logs out or their session expires. */
export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(TOKEN_KEY);
      window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      window.sessionStorage.removeItem(USER_CACHE_KEY);
    }
    return;
  }
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_CACHE_KEY),
  ]);
}
