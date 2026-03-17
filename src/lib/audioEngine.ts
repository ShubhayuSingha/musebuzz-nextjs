// src/lib/audioEngine.ts
import { Howl } from "howler";

let currentSound: Howl | null = null;
let nextSound: Howl | null = null;
let nextSoundSrc: string | null = null; 

export const loadSong = (src: string, volume: number) => {
  if (nextSound && nextSoundSrc === src) {
    if (currentSound) {
      currentSound.volume(0); // 🟢 Safe hardware kill
      currentSound.stop();
      currentSound.unload();
    }
    
    currentSound = nextSound;
    currentSound.mute(false); // 🟢 FIX: Clean the recycled HTML5 pool
    currentSound.volume(volume); // 🟢 Force the correct volume
    
    nextSound = null;
    nextSoundSrc = null;
    
    return currentSound;
  }

  if (currentSound) {
    currentSound.volume(0);
    currentSound.stop();
    currentSound.unload();
    currentSound = null;
  }

  if (nextSound) {
    nextSound.unload();
    nextSound = null;
    nextSoundSrc = null;
  }

  currentSound = new Howl({
    src: [src],
    html5: true,
    volume: volume,
    preload: true
  });
  
  currentSound.mute(false); // 🟢 FIX: Clean the pool
  return currentSound;
};

export const preloadNext = (src: string, volume: number) => {
  if (nextSound && nextSoundSrc === src) return; 

  if (nextSound) {
    nextSound.unload();
  }

  nextSoundSrc = src;
  nextSound = new Howl({
    src: [src],
    html5: true,
    volume: volume,
    preload: true
  });
};

export const stopSound = () => {
  if (currentSound) {
    currentSound.volume(0); // 🟢 Safe hardware kill
    currentSound.stop();
    currentSound.unload();
    currentSound = null;
  }

  if (nextSound) {
    nextSound.unload();
    nextSound = null;
    nextSoundSrc = null;
  }
};

export const getSound = () => currentSound;