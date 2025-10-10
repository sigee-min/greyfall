export type Role = 'user' | 'admin' | 'sysadmin';

export type User = {
  id: number;
  sub: string;
  provider: 'google';
  email_hash: string | null;
  name: string | null;
  picture: string | null;
  role: Role | string;
  created_at: number;
  last_login_at: number | null;
  last_seen_at: number | null;
};

export type GoogleProfile = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};
