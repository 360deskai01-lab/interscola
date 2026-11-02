export type NavbarRole = 'admin' | 'teacher' | 'student';

export type NavbarStatus = 'pending' | 'approved' | 'rejected';

export interface NavbarUser {
  id: string;
  email: string | null;
}

export interface NavbarAuthSnapshot {
  user: NavbarUser | null;
  role: NavbarRole | null;
  status: NavbarStatus | null;
}

export const EMPTY_NAVBAR_AUTH: NavbarAuthSnapshot = {
  user: null,
  role: null,
  status: null,
};
