import { api } from './client';
import { authService } from '../services/authService';
import { AuthResponse, User } from '../types';

export const authApi = {
  login: (username: string, password: string): Promise<AuthResponse> =>
    authService.login(username, password),

  getCurrentUser: (): Promise<User> =>
    authService.getCurrentUser(),

  logout: (): Promise<void> =>
    authService.logout(),

  getStoredUser: (): User | null =>
    authService.getStoredUser(),

  getUsers: (): Promise<User[]> =>
    authService.getUsers(),

  createUser: (userData: {
    username: string;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: string;
    phone_number: string;
  }): Promise<User> => authService.createUser(userData),

  updateUser: (
    userId: string | number,
    userData: Partial<{
      username: string;
      email: string;
      first_name: string;
      last_name: string;
      role: string;
      phone_number: string;
      is_active: boolean;
    }>
  ): Promise<User> => authService.updateUser(userId, userData),

  deleteUser: (userId: string | number): Promise<void> =>
    authService.deleteUser(userId),

  resetPassword: (userId: string | number, password: string): Promise<void> =>
    authService.resetPassword(userId, password),
};
