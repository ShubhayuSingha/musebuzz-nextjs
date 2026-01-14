// src/components/PlayerContent.tsx
'use client';

import { useEffect, useRef, useState, useMemo } from "react";
import { Howl } from "howler";
import { BsPlayFill, BsPauseFill } from "react-icons/bs";
import { AiFillHeart, AiOutlineHeart } from "react-icons/ai";
import { HiSpeakerWave, HiSpeakerXMark } from "react-icons/hi2";
import Slider from 'rc-slider';
import Image from "next/image";
import { useUser } from "@supabase/auth-helpers-react";

import useAuthModalStore from "@/stores/useAuthModalStore";
import usePlayerStore from "@/stores/usePlayerStore";
import { supabase } from "@/lib/supabaseClient";

interface PlayerContentProps {
  song: any;
  songPath: string;
}

const PlayerContent: React.FC<PlayerContentProps> = ({ song, songPath }) => {
  // 1. IMPORT 'prevVolume' AND 'setPrevVolume'
  const { activeId, setId, ids, volume, setVolume, prevVolume, setPrevVolume } = usePlayerStore();
  
  const user = useUser();
  const authModal = useAuthModalStore();

  const soundRef = useRef<Howl | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const imageUrl = useMemo(() => {
    if (!song?.albums?.image_path) return null;
    const { data: imageData } = supabase.storage.from('images').getPublicUrl(song.albums.image_path);
    return imageData.publicUrl;
  }, [song]);

  const Icon = isPlaying ? BsPauseFill : BsPlayFill;
  const LikeIcon = isLiked ? AiFillHeart : AiOutlineHeart;
  
  const VolumeIcon = volume === 0 ? HiSpeakerXMark : HiSpeakerWave;

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const onPlayNext = () => {
    if (ids.length === 0) return;
    const currentIndex = ids.findIndex((id) => id === activeId);
    const nextSong = ids[currentIndex + 1];

    if (nextSong) {
      setId(nextSong);
    } else {
        setId(ids[0]); 
    }
  }

  // 2. UPDATED MUTE LOGIC
  const toggleMute = () => {
    if (volume === 0) {
      // UNMUTE: Restore the previous volume
      setVolume(prevVolume);
    } else {
      // MUTE: Save current volume to memory, then set to 0
      setPrevVolume(volume);
      setVolume(0);
    }
  }

  useEffect(() => {
    if (soundRef.current) {
        soundRef.current.volume(volume);
    }
  }, [volume]);

  useEffect(() => {
    if (!user?.id || !activeId) return;

    const checkLikedStatus = async () => {
      const { data, error } = await supabase
        .from('liked_songs')
        .select('*')
        .eq('user_id', user.id)
        .eq('song_id', activeId)
        .single();

      if (!error && data) {
        setIsLiked(true);
      } else {
        setIsLiked(false);
      }
    };

    checkLikedStatus();
  }, [activeId, user?.id]);

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
            setIsPlaying(false);
            onPlayNext();
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
    const sound = soundRef.current;
    if (!sound) return;
    if (isPlaying) {
      sound.pause();
    } else {
      sound.play();
    }
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

  const handleLike = async () => {
    if (!user) {
      return authModal.onOpen('sign_in');
    }
    if (!activeId) return;

    if (isLiked) {
      const { error } = await supabase
        .from('liked_songs')
        .delete()
        .eq('user_id', user.id)
        .eq('song_id', activeId);
      if (!error) setIsLiked(false);
    } else {
      const { error } = await supabase
        .from('liked_songs')
        .insert({ song_id: activeId, user_id: user.id });
      if (!error) setIsLiked(true);
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
      </div>

      {/* Center Controls */}
      <div className="flex flex-col items-center justify-center gap-y-2 w-full max-w-[722px]">
        <button 
          onClick={handlePlay}
          className="flex items-center justify-center h-10 w-10 rounded-full bg-white p-1 cursor-pointer hover:scale-110 transition"
        >
          <Icon size={26} className="text-black" />
        </button>
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
        <button onClick={handleLike}>
          <LikeIcon size={25} className={isLiked ? 'text-green-500' : 'text-neutral-400'} />
        </button>

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
              <p className="absolute top-4 left-0 w-full text-center text-[10px] text-neutral-400 font-medium select-none pointer-events-none">
                {Math.round(volume * 100)}%
              </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerContent;