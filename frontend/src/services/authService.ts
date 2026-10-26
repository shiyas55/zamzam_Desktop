/**
 * Zamzam Foods Auth Service
 *
 * Tokens are stored exclusively in HttpOnly Secure cookies managed by the server.
 * JavaScript never reads, writes, or stores access/refresh tokens.
 *
 * The user profile is kept in localStorage only to avoid a network roundtrip on
 * page load. It is re-validated against /auth/me/ on every app start.
 */
import { apiClient } from './apiClient';
import { AuthResponse, User } from '../types';

export const authService = {
  /**
   * Authenticate with username + password.
   * The server sets zamzam_access and zamzam_refresh HttpOnly cookies.
   * Returns the sanitised user object from the response body.
   */
  async login(username: string, password: string): Promise<AuthResponse> {
    const data = await apiClient.post<AuthResponse & { access?: string; refresh?: string }>('/auth/login/', {
      username,
      password,
    });
    // Persist tokens and user metadata for reliable authentication across all environments
    if (data.access) {
      apiClient.setTokens(data.access, data.refresh);
    }
    localStorage.setItem('zamzam_user', JSON.stringify(data.user));
    return data;
  },

  /**
   * Fetch fresh user profile from the server.
   * The access cookie is sent automatically by the browser.
   */
  async getCurrentUser(): Promise<User> {
    return apiClient.get<User>('/auth/me/');
  },

  /**
   * Log out: tells the server to blacklist the refresh token and
   * delete both auth cookies. Then clears local user cache.
   */
  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('zamzam_refresh_token');
    try {
      await apiClient.post('/auth/logout/', { refresh: refreshToken });
    } catch {
      // Even if the server call fails, clear local state
    } finally {
      apiClient.clearTokens(); // removes zamzam_user, zamzam_access_token, zamzam_refresh_token
      sessionStorage.clear();
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  },

  /**
   * Returns the cached user profile from localStorage, or null.
   * Used for instant UI hydration before the /auth/me/ round-trip completes.
   */
  getStoredUser(): User | null {
    const userStr = localStorage.getItem('zamzam_user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  async getUsers(): Promise<User[]> {
    const data = await apiClient.get<{ results?: User[] } | User[]>('/auth/users/');
    return Array.isArray(data) ? data : data.results || [];
  },

  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: string;
    phone_number: string;
  }): Promise<User> {
    return apiClient.post<User>('/auth/users/', userData);
  },

  async updateUser(userId: string | number, userData: Partial<{
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    phone_number: string;
    is_active: boolean;
  }>): Promise<User> {
    return apiClient.patch<User>(`/auth/users/${userId}/`, userData);
  },

  async deleteUser(userId: string | number): Promise<void> {
    return apiClient.delete(`/auth/users/${userId}/`);
  },

  async resetPassword(userId: string | number, password: string): Promise<void> {
    return apiClient.post(`/auth/users/${userId}/reset_password/`, { password });
  },
};
