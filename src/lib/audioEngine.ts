// src/lib/audioEngine.ts
import { Howl, Howler } from "howler";

if (typeof window !== "undefined") {
  // Expand HTML5 audio pool size so preloading and fast song switching never exhaust the pool
  Howler.html5PoolSize = 50;
  Howler.autoUnlock = true;
}

let currentSound: Howl | null = null;
let nextSound: Howl | null = null;
let nextSoundSrc: string | null = null; 

const cleanupSound = (sound: Howl | null) => {
  if (!sound) return;
  try {
    sound.volume(0); // 🟢 Safe hardware kill
    sound.stop();
    // 🟢 Critical: Reset seek to 0 before unload so HTML5 recycled nodes don't retain seek positions
    sound.seek(0);
    const soundObj = sound as any;
    if (soundObj._sounds && soundObj._sounds[0] && soundObj._sounds[0]._node) {
      try { soundObj._sounds[0]._node.currentTime = 0; } catch {}
    }
    sound.unload();
  } catch {}
};

export const loadSong = (src: string, volume: number) => {
  if (nextSound && nextSoundSrc === src) {
    cleanupSound(currentSound);
    
    currentSound = nextSound;
    currentSound.mute(false); // 🟢 Clean the recycled HTML5 pool
    currentSound.volume(volume); // 🟢 Force the correct volume
    try {
      currentSound.seek(0);
      const soundObj = currentSound as any;
      if (soundObj._sounds && soundObj._sounds[0] && soundObj._sounds[0]._node) {
        try { soundObj._sounds[0]._node.currentTime = 0; } catch {}
      }
    } catch {}
    
    nextSound = null;
    nextSoundSrc = null;
    
    return currentSound;
  }

  cleanupSound(currentSound);
  currentSound = null;

  cleanupSound(nextSound);
  nextSound = null;
  nextSoundSrc = null;

  currentSound = new Howl({
    src: [src],
    html5: true,
    volume: volume,
    preload: true
  });
  
  currentSound.mute(false); // 🟢 Clean the pool
  try {
    currentSound.seek(0);
  } catch {}

  return currentSound;
};

export const preloadNext = (src: string, volume: number) => {
  if (nextSound && nextSoundSrc === src) return; 

  cleanupSound(nextSound);

  nextSoundSrc = src;
  nextSound = new Howl({
    src: [src],
    html5: true,
    volume: volume,
    preload: true
  });

  try {
    nextSound.seek(0);
  } catch {}
};

export const stopSound = () => {
  cleanupSound(currentSound);
  currentSound = null;

  cleanupSound(nextSound);
  nextSound = null;
  nextSoundSrc = null;
};

export const getSound = () => currentSound;