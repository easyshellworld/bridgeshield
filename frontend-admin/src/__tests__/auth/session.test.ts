import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAdminAccessToken,
  getAdminUser,
  saveAdminSession,
  clearAdminSession,
  isAdminAuthenticated,
} from '../../auth/session';

describe('session', () => {
  const ACCESS_TOKEN_STORAGE_KEY = 'bridgeshield_admin_access_token';
  const USER_STORAGE_KEY = 'bridgeshield_admin_user';
  const mockAccessToken = 'test-access-token-123';
  const mockUser = { id: 'user-123', username: 'admin', role: 'admin' };

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('getAdminAccessToken', () => {
    it('should return null when no token is stored', () => {
      expect(getAdminAccessToken()).toBeNull();
    });

    it('should return the stored access token', () => {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, mockAccessToken);
      expect(getAdminAccessToken()).toBe(mockAccessToken);
    });
  });

  describe('getAdminUser', () => {
    it('should return null when no user is stored', () => {
      expect(getAdminUser()).toBeNull();
    });

    it('should return the parsed stored user', () => {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUser));
      expect(getAdminUser()).toEqual(mockUser);
    });

    it('should return null and clear storage when user data is invalid JSON', () => {
      localStorage.setItem(USER_STORAGE_KEY, 'invalid-json');
      expect(getAdminUser()).toBeNull();
      expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
    });
  });

  describe('saveAdminSession', () => {
    it('should save access token and user to localStorage', () => {
      saveAdminSession(mockAccessToken, mockUser);
      expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe(mockAccessToken);
      expect(localStorage.getItem(USER_STORAGE_KEY)).toBe(JSON.stringify(mockUser));
    });
  });

  describe('clearAdminSession', () => {
    it('should remove access token and user from localStorage', () => {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, mockAccessToken);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUser));
      
      clearAdminSession();
      
      expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
    });
  });

  describe('isAdminAuthenticated', () => {
    it('should return false when no access token is stored', () => {
      expect(isAdminAuthenticated()).toBe(false);
    });

    it('should return true when access token is stored', () => {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, mockAccessToken);
      expect(isAdminAuthenticated()).toBe(true);
    });
  });
});
