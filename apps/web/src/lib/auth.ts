'use client';

import { api } from './api';

const AUTH_TOKEN_KEY = 'vidforge.auth.token';
export const AUTH_CHANGED_EVENT = 'vidforge:auth-changed';

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

type FieldErrors = Record<string, string[] | undefined>;

export class AuthApiError extends Error {
  status?: number;
  code?: string;
  fieldErrors?: FieldErrors;
}

function extractApiError(error: any, fallback: string): AuthApiError {
  const authError = new AuthApiError(
    error?.response?.data?.error || error?.response?.data?.message || fallback
  );
  authError.status = error?.response?.status;
  authError.code = error?.response?.data?.code;
  authError.fieldErrors = error?.response?.data?.details?.fieldErrors;
  return authError;
}

export function getAuthToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export async function signup(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data } = await api.post<AuthResponse>('/api/auth/signup', { email, password });
    return data;
  } catch (error) {
    throw extractApiError(error, 'Sign up failed');
  }
}

export async function signin(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data } = await api.post<AuthResponse>('/api/auth/signin', { email, password });
    return data;
  } catch (error) {
    throw extractApiError(error, 'Sign in failed');
  }
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  try {
    const { data } = await api.get<{ user: AuthUser }>('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data.user;
  } catch (error) {
    throw extractApiError(error, 'Failed to fetch current user');
  }
}
