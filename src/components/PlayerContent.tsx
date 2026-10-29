'use client';

import { useEffect, useRef, useState, useMemo, useCallback, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { BsPlayFill, BsPauseFill, BsShuffle, BsRepeat, BsRepeat1, BsChevronDown, BsThreeDotsVertical } from "react-icons/bs";
import { HiSpeakerWave, HiSpeakerXMark, HiQueueList } from "react-icons/hi2";
import { AiFillStepBackward, AiFillStepForward } from "react-icons/ai";
import { TbMicrophone2 } from "react-icons/tb";
import Slider from 'rc-slider';
import Image from "next/image";
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

import usePlayerStore from "@/stores/usePlayerStore";
import useQueueStore from "@/stores/useQueueStore";
import useAuthModalStore from "@/stores/useAuthModalStore";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import Queue from "@/components/Queue";
import LikeButton from "@/components/LikeButton";
import SongContextMenu from "@/components/SongContextMenu";
import { loadSong, stopSound, preloadNext } from "@/lib/audioEngine";
import useSongById from "@/hooks/useSongById";
import { offlineDb } from "@/lib/offlineDb";
import useOfflineModeStore from "@/stores/useOfflineModeStore";
import { withTimeout } from "@/lib/helpers";

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
  const { toggle, activeView, isOpen, onClose } = useQueueStore();

  const soundRef = useRef<any>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const saveProgressRef = useRef<((manualSeek?: number) => void) | null>(null);

  const isSongEndedRef = useRef(false);
  const prevIsPlayingRef = useRef(isPlaying);
  const prevActiveIdRef = useRef(activeId);
  const lastMediaPositionSyncRef = useRef<number>(0);

  const repeatModeRef = useRef(repeatMode);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [shouldMarquee, setShouldMarquee] = useState(false);
  const titleMeasureRef = useRef<HTMLSpanElement>(null);

  const imageUrl = useMemo(() => {
    // 1. Top-level imageUrl (set by playlist download service)
    if (song?.imageUrl) return song.imageUrl;
    // 2. Resolved image_url inside albums sub-object (set by album download service)
    if (song?.albums?.image_url) return song.albums.image_url;
    // 3. Fallback: derive from image_path via Supabase (works online; SW serves from cache offline)
    if (!song?.albums?.image_path) return null;
    const { data: imageData } = supabase.storage.from('images').getPublicUrl(song.albums.image_path);
    return imageData.publicUrl || null;
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

    // 🟢 Save to local IndexedDB (offline-safe & zero latency)
    offlineDb.playback_state.put({
      user_id: user.id,
      active_song_id: activeId,
      progress_ms: Math.floor(progress * 1000),
      is_playing: isPlaying,
      queue_state: queueState,
      updated_at: Date.now()
    }).catch(() => {});

    // Only send network upsert to Supabase if truly online
    const isOffline = !useOfflineModeStore.getState().isOnline || 
                      useOfflineModeStore.getState().isOfflineMode || 
                      (typeof navigator !== 'undefined' && !navigator.onLine);

    if (!isOffline) {
      withTimeout(supabase.from('playback_state').upsert(payload), 3000)
        .then(({ error }) => {
          if (error) {
            console.warn("Playback sync warning:", error.message);
            useOfflineModeStore.getState().setIsOnline(false);
          }
        })
        .catch((err) => {
          // Network failed (e.g. Failed to fetch when offline) - handled cleanly without error overlay
          console.warn("Playback sync offline:", err?.message || err);
          useOfflineModeStore.getState().setIsOnline(false);
        });
    }
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

  // 🟢 MEDIA SESSION API: Spotify-grade Lockscreen & System Media Notification (Title, Artist, Album, Art, Controls)
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !song) return;

    const title = song.title || 'Unknown Title';
    const artist = song.author || song.albums?.artists?.name || song.artists?.name || 'MuseBuzz';
    const album = song.album_title || song.albums?.title || 'Single';

    // Absolute artwork URL for OS-level media integration (Android/iOS lockscreens require absolute URLs)
    let artworkSrc = imageUrl;
    if (!artworkSrc) {
      artworkSrc = `${window.location.origin}/icons/icon-512.png`;
    } else if (!artworkSrc.startsWith('http') && !artworkSrc.startsWith('data:')) {
      artworkSrc = `${window.location.origin}${artworkSrc.startsWith('/') ? '' : '/'}${artworkSrc}`;
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork: [
          { src: artworkSrc, sizes: '96x96' },
          { src: artworkSrc, sizes: '128x128' },
          { src: artworkSrc, sizes: '192x192' },
          { src: artworkSrc, sizes: '256x256' },
          { src: artworkSrc, sizes: '384x384' },
          { src: artworkSrc, sizes: '512x512' },
        ],
      });
    } catch (e) {
      console.warn('[MediaSession] Metadata assignment error:', e);
    }

    // Dynamic document title for browser tab & OS fallback
    document.title = `${title} • ${artist} | MuseBuzz`;

    // Lockscreen, Headphone & System Key Handlers
    const handlers: Record<string, ((details?: any) => void) | null> = {
      play: () => {
        setIsPlaying(true);
        if (soundRef.current && !soundRef.current.playing()) soundRef.current.play();
      },
      pause: () => {
        setIsPlaying(false);
        if (soundRef.current && soundRef.current.playing()) soundRef.current.pause();
      },
      previoustrack: () => {
        handlePrevious();
      },
      nexttrack: () => {
        playNext();
      },
      seekto: (details: any) => {
        if (details?.seekTime !== undefined && details?.seekTime !== null && soundRef.current) {
          soundRef.current.seek(details.seekTime);
          setCurrentTime(details.seekTime);
          (window as any).__musebuzzCurrentTime = details.seekTime;
          if ('setPositionState' in navigator.mediaSession && duration > 0) {
            try {
              navigator.mediaSession.setPositionState({
                duration: Math.max(0, duration),
                playbackRate: 1,
                position: Math.min(Math.max(0, details.seekTime), duration),
              });
            } catch {}
          }
        }
      },
      seekforward: (details: any) => {
        if (soundRef.current) {
          const skip = details?.seekOffset || 10;
          const current = (soundRef.current.seek() as number) || 0;
          const newTime = Math.min(current + skip, duration || 9999);
          soundRef.current.seek(newTime);
          setCurrentTime(newTime);
          (window as any).__musebuzzCurrentTime = newTime;
        }
      },
      seekbackward: (details: any) => {
        if (soundRef.current) {
          const skip = details?.seekOffset || 10;
          const current = (soundRef.current.seek() as number) || 0;
          const newTime = Math.max(current - skip, 0);
          soundRef.current.seek(newTime);
          setCurrentTime(newTime);
          (window as any).__musebuzzCurrentTime = newTime;
        }
      },
      stop: () => {
        setIsPlaying(false);
        stopSound();
      },
    };

    Object.entries(handlers).forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action as any, handler);
      } catch {}
    });

    return () => {
      document.title = 'MuseBuzz';
      Object.keys(handlers).forEach((action) => {
        try {
          navigator.mediaSession.setActionHandler(action as any, null);
        } catch {}
      });
    };
  }, [song, imageUrl, duration, setIsPlaying, playNext]);

  // Sync playbackState (playing / paused) with lockscreen
  useEffect(() => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

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
    if (isMobileExpanded) window.history.pushState({ playerExpanded: true }, '');
  }, [isMobileExpanded]);

  useEffect(() => {
    if (isOpen) window.history.pushState({ queueOpen: true }, '');
  }, [isOpen]);

  useEffect(() => {
    if (isMobileMenuOpen) window.history.pushState({ mobileMenuOpen: true }, '');
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      } else if (isOpen) {
        onClose(); 
      } else if (isMobileExpanded) {
        setIsMobileExpanded(false); 
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, isMobileExpanded, isMobileMenuOpen, onClose]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (soundRef.current && song?.id) {
        const seekTime = soundRef.current.seek() as number;
        saveProgress(seekTime);
        sessionStorage.setItem('restore_seek', JSON.stringify({
          songId: song.id,
          seek: seekTime
        }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveProgress, song?.id]);

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
    window.dispatchEvent(new CustomEvent('lyrics-time-update', { detail: 0 }));
    setDuration(0);
    isSongEndedRef.current = false;

    const newSound = loadSong(songPath, volume);

    // Check if we have an intended restore seek for THIS specific song
    const rawRestore = sessionStorage.getItem("restore_seek");
    let targetSeek = 0;
    if (rawRestore) {
      try {
        const parsed = JSON.parse(rawRestore);
        if (parsed?.songId === song.id && typeof parsed.seek === 'number' && parsed.seek > 0) {
          targetSeek = parsed.seek;
        }
      } catch {}
    }

    // Force seek to targetSeek (0 for new tracks) BEFORE starting playback
    try {
      newSound.seek(targetSeek);
      const node = (newSound as any)?._sounds?.[0]?._node;
      if (node) {
        node.currentTime = targetSeek;
      }
    } catch {}

    newSound.once("play", () => {
      setIsPlaying(true);
      // Guarantee underlying element didn't resume at previous song's offset
      if (targetSeek === 0) {
        try {
          const currentSeek = newSound.seek() as number;
          if (typeof currentSeek === 'number' && currentSeek > 1) {
            newSound.seek(0);
            const node = (newSound as any)?._sounds?.[0]?._node;
            if (node) node.currentTime = 0;
            setCurrentTime(0);
            (window as any).__musebuzzCurrentTime = 0;
          }
        } catch {}
      }
    });
    newSound.once("pause", () => setIsPlaying(false));

    newSound.once("end", () => {
      isSongEndedRef.current = true;
      if (repeatModeRef.current === "one") { newSound.play(); isSongEndedRef.current = false; }
      else { playNext(); }
    });

    const handleLoad = () => {
      const dur = newSound.duration();
      setDuration(dur);
      if (
        typeof window !== 'undefined' &&
        'mediaSession' in navigator &&
        'setPositionState' in navigator.mediaSession &&
        dur > 0
      ) {
        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(0, dur),
            playbackRate: 1,
            position: Math.min(Math.max(0, targetSeek), dur),
          });
        } catch {}
      }
      if (targetSeek > 0) {
        sessionStorage.removeItem("restore_seek");
        newSound.seek(targetSeek);
        setCurrentTime(targetSeek);
        (window as any).__musebuzzCurrentTime = targetSeek;
      } else {
        sessionStorage.removeItem("restore_seek");
        try {
          newSound.seek(0);
        } catch {}
        setCurrentTime(0);
        (window as any).__musebuzzCurrentTime = 0;
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

          // Throttled sync with lockscreen scrubber (every 1s)
          if (
            typeof window !== 'undefined' &&
            'mediaSession' in navigator &&
            'setPositionState' in navigator.mediaSession &&
            duration > 0
          ) {
            const now = performance.now();
            if (now - lastMediaPositionSyncRef.current > 1000) {
              lastMediaPositionSyncRef.current = now;
              try {
                navigator.mediaSession.setPositionState({
                  duration: Math.max(0, duration),
                  playbackRate: 1,
                  position: Math.min(Math.max(0, seekVal), duration),
                });
              } catch {}
            }
          }
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

  const authModal = useAuthModalStore();
  const handlePlay = () => {
    if (!user) {
      return authModal.onOpen('sign_in');
    }
    setIsPlaying(!isPlaying);
  };

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

  const handleSwipe = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold) {
      playNext();
    } else if (info.offset.x > swipeThreshold) {
      handlePrevious();
    }
  };

  const onClickAlbum = () => { if (song?.albums?.id) router.push(`/album/${song.albums.id}`); };
  const onClickArtist = () => { if (song?.albums?.artists?.id) router.push(`/artist/${song.albums.artists.id}`); };

  // 🟢 THE FIX: The Master Navigation Controller for Mobile Menus
  const handleMobileMenuAction = (action: () => void) => {
    // 1. Calculate how many ghost "pushStates" we need to clean up
    let stepsToPop = -1; // Pop the Bottom Sheet menu
    if (isMobileExpanded) stepsToPop--; // Pop the Maximized Player
    if (isOpen) stepsToPop--; // Pop the Queue/Lyrics if they are open

    // 2. Close everything in the UI instantly
    setIsMobileMenuOpen(false);
    setIsMobileExpanded(false);
    if (isOpen) onClose();

    // 3. Silently scrub the browser history so the back button doesn't break
    window.history.go(stepsToPop);

    // 4. Execute the navigation a split second later for maximum smoothness
    setTimeout(() => {
        action();
    }, 100);
  };

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

      {/* --- MOBILE COMPRESSED VIEW (hidden on desktop) --- */}
      <AnimatePresence>
        {!isMobileExpanded && (
          <>
            {/* Mobile underlay seal: perfectly seals bottom edge so background list items never peek through */}
            <div className="md:hidden fixed -bottom-4 left-0 right-0 h-10 bg-neutral-900 z-40 pointer-events-none" />

            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleSwipe}
              className="md:hidden fixed -bottom-[3px] left-0 right-0 w-full bg-neutral-900 border-t border-neutral-800 z-50 rounded-t-xl overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,0.5)] cursor-pointer touch-none pb-[calc(max(env(safe-area-inset-bottom),0px)+3px)]"
              onClick={() => setIsMobileExpanded(true)}
            >
            {/* Frame-accurate seek progress bar (synced directly at 60fps with zero lag or jump) */}
            <div className="absolute top-0 left-0 h-[2px] w-full bg-neutral-800 pointer-events-none">
              <div
                className="h-full bg-purple-500"
                style={{
                  width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                }}
              />
            </div>

            <div
              className="flex items-center justify-between px-3 py-2 active:bg-neutral-800 transition"
            >
              <div className="flex items-center gap-x-3 overflow-hidden flex-1 pointer-events-none">
                <div className="relative h-10 w-10 min-w-10 rounded shadow-md overflow-hidden bg-neutral-800">
                  {imageUrl && <Image unoptimized fill sizes="40px" src={imageUrl} alt={song.title} className="object-cover" />}
                </div>

                <div className="flex flex-col overflow-hidden w-full pt-1">
                  <p className="text-white font-medium text-sm truncate">{song.title}</p>
                  <p className="text-neutral-400 text-xs truncate">{song.albums?.artists?.name || "Unknown Artist"}</p>
                </div>
              </div>

              <div
                className="flex-shrink-0 flex items-center justify-center p-3 z-10"
                onClick={(e) => { e.stopPropagation(); handlePlay(); }}
              >
                {isPlaying ? <BsPauseFill size={28} className="text-white" /> : <BsPlayFill size={28} className="text-white" />}
              </div>
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- MOBILE EXPANDED VIEW (hidden on desktop) --- */}
      <AnimatePresence>
        {isMobileExpanded && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="md:hidden fixed inset-0 bg-zinc-950 z-[100] flex flex-col pt-2"
          >
            <div className="flex-1 relative flex flex-col w-full min-h-0 pt-10">
              
              <div className="w-full pb-6 px-6">
                <div className="relative flex w-full items-center justify-center h-10">
                  
                  <button
                    onClick={() => {
                       if (isOpen) {
                          window.history.back();
                          setTimeout(() => window.history.back(), 50);
                       } else {
                          window.history.back();
                       }
                    }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 p-2 -ml-2 text-neutral-400 hover:text-white transition active:scale-95"
                  >
                    <BsChevronDown size={28} />
                  </button>

                  <p className="text-[11px] font-bold tracking-widest text-neutral-500 uppercase pointer-events-none mt-1">
                    Now Playing
                  </p>

                  <div className="absolute right-0 top-1/2 -translate-y-1/2 -mr-2">
                    <button 
                      onClick={() => setIsMobileMenuOpen(true)}
                      className="p-2 text-neutral-400 hover:text-white transition active:scale-95 flex items-center justify-center"
                    >
                      <BsThreeDotsVertical size={24} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full flex items-center justify-center px-8 relative">
                <div className="aspect-square relative w-full h-auto max-h-full max-w-[400px] mx-auto rounded-xl overflow-hidden shadow-2xl bg-neutral-800">
                  {imageUrl && <Image unoptimized fill sizes="(max-width: 768px) 100vw, 400px" src={imageUrl} alt={song.title} className="object-cover" priority />}
                </div>
              </div>

              <Queue />

            </div>

            <div className="flex flex-col w-full h-[40vh] min-h-[300px] max-h-[380px] bg-gradient-to-t from-black via-zinc-950/95 to-transparent flex-shrink-0 mt-auto justify-end">

              <div className="px-8 flex items-center justify-between mb-4">
                <div className="flex flex-col overflow-hidden max-w-[80%]">
                  <h2 className="text-2xl font-bold text-white truncate break-words">{song.title}</h2>
                  <p className="text-lg text-neutral-400 mt-1 truncate">{song.albums?.artists?.name}</p>
                </div>
                <div className="flex-shrink-0">
                  <LikeButton songId={song.id} />
                </div>
              </div>

              <div className="px-8 mb-4 cursor-pointer">
                <Slider
                  min={0} max={duration || 100} value={currentTime}
                  onChange={handleSliderChange} onChangeComplete={handleSliderAfterChange} step={0.1}
                  styles={{ track: { backgroundColor: '#a855f7' }, handle: { backgroundColor: '#fff', border: 'none', boxShadow: 'none', width: '12px', height: '12px', marginTop: '-4px' }, rail: { backgroundColor: 'rgb(63 63 70)' } }}
                  className={`[&_.rc-slider-handle]:transition-opacity ${isDragging ? '[&_.rc-slider-handle]:opacity-100' : '[&_.rc-slider-handle]:opacity-0'}`}
                />
                <div className="flex justify-between items-center mt-2 text-xs text-neutral-400 tabular-nums">
                  <p>{formatTime(currentTime)}</p>
                  <p>{formatTime(duration)}</p>
                </div>
              </div>

              <div className="px-8 flex items-center justify-between mb-4">
                <BsShuffle size={24} onClick={isPlayingAutoplay ? undefined : toggleShuffle} className={`transition active:scale-90 ${isPlayingAutoplay ? 'text-neutral-700' : isShuffled ? 'text-green-500' : 'text-neutral-400'}`} />
                <AiFillStepBackward size={45} onClick={handlePrevious} className="text-neutral-100 active:scale-90 transition" />

                <div onClick={handlePlay} className="flex items-center justify-center p-2 active:scale-95 transition">
                  <Icon size={52} className="text-white" />
                </div>

                <AiFillStepForward size={45} onClick={playNext} className="text-neutral-100 active:scale-90 transition" />
                <div onClick={toggleRepeat} className="active:scale-90 transition">
                  {repeatMode === 'one' ? <BsRepeat1 size={24} className="text-green-500" /> : <BsRepeat size={24} className={repeatMode === 'context' ? 'text-green-500' : 'text-neutral-400'} />}
                </div>
              </div>

              <div className="pb-6 pt-2 px-8 flex items-center justify-between w-full">
                
                <div onClick={() => { 
                   if (isOpen && activeView === 'queue') window.history.back();
                   else if (isOpen && activeView !== 'queue') toggle('queue');
                   else toggle('queue');
                }} className={`p-3 rounded-full active:scale-95 transition ${activeView === 'queue' && isOpen ? 'text-green-500 bg-white/10' : 'text-white bg-white/5 hover:bg-white/10'}`}>
                  <HiQueueList size={22} />
                </div>
                
                <div className="flex items-center justify-center w-[120px] gap-2">
                  <VolumeIcon onClick={toggleMute} className="text-neutral-400" size={20} />
                  <Slider min={0} max={1} step={0.01} value={volume} onChange={(value) => setVolume(value as number)} styles={{ track: { backgroundColor: '#a855f7' }, handle: { backgroundColor: '#fff', border: 'none' }, rail: { backgroundColor: 'rgb(63 63 70)' } }} className="!cursor-auto" />
                </div>
                
                <div onClick={() => { 
                   if (!hasLyrics) return;
                   if (isOpen && activeView === 'lyrics') window.history.back();
                   else if (isOpen && activeView !== 'lyrics') toggle('lyrics');
                   else toggle('lyrics');
                }} className={`p-3 rounded-full active:scale-95 transition ${!hasLyrics ? 'text-neutral-600 bg-transparent' : activeView === 'lyrics' && isOpen ? 'text-green-500 bg-white/10' : 'text-white bg-white/5 hover:bg-white/10'}`}>
                  <TbMicrophone2 size={22} />
                </div>

              </div>
            </div>

            <AnimatePresence>
              {isMobileMenuOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 z-[110]"
                    onClick={() => window.history.back()}
                  />
                  <motion.div
                    initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="absolute bottom-0 left-0 w-full bg-neutral-900 border-t border-neutral-800 rounded-t-2xl z-[120] p-4 pb-8 flex flex-col gap-2 shadow-2xl"
                  >
                    <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mb-4" />
                    
                    <div className="flex items-center gap-3 p-2 mb-2 border-b border-neutral-800 pb-4">
                      <div className="relative h-12 w-12 rounded-md overflow-hidden bg-neutral-800 flex-shrink-0">
                        {imageUrl && <Image unoptimized fill sizes="48px" src={imageUrl} alt={song.title} className="object-cover" />}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <p className="text-white font-bold text-sm truncate">{song.title}</p>
                        <p className="text-neutral-400 text-xs truncate">{song.albums?.artists?.name}</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleMobileMenuAction(onClickArtist)} 
                      className="flex items-center gap-3 p-3 w-full text-left text-neutral-200 hover:bg-neutral-800 transition rounded-md font-medium"
                    >
                      Go to Artist
                    </button>

                    <button 
                      onClick={() => handleMobileMenuAction(onClickAlbum)} 
                      className="flex items-center gap-3 p-3 w-full text-left text-neutral-200 hover:bg-neutral-800 transition rounded-md font-medium"
                    >
                      Go to Album
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>

      {/* --- DESKTOP VIEW (hidden on mobile) --- */}
      <div className="hidden md:grid fixed bottom-0 bg-black w-full py-2 h-[80px] px-4 border-t border-neutral-700 grid-cols-3 z-50">

        <div className="flex w-full justify-start items-center gap-x-4 overflow-hidden">
          <div onClick={onClickAlbum} className="relative h-14 w-14 rounded-md overflow-hidden shadow-md cursor-pointer hover:opacity-80 transition flex-shrink-0">
            {imageUrl ? <Image unoptimized fill sizes="56px" src={imageUrl} alt={song.title} className="object-cover" /> : <div className="bg-neutral-800 h-full w-full" />}
          </div>

          <div className="hidden md:flex items-center gap-x-3 max-w-[200px] xl:max-w-[250px]">

            <div className="flex flex-col overflow-hidden">
              <div className="relative flex items-center h-[24px] overflow-hidden">

                <span ref={titleMeasureRef} className="opacity-0 pointer-events-none whitespace-nowrap text-white font-medium">
                  {song.title}
                </span>

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

          <div className="flex items-center gap-x-3 w-full group px-2 cursor-pointer">
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

        <div className="flex w-full justify-end items-center pr-2 gap-x-4">
          <div onClick={() => { if (hasLyrics || !hasLyrics) toggle('lyrics'); }} className={`transition ${!hasLyrics ? 'text-neutral-800 cursor-pointer' : activeView === 'lyrics' && isOpen ? 'text-green-500 cursor-pointer' : 'text-neutral-400 hover:text-white cursor-pointer'}`} title={hasLyrics ? "Lyrics" : "No lyrics available"}>
            <TbMicrophone2 size={22} />
          </div>
          <div onClick={() => toggle('queue')} className={`cursor-pointer transition ${activeView === 'queue' && isOpen ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`} title="Queue">
            <HiQueueList size={22} />
          </div>
          <div className="flex items-center gap-x-2 w-[120px]">
            <VolumeIcon onClick={toggleMute} className="cursor-pointer hover:text-white transition text-neutral-400" size={24} />
            <div className="relative w-full flex items-center group cursor-pointer">
              <SongContextMenu songId={song.id} albumId={song.albums?.id} artistId={song.albums?.artists?.id}>
                <Slider min={0} max={1} step={0.01} value={volume} onChange={(value) => setVolume(value as number)} styles={{ track: { backgroundColor: '#a855f7' }, handle: { backgroundColor: '#fff', border: 'none', boxShadow: 'none' }, rail: { backgroundColor: 'rgb(63 63 70)' } }} className="!cursor-pointer [&_.rc-slider-handle]:!cursor-pointer [&_.rc-slider-handle]:opacity-0 group-hover:[&_.rc-slider-handle]:opacity-100 [&_.rc-slider-handle]:transition-opacity" />
              </SongContextMenu>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PlayerContent;