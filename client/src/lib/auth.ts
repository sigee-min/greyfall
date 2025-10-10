export type AuthUser = {
  sub: string; // Google user ID
  name?: string;
  email?: string;
  picture?: string;
  iss?: string;
  aud?: string;
  exp?: number;
};

const AUTH_KEY = 'auth:user';

export function getAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuthUser(user: AuthUser): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function clearAuthUser(): void {
  localStorage.removeItem(AUTH_KEY);
}

