// src/stores/useLikeStore.ts
import { create } from 'zustand';

interface LikeStore {
  refreshTrigger: number;
  toggleRefresh: () => void;
}

const useLikeStore = create<LikeStore>((set) => ({
  refreshTrigger: 0,
  toggleRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
}));

export default useLikeStore;