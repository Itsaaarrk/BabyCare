import { create } from 'zustand';

interface ConnectionState {
  /** Whether the Realtime Database connection is up. Optimistic until Firebase says otherwise. */
  online: boolean;
  setOnline: (online: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  online: true,
  setOnline: (online) => set({ online }),
}));
