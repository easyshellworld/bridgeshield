import type { AdminSessionUser } from '../types';

const ACCESS_TOKEN_STORAGE_KEY = 'bridgeshield_admin_access_token';
const USER_STORAGE_KEY = 'bridgeshield_admin_user';

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
};

export const getAdminAccessToken = (): string | null => {
  const storage = getStorage();
  return storage?.getItem(ACCESS_TOKEN_STORAGE_KEY) || null;
};

export const getAdminUser = (): AdminSessionUser | null => {
  const storage = getStorage();
  const raw = storage?.getItem(USER_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AdminSessionUser;
  } catch {
    storage?.removeItem(USER_STORAGE_KEY);
    return null;
  }
};

export const saveAdminSession = (accessToken: string, user: AdminSessionUser): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  storage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
};

export const clearAdminSession = (): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  storage.removeItem(USER_STORAGE_KEY);
};

export const isAdminAuthenticated = (): boolean => Boolean(getAdminAccessToken());
