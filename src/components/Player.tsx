// src/components/Player.tsx
'use client';

import usePlayerStore from "@/stores/usePlayerStore";
import useSongById from "@/hooks/useSongById";
import { useEffect, useMemo, useRef, useState } from "react";
import { Howl } from "howler";
import { BsPlayFill, BsPauseFill } from "react-icons/bs";
import { AiFillHeart, AiOutlineHeart } from "react-icons/ai";
import Slider from 'rc-slider';
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import { useUser } from "@supabase/auth-helpers-react"; // Added
import useAuthModalStore from "@/stores/useAuthModalStore"; // Added

const Player = () => {
  const { activeId } = usePlayerStore();
  const { song, songPath } = useSongById(activeId);
  
  // NEW: Hooks for Auth
  const user = useUser();
  const authModal = useAuthModalStore();

  const soundRef = useRef<Howl | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const imageUrl = useMemo(() => {
    if (!song?.albums?.image_path) return null;
    const { data: imageData } = supabase.storage.from('images').getPublicUrl(song.albums.image_path);
    return imageData.publicUrl;
  }, [song]);

  const Icon = isPlaying ? BsPauseFill : BsPlayFill;
  const LikeIcon = isLiked ? AiFillHeart : AiOutlineHeart;

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // NEW: Check if the song is already liked when it loads
  useEffect(() => {
    if (!user?.id || !activeId) {
      return;
    }

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
        onplay: () => setIsPlaying(true),
        onpause: () => setIsPlaying(false),
        onend: () => setIsPlaying(false),
        onload: () => setDuration(newSound.duration()),
      });
      soundRef.current = newSound;
      newSound.play();
    }
  }, [songPath]);

  useEffect(() => {
    const animate = () => {
      const sound = soundRef.current;
      if (sound && sound.playing()) {
        setCurrentTime(sound.seek());
        animationFrameRef.current = requestAnimationFrame(animate);
      }
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
  }, [isPlaying]);

  const handlePlay = () => {
    const sound = soundRef.current;
    if (!sound) return;
    if (isPlaying) {
      sound.pause();
    } else {
      sound.play();
    }
  };

  const handleSeek = (value: number | number[]) => {
    const sound = soundRef.current;
    if (sound) {
      sound.seek(value as number);
      setCurrentTime(value as number);
    }
  };

  // NEW: Database logic for liking/unliking
  const handleLike = async () => {
    if (!user) {
      return authModal.onOpen('sign_in'); // Open login if user is logged out
    }

    if (!activeId) return;

    if (isLiked) {
      // Logic to UNLIKE (Delete row)
      const { error } = await supabase
        .from('liked_songs')
        .delete()
        .eq('user_id', user.id)
        .eq('song_id', activeId);

      if (!error) {
        setIsLiked(false);
      }
    } else {
      // Logic to LIKE (Insert row)
      const { error } = await supabase
        .from('liked_songs')
        .insert({
          song_id: activeId,
          user_id: user.id
        });

      if (!error) {
        setIsLiked(true);
      }
    }
  };

  if (!song || !songPath || !activeId || !imageUrl) {
    return null;
  }

  return (
    <div 
      className="fixed bottom-0 bg-black w-full py-2 h-[80px] px-4 border-t border-neutral-700 grid grid-cols-3"
    >
      {/* Left Side: Song Info & Art */}
      <div className="flex w-full justify-start items-center gap-x-4">
        <div className="relative h-14 w-14 rounded-md overflow-hidden">
          <Image 
            fill
            src={imageUrl}
            alt={song.title}
            className="object-cover"
          />
        </div>
        <div>
          <p className="text-white font-medium truncate">{song.title}</p>
          <p className="text-neutral-400 text-sm truncate">{song.albums.artists.name}</p>
        </div>
      </div>

      {/* Center: Main Player Controls */}
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
            max={duration}
            value={currentTime}
            onChange={handleSeek}
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
      
      {/* 4. Right Side: Like Button */}
      <div className="flex w-full justify-end items-center pr-2">
        <button onClick={handleLike}>
          <LikeIcon size={25} className={isLiked ? 'text-green-500' : 'text-neutral-400'} />
        </button>
      </div>
    </div>
  );
};

export default Player;