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

  // 1. SYNC VOLUME
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.volume(volume);
    }
  }, [volume]);

  // 2. NEW FIX: SYNC PLAY/PAUSE STATE
  // This listens to the Store. If you click "Pause" in the Album list,
  // this effect fires and actually pauses the audio engine.
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

  // 3. LOAD SONG
  useEffect(() => {
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
  }, [songPath]); 

  useEffect(() => {
    const animate = () => {
      const sound = soundRef.current;
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
  }, [isPlaying, isDragging]);

  const handlePlay = () => {
    // We just toggle the state. 
    // The useEffect above will handle the actual sound.play()/pause()
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
    <div className="fixed bottom-0 bg-black w-full py-2 h-[80px] px-4 border-t border-neutral-700 grid grid-cols-3">
      {/* Left Side */}
      <div className="flex w-full justify-start items-center gap-x-4">
        <div className="relative h-14 w-14 rounded-md overflow-hidden">
            {imageUrl ? (
             <Image fill src={imageUrl} alt={song.title} className="object-cover" />
            ) : (
             <div className="bg-neutral-800 h-full w-full" />
            )}
        </div>
        <div className="hidden md:block">
          <p className="text-white font-medium truncate">{song.title}</p>
          <p className="text-neutral-400 text-sm truncate">{song.albums?.artists?.name || "Unknown"}</p>
        </div>
        <LikeButton songId={song.id} />
      </div>

      {/* Center Controls */}
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
            className="text-neutral-400 cursor-pointer hover:text-white transition"
          />
          <div 
            onClick={handlePlay}
            className="flex items-center justify-center h-10 w-10 rounded-full bg-white p-1 cursor-pointer hover:scale-110 transition"
          >
            <Icon size={26} className="text-black" />
          </div>
          <AiFillStepForward
            size={30}
            onClick={onPlayNext}
            className="text-neutral-400 cursor-pointer hover:text-white transition"
          />
          <div onClick={toggleRepeat} className="cursor-pointer">
              {repeatMode === 'one' ? (
                 <BsRepeat1 size={20} className="text-green-500 transition" />
              ) : (
                 <BsRepeat size={20} className={`transition ${repeatMode === 'context' ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`} />
              )}
          </div>
        </div>

        <div className="flex items-center gap-x-2 w-full group">
          <p className="text-neutral-400 text-xs w-12 text-right">{formatTime(currentTime)}</p>
          <Slider 
            min={0}
            max={duration || 100} 
            value={currentTime}
            onChange={handleSliderChange}           
            onChangeComplete={handleSliderAfterChange}
            step={0.1}
            styles={{
              track: { backgroundColor: '#fff' },
              handle: { backgroundColor: '#fff', border: 'none', boxShadow: 'none' },
              rail: { backgroundColor: 'rgb(63 63 70)' }
            }}
          />
          <p className="text-neutral-400 text-xs w-12 text-left">{formatTime(duration)}</p>
        </div>
      </div>
      
      {/* Right Side */}
      <div className="flex w-full justify-end items-center pr-2 gap-x-4">
        <div className="flex items-center gap-x-2 w-[120px]">
            <VolumeIcon 
                onClick={toggleMute} 
                className="cursor-pointer hover:text-white transition text-neutral-400" 
                size={28} 
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
              <p className="absolute top-4 left-0 w-full text-center text-[10px] text-neutral-400 font-extrabold select-none pointer-events-none">
                  {Math.round(volume * 100)}%
              </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerContent;