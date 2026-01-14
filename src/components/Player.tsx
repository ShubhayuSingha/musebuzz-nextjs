// src/components/Player.tsx
'use client';

import usePlayerStore from "@/stores/usePlayerStore";
import useSongById from "@/hooks/useSongById";
import PlayerContent from "./PlayerContent";

const Player = () => {
  const { activeId } = usePlayerStore();
  const { song, songPath } = useSongById(activeId);

  // If we don't have enough data to play, don't show the player
  if (!song || !songPath || !activeId) {
    return null;
  }

  return (
    // THE MAGIC FIX: 
    // key={songPath} forces the component to destroy and recreate 
    // whenever the song URL changes. This resets the slider to 0:00 immediately.
    <PlayerContent 
      key={songPath} 
      song={song} 
      songPath={songPath} 
    />
  );
};

export default Player;