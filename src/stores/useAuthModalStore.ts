// src/stores/useAuthModalStore.ts
import { create } from 'zustand';

type AuthView = 'sign_in' | 'sign_up';

interface AuthModalStore {
  isOpen: boolean;
  view: AuthView;
  onOpen: (view: AuthView) => void;
  onClose: () => void;
}

const useAuthModalStore = create<AuthModalStore>((set) => ({
  isOpen: false,
  view: 'sign_in', // Default to sign in
  onOpen: (view: AuthView) => set({ isOpen: true, view: view }),
  onClose: () => set({ isOpen: false, view: 'sign_in' }),
}));

export default useAuthModalStore;