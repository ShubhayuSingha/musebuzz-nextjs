import { create } from 'zustand';

interface LikeStore {
  likedIds: Set<string>; // Instant lookup
  isLoaded: boolean;     // Prevents re-fetching on navigation
  
  setLikedIds: (ids: string[]) => void;
  addLikedId: (id: string) => void;
  removeLikedId: (id: string) => void;
  hasLikedId: (id: string) => boolean;
}

const useLikeStore = create<LikeStore>((set, get) => ({
  likedIds: new Set(),
  isLoaded: false,

  setLikedIds: (ids: string[]) => {
    set({ 
        likedIds: new Set(ids),
        isLoaded: true 
    });
  },

  addLikedId: (id: string) => {
    const { likedIds } = get();
    const newSet = new Set(likedIds);
    newSet.add(id);
    set({ likedIds: newSet });
  },

  removeLikedId: (id: string) => {
    const { likedIds } = get();
    const newSet = new Set(likedIds);
    newSet.delete(id);
    set({ likedIds: newSet });
  },

  hasLikedId: (id: string) => {
    return get().likedIds.has(id);
  }
}));

export default useLikeStore;