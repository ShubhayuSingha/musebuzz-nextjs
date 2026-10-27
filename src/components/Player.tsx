// src/components/Player.tsx
'use client';

import usePlayerStore from "@/stores/usePlayerStore";
import useSongById from "@/hooks/useSongById";
import useTracker from "@/hooks/useTracker";
import useAutoplay from "@/hooks/useAutoplay"; // 🟢 1. Import the Autoplay Hook
import PlayerContent from "./PlayerContent";

const Player = () => {
  // 🟢 2. Activate the Autoplay Brain
  // This will quietly watch your queue and fetch new songs when you have 2 left.
  useAutoplay();

  // Initialize the tracker for history/stats
  useTracker();

  const { activeId } = usePlayerStore();
  const { song, songPath } = useSongById(activeId);

  // No active song at all — nothing to show
  if (!activeId) {
    return null;
  }

  // activeId exists (restored from localStorage) but song data isn't loaded yet.
  // Render with a skeleton so the player bar appears immediately on reload.
  const effectiveSong = song || {
    id: activeId,
    title: 'Loading...',
    albums: null,
    lyrics_snippet: null,
  };

  // We need a real songPath to play; player shows but stays paused while loading
  return (
    <PlayerContent
      song={effectiveSong}
      songPath={songPath || ''}
    />
  );
};

export default Player;