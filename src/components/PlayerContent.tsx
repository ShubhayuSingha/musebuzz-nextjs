// src/components/PlayerContent.tsx

'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Howl } from "howler";
import { BsPlayFill, BsPauseFill, BsShuffle, BsRepeat, BsRepeat1 } from "react-icons/bs";
import { HiSpeakerWave, HiSpeakerXMark, HiQueueList } from "react-icons/hi2"; 
import { AiFillStepBackward, AiFillStepForward } from "react-icons/ai";
import Slider from 'rc-slider';
import Image from "next/image";

import usePlayerStore from "@/stores/usePlayerStore";
import useQueueStore from "@/stores/useQueueStore"; 
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react"; 
import LikeButton from "@/components/LikeButton";

interface PlayerContentProps {
  song: any;
  songPath: string;
}

const PlayerContent: React.FC<PlayerContentProps> = ({ song, songPath }) => {
  const supabase = useSupabaseClient(); 
  const user = useUser(); 

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
    setPrevVolume,
    activeIdSignature,
    ids, 
    bucketB,       
    shuffledOrder, 
    isPlayingPriority,
    lastActiveContextId // 🟢 Get this to save it
  } = usePlayerStore(); 

  const { toggle, isOpen } = useQueueStore();
  const onPlayNext = playNext; 

  const soundRef = useRef<Howl | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null); 
  
  // FIX: Add Ref to track the latest save function
  const saveProgressRef = useRef<((manualSeek?: number) => void) | null>(null);

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
  }, [song, supabase]); 

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

  // DB SAVE FUNCTION
  const saveProgress = useCallback(async (manualSeek?: number) => {
    if (!user || !activeId) return;

    let progress = manualSeek;
    if (progress === undefined && soundRef.current) {
        progress = soundRef.current.seek() as number;
    }
    
    if (typeof progress !== 'number') return;

    const queueState = {
        ids: ids,                        
        context: activeContext,          
        priority: bucketB,               
        shuffledOrder: shuffledOrder,    
        isShuffled: isShuffled,          
        isPlayingPriority: isPlayingPriority,
        lastActiveId: lastActiveContextId // 🟢 Save the bookmark
    };

    const payload = {
        user_id: user.id,
        active_song_id: activeId,
        progress_ms: Math.floor(progress * 1000),
        is_playing: isPlaying, 
        queue_state: queueState, 
        updated_at: new Date().toISOString(),
    };

    supabase.from('playback_state').upsert(payload).then(({ error }) => {
        if (error) console.error("Sync Error:", error.message);
    });

  }, [user, activeId, volume, isPlaying, ids, activeContext, bucketB, shuffledOrder, isShuffled, isPlayingPriority, lastActiveContextId, supabase]);

  // FIX: Keep the Ref updated
  useEffect(() => {
    saveProgressRef.current = saveProgress;
  }, [saveProgress]);


  const handlePrevious = () => {
    if (soundRef.current) {
        const currentSeek = soundRef.current.seek();
        if (typeof currentSeek === 'number' && currentSeek > 2) {
            soundRef.current.seek(0);
            setCurrentTime(0); 
        } else {
            playPrevious();
        }
    } else {
        playPrevious();
    }
  };

  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.volume(volume);
    }
  }, [volume]);

  // PLAY/PAUSE + INTERVAL SAVE LOGIC
  useEffect(() => {
    const sound = soundRef.current;
    
    if (sound) {
      if (isPlaying && !sound.playing()) {
        sound.play();
        
        if (!saveIntervalRef.current) {
            saveIntervalRef.current = setInterval(() => {
                // FIX: Call via Ref to avoid stale closure
                if (saveProgressRef.current) {
                    saveProgressRef.current();
                }
            }, 20000); 
        }

      } else if (!isPlaying && sound.playing()) {
        sound.pause();
        saveProgress(); 
        
        if (saveIntervalRef.current) {
            clearInterval(saveIntervalRef.current);
            saveIntervalRef.current = null;
        }
      }
    }

    return () => {
        if (saveIntervalRef.current) {
            clearInterval(saveIntervalRef.current);
            saveIntervalRef.current = null;
        }
    }
  }, [isPlaying, saveProgress]);

  // EXIT SAVE
  useEffect(() => {
      const handleBeforeUnload = () => {
          if (soundRef.current) {
             saveProgress(soundRef.current.seek() as number);
          }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveProgress]);


  // SAFETY GAP + LOAD LOGIC
  useEffect(() => {
    if (debounceRef.current) {
        clearTimeout(debounceRef.current);
    }
    
    if (soundRef.current) {
        soundRef.current.stop();
        soundRef.current.unload();
        soundRef.current = null;
    }
    
    setCurrentTime(0); 
    setDuration(0);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    debounceRef.current = setTimeout(() => {
        if (!songPath) return;

        const newSound = new Howl({
            src: [songPath],
            html5: true,
            autoplay: false, 
            volume: volume, 
            onplay: () => setIsPlaying(true),
            onpause: () => setIsPlaying(false),
            onend: () => {
              if (repeatModeRef.current === 'one') {
                  newSound.play();
              } else {
                  onPlayNext(); 
              }
            },
            onload: () => {
                setDuration(newSound.duration());
                const restoreTime = sessionStorage.getItem('restore_seek');
                if (restoreTime) {
                    const seekSeconds = parseFloat(restoreTime);
                    if (!isNaN(seekSeconds)) {
                        newSound.seek(seekSeconds);
                        setCurrentTime(seekSeconds);
                    }
                    sessionStorage.removeItem('restore_seek');
                }
            },
        });
        
        soundRef.current = newSound;

        if (isPlaying) {
            newSound.play();
        }
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (soundRef.current) {
          soundRef.current.stop();
          soundRef.current.unload();
      }
    }
  }, [songPath, activeIdSignature, setIsPlaying, onPlayNext]); 

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
  }, [isPlaying, isDragging, activeId, activeIdSignature]);

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
      saveProgress(value as number); 
    }
  };

  return (
    <div className="fixed bottom-0 bg-black w-full py-2 h-[80px] px-4 border-t border-neutral-700 grid grid-cols-3 z-50">
      
      {/* LEFT */}
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

      {/* CENTER */}
      <div className="flex flex-col items-center justify-center gap-y-2 w-full max-w-[722px]">
        <div className="flex items-center gap-x-6">
          <BsShuffle 
            size={20} 
            onClick={toggleShuffle}
            className={`cursor-pointer transition ${isShuffled ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`}
          />
          <AiFillStepBackward
            size={30}
            onClick={handlePrevious} 
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

        <div className="flex items-center gap-x-3 w-full group px-2">
          <p className="text-neutral-400 text-[12px] w-10 text-right tabular-nums">
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
              track: { backgroundColor: '#a855f7' }, 
              handle: { 
                backgroundColor: '#fff', 
                border: 'none', 
                boxShadow: 'none', 
              },
              rail: { backgroundColor: 'rgb(63 63 70)' }
            }}
            className="
              !cursor-pointer
              [&_.rc-slider-handle]:!cursor-pointer
              [&_.rc-slider-handle]:opacity-0
              group-hover:[&_.rc-slider-handle]:opacity-100
              [&_.rc-slider-handle]:transition-opacity
            "
          />

          <p className="text-neutral-400 text-[12px] w-10 text-left tabular-nums">
            {formatTime(duration)}
          </p>
        </div>
      </div>
      
      {/* RIGHT */}
      <div className="flex w-full justify-end items-center pr-2 gap-x-4">
        
        <div 
            onClick={toggle}
            className={`cursor-pointer transition ${isOpen ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`}
            title="Queue"
        >
            <HiQueueList size={22} />
        </div>

        <div className="flex items-center gap-x-2 w-[120px]">
            <VolumeIcon 
                onClick={toggleMute} 
                className="cursor-pointer hover:text-white transition text-neutral-400" 
                size={24} 
            />
            
            <div className="relative w-full flex items-center group">
              <Slider 
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(value) => setVolume(value as number)}
                  styles={{
                      track: { backgroundColor: '#a855f7' }, 
                      handle: { 
                          backgroundColor: '#fff', 
                          border: 'none', 
                          boxShadow: 'none',
                      },
                      rail: { backgroundColor: 'rgb(63 63 70)' }
                  }}
                  className="
                    !cursor-pointer
                    [&_.rc-slider-handle]:!cursor-pointer
                    [&_.rc-slider-handle]:opacity-0
                    group-hover:[&_.rc-slider-handle]:opacity-100
                    [&_.rc-slider-handle]:transition-opacity
                  "
              />
            </div>
        </div>

      </div>
    </div>
  );
};

export default PlayerContent;