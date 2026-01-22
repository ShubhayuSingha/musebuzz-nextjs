import { create } from 'zustand';

interface AddToPlaylistModalStore {
  isOpen: boolean;
  songId?: string; // We need to know WHICH song to add
  onOpen: (songId: string) => void;
  onClose: () => void;
}

const useAddToPlaylistModal = create<AddToPlaylistModalStore>((set) => ({
  isOpen: false,
  songId: undefined,
  onOpen: (songId: string) => set({ isOpen: true, songId }),
  onClose: () => set({ isOpen: false, songId: undefined }),
}));

export default useAddToPlaylistModal;