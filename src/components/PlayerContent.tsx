// src/components/PlayerContent.tsx
'use client';

import { useEffect, useRef, useState, useMemo } from "react";
import { Howl } from "howler";
import { BsPlayFill, BsPauseFill, BsShuffle, BsRepeat, BsRepeat1 } from "react-icons/bs";
import { HiSpeakerWave, HiSpeakerXMark } from "react-icons/hi2";
import { AiFillStepBackward, AiFillStepForward } from "react-icons/ai";
import Slider from 'rc-slider';
import Image from "next/image";

import usePlayerStore from "@/stores/usePlayerStore";
import { supabase } from "@/lib/supabaseClient";
import LikeButton from "@/components/LikeButton";

interface PlayerContentProps {
  song: any;
  songPath: string;
}

const PlayerContent: React.FC<PlayerContentProps> = ({ song, songPath }) => {
  const { 
    isPlaying, 
    volume, 
    activeId, 
    activeContext, 
    playNext,       
    playPrevious,
    setVolume, 
    setIsPlaying, 
    toggleShuffle, 
    toggleRepeat,
    isShuffled, 
    repeatMode,
    prevVolume,
    setPrevVolume
  } = usePlayerStore(); 

  const onPlayNext = playNext; 

  const soundRef = useRef<Howl | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const repeatModeRef = useRef(repeatMode);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const imageUrl = useMemo(() => {
    if (!song?.albums?.image_path) return null;
    const { data: imageData } = supabase.storage.from('images').getPublicUrl(song.albums.image_path);
    return imageData.publicUrl;
  }, [song]);

  const Icon = isPlaying ? BsPauseFill : BsPlayFill;
  const VolumeIcon = volume === 0 ? HiSpeakerXMark : HiSpeakerWave;

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const toggleMute = () => {
    if (volume === 0) {
      setVolume(prevVolume);
    } else {
      setPrevVolume(volume);
      setVolume(0);
    }
  }

  // 1. SYNC VOLUME - Updates the audio volume without re-loading the song
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.volume(volume);
    }
  }, [volume]);

  // 2. SYNC PLAY/PAUSE STATE
  useEffect(() => {
    const sound = soundRef.current;
    if (sound) {
      if (isPlaying && !sound.playing()) {
        sound.play();
      } else if (!isPlaying && sound.playing()) {
        sound.pause();
      }
    }
  }, [isPlaying]);

  // 3. LOAD SONG & CONTEXTUAL RESTART
  // We exclude 'volume' here so the song doesn't restart when you adjust it.
  useEffect(() => {
    // Reset UI state immediately
    setCurrentTime(0); 
    setDuration(0);

    soundRef.current?.unload();
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (songPath) {
      const newSound = new Howl({
        src: [songPath],
        html5: true,
        autoplay: true, 
        volume: volume, 
        onplay: () => setIsPlaying(true),
        onpause: () => setIsPlaying(false),
        onend: () => {
          if (repeatModeRef.current === 'one') {
             newSound.play();
          } else {
             setIsPlaying(false);
             onPlayNext(); 
          }
        },
        onload: () => setDuration(newSound.duration()),
      });
      soundRef.current = newSound;
    }

    return () => {
      soundRef.current?.unload();
    }
  }, [
    songPath, 
    activeContext?.type, 
    activeContext?.title, 
    setIsPlaying, 
    onPlayNext
  ]); 

  // 4. PROGRESS ANIMATION - Added activeContext and activeId to dependencies
  // This ensures the animation loop restarts/resyncs when the context switches
  useEffect(() => {
    const animate = () => {
      const sound = soundRef.current;
      // We check sound.playing() to ensure we only update when the audio is moving
      if (sound && sound.playing() && !isDragging) {
        setCurrentTime(sound.seek());
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      animate();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
    // By adding context and ID here, Step 4 "re-hooks" into the new sound instance
    // created by Step 3, preventing the time from staying at 0:00.
  }, [isPlaying, isDragging, activeId, activeContext?.type, activeContext?.title]);

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (value: number | number[]) => {
    setIsDragging(true); 
    setCurrentTime(value as number); 
  };

  const handleSliderAfterChange = (value: number | number[]) => {
    const sound = soundRef.current;
    if (sound) {
      sound.seek(value as number); 
      setIsDragging(false); 
    }
  };

  return (
    <div className="fixed bottom-0 bg-black w-full py-2 h-[80px] px-4 border-t border-neutral-700 grid grid-cols-3 z-50">
      {/* Left Side: Metadata */}
      <div className="flex w-full justify-start items-center gap-x-4">
        <div className="relative h-14 w-14 rounded-md overflow-hidden shadow-md">
            {imageUrl ? (
             <Image fill src={imageUrl} alt={song.title} className="object-cover" />
            ) : (
             <div className="bg-neutral-800 h-full w-full" />
            )}
        </div>
        <div className="hidden md:block min-w-0">
          <p className="text-white font-medium truncate">{song.title}</p>
          <p className="text-neutral-400 text-sm truncate">
            {song.albums?.artists?.name || "Unknown Artist"}
          </p>
        </div>
        <LikeButton songId={song.id} />
      </div>

      {/* Center: Controls */}
      <div className="flex flex-col items-center justify-center gap-y-2 w-full max-w-[722px]">
        <div className="flex items-center gap-x-6">
          <BsShuffle 
            size={20} 
            onClick={toggleShuffle}
            className={`cursor-pointer transition ${isShuffled ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`}
          />
          <AiFillStepBackward
            size={30}
            onClick={playPrevious}
            className="text-neutral-400 cursor-pointer hover:text-white transition active:scale-90"
          />
          <div 
            onClick={handlePlay}
            className="flex items-center justify-center h-10 w-10 rounded-full bg-white p-1 cursor-pointer hover:scale-110 transition shadow-lg"
          >
            <Icon size={26} className="text-black" />
          </div>
          <AiFillStepForward
            size={30}
            onClick={onPlayNext}
            className="text-neutral-400 cursor-pointer hover:text-white transition active:scale-90"
          />
          <div onClick={toggleRepeat} className="cursor-pointer">
              {repeatMode === 'one' ? (
                 <BsRepeat1 size={20} className="text-green-500 transition" />
              ) : (
                 <BsRepeat size={20} className={`transition ${repeatMode === 'context' ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`} />
              )}
          </div>
        </div>

        {/* Seekbar */}
        <div className="flex items-center gap-x-3 w-full group px-2">
          <p className="text-neutral-400 text-[10px] w-10 text-right tabular-nums">
            {formatTime(currentTime)}
          </p>
          
          <Slider 
            min={0}
            max={duration || 100} 
            value={currentTime}
            onChange={handleSliderChange}           
            onChangeComplete={handleSliderAfterChange}
            step={0.1}
            styles={{
              track: { backgroundColor: '#fff' },
              handle: { 
                backgroundColor: '#fff', 
                border: 'none', 
                boxShadow: 'none', 
                opacity: isDragging ? 1 : 0 
              },
              rail: { backgroundColor: 'rgb(63 63 70)' }
            }}
            className="group-hover:opacity-100"
          />

          <p className="text-neutral-400 text-[10px] w-10 text-left tabular-nums">
            {formatTime(duration)}
          </p>
        </div>
      </div>
      
      {/* Right Side: Volume */}
      <div className="flex w-full justify-end items-center pr-2 gap-x-4">
        <div className="flex items-center gap-x-2 w-[120px]">
            <VolumeIcon 
                onClick={toggleMute} 
                className="cursor-pointer hover:text-white transition text-neutral-400" 
                size={24} 
            />
            
            <div className="relative w-full flex items-center">
              <Slider 
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(value) => setVolume(value as number)}
                  styles={{
                      track: { backgroundColor: '#fff' },
                      handle: { backgroundColor: '#fff', border: 'none', boxShadow: 'none' },
                      rail: { backgroundColor: 'rgb(63 63 70)' }
                  }}
              />
              <p className="absolute -top-5 left-0 w-full text-center text-[9px] text-neutral-500 font-bold select-none pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  {Math.round(volume * 100)}%
              </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerContent;