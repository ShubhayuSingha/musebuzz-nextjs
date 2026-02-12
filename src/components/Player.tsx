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

  // If we don't have enough data to play, don't show the player
  if (!song || !songPath || !activeId) {
    return null;
  }

  return (
    <PlayerContent 
      key={songPath} 
      song={song} 
      songPath={songPath} 
    />
  );
};

export default Player;