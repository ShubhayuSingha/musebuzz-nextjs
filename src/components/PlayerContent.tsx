'use client';

import { useEffect, useRef, useState, useMemo, useCallback, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { BsPlayFill, BsPauseFill, BsShuffle, BsRepeat, BsRepeat1 } from "react-icons/bs";
import { HiSpeakerWave, HiSpeakerXMark, HiQueueList } from "react-icons/hi2"; 
import { AiFillStepBackward, AiFillStepForward } from "react-icons/ai";
import { TbMicrophone2 } from "react-icons/tb"; 
import Slider from 'rc-slider';
import Image from "next/image";

import usePlayerStore from "@/stores/usePlayerStore";
import useQueueStore from "@/stores/useQueueStore"; 
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react"; 
import LikeButton from "@/components/LikeButton";
import { loadSong, stopSound, preloadNext } from "@/lib/audioEngine";
import useSongById from "@/hooks/useSongById";

interface PlayerContentProps {
  song: any;
  songPath: string;
}

const PlayerContent: React.FC<PlayerContentProps> = ({ song, songPath }) => {
  const router = useRouter();
  const supabase = useSupabaseClient(); 
  const user = useUser(); 

  const { 
    isPlaying, volume, activeId, activeContext, playNext, playPrevious,
    setVolume, setIsPlaying, toggleShuffle, toggleRepeat, isShuffled, 
    repeatMode, prevVolume, setPrevVolume, activeIdSignature, ids, 
    bucketA, bucketB, autoplay, shuffledOrder, isPlayingPriority,
    isPlayingAutoplay, lastActiveContextId, seekRequest, setSeekRequest
  } = usePlayerStore(); 

  const nextSongId = useMemo(() => {
    if (!activeId) return null;
    if (bucketB.length > 0) return bucketB[0].id;
    const idx = bucketA.indexOf(activeId);
    if (idx >= 0 && idx < bucketA.length - 1) return bucketA[idx + 1];
    if (autoplay.length > 0) return autoplay[0];
    return null;
  }, [activeId, bucketA, bucketB, autoplay]);

  const { songPath: nextSongPath } = useSongById(nextSongId || undefined);
  const { toggle, activeView, isOpen } = useQueueStore(); 

  const soundRef = useRef<any>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null); 
  const saveProgressRef = useRef<((manualSeek?: number) => void) | null>(null);
  
  const isSongEndedRef = useRef(false);
  const prevIsPlayingRef = useRef(isPlaying);
  const prevActiveIdRef = useRef(activeId);

  const repeatModeRef = useRef(repeatMode);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const [shouldMarquee, setShouldMarquee] = useState(false);
  const titleMeasureRef = useRef<HTMLSpanElement>(null);

  const imageUrl = useMemo(() => {
    if (!song?.albums?.image_path) return null;
    const { data: imageData } = supabase.storage.from('images').getPublicUrl(song.albums.image_path);
    return imageData.publicUrl;
  }, [song, supabase]); 

  const hasLyrics = !!song?.lyrics_snippet;
  const Icon = isPlaying ? BsPauseFill : BsPlayFill;
  const VolumeIcon = volume === 0 ? HiSpeakerXMark : HiSpeakerWave;

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const toggleMute = () => {
    if (volume === 0) setVolume(prevVolume);
    else { setPrevVolume(volume); setVolume(0); }
  }

  const saveProgress = useCallback(async (manualSeek?: number) => {
    if (!user || !activeId) return;
    let progress = manualSeek;
    if (progress === undefined && soundRef.current) progress = soundRef.current.seek() as number;
    if (typeof progress !== 'number') return;

    const queueState = {
        ids, context: activeContext, priority: bucketB, 
        shuffledOrder, isShuffled, isPlayingPriority, lastActiveId: lastActiveContextId 
    };

    const payload = {
        user_id: user.id, active_song_id: activeId, progress_ms: Math.floor(progress * 1000),
        is_playing: isPlaying, queue_state: queueState, updated_at: new Date().toISOString(),
    };

    supabase.from('playback_state').upsert(payload).then(({ error }) => {
        if (error) console.error("Sync Error:", error.message);
    });
  }, [user, activeId, volume, isPlaying, ids, activeContext, bucketB, shuffledOrder, isShuffled, isPlayingPriority, lastActiveContextId, supabase]);

  useEffect(() => { saveProgressRef.current = saveProgress; }, [saveProgress]);

  const handlePrevious = () => {
    if (soundRef.current) {
        const currentSeek = soundRef.current.seek();
        if (typeof currentSeek === 'number' && currentSeek > 2) {
            soundRef.current.seek(0);
            setCurrentTime(0); 
            (window as any).__musebuzzCurrentTime = 0; 
        } else { playPrevious(); }
    } else { playPrevious(); }
  };

  useEffect(() => {
    if (soundRef.current) soundRef.current.volume(volume);
  }, [volume]);

  // PLAY/PAUSE LOGIC
  useEffect(() => {
    const sound = soundRef.current;
    const playToggled = prevIsPlayingRef.current !== isPlaying;
    const songChanged = prevActiveIdRef.current !== activeId;

    prevIsPlayingRef.current = isPlaying;
    prevActiveIdRef.current = activeId;

    if (sound) {
      if (playToggled && !songChanged) {
        if (isPlaying && !sound.playing() && !isSongEndedRef.current) sound.play();
        else if (!isPlaying && sound.playing()) { sound.pause(); saveProgress(); }
      }
      if (isPlaying && !saveIntervalRef.current) {
          saveIntervalRef.current = setInterval(() => { if (saveProgressRef.current) saveProgressRef.current(); }, 20000); 
      } else if (!isPlaying && saveIntervalRef.current) {
          clearInterval(saveIntervalRef.current); saveIntervalRef.current = null;
      }
    }
    return () => {
        if (saveIntervalRef.current && !isPlaying) {
            clearInterval(saveIntervalRef.current); saveIntervalRef.current = null;
        }
    }
  }, [isPlaying, activeId, saveProgress]);

  useEffect(() => {
      const handleBeforeUnload = () => {
          if (soundRef.current) {
             const seekTime = soundRef.current.seek() as number;
             saveProgress(seekTime);
             sessionStorage.setItem('restore_seek', seekTime.toString());
          }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveProgress]);

  // LOAD LOGIC
  useEffect(() => {
    if (song.id !== activeId) {
        if (soundRef.current) { 
            soundRef.current.volume(0);
            soundRef.current.unload(); 
            soundRef.current = null; 
        }
        stopSound();
        return; 
    }

    if (!songPath) return;

    if (soundRef.current) { 
        soundRef.current.unload(); 
        soundRef.current = null; 
    }
    stopSound();

    setCurrentTime(0); 
    (window as any).__musebuzzCurrentTime = 0; 
    setDuration(0);
    isSongEndedRef.current = false;

    const newSound = loadSong(songPath, volume);

    newSound.once("play", () => setIsPlaying(true));
    newSound.once("pause", () => setIsPlaying(false));
    
    newSound.once("end", () => {
      isSongEndedRef.current = true;
      if (repeatModeRef.current === "one") { newSound.play(); isSongEndedRef.current = false; } 
      else { playNext(); }
    });

    const handleLoad = () => {
      setDuration(newSound.duration());
      const restoreTime = sessionStorage.getItem("restore_seek");
      if (restoreTime) {
        const seekSeconds = parseFloat(restoreTime);
        if (!isNaN(seekSeconds)) {
          newSound.seek(seekSeconds);
          setCurrentTime(seekSeconds);
          (window as any).__musebuzzCurrentTime = seekSeconds;
        }
        sessionStorage.removeItem("restore_seek");
      }
    };

    if (newSound.state() === 'loaded') handleLoad();
    else newSound.once("load", handleLoad);

    soundRef.current = newSound;
    if (isPlaying) newSound.play(); 

    return () => {
        if (soundRef.current) { 
            soundRef.current.unload(); 
            soundRef.current = null; 
        }
        stopSound();
    }
  }, [songPath, activeIdSignature, song.id, activeId]); 

  useEffect(() => {
    if (!nextSongPath) return;
    preloadNext(nextSongPath, volume);
  }, [nextSongPath, volume]);

  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      const sound = soundRef.current;
      if (sound && !isDragging) {
        const seekVal = sound.seek();
        if (typeof seekVal === 'number') {
          setCurrentTime(seekVal);
          (window as any).__musebuzzCurrentTime = seekVal; 
          window.dispatchEvent(new CustomEvent('lyrics-time-update', { detail: seekVal }));
        }
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    if (isPlaying) animationFrameId = requestAnimationFrame(animate);
    
    return () => { if (animationFrameId) cancelAnimationFrame(animationFrameId); };
  }, [isPlaying, isDragging, activeId, activeIdSignature]);

  useEffect(() => {
    if (seekRequest !== null && soundRef.current) {
        soundRef.current.seek(seekRequest);
        setCurrentTime(seekRequest);
        (window as any).__musebuzzCurrentTime = seekRequest; 
        if (!isPlaying) setIsPlaying(true);
        if (!soundRef.current.playing()) soundRef.current.play();
        setSeekRequest(null); 
    }
  }, [seekRequest, setIsPlaying, setSeekRequest, isPlaying]);

  const handlePlay = () => setIsPlaying(!isPlaying);

  const handleSliderChange = (value: number | number[]) => {
    setIsDragging(true); 
    setCurrentTime(value as number); 
    (window as any).__musebuzzCurrentTime = value as number; 
    window.dispatchEvent(new CustomEvent('lyrics-time-update', { detail: value as number }));
  };

  const handleSliderAfterChange = (value: number | number[]) => {
    const sound = soundRef.current;
    if (sound) {
      sound.seek(value as number); 
      setIsDragging(false); 
      saveProgress(value as number); 
    }
  };

  const onClickAlbum = () => { if (song?.albums?.id) router.push(`/album/${song.albums.id}`); };
  const onClickArtist = () => { if (song?.albums?.artists?.id) router.push(`/artist/${song.albums.artists.id}`); };

  useLayoutEffect(() => {
    if (titleMeasureRef.current) {
        const textWidth = titleMeasureRef.current.scrollWidth;
        const containerWidth = titleMeasureRef.current.parentElement?.clientWidth || 0;
        setShouldMarquee(textWidth > containerWidth);
    }
  }, [song.title]);

  return (
    <>
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee { display: flex; min-width: fit-content; animation: marquee 10s linear infinite; }
        .pause-marquee:hover { animation-play-state: paused; }
      `}</style>

      <div className="fixed bottom-0 bg-black w-full py-2 h-[80px] px-4 border-t border-neutral-700 grid grid-cols-3 z-50">
        
        {/* 🟢 LEFT SECTION - Updated Layout */}
        <div className="flex w-full justify-start items-center gap-x-4 overflow-hidden">
          <div onClick={onClickAlbum} className="relative h-14 w-14 rounded-md overflow-hidden shadow-md cursor-pointer hover:opacity-80 transition flex-shrink-0">
              {imageUrl ? <Image fill src={imageUrl} alt={song.title} className="object-cover" /> : <div className="bg-neutral-800 h-full w-full" />}
          </div>
          
          {/* We wrap the text and the heart in one row that shrinks up to max-width */}
          <div className="hidden md:flex items-center gap-x-3 max-w-[200px] xl:max-w-[250px]">
             
             {/* Text block shrinks exactly to fit content */}
             <div className="flex flex-col overflow-hidden">
                <div className="relative flex items-center h-[24px] overflow-hidden">
                    
                    {/* INVISIBLE MEASURING TAPE (Now static, pushing width naturally) */}
                    <span ref={titleMeasureRef} className="opacity-0 pointer-events-none whitespace-nowrap text-white font-medium">
                        {song.title}
                    </span>

                    {/* VISIBLE TEXT (Absolute so it overlays perfectly over the span width) */}
                    {shouldMarquee ? (
                        <div className="absolute inset-0 w-full h-full flex items-center overflow-hidden">
                            <div className="animate-marquee pause-marquee flex items-center">
                                <p className="text-white font-medium cursor-default mr-12 whitespace-nowrap">{song.title}</p>
                                <p className="text-white font-medium cursor-default mr-12 whitespace-nowrap">{song.title}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-white font-medium cursor-default truncate absolute inset-0 flex items-center">{song.title}</p>
                    )}
                 </div>
                 
                 <p onClick={onClickArtist} className="text-neutral-400 text-sm truncate cursor-pointer hover:text-white hover:underline transition" title={song.albums?.artists?.name || "Unknown Artist"}>
                   {song.albums?.artists?.name || "Unknown Artist"}
                 </p>
             </div>
             
             <div className="flex-shrink-0">
                 <LikeButton songId={song.id} />
             </div>
          </div>
        </div>

        {/* CENTER SECTION */}
        <div className="flex flex-col items-center justify-center gap-y-2 w-full max-w-[722px] mx-auto">
          <div className="flex items-center gap-x-6">
            <BsShuffle size={20} onClick={isPlayingAutoplay ? undefined : toggleShuffle} className={`transition ${isPlayingAutoplay ? 'text-neutral-700 cursor-not-allowed' : isShuffled ? 'text-green-500 cursor-pointer' : 'text-neutral-400 hover:text-white cursor-pointer'}`} />
            <AiFillStepBackward size={30} onClick={handlePrevious} className="text-neutral-400 cursor-pointer hover:text-white transition active:scale-90" />
            <div onClick={handlePlay} className="flex items-center justify-center h-10 w-10 rounded-full bg-white p-1 cursor-pointer hover:scale-110 transition shadow-lg">
              <Icon size={26} className="text-black" />
            </div>
            <AiFillStepForward size={30} onClick={playNext} className="text-neutral-400 cursor-pointer hover:text-white transition active:scale-90" />
            <div onClick={toggleRepeat} className="cursor-pointer">
                {repeatMode === 'one' ? <BsRepeat1 size={20} className="text-green-500 transition" /> : <BsRepeat size={20} className={`transition ${repeatMode === 'context' ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`} />}
            </div>
          </div>

          <div className="flex items-center gap-x-3 w-full group px-2">
            <p className="text-neutral-400 text-[12px] w-10 text-right tabular-nums">{formatTime(currentTime)}</p>
            <Slider 
              min={0} max={duration || 100} value={currentTime}
              onChange={handleSliderChange} onChangeComplete={handleSliderAfterChange} step={0.1}
              styles={{ track: { backgroundColor: '#a855f7' }, handle: { backgroundColor: '#fff', border: 'none', boxShadow: 'none' }, rail: { backgroundColor: 'rgb(63 63 70)' } }}
              className="!cursor-pointer [&_.rc-slider-handle]:!cursor-pointer [&_.rc-slider-handle]:opacity-0 group-hover:[&_.rc-slider-handle]:opacity-100 [&_.rc-slider-handle]:transition-opacity"
            />
            <p className="text-neutral-400 text-[12px] w-10 text-left tabular-nums">{formatTime(duration)}</p>
          </div>
        </div>
        
        {/* RIGHT SECTION */}
        <div className="flex w-full justify-end items-center pr-2 gap-x-4">
          <div onClick={() => { if (hasLyrics || !hasLyrics) toggle('lyrics'); }} className={`transition ${!hasLyrics ? 'text-neutral-800 cursor-pointer' : activeView === 'lyrics' && isOpen ? 'text-green-500 cursor-pointer' : 'text-neutral-400 hover:text-white cursor-pointer'}`} title={hasLyrics ? "Lyrics" : "No lyrics available"}>
              <TbMicrophone2 size={22} />
          </div>
          <div onClick={() => toggle('queue')} className={`cursor-pointer transition ${activeView === 'queue' && isOpen ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`} title="Queue">
              <HiQueueList size={22} />
          </div>
          <div className="flex items-center gap-x-2 w-[120px]">
              <VolumeIcon onClick={toggleMute} className="cursor-pointer hover:text-white transition text-neutral-400" size={24} />
              <div className="relative w-full flex items-center group">
                <Slider min={0} max={1} step={0.01} value={volume} onChange={(value) => setVolume(value as number)} styles={{ track: { backgroundColor: '#a855f7' }, handle: { backgroundColor: '#fff', border: 'none', boxShadow: 'none' }, rail: { backgroundColor: 'rgb(63 63 70)' } }} className="!cursor-pointer [&_.rc-slider-handle]:!cursor-pointer [&_.rc-slider-handle]:opacity-0 group-hover:[&_.rc-slider-handle]:opacity-100 [&_.rc-slider-handle]:transition-opacity" />
              </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PlayerContent;