import { create } from 'zustand';

interface AuthModalStore {
  isOpen: boolean;
  view: 'sign_in' | 'sign_up';
  
  // 🟢 NEW: Delete Modal State
  deleteId?: string; // The ID of the playlist to delete
  isDeleteOpen: boolean;

  onOpen: (view?: 'sign_in' | 'sign_up') => void;
  onClose: () => void;
  
  // 🟢 NEW: Actions for Delete Modal
  openDelete: (id: string) => void;
  closeDelete: () => void;
}

const useAuthModalStore = create<AuthModalStore>((set) => ({
  isOpen: false,
  view: 'sign_in',
  
  // 🟢 Initialize
  deleteId: undefined,
  isDeleteOpen: false,

  onOpen: (view = 'sign_in') => set({ isOpen: true, view }),
  onClose: () => set({ isOpen: false }),

  // 🟢 Actions
  openDelete: (id) => set({ isDeleteOpen: true, deleteId: id }),
  closeDelete: () => set({ isDeleteOpen: false, deleteId: undefined }),
}));

export default useAuthModalStore;