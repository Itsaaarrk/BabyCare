import { create } from 'zustand';

import type { AuthUser } from '@/services/auth/authService';

interface AuthState {
  user: AuthUser | null;
  /** False until Firebase has reported the persisted session (or lack of one). */
  initialized: boolean;
  setUser: (user: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,
  setUser: (user) => set({ user, initialized: true }),
}));
